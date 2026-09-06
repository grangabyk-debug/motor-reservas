create table if not exists public.hotel_cancellation_policies (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  policy_type text not null default 'flexible' check (policy_type in ('flexible','prepaid_flexible','non_refundable','custom')),
  language text not null default 'es-AR',
  currency text not null default 'ARS',
  cancellation_rules jsonb not null default '[]'::jsonb,
  no_show_rule jsonb not null default '{"charge_type":"none","value":0}'::jsonb,
  early_checkout_rule jsonb not null default '{"charge_type":"none","value":0}'::jsonb,
  prepayment_required boolean not null default false,
  prepayment_percent numeric(7,2) not null default 0 check (prepayment_percent between 0 and 100),
  active boolean not null default true,
  is_default boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,code)
);
create unique index if not exists hotel_cancellation_policies_one_default_idx on public.hotel_cancellation_policies(property_id) where is_default=true;
create index if not exists hotel_cancellation_policies_property_active_idx on public.hotel_cancellation_policies(property_id,active,name);
alter table public.hotel_cancellation_policies enable row level security;
revoke all on public.hotel_cancellation_policies from anon;
grant select,insert,update,delete on public.hotel_cancellation_policies to authenticated;
drop policy if exists hotel_cancellation_policies_select_access on public.hotel_cancellation_policies;
create policy hotel_cancellation_policies_select_access on public.hotel_cancellation_policies for select to authenticated using (private.user_has_property_access(property_id));
drop policy if exists hotel_cancellation_policies_insert_owner on public.hotel_cancellation_policies;
create policy hotel_cancellation_policies_insert_owner on public.hotel_cancellation_policies for insert to authenticated with check (private.user_has_property_role(property_id,array['owner']::text[]));
drop policy if exists hotel_cancellation_policies_update_owner on public.hotel_cancellation_policies;
create policy hotel_cancellation_policies_update_owner on public.hotel_cancellation_policies for update to authenticated using (private.user_has_property_role(property_id,array['owner']::text[])) with check (private.user_has_property_role(property_id,array['owner']::text[]));
drop policy if exists hotel_cancellation_policies_delete_owner on public.hotel_cancellation_policies;
create policy hotel_cancellation_policies_delete_owner on public.hotel_cancellation_policies for delete to authenticated using (private.user_has_property_role(property_id,array['owner']::text[]));

