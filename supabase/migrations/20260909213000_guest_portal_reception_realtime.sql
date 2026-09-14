-- Guest Portal <-> Reception: messaging, live status and late checkout approval
alter table public.hotel_guest_stay_portal_requests
  add column if not exists decision text,
  add column if not exists requested_time text,
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='hotel_guest_stay_portal_requests_decision_check') then
    alter table public.hotel_guest_stay_portal_requests
      add constraint hotel_guest_stay_portal_requests_decision_check
      check (decision is null or decision in ('pending','approved','rejected'));
  end if;
end $$;

create index if not exists idx_guest_portal_requests_kind_reservation
  on public.hotel_guest_stay_portal_requests(property_id,reservation_id,kind,created_at desc);

create or replace function guest_portal_private.ensure_guest_portal_conversation(p_property_id uuid,p_reservation_id bigint)
returns uuid
language plpgsql
security definer
set search_path='public','private','guest_portal_private','extensions','pg_temp'
as $$
declare
  v_res public.reservas%rowtype;
  v_connection_id uuid;
  v_conversation_id uuid;
begin
  select * into v_res from public.reservas where id=p_reservation_id and property_id=p_property_id and merged_into_id is null;
  if not found then return null; end if;
  insert into public.integration_connections(property_id,provider,external_account_id,external_username,status,metadata,updated_at)
  values(p_property_id,'guest_portal','guest_portal:'||p_property_id::text,'Portal del huésped','connected',jsonb_build_object('internal',true,'source','guest_portal'),now())
  on conflict(provider,external_account_id) do update
    set property_id=excluded.property_id,status='connected',external_username='Portal del huésped',metadata=coalesce(public.integration_connections.metadata,'{}'::jsonb)||excluded.metadata,updated_at=now()
  returning id into v_connection_id;
  insert into public.inbox_conversations(property_id,connection_id,channel,external_thread_id,external_contact_id,contact_name,contact_email,contact_phone,unread_count,status,guest_profile_id,reservation_id,room_id,context_link_source,context_linked_at,updated_at)
  values(p_property_id,v_connection_id,'guest_portal','stay:'||p_reservation_id::text,'reservation:'||p_reservation_id::text,v_res.nombre_huesped,v_res.email_huesped,v_res.telefono_huesped,0,'open',v_res.guest_profile_id,v_res.id,v_res.habitacion_id,'guest_portal',now(),now())
  on conflict(connection_id,external_thread_id) do update
    set contact_name=excluded.contact_name,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,guest_profile_id=excluded.guest_profile_id,reservation_id=excluded.reservation_id,room_id=excluded.room_id,context_link_source='guest_portal',context_linked_at=coalesce(public.inbox_conversations.context_linked_at,now()),updated_at=now()
  returning id into v_conversation_id;
  return v_conversation_id;
end;
$$;

create or replace function guest_portal_private.hl_guest_stay_portal_message_internal(p_token text,p_text text)
returns jsonb
language plpgsql
security definer
set search_path='public','private','guest_portal_private','extensions','pg_temp'
as $$
declare
  v_portal public.hotel_guest_stay_portals%rowtype;
  v_res public.reservas%rowtype;
  v_text text:=nullif(trim(coalesce(p_text,'')),'');
  v_conversation_id uuid;
  v_message_id uuid;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  if v_text is null then return jsonb_build_object('ok',false,'error','message_required'); end if;
  if length(v_text)>2000 then return jsonb_build_object('ok',false,'error','message_too_long'); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or now()<v_portal.valid_from or now()>=v_portal.valid_until or lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false,'error','access_expired'); end if;
  v_conversation_id:=guest_portal_private.ensure_guest_portal_conversation(v_res.property_id,v_res.id);
  if v_conversation_id is null then return jsonb_build_object('ok',false,'error','conversation_unavailable'); end if;
  insert into public.inbox_messages(conversation_id,external_message_id,direction,sender_external_id,text,payload,occurred_at)
  values(v_conversation_id,gen_random_uuid()::text,'inbound','guest:'||v_res.id::text,v_text,jsonb_build_object('source','guest_portal','reservation_id',v_res.id),now()) returning id into v_message_id;
  update public.inbox_conversations set last_message_at=now(),last_message_text=v_text,unread_count=unread_count+1,status='open',updated_at=now() where id=v_conversation_id;
  return jsonb_build_object('ok',true,'conversation_id',v_conversation_id,'message_id',v_message_id);
