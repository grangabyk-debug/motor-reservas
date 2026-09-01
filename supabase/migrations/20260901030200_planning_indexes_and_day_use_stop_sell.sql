-- Habitación Llena · follow-up hardening for planning rules
create index if not exists hotel_planning_restrictions_created_by_idx
  on public.hotel_planning_restrictions(created_by)
  where created_by is not null;

create index if not exists reservas_stay_master_id_idx
  on public.reservas(stay_master_id)
  where stay_master_id is not null;

-- Same-day Day Use sales have no overnight loop, so enforce the latest Stop/Open decision on the arrival date explicitly.
create or replace function private.hl_enforce_planning_restrictions()
returns trigger
language plpgsql
set search_path to 'public','private','pg_temp'
as $$
declare
  v_room_type text;
  v_nights integer;
  v_rule record;
  v_day date;
  v_last_sold_day date;
begin
  if new.property_id is null or new.habitacion_id is null or new.fecha_entrada is null or new.fecha_salida is null then return new; end if;
  if new.estado='cancelada' or coalesce(new.no_show,false) then return new; end if;

  select h.tipo into v_room_type
  from public.habitaciones h
  where h.id=new.habitacion_id and h.property_id=new.property_id;
  if not found then return new; end if;

  v_nights := case when coalesce(new.tipo_estadia,'overnight')='day_use' then 1 else greatest(1,new.fecha_salida-new.fecha_entrada) end;
  v_last_sold_day := case when coalesce(new.tipo_estadia,'overnight')='day_use' or new.fecha_salida<=new.fecha_entrada then new.fecha_entrada else new.fecha_salida-1 end;

  v_day := new.fecha_entrada;
  while v_day <= v_last_sold_day loop
    select r.* into v_rule
    from public.hotel_planning_restrictions r
    where r.property_id=new.property_id and r.active
      and v_day between r.date_from and r.date_to
      and extract(dow from v_day)::smallint=any(r.weekdays)
      and (coalesce(cardinality(r.room_ids),0)=0 or new.habitacion_id=any(r.room_ids))
      and (r.room_type is null or lower(r.room_type)=lower(coalesce(v_room_type,'')))
      and (coalesce(cardinality(r.channels),0)=0 or exists(select 1 from unnest(r.channels) c where lower(c)=lower(coalesce(new.canal_reserva,'Directa'))))
      and r.action in ('stop_sell','open_sell')
    order by r.created_at desc limit 1;
    if found and v_rule.action='stop_sell' then
      raise exception using errcode='23P01', message='La fecha seleccionada tiene Stop Sell activo para esa habitación/canal.';
    end if;
    v_day := v_day + 1;
  end loop;

  select r.* into v_rule
  from public.hotel_planning_restrictions r
  where r.property_id=new.property_id and r.active
    and new.fecha_entrada between r.date_from and r.date_to
    and extract(dow from new.fecha_entrada)::smallint=any(r.weekdays)
    and (coalesce(cardinality(r.room_ids),0)=0 or new.habitacion_id=any(r.room_ids))
    and (r.room_type is null or lower(r.room_type)=lower(coalesce(v_room_type,'')))
    and (coalesce(cardinality(r.channels),0)=0 or exists(select 1 from unnest(r.channels) c where lower(c)=lower(coalesce(new.canal_reserva,'Directa'))))
    and r.action in ('closed_to_arrival','open_arrival')
  order by r.created_at desc limit 1;
  if found and v_rule.action='closed_to_arrival' then
    raise exception using errcode='23P01', message='La fecha seleccionada está cerrada a llegadas (CTA).';
  end if;

  select r.* into v_rule
  from public.hotel_planning_restrictions r
  where r.property_id=new.property_id and r.active
    and new.fecha_salida between r.date_from and r.date_to
    and extract(dow from new.fecha_salida)::smallint=any(r.weekdays)
    and (coalesce(cardinality(r.room_ids),0)=0 or new.habitacion_id=any(r.room_ids))
    and (r.room_type is null or lower(r.room_type)=lower(coalesce(v_room_type,'')))
    and (coalesce(cardinality(r.channels),0)=0 or exists(select 1 from unnest(r.channels) c where lower(c)=lower(coalesce(new.canal_reserva,'Directa'))))
    and r.action in ('closed_to_departure','open_departure')
  order by r.created_at desc limit 1;
  if found and v_rule.action='closed_to_departure' then
    raise exception using errcode='23P01', message='La fecha seleccionada está cerrada a salidas (CTD).';
  end if;

  select r.* into v_rule
  from public.hotel_planning_restrictions r
  where r.property_id=new.property_id and r.active
    and new.fecha_entrada between r.date_from and r.date_to
    and extract(dow from new.fecha_entrada)::smallint=any(r.weekdays)
    and (coalesce(cardinality(r.room_ids),0)=0 or new.habitacion_id=any(r.room_ids))
    and (r.room_type is null or lower(r.room_type)=lower(coalesce(v_room_type,'')))
    and (coalesce(cardinality(r.channels),0)=0 or exists(select 1 from unnest(r.channels) c where lower(c)=lower(coalesce(new.canal_reserva,'Directa'))))
    and r.action='min_stay'
  order by r.created_at desc limit 1;
  if found and v_nights < coalesce(v_rule.nights,1) then
    raise exception using errcode='23P01', message='La estadía no cumple la estancia mínima configurada.';
  end if;

  select r.* into v_rule
  from public.hotel_planning_restrictions r
  where r.property_id=new.property_id and r.active
    and new.fecha_entrada between r.date_from and r.date_to
    and extract(dow from new.fecha_entrada)::smallint=any(r.weekdays)
    and (coalesce(cardinality(r.room_ids),0)=0 or new.habitacion_id=any(r.room_ids))
    and (r.room_type is null or lower(r.room_type)=lower(coalesce(v_room_type,'')))
    and (coalesce(cardinality(r.channels),0)=0 or exists(select 1 from unnest(r.channels) c where lower(c)=lower(coalesce(new.canal_reserva,'Directa'))))
    and r.action='max_stay'
  order by r.created_at desc limit 1;
  if found and v_nights > coalesce(v_rule.nights,v_nights) then
    raise exception using errcode='23P01', message='La estadía supera la estancia máxima configurada.';
  end if;

  return new;
end;
$$;
