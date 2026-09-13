create or replace function public.hl_reservation_inventory_start_date(p_start date,p_early boolean)
returns date
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select case when p_start is null then null when coalesce(p_early,false) then p_start-1 else p_start end
$$;

create or replace function public.hl_reservation_room_inventory_end_date(p_checkout_dates jsonb,p_room_id bigint,p_end date,p_late boolean)
returns date
language sql
immutable
set search_path to 'pg_catalog','public'
as $$
  select case
    when p_end is null then null
    when public.hl_reservation_room_end_date(p_checkout_dates,p_room_id,p_end)<p_end then public.hl_reservation_room_end_date(p_checkout_dates,p_room_id,p_end)
    when coalesce(p_late,false) then p_end+1
    else p_end
  end
$$;

create or replace function private.hl_guard_special_stay_inventory()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_room_id bigint;
  v_room_ids bigint[];
  v_room_label text;
  v_inventory_start date;
  v_inventory_end date;
  v_prefs jsonb:='{}'::jsonb;
  v_early_time time:='08:00';
  v_late_time time:='18:00';
begin
  if new.fecha_entrada is null or new.fecha_salida is null then return new; end if;

  select coalesce(settings->'preferences','{}'::jsonb)
    into v_prefs
  from public.property_settings
  where property_id=new.property_id;
  v_prefs:=coalesce(v_prefs,'{}'::jsonb);
  v_early_time:=private.hl_safe_time(v_prefs->>'early_checkin_time','08:00'::time);
  v_late_time:=private.hl_safe_time(v_prefs->>'late_checkout_time','18:00'::time);

  if coalesce(new.early_checkin,false) then
    new.ocupacion_desde_local:=new.fecha_entrada::timestamp+v_early_time;
  end if;
  if coalesce(new.late_checkout,false) then
    new.ocupacion_hasta_local:=new.fecha_salida::timestamp+v_late_time;
  end if;

  if new.estado='cancelada' or coalesce(new.no_show,false) then return new; end if;

  select coalesce(array_agg(distinct x order by x),array[]::bigint[])
    into v_room_ids
  from unnest(coalesce(new.habitaciones_ids,array[]::bigint[])||array[new.habitacion_id]) x
  where x is not null;

  foreach v_room_id in array v_room_ids loop
    v_inventory_start:=public.hl_reservation_inventory_start_date(new.fecha_entrada,new.early_checkin);
    v_inventory_end:=public.hl_reservation_room_inventory_end_date(new.room_checkout_dates,v_room_id,new.fecha_salida,new.late_checkout);
    if v_inventory_end<=v_inventory_start then continue; end if;

    select coalesce(nullif(trim(h.nombre),''),h.id::text)
      into v_room_label
    from public.habitaciones h
    where h.id=v_room_id and h.property_id=new.property_id;
    v_room_label:=coalesce(v_room_label,v_room_id::text);

    perform pg_advisory_xact_lock(hashtextextended(new.property_id::text||':'||v_room_id::text,0));

    if exists(
      select 1
      from public.reservas r
      where r.property_id=new.property_id
        and r.id<>coalesce(new.id,-1)
        and r.estado<>'cancelada'
        and coalesce(r.no_show,false)=false
        and v_room_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id])
        and public.hl_reservation_inventory_start_date(r.fecha_entrada,r.early_checkin)<v_inventory_end
        and public.hl_reservation_room_inventory_end_date(r.room_checkout_dates,v_room_id,r.fecha_salida,r.late_checkout)>v_inventory_start
    ) then
      raise exception using errcode='23P01',message=format('La habitación %s está ocupada en el turno requerido. No se puede aplicar el Early check-in / Late check-out ni crear otra reserva en ese espacio.',v_room_label);
    end if;

    if exists(
      select 1 from public.bloqueos b
      where b.property_id=new.property_id and b.habitacion_id=v_room_id
        and b.fecha_desde<v_inventory_end and b.fecha_hasta>v_inventory_start
    ) then
      raise exception using errcode='23P01',message=format('La habitación %s tiene un bloqueo operativo en el turno requerido.',v_room_label);
    end if;
  end loop;
  return new;
end
$$;

drop trigger if exists zz_hl_special_stay_inventory_guard on public.reservas;
create trigger zz_hl_special_stay_inventory_guard
before insert or update on public.reservas
for each row execute function private.hl_guard_special_stay_inventory();

create or replace function private.hl_enforce_room_block_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
begin
  if new.fecha_desde is null or new.fecha_hasta is null or new.fecha_hasta<=new.fecha_desde then
    raise exception using errcode='22023',message='El bloqueo necesita una fecha de fin posterior a la fecha de inicio.';
  end if;
  if not exists(select 1 from public.habitaciones h where h.id=new.habitacion_id and h.property_id=new.property_id and h.activa is distinct from false) then
    raise exception using errcode='23503',message='La habitación del bloqueo no pertenece a esta propiedad o está inactiva.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.property_id::text||':'||new.habitacion_id::text,0));
  if exists(
    select 1 from public.reservas r
    where r.property_id=new.property_id
      and r.estado<>'cancelada'
      and coalesce(r.no_show,false)=false
      and new.habitacion_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id])
      and (
        (coalesce(r.tipo_estadia,'overnight')='day_use' and r.fecha_entrada>=new.fecha_desde and r.fecha_entrada<new.fecha_hasta)
        or
        (coalesce(r.tipo_estadia,'overnight')<>'day_use'
          and public.hl_reservation_inventory_start_date(r.fecha_entrada,r.early_checkin)<new.fecha_hasta
          and public.hl_reservation_room_inventory_end_date(r.room_checkout_dates,new.habitacion_id,r.fecha_salida,r.late_checkout)>new.fecha_desde)
      )
  ) then
    raise exception using errcode='23P01',message='No se puede bloquear ese rango porque la habitación ya tiene una reserva o un horario especial.';
  end if;
  if exists(
    select 1 from public.bloqueos b
    where b.property_id=new.property_id and b.habitacion_id=new.habitacion_id
      and b.id<>coalesce(new.id,-1)
      and b.fecha_desde<new.fecha_hasta and b.fecha_hasta>new.fecha_desde
  ) then
    raise exception using errcode='23P01',message='La habitación ya tiene otro bloqueo que se superpone con esas fechas.';
  end if;
  return new;
end
$$;
