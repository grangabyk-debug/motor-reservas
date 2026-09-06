create or replace function public.hl_public_booking_manage(p_slug text,p_token uuid,p_action text default 'view'::text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare
  e public.hotel_booking_engines%rowtype; req public.hotel_public_booking_requests%rowtype; r public.reservas%rowtype;
  v_action text:=lower(coalesce(p_action,'view')); v_can_cancel boolean; v_request_id uuid; v_detail text; v_policy jsonb;
  v_days_before integer:=0; v_rule jsonb:='{}'::jsonb; v_charge_type text:='none'; v_charge_value numeric:=0; v_penalty numeric:=0;
begin
  select * into e from public.hotel_booking_engines where slug=lower(trim(p_slug)) and enabled=true; if not found then raise exception 'Motor no disponible'; end if;
  select q.* into req from public.hotel_public_booking_requests q where q.engine_id=e.id and q.manage_token=p_token; if not found then raise exception 'Enlace de gestión inválido'; end if;
  select * into r from public.reservas where id=req.reservation_id and property_id=e.property_id; if not found then raise exception 'Reserva no encontrada'; end if;
  v_policy:=coalesce(r.cancellation_policy_snapshot,'{}'::jsonb);
  v_days_before:=greatest(0,r.fecha_entrada-current_date);
  select x into v_rule from jsonb_array_elements(coalesce(v_policy->'cancellation_rules','[]'::jsonb)) x
    where v_days_before>=coalesce(nullif(x->>'min_days_before','')::integer,0)
    order by coalesce(nullif(x->>'min_days_before','')::integer,0) desc limit 1;
  v_rule:=coalesce(v_rule,'{"charge_type":"none","value":0}'::jsonb);
  v_charge_type:=coalesce(v_rule->>'charge_type','none'); v_charge_value:=greatest(0,coalesce(nullif(v_rule->>'value','')::numeric,0));
  v_penalty:=case v_charge_type when 'fixed' then v_charge_value when 'percent' then coalesce(r.precio_total,0)*v_charge_value/100 when 'nights' then coalesce(r.tarifa_noche,0)*v_charge_value else 0 end;
  v_can_cancel:=e.allow_self_cancel and lower(coalesce(r.estado,'')) in ('confirmada','pendiente','reservada') and r.fecha_entrada::timestamp >= now()+make_interval(hours=>e.self_cancel_cutoff_hours) and coalesce(v_policy->>'policy_type','flexible')<>'non_refundable' and v_penalty<=0.01;
  if v_action='cancel' then
    if not v_can_cancel then raise exception 'La cancelación online requiere intervención del hotel según la política de esta reserva'; end if;
    update public.reservas set estado='cancelada',notas=concat_ws(E'\n',nullif(notas,''),'Cancelada por el huésped desde el portal web.') where id=r.id;
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_name) values(r.property_id,r.id,'guest_self_cancel','Reserva cancelada por el huésped','Cancelación realizada desde el enlace privado del motor.',jsonb_build_object('source','guest_portal','cutoff_hours',e.self_cancel_cutoff_hours,'cancellation_policy',v_policy,'penalty_amount',v_penalty,'penalty_rule',v_rule),'Huésped'); r.estado:='cancelada'; v_can_cancel:=false;
  elsif v_action='request_change' then
    v_detail:=left(trim(coalesce(p_payload->>'detail','')),1200); if v_detail='' then raise exception 'Contanos qué cambio necesitás'; end if;
    insert into public.hotel_guest_requests(property_id,reservation_id,room_id,title,detail,status,priority,requested_by) values(r.property_id,r.id,r.habitacion_id,'Solicitud de modificación de reserva',v_detail,'open','normal','guest') returning id into v_request_id;
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_name) values(r.property_id,r.id,'guest_change_request','Huésped solicitó un cambio',v_detail,jsonb_build_object('guest_request_id',v_request_id,'source','guest_portal'),'Huésped');
  elsif v_action<>'view' then raise exception 'Acción no soportada'; end if;
  return jsonb_build_object('reservation',jsonb_build_object('id',r.id,'numero_reserva',r.numero_reserva,'name',r.nombre_huesped,'status',r.estado,'check_in',r.fecha_entrada,'check_out',r.fecha_salida,'nights',r.noches,'room_type',coalesce((r.habitaciones_detalle->0->>'categoria_vendida'),(r.habitaciones_detalle->0->>'tipo'),'Habitación'),'total',r.precio_total,'currency',r.moneda,'cancellation_policy',v_policy),'hotel',jsonb_build_object('name',coalesce(nullif(e.display_name,''),(select name from public.properties where id=e.property_id)),'contact_phone',e.contact_phone,'contact_email',e.contact_email,'cancellation_policy',coalesce(v_policy->>'description',e.cancellation_policy)),'can_cancel',v_can_cancel,'cancel_cutoff_hours',e.self_cancel_cutoff_hours,'cancellation_penalty_amount',round(v_penalty,2),'cancellation_penalty_rule',v_rule,'request_id',v_request_id);
end;$function$;