end;
$$;

create or replace function public.hl_guest_stay_portal_message(p_token text,p_text text)
returns jsonb language sql set search_path='public','guest_portal_private'
as $$ select guest_portal_private.hl_guest_stay_portal_message_internal(p_token,p_text); $$;

create or replace function guest_portal_private.hl_guest_portal_reply_internal(p_property_id uuid,p_conversation_id uuid,p_text text)
returns jsonb
language plpgsql
security definer
set search_path='public','private','guest_portal_private','extensions','pg_temp'
as $$
declare
  v_text text:=nullif(trim(coalesce(p_text,'')),'');
  v_conversation public.inbox_conversations%rowtype;
  v_message_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not private.user_has_property_role(p_property_id,array['owner','admin','manager','reception','night_audit']) then raise exception 'insufficient role'; end if;
  if v_text is null then raise exception 'message required'; end if;
  if length(v_text)>2000 then raise exception 'message too long'; end if;
  select * into v_conversation from public.inbox_conversations where id=p_conversation_id and property_id=p_property_id and channel='guest_portal' and reservation_id is not null;
  if not found then raise exception 'guest portal conversation not found'; end if;
  insert into public.inbox_messages(conversation_id,external_message_id,direction,sender_external_id,text,payload,occurred_at)
  values(v_conversation.id,gen_random_uuid()::text,'outbound',auth.uid()::text,v_text,jsonb_build_object('source','pms_reception','actor_id',auth.uid()),now()) returning id into v_message_id;
  update public.inbox_conversations set last_message_at=now(),last_message_text=v_text,status='open',updated_at=now() where id=v_conversation.id;
  return jsonb_build_object('ok',true,'message_id',v_message_id,'conversation_id',v_conversation.id);
end;
$$;

create or replace function public.hl_guest_portal_reply(p_property_id uuid,p_conversation_id uuid,p_text text)
returns jsonb language sql set search_path='public','guest_portal_private'
as $$ select guest_portal_private.hl_guest_portal_reply_internal(p_property_id,p_conversation_id,p_text); $$;

