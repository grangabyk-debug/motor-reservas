-- Guest portal lifecycle, guest AI, feedback, room service and analytics.
-- Applied live on 2026-09-09/10; this file versions the final state.

alter table public.hotel_guest_guides
  add column if not exists room_service_config jsonb not null default '{"enabled":false,"service_fee_type":"none","service_fee_value":0,"catalog":[],"integration":"future_restaurant_extension"}'::jsonb,
  add column if not exists feedback_config jsonb not null default '{"enabled":true,"during_stay":true,"post_stay":true,"review_url":""}'::jsonb,
  add column if not exists guest_ai_config jsonb not null default '{"enabled":true,"learning":true}'::jsonb;

create table if not exists public.hotel_guest_portal_events(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  portal_id uuid not null references public.hotel_guest_stay_portals(id) on delete cascade,
  event_type text not null check(length(event_type) between 1 and 80),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hotel_guest_portal_events_property_created_idx on public.hotel_guest_portal_events(property_id,created_at desc);
create index if not exists hotel_guest_portal_events_reservation_idx on public.hotel_guest_portal_events(reservation_id,created_at desc);

create table if not exists public.hotel_guest_feedback(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  portal_id uuid not null references public.hotel_guest_stay_portals(id) on delete cascade,
  score smallint not null check(score between 1 and 5),
  comment text,
  phase text not null default 'during_stay' check(phase in ('during_stay','post_stay')),
  status text not null default 'new' check(status in ('new','contacted','resolved','archived')),
  guest_request_id uuid references public.hotel_guest_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(portal_id,phase)
);
create index if not exists hotel_guest_feedback_property_created_idx on public.hotel_guest_feedback(property_id,created_at desc);

create table if not exists public.hotel_guest_phrase_memory(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  phrase text not null,
  intent text not null,
  examples integer not null default 1 check(examples>0),
  confirmed integer not null default 1 check(confirmed>=0),
  confidence numeric(5,4) not null default .65 check(confidence between 0 and 1),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,phrase,intent)
);
create index if not exists hotel_guest_phrase_memory_property_idx on public.hotel_guest_phrase_memory(property_id,confidence desc,last_seen_at desc);

alter table public.hotel_guest_portal_events enable row level security;
alter table public.hotel_guest_feedback enable row level security;
alter table public.hotel_guest_phrase_memory enable row level security;

drop policy if exists hotel_guest_portal_events_staff_select on public.hotel_guest_portal_events;
create policy hotel_guest_portal_events_staff_select on public.hotel_guest_portal_events for select to authenticated using(private.user_has_property_access(property_id));
drop policy if exists hotel_guest_feedback_staff_select on public.hotel_guest_feedback;
create policy hotel_guest_feedback_staff_select on public.hotel_guest_feedback for select to authenticated using(private.user_has_property_access(property_id));
drop policy if exists hotel_guest_feedback_staff_update on public.hotel_guest_feedback;
create policy hotel_guest_feedback_staff_update on public.hotel_guest_feedback for update to authenticated using(private.user_has_property_access(property_id)) with check(private.user_has_property_access(property_id));
drop policy if exists hotel_guest_phrase_memory_staff_select on public.hotel_guest_phrase_memory;
create policy hotel_guest_phrase_memory_staff_select on public.hotel_guest_phrase_memory for select to authenticated using(private.user_has_property_access(property_id));

revoke all on public.hotel_guest_portal_events from anon;
revoke all on public.hotel_guest_feedback from anon;
revoke all on public.hotel_guest_phrase_memory from anon;
grant select on public.hotel_guest_portal_events to authenticated;
grant select,update on public.hotel_guest_feedback to authenticated;
grant select on public.hotel_guest_phrase_memory to authenticated;

