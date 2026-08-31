alter table public.reservas
  add column if not exists tipo_estadia text not null default 'overnight',
  add column if not exists ocupacion_desde_local timestamp without time zone,
  add column if not exists ocupacion_hasta_local timestamp without time zone,
  add column if not exists fecha_operativa date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='reservas_tipo_estadia_check' and conrelid='public.reservas'::regclass
  ) then
    alter table public.reservas
      add constraint reservas_tipo_estadia_check
      check (tipo_estadia in ('overnight','day_use')) not valid;
  end if;
end $$;
alter table public.reservas validate constraint reservas_tipo_estadia_check;

create or replace function private.hl_safe_time(p_value text, p_default time without time zone)
returns time without time zone
language plpgsql
immutable
set search_path to 'pg_catalog'
as $$
begin
  if nullif(trim(coalesce(p_value,'')),'') is null then return p_default; end if;
  begin
    return p_value::time;
  exception when others then
    return p_default;
  end;
end;
$$;

update public.hotel_os_settings
set operational_settings = coalesce(operational_settings,'{}'::jsonb) || jsonb_build_object('business_day_cutoff', coalesce(operational_settings->>'business_day_cutoff','05:00'))
where operational_settings->>'business_day_cutoff' is null;

with cfg as (
  select r.id,
         coalesce(s.operational_settings,'{}'::jsonb) as ops
  from public.reservas r
  left join public.hotel_os_settings s on s.property_id=r.property_id
)
update public.reservas r
set tipo_estadia = coalesce(nullif(r.tipo_estadia,''),'overnight'),
    ocupacion_desde_local = r.fecha_entrada::timestamp + private.hl_safe_time(r.hora_llegada_estimada, private.hl_safe_time(cfg.ops->>'checkin_time','14:00'::time)),
    ocupacion_hasta_local = r.fecha_salida::timestamp + private.hl_safe_time(r.hora_salida_estimada, private.hl_safe_time(cfg.ops->>'checkout_time','10:00'::time)),
    fecha_operativa = case
      when coalesce(nullif(r.tipo_estadia,''),'overnight')='overnight'
       and private.hl_safe_time(r.hora_llegada_estimada, private.hl_safe_time(cfg.ops->>'checkin_time','14:00'::time))
           < private.hl_safe_time(cfg.ops->>'business_day_cutoff','05:00'::time)
      then r.fecha_entrada - 1
      else r.fecha_entrada
    end
from cfg
where cfg.id=r.id;

create index if not exists idx_reservas_property_occupancy_start on public.reservas(property_id, ocupacion_desde_local);
create index if not exists idx_reservas_property_occupancy_end on public.reservas(property_id, ocupacion_hasta_local);
create index if not exists idx_reservas_property_operational_date on public.reservas(property_id, fecha_operativa);

create or replace function private.enforce_reservation_room_integrity()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_room_id bigint;
  v_room_ids bigint[];
  v_old_count integer;
  v_new_count integer;
  v_ops jsonb := '{}'::jsonb;
  v_checkin time := '14:00';
  v_checkout time := '10:00';
  v_cutoff time := '05:00';
  v_arrival time;
  v_departure time;
  v_start timestamp;
  v_end timestamp;