create or replace function guest_portal_private.hl_guest_late_checkout_review_internal(p_property_id uuid,p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','private','guest_portal_private','extensions','pg_temp'
as $$
declare
  v_link public.hotel_guest_stay_portal_requests%rowtype;
  v_request public.hotel_guest_requests%rowtype;
  v_res public.reservas%rowtype;
  v_room public.habitaciones%rowtype;
  v_next public.reservas%rowtype;
  v_requested text;
  v_checkout text;
  v_checkin text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not private.user_has_property_access(p_property_id) then raise exception 'property access denied'; end if;
  select * into v_link from public.hotel_guest_stay_portal_requests where property_id=p_property_id and guest_request_id=p_request_id and kind='late_checkout' order by created_at desc limit 1;
  if not found then return jsonb_build_object('ok',false,'error','late_request_not_found'); end if;
  select * into v_request from public.hotel_guest_requests where id=v_link.guest_request_id and property_id=p_property_id;
  select * into v_res from public.reservas where id=v_link.reservation_id and property_id=p_property_id;
  select * into v_room from public.habitaciones where id=v_link.room_id and property_id=p_property_id;
  v_requested:=coalesce(v_link.requested_time,substring(coalesce(v_request.detail,'') from '([0-2]?[0-9]:[0-5][0-9])'));
  if v_requested is not null and v_requested ~ '^[0-9]:' then v_requested:='0'||v_requested; end if;
  select coalesce(g.checkout_time,s.operational_settings->>'checkout_time','10:00'),coalesce(g.checkin_time,s.operational_settings->>'checkin_time','14:00') into v_checkout,v_checkin from public.hotel_os_settings s left join public.hotel_guest_guides g on g.property_id=s.property_id where s.property_id=p_property_id limit 1;
  select * into v_next from public.reservas r where r.property_id=p_property_id and r.id<>v_res.id and r.habitacion_id=v_res.habitacion_id and r.merged_into_id is null and lower(coalesce(r.estado,'')) not in ('cancelada','finalizada') and coalesce(r.no_show,false)=false and r.fecha_entrada>=v_res.fecha_salida order by r.fecha_entrada asc,r.id asc limit 1;
  return jsonb_build_object('ok',true,'request_id',v_request.id,'decision',coalesce(v_link.decision,'pending'),'requested_time',v_requested,'current_checkout_time',coalesce(v_res.hora_salida_estimada,v_checkout),'room',jsonb_build_object('id',v_room.id,'name',v_room.nombre),'stay',jsonb_build_object('reservation_id',v_res.id,'guest_name',v_res.nombre_huesped,'departure',v_res.fecha_salida),'next_reservation',case when v_next.id is null then null else jsonb_build_object('id',v_next.id,'arrival',v_next.fecha_entrada,'guest_name',v_next.nombre_huesped,'same_day',v_next.fecha_entrada=v_res.fecha_salida,'default_checkin_time',v_checkin) end);
end;
$$;

create or replace function public.hl_guest_late_checkout_review(p_property_id uuid,p_request_id uuid)
returns jsonb language sql set search_path='public','guest_portal_private'
as $$ select guest_portal_private.hl_guest_late_checkout_review_internal(p_property_id,p_request_id); $$;

create or replace function guest_portal_private.hl_guest_late_checkout_decide_internal(p_property_id uuid,p_request_id uuid,p_approve boolean,p_time text default null)
returns jsonb
language plpgsql
security definer
set search_path='public','private','guest_portal_private','extensions','pg_temp'
as $$
declare
  v_link public.hotel_guest_stay_portal_requests%rowtype;
  v_request public.hotel_guest_requests%rowtype;
  v_res public.reservas%rowtype;
  v_time text;
  v_conversation_id uuid;
  v_message text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not private.user_has_property_role(p_property_id,array['owner','admin','manager','reception','night_audit']) then raise exception 'insufficient role'; end if;
  select * into v_link from public.hotel_guest_stay_portal_requests where property_id=p_property_id and guest_request_id=p_request_id and kind='late_checkout' order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('ok',false,'error','late_request_not_found'); end if;
  select * into v_request from public.hotel_guest_requests where id=v_link.guest_request_id and property_id=p_property_id for update;
  select * into v_res from public.reservas where id=v_link.reservation_id and property_id=p_property_id for update;
  if coalesce(v_link.decision,'pending') in ('approved','rejected') then return jsonb_build_object('ok',true,'already_decided',true,'decision',v_link.decision,'requested_time',v_link.requested_time); end if;
  v_time:=coalesce(nullif(trim(coalesce(p_time,'')),''),v_link.requested_time,substring(coalesce(v_request.detail,'') from '([0-2]?[0-9]:[0-5][0-9])'));
  if v_time is not null and v_time ~ '^[0-9]:' then v_time:='0'||v_time; end if;
  if p_approve then
    if v_time is null or v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return jsonb_build_object('ok',false,'error','requested_time_required'); end if;
    update public.reservas set late_checkout=true,hora_salida_estimada=v_time where id=v_res.id and property_id=p_property_id;
    update public.hotel_guest_requests set status='resolved',resolved_at=now(),updated_at=now() where id=v_request.id and property_id=p_property_id;
    update public.hotel_guest_stay_portal_requests set decision='approved',requested_time=v_time,decided_at=now(),decided_by=auth.uid() where id=v_link.id;
    v_message:='Tu solicitud de late check-out fue aprobada hasta las '||v_time||'.';
  else
    update public.hotel_guest_requests set status='cancelled',resolved_at=null,updated_at=now() where id=v_request.id and property_id=p_property_id;
    update public.hotel_guest_stay_portal_requests set decision='rejected',requested_time=v_time,decided_at=now(),decided_by=auth.uid() where id=v_link.id;
    v_message:='Recepción revisó tu solicitud de late check-out y no pudo aprobarla.';
  end if;
  v_conversation_id:=guest_portal_private.ensure_guest_portal_conversation(p_property_id,v_res.id);
  if v_conversation_id is not null then
    insert into public.inbox_messages(conversation_id,external_message_id,direction,sender_external_id,text,payload,occurred_at)
    values(v_conversation_id,gen_random_uuid()::text,'outbound',auth.uid()::text,v_message,jsonb_build_object('source','late_checkout_decision','request_id',v_request.id),now());
    update public.inbox_conversations set last_message_at=now(),last_message_text=v_message,status='open',updated_at=now() where id=v_conversation_id;
  end if;
  return jsonb_build_object('ok',true,'decision',case when p_approve then 'approved' else 'rejected' end,'requested_time',v_time,'reservation_id',v_res.id);
end;
$$;

create or replace function public.hl_guest_late_checkout_decide(p_property_id uuid,p_request_id uuid,p_approve boolean,p_time text default null)
returns jsonb language sql set search_path='public','guest_portal_private'
as $$ select guest_portal_private.hl_guest_late_checkout_decide_internal(p_property_id,p_request_id,p_approve,p_time); $$;

create or replace function guest_portal_private.hl_guest_stay_portal_request_internal(p_token text,p_kind text,p_detail text default null)
returns jsonb
language plpgsql
security definer
set search_path='public','private','guest_portal_private','extensions','pg_temp'
as $$
declare
  v_portal public.hotel_guest_stay_portals%rowtype;
  v_res public.reservas%rowtype;
  v_guide public.hotel_guest_guides%rowtype;
  v_kind text:=lower(trim(coalesce(p_kind,'')));
  v_detail text:=nullif(trim(coalesce(p_detail,'')),'');
  v_title text;
  v_area text;
  v_priority text:='normal';
  v_request public.hotel_guest_requests%rowtype;
  v_requested_time text;
  v_conversation_id uuid;
  v_message text;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  if v_kind not in ('towels','pillows','cleaning','maintenance','late_checkout','other') then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
  if v_detail is not null and length(v_detail)>1000 then return jsonb_build_object('ok',false,'error','detail_too_long'); end if;
  if v_kind='maintenance' and v_detail is null then return jsonb_build_object('ok',false,'error','detail_required'); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or now()<v_portal.valid_from or now()>=v_portal.valid_until or lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false,'error','access_expired'); end if;
  select * into v_guide from public.hotel_guest_guides where property_id=v_res.property_id limit 1;
  if found then
    if coalesce(v_guide.enabled,false)=false then return jsonb_build_object('ok',false,'error','portal_disabled'); end if;
    if coalesce(v_guide.enabled_actions->v_kind,'true'::jsonb) <> 'true'::jsonb then return jsonb_build_object('ok',false,'error','request_disabled'); end if;
  end if;
  select gr.* into v_request from public.hotel_guest_stay_portal_requests l join public.hotel_guest_requests gr on gr.id=l.guest_request_id where l.portal_id=v_portal.id and l.kind=v_kind and gr.status in ('open','in_progress') order by gr.created_at desc limit 1;
  if found then return jsonb_build_object('ok',true,'already_open',true,'request',jsonb_build_object('id',v_request.id,'title',v_request.title,'status',v_request.status,'area',v_request.assigned_area)); end if;
  if v_kind='towels' then v_title:='Solicita toallas';v_area:='housekeeping';
  elsif v_kind='pillows' then v_title:='Solicita almohadas';v_area:='housekeeping';
  elsif v_kind='cleaning' then v_title:='Solicita limpieza de habitación';v_area:='housekeeping';
  elsif v_kind='maintenance' then v_title:='Reporta un problema en la habitación';v_area:='maintenance';v_priority:=case when lower(coalesce(v_detail,'')) ~ '(gas|humo|chispa|inund)' then 'urgent' when lower(coalesce(v_detail,'')) ~ '(roto|rota|no funciona|no anda|fuga|pierde)' then 'high' else 'normal' end;
  elsif v_kind='late_checkout' then v_title:='Solicitud de late check-out';v_area:='reception';
  else v_title:='Solicitud del huésped';v_area:='reception'; end if;
  insert into public.hotel_guest_requests(property_id,reservation_id,room_id,title,detail,status,priority,requested_by,department,assigned_area,created_by)
  values(v_res.property_id,v_res.id,v_res.habitacion_id,v_title,v_detail,'open',v_priority,'guest',v_area,v_area,null) returning * into v_request;
  v_requested_time:=case when v_kind='late_checkout' then substring(coalesce(v_detail,'') from '([0-2]?[0-9]:[0-5][0-9])') else null end;
  if v_requested_time is not null and v_requested_time ~ '^[0-9]:' then v_requested_time:='0'||v_requested_time; end if;
  insert into public.hotel_guest_stay_portal_requests(portal_id,property_id,reservation_id,room_id,guest_request_id,kind,decision,requested_time)
  values(v_portal.id,v_res.property_id,v_res.id,v_res.habitacion_id,v_request.id,v_kind,case when v_kind='late_checkout' then 'pending' else null end,v_requested_time);
  if v_kind='late_checkout' then
    v_conversation_id:=guest_portal_private.ensure_guest_portal_conversation(v_res.property_id,v_res.id);
    if v_conversation_id is not null then
      v_message:='Solicitud de late check-out'||case when v_detail is not null then ': '||v_detail else '' end;
      insert into public.inbox_messages(conversation_id,external_message_id,direction,sender_external_id,text,payload,occurred_at)
      values(v_conversation_id,gen_random_uuid()::text,'inbound','guest:'||v_res.id::text,v_message,jsonb_build_object('source','guest_portal','kind','late_checkout','request_id',v_request.id),now());
      update public.inbox_conversations set last_message_at=now(),last_message_text=v_message,unread_count=unread_count+1,status='open',updated_at=now() where id=v_conversation_id;
    end if;
  end if;
  return jsonb_build_object('ok',true,'request',jsonb_build_object('id',v_request.id,'title',v_request.title,'status',v_request.status,'area',v_request.assigned_area,'priority',v_request.priority,'created_at',v_request.created_at,'decision',case when v_kind='late_checkout' then 'pending' else null end,'requested_time',v_requested_time));