create or replace function guest_portal_private.hl_revoke_portal_on_reservation_end()
returns trigger language plpgsql security definer set search_path='public','private','guest_portal_private','pg_temp' as $$
begin
  if lower(coalesce(new.estado,'')) in ('cancelada','finalizada') or coalesce(new.no_show,false) or new.checkout_real_at is not null then
    update public.hotel_guest_stay_portals set revoked_at=coalesce(revoked_at,now()),updated_at=now()
    where property_id=new.property_id and reservation_id=new.id and revoked_at is null;
  end if;
  return new;
end;$$;

drop trigger if exists trg_revoke_guest_portal_on_reservation_end on public.reservas;
create trigger trg_revoke_guest_portal_on_reservation_end
after insert or update of estado,no_show,checkout_real_at on public.reservas
for each row execute function guest_portal_private.hl_revoke_portal_on_reservation_end();

create or replace function public.hl_guest_stay_portal_access_state(p_reservation_id bigint)
returns jsonb language plpgsql security definer set search_path='public','private','guest_portal_private','pg_temp' as $$
declare v_user uuid:=auth.uid(); v_res public.reservas%rowtype;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_res from public.reservas where id=p_reservation_id and merged_into_id is null;
  if not found then return jsonb_build_object('ok',false,'state','missing','can_issue',false,'message','Reserva inexistente.'); end if;
  if not private.user_has_property_access(v_res.property_id) then raise exception 'No tenés acceso a esta propiedad.' using errcode='42501'; end if;
  if lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then
    return jsonb_build_object('ok',true,'state','ended','can_issue',false,'message','Esta estadía ya finalizó. El Portal del huésped fue desactivado y el enlace anterior ya no permite acceder.');
  end if;
  if lower(coalesce(v_res.estado,''))<>'alojado' then
    return jsonb_build_object('ok',true,'state','waiting_checkin','can_issue',false,'message','El Portal del huésped se habilita automáticamente cuando Recepción realiza el check-in.');
  end if;
  return jsonb_build_object('ok',true,'state','active','can_issue',true,'message','Portal habilitado mientras el huésped permanezca en estadía.');
end;$$;
revoke all on function public.hl_guest_stay_portal_access_state(bigint) from public,anon;
grant execute on function public.hl_guest_stay_portal_access_state(bigint) to authenticated;

create or replace function guest_portal_private.hl_guest_stay_portal_issue_internal(p_reservation_id bigint)
returns jsonb language plpgsql security definer set search_path='public','private','guest_portal_private','extensions','pg_temp' as $$
declare v_user uuid:=auth.uid(); v_res public.reservas%rowtype; v_portal public.hotel_guest_stay_portals%rowtype; v_token text; v_valid_until timestamptz;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_res from public.reservas where id=p_reservation_id and merged_into_id is null;
  if not found then raise exception 'Reserva inexistente.' using errcode='P0002'; end if;
  if not private.user_has_property_access(v_res.property_id) then raise exception 'No tenés acceso a esta propiedad.' using errcode='42501'; end if;
  if lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then
    raise exception 'Esta estadía ya finalizó. El Portal del huésped fue desactivado al realizar el check-out.';
  end if;
  if lower(coalesce(v_res.estado,''))<>'alojado' then raise exception 'El Portal del huésped todavía no está disponible. Se habilita cuando Recepción realiza el check-in.'; end if;
  v_token:=encode(gen_random_bytes(24),'hex');
  v_valid_until:=((v_res.fecha_salida+1)::timestamp at time zone 'America/Argentina/Buenos_Aires');
  insert into public.hotel_guest_stay_portals(property_id,reservation_id,token_hash,valid_from,valid_until,revoked_at,created_by,last_opened_at,updated_at)
  values(v_res.property_id,v_res.id,encode(digest(v_token,'sha256'),'hex'),now(),v_valid_until,null,v_user,null,now())
  on conflict(property_id,reservation_id) do update set token_hash=excluded.token_hash,valid_from=excluded.valid_from,valid_until=excluded.valid_until,revoked_at=null,created_by=excluded.created_by,last_opened_at=null,updated_at=now()
  returning * into v_portal;
  return jsonb_build_object('ok',true,'token',v_token,'path','/stay/'||v_token,'valid_until',v_portal.valid_until,'reservation_id',v_res.id,'property_id',v_res.property_id);
