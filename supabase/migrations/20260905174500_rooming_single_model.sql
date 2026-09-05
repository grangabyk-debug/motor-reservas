-- Fuente única para categoría comercial, habitación física y armado de camas.
-- El backfill sólo normaliza metadata: desactiva triggers de negocio para no
-- revalidar estadías ficticias preexistentes ni generar eventos/canales falsos.

alter table public.reservas disable trigger user;

update public.reservas r
set habitaciones_detalle = coalesce((
  select jsonb_agg(
    jsonb_build_object(
      'habitacion_id', h.id,
      'nombre', h.nombre,
      'categoria_asignada', coalesce(nullif(trim(h.tipo),''),'Habitación'),
      'categoria_vendida', coalesce(
        nullif(old.elem->>'categoria_vendida',''),
        nullif(old.elem->>'vendida_como',''),
        nullif(old.elem->>'tipo',''),
        coalesce(nullif(trim(h.tipo),''),'Habitación')
      ),
      'huespedes', g.guests,
      'tarifa_noche', coalesce(
        nullif(old.elem->>'tarifa_noche','')::numeric,
        case when greatest(1,coalesce(cardinality(r.habitaciones_ids),0))=1 then r.tarifa_noche end,
        h.precio,0
      ),
      'rooming', case
        when jsonb_typeof(old.elem->'rooming')='object' then jsonb_build_object(
          'matrimonial',greatest(0,coalesce(nullif(old.elem->'rooming'->>'matrimonial','')::integer,0)),
          'individual',greatest(0,coalesce(nullif(old.elem->'rooming'->>'individual','')::integer,0))
        )
        when lower(coalesce(h.tipo,'')) ~ '(twin|individual|single)' then jsonb_build_object('matrimonial',0,'individual',g.guests)
        when g.guests=1 then jsonb_build_object('matrimonial',0,'individual',1)
        else jsonb_build_object('matrimonial',1,'individual',greatest(0,g.guests-2))
      end
    ) order by u.ord
  )
  from unnest(case when coalesce(cardinality(r.habitaciones_ids),0)>0 then r.habitaciones_ids else array[r.habitacion_id] end) with ordinality u(room_id,ord)
  join public.habitaciones h on h.id=u.room_id and h.property_id=r.property_id
  left join lateral (
    select elem
    from jsonb_array_elements(case when jsonb_typeof(r.habitaciones_detalle)='array' then r.habitaciones_detalle else '[]'::jsonb end) elem
    where nullif(elem->>'habitacion_id','')::bigint=h.id
    limit 1
  ) old on true
  cross join lateral (
    select least(
      greatest(1,coalesce(h.capacidad,1)),
      greatest(1,ceil(greatest(1,coalesce(r.cantidad_huespedes,1))::numeric/greatest(1,coalesce(cardinality(r.habitaciones_ids),1)))::int)
    ) guests
  ) g
),'[]'::jsonb);

alter table public.reservas enable trigger user;

create or replace function public.hl_create_reservation_atomic(p_reservation jsonb,p_payments jsonb default '[]'::jsonb)
returns public.reservas
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v public.reservas%rowtype;
  p jsonb;
  v_property uuid;
  v_user uuid;