end;
$$;

create or replace function guest_portal_private.hl_guest_stay_portal_snapshot_internal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path='public','private','guest_portal_private','extensions','pg_temp'
as $$
declare
  v_portal public.hotel_guest_stay_portals%rowtype;
  v_res public.reservas%rowtype;
  v_room public.habitaciones%rowtype;
  v_settings public.hotel_os_settings%rowtype;
  v_guide public.hotel_guest_guides%rowtype;
  v_paid numeric:=0;
  v_requests jsonb:='[]'::jsonb;
  v_messages jsonb:='[]'::jsonb;
  v_conversation_id uuid;
  v_account jsonb;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or now()<v_portal.valid_from or now()>=v_portal.valid_until or lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false,'error','access_expired'); end if;
  select * into v_room from public.habitaciones where id=v_res.habitacion_id and property_id=v_res.property_id;
  select * into v_settings from public.hotel_os_settings where property_id=v_res.property_id;
  select * into v_guide from public.hotel_guest_guides where property_id=v_res.property_id limit 1;
  if found and coalesce(v_guide.enabled,false)=false then return jsonb_build_object('ok',false,'error','portal_disabled'); end if;
  select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0) into v_paid from public.pagos p where p.property_id=v_res.property_id and p.reserva_id=v_res.id and lower(coalesce(p.estado,'')) not in ('anulado','cancelado','void');
  select coalesce(jsonb_agg(jsonb_build_object('id',gr.id,'kind',l.kind,'title',gr.title,'status',gr.status,'area',gr.assigned_area,'created_at',gr.created_at,'updated_at',gr.updated_at,'resolved_at',gr.resolved_at,'decision',l.decision,'requested_time',l.requested_time) order by gr.created_at desc),'[]'::jsonb) into v_requests from public.hotel_guest_stay_portal_requests l join public.hotel_guest_requests gr on gr.id=l.guest_request_id and gr.property_id=l.property_id where l.portal_id=v_portal.id;
  select c.id into v_conversation_id from public.inbox_conversations c where c.property_id=v_res.property_id and c.reservation_id=v_res.id and c.channel='guest_portal' order by c.updated_at desc limit 1;
  if v_conversation_id is not null then
    select coalesce(jsonb_agg(x.payload order by x.occurred_at asc),'[]'::jsonb) into v_messages from (select jsonb_build_object('id',m.id,'direction',m.direction,'text',m.text,'occurred_at',m.occurred_at) payload,m.occurred_at from public.inbox_messages m where m.conversation_id=v_conversation_id order by m.occurred_at desc limit 40) x;
  end if;
  update public.hotel_guest_stay_portals set last_opened_at=now(),updated_at=now() where id=v_portal.id;
  if v_guide.id is null or coalesce(v_guide.show_account,true) then v_account:=jsonb_build_object('currency',coalesce(v_res.moneda,v_settings.operational_settings->>'currency','ARS'),'total',coalesce(v_res.precio_total,0),'paid',v_paid,'balance',greatest(0,coalesce(v_res.precio_total,0)-v_paid)); else v_account:=null; end if;
  return jsonb_build_object('ok',true,'hotel',jsonb_build_object('name',coalesce(v_settings.hotel_name,(select name from public.properties where id=v_res.property_id),'Habitación Llena'),'city',coalesce(v_settings.city,(select city from public.properties where id=v_res.property_id)),'motto',v_settings.motto,'welcome',coalesce(v_guide.welcome_message,v_settings.welcome_message),'logo',coalesce(v_guide.logo_url,v_settings.logo_data_url),'cover',v_guide.cover_image_url,'accent_color',coalesce(v_guide.accent_color,'#5B5CEB')),'guest',jsonb_build_object('name',v_res.nombre_huesped),'stay',jsonb_build_object('number',v_res.numero_reserva,'arrival',v_res.fecha_entrada,'departure',v_res.fecha_salida,'status',v_res.estado,'room',jsonb_build_object('name',v_room.nombre,'type',v_room.tipo),'late_checkout_confirmed',coalesce(v_res.late_checkout,false),'departure_time',v_res.hora_salida_estimada),'guide',jsonb_build_object('title',coalesce(v_guide.portal_title,v_guide.title),'subtitle',v_guide.subtitle,'wifi_name',v_guide.wifi_name,'wifi_password',v_guide.wifi_password,'contact_phone',v_guide.contact_phone,'contact_whatsapp',v_guide.contact_whatsapp,'checkin_time',coalesce(v_guide.checkin_time,v_settings.operational_settings->>'checkin_time'),'checkout_time',coalesce(v_guide.checkout_time,v_settings.operational_settings->>'checkout_time'),'sections',coalesce(v_guide.sections,'[]'::jsonb),'house_rules',coalesce(v_guide.house_rules,'[]'::jsonb),'useful_links',coalesce(v_guide.useful_links,'[]'::jsonb),'nearby_places',coalesce(v_guide.nearby_places,'[]'::jsonb),'show_account',coalesce(v_guide.show_account,true),'show_wifi',coalesce(v_guide.show_wifi,true),'show_guide',coalesce(v_guide.show_guide,true),'show_nearby',coalesce(v_guide.show_nearby,true),'show_requests',coalesce(v_guide.show_requests,true),'show_contact',coalesce(v_guide.show_contact,true),'enabled_actions',coalesce(v_guide.enabled_actions,'{"towels":true,"pillows":true,"cleaning":true,"maintenance":true,"late_checkout":true,"other":true}'::jsonb),'languages',coalesce(to_jsonb(v_guide.languages),'["es","en","pt"]'::jsonb),'default_language',coalesce(v_guide.default_language,'es'),'translations',coalesce(v_guide.translations,'{}'::jsonb),'accent_color',coalesce(v_guide.accent_color,'#5B5CEB')),'account',v_account,'booked_services',coalesce(v_res.servicios,'[]'::jsonb),'requests',case when v_guide.id is null or coalesce(v_guide.show_requests,true) then v_requests else '[]'::jsonb end,'messages',v_messages,'conversation_id',v_conversation_id,'portal',jsonb_build_object('valid_until',v_portal.valid_until,'sync_at',now()));
