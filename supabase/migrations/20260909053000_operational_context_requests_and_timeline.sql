create or replace function public.hl_operational_event_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_payload jsonb:=to_jsonb(new);
  v_metadata jsonb;
  v_actor uuid:=auth.uid();
begin
  v_metadata:=jsonb_strip_nulls(jsonb_build_object(
    'reservation_id',nullif(v_payload->>'reservation_id','')::bigint,
    'room_id',nullif(v_payload->>'room_id','')::bigint,
    'label',coalesce(nullif(v_payload->>'title',''),nullif(v_payload->>'task_type',''),tg_table_name),
    'priority',v_payload->>'priority',
    'assigned_to',v_payload->>'assigned_to'
  ));

  if tg_op='INSERT' then
    insert into public.hotel_operational_events(property_id,entity_type,entity_id,event_type,from_status,to_status,actor_id,metadata)
    values(new.property_id,tg_table_name,new.id,'created',null,new.status,v_actor,v_metadata);
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.hotel_operational_events(property_id,entity_type,entity_id,event_type,from_status,to_status,actor_id,metadata)
    values(new.property_id,tg_table_name,new.id,'status_changed',old.status,new.status,v_actor,v_metadata);
  end if;
  if old.assigned_to is distinct from new.assigned_to then
    insert into public.hotel_operational_events(property_id,entity_type,entity_id,event_type,from_status,to_status,actor_id,metadata)
    values(new.property_id,tg_table_name,new.id,'assigned',old.status,new.status,v_actor,v_metadata||jsonb_build_object('before_assigned_to',old.assigned_to));
  end if;
  if old.priority is distinct from new.priority then
    insert into public.hotel_operational_events(property_id,entity_type,entity_id,event_type,from_status,to_status,actor_id,metadata)
    values(new.property_id,tg_table_name,new.id,'priority_changed',old.status,new.status,v_actor,v_metadata||jsonb_build_object('before_priority',old.priority));
  end if;
  return new;
end;
$$;

revoke all on function public.hl_operational_event_trigger() from public,anon,authenticated;

drop trigger if exists trg_guest_requests_operational_events on public.hotel_guest_requests;
create trigger trg_guest_requests_operational_events
after insert or update of status,assigned_to,priority on public.hotel_guest_requests
for each row execute function public.hl_operational_event_trigger();

drop trigger if exists trg_housekeeping_operational_events on public.hotel_housekeeping_tasks;
create trigger trg_housekeeping_operational_events
after insert or update of status,assigned_to,priority on public.hotel_housekeeping_tasks
for each row execute function public.hl_operational_event_trigger();

drop trigger if exists trg_maintenance_operational_events on public.hotel_maintenance_tickets;
create trigger trg_maintenance_operational_events
after insert or update of status,assigned_to,priority on public.hotel_maintenance_tickets
for each row execute function public.hl_operational_event_trigger();

insert into public.hotel_operational_events(property_id,entity_type,entity_id,event_type,from_status,to_status,actor_id,metadata,created_at)
select x.property_id,x.entity_type,x.entity_id,'created',null,x.status,null,x.metadata,x.created_at
from (
  select r.property_id,'hotel_guest_requests'::text entity_type,r.id entity_id,r.status,r.created_at,
         jsonb_strip_nulls(jsonb_build_object('reservation_id',r.reservation_id,'room_id',r.room_id,'label',r.title,'priority',r.priority,'assigned_to',r.assigned_to)) metadata
  from public.hotel_guest_requests r
  union all
  select h.property_id,'hotel_housekeeping_tasks',h.id,h.status,h.created_at,
         jsonb_strip_nulls(jsonb_build_object('reservation_id',h.reservation_id,'room_id',h.room_id,'label',h.task_type,'priority',h.priority,'assigned_to',h.assigned_to))
  from public.hotel_housekeeping_tasks h
  union all
  select m.property_id,'hotel_maintenance_tickets',m.id,m.status,m.created_at,
         jsonb_strip_nulls(jsonb_build_object('reservation_id',m.reservation_id,'room_id',m.room_id,'label',m.title,'priority',m.priority,'assigned_to',m.assigned_to))
  from public.hotel_maintenance_tickets m
) x
where not exists(
  select 1 from public.hotel_operational_events e
  where e.property_id=x.property_id and e.entity_type=x.entity_type and e.entity_id=x.entity_id and e.event_type='created'
);

