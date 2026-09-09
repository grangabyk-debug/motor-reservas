create or replace function guest_portal_private.hl_guest_stay_portal_request_internal(p_token text,p_kind text,p_detail text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','guest_portal_private','extensions','pg_temp'
as $function$
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
  if v_kind <> 'other' then
    select gr.* into v_request from public.hotel_guest_stay_portal_requests l join public.hotel_guest_requests gr on gr.id=l.guest_request_id where l.portal_id=v_portal.id and l.kind=v_kind and gr.status in ('open','in_progress') order by gr.created_at desc limit 1;
    if found then return jsonb_build_object('ok',true,'already_open',true,'request',jsonb_build_object('id',v_request.id,'title',v_request.title,'status',v_request.status,'area',v_request.assigned_area)); end if;
  end if;
  if v_kind='towels' then v_title:='Solicita toallas';v_area:='housekeeping';
  elsif v_kind='pillows' then v_title:='Solicita almohadas';v_area:='housekeeping';
  elsif v_kind='cleaning' then v_title:='Solicita limpieza de habitación';v_area:='housekeeping';
  elsif v_kind='maintenance' then v_title:='Reporta un problema en la habitación';v_area:='maintenance';v_priority:=case when lower(coalesce(v_detail,'')) ~ '(gas|humo|chispa|inund)' then 'urgent' when lower(coalesce(v_detail,'')) ~ '(roto|rota|no funciona|no anda|fuga|pierde)' then 'high' else 'normal' end;
  elsif v_kind='late_checkout' then v_title:='Solicitud de late check-out';v_area:='reception';
  else v_title:='Solicitud del huésped';v_area:='reception'; end if;
  insert into public.hotel_guest_requests(property_id,reservation_id,room_id,title,detail,status,priority,requested_by,department,assigned_area,created_by)
  values(v_res.property_id,v_res.id,v_res.habitacion_id,v_title,v_detail,'open',v_priority,'guest',v_area,v_area,null)
  returning * into v_request;
  v_requested_time:=case when v_kind='late_checkout' then substring(coalesce(v_detail,'') from '([0-2]?[0-9]:[0-5][0-9])') else null end;
  if v_requested_time is not null and v_requested_time ~ '^[0-9]:' then v_requested_time:='0'||v_requested_time; end if;
  insert into public.hotel_guest_stay_portal_requests(portal_id,property_id,reservation_id,room_id,guest_request_id,kind,decision,requested_time)
  values(v_portal.id,v_res.property_id,v_res.id,v_res.habitacion_id,v_request.id,v_kind,case when v_kind='late_checkout' then 'pending' else null end,v_requested_time);
  if v_area='reception' then
    v_conversation_id:=guest_portal_private.ensure_guest_portal_conversation(v_res.property_id,v_res.id);
    if v_conversation_id is not null then
      v_message:=case when v_kind='late_checkout' then 'Solicitud de late check-out' else 'Solicitud del huésped' end || case when v_detail is not null then ': '||v_detail else '' end;
      insert into public.inbox_messages(conversation_id,external_message_id,direction,sender_external_id,text,payload,occurred_at)
      values(v_conversation_id,gen_random_uuid()::text,'inbound','guest:'||v_res.id::text,v_message,jsonb_build_object('source','guest_portal','kind',v_kind,'request_id',v_request.id),now());
      update public.inbox_conversations set last_message_at=now(),last_message_text=v_message,unread_count=unread_count+1,status='open',updated_at=now() where id=v_conversation_id;
    end if;
  end if;
  return jsonb_build_object('ok',true,'request',jsonb_build_object('id',v_request.id,'title',v_request.title,'status',v_request.status,'area',v_request.assigned_area,'priority',v_request.priority,'created_at',v_request.created_at,'decision',case when v_kind='late_checkout' then 'pending' else null end,'requested_time',v_requested_time),'conversation_id',v_conversation_id);
end;
$function$;