end;
$$;

create or replace function public.hl_get_inbox_operational_context_v2(p_property_id uuid,p_conversation_id uuid)
returns jsonb
language plpgsql
set search_path='public'
as $$
declare
  v_context jsonb;
  v_reservation_id bigint;
  v_requests jsonb:='[]'::jsonb;
begin
  v_context:=public.hl_get_inbox_operational_context(p_property_id,p_conversation_id);
  if v_context is null then return null; end if;
  v_reservation_id:=nullif(v_context->'reservation'->>'id','')::bigint;
  if v_reservation_id is not null then
    select coalesce(jsonb_agg(x.payload order by x.sort_at desc),'[]'::jsonb) into v_requests from (
      select jsonb_build_object('id',r.id,'title',r.title,'detail',r.detail,'priority',r.priority,'status',r.status,'assigned_area',r.assigned_area,'due_at',r.due_at,'room_id',r.room_id,'kind',l.kind,'decision',l.decision,'requested_time',l.requested_time) payload,coalesce(r.due_at,r.created_at) sort_at
      from public.hotel_guest_requests r
      left join lateral (select pr.kind,pr.decision,pr.requested_time from public.hotel_guest_stay_portal_requests pr where pr.guest_request_id=r.id and pr.property_id=r.property_id order by pr.created_at desc limit 1) l on true
      where r.property_id=p_property_id and r.reservation_id=v_reservation_id and lower(coalesce(r.status,'')) not in ('resolved','cancelled','canceled','done','completed')
      order by coalesce(r.due_at,r.created_at) desc limit 8
    ) x;
  end if;
  return v_context||jsonb_build_object('guest_requests',v_requests);
end;
$$;

grant usage on schema guest_portal_private to anon,authenticated;
grant execute on function guest_portal_private.ensure_guest_portal_conversation(uuid,bigint) to anon,authenticated;
grant execute on function guest_portal_private.hl_guest_stay_portal_message_internal(text,text) to anon,authenticated;
grant execute on function public.hl_guest_stay_portal_message(text,text) to anon,authenticated;
grant execute on function guest_portal_private.hl_guest_portal_reply_internal(uuid,uuid,text) to authenticated;
grant execute on function public.hl_guest_portal_reply(uuid,uuid,text) to authenticated;
grant execute on function guest_portal_private.hl_guest_late_checkout_review_internal(uuid,uuid) to authenticated;
grant execute on function public.hl_guest_late_checkout_review(uuid,uuid) to authenticated;
grant execute on function guest_portal_private.hl_guest_late_checkout_decide_internal(uuid,uuid,boolean,text) to authenticated;
grant execute on function public.hl_guest_late_checkout_decide(uuid,uuid,boolean,text) to authenticated;
