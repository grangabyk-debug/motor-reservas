alter table public.hotel_ai_action_requests drop constraint if exists hotel_ai_action_requests_action_type_check;
alter table public.hotel_ai_action_requests add constraint hotel_ai_action_requests_action_type_check check (action_type = any (array['create_guest_request'::text,'create_maintenance_ticket'::text,'update_guest_request_status'::text,'update_maintenance_status'::text,'renotify_operational_action'::text]));

create or replace function olivia_private.hl_olivia_propose_action_internal(p_property_id uuid, p_action_type text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','private' as $function$
declare
  v_user uuid := auth.uid(); v_action public.hotel_ai_action_requests; v_area text; v_status text; v_reservation_id bigint; v_room_id bigint; v_assigned_to uuid; v_target uuid; v_target_type text; v_original uuid;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not private.user_has_property_access(p_property_id) then raise exception 'property access denied' using errcode='42501'; end if;
  if p_action_type not in ('create_guest_request','create_maintenance_ticket','update_guest_request_status','update_maintenance_status','renotify_operational_action') then raise exception 'unsupported action type'; end if;
  if p_action_type='create_guest_request' then
    if nullif(trim(coalesce(p_payload->>'title','')),'') is null then raise exception 'title required'; end if;
    v_area := coalesce(nullif(p_payload->>'assigned_area',''),'reception'); if v_area not in ('reception','housekeeping','maintenance') then raise exception 'invalid assigned_area'; end if;
  elsif p_action_type='create_maintenance_ticket' then
    if nullif(trim(coalesce(p_payload->>'title','')),'') is null then raise exception 'title required'; end if;
  elsif p_action_type='renotify_operational_action' then
    if not private.user_has_property_role(p_property_id,array['owner','admin','manager','reception','housekeeping','maintenance','night_audit']) then raise exception 'action not allowed'; end if;
    v_target_type := nullif(p_payload->>'target_type',''); if v_target_type not in ('hotel_guest_requests','hotel_maintenance_tickets') then raise exception 'invalid target_type'; end if;
    begin v_target := (p_payload->>'target_id')::uuid; exception when others then raise exception 'invalid target_id'; end;
    begin v_original := (p_payload->>'original_action_id')::uuid; exception when others then raise exception 'invalid original_action_id'; end;
    if not exists(select 1 from public.hotel_ai_action_requests a where a.id=v_original and a.property_id=p_property_id and a.status='executed' and a.target_type=v_target_type and a.target_id=v_target::text) then raise exception 'original action not found or target mismatch'; end if;
    if v_target_type='hotel_guest_requests' and not exists(select 1 from public.hotel_guest_requests r where r.id=v_target and r.property_id=p_property_id) then raise exception 'guest request target not found'; end if;
    if v_target_type='hotel_maintenance_tickets' and not exists(select 1 from public.hotel_maintenance_tickets m where m.id=v_target and m.property_id=p_property_id) then raise exception 'maintenance target not found'; end if;
  else
    if nullif(p_payload->>'target_id','') is null then raise exception 'target_id required'; end if;
    begin perform (p_payload->>'target_id')::uuid; exception when others then raise exception 'invalid target_id'; end;
    v_status := nullif(p_payload->>'status','');
    if p_action_type='update_guest_request_status' and v_status not in ('open','in_progress','resolved','cancelled') then raise exception 'invalid guest request status'; end if;
    if p_action_type='update_maintenance_status' and v_status not in ('open','assigned','in_progress','waiting_parts','resolved','cancelled') then raise exception 'invalid maintenance status'; end if;
  end if;
  if nullif(p_payload->>'reservation_id','') is not null then if (p_payload->>'reservation_id') !~ '^\d+$' then raise exception 'invalid reservation_id'; end if; v_reservation_id := (p_payload->>'reservation_id')::bigint; if not exists(select 1 from public.reservas r where r.id=v_reservation_id and r.property_id=p_property_id) then raise exception 'reservation not found in property'; end if; end if;
  if nullif(p_payload->>'room_id','') is not null then if (p_payload->>'room_id') !~ '^\d+$' then raise exception 'invalid room_id'; end if; v_room_id := (p_payload->>'room_id')::bigint; if not exists(select 1 from public.habitaciones h where h.id=v_room_id and h.property_id=p_property_id) then raise exception 'room not found in property'; end if; end if;
  if nullif(p_payload->>'assigned_to','') is not null then begin v_assigned_to := (p_payload->>'assigned_to')::uuid; exception when others then raise exception 'invalid assigned_to'; end; if not exists(select 1 from public.property_members pm where pm.property_id=p_property_id and pm.user_id=v_assigned_to) then raise exception 'assignee not found in property'; end if; end if;
  insert into public.hotel_ai_action_requests(property_id,requested_by,action_type,payload,source) values(p_property_id,v_user,p_action_type,coalesce(p_payload,'{}'::jsonb),'olivia') returning * into v_action;
  return to_jsonb(v_action);
end;$function$;

create or replace function olivia_private.hl_olivia_execute_action_internal(p_property_id uuid, p_action_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','private' as $function$
declare
  v_user uuid := auth.uid(); v_action public.hotel_ai_action_requests; v_target uuid; v_now timestamptz := now(); v_status text; v_area text; v_reservation_id bigint; v_room_id bigint; v_assigned_to uuid; v_target_type text; v_title text; v_detail text;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_action from public.hotel_ai_action_requests where id=p_action_id and property_id=p_property_id for update; if not found then raise exception 'action not found'; end if; if v_action.status <> 'approved' then raise exception 'action must be approved first'; end if;
  begin
    if nullif(v_action.payload->>'reservation_id','') is not null then v_reservation_id := (v_action.payload->>'reservation_id')::bigint; if not exists(select 1 from public.reservas r where r.id=v_reservation_id and r.property_id=p_property_id) then raise exception 'reservation not found in property'; end if; else v_reservation_id := null; end if;
    if nullif(v_action.payload->>'room_id','') is not null then v_room_id := (v_action.payload->>'room_id')::bigint; if not exists(select 1 from public.habitaciones h where h.id=v_room_id and h.property_id=p_property_id) then raise exception 'room not found in property'; end if; else v_room_id := null; end if;
    if nullif(v_action.payload->>'assigned_to','') is not null then v_assigned_to := (v_action.payload->>'assigned_to')::uuid; if not exists(select 1 from public.property_members pm where pm.property_id=p_property_id and pm.user_id=v_assigned_to) then raise exception 'assignee not found in property'; end if; else v_assigned_to := null; end if;
    if v_action.action_type='create_guest_request' then
      if not private.user_has_property_role(p_property_id,array['owner','admin','manager','reception','housekeeping','maintenance','night_audit']) then raise exception 'action not allowed'; end if;
      v_area := coalesce(nullif(v_action.payload->>'assigned_area',''),'reception');
      insert into public.hotel_guest_requests(property_id,reservation_id,room_id,title,detail,status,priority,assigned_area,department,assigned_to,requested_by,due_at,created_by) values(p_property_id,v_reservation_id,v_room_id,trim(v_action.payload->>'title'),nullif(trim(coalesce(v_action.payload->>'detail','')),''),'open',case when coalesce(v_action.payload->>'priority','normal') in ('low','normal','high','urgent') then coalesce(v_action.payload->>'priority','normal') else 'normal' end,v_area,v_area,v_assigned_to,case when coalesce(v_action.payload->>'requested_by','guest') in ('guest','reception','housekeeping','other') then coalesce(v_action.payload->>'requested_by','guest') else 'other' end,case when nullif(v_action.payload->>'due_at','') is null then null else (v_action.payload->>'due_at')::timestamptz end,v_user) returning id into v_target;
      update public.hotel_ai_action_requests set target_type='hotel_guest_requests',target_id=v_target::text where id=v_action.id;
    elsif v_action.action_type='create_maintenance_ticket' then
      if not private.user_has_property_role(p_property_id,array['owner','admin','manager','reception','housekeeping','maintenance','night_audit']) then raise exception 'action not allowed'; end if;
      insert into public.hotel_maintenance_tickets(property_id,reservation_id,room_id,title,description,priority,status,assigned_to,reported_by,due_at,cost,photos) values(p_property_id,v_reservation_id,v_room_id,trim(v_action.payload->>'title'),nullif(trim(coalesce(v_action.payload->>'description','')),''),case when coalesce(v_action.payload->>'priority','normal') in ('low','normal','high','urgent') then coalesce(v_action.payload->>'priority','normal') else 'normal' end,'open',v_assigned_to,v_user,case when nullif(v_action.payload->>'due_at','') is null then null else (v_action.payload->>'due_at')::timestamptz end,0,'[]'::jsonb) returning id into v_target;
      update public.hotel_ai_action_requests set target_type='hotel_maintenance_tickets',target_id=v_target::text where id=v_action.id;
    elsif v_action.action_type='renotify_operational_action' then
      if not private.user_has_property_role(p_property_id,array['owner','admin','manager','reception','housekeeping','maintenance','night_audit']) then raise exception 'action not allowed'; end if;
      v_target_type := v_action.payload->>'target_type'; v_target := (v_action.payload->>'target_id')::uuid;
      if v_target_type='hotel_guest_requests' then select coalesce(nullif(r.assigned_area,''),'reception'),r.title,r.detail,r.room_id,r.reservation_id into v_area,v_title,v_detail,v_room_id,v_reservation_id from public.hotel_guest_requests r where r.id=v_target and r.property_id=p_property_id; if not found then raise exception 'guest request target not found'; end if;
      elsif v_target_type='hotel_maintenance_tickets' then select 'maintenance',m.title,m.description,m.room_id,m.reservation_id into v_area,v_title,v_detail,v_room_id,v_reservation_id from public.hotel_maintenance_tickets m where m.id=v_target and m.property_id=p_property_id; if not found then raise exception 'maintenance target not found'; end if;
      else raise exception 'invalid target_type'; end if;
      insert into public.hotel_operational_events(property_id,entity_type,entity_id,event_type,actor_id,metadata) values(p_property_id,v_target_type,v_target,'olivia_reminder',v_user,jsonb_strip_nulls(jsonb_build_object('source','olivia','assigned_area',v_area,'title',v_title,'detail',v_detail,'room_id',v_room_id,'reservation_id',v_reservation_id,'original_action_id',v_action.payload->>'original_action_id','reminder',true)));
      update public.hotel_ai_action_requests set target_type=v_target_type,target_id=v_target::text where id=v_action.id;
    elsif v_action.action_type='update_guest_request_status' then
      v_target := (v_action.payload->>'target_id')::uuid; v_status := v_action.payload->>'status';
      if not exists(select 1 from public.hotel_guest_requests r where r.id=v_target and r.property_id=p_property_id and (private.user_has_property_role(p_property_id,array['owner','admin','manager','reception','night_audit']) or (r.assigned_area='housekeeping' and private.user_has_property_role(p_property_id,array['housekeeping'])) or (r.assigned_area='maintenance' and private.user_has_property_role(p_property_id,array['maintenance'])))) then raise exception 'action not allowed'; end if;
      update public.hotel_guest_requests set status=v_status,resolved_at=case when v_status='resolved' then v_now else null end,updated_at=v_now where id=v_target and property_id=p_property_id; update public.hotel_ai_action_requests set target_type='hotel_guest_requests',target_id=v_target::text where id=v_action.id;
    elsif v_action.action_type='update_maintenance_status' then
      if not private.user_has_property_role(p_property_id,array['owner','admin','manager','reception','housekeeping','maintenance','night_audit']) then raise exception 'action not allowed'; end if;
      v_target := (v_action.payload->>'target_id')::uuid; v_status := v_action.payload->>'status'; update public.hotel_maintenance_tickets set status=v_status,started_at=case when v_status='in_progress' and started_at is null then v_now else started_at end,completed_at=case when v_status='resolved' then v_now when v_status<>'resolved' then null else completed_at end,updated_at=v_now where id=v_target and property_id=p_property_id; if not found then raise exception 'maintenance target not found'; end if; update public.hotel_ai_action_requests set target_type='hotel_maintenance_tickets',target_id=v_target::text where id=v_action.id;
    end if;
    update public.hotel_ai_action_requests set status='executed',executed_by=v_user,executed_at=v_now,updated_at=v_now,execution_result=jsonb_build_object('ok',true,'target_type',target_type,'target_id',target_id) where id=v_action.id returning * into v_action; return to_jsonb(v_action);
  exception when others then update public.hotel_ai_action_requests set status='failed',executed_by=v_user,executed_at=v_now,updated_at=v_now,execution_result=jsonb_build_object('ok',false,'error',sqlerrm) where id=v_action.id returning * into v_action; return to_jsonb(v_action); end;
end;$function$;