end;$$;

create or replace function public.hl_guest_stay_portal_track(p_token text,p_event text,p_meta jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='public','guest_portal_private','extensions','pg_temp' as $$
declare v_portal public.hotel_guest_stay_portals%rowtype; v_res public.reservas%rowtype; v_event text:=left(lower(trim(coalesce(p_event,''))),80);
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 or v_event='' then return jsonb_build_object('ok',false); end if;
  if v_event='request_confirmed' then return jsonb_build_object('ok',true); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or lower(coalesce(v_res.estado,''))<>'alojado' or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false); end if;
  insert into public.hotel_guest_portal_events(property_id,reservation_id,portal_id,event_type,meta) values(v_portal.property_id,v_portal.reservation_id,v_portal.id,v_event,coalesce(p_meta,'{}'::jsonb));
  return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.hl_guest_stay_portal_track(text,text,jsonb) from public;
grant execute on function public.hl_guest_stay_portal_track(text,text,jsonb) to anon,authenticated;

create or replace function public.hl_guest_stay_portal_feedback(p_token text,p_score integer,p_comment text default null)
returns jsonb language plpgsql security definer set search_path='public','guest_portal_private','extensions','pg_temp' as $$
declare v_portal public.hotel_guest_stay_portals%rowtype; v_res public.reservas%rowtype; v_comment text:=nullif(left(trim(coalesce(p_comment,'')),1500),''); v_feedback public.hotel_guest_feedback%rowtype; v_request public.hotel_guest_requests%rowtype; v_conversation uuid;
begin
  if p_score<1 or p_score>5 then return jsonb_build_object('ok',false,'error','invalid_score'); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or lower(coalesce(v_res.estado,''))<>'alojado' or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false,'error','access_expired'); end if;
  insert into public.hotel_guest_feedback(property_id,reservation_id,portal_id,score,comment,phase,updated_at)
  values(v_res.property_id,v_res.id,v_portal.id,p_score,v_comment,'during_stay',now())
  on conflict(portal_id,phase) do update set score=excluded.score,comment=excluded.comment,updated_at=now()
  returning * into v_feedback;
  if p_score<=3 and v_feedback.guest_request_id is null then
    insert into public.hotel_guest_requests(property_id,reservation_id,room_id,title,detail,status,priority,requested_by,department,assigned_area,created_by)
    values(v_res.property_id,v_res.id,v_res.habitacion_id,'Feedback del huésped requiere atención',coalesce(v_comment,'El huésped indicó que su estadía no viene bien.'),'open',case when p_score<=2 then 'high' else 'normal' end,'guest','reception','reception',null)
    returning * into v_request;
    update public.hotel_guest_feedback set guest_request_id=v_request.id where id=v_feedback.id;
    v_conversation:=guest_portal_private.ensure_guest_portal_conversation(v_res.property_id,v_res.id);
    if v_conversation is not null then
      insert into public.inbox_messages(conversation_id,external_message_id,direction,sender_external_id,text,payload,occurred_at)
      values(v_conversation,gen_random_uuid()::text,'inbound','guest:'||v_res.id::text,'Feedback durante la estadía: '||p_score||'/5'||case when v_comment is not null then ' · '||v_comment else '' end,jsonb_build_object('source','guest_portal_feedback','feedback_id',v_feedback.id,'request_id',v_request.id),now());
      update public.inbox_conversations set last_message_at=now(),last_message_text='Feedback del huésped · '||p_score||'/5',unread_count=unread_count+1,status='open',updated_at=now() where id=v_conversation;
    end if;
  end if;
  insert into public.hotel_guest_portal_events(property_id,reservation_id,portal_id,event_type,meta) values(v_res.property_id,v_res.id,v_portal.id,'feedback_submitted',jsonb_build_object('score',p_score));
  return jsonb_build_object('ok',true,'score',p_score,'needs_attention',p_score<=3);