begin
  if tg_op = 'UPDATE' then
    v_old_count := coalesce(array_length(old.habitaciones_ids, 1), case when old.habitacion_id is null then 0 else 1 end);
    v_new_count := coalesce(array_length(new.habitaciones_ids, 1), case when new.habitacion_id is null then 0 else 1 end);
    if v_old_count > 1 and v_new_count < v_old_count and old.habitaciones_ids is distinct from new.habitaciones_ids then
      raise exception using errcode = '23P01', message = 'La reserva ocupa varias habitaciones. Usá una operación grupal para modificar su asignación.';
    end if;
  end if;

  new.tipo_estadia := coalesce(nullif(new.tipo_estadia,''),'overnight');
  if new.tipo_estadia not in ('overnight','day_use') then
    raise exception using errcode='22023', message='Tipo de estadía inválido.';
  end if;

  select coalesce(operational_settings,'{}'::jsonb)
    into v_ops
  from public.hotel_os_settings
  where property_id=new.property_id;
  v_ops := coalesce(v_ops,'{}'::jsonb);
  v_checkin := private.hl_safe_time(v_ops->>'checkin_time','14:00'::time);
  v_checkout := private.hl_safe_time(v_ops->>'checkout_time','10:00'::time);
  v_cutoff := private.hl_safe_time(v_ops->>'business_day_cutoff','05:00'::time);
  v_arrival := private.hl_safe_time(new.hora_llegada_estimada,v_checkin);
  v_departure := private.hl_safe_time(new.hora_salida_estimada,v_checkout);
  new.hora_llegada_estimada := to_char(v_arrival,'HH24:MI');
  new.hora_salida_estimada := to_char(v_departure,'HH24:MI');

  if new.fecha_entrada is null or new.fecha_salida is null then
    raise exception using errcode='22007', message='La reserva necesita fecha de entrada y salida.';
  end if;
  if new.fecha_salida < new.fecha_entrada then
    raise exception using errcode='22007', message='La fecha de salida no puede ser anterior a la entrada.';
  end if;
  if new.tipo_estadia='day_use' and new.fecha_salida<>new.fecha_entrada then
    raise exception using errcode='22007', message='Day Use debe comenzar y terminar el mismo día.';
  end if;

  v_start := new.fecha_entrada::timestamp + v_arrival;
  v_end := new.fecha_salida::timestamp + v_departure;
  if v_end <= v_start then
    raise exception using errcode='22007', message='La hora de salida debe ser posterior a la hora de entrada. Para una llegada de madrugada y salida por la mañana usá la misma fecha con horarios reales.';
  end if;

  new.ocupacion_desde_local := v_start;
  new.ocupacion_hasta_local := v_end;
  new.fecha_operativa := case when new.tipo_estadia='overnight' and v_arrival < v_cutoff then new.fecha_entrada-1 else new.fecha_entrada end;
  new.noches := case when new.tipo_estadia='day_use' then 0 else greatest(1,new.fecha_salida-new.fecha_operativa) end;

  if new.estado = 'cancelada' or coalesce(new.no_show,false) then
    return new;
  end if;

  select coalesce(array_agg(distinct x order by x), array[]::bigint[])
    into v_room_ids
  from unnest(coalesce(new.habitaciones_ids,array[]::bigint[]) || array[new.habitacion_id]) as x
  where x is not null;
  if coalesce(array_length(v_room_ids,1),0)=0 then
    raise exception using errcode='23502', message='La reserva necesita al menos una habitación.';
  end if;

  foreach v_room_id in array v_room_ids loop
    perform pg_advisory_xact_lock(hashtextextended(new.property_id::text || ':' || v_room_id::text,0));

    if exists (
      select 1
      from public.reservas r
      where r.property_id=new.property_id
        and r.id<>coalesce(new.id,-1)
        and r.estado<>'cancelada'
        and coalesce(r.no_show,false)=false
        and v_room_id=any(coalesce(r.habitaciones_ids,array[]::bigint[]) || array[r.habitacion_id])
        and tsrange(
          coalesce(r.ocupacion_desde_local,r.fecha_entrada::timestamp + private.hl_safe_time(r.hora_llegada_estimada,v_checkin)),
          coalesce(r.ocupacion_hasta_local,r.fecha_salida::timestamp + private.hl_safe_time(r.hora_salida_estimada,v_checkout)),
          '[)'
        ) && tsrange(v_start,v_end,'[)')
    ) then
      raise exception using errcode='23P01', message=format('La habitación %s ya está ocupada durante parte de ese horario.',v_room_id);
    end if;

    if exists (
      select 1
      from public.bloqueos b
      where b.property_id=new.property_id
        and b.habitacion_id=v_room_id
        and tsrange(b.fecha_desde::timestamp,b.fecha_hasta::timestamp,'[)') && tsrange(v_start,v_end,'[)')
    ) then
      raise exception using errcode='23P01', message=format('La habitación %s tiene un bloqueo operativo durante ese horario.',v_room_id);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_reservas_room_integrity on public.reservas;
