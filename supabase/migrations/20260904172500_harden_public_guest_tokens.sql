-- Habitación Llena — hardening de links públicos/bearer tokens
-- Probar en Supabase preview/staging antes de producción.

begin;

create or replace function public.hl_access_guest_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  g public.hotel_access_grants%rowtype;
  r public.reservas%rowtype;
  h public.habitaciones%rowtype;
  s public.hotel_os_settings%rowtype;
  v_ready jsonb;
  v_points jsonb;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then
    return jsonb_build_object('ok',false,'error','invalid_token');
  end if;

  select * into g
  from public.hotel_access_grants
  where guest_token_hash=digest(p_token,'sha256')
  order by guest_token_created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','invalid_token');
  end if;

  select * into r
  from public.reservas
  where id=g.reservation_id and property_id=g.property_id;

  if not found
     or g.status='revoked'
     or lower(coalesce(r.estado,'')) in ('cancelada','finalizada')
     or coalesce(r.no_show,false)
     or now()>=g.valid_until then
    return jsonb_build_object('ok',false,'error','access_expired');
  end if;

  if now()<g.valid_from then
    return jsonb_build_object('ok',false,'error','access_not_yet_valid');
  end if;

  select * into h
  from public.habitaciones
  where id=r.habitacion_id and property_id=r.property_id;

  select * into s
  from public.hotel_os_settings
  where property_id=r.property_id;

  v_ready:=private.hl_access_readiness_json(r.id);

  select coalesce(jsonb_agg(x.obj order by x.seq,x.name),'[]'::jsonb)
  into v_points
  from (
    select 0 seq,p.name,
      jsonb_build_object(
        'id',p.id,'name',p.name,'kind',p.kind,'zone',p.zone,
        'provider',p.provider,'connection_status',p.connection_status,
        'remote_open_enabled',p.remote_open_enabled,'primary',true
      ) obj
    from public.hotel_access_points p
    where p.id=g.primary_point_id
      and p.property_id=r.property_id
      and p.active

    union all

    select l.sequence+1,p.name,
      jsonb_build_object(
        'id',p.id,'name',p.name,'kind',p.kind,'zone',p.zone,
        'provider',p.provider,'connection_status',p.connection_status,
        'remote_open_enabled',p.remote_open_enabled,'primary',false
      )
    from public.hotel_access_links l
    join public.hotel_access_points p
      on p.id=l.inherited_point_id
     and p.property_id=r.property_id
     and p.active
    where l.property_id=r.property_id
      and l.source_point_id=g.primary_point_id
      and l.active
      and (
        p.linked_service_kind is null
        or exists (
          select 1
          from jsonb_array_elements(coalesce(r.servicios,'[]'::jsonb)) svc
          where lower(coalesce(svc->>'kind',''))=lower(p.linked_service_kind)
             or lower(coalesce(svc->>'resource_category',''))=lower(p.linked_service_kind)
        )
      )
  ) x;

  return jsonb_build_object(
    'ok',true,
    'hotel',jsonb_build_object('name',coalesce(s.hotel_name,'Habitación Llena'),'logo',s.logo_data_url,'welcome',s.welcome_message),
    'guest',jsonb_build_object('name',r.nombre_huesped),
    'reservation',jsonb_build_object('id',r.id,'number',r.numero_reserva,'arrival',r.fecha_entrada,'departure',r.fecha_salida,'status',r.estado),
    'room',jsonb_build_object('id',h.id,'name',h.nombre,'type',h.tipo),
    'ready',v_ready,
    'pin_code',case when (v_ready->>'ready')::boolean and now()>=g.valid_from and now()<g.valid_until then g.pin_code else null end,
    'grant',jsonb_build_object('status',case when (v_ready->>'ready')::boolean then 'active' else 'prepared' end,'valid_from',g.valid_from,'valid_until',g.valid_until),
    'access_points',v_points
  );
end
$function$;