end;$$;
revoke all on function public.hl_guest_stay_portal_feedback(text,integer,text) from public;
grant execute on function public.hl_guest_stay_portal_feedback(text,integer,text) to anon,authenticated;

create or replace function public.hl_guest_portal_learn_phrase(p_token text,p_phrase text,p_intent text)
returns jsonb language plpgsql security definer set search_path='public','guest_portal_private','extensions','pg_temp' as $$
declare v_portal public.hotel_guest_stay_portals%rowtype; v_res public.reservas%rowtype; v_guide public.hotel_guest_guides%rowtype; v_phrase text; v_intent text:=left(lower(trim(coalesce(p_intent,''))),80); v_recent boolean:=false;
begin
  v_phrase:=left(regexp_replace(lower(trim(coalesce(p_phrase,''))),'\s+',' ','g'),180);
  if length(v_phrase)<3 or v_intent not in ('towels','pillows','cleaning','maintenance','late_checkout','other') then return jsonb_build_object('ok',false); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or lower(coalesce(v_res.estado,''))<>'alojado' or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false); end if;
  select * into v_guide from public.hotel_guest_guides where property_id=v_res.property_id limit 1;
  if found and coalesce((v_guide.guest_ai_config->>'learning')::boolean,true)=false then return jsonb_build_object('ok',false,'error','learning_disabled'); end if;
  select exists(select 1 from public.hotel_guest_stay_portal_requests l join public.hotel_guest_requests r on r.id=l.guest_request_id and r.property_id=l.property_id where l.portal_id=v_portal.id and l.kind=v_intent and r.created_at>=now()-interval '10 minutes') into v_recent;
  if not v_recent then return jsonb_build_object('ok',false,'error','unconfirmed_phrase'); end if;
  insert into public.hotel_guest_phrase_memory(property_id,phrase,intent,examples,confirmed,confidence,last_seen_at,updated_at)
  values(v_res.property_id,v_phrase,v_intent,1,1,.65,now(),now())
  on conflict(property_id,phrase,intent) do update set examples=hotel_guest_phrase_memory.examples+1,confirmed=hotel_guest_phrase_memory.confirmed+1,confidence=least(.96,hotel_guest_phrase_memory.confidence+.04),last_seen_at=now(),updated_at=now();
  return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.hl_guest_portal_learn_phrase(text,text,text) from public;
grant execute on function public.hl_guest_portal_learn_phrase(text,text,text) to anon,authenticated;