create trigger trg_reservas_room_integrity
before insert or update on public.reservas
for each row execute function private.enforce_reservation_room_integrity();

create or replace function public.hl_enforce_rate_calendar_rules()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  v_nights integer;
  v_min_stay integer;
  v_cta boolean;
  v_ctd boolean;
  v_ops jsonb := '{}'::jsonb;
  v_arrival time := '14:00';
  v_cutoff time := '05:00';
  v_business_date date;
  v_inventory_end date;
begin
  if new.habitacion_id is null or new.property_id is null or new.fecha_entrada is null or new.fecha_salida is null then return new; end if;
  if new.estado='cancelada' or coalesce(new.no_show,false) then return new; end if;
  if tg_op='UPDATE'
     and new.habitacion_id is not distinct from old.habitacion_id
     and new.fecha_entrada is not distinct from old.fecha_entrada
     and new.fecha_salida is not distinct from old.fecha_salida
     and coalesce(new.tipo_estadia,'overnight') is not distinct from coalesce(old.tipo_estadia,'overnight')
     and new.hora_llegada_estimada is not distinct from old.hora_llegada_estimada then return new; end if;

  select coalesce(operational_settings,'{}'::jsonb) into v_ops from public.hotel_os_settings where property_id=new.property_id;
  v_ops:=coalesce(v_ops,'{}'::jsonb);
  v_arrival:=private.hl_safe_time(new.hora_llegada_estimada,private.hl_safe_time(v_ops->>'checkin_time','14:00'::time));
  v_cutoff:=private.hl_safe_time(v_ops->>'business_day_cutoff','05:00'::time);
  v_business_date:=case when coalesce(new.tipo_estadia,'overnight')='overnight' and v_arrival<v_cutoff then new.fecha_entrada-1 else new.fecha_entrada end;

  if coalesce(new.tipo_estadia,'overnight')='day_use' then
    if exists(select 1 from public.hotel_rate_calendar rc where rc.property_id=new.property_id and rc.habitacion_id=new.habitacion_id and rc.stay_date=new.fecha_entrada and rc.stop_sell=true) then
      raise exception using errcode='P0001', message='Hay una restricción Stop Sell activa para ese Day Use.';
    end if;
    select coalesce(closed_to_arrival,false) into v_cta from public.hotel_rate_calendar where property_id=new.property_id and habitacion_id=new.habitacion_id and stay_date=new.fecha_entrada;
    if coalesce(v_cta,false) then raise exception using errcode='P0001', message='La fecha está cerrada a arribos (CTA).'; end if;
    return new;
  end if;

  v_nights:=greatest(1,new.fecha_salida-v_business_date);
  v_inventory_end:=v_business_date+v_nights;
  if exists(
    select 1 from public.hotel_rate_calendar rc
    where rc.property_id=new.property_id and rc.habitacion_id=new.habitacion_id
      and rc.stay_date>=v_business_date and rc.stay_date<v_inventory_end and rc.stop_sell=true
  ) then raise exception using errcode='P0001', message='Hay una restricción Stop Sell activa dentro de la estadía.'; end if;

  select coalesce(min_stay,1),coalesce(closed_to_arrival,false) into v_min_stay,v_cta
  from public.hotel_rate_calendar where property_id=new.property_id and habitacion_id=new.habitacion_id and stay_date=v_business_date;
  if coalesce(v_cta,false) then raise exception using errcode='P0001', message='La fecha de llegada está cerrada a arribos (CTA).'; end if;
  if coalesce(v_min_stay,1)>v_nights then raise exception using errcode='P0001', message='La tarifa exige una estadía mínima de '||v_min_stay::text||' noches.'; end if;

  select coalesce(closed_to_departure,false) into v_ctd from public.hotel_rate_calendar
  where property_id=new.property_id and habitacion_id=new.habitacion_id and stay_date=new.fecha_salida;
  if coalesce(v_ctd,false) then raise exception using errcode='P0001', message='La fecha de salida está cerrada a partidas (CTD).'; end if;
  return new;
