create schema if not exists guest_portal_private;
revoke all on schema guest_portal_private from public;
grant usage on schema guest_portal_private to authenticated, anon;

create table if not exists public.hotel_guest_stay_portals(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  token_hash text not null unique,
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  revoked_at timestamptz,
  created_by uuid,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,reservation_id)
);
alter table public.hotel_guest_stay_portals enable row level security;
revoke all on public.hotel_guest_stay_portals from anon,authenticated;

create table if not exists public.hotel_guest_stay_portal_requests(
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.hotel_guest_stay_portals(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  room_id bigint,
  guest_request_id uuid not null references public.hotel_guest_requests(id) on delete cascade,
  kind text not null check(kind in ('towels','pillows','cleaning','maintenance','late_checkout','other')),
  created_at timestamptz not null default now(),
  unique(guest_request_id)
);
alter table public.hotel_guest_stay_portal_requests enable row level security;
revoke all on public.hotel_guest_stay_portal_requests from anon,authenticated;

create or replace function guest_portal_private.hl_guest_stay_portal_issue_internal(p_reservation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path='public','private','guest_portal_private','pg_temp'
as $$
declare
  v_user uuid:=auth.uid();
  v_res public.reservas%rowtype;
  v_portal public.hotel_guest_stay_portals%rowtype;
  v_token text;
  v_valid_until timestamptz;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_res from public.reservas where id=p_reservation_id and merged_into_id is null;
  if not found then raise exception 'Reserva inexistente.' using errcode='P0002'; end if;
  if not private.user_has_property_access(v_res.property_id) then raise exception 'No tenés acceso a esta propiedad.' using errcode='42501'; end if;
  if lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then
    raise exception 'La estadía ya no admite un portal activo.';
  end if;
  v_token:=encode(gen_random_bytes(24),'hex');
  v_valid_until:=((v_res.fecha_salida + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires');
  insert into public.hotel_guest_stay_portals(property_id,reservation_id,token_hash,valid_from,valid_until,revoked_at,created_by,last_opened_at,updated_at)
  values(v_res.property_id,v_res.id,encode(digest(v_token,'sha256'),'hex'),now(),v_valid_until,null,v_user,null,now())
  on conflict(property_id,reservation_id) do update set
    token_hash=excluded.token_hash,valid_from=excluded.valid_from,valid_until=excluded.valid_until,revoked_at=null,created_by=excluded.created_by,last_opened_at=null,updated_at=now()
  returning * into v_portal;
  return jsonb_build_object('ok',true,'token',v_token,'path','/stay/'||v_token,'valid_until',v_portal.valid_until,'reservation_id',v_res.id,'property_id',v_res.property_id);
end;
$$;

create or replace function guest_portal_private.hl_guest_stay_portal_snapshot_internal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path='public','private','guest_portal_private','pg_temp'
as $$
declare
  v_portal public.hotel_guest_stay_portals%rowtype;
  v_res public.reservas%rowtype;
  v_room public.habitaciones%rowtype;
  v_settings public.hotel_os_settings%rowtype;
  v_guide public.hotel_guest_guides%rowtype;
  v_paid numeric:=0;
  v_requests jsonb:='[]'::jsonb;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or now()<v_portal.valid_from or now()>=v_portal.valid_until or lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then
    return jsonb_build_object('ok',false,'error','access_expired');
  end if;
  select * into v_room from public.habitaciones where id=v_res.habitacion_id and property_id=v_res.property_id;
  select * into v_settings from public.hotel_os_settings where property_id=v_res.property_id;
  select * into v_guide from public.hotel_guest_guides where property_id=v_res.property_id and enabled=true order by updated_at desc nulls last limit 1;
  select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0) into v_paid from public.pagos p where p.property_id=v_res.property_id and p.reserva_id=v_res.id and lower(coalesce(p.estado,'')) not in ('anulado','cancelado','void');
  select coalesce(jsonb_agg(jsonb_build_object('id',gr.id,'kind',l.kind,'title',gr.title,'status',gr.status,'area',gr.assigned_area,'created_at',gr.created_at,'resolved_at',gr.resolved_at) order by gr.created_at desc),'[]'::jsonb) into v_requests
  from public.hotel_guest_stay_portal_requests l join public.hotel_guest_requests gr on gr.id=l.guest_request_id and gr.property_id=l.property_id where l.portal_id=v_portal.id;
  update public.hotel_guest_stay_portals set last_opened_at=now(),updated_at=now() where id=v_portal.id;
  return jsonb_build_object(
    'ok',true,
    'hotel',jsonb_build_object('name',coalesce(v_settings.hotel_name,(select name from public.properties where id=v_res.property_id),'Habitación Llena'),'city',coalesce(v_settings.city,(select city from public.properties where id=v_res.property_id)),'motto',v_settings.motto,'welcome',coalesce(v_guide.welcome_message,v_settings.welcome_message),'logo',v_settings.logo_data_url),
    'guest',jsonb_build_object('name',v_res.nombre_huesped),
    'stay',jsonb_build_object('number',v_res.numero_reserva,'arrival',v_res.fecha_entrada,'departure',v_res.fecha_salida,'status',v_res.estado,'room',jsonb_build_object('name',v_room.nombre,'type',v_room.tipo),'late_checkout_confirmed',coalesce(v_res.late_checkout,false),'departure_time',v_res.hora_salida_estimada),
    'guide',jsonb_build_object('title',v_guide.title,'subtitle',v_guide.subtitle,'wifi_name',v_guide.wifi_name,'wifi_password',v_guide.wifi_password,'contact_phone',v_guide.contact_phone,'contact_whatsapp',v_guide.contact_whatsapp,'checkin_time',coalesce(v_guide.checkin_time,v_settings.operational_settings->>'checkin_time'),'checkout_time',coalesce(v_guide.checkout_time,v_settings.operational_settings->>'checkout_time'),'sections',coalesce(v_guide.sections,'[]'::jsonb),'house_rules',coalesce(v_guide.house_rules,'[]'::jsonb),'useful_links',coalesce(v_guide.useful_links,'[]'::jsonb)),
    'account',jsonb_build_object('currency',coalesce(v_res.moneda,v_settings.operational_settings->>'currency','ARS'),'total',coalesce(v_res.precio_total,0),'paid',v_paid,'balance',greatest(0,coalesce(v_res.precio_total,0)-v_paid)),
    'booked_services',coalesce(v_res.servicios,'[]'::jsonb),
    'requests',v_requests,
    'portal',jsonb_build_object('valid_until',v_portal.valid_until)
  );
end;
$$;

create or replace function guest_portal_private.hl_guest_stay_portal_request_internal(p_token text,p_kind text,p_detail text default null)
returns jsonb
language plpgsql
security definer
set search_path='public','private','guest_portal_private','pg_temp'
as $$
declare
  v_portal public.hotel_guest_stay_portals%rowtype;
  v_res public.reservas%rowtype;
  v_kind text:=lower(trim(coalesce(p_kind,'')));
  v_detail text:=nullif(trim(coalesce(p_detail,'')),'');
  v_title text;
  v_area text;
  v_priority text:='normal';
  v_request public.hotel_guest_requests%rowtype;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  if v_kind not in ('towels','pillows','cleaning','maintenance','late_checkout','other') then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
  if v_detail is not null and length(v_detail)>1000 then return jsonb_build_object('ok',false,'error','detail_too_long'); end if;
  if v_kind='maintenance' and v_detail is null then return jsonb_build_object('ok',false,'error','detail_required'); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or now()<v_portal.valid_from or now()>=v_portal.valid_until or lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false,'error','access_expired'); end if;

  select gr.* into v_request from public.hotel_guest_stay_portal_requests l join public.hotel_guest_requests gr on gr.id=l.guest_request_id where l.portal_id=v_portal.id and l.kind=v_kind and gr.status in ('open','in_progress') order by gr.created_at desc limit 1;
  if found then return jsonb_build_object('ok',true,'already_open',true,'request',jsonb_build_object('id',v_request.id,'title',v_request.title,'status',v_request.status,'area',v_request.assigned_area)); end if;

  if v_kind='towels' then v_title:='Solicita toallas';v_area:='housekeeping';
  elsif v_kind='pillows' then v_title:='Solicita almohadas';v_area:='housekeeping';
  elsif v_kind='cleaning' then v_title:='Solicita limpieza de habitación';v_area:='housekeeping';
  elsif v_kind='maintenance' then v_title:='Reporta un problema en la habitación';v_area:='maintenance';v_priority:=case when lower(coalesce(v_detail,'')) ~ '(gas|humo|chispa|inund)' then 'urgent' when lower(coalesce(v_detail,'')) ~ '(roto|rota|no funciona|no anda|fuga|pierde)' then 'high' else 'normal' end;
  elsif v_kind='late_checkout' then v_title:='Solicitud de late check-out';v_area:='reception';
  else v_title:='Solicitud del huésped';v_area:='reception'; end if;

  insert into public.hotel_guest_requests(property_id,reservation_id,room_id,title,detail,status,priority,requested_by,department,assigned_area,created_by)
  values(v_res.property_id,v_res.id,v_res.habitacion_id,v_title,v_detail,'open',v_priority,'guest',v_area,v_area,null)
  returning * into v_request;
  insert into public.hotel_guest_stay_portal_requests(portal_id,property_id,reservation_id,room_id,guest_request_id,kind)
  values(v_portal.id,v_res.property_id,v_res.id,v_res.habitacion_id,v_request.id,v_kind);
  return jsonb_build_object('ok',true,'request',jsonb_build_object('id',v_request.id,'title',v_request.title,'status',v_request.status,'area',v_request.assigned_area,'priority',v_request.priority,'created_at',v_request.created_at));
end;
$$;

revoke all on function guest_portal_private.hl_guest_stay_portal_issue_internal(bigint) from public;
revoke all on function guest_portal_private.hl_guest_stay_portal_snapshot_internal(text) from public;
revoke all on function guest_portal_private.hl_guest_stay_portal_request_internal(text,text,text) from public;
grant execute on function guest_portal_private.hl_guest_stay_portal_issue_internal(bigint) to authenticated;
grant execute on function guest_portal_private.hl_guest_stay_portal_snapshot_internal(text) to anon,authenticated;
grant execute on function guest_portal_private.hl_guest_stay_portal_request_internal(text,text,text) to anon,authenticated;

create or replace function public.hl_guest_stay_portal_issue(p_reservation_id bigint)
returns jsonb language sql security invoker set search_path='public','guest_portal_private' as $$select guest_portal_private.hl_guest_stay_portal_issue_internal(p_reservation_id);$$;
create or replace function public.hl_guest_stay_portal_snapshot(p_token text)
returns jsonb language sql security invoker set search_path='public','guest_portal_private' as $$select guest_portal_private.hl_guest_stay_portal_snapshot_internal(p_token);$$;
create or replace function public.hl_guest_stay_portal_request(p_token text,p_kind text,p_detail text default null)
returns jsonb language sql security invoker set search_path='public','guest_portal_private' as $$select guest_portal_private.hl_guest_stay_portal_request_internal(p_token,p_kind,p_detail);$$;

revoke all on function public.hl_guest_stay_portal_issue(bigint) from public,anon;
revoke all on function public.hl_guest_stay_portal_snapshot(text) from public;
revoke all on function public.hl_guest_stay_portal_request(text,text,text) from public;
grant execute on function public.hl_guest_stay_portal_issue(bigint) to authenticated;
grant execute on function public.hl_guest_stay_portal_snapshot(text) to anon,authenticated;
grant execute on function public.hl_guest_stay_portal_request(text,text,text) to anon,authenticated;