create or replace function public.hl_guest_stay_portal_ai_context(p_token text)
returns jsonb language plpgsql security definer set search_path='public','guest_portal_private','extensions','pg_temp' as $$
declare v_portal public.hotel_guest_stay_portals%rowtype; v_res public.reservas%rowtype; v_room public.habitaciones%rowtype; v_guide public.hotel_guest_guides%rowtype; v_name text; v_mem jsonb;
begin
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or lower(coalesce(v_res.estado,''))<>'alojado' or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false,'error','access_expired'); end if;
  select * into v_room from public.habitaciones where id=v_res.habitacion_id and property_id=v_res.property_id;
  select * into v_guide from public.hotel_guest_guides where property_id=v_res.property_id limit 1;
  select name into v_name from public.properties where id=v_res.property_id;
  select coalesce(jsonb_agg(jsonb_build_object('phrase',m.phrase,'intent',m.intent,'confidence',m.confidence) order by m.confidence desc,m.last_seen_at desc),'[]'::jsonb) into v_mem from (select * from public.hotel_guest_phrase_memory where property_id=v_res.property_id order by confidence desc,last_seen_at desc limit 20) m;
  return jsonb_build_object('ok',true,'property_id',v_res.property_id,'hotel',jsonb_build_object('name',v_name),'guest',jsonb_build_object('name',v_res.nombre_huesped),'stay',jsonb_build_object('room',v_room.nombre,'room_type',v_room.tipo,'arrival',v_res.fecha_entrada,'departure',v_res.fecha_salida,'late_checkout',coalesce(v_res.late_checkout,false)),'guide',jsonb_build_object('welcome_message',v_guide.welcome_message,'wifi_name',v_guide.wifi_name,'wifi_password',v_guide.wifi_password,'checkin_time',v_guide.checkin_time,'checkout_time',v_guide.checkout_time,'sections',coalesce(v_guide.sections,'[]'::jsonb),'house_rules',coalesce(v_guide.house_rules,'[]'::jsonb),'nearby_places',coalesce(v_guide.nearby_places,'[]'::jsonb),'enabled_actions',coalesce(v_guide.enabled_actions,'{}'::jsonb),'room_service_config',coalesce(v_guide.room_service_config,'{}'::jsonb),'guest_ai_config',coalesce(v_guide.guest_ai_config,'{}'::jsonb)),'memory',v_mem);
end;$$;
revoke all on function public.hl_guest_stay_portal_ai_context(text) from public;
grant execute on function public.hl_guest_stay_portal_ai_context(text) to anon,authenticated;

create or replace function guest_portal_private.hl_guest_stay_portal_message_internal(p_token text,p_text text)
returns jsonb language plpgsql security definer set search_path='public','private','guest_portal_private','extensions','pg_temp' as $$
declare v_portal public.hotel_guest_stay_portals%rowtype; v_res public.reservas%rowtype; v_text text:=nullif(trim(coalesce(p_text,'')),''); v_conversation_id uuid; v_message_id uuid;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  if v_text is null then return jsonb_build_object('ok',false,'error','message_required'); end if;
  if length(v_text)>2000 then return jsonb_build_object('ok',false,'error','message_too_long'); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or now()<v_portal.valid_from or now()>=v_portal.valid_until or lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false,'error','access_expired'); end if;
  if lower(coalesce(v_res.estado,''))<>'alojado' then return jsonb_build_object('ok',false,'error','not_checked_in'); end if;
  v_conversation_id:=guest_portal_private.ensure_guest_portal_conversation(v_res.property_id,v_res.id);
  if v_conversation_id is null then return jsonb_build_object('ok',false,'error','conversation_unavailable'); end if;
  insert into public.inbox_messages(conversation_id,external_message_id,direction,sender_external_id,text,payload,occurred_at)
  values(v_conversation_id,gen_random_uuid()::text,'inbound','guest:'||v_res.id::text,v_text,jsonb_build_object('source','guest_portal','reservation_id',v_res.id),now()) returning id into v_message_id;
  update public.inbox_conversations set last_message_at=now(),last_message_text=v_text,unread_count=unread_count+1,status='open',updated_at=now() where id=v_conversation_id;
  insert into public.hotel_guest_portal_events(property_id,reservation_id,portal_id,event_type,meta) values(v_res.property_id,v_res.id,v_portal.id,'message_sent',jsonb_build_object('length',length(v_text)));
  return jsonb_build_object('ok',true,'conversation_id',v_conversation_id,'message_id',v_message_id);
end;$$;