end;
$$;

drop trigger if exists hl_rate_calendar_reservation_guard on public.reservas;
create trigger hl_rate_calendar_reservation_guard
before insert or update of habitacion_id,fecha_entrada,fecha_salida,tipo_estadia,hora_llegada_estimada on public.reservas
for each row execute function public.hl_enforce_rate_calendar_rules();

create or replace function public.hl_create_reservation_atomic(p_reservation jsonb,p_payments jsonb default '[]'::jsonb)
returns public.reservas
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  v public.reservas%rowtype;
  p jsonb;
  v_property uuid;
  v_user uuid;
begin
  if p_reservation is null or jsonb_typeof(p_reservation)<>'object' then raise exception using errcode='22023', message='Datos de reserva inválidos.'; end if;
  if p_payments is null then p_payments:='[]'::jsonb; end if;
  if jsonb_typeof(p_payments)<>'array' then raise exception using errcode='22023', message='Los pagos iniciales deben ser una lista.'; end if;
  v_property:=nullif(p_reservation->>'property_id','')::uuid;
  v_user:=nullif(p_reservation->>'user_id','')::uuid;
  if v_property is null then raise exception using errcode='23502', message='Falta la propiedad de la reserva.'; end if;

  insert into public.reservas(
    property_id,user_id,alojamiento_id,habitacion_id,habitaciones_ids,
    fecha_entrada,fecha_salida,tipo_estadia,nombre_huesped,email_huesped,telefono_huesped,dni_huesped,
    direccion_huesped,provincia_estado_huesped,pais_huesped,cantidad_huespedes,
    canal_reserva,codigo_canal,tarifa_noche,noches,precio_total,moneda,notas,
    partner_id,group_id,garantia_tipo,garantia_marca,garantia_ultimos4,garantia_vencimiento,
    medio_pago_preferido,vehiculos,tipo_vehiculo,dominio_vehiculo,cochera_total,
    mascotas,mascotas_total,servicios,pasajeros,hora_llegada_estimada,hora_salida_estimada,estado,no_show
  ) values (
    v_property,v_user,
    nullif(p_reservation->>'alojamiento_id','')::bigint,
    nullif(p_reservation->>'habitacion_id','')::bigint,
    array(select value::bigint from jsonb_array_elements_text(coalesce(p_reservation->'habitaciones_ids','[]'::jsonb))),
    nullif(p_reservation->>'fecha_entrada','')::date,
    nullif(p_reservation->>'fecha_salida','')::date,
    coalesce(nullif(p_reservation->>'tipo_estadia',''),'overnight'),
    coalesce(p_reservation->>'nombre_huesped',''),
    nullif(p_reservation->>'email_huesped',''),nullif(p_reservation->>'telefono_huesped',''),nullif(p_reservation->>'dni_huesped',''),
    nullif(p_reservation->>'direccion_huesped',''),nullif(p_reservation->>'provincia_estado_huesped',''),nullif(p_reservation->>'pais_huesped',''),
    greatest(1,coalesce(nullif(p_reservation->>'cantidad_huespedes','')::integer,1)),
    coalesce(nullif(p_reservation->>'canal_reserva',''),'Directa'),nullif(p_reservation->>'codigo_canal',''),
    coalesce(nullif(p_reservation->>'tarifa_noche','')::numeric,0),coalesce(nullif(p_reservation->>'noches','')::integer,0),
    coalesce(nullif(p_reservation->>'precio_total','')::numeric,0),coalesce(nullif(p_reservation->>'moneda',''),'ARS'),nullif(p_reservation->>'notas',''),
    nullif(p_reservation->>'partner_id','')::uuid,nullif(p_reservation->>'group_id','')::uuid,
    nullif(p_reservation->>'garantia_tipo',''),nullif(p_reservation->>'garantia_marca',''),nullif(p_reservation->>'garantia_ultimos4',''),nullif(p_reservation->>'garantia_vencimiento',''),
    nullif(p_reservation->>'medio_pago_preferido',''),greatest(0,coalesce(nullif(p_reservation->>'vehiculos','')::integer,0)),
    nullif(p_reservation->>'tipo_vehiculo',''),nullif(p_reservation->>'dominio_vehiculo',''),coalesce(nullif(p_reservation->>'cochera_total','')::numeric,0),
    coalesce(p_reservation->'mascotas','[]'::jsonb),coalesce(nullif(p_reservation->>'mascotas_total','')::numeric,0),
    coalesce(p_reservation->'servicios','[]'::jsonb),coalesce(p_reservation->'pasajeros','[]'::jsonb),
    nullif(p_reservation->>'hora_llegada_estimada',''),nullif(p_reservation->>'hora_salida_estimada',''),
    coalesce(nullif(p_reservation->>'estado',''),'confirmada'),coalesce(nullif(p_reservation->>'no_show','')::boolean,false)
  ) returning * into v;

  for p in select value from jsonb_array_elements(p_payments) loop
    if coalesce(nullif(p->>'monto','')::numeric,0)<=0 then raise exception using errcode='22023', message='Hay un pago inicial con monto inválido.'; end if;
    if nullif(trim(coalesce(p->>'metodo','')),'') is null then raise exception using errcode='22023', message='Hay un pago inicial sin medio de pago.'; end if;
    insert into public.pagos(property_id,user_id,reserva_id,monto,metodo,moneda,nota)
    values(v.property_id,coalesce(nullif(p->>'user_id','')::uuid,v_user),v.id,(p->>'monto')::numeric,trim(p->>'metodo'),coalesce(nullif(p->>'moneda',''),'ARS'),nullif(p->>'nota',''));
  end loop;
  return v;