create or replace function public.hl_seed_cancellation_policies(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  insert into public.hotel_cancellation_policies(property_id,code,name,description,policy_type,language,currency,cancellation_rules,no_show_rule,early_checkout_rule,prepayment_required,prepayment_percent,is_default)
  values
    (p_property_id,'FLEX','Flexible','Cancelación sin cargo hasta 3 días antes del check-in. Luego se cobra 1 noche.','flexible','es-AR','ARS',
      '[{"min_days_before":3,"charge_type":"none","value":0},{"min_days_before":0,"charge_type":"nights","value":1}]'::jsonb,
      '{"charge_type":"nights","value":1}'::jsonb,'{"charge_type":"nights","value":1}'::jsonb,false,0,true),
    (p_property_id,'PREP-FLEX','Prepaga Flexible','Requiere una seña del 50%. Permite cancelar sin cargo hasta 7 días antes; luego aplica una penalidad del 50% del total.','prepaid_flexible','es-AR','ARS',
      '[{"min_days_before":7,"charge_type":"none","value":0},{"min_days_before":0,"charge_type":"percent","value":50}]'::jsonb,
      '{"charge_type":"percent","value":100}'::jsonb,'{"charge_type":"nights","value":1}'::jsonb,true,50,false),
    (p_property_id,'NR','No Reembolsable / Anticipada','Tarifa anticipada no reembolsable. La cancelación y el No Show implican una penalidad del 100% del total de la reserva.','non_refundable','es-AR','ARS',
      '[{"min_days_before":0,"charge_type":"percent","value":100}]'::jsonb,
      '{"charge_type":"percent","value":100}'::jsonb,'{"charge_type":"percent","value":100}'::jsonb,true,100,false)
  on conflict(property_id,code) do nothing;
end;
$function$;

select public.hl_seed_cancellation_policies(id) from public.properties;

create or replace function public.hl_seed_cancellation_policies_on_property()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $function$
begin perform public.hl_seed_cancellation_policies(new.id); return new; end;$function$;
drop trigger if exists hotel_seed_cancellation_policies_after_property on public.properties;
create trigger hotel_seed_cancellation_policies_after_property after insert on public.properties for each row execute function public.hl_seed_cancellation_policies_on_property();

alter table public.reservas add column if not exists cancellation_policy_id uuid references public.hotel_cancellation_policies(id) on delete set null;
alter table public.reservas add column if not exists cancellation_policy_snapshot jsonb not null default '{}'::jsonb;
create index if not exists reservas_cancellation_policy_idx on public.reservas(property_id,cancellation_policy_id);

create table if not exists public.hotel_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint references public.reservas(id) on delete set null,
  request_code text not null unique,
  consumer_name text not null,
  consumer_email text not null,
  reservation_code text,
  detail text,
  status text not null default 'received' check (status in ('received','in_review','accepted','rejected','closed')),
  source text not null default 'booking_engine',
  processed_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hotel_withdrawal_requests_property_created_idx on public.hotel_withdrawal_requests(property_id,created_at desc);
alter table public.hotel_withdrawal_requests enable row level security;
revoke all on public.hotel_withdrawal_requests from anon;
grant select,update on public.hotel_withdrawal_requests to authenticated;
drop policy if exists hotel_withdrawal_requests_select_access on public.hotel_withdrawal_requests;
create policy hotel_withdrawal_requests_select_access on public.hotel_withdrawal_requests for select to authenticated using (private.user_has_property_access(property_id));
drop policy if exists hotel_withdrawal_requests_update_staff on public.hotel_withdrawal_requests;
create policy hotel_withdrawal_requests_update_staff on public.hotel_withdrawal_requests for update to authenticated using (private.user_has_property_role(property_id,array['owner','admin','manager','reception']::text[])) with check (private.user_has_property_role(property_id,array['owner','admin','manager','reception']::text[]));

create or replace function public.hl_public_booking_regret(p_slug text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare e public.hotel_booking_engines%rowtype; v_name text; v_email text; v_code text; v_detail text; v_res bigint; v_request_code text;
begin
  select * into e from public.hotel_booking_engines where slug=lower(trim(p_slug)) and enabled=true;
  if not found then raise exception 'Motor no disponible'; end if;
  v_name:=left(trim(coalesce(p_payload->>'name','')),160); v_email:=left(lower(trim(coalesce(p_payload->>'email',''))),180); v_code:=left(trim(coalesce(p_payload->>'reservation_code','')),120); v_detail:=left(trim(coalesce(p_payload->>'detail','')),1200);
  if v_name='' or v_email='' then raise exception 'Completá nombre y email'; end if;
  if position('@' in v_email)<2 then raise exception 'Email inválido'; end if;
  if v_code<>'' then select r.id into v_res from public.reservas r where r.property_id=e.property_id and lower(coalesce(r.numero_reserva,r.id::text))=lower(v_code) and lower(coalesce(r.email_huesped,''))=v_email order by r.created_at desc limit 1; end if;
  v_request_code:='ARR-'||to_char(clock_timestamp(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.hotel_withdrawal_requests(property_id,reservation_id,request_code,consumer_name,consumer_email,reservation_code,detail)
  values(e.property_id,v_res,v_request_code,v_name,v_email,nullif(v_code,''),nullif(v_detail,''));
  if v_res is not null then
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_name)
    values(e.property_id,v_res,'withdrawal_requested','Solicitud de arrepentimiento','El huésped envió una solicitud desde el motor web.',jsonb_build_object('request_code',v_request_code,'source','booking_engine'),'Huésped');
  end if;
  return jsonb_build_object('request_code',v_request_code,'reservation_matched',v_res is not null,'received_at',now());
end;$function$;
revoke all on function public.hl_public_booking_regret(text,jsonb) from public;
grant execute on function public.hl_public_booking_regret(text,jsonb) to anon,authenticated;

create or replace function public.hl_public_booking_config(p_slug text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare e public.hotel_booking_engines%rowtype; p public.properties%rowtype; v_default jsonb; v_policies jsonb;
begin
  select * into e from public.hotel_booking_engines where slug=lower(trim(p_slug)) and enabled=true;
  if not found then raise exception 'Motor no disponible'; end if;
  select * into p from public.properties where id=e.property_id;
  select to_jsonb(cp) into v_default from public.hotel_cancellation_policies cp where cp.property_id=e.property_id and cp.active=true order by cp.is_default desc,cp.created_at asc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',cp.id,'code',cp.code,'name',cp.name,'description',cp.description,'policy_type',cp.policy_type,'cancellation_rules',cp.cancellation_rules,'no_show_rule',cp.no_show_rule,'early_checkout_rule',cp.early_checkout_rule,'prepayment_required',cp.prepayment_required,'prepayment_percent',cp.prepayment_percent,'is_default',cp.is_default) order by cp.is_default desc,cp.name),'[]'::jsonb) into v_policies from public.hotel_cancellation_policies cp where cp.property_id=e.property_id and cp.active=true;
  return jsonb_build_object(
    'slug',e.slug,'property_id',e.property_id,'name',coalesce(nullif(e.display_name,''),p.name),'city',p.city,'description',p.description,
    'currency',e.currency,'primary_color',e.primary_color,'accent_color',e.accent_color,'logo_url',e.logo_url,'hero_url',e.hero_url,
    'booking_message',e.booking_message,'confirmation_message',e.confirmation_message,'contact_phone',e.contact_phone,'contact_email',e.contact_email,
    'min_advance_days',e.min_advance_days,'max_advance_days',e.max_advance_days,'min_nights',e.min_nights,'template',e.template,
    'cancellation_policy',coalesce(v_default->>'description',e.cancellation_policy),'default_cancellation_policy',v_default,'cancellation_policies',v_policies,
    'terms_url',e.terms_url,'privacy_url',e.privacy_url,'payment_mode',e.payment_mode,'deposit_percent',e.deposit_percent,
    'room_type_rules',e.room_type_rules,'gallery',e.gallery,'seo_title',e.seo_title,'seo_description',e.seo_description,
    'allow_self_cancel',e.allow_self_cancel,'self_cancel_cutoff_hours',e.self_cancel_cutoff_hours,'withdrawal_button_enabled',true
  );
end;$function$;

create or replace function public.hl_public_booking_create(p_slug text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare
  e public.hotel_booking_engines%rowtype; h public.habitaciones%rowtype; r public.reservas%rowtype; cp public.hotel_cancellation_policies%rowtype;
  v_in date; v_out date; v_guests integer; v_nights integer; v_total numeric; v_nightly numeric;
  v_name text; v_email text; v_phone text; v_type text; v_request text; v_existing bigint; v_channel_code text; v_manage uuid;
  v_rooming jsonb; v_matrimonial integer; v_individual integer; v_policy_snapshot jsonb;
begin
  select * into e from public.hotel_booking_engines where slug=lower(trim(p_slug)) and enabled=true; if not found then raise exception 'Motor no disponible'; end if;
  select * into cp from public.hotel_cancellation_policies where property_id=e.property_id and active=true order by is_default desc,created_at asc limit 1;
  if not found then perform public.hl_seed_cancellation_policies(e.property_id); select * into cp from public.hotel_cancellation_policies where property_id=e.property_id and active=true order by is_default desc,created_at asc limit 1; end if;
  v_policy_snapshot:=jsonb_build_object('id',cp.id,'code',cp.code,'name',cp.name,'description',cp.description,'policy_type',cp.policy_type,'language',cp.language,'currency',cp.currency,'cancellation_rules',cp.cancellation_rules,'no_show_rule',cp.no_show_rule,'early_checkout_rule',cp.early_checkout_rule,'prepayment_required',cp.prepayment_required,'prepayment_percent',cp.prepayment_percent,'captured_at',now());
  v_request:=coalesce(nullif(trim(coalesce(p_payload->>'request_id','')),''),gen_random_uuid()::text); perform pg_advisory_xact_lock(hashtextextended(e.id::text||':'||v_request,0));
  select reservation_id,manage_token into v_existing,v_manage from public.hotel_public_booking_requests where engine_id=e.id and request_key=v_request;
  if found then select * into r from public.reservas where id=v_existing; return jsonb_build_object('id',r.id,'numero_reserva',r.numero_reserva,'status',r.estado,'property_id',r.property_id,'room_type',coalesce((r.habitaciones_detalle->0->>'categoria_vendida'),'Habitación'),'rooming',coalesce(r.habitaciones_detalle->0->'rooming',jsonb_build_object('matrimonial',0,'individual',0)),'check_in',r.fecha_entrada,'check_out',r.fecha_salida,'nights',r.noches,'total',r.precio_total,'currency',r.moneda,'manage_token',v_manage,'cancellation_policy',r.cancellation_policy_snapshot,'idempotent_replay',true); end if;
  v_in:=nullif(p_payload->>'check_in','')::date; v_out:=nullif(p_payload->>'check_out','')::date; v_guests:=greatest(1,coalesce(nullif(p_payload->>'guests','')::integer,1));
  v_name:=trim(coalesce(p_payload->>'name','')); v_email:=nullif(trim(coalesce(p_payload->>'email','')),''); v_phone:=nullif(trim(coalesce(p_payload->>'phone','')),''); v_type:=nullif(trim(coalesce(p_payload->>'room_type','')),'');
  v_matrimonial:=greatest(0,least(8,coalesce(nullif(p_payload->'rooming'->>'matrimonial','')::integer,0))); v_individual:=greatest(0,least(8,coalesce(nullif(p_payload->'rooming'->>'individual','')::integer,0))); v_rooming:=jsonb_build_object('matrimonial',v_matrimonial,'individual',v_individual);
  if v_name='' then raise exception 'Falta el nombre del huésped'; end if; if v_email is null then raise exception 'Falta el email del huésped'; end if; if v_type is null then raise exception 'Falta el tipo de habitación'; end if; if v_in is null or v_out is null then raise exception 'Faltan fechas'; end if;
  v_nights:=v_out-v_in; if v_nights<e.min_nights then raise exception 'Estadía mínima de % noche(s)',e.min_nights; end if; if v_in<current_date+e.min_advance_days or v_in>current_date+e.max_advance_days then raise exception 'Fecha de entrada no disponible'; end if; if coalesce((e.room_type_rules->v_type->>'enabled')::boolean,true)=false then raise exception 'Ese tipo de habitación no se vende online'; end if;
  select h0.* into h from public.habitaciones h0 where h0.property_id=e.property_id and coalesce(h0.activa,true)=true and coalesce(h0.online_bookable,true)=true and h0.estado<>'mantenimiento' and coalesce(h0.descripcion,'') not like '[QA-PLANNING-LOAD-%' and coalesce(h0.capacidad,1)>=v_guests and lower(coalesce(nullif(trim(h0.tipo),''),'Habitación'))=lower(v_type) and not exists(select 1 from public.reservas x where x.property_id=e.property_id and coalesce(x.no_show,false)=false and coalesce(x.estado,'')<>'cancelada' and (x.habitacion_id=h0.id or h0.id=any(coalesce(x.habitaciones_ids,'{}'::bigint[]))) and x.fecha_entrada<v_out and x.fecha_salida>v_in) and not exists(select 1 from public.bloqueos b where b.property_id=e.property_id and b.habitacion_id=h0.id and b.fecha_desde<v_out and b.fecha_hasta>v_in) and not exists(select 1 from public.hotel_rate_calendar rc where rc.property_id=e.property_id and rc.habitacion_id=h0.id and rc.stay_date>=v_in and rc.stay_date<v_out and rc.stop_sell=true) and coalesce((select max(rc.min_stay) from public.hotel_rate_calendar rc where rc.property_id=e.property_id and rc.habitacion_id=h0.id and rc.stay_date>=v_in and rc.stay_date<v_out),1)<=v_nights order by (select sum(coalesce(rc.price,h0.precio,0)) from generate_series(v_in,v_out-1,interval '1 day') g(day) left join public.hotel_rate_calendar rc on rc.property_id=e.property_id and rc.habitacion_id=h0.id and rc.stay_date=g.day::date),h0.id limit 1 for update of h0;
  if not found then raise exception 'Ese tipo de habitación acaba de dejar de estar disponible'; end if;
  select sum(coalesce(rc.price,h.precio,0)) into v_total from generate_series(v_in,v_out-1,interval '1 day') g(day) left join public.hotel_rate_calendar rc on rc.property_id=e.property_id and rc.habitacion_id=h.id and rc.stay_date=g.day::date; v_nightly:=case when v_nights>0 then round(v_total/v_nights,2) else 0 end; v_channel_code:='motor:'||e.slug||':'||left(v_request,36);
  insert into public.reservas(property_id,habitacion_id,habitaciones_ids,habitaciones_detalle,nombre_huesped,email_huesped,telefono_huesped,fecha_entrada,fecha_salida,cantidad_huespedes,estado,tarifa_noche,noches,subtotal,precio_total,moneda,canal_reserva,codigo_canal,tipo_estadia,notas,cancellation_policy_id,cancellation_policy_snapshot)
  values(e.property_id,h.id,array[h.id],jsonb_build_array(jsonb_build_object('habitacion_id',h.id,'nombre',h.nombre,'categoria_asignada',coalesce(nullif(trim(h.tipo),''),'Habitación'),'categoria_vendida',v_type,'huespedes',v_guests,'tarifa_noche',v_nightly,'rooming',v_rooming)),v_name,v_email,v_phone,v_in,v_out,v_guests,'confirmada',v_nightly,v_nights,v_total,v_total,e.currency,'Motor web',v_channel_code,'overnight','Reserva creada desde motor web',cp.id,v_policy_snapshot) returning * into r;
  insert into public.hotel_public_booking_requests(engine_id,request_key,reservation_id) values(e.id,v_request,r.id) returning manage_token into v_manage;
  return jsonb_build_object('id',r.id,'numero_reserva',r.numero_reserva,'status',r.estado,'property_id',r.property_id,'room_type',v_type,'rooming',v_rooming,'check_in',r.fecha_entrada,'check_out',r.fecha_salida,'nights',r.noches,'total',r.precio_total,'currency',r.moneda,'payment_mode',e.payment_mode,'deposit_percent',e.deposit_percent,'manage_token',v_manage,'cancellation_policy',v_policy_snapshot,'idempotent_replay',false);
end;$function$;

create or replace function public.hl_public_booking_manage(p_slug text,p_token uuid,p_action text default 'view'::text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare e public.hotel_booking_engines%rowtype; req public.hotel_public_booking_requests%rowtype; r public.reservas%rowtype; v_action text:=lower(coalesce(p_action,'view')); v_can_cancel boolean; v_request_id uuid; v_detail text; v_policy jsonb;
begin
  select * into e from public.hotel_booking_engines where slug=lower(trim(p_slug)) and enabled=true; if not found then raise exception 'Motor no disponible'; end if;
  select q.* into req from public.hotel_public_booking_requests q where q.engine_id=e.id and q.manage_token=p_token; if not found then raise exception 'Enlace de gestión inválido'; end if;
  select * into r from public.reservas where id=req.reservation_id and property_id=e.property_id; if not found then raise exception 'Reserva no encontrada'; end if;
  v_policy:=coalesce(r.cancellation_policy_snapshot,'{}'::jsonb);
  v_can_cancel:=e.allow_self_cancel and lower(coalesce(r.estado,'')) in ('confirmada','pendiente','reservada') and r.fecha_entrada::timestamp >= now()+make_interval(hours=>e.self_cancel_cutoff_hours) and coalesce(v_policy->>'policy_type','flexible')<>'non_refundable';
  if v_action='cancel' then
    if not v_can_cancel then raise exception 'La cancelación online ya no está habilitada para esta reserva'; end if;
    update public.reservas set estado='cancelada',notas=concat_ws(E'\n',nullif(notas,''),'Cancelada por el huésped desde el portal web.') where id=r.id;
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_name) values(r.property_id,r.id,'guest_self_cancel','Reserva cancelada por el huésped','Cancelación realizada desde el enlace privado del motor.',jsonb_build_object('source','guest_portal','cutoff_hours',e.self_cancel_cutoff_hours,'cancellation_policy',v_policy),'Huésped'); r.estado:='cancelada'; v_can_cancel:=false;
  elsif v_action='request_change' then
    v_detail:=left(trim(coalesce(p_payload->>'detail','')),1200); if v_detail='' then raise exception 'Contanos qué cambio necesitás'; end if;
    insert into public.hotel_guest_requests(property_id,reservation_id,room_id,title,detail,status,priority,requested_by) values(r.property_id,r.id,r.habitacion_id,'Solicitud de modificación de reserva',v_detail,'open','normal','guest') returning id into v_request_id;
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_name) values(r.property_id,r.id,'guest_change_request','Huésped solicitó un cambio',v_detail,jsonb_build_object('guest_request_id',v_request_id,'source','guest_portal'),'Huésped');
  elsif v_action<>'view' then raise exception 'Acción no soportada'; end if;
  return jsonb_build_object('reservation',jsonb_build_object('id',r.id,'numero_reserva',r.numero_reserva,'name',r.nombre_huesped,'status',r.estado,'check_in',r.fecha_entrada,'check_out',r.fecha_salida,'nights',r.noches,'room_type',coalesce((r.habitaciones_detalle->0->>'categoria_vendida'),(r.habitaciones_detalle->0->>'tipo'),'Habitación'),'total',r.precio_total,'currency',r.moneda,'cancellation_policy',v_policy),'hotel',jsonb_build_object('name',coalesce(nullif(e.display_name,''),(select name from public.properties where id=e.property_id)),'contact_phone',e.contact_phone,'contact_email',e.contact_email,'cancellation_policy',coalesce(v_policy->>'description',e.cancellation_policy)),'can_cancel',v_can_cancel,'cancel_cutoff_hours',e.self_cancel_cutoff_hours,'request_id',v_request_id);
end;$function$;
