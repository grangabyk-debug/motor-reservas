-- Canonical financial basis for reservations with room-specific stay segments.
-- A group reservation can no longer be treated as tarifa_noche * global nights
-- once rooms have independent departure, cancellation, extension or move dates.

create or replace function public.hl_get_reservation_charge_basis(p_reservation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_property uuid;
  v_lodging_net numeric := 0;
  v_charges_net numeric := 0;
  v_charges_total numeric := 0;
  v_room_nights numeric := 0;
  v_room_count integer := 0;
  v_reservation_net numeric := 0;
  v_reservation_total numeric := 0;
begin
  select property_id,
         coalesce(precio_sin_impuestos_nacionales,subtotal,precio_total,0),
         coalesce(precio_total,0)
    into v_property,v_reservation_net,v_reservation_total
  from public.reservas
  where id=p_reservation_id;

  if v_property is null then
    raise exception using errcode='P0002',message='Reserva inexistente.';
  end if;
  if not private.user_has_property_access(v_property) then
    raise exception using errcode='42501',message='No tenés acceso a esta reserva.';
  end if;

  -- Keep the ledger synchronized before exposing the financial basis.
  perform private.hl_sync_reservation_folios_internal(p_reservation_id);

  select
    coalesce(sum(i.subtotal) filter(where i.status='active' and i.source_type='lodging'),0),
    coalesce(sum(i.subtotal) filter(where i.status='active'),0),
    coalesce(sum(i.total) filter(where i.status='active'),0),
    coalesce(sum(i.quantity) filter(where i.status='active' and i.source_type='lodging'),0),
    coalesce(count(distinct i.room_id) filter(where i.status='active' and i.source_type='lodging' and i.room_id is not null),0)::integer
  into v_lodging_net,v_charges_net,v_charges_total,v_room_nights,v_room_count
  from public.hotel_folio_items i
  where i.property_id=v_property
    and i.reservation_id=p_reservation_id;

  return jsonb_build_object(
    'reservation_id',p_reservation_id,
    'lodging_net',round(v_lodging_net,2),
    'charges_net',round(v_charges_net,2),
    'charges_total',round(v_charges_total,2),
    'reservation_net',round(v_reservation_net,2),
    'reservation_total',round(v_reservation_total,2),
    'room_nights',v_room_nights,
    'room_count',v_room_count,
    'net_matches',abs(v_charges_net-v_reservation_net)<=0.50,
    'total_matches',abs(v_charges_total-v_reservation_total)<=0.50
  );
end;
$function$;

revoke all on function public.hl_get_reservation_charge_basis(bigint) from public;
grant execute on function public.hl_get_reservation_charge_basis(bigint) to authenticated;

-- Analytics must follow the same room-segment model. A room is on the books only
-- while its own segment is active, not for the reservation's entire global range.
create or replace function private.capture_hotel_analytics_snapshot_internal(
  p_property_id uuid,
  p_captured_on date default current_date,
  p_horizon_days integer default 365
)
returns integer
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_rows integer := 0;
begin
  with dates as (
    select generate_series(p_captured_on,p_captured_on+greatest(1,p_horizon_days),interval '1 day')::date as stay_date
  ), base_rooms as (
    select h.id
    from public.habitaciones h
    where h.property_id=p_property_id
      and coalesce(h.activa,true)=true
      and lower(coalesce(h.estado,'')) not in ('fuera_de_servicio','out_of_service')
  ), capacity as (
    select d.stay_date,
      greatest(0,count(br.id)-count(distinct case when b.id is not null then br.id end))::integer as room_count
    from dates d
    cross join base_rooms br
    left join public.bloqueos b
      on b.property_id=p_property_id
      and b.habitacion_id=br.id
      and b.fecha_desde<=d.stay_date
      and b.fecha_hasta>d.stay_date
      and b.created_at::date<=p_captured_on
    group by d.stay_date
  ), reservation_base as (
    select r.*,
      upper(coalesce(nullif(r.moneda,''),'ARS')) as analytics_currency,
      greatest(1,(r.fecha_salida-r.fecha_entrada))::numeric as stay_nights,
      coalesce(r.precio_total,0)::numeric as total_value,
      coalesce((
        select array_agg(distinct x order by x)
        from unnest(
          coalesce(r.habitaciones_ids,'{}'::bigint[]) ||
          case when r.habitacion_id is null then '{}'::bigint[] else array[r.habitacion_id]::bigint[] end
        ) as ids(x)
        where x is not null
      ),'{}'::bigint[]) as analytics_room_ids
    from public.reservas r
    where r.property_id=p_property_id
      and r.created_at::date<=p_captured_on
      and (r.cancelled_at is null or r.cancelled_at::date>p_captured_on)
      and not (lower(coalesce(r.estado,''))='cancelada' and r.cancelled_at is null)
      and (r.no_show_at is null or r.no_show_at::date>p_captured_on)
      and not (coalesce(r.no_show,false)=true and r.no_show_at is null)
      and (r.merged_at is null or r.merged_at::date>p_captured_on)
      and r.fecha_salida>p_captured_on
  ), reservation_days as (
    select rb.id,d.stay_date,rb.analytics_currency as currency,
      active.room_count,
      active.room_value_per_night,
      rb.total_value/rb.stay_nights as total_value_per_night
    from reservation_base rb
    join dates d on d.stay_date>=rb.fecha_entrada and d.stay_date<rb.fecha_salida
    cross join lateral (
      select count(*)::integer as room_count,
        coalesce(sum(
          coalesce(
            (
              select nullif(e->>'tarifa_noche','')::numeric
              from jsonb_array_elements(case when jsonb_typeof(rb.habitaciones_detalle)='array' then rb.habitaciones_detalle else '[]'::jsonb end) e
              where coalesce(e->>'habitacion_id','')~'^\d+$'
                and (e->>'habitacion_id')::bigint=rid
                and coalesce(nullif(e->>'fecha_entrada','')::date,rb.fecha_entrada)<=d.stay_date
                and coalesce(nullif(e->>'fecha_salida','')::date,rb.fecha_salida)>d.stay_date
              order by coalesce(nullif(e->>'fecha_entrada','')::date,rb.fecha_entrada) desc
              limit 1
            ),
            case
              when cardinality(rb.analytics_room_ids)=1 then coalesce(rb.tarifa_noche,0)
              when cardinality(rb.analytics_room_ids)>1 then coalesce(rb.tarifa_noche,0)/cardinality(rb.analytics_room_ids)
              else 0
            end
          )
        ),0)::numeric as room_value_per_night
      from unnest(rb.analytics_room_ids) as room_ids(rid)
      where d.stay_date>=public.hl_reservation_room_start_date(rb.habitaciones_detalle,rid,rb.fecha_entrada)
        and d.stay_date<public.hl_reservation_room_effective_end_date(rb.habitaciones_detalle,rb.room_checkout_dates,rid,rb.fecha_salida)
    ) active
    where active.room_count>0
  ), rolled as (
    select stay_date,currency,
      sum(room_count)::integer as rooms_on_books,
      count(distinct id)::integer as reservations_on_books,
      sum(room_value_per_night)::numeric as room_revenue_on_books,
      sum(total_value_per_night)::numeric as total_revenue_on_books
    from reservation_days
    group by stay_date,currency
  ), currencies as (
    select distinct upper(coalesce(nullif(moneda,''),'ARS')) as currency
    from public.reservas
    where property_id=p_property_id and created_at::date<=p_captured_on
    union select 'ARS'
  ), rows_to_write as (
    select p_property_id as property_id,p_captured_on as captured_on,d.stay_date,c.currency,
      coalesce(cap.room_count,0) as sellable_rooms,
      coalesce(r.rooms_on_books,0) as rooms_on_books,
      coalesce(r.reservations_on_books,0) as reservations_on_books,
      coalesce(r.room_revenue_on_books,0) as room_revenue_on_books,
      coalesce(r.total_revenue_on_books,0) as total_revenue_on_books,
      case when coalesce(cap.room_count,0)>0 then least(100,coalesce(r.rooms_on_books,0)::numeric/cap.room_count*100) else 0 end as occupancy_on_books,
      case when coalesce(r.rooms_on_books,0)>0 then coalesce(r.room_revenue_on_books,0)/r.rooms_on_books else 0 end as adr_on_books,
      case when coalesce(cap.room_count,0)>0 then coalesce(r.room_revenue_on_books,0)/cap.room_count else 0 end as revpar_on_books
    from dates d
    cross join currencies c
    left join capacity cap on cap.stay_date=d.stay_date
    left join rolled r on r.stay_date=d.stay_date and r.currency=c.currency
  )
  insert into public.hotel_analytics_daily_snapshots(
    property_id,captured_on,stay_date,currency,sellable_rooms,rooms_on_books,reservations_on_books,
    room_revenue_on_books,total_revenue_on_books,occupancy_on_books,adr_on_books,revpar_on_books,updated_at
  )
  select property_id,captured_on,stay_date,currency,sellable_rooms,rooms_on_books,reservations_on_books,
    room_revenue_on_books,total_revenue_on_books,occupancy_on_books,adr_on_books,revpar_on_books,now()
  from rows_to_write
  on conflict(property_id,captured_on,stay_date,currency) do update set
    sellable_rooms=excluded.sellable_rooms,
    rooms_on_books=excluded.rooms_on_books,
    reservations_on_books=excluded.reservations_on_books,
    room_revenue_on_books=excluded.room_revenue_on_books,
    total_revenue_on_books=excluded.total_revenue_on_books,
    occupancy_on_books=excluded.occupancy_on_books,
    adr_on_books=excluded.adr_on_books,
    revpar_on_books=excluded.revpar_on_books,
    updated_at=now();
  get diagnostics v_rows=row_count;
  return v_rows;
end;
$function$;