end;
$$;

create or replace function public.hl_move_reservation_atomic(p_reserva_id bigint,p_habitacion_id bigint,p_fecha_entrada date,p_fecha_salida date default null)
returns public.reservas
language plpgsql
set search_path to 'public'
as $$
declare
  v_reserva public.reservas%rowtype;
  v_habitacion public.habitaciones%rowtype;
  v_salida date;
  v_span integer;
  v_nights integer;
  v_units integer;
  v_subtotal numeric;
  v_descuento numeric;
  v_total numeric;
  v_ops jsonb := '{}'::jsonb;
  v_arrival time;
  v_departure time;
  v_cutoff time;
  v_business_date date;
  v_start timestamp;
  v_end timestamp;
begin
  select * into v_reserva from public.reservas where id=p_reserva_id for update;
  if not found then raise exception 'Reserva inexistente' using errcode='P0002'; end if;
  if v_reserva.estado='cancelada' or coalesce(v_reserva.no_show,false) then raise exception 'La reserva no se puede mover'; end if;
  select * into v_habitacion from public.habitaciones where id=p_habitacion_id and property_id=v_reserva.property_id and activa is distinct from false;
  if not found then raise exception 'Habitación no disponible'; end if;
  if lower(coalesce(v_habitacion.estado,'')) in ('mantenimiento','fuera_servicio') then raise exception 'Habitación fuera de servicio'; end if;

  v_span:=greatest(0,v_reserva.fecha_salida-v_reserva.fecha_entrada);
  v_salida:=coalesce(p_fecha_salida,p_fecha_entrada+v_span);
  if v_salida<p_fecha_entrada then raise exception 'La salida no puede ser anterior a la entrada'; end if;

  select coalesce(operational_settings,'{}'::jsonb) into v_ops from public.hotel_os_settings where property_id=v_reserva.property_id;
  v_ops:=coalesce(v_ops,'{}'::jsonb);
  v_arrival:=private.hl_safe_time(v_reserva.hora_llegada_estimada,private.hl_safe_time(v_ops->>'checkin_time','14:00'::time));
  v_departure:=private.hl_safe_time(v_reserva.hora_salida_estimada,private.hl_safe_time(v_ops->>'checkout_time','10:00'::time));
  v_cutoff:=private.hl_safe_time(v_ops->>'business_day_cutoff','05:00'::time);
  v_start:=p_fecha_entrada::timestamp+v_arrival;
  v_end:=v_salida::timestamp+v_departure;
  if v_end<=v_start then raise exception 'La hora de salida debe ser posterior a la hora de entrada'; end if;
  if coalesce(v_reserva.tipo_estadia,'overnight')='day_use' and v_salida<>p_fecha_entrada then raise exception 'Day Use debe comenzar y terminar el mismo día'; end if;
  v_business_date:=case when coalesce(v_reserva.tipo_estadia,'overnight')='overnight' and v_arrival<v_cutoff then p_fecha_entrada-1 else p_fecha_entrada end;
  v_nights:=case when coalesce(v_reserva.tipo_estadia,'overnight')='day_use' then 0 else greatest(1,v_salida-v_business_date) end;
  v_units:=case when coalesce(v_reserva.tipo_estadia,'overnight')='day_use' then 1 else v_nights end;

  if exists(
    select 1 from public.bloqueos b where b.habitacion_id=p_habitacion_id and b.property_id=v_reserva.property_id
      and tsrange(b.fecha_desde::timestamp,b.fecha_hasta::timestamp,'[)') && tsrange(v_start,v_end,'[)')
  ) then raise exception 'La habitación está bloqueada durante ese horario' using errcode='23P01'; end if;
  if exists(
    select 1 from public.reservas r where r.id<>v_reserva.id and r.property_id=v_reserva.property_id and r.estado<>'cancelada' and coalesce(r.no_show,false)=false
      and (r.habitacion_id=p_habitacion_id or p_habitacion_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])))
      and tsrange(coalesce(r.ocupacion_desde_local,r.fecha_entrada::timestamp+private.hl_safe_time(r.hora_llegada_estimada,'14:00'::time)),coalesce(r.ocupacion_hasta_local,r.fecha_salida::timestamp+private.hl_safe_time(r.hora_salida_estimada,'10:00'::time)),'[)') && tsrange(v_start,v_end,'[)')
  ) then raise exception 'La habitación ya tiene una reserva durante parte de ese horario' using errcode='23P01'; end if;

  v_subtotal:=greatest(0,coalesce(v_reserva.tarifa_noche,0)*v_units+coalesce(v_reserva.cochera_total,0)+coalesce(v_reserva.extra,0)+coalesce(v_reserva.early_checkin_importe,0)+coalesce(v_reserva.late_checkout_importe,0));
  v_descuento:=case when v_reserva.descuento_tipo='porcentaje' then v_subtotal*coalesce(v_reserva.descuento_valor,0)/100 else coalesce(v_reserva.descuento_importe,v_reserva.descuento_valor,0) end;
  v_total:=greatest(0,v_subtotal-v_descuento);

  update public.reservas
  set habitacion_id=p_habitacion_id,
      alojamiento_id=coalesce(v_habitacion.alojamiento_id,alojamiento_id),
      fecha_entrada=p_fecha_entrada,
      fecha_salida=v_salida,
      noches=v_nights,
      subtotal=v_subtotal,
      descuento_importe=v_descuento,
      precio_total=v_total,
      precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end,
      habitaciones_ids=case when habitaciones_ids is null or cardinality(habitaciones_ids)=0 then array[p_habitacion_id] when v_reserva.habitacion_id=any(habitaciones_ids) then array_replace(habitaciones_ids,v_reserva.habitacion_id,p_habitacion_id) else habitaciones_ids end,
      habitaciones_detalle=case when jsonb_typeof(habitaciones_detalle)='array' then (
        select coalesce(jsonb_agg(case when nullif(elem->>'habitacion_id','')::bigint=v_reserva.habitacion_id then jsonb_set(jsonb_set(elem,'{habitacion_id}',to_jsonb(p_habitacion_id),false),'{noches}',to_jsonb(v_nights),true) else elem end),'[]'::jsonb)
        from jsonb_array_elements(habitaciones_detalle) elem
      ) else habitaciones_detalle end
  where id=v_reserva.id returning * into v_reserva;
  return v_reserva;
end;
$$;

grant execute on function public.hl_create_reservation_atomic(jsonb,jsonb) to authenticated;
grant execute on function public.hl_move_reservation_atomic(bigint,bigint,date,date) to authenticated;