create or replace function public.hl_get_inbox_operational_context_v2(p_property_id uuid,p_conversation_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
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
    select coalesce(jsonb_agg(x.payload order by x.sort_at desc),'[]'::jsonb)
      into v_requests
    from (
      select jsonb_build_object('id',r.id,'title',r.title,'detail',r.detail,'priority',r.priority,'status',r.status,'assigned_area',r.assigned_area,'due_at',r.due_at,'room_id',r.room_id) payload,
             coalesce(r.due_at,r.created_at) sort_at
      from public.hotel_guest_requests r
      where r.property_id=p_property_id and r.reservation_id=v_reservation_id
        and lower(coalesce(r.status,'')) not in ('resolved','cancelled','canceled','done','completed')
      order by coalesce(r.due_at,r.created_at) desc
      limit 8
    ) x;
  end if;
  return v_context||jsonb_build_object('guest_requests',v_requests);
end;
$$;

revoke all on function public.hl_get_inbox_operational_context_v2(uuid,uuid) from public;
grant execute on function public.hl_get_inbox_operational_context_v2(uuid,uuid) to authenticated;

create or replace function public.hl_get_reservation_operational_timeline(p_property_id uuid,p_reservation_id bigint,p_limit integer default 250)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_result jsonb:='[]'::jsonb;
  v_conversation jsonb;
  v_conversation_id uuid;
begin
  if not exists(select 1 from public.reservas r where r.property_id=p_property_id and r.id=p_reservation_id) then return '[]'::jsonb; end if;
  v_conversation:=public.hl_get_reservation_conversation(p_property_id,p_reservation_id);
  if nullif(v_conversation->>'id','') is not null then v_conversation_id:=(v_conversation->>'id')::uuid; end if;

  select coalesce(jsonb_agg(x.payload order by x.occurred_at desc),'[]'::jsonb)
    into v_result
  from (
    select u.payload,u.occurred_at
    from (
      select e.created_at occurred_at,
             jsonb_build_object('id',e.id,'source','reservation','entity_type','reservas','entity_id',p_reservation_id,'reservation_id',p_reservation_id,'room_id',null,'event_type',e.event_type,'title',e.title,'detail',e.detail,'actor_name',e.actor_name,'created_at',e.created_at,'payload',coalesce(e.payload,'{}'::jsonb)) payload
      from public.hotel_reservation_events e
      where e.property_id=p_property_id and e.reservation_id=p_reservation_id

      union all

      select m.occurred_at,
             jsonb_build_object('id',m.id,'source','message','entity_type','inbox_messages','entity_id',m.id,'reservation_id',p_reservation_id,'room_id',c.room_id,'event_type',case when m.direction='outbound' then 'message_sent' else 'message_received' end,'title',case when m.direction='outbound' then 'Mensaje enviado' else 'Mensaje recibido' end,'detail',m.text,'actor_name',case when m.direction='outbound' then 'Hotel' else coalesce(c.contact_name,'Huésped') end,'created_at',m.occurred_at,'payload',jsonb_build_object('conversation_id',c.id,'channel',c.channel,'direction',m.direction))
      from public.inbox_messages m join public.inbox_conversations c on c.id=m.conversation_id
      where c.property_id=p_property_id and (c.reservation_id=p_reservation_id or c.id=v_conversation_id)

      union all

      select e.created_at,
             jsonb_build_object('id',e.id,'source','guest_request','entity_type',e.entity_type,'entity_id',e.entity_id,'reservation_id',r.reservation_id,'room_id',r.room_id,'event_type',e.event_type,'title',concat('Petición · ',coalesce(r.title,'Solicitud')),'detail',concat_ws(' · ',nullif(r.detail,''),case when e.from_status is distinct from e.to_status and e.from_status is not null then concat(e.from_status,' → ',e.to_status) end),'actor_name',p.full_name,'created_at',e.created_at,'payload',coalesce(e.metadata,'{}'::jsonb)||jsonb_build_object('status',r.status,'priority',r.priority,'assigned_area',r.assigned_area))
      from public.hotel_operational_events e
      join public.hotel_guest_requests r on e.entity_type='hotel_guest_requests' and e.entity_id=r.id
      left join public.profiles p on p.id=e.actor_id
      where e.property_id=p_property_id and r.property_id=p_property_id and r.reservation_id=p_reservation_id

      union all

      select e.created_at,
             jsonb_build_object('id',e.id,'source','housekeeping','entity_type',e.entity_type,'entity_id',e.entity_id,'reservation_id',h.reservation_id,'room_id',h.room_id,'event_type',e.event_type,'title',concat('Housekeeping · ',coalesce(h.task_type,'Tarea')),'detail',concat_ws(' · ',nullif(h.notes,''),case when e.from_status is distinct from e.to_status and e.from_status is not null then concat(e.from_status,' → ',e.to_status) end),'actor_name',p.full_name,'created_at',e.created_at,'payload',coalesce(e.metadata,'{}'::jsonb)||jsonb_build_object('status',h.status,'priority',h.priority))
      from public.hotel_operational_events e
      join public.hotel_housekeeping_tasks h on e.entity_type='hotel_housekeeping_tasks' and e.entity_id=h.id
      left join public.profiles p on p.id=e.actor_id
      where e.property_id=p_property_id and h.property_id=p_property_id and h.reservation_id=p_reservation_id

      union all

      select e.created_at,
             jsonb_build_object('id',e.id,'source','maintenance','entity_type',e.entity_type,'entity_id',e.entity_id,'reservation_id',mt.reservation_id,'room_id',mt.room_id,'event_type',e.event_type,'title',concat('Mantenimiento · ',coalesce(mt.title,'Incidencia')),'detail',concat_ws(' · ',nullif(mt.description,''),case when e.from_status is distinct from e.to_status and e.from_status is not null then concat(e.from_status,' → ',e.to_status) end),'actor_name',p.full_name,'created_at',e.created_at,'payload',coalesce(e.metadata,'{}'::jsonb)||jsonb_build_object('status',mt.status,'priority',mt.priority,'cost',mt.cost))
      from public.hotel_operational_events e
      join public.hotel_maintenance_tickets mt on e.entity_type='hotel_maintenance_tickets' and e.entity_id=mt.id
      left join public.profiles p on p.id=e.actor_id
      where e.property_id=p_property_id and mt.property_id=p_property_id and mt.reservation_id=p_reservation_id

      union all

      select pay.created_at,
             jsonb_build_object('id',concat('payment-',pay.id),'source','payment','entity_type','pagos','entity_id',pay.id,'reservation_id',p_reservation_id,'room_id',null,'event_type','payment_recorded','title',concat('Pago · ',coalesce(pay.metodo,pay.source,'Cobro')),'detail',concat(coalesce(pay.monto,0),' ',coalesce(nullif(pay.moneda,''),'ARS'),case when nullif(pay.referencia,'') is not null then concat(' · ',pay.referencia) else '' end),'actor_name',p.full_name,'created_at',pay.created_at,'payload',jsonb_build_object('amount',pay.monto,'currency',coalesce(nullif(pay.moneda,''),'ARS'),'status',pay.estado,'refunded_amount',coalesce(pay.refunded_amount,0),'provider',pay.provider))
      from public.pagos pay
      left join public.profiles p on p.id=pay.created_by
      where pay.property_id=p_property_id and pay.reserva_id=p_reservation_id
        and lower(coalesce(pay.estado,'')) not in ('anulado','cancelado','void','rechazado','cancelled')
    ) u
    order by u.occurred_at desc
    limit greatest(1,least(coalesce(p_limit,250),1000))
  ) x;
  return v_result;
end;
$$;

revoke all on function public.hl_get_reservation_operational_timeline(uuid,bigint,integer) from public;
grant execute on function public.hl_get_reservation_operational_timeline(uuid,bigint,integer) to authenticated;
