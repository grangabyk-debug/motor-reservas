-- Public self-service cancellation must use gross commercial amounts and must
-- clear the unused stay from the financial obligation when cancellation is free.
-- This prevents a second cancellation path from reintroducing the old net/gross bug.

create or replace function private.hl_cancellation_penalty_quote(
  p_reservation_id bigint,
  p_as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  r public.reservas%rowtype;
  v_policy jsonb;
  v_rule jsonb:='{}'::jsonb;
  v_days integer:=0;
  v_type text:='none';
  v_value numeric:=0;
  v_gross numeric:=0;
  v_net numeric:=0;
  v_tax numeric:=0;
  v_vat numeric:=0;
  v_discount_factor numeric:=1;
begin
  select * into r from public.reservas where id=p_reservation_id;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;

  v_policy:=coalesce(r.cancellation_policy_snapshot,'{}'::jsonb);
  v_days:=greatest(0,r.fecha_entrada-coalesce(p_as_of,current_date));
  select x into v_rule
  from jsonb_array_elements(coalesce(v_policy->'cancellation_rules','[]'::jsonb)) x
  where v_days>=coalesce(nullif(x->>'min_days_before','')::integer,0)
  order by coalesce(nullif(x->>'min_days_before','')::integer,0) desc
  limit 1;
  v_rule:=coalesce(v_rule,'{"charge_type":"none","value":0}'::jsonb);
  v_type:=lower(coalesce(v_rule->>'charge_type','none'));
  v_value:=greatest(0,coalesce(nullif(v_rule->>'value','')::numeric,0));

  if v_type='nights' and v_value>0 then
    -- Folios are the canonical room-night ledger. Synchronize before quoting so
    -- group rooms, moved rooms and room-specific dates share the same source.
    perform private.hl_sync_reservation_folios_internal(r.id);
    select coalesce(sum(
      case when coalesce(i.quantity,0)>0
        then (coalesce(i.total,0)/i.quantity)*least(v_value,i.quantity)
        else 0 end
    ),0)
    into v_gross
    from public.hotel_folio_items i
    where i.property_id=r.property_id and i.reservation_id=r.id
      and i.status='active' and i.source_type='lodging';

    if coalesce(r.subtotal,0)>0 and coalesce(r.descuento_importe,0)>0 then
      v_discount_factor:=greatest(0,least(1,(r.subtotal-r.descuento_importe)/r.subtotal));
      v_gross:=v_gross*v_discount_factor;
    end if;
  elsif v_type='percent' then
    v_gross:=coalesce(r.precio_total,0)*v_value/100;
  elsif v_type='fixed' then
    v_gross:=v_value;
  else
    v_gross:=0;
  end if;

  v_gross:=round(greatest(0,v_gross),2);
  v_vat:=case when coalesce(r.impuestos_desglosados,false) then greatest(0,coalesce(r.iva_porcentaje,0)) else 0 end;
  if v_gross>0 and v_vat>0 then
    v_net:=round(v_gross/(1+v_vat/100),2);
    v_tax:=round(v_gross-v_net,2);
  else
    v_net:=v_gross;
    v_tax:=0;
  end if;

  return jsonb_build_object(
    'days_before',v_days,
    'rule',v_rule,
    'charge_type',v_type,
    'rule_value',v_value,
    'gross',v_gross,
    'net',v_net,
    'tax',v_tax,
    'currency',coalesce(r.moneda,'ARS')
  );
end;
$function$;

create or replace function public.hl_public_booking_manage(
  p_slug text,
  p_token uuid,
  p_action text default 'view'::text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  e public.hotel_booking_engines%rowtype;
  req public.hotel_public_booking_requests%rowtype;
  r public.reservas%rowtype;
  v_action text:=lower(coalesce(p_action,'view'));
  v_can_cancel boolean;
  v_request_id uuid;
  v_detail text;
  v_policy jsonb;
  v_quote jsonb;
  v_days_before integer:=0;
  v_rule jsonb:='{}'::jsonb;
  v_penalty numeric:=0;
  v_timezone text:='America/Argentina/Buenos_Aires';
  v_local_date date;
  v_original jsonb;
begin
  select * into e from public.hotel_booking_engines where slug=lower(trim(p_slug)) and enabled=true;
  if not found then raise exception 'Motor no disponible'; end if;
  select q.* into req from public.hotel_public_booking_requests q where q.engine_id=e.id and q.manage_token=p_token;
  if not found then raise exception 'Enlace de gestión inválido'; end if;
  select * into r from public.reservas where id=req.reservation_id and property_id=e.property_id;
  if not found then raise exception 'Reserva no encontrada'; end if;

  select coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires') into v_timezone
  from public.property_settings where property_id=e.property_id;
  v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');
  begin v_local_date:=(now() at time zone v_timezone)::date;
  exception when others then v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date; end;

  v_policy:=coalesce(r.cancellation_policy_snapshot,'{}'::jsonb);
  v_quote:=private.hl_cancellation_penalty_quote(r.id,v_local_date);
  v_days_before:=coalesce(nullif(v_quote->>'days_before','')::integer,0);
  v_rule:=coalesce(v_quote->'rule','{}'::jsonb);
  v_penalty:=greatest(0,coalesce(nullif(v_quote->>'gross','')::numeric,0));

  v_can_cancel:=e.allow_self_cancel
    and lower(coalesce(r.estado,'')) in ('confirmada','pendiente','reservada')
    and r.fecha_entrada::timestamp >= now()+make_interval(hours=>e.self_cancel_cutoff_hours)
    and coalesce(v_policy->>'policy_type','flexible')<>'non_refundable'
    and v_penalty<=0.01;

  if v_action='cancel' then
    if not v_can_cancel then raise exception 'La cancelación online requiere intervención del hotel según la política de esta reserva'; end if;
    if exists(
      select 1 from public.hotel_finance_documents d
      where d.property_id=r.property_id and d.reservation_id=r.id and coalesce(d.total,0)>0
        and lower(coalesce(d.status,'')) not in ('draft','borrador','cancelled','canceled','cancelada','anulado','anulada','void')
        and (d.issued_at is not null or lower(coalesce(d.status,'')) in ('issued','emitida','emitido','sent','enviada','enviado','paid','pagada','pagado','final','fiscal'))
    ) then raise exception 'La reserva tiene un comprobante emitido y la cancelación requiere intervención del hotel'; end if;

    v_original:=jsonb_build_object(
      'estado',r.estado,'fecha_entrada',r.fecha_entrada,'fecha_salida',r.fecha_salida,'noches',r.noches,
      'tarifa_noche',r.tarifa_noche,'subtotal',r.subtotal,'descuento_tipo',r.descuento_tipo,
      'descuento_valor',r.descuento_valor,'descuento_importe',r.descuento_importe,
      'precio_sin_impuestos_nacionales',r.precio_sin_impuestos_nacionales,'iva_porcentaje',r.iva_porcentaje,
      'iva_importe',r.iva_importe,'precio_total',r.precio_total,'habitacion_id',r.habitacion_id,
      'habitaciones_ids',to_jsonb(r.habitaciones_ids),'habitaciones_detalle',r.habitaciones_detalle
    );

    update public.hotel_finance_documents
    set status='void',adjustment_reason=coalesce(adjustment_reason,'Reserva cancelada por el huésped antes de emitir el borrador.'),updated_at=now()
    where property_id=r.property_id and reservation_id=r.id
      and lower(coalesce(status,'')) in ('draft','borrador') and issued_at is null;

    update public.reservas set
      estado='cancelada',cancelled_at=now(),
      cancellation_penalty_amount=0,cancellation_penalty_status='none',
      cancellation_note='Cancelada por el huésped desde el portal web.',
      subtotal=0,precio_sin_impuestos_nacionales=0,iva_importe=0,precio_total=0,
      precio_total_usd=0,descuento_tipo='none',descuento_valor=0,descuento_importe=0,
      descuento_motivo=null,descuento_origen=null,
      notas=concat_ws(E'\n',nullif(notas,''),'Cancelada por el huésped desde el portal web.')
    where id=r.id returning * into r;

    perform private.hl_sync_reservation_folios_internal(r.id);

    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_name)
    values(r.property_id,r.id,'guest_self_cancel','Reserva cancelada por el huésped','Cancelación realizada desde el enlace privado del motor.',jsonb_build_object('source','guest_portal','cutoff_hours',e.self_cancel_cutoff_hours,'cancellation_policy',v_policy,'penalty_amount',0,'penalty_rule',v_rule,'original_contract',v_original),'Huésped');
    v_can_cancel:=false;
  elsif v_action='request_change' then
    v_detail:=left(trim(coalesce(p_payload->>'detail','')),1200);
    if v_detail='' then raise exception 'Contanos qué cambio necesitás'; end if;
    insert into public.hotel_guest_requests(property_id,reservation_id,room_id,title,detail,status,priority,requested_by)
    values(r.property_id,r.id,r.habitacion_id,'Solicitud de modificación de reserva',v_detail,'open','normal','guest') returning id into v_request_id;
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_name)
    values(r.property_id,r.id,'guest_change_request','Huésped solicitó un cambio',v_detail,jsonb_build_object('guest_request_id',v_request_id,'source','guest_portal'),'Huésped');
  elsif v_action<>'view' then
    raise exception 'Acción no soportada';
  end if;

  return jsonb_build_object(
    'reservation',jsonb_build_object('id',r.id,'numero_reserva',r.numero_reserva,'name',r.nombre_huesped,'status',r.estado,'check_in',r.fecha_entrada,'check_out',r.fecha_salida,'nights',r.noches,'room_type',coalesce((r.habitaciones_detalle->0->>'categoria_vendida'),(r.habitaciones_detalle->0->>'tipo'),'Habitación'),'total',r.precio_total,'currency',r.moneda,'cancellation_policy',v_policy),
    'hotel',jsonb_build_object('name',coalesce(nullif(e.display_name,''),(select name from public.properties where id=e.property_id)),'contact_phone',e.contact_phone,'contact_email',e.contact_email,'cancellation_policy',coalesce(v_policy->>'description',e.cancellation_policy)),
    'can_cancel',v_can_cancel,'cancel_cutoff_hours',e.self_cancel_cutoff_hours,
    'cancellation_penalty_amount',round(v_penalty,2),'cancellation_penalty_rule',v_rule,'request_id',v_request_id
  );
end;
$function$;
