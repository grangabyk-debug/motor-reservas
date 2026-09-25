CREATE OR REPLACE FUNCTION public.hl_get_reservation_operational_timeline(p_property_id uuid, p_reservation_id bigint, p_limit integer DEFAULT 250)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
        and e.event_type<>'payment_allocation'

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
        and not exists(
          select 1
          from public.hotel_reservation_events re
          where re.property_id=p_property_id
            and re.reservation_id=p_reservation_id
            and re.event_type='payment_added'
            and jsonb_extract_path_text(coalesce(re.payload,'{}'::jsonb),'payment_id')=pay.id::text
        )
    ) u
    order by u.occurred_at desc
    limit greatest(1,least(coalesce(p_limit,250),1000))
  ) x;
  return v_result;
end;
$function$
;
