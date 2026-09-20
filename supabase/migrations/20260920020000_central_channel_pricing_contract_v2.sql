create or replace function public.hl_channel_inventory_snapshot(p_property_id uuid,p_start date,p_end date)
returns table(
  room_type text,stay_date date,capacity integer,reserved integer,blocked integer,group_hold integer,available integer,
  base_price numeric,min_stay integer,max_stay integer,stop_sell boolean,closed_to_arrival boolean,closed_to_departure boolean
)
language sql stable
set search_path to 'public','private','pg_temp'
as $function$
with dates as (
  select d::date stay_date
  from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d
  where p_end>=p_start and p_end-p_start<=370
), room_base as (
  select h.id,coalesce(nullif(trim(h.tipo),''),'Habitación') room_type
  from public.habitaciones h
  where h.property_id=p_property_id
    and h.activa is not false
    and lower(coalesce(h.estado,'')) not in ('mantenimiento','fuera_servicio','fuera de servicio')
), types as (
  select room_type,count(*)::int capacity from room_base group by room_type
), reservation_rooms as (
  select r.id,
         public.hl_reservation_room_start_date(r.habitaciones_detalle,x.room_id,r.fecha_entrada) fecha_entrada,
         public.hl_reservation_room_effective_end_date(r.habitaciones_detalle,r.room_checkout_dates,x.room_id,r.fecha_salida) fecha_salida,
         x.room_id
  from public.reservas r
  cross join lateral unnest(case when cardinality(r.habitaciones_ids)>0 then r.habitaciones_ids else array[r.habitacion_id] end) x(room_id)
  where r.property_id=p_property_id and x.room_id is not null
    and r.estado not in ('cancelada','finalizada') and not r.no_show
    and not(lower(coalesce(r.estado,''))='tentativa' and ((r.tentative_expired_at is not null) or (r.tentative_expires_at is not null and r.tentative_expires_at<=now())))
), reserved_by_type as (
  select rb.room_type,d.stay_date,count(distinct rr.room_id)::int reserved
  from dates d join reservation_rooms rr on d.stay_date>=rr.fecha_entrada and d.stay_date<rr.fecha_salida
  join room_base rb on rb.id=rr.room_id group by rb.room_type,d.stay_date
), blocked_by_type as (
  select rb.room_type,d.stay_date,count(distinct b.habitacion_id)::int blocked
  from dates d join public.bloqueos b on b.property_id=p_property_id and d.stay_date>=b.fecha_desde and d.stay_date<b.fecha_hasta
  join room_base rb on rb.id=b.habitacion_id group by rb.room_type,d.stay_date
), held_by_type as (
  select t.room_type,d.stay_date,coalesce(sum(g.quantity),0)::int group_hold
  from types t cross join dates d
  left join public.hotel_group_inventory_blocks g
    on g.property_id=p_property_id and lower(trim(g.room_type))=lower(trim(t.room_type))
   and d.stay_date>=g.arrival_date and d.stay_date<g.departure_date
   and lower(coalesce(g.status,'')) not in ('cancelled','canceled','released')
   and (g.release_date is null or g.release_date>=current_date or lower(coalesce(g.status,'')) in ('confirmed','inhouse'))
  group by t.room_type,d.stay_date
), resolved_rates as (
  select rb.room_type,d.stay_date,count(*)::int room_count,count(n.price)::int priced_count,
         count(distinct round(n.price,6))::int distinct_prices,min(n.price)::numeric net_price
  from room_base rb cross join dates d
  left join lateral private.hl_calendar_room_nightly_pricing(p_property_id,rb.id,d.stay_date,d.stay_date+1) n on true
  group by rb.room_type,d.stay_date
), restrictions as (
  select rb.room_type,d.stay_date,max(rc.min_stay)::int min_stay,bool_or(rc.stop_sell) stop_sell,
         bool_or(rc.closed_to_arrival) cta,bool_or(rc.closed_to_departure) ctd
  from room_base rb cross join dates d
  left join public.hotel_rate_calendar rc
    on rc.property_id=p_property_id and rc.habitacion_id=rb.id and rc.stay_date=d.stay_date
  group by rb.room_type,d.stay_date
), canonical_rate as (
  select rr.room_type,rr.stay_date,
         case
           when dc.base_price is not null then (private.hl_price_breakdown_from_net(p_property_id,dc.base_price)->>'commercial')::numeric
           when rr.priced_count=rr.room_count and rr.distinct_prices=1 then (private.hl_price_breakdown_from_net(p_property_id,rr.net_price)->>'commercial')::numeric
           else null
         end as commercial_price,
         coalesce(dc.min_stay,res.min_stay,1)::int min_stay,
         coalesce(dc.max_stay,0)::int max_stay,
         coalesce(dc.stop_sell,res.stop_sell,false) stop_sell,
         coalesce(dc.closed_to_arrival,res.cta,false) cta,
         coalesce(dc.closed_to_departure,res.ctd,false) ctd
  from resolved_rates rr
  left join restrictions res on res.room_type=rr.room_type and res.stay_date=rr.stay_date
  left join public.hotel_distribution_calendar dc
    on dc.property_id=p_property_id and dc.room_type=rr.room_type and dc.stay_date=rr.stay_date
)
select t.room_type,d.stay_date,t.capacity,
       coalesce(r.reserved,0),coalesce(b.blocked,0),coalesce(h.group_hold,0),
       greatest(0,t.capacity-coalesce(r.reserved,0)-coalesce(b.blocked,0)-coalesce(h.group_hold,0))::int,
       cr.commercial_price::numeric,cr.min_stay,cr.max_stay,cr.stop_sell,cr.cta,cr.ctd
from types t cross join dates d
left join reserved_by_type r on r.room_type=t.room_type and r.stay_date=d.stay_date
left join blocked_by_type b on b.room_type=t.room_type and b.stay_date=d.stay_date
left join held_by_type h on h.room_type=t.room_type and h.stay_date=d.stay_date
left join canonical_rate cr on cr.room_type=t.room_type and cr.stay_date=d.stay_date
order by t.room_type,d.stay_date
$function$;

comment on function public.hl_channel_inventory_snapshot(uuid,date,date) is
'Channel/distribution snapshot. base_price is the property commercial configured amount under the pricing contract, never raw habitaciones.precio. Ambiguous or incomplete category pricing returns NULL instead of guessing.';
