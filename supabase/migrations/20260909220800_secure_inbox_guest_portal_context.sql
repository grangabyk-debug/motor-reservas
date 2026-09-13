create or replace function private.hl_get_inbox_operational_context_v2_internal(p_property_id uuid,p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_context jsonb;
  v_reservation_id bigint;
  v_requests jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not private.user_has_property_access(p_property_id) then
    raise exception 'property access denied';
  end if;
  if not exists(select 1 from public.inbox_conversations c where c.id=p_conversation_id and c.property_id=p_property_id) then
    raise exception 'conversation not found in property';
  end if;

  v_context:=public.hl_get_inbox_operational_context(p_property_id,p_conversation_id);
  if v_context is null then return null; end if;
  v_reservation_id:=nullif(v_context->'reservation'->>'id','')::bigint;

  if v_reservation_id is not null then
    select coalesce(jsonb_agg(x.payload order by x.sort_at desc),'[]'::jsonb)
      into v_requests
    from (
      select jsonb_build_object(
        'id',r.id,'title',r.title,'detail',r.detail,'priority',r.priority,'status',r.status,
        'assigned_area',r.assigned_area,'due_at',r.due_at,'room_id',r.room_id,
        'kind',l.kind,'decision',l.decision,'requested_time',l.requested_time
      ) payload,
      coalesce(r.due_at,r.created_at) sort_at
      from public.hotel_guest_requests r
      left join lateral (
        select pr.kind,pr.decision,pr.requested_time
        from public.hotel_guest_stay_portal_requests pr
        where pr.guest_request_id=r.id and pr.property_id=r.property_id
        order by pr.created_at desc limit 1
      ) l on true
      where r.property_id=p_property_id and r.reservation_id=v_reservation_id
        and lower(coalesce(r.status,'')) not in ('resolved','cancelled','canceled','done','completed')
      order by coalesce(r.due_at,r.created_at) desc
      limit 8
    ) x;
  end if;

  return v_context||jsonb_build_object('guest_requests',v_requests);
end;
$$;

revoke all on function private.hl_get_inbox_operational_context_v2_internal(uuid,uuid) from public,anon;
grant execute on function private.hl_get_inbox_operational_context_v2_internal(uuid,uuid) to authenticated;

create or replace function public.hl_get_inbox_operational_context_v2(p_property_id uuid,p_conversation_id uuid)
returns jsonb
language sql
security invoker
set search_path to 'public','private'
as $$
  select private.hl_get_inbox_operational_context_v2_internal(p_property_id,p_conversation_id);
$$;

revoke all on function public.hl_get_inbox_operational_context_v2(uuid,uuid) from public,anon;
grant execute on function public.hl_get_inbox_operational_context_v2(uuid,uuid) to authenticated;