create or replace function public.hl_get_web_checkin(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  w public.hotel_web_checkins%rowtype;
  r public.reservas%rowtype;
  room_name text;
  cfg jsonb;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then
    return jsonb_build_object('ok',false,'error','Enlace inválido.');
  end if;

  select * into w
  from public.hotel_web_checkins
  where token_hash=encode(digest(p_token,'sha256'),'hex')
  order by created_at desc
  limit 1;

  if w.id is null or w.status in ('cancelled','expired') or w.expires_at<now() then
    if w.id is not null and w.status not in ('cancelled','expired','completed') then
      update public.hotel_web_checkins set status='expired' where id=w.id;
    end if;
    return jsonb_build_object('ok',false,'error','Este enlace venció o ya no está disponible.');
  end if;

  select * into r
  from public.reservas
  where id=w.reservation_id and property_id=w.property_id;

  if r.id is null
     or lower(coalesce(r.estado,'')) in ('cancelada','finalizada')
     or coalesce(r.no_show,false) then
    update public.hotel_web_checkins
      set status='cancelled'
      where id=w.id and status not in ('cancelled','expired','completed');
    return jsonb_build_object('ok',false,'error','La reserva ya no está disponible.');
  end if;

  select nombre into room_name
  from public.habitaciones
  where id=r.habitacion_id and property_id=w.property_id;

  select jsonb_build_object(
    'hotel_name',coalesce(hotel_name,'Habitación Llena'),
    'city',city,'motto',motto,'logo_data_url',logo_data_url,
    'theme',theme,'operational_settings',operational_settings
  ) into cfg
  from public.hotel_os_settings
  where property_id=w.property_id;

  if w.status='pending' then
    update public.hotel_web_checkins
      set status='opened',opened_at=coalesce(opened_at,now())
      where id=w.id;
    update public.reservas
      set web_checkin_status='opened'
      where id=r.id and property_id=w.property_id;
  end if;

  return jsonb_build_object(
    'ok',true,
    'status',case when w.status='pending' then 'opened' else w.status end,
    'hotel',coalesce(cfg,'{}'::jsonb),
    'reservation',jsonb_build_object(
      'id',r.id,'guest_name',r.nombre_huesped,'email',r.email_huesped,
      'phone',r.telefono_huesped,'document',r.dni_huesped,
      'address',r.direccion_huesped,'province',r.provincia_estado_huesped,
      'country',r.pais_huesped,'arrival',r.fecha_entrada,'departure',r.fecha_salida,
      'arrival_time',r.hora_llegada_estimada,'room',room_name,
      'companions',coalesce(r.pasajeros,'[]'::jsonb),'vehicles',coalesce(r.vehiculos,0),
      'vehicle_type',r.tipo_vehiculo,'vehicle_plate',r.dominio_vehiculo,
      'pets',coalesce(r.mascotas,'[]'::jsonb)
    )
  );
end
$function$;

create or replace function public.hl_submit_web_checkin(
  p_token text,
  p_payload jsonb,
  p_signature_name text default null,
  p_signature_data text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  w public.hotel_web_checkins%rowtype;
  v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  v_reservation_valid boolean:=false;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then
    return jsonb_build_object('ok',false,'error','Enlace inválido.');
  end if;
  if pg_column_size(v_payload)>65536 then
    return jsonb_build_object('ok',false,'error','Los datos enviados son demasiado grandes.');
  end if;
  if p_signature_data is null or octet_length(p_signature_data)>400000 then
    return jsonb_build_object('ok',false,'error','La firma no es válida.');
  end if;
  if p_signature_name is not null and length(p_signature_name)>160 then
    return jsonb_build_object('ok',false,'error','Nombre de firma inválido.');
  end if;

  select * into w
  from public.hotel_web_checkins
  where token_hash=encode(digest(p_token,'sha256'),'hex')
  order by created_at desc
  limit 1
  for update;

  if w.id is null or w.status in ('cancelled','expired') or w.expires_at<now() then
    return jsonb_build_object('ok',false,'error','Este enlace venció o ya no está disponible.');
  end if;
  if w.status='completed' then
    return jsonb_build_object('ok',true,'already_completed',true);
  end if;

  select exists(
    select 1
    from public.reservas r
    where r.id=w.reservation_id
      and r.property_id=w.property_id
      and lower(coalesce(r.estado,'')) not in ('cancelada','finalizada')
      and not coalesce(r.no_show,false)
  ) into v_reservation_valid;

  if not v_reservation_valid then
    update public.hotel_web_checkins set status='cancelled' where id=w.id;
    return jsonb_build_object('ok',false,'error','La reserva ya no está disponible.');
  end if;

  update public.hotel_web_checkins
  set status='completed',completed_at=now(),consent_at=now(),payload=v_payload,
      signature_name=nullif(trim(p_signature_name),''),signature_data=p_signature_data
  where id=w.id;

  update public.reservas set
    telefono_huesped=coalesce(nullif(left(v_payload->>'phone',80),''),telefono_huesped),
    dni_huesped=coalesce(nullif(left(v_payload->>'document',80),''),dni_huesped),
    direccion_huesped=coalesce(nullif(left(v_payload->>'address',240),''),direccion_huesped),
    provincia_estado_huesped=coalesce(nullif(left(v_payload->>'province',120),''),provincia_estado_huesped),
    pais_huesped=coalesce(nullif(left(v_payload->>'country',120),''),pais_huesped),
    hora_llegada_estimada=coalesce(nullif(left(v_payload->>'arrival_time',10),''),hora_llegada_estimada),
    pasajeros=case when jsonb_typeof(v_payload->'companions')='array' and jsonb_array_length(v_payload->'companions')<=20 then v_payload->'companions' else pasajeros end,
    vehiculos=case when (v_payload->>'vehicles') ~ '^\d{1,2}$' then least((v_payload->>'vehicles')::integer,20) else vehiculos end,
    tipo_vehiculo=coalesce(nullif(left(v_payload->>'vehicle_type',80),''),tipo_vehiculo),
    dominio_vehiculo=coalesce(nullif(upper(left(v_payload->>'vehicle_plate',24)),''),dominio_vehiculo),
    mascotas=case when jsonb_typeof(v_payload->'pets')='array' and jsonb_array_length(v_payload->'pets')<=20 then v_payload->'pets' else mascotas end,
    web_checkin_status='completed'
  where id=w.reservation_id and property_id=w.property_id;

  return jsonb_build_object('ok',true,'completed_at',now());
end
$function$;

commit;