begin
  if p_reservation is null or jsonb_typeof(p_reservation)<>'object' then raise exception using errcode='22023',message='Datos de reserva inválidos.'; end if;
  if p_payments is null then p_payments:='[]'::jsonb; end if;
  if jsonb_typeof(p_payments)<>'array' then raise exception using errcode='22023',message='Los pagos iniciales deben ser una lista.'; end if;
  v_property:=nullif(p_reservation->>'property_id','')::uuid;
  v_user:=nullif(p_reservation->>'user_id','')::uuid;
  if v_property is null then raise exception using errcode='23502',message='Falta la propiedad de la reserva.'; end if;

  insert into public.reservas(
    property_id,user_id,alojamiento_id,habitacion_id,habitaciones_ids,habitaciones_detalle,
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
    coalesce(p_reservation->'habitaciones_detalle','[]'::jsonb),
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
    if coalesce(nullif(p->>'monto','')::numeric,0)<=0 then raise exception using errcode='22023',message='Hay un pago inicial con monto inválido.'; end if;
    if nullif(trim(coalesce(p->>'metodo','')),'') is null then raise exception using errcode='22023',message='Hay un pago inicial sin medio de pago.'; end if;
    insert into public.pagos(property_id,user_id,reserva_id,monto,metodo,moneda,nota)
    values(v.property_id,coalesce(nullif(p->>'user_id','')::uuid,v_user),v.id,(p->>'monto')::numeric,trim(p->>'metodo'),coalesce(nullif(p->>'moneda',''),'ARS'),nullif(p->>'nota',''));
  end loop;
  return v;
end;
$function$;

create or replace function public.hl_public_booking_create(p_slug text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  e public.hotel_booking_engines%rowtype;
  h public.habitaciones%rowtype;
  r public.reservas%rowtype;
  v_in date; v_out date; v_guests integer; v_nights integer; v_total numeric; v_nightly numeric;
  v_name text; v_email text; v_phone text; v_type text; v_request text; v_existing bigint; v_channel_code text; v_manage uuid;
  v_rooming jsonb; v_matrimonial integer; v_individual integer;
begin
  select * into e from public.hotel_booking_engines where slug=lower(trim(p_slug)) and enabled=true;
  if not found then raise exception 'Motor no disponible'; end if;
  v_request:=coalesce(nullif(trim(coalesce(p_payload->>'request_id','')),''),gen_random_uuid()::text);
  perform pg_advisory_xact_lock(hashtextextended(e.id::text||':'||v_request,0));
  select reservation_id,manage_token into v_existing,v_manage from public.hotel_public_booking_requests where engine_id=e.id and request_key=v_request;
  if found then
    select * into r from public.reservas where id=v_existing;
    return jsonb_build_object(
      'id',r.id,'numero_reserva',r.numero_reserva,'status',r.estado,'property_id',r.property_id,
      'room_type',coalesce(r.habitaciones_detalle->0->>'categoria_vendida','Habitación'),
      'rooming',coalesce(r.habitaciones_detalle->0->'rooming',jsonb_build_object('matrimonial',0,'individual',0)),
      'check_in',r.fecha_entrada,'check_out',r.fecha_salida,'nights',r.noches,'total',r.precio_total,'currency',r.moneda,
      'manage_token',v_manage,'idempotent_replay',true
    );
  end if;

  v_in:=nullif(p_payload->>'check_in','')::date;
  v_out:=nullif(p_payload->>'check_out','')::date;
  v_guests:=greatest(1,coalesce(nullif(p_payload->>'guests','')::integer,1));
  v_name:=trim(coalesce(p_payload->>'name',''));
  v_email:=nullif(trim(coalesce(p_payload->>'email','')),'');
  v_phone:=nullif(trim(coalesce(p_payload->>'phone','')),'');
  v_type:=nullif(trim(coalesce(p_payload->>'room_type','')),'');
  v_matrimonial:=greatest(0,least(8,coalesce(nullif(p_payload->'rooming'->>'matrimonial','')::integer,0)));
  v_individual:=greatest(0,least(8,coalesce(nullif(p_payload->'rooming'->>'individual','')::integer,0)));
  v_rooming:=jsonb_build_object('matrimonial',v_matrimonial,'individual',v_individual);

  if v_name='' then raise exception 'Falta el nombre del huésped'; end if;
  if v_email is null then raise exception 'Falta el email del huésped'; end if;
  if v_type is null then raise exception 'Falta el tipo de habitación'; end if;
  if v_in is null or v_out is null then raise exception 'Faltan fechas'; end if;
  v_nights:=v_out-v_in;
  if v_nights<e.min_nights then raise exception 'Estadía mínima de % noche(s)',e.min_nights; end if;
  if v_in<current_date+e.min_advance_days or v_in>current_date+e.max_advance_days then raise exception 'Fecha de entrada no disponible'; end if;
  if coalesce((e.room_type_rules->v_type->>'enabled')::boolean,true)=false then raise exception 'Ese tipo de habitación no se vende online'; end if;

  select h0.* into h
  from public.habitaciones h0
  where h0.property_id=e.property_id and coalesce(h0.activa,true)=true and coalesce(h0.online_bookable,true)=true and h0.estado<>'mantenimiento'
    and coalesce(h0.descripcion,'') not like '[QA-PLANNING-LOAD-%'
    and coalesce(h0.capacidad,1)>=v_guests
    and lower(coalesce(nullif(trim(h0.tipo),''),'Habitación'))=lower(v_type)
    and not exists(select 1 from public.reservas x where x.property_id=e.property_id and coalesce(x.no_show,false)=false and coalesce(x.estado,'')<>'cancelada' and (x.habitacion_id=h0.id or h0.id=any(coalesce(x.habitaciones_ids,'{}'::bigint[]))) and x.fecha_entrada<v_out and x.fecha_salida>v_in)
    and not exists(select 1 from public.bloqueos b where b.property_id=e.property_id and b.habitacion_id=h0.id and b.fecha_desde<v_out and b.fecha_hasta>v_in)
    and not exists(select 1 from public.hotel_rate_calendar rc where rc.property_id=e.property_id and rc.habitacion_id=h0.id and rc.stay_date>=v_in and rc.stay_date<v_out and rc.stop_sell=true)
    and coalesce((select max(rc.min_stay) from public.hotel_rate_calendar rc where rc.property_id=e.property_id and rc.habitacion_id=h0.id and rc.stay_date>=v_in and rc.stay_date<v_out),1)<=v_nights
  order by (select sum(coalesce(rc.price,h0.precio,0)) from generate_series(v_in,v_out-1,interval '1 day') g(day) left join public.hotel_rate_calendar rc on rc.property_id=e.property_id and rc.habitacion_id=h0.id and rc.stay_date=g.day::date),h0.id
  limit 1 for update of h0;
  if not found then raise exception 'Ese tipo de habitación acaba de dejar de estar disponible'; end if;

  select sum(coalesce(rc.price,h.precio,0)) into v_total
  from generate_series(v_in,v_out-1,interval '1 day') g(day)
  left join public.hotel_rate_calendar rc on rc.property_id=e.property_id and rc.habitacion_id=h.id and rc.stay_date=g.day::date;
  v_nightly:=case when v_nights>0 then round(v_total/v_nights,2) else 0 end;
  v_channel_code:='motor:'||e.slug||':'||left(v_request,36);

  insert into public.reservas(
    property_id,habitacion_id,habitaciones_ids,habitaciones_detalle,nombre_huesped,email_huesped,telefono_huesped,
    fecha_entrada,fecha_salida,cantidad_huespedes,estado,tarifa_noche,noches,subtotal,precio_total,moneda,canal_reserva,codigo_canal,tipo_estadia,notas
  ) values (
    e.property_id,h.id,array[h.id],
    jsonb_build_array(jsonb_build_object(
      'habitacion_id',h.id,'nombre',h.nombre,
      'categoria_asignada',coalesce(nullif(trim(h.tipo),''),'Habitación'),
      'categoria_vendida',v_type,'huespedes',v_guests,'tarifa_noche',v_nightly,'rooming',v_rooming
    )),
    v_name,v_email,v_phone,v_in,v_out,v_guests,'confirmada',v_nightly,v_nights,v_total,v_total,e.currency,
    'Motor web',v_channel_code,'overnight','Reserva creada desde motor web'
  ) returning * into r;

  insert into public.hotel_public_booking_requests(engine_id,request_key,reservation_id)
  values(e.id,v_request,r.id) returning manage_token into v_manage;
  return jsonb_build_object(
    'id',r.id,'numero_reserva',r.numero_reserva,'status',r.estado,'property_id',r.property_id,
    'room_type',v_type,'rooming',v_rooming,'check_in',r.fecha_entrada,'check_out',r.fecha_salida,'nights',r.noches,
    'total',r.precio_total,'currency',r.moneda,'payment_mode',e.payment_mode,'deposit_percent',e.deposit_percent,
    'manage_token',v_manage,'idempotent_replay',false
  );
end;
$function$;

create or replace function public.hl_move_reservation_atomic(
  p_reserva_id bigint,p_habitacion_id bigint,p_fecha_entrada date,p_fecha_salida date default null::date
)
returns public.reservas
language plpgsql
set search_path to 'public'
as $function$
declare
  v_reserva public.reservas%rowtype; v_habitacion public.habitaciones%rowtype;
  v_salida date; v_span integer; v_nights integer; v_units integer;
  v_subtotal numeric; v_descuento numeric; v_total numeric;
  v_ops jsonb:='{}'::jsonb; v_arrival time; v_departure time; v_cutoff time; v_business_date date;
  v_start timestamp; v_end timestamp;
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
  v_start:=p_fecha_entrada::timestamp+v_arrival; v_end:=v_salida::timestamp+v_departure;
  if v_end<=v_start then raise exception 'La hora de salida debe ser posterior a la hora de entrada'; end if;
  if coalesce(v_reserva.tipo_estadia,'overnight')='day_use' and v_salida<>p_fecha_entrada then raise exception 'Day Use debe comenzar y terminar el mismo día'; end if;
  v_business_date:=case when coalesce(v_reserva.tipo_estadia,'overnight')='overnight' and v_arrival<v_cutoff then p_fecha_entrada-1 else p_fecha_entrada end;
  v_nights:=case when coalesce(v_reserva.tipo_estadia,'overnight')='day_use' then 0 else greatest(1,v_salida-v_business_date) end;
  v_units:=case when coalesce(v_reserva.tipo_estadia,'overnight')='day_use' then 1 else v_nights end;

  if exists(select 1 from public.bloqueos b where b.habitacion_id=p_habitacion_id and b.property_id=v_reserva.property_id and tsrange(b.fecha_desde::timestamp,b.fecha_hasta::timestamp,'[)') && tsrange(v_start,v_end,'[)')) then raise exception 'La habitación está bloqueada durante ese horario' using errcode='23P01'; end if;
  if exists(select 1 from public.reservas r where r.id<>v_reserva.id and r.property_id=v_reserva.property_id and r.estado<>'cancelada' and coalesce(r.no_show,false)=false and (r.habitacion_id=p_habitacion_id or p_habitacion_id=any(coalesce(r.habitaciones_ids,array[]::bigint[]))) and tsrange(coalesce(r.ocupacion_desde_local,r.fecha_entrada::timestamp+private.hl_safe_time(r.hora_llegada_estimada,'14:00'::time)),coalesce(r.ocupacion_hasta_local,r.fecha_salida::timestamp+private.hl_safe_time(r.hora_salida_estimada,'10:00'::time)),'[)') && tsrange(v_start,v_end,'[)')) then raise exception 'La habitación ya tiene una reserva durante parte de ese horario' using errcode='23P01'; end if;

  v_subtotal:=greatest(0,coalesce(v_reserva.tarifa_noche,0)*v_units+coalesce(v_reserva.cochera_total,0)+coalesce(v_reserva.extra,0)+coalesce(v_reserva.early_checkin_importe,0)+coalesce(v_reserva.late_checkout_importe,0));
  v_descuento:=case when v_reserva.descuento_tipo='porcentaje' then v_subtotal*coalesce(v_reserva.descuento_valor,0)/100 else coalesce(v_reserva.descuento_importe,v_reserva.descuento_valor,0) end;
  v_total:=greatest(0,v_subtotal-v_descuento);

  update public.reservas
  set habitacion_id=p_habitacion_id,
      alojamiento_id=coalesce(v_habitacion.alojamiento_id,alojamiento_id),
      fecha_entrada=p_fecha_entrada,fecha_salida=v_salida,noches=v_nights,
      subtotal=v_subtotal,descuento_importe=v_descuento,precio_total=v_total,
      precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end,
      habitaciones_ids=case when habitaciones_ids is null or cardinality(habitaciones_ids)=0 then array[p_habitacion_id] when v_reserva.habitacion_id=any(habitaciones_ids) then array_replace(habitaciones_ids,v_reserva.habitacion_id,p_habitacion_id) else habitaciones_ids end,
      habitaciones_detalle=case when jsonb_typeof(habitaciones_detalle)='array' then (
        select coalesce(jsonb_agg(
          case when nullif(elem->>'habitacion_id','')::bigint=v_reserva.habitacion_id
            then elem || jsonb_build_object(
              'habitacion_id',p_habitacion_id,'nombre',v_habitacion.nombre,
              'categoria_asignada',coalesce(nullif(trim(v_habitacion.tipo),''),'Habitación'),
              'noches',v_nights
            )
            else elem end
        ),'[]'::jsonb) from jsonb_array_elements(habitaciones_detalle) elem
      ) else habitaciones_detalle end
  where id=v_reserva.id returning * into v_reserva;
  return v_reserva;
end;
$function$;

comment on column public.reservas.habitaciones_detalle is
'Fuente única de asignación por habitación: habitación física, categoría asignada, categoría vendida, huéspedes, tarifa y rooming {matrimonial,individual}.';

alter table public.reservas drop column if exists tipo_cama;