create or replace function guest_portal_private.hl_guest_stay_portal_request_internal(p_token text,p_kind text,p_detail text default null)
returns jsonb language plpgsql security definer set search_path='public','private','guest_portal_private','extensions','pg_temp' as $$
declare v_portal public.hotel_guest_stay_portals%rowtype; v_res public.reservas%rowtype; v_guide public.hotel_guest_guides%rowtype; v_kind text:=lower(trim(coalesce(p_kind,''))); v_detail text:=nullif(trim(coalesce(p_detail,'')),''); v_title text; v_area text; v_priority text:='normal'; v_request public.hotel_guest_requests%rowtype; v_requested_time text; v_conversation_id uuid; v_message text;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  if v_kind not in ('towels','pillows','cleaning','maintenance','late_checkout','other') then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
  if v_detail is not null and length(v_detail)>1000 then return jsonb_build_object('ok',false,'error','detail_too_long'); end if;
  if v_kind='maintenance' and v_detail is null then return jsonb_build_object('ok',false,'error','detail_required'); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or now()<v_portal.valid_from or now()>=v_portal.valid_until or lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false,'error','access_expired'); end if;
  if lower(coalesce(v_res.estado,''))<>'alojado' then return jsonb_build_object('ok',false,'error','not_checked_in'); end if;
  select * into v_guide from public.hotel_guest_guides where property_id=v_res.property_id limit 1;
  if found then if coalesce(v_guide.enabled,false)=false then return jsonb_build_object('ok',false,'error','portal_disabled'); end if; if coalesce(v_guide.enabled_actions->v_kind,'true'::jsonb)<>'true'::jsonb then return jsonb_build_object('ok',false,'error','request_disabled'); end if; end if;
  if v_kind<>'other' then select gr.* into v_request from public.hotel_guest_stay_portal_requests l join public.hotel_guest_requests gr on gr.id=l.guest_request_id where l.portal_id=v_portal.id and l.kind=v_kind and gr.status in ('open','in_progress') order by gr.created_at desc limit 1; if found then return jsonb_build_object('ok',true,'already_open',true,'request',jsonb_build_object('id',v_request.id,'title',v_request.title,'status',v_request.status,'area',v_request.assigned_area)); end if; end if;
  if v_kind='towels' then v_title:='Solicita toallas';v_area:='housekeeping'; elsif v_kind='pillows' then v_title:='Solicita almohadas';v_area:='housekeeping'; elsif v_kind='cleaning' then v_title:='Solicita limpieza de habitación';v_area:='housekeeping'; elsif v_kind='maintenance' then v_title:='Reporta un problema en la habitación';v_area:='maintenance';v_priority:=case when lower(coalesce(v_detail,''))~'(gas|humo|chispa|inund)' then 'urgent' when lower(coalesce(v_detail,''))~'(roto|rota|no funciona|no anda|fuga|pierde)' then 'high' else 'normal' end; elsif v_kind='late_checkout' then v_title:='Solicitud de late check-out';v_area:='reception'; else v_title:='Solicitud del huésped';v_area:='reception'; end if;
  insert into public.hotel_guest_requests(property_id,reservation_id,room_id,title,detail,status,priority,requested_by,department,assigned_area,created_by) values(v_res.property_id,v_res.id,v_res.habitacion_id,v_title,v_detail,'open',v_priority,'guest',v_area,v_area,null) returning * into v_request;
  v_requested_time:=case when v_kind='late_checkout' then substring(coalesce(v_detail,'') from '([0-2]?[0-9]:[0-5][0-9])') else null end; if v_requested_time is not null and v_requested_time~'^[0-9]:' then v_requested_time:='0'||v_requested_time; end if;
  insert into public.hotel_guest_stay_portal_requests(portal_id,property_id,reservation_id,room_id,guest_request_id,kind,decision,requested_time) values(v_portal.id,v_res.property_id,v_res.id,v_res.habitacion_id,v_request.id,v_kind,case when v_kind='late_checkout' then 'pending' else null end,v_requested_time);
  if v_area='reception' then v_conversation_id:=guest_portal_private.ensure_guest_portal_conversation(v_res.property_id,v_res.id); if v_conversation_id is not null then v_message:=case when v_kind='late_checkout' then 'Solicitud de late check-out' else 'Solicitud del huésped' end||case when v_detail is not null then ': '||v_detail else '' end; insert into public.inbox_messages(conversation_id,external_message_id,direction,sender_external_id,text,payload,occurred_at) values(v_conversation_id,gen_random_uuid()::text,'inbound','guest:'||v_res.id::text,v_message,jsonb_build_object('source','guest_portal','kind',v_kind,'request_id',v_request.id),now()); update public.inbox_conversations set last_message_at=now(),last_message_text=v_message,unread_count=unread_count+1,status='open',updated_at=now() where id=v_conversation_id; end if; end if;
  insert into public.hotel_guest_portal_events(property_id,reservation_id,portal_id,event_type,meta) values(v_res.property_id,v_res.id,v_portal.id,'request_created',jsonb_build_object('kind',v_kind,'area',v_area));
  return jsonb_build_object('ok',true,'request',jsonb_build_object('id',v_request.id,'title',v_request.title,'status',v_request.status,'area',v_request.assigned_area,'priority',v_request.priority,'created_at',v_request.created_at,'decision',case when v_kind='late_checkout' then 'pending' else null end,'requested_time',v_requested_time),'conversation_id',v_conversation_id);
