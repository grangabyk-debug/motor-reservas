-- No Show por habitación dentro de grupos parcialmente alojados.
alter table public.hotel_no_show_history add column if not exists scope text not null default 'reservation';
alter table public.hotel_no_show_history add column if not exists room_id bigint references public.habitaciones(id);
create index if not exists hotel_no_show_history_room_idx on public.hotel_no_show_history(reservation_id,room_id,created_at desc);

CREATE OR REPLACE FUNCTION public.hl_mark_group_room_no_show_atomic(p_reserva_id bigint, p_room_id bigint, p_release_date date DEFAULT NULL::date, p_penalty_amount numeric DEFAULT 0, p_penalty_status text DEFAULT 'none'::text, p_note text DEFAULT NULL::text)
 RETURNS reservas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_before public.reservas%rowtype;
  v_after public.reservas%rowtype;
  v_room public.habitaciones%rowtype;
  v_detail jsonb;
  v_start date;
  v_end date;
  v_release date;
  v_rate_net numeric:=0;
  v_vat_rate numeric:=0;
  v_penalty_gross numeric:=greatest(0,coalesce(p_penalty_amount,0));
  v_penalty_net numeric:=0;
  v_status text:=lower(coalesce(p_penalty_status,'none'));
  v_paid numeric:=0;
  v_services jsonb:='[]'::jsonb;
  v_details jsonb:='[]'::jsonb;
  v_event_id uuid;
  v_room_folio uuid;
  v_room_name text;
  v_original_room_total_net numeric:=0;
  v_original_room_total_gross numeric:=0;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Tenés que iniciar sesión.';
  end if;

  select * into v_before from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v_before.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para registrar No Show de una habitación.';
  end if;
  if v_before.estado<>'alojado' or coalesce(v_before.no_show,false) or v_before.estado in('cancelada','finalizada') then
    raise exception using errcode='P0001',message='El No Show por habitación se usa en grupos parcialmente alojados.';
  end if;
  if cardinality(coalesce(v_before.habitaciones_ids,'{}'::bigint[]))<=1
     or not (p_room_id=any(coalesce(v_before.habitaciones_ids,'{}'::bigint[]))) then
    raise exception using errcode='22023',message='La habitación no pertenece a un grupo activo.';
  end if;

  select * into v_room from public.habitaciones where id=p_room_id and property_id=v_before.property_id;
  if not found then raise exception using errcode='P0002',message='Habitación inexistente.'; end if;
  v_room_name:=coalesce(v_room.nombre,p_room_id::text);

  select e into v_detail
  from jsonb_array_elements(coalesce(v_before.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','')~'^[0-9]+$'
    and (e->>'habitacion_id')::bigint=p_room_id
    and lower(coalesce(e->>'segment_role','active_room')) not in ('previous_room','transient_room','cancelled_room','no_show_room')
  order by coalesce(nullif(e->>'fecha_entrada','')::date,v_before.fecha_entrada) desc
  limit 1;
  if v_detail is null then raise exception using errcode='P0002',message='No encontramos un tramo pendiente para esa habitación.'; end if;
  if nullif(v_detail->>'checked_in_at','') is not null then
    raise exception using errcode='P0001',message='La habitación ya hizo check-in. Usá check-out o cancelación parcial.';
  end if;

  v_start:=coalesce(nullif(v_detail->>'fecha_entrada','')::date,v_before.fecha_entrada);
  v_end:=coalesce(nullif(v_detail->>'fecha_salida','')::date,v_before.fecha_salida);
  v_release:=coalesce(p_release_date,current_date);
  if v_release<v_start then raise exception using errcode='P0001',message='Todavía no llegó la fecha de entrada de esa habitación.'; end if;
  if v_release>v_end then v_release:=v_end; end if;

  v_rate_net:=greatest(0,coalesce(nullif(v_detail->>'tarifa_noche','')::numeric,v_room.precio,0));
  v_vat_rate:=case when coalesce(v_before.impuestos_desglosados,false) then greatest(0,coalesce(v_before.iva_porcentaje,0)) else 0 end;
  v_original_room_total_net:=round(v_rate_net*greatest(0,v_end-v_start),2);
  v_original_room_total_gross:=round(v_original_room_total_net*(1+v_vat_rate/100),2);

  if v_status not in ('none','charged','waived') then raise exception using errcode='22023',message='Estado de penalidad inválido.'; end if;
  if v_penalty_gross<=0 then v_status:='none'; end if;
  if v_penalty_gross>0 and v_status='none' then raise exception using errcode='P0001',message='Indicá si la penalidad fue cobrada o eximida.'; end if;

  select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0)
  into v_paid
  from public.pagos p
  where p.property_id=v_before.property_id and p.reserva_id=v_before.id
    and lower(coalesce(p.estado,'')) not in ('void','anulado','anulada','cancelado','cancelada','cancelled','rejected','rechazado','rechazada');

  if v_penalty_gross>0 and v_status='charged' and v_paid+0.01<v_penalty_gross then
    raise exception using errcode='P0001',message='Primero registrá el cobro de la penalidad antes de marcar No Show.';
  end if;

  v_penalty_net:=case
    when v_status='charged' and v_penalty_gross>0 and v_vat_rate>0 then round(v_penalty_gross/(1+v_vat_rate/100),6)
    when v_status='charged' then round(v_penalty_gross,6)
    else 0
  end;

  insert into public.hotel_no_show_history(
    property_id,reservation_id,scope,room_id,action,
    original_fecha_entrada,original_fecha_salida,original_noches,original_tarifa_noche,original_precio_total,
    currency,release_date,penalty_amount,penalty_status,had_guarantee,guarantee_id,note,snapshot,created_by
  ) values(
    v_before.property_id,v_before.id,'room',p_room_id,'marked',
    v_start,v_end,greatest(0,v_end-v_start),v_rate_net,v_original_room_total_gross,
    coalesce(v_before.moneda,'ARS'),v_release,v_penalty_gross,v_status,false,null,
    nullif(trim(coalesce(p_note,'')),''),
    jsonb_build_object(
      'room_id',p_room_id,'room_name',v_room_name,'reservation_state',v_before.estado,
      'room_rate_net',v_rate_net,'room_total_net',v_original_room_total_net,
      'room_total_gross',v_original_room_total_gross,'vat_rate',v_vat_rate,
      'paid_at_mark',v_paid,'detail_before',v_detail
    ),auth.uid()
  );

  v_after:=public.hl_cancel_group_room_atomic(
    p_reserva_id,p_room_id,v_start,v_penalty_net,true,nullif(trim(coalesce(p_note,'')),'')
  );

  select coalesce(jsonb_agg(
    case
      when coalesce(e->>'habitacion_id','')~'^[0-9]+$'
       and (e->>'habitacion_id')::bigint=p_room_id
       and lower(coalesce(e->>'segment_role',''))='cancelled_room'
      then e||jsonb_build_object(
        'segment_role','no_show_room','huespedes',0,'no_show_at',now(),
        'no_show_release_date',v_release,'no_show_penalty_amount',v_penalty_gross,
        'no_show_penalty_status',v_status,'no_show_note',nullif(trim(coalesce(p_note,'')),'')
      )
      else e
    end order by ord
  ),'[]'::jsonb)
  into v_details
  from jsonb_array_elements(coalesce(v_after.habitaciones_detalle,'[]'::jsonb)) with ordinality t(e,ord);

  select coalesce(jsonb_agg(
    case
      when s->>'id' like 'room-cancel-'||p_room_id::text||'-%'
      then s||jsonb_build_object(
        'nombre','Penalidad No Show · Habitación '||v_room_name,
        'detalle',coalesce(nullif(trim(coalesce(p_note,'')),''),'Penalidad aplicada por No Show de una habitación del grupo.'),
        'no_show_penalty',true,'room_no_show',true,'room_id',p_room_id,
        'precio',v_penalty_net,'total',v_penalty_net,'total_final',v_penalty_gross,
        'precio_comercial',v_penalty_gross,'price_tax_mode',case when v_vat_rate>0 then 'tax_included' else 'net' end
      )
      else s
    end order by ord
  ),'[]'::jsonb)
  into v_services
  from jsonb_array_elements(coalesce(v_after.servicios,'[]'::jsonb)) with ordinality t(s,ord);

  update public.reservas
  set habitaciones_detalle=v_details,servicios=v_services
  where id=v_after.id
  returning * into v_after;

  update public.hotel_reservation_guests
  set notes=concat_ws(' · ',nullif(trim(coalesce(notes,'')),''),'No Show de Hab. '||v_room_name),updated_at=now()
  where reservation_id=v_after.id and property_id=v_after.property_id and room_id=p_room_id;

  select e.id into v_event_id
  from public.hotel_reservation_events e
  where e.property_id=v_after.property_id and e.reservation_id=v_after.id
    and e.event_type='group_room_cancelled' and e.payload->>'room_id'=p_room_id::text
  order by e.created_at desc limit 1;

  if v_event_id is not null then
    update public.hotel_reservation_events
    set event_type='group_room_no_show',title='No Show de habitación',
        detail='Hab. '||v_room_name||' no se presentó · habitación liberada · penalidad '||
          case when v_status='charged' then trim(to_char(v_penalty_gross,'FM999999990.00'))||' '||coalesce(v_after.moneda,'ARS')
               when v_status='waived' then 'eximida' else 'sin cargo' end,
        payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
          'room_no_show',true,'scope','room','release_date',v_release,
          'penalty_amount_gross',v_penalty_gross,'penalty_amount_net',v_penalty_net,'penalty_status',v_status
        )
    where id=v_event_id;
  else
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
    values(v_after.property_id,v_after.id,'group_room_no_show','No Show de habitación',
      'Hab. '||v_room_name||' no se presentó · habitación liberada',
      jsonb_build_object('room_no_show',true,'scope','room','room_id',p_room_id,'release_date',v_release,'penalty_amount_gross',v_penalty_gross,'penalty_status',v_status),
      auth.uid());
  end if;

  perform private.hl_sync_reservation_folios_internal(v_after.id);

  select f.id into v_room_folio
  from public.hotel_folios f
  where f.reservation_id=v_after.id and f.room_id=p_room_id and f.folio_type='room' and f.status<>'void'
  order by f.is_primary desc,f.sort_order,f.created_at
  limit 1;

  update public.hotel_folio_items i
  set status='void',updated_at=now()
  where i.reservation_id=v_after.id and i.room_id=p_room_id
    and i.source_type='lodging' and i.invoice_document_id is null
    and coalesce(i.metadata->>'auto_synced','false')='true';

  if v_room_folio is not null then
    update public.hotel_folio_items i
    set folio_id=v_room_folio,room_id=p_room_id,updated_at=now()
    where i.reservation_id=v_after.id and i.status='active' and i.invoice_document_id is null
      and i.source_key like 'service:room-cancel-'||p_room_id::text||'-%';
    update public.hotel_folios
    set label='Habitación '||v_room_name||' · No Show',updated_at=now()
    where id=v_room_folio;
  end if;

  perform private.hl_restore_manual_folio_assignments(v_after.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(v_after.id);

  select * into v_after from public.reservas where id=p_reserva_id;
  return v_after;
end
$function$
;

revoke all on function public.hl_mark_group_room_no_show_atomic(bigint,bigint,date,numeric,text,text) from public;
grant execute on function public.hl_mark_group_room_no_show_atomic(bigint,bigint,date,numeric,text,text) to authenticated;