end;$$;

create or replace function guest_portal_private.hl_guest_stay_portal_snapshot_internal(p_token text)
returns jsonb language plpgsql security definer set search_path='public','private','guest_portal_private','extensions','pg_temp' as $$
declare v_portal public.hotel_guest_stay_portals%rowtype; v_res public.reservas%rowtype; v_room public.habitaciones%rowtype; v_settings public.hotel_os_settings%rowtype; v_guide public.hotel_guest_guides%rowtype; v_paid numeric:=0; v_requests jsonb:='[]'::jsonb; v_messages jsonb:='[]'::jsonb; v_conversation_id uuid; v_account jsonb;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or now()>=v_portal.valid_until or lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false,'error','access_expired'); end if;
  if lower(coalesce(v_res.estado,''))<>'alojado' or now()<v_portal.valid_from then return jsonb_build_object('ok',false,'error','not_checked_in'); end if;
  select * into v_room from public.habitaciones where id=v_res.habitacion_id and property_id=v_res.property_id;
  select * into v_settings from public.hotel_os_settings where property_id=v_res.property_id;
  select * into v_guide from public.hotel_guest_guides where property_id=v_res.property_id limit 1;
  if found and coalesce(v_guide.enabled,false)=false then return jsonb_build_object('ok',false,'error','portal_disabled'); end if;
  select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0) into v_paid from public.pagos p where p.property_id=v_res.property_id and p.reserva_id=v_res.id and lower(coalesce(p.estado,'')) not in ('anulado','cancelado','void');
  select coalesce(jsonb_agg(jsonb_build_object('id',gr.id,'kind',l.kind,'title',gr.title,'detail',gr.detail,'status',gr.status,'area',gr.assigned_area,'created_at',gr.created_at,'updated_at',gr.updated_at,'resolved_at',gr.resolved_at,'decision',l.decision,'requested_time',l.requested_time) order by gr.created_at desc),'[]'::jsonb) into v_requests from public.hotel_guest_stay_portal_requests l join public.hotel_guest_requests gr on gr.id=l.guest_request_id and gr.property_id=l.property_id where l.portal_id=v_portal.id;
  select c.id into v_conversation_id from public.inbox_conversations c where c.property_id=v_res.property_id and c.reservation_id=v_res.id and c.channel='guest_portal' order by c.updated_at desc limit 1;
  if v_conversation_id is not null then select coalesce(jsonb_agg(x.payload order by x.occurred_at asc),'[]'::jsonb) into v_messages from (select jsonb_build_object('id',m.id,'direction',m.direction,'text',m.text,'occurred_at',m.occurred_at) payload,m.occurred_at from public.inbox_messages m where m.conversation_id=v_conversation_id order by m.occurred_at desc limit 40) x; end if;
  update public.hotel_guest_stay_portals set last_opened_at=now(),updated_at=now() where id=v_portal.id;
  if v_guide.id is null or coalesce(v_guide.show_account,true) then v_account:=jsonb_build_object('currency',coalesce(v_res.moneda,v_settings.operational_settings->>'currency','ARS'),'total',coalesce(v_res.precio_total,0),'paid',v_paid,'balance',greatest(0,coalesce(v_res.precio_total,0)-v_paid)); else v_account:=null; end if;
  return jsonb_build_object('ok',true,'hotel',jsonb_build_object('name',coalesce(v_settings.hotel_name,(select name from public.properties where id=v_res.property_id),'Habitación Llena'),'city',coalesce(v_settings.city,(select city from public.properties where id=v_res.property_id)),'motto',v_settings.motto,'welcome',coalesce(v_guide.welcome_message,v_settings.welcome_message),'logo',coalesce(v_guide.logo_url,v_settings.logo_data_url),'cover',v_guide.cover_image_url,'accent_color',coalesce(v_guide.accent_color,'#5B5CEB')),'guest',jsonb_build_object('name',v_res.nombre_huesped),'stay',jsonb_build_object('number',v_res.numero_reserva,'arrival',v_res.fecha_entrada,'departure',v_res.fecha_salida,'status',v_res.estado,'room',jsonb_build_object('name',v_room.nombre,'type',v_room.tipo),'late_checkout_confirmed',coalesce(v_res.late_checkout,false),'departure_time',v_res.hora_salida_estimada),'guide',jsonb_build_object('title',coalesce(v_guide.portal_title,v_guide.title),'subtitle',v_guide.subtitle,'wifi_name',v_guide.wifi_name,'wifi_password',v_guide.wifi_password,'contact_phone',v_guide.contact_phone,'contact_whatsapp',v_guide.contact_whatsapp,'checkin_time',coalesce(v_guide.checkin_time,v_settings.operational_settings->>'checkin_time'),'checkout_time',coalesce(v_guide.checkout_time,v_settings.operational_settings->>'checkout_time'),'sections',coalesce(v_guide.sections,'[]'::jsonb),'house_rules',coalesce(v_guide.house_rules,'[]'::jsonb),'useful_links',coalesce(v_guide.useful_links,'[]'::jsonb),'nearby_places',coalesce(v_guide.nearby_places,'[]'::jsonb),'show_account',coalesce(v_guide.show_account,true),'show_wifi',coalesce(v_guide.show_wifi,true),'show_guide',coalesce(v_guide.show_guide,true),'show_nearby',coalesce(v_guide.show_nearby,true),'show_requests',coalesce(v_guide.show_requests,true),'show_contact',coalesce(v_guide.show_contact,true),'enabled_actions',coalesce(v_guide.enabled_actions,'{"towels":true,"pillows":true,"cleaning":true,"maintenance":true,"late_checkout":true,"other":true}'::jsonb),'languages',coalesce(to_jsonb(v_guide.languages),'["es","en","pt"]'::jsonb),'default_language',coalesce(v_guide.default_language,'es'),'translations',coalesce(v_guide.translations,'{}'::jsonb),'accent_color',coalesce(v_guide.accent_color,'#5B5CEB'),'room_service_config',coalesce(v_guide.room_service_config,'{}'::jsonb),'feedback_config',coalesce(v_guide.feedback_config,'{}'::jsonb),'guest_ai_config',coalesce(v_guide.guest_ai_config,'{}'::jsonb)),'account',v_account,'booked_services',coalesce(v_res.servicios,'[]'::jsonb),'requests',case when v_guide.id is null or coalesce(v_guide.show_requests,true) then v_requests else '[]'::jsonb end,'messages',v_messages,'conversation_id',v_conversation_id,'portal',jsonb_build_object('valid_until',v_portal.valid_until,'sync_at',now(),'phase','in_stay'));
end;$$;
