-- A cancelled reservation must stop carrying the unused stay as an active debt.
-- The current financial obligation becomes the cancellation penalty (if charged),
-- while the original contract remains preserved in the cancellation event payload.

create or replace function private.hl_keep_cancelled_autosync_items_void()
returns trigger
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_state text;
begin
  if new.invoice_document_id is not null then return new; end if;
  if coalesce(new.metadata->>'auto_synced','false') <> 'true' then return new; end if;
  if new.source_key = 'cancellation:penalty' then return new; end if;

  select lower(coalesce(r.estado,'')) into v_state
  from public.reservas r
  where r.id=new.reservation_id;

  if v_state='cancelada' then
    new.status:='void';
  end if;
  return new;
end;
$function$;

drop trigger if exists aa_hl_keep_cancelled_autosync_items_void on public.hotel_folio_items;
create trigger aa_hl_keep_cancelled_autosync_items_void
before insert or update on public.hotel_folio_items
for each row execute function private.hl_keep_cancelled_autosync_items_void();

create or replace function public.hl_cancel_reservation_policy_atomic(
  p_reserva_id bigint,
  p_penalty_status text default 'none'::text,
  p_note text default null::text
)
returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v public.reservas%rowtype;
  v_policy jsonb;
  v_rule jsonb:='{}'::jsonb;
  v_days integer:=0;
  v_type text:='none';
  v_value numeric:=0;
  v_penalty_gross numeric:=0;
  v_penalty_net numeric:=0;
  v_penalty_tax numeric:=0;
  v_obligation_gross numeric:=0;
  v_obligation_net numeric:=0;
  v_obligation_tax numeric:=0;
  v_paid numeric:=0;
  v_status text:=lower(coalesce(p_penalty_status,'none'));
  v_timezone text:='America/Argentina/Buenos_Aires';
  v_local_date date;
  v_vat_rate numeric:=0;
  v_discount_factor numeric:=1;
  v_penalty_folio uuid;
  v_original_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Tenés que iniciar sesión.';
  end if;

  select * into v from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para cancelar reservas.';
  end if;
  if v.estado='cancelada' then return v; end if;
  if v.estado in ('alojado','finalizada') or coalesce(v.no_show,false) then
    raise exception using errcode='P0001',message='Este estado no admite cancelación. Para un huésped alojado usá check-out; si no se presentó usá No Show.';
  end if;

  if exists(
    select 1 from public.hotel_finance_documents d
    where d.property_id=v.property_id and d.reservation_id=v.id and coalesce(d.total,0)>0
      and lower(coalesce(d.document_type,'')) not like '%proforma%'
      and lower(coalesce(d.document_type,'')) not like '%presupuesto%'
      and lower(coalesce(d.status,'')) not in ('draft','borrador','cancelled','canceled','cancelada','anulado','anulada','void')
      and (d.issued_at is not null or lower(coalesce(d.status,'')) in ('issued','emitida','emitido','sent','enviada','enviado','paid','pagada','pagado','final','fiscal'))
  ) then
    raise exception using errcode='P0001',message='La reserva tiene un comprobante emitido. Rectificá la facturación antes de cancelarla.';
  end if;

  select coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires')
  into v_timezone
  from public.property_settings where property_id=v.property_id;
  v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');
  begin
    v_local_date:=(now() at time zone v_timezone)::date;
  exception when others then
    v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
  end;

  -- Synchronize the ledger while the reservation is still active. This gives us
  -- the booked room-night values, including room-specific dates and VAT.
  perform private.hl_sync_reservation_folios_internal(v.id);

  v_policy:=coalesce(v.cancellation_policy_snapshot,'{}'::jsonb);
  v_days:=greatest(0,v.fecha_entrada-v_local_date);
  select x into v_rule
  from jsonb_array_elements(coalesce(v_policy->'cancellation_rules','[]'::jsonb)) x
  where v_days>=coalesce(nullif(x->>'min_days_before','')::integer,0)
  order by coalesce(nullif(x->>'min_days_before','')::integer,0) desc
  limit 1;
  v_rule:=coalesce(v_rule,'{"charge_type":"none","value":0}'::jsonb);
  v_type:=lower(coalesce(v_rule->>'charge_type','none'));
  v_value:=greatest(0,coalesce(nullif(v_rule->>'value','')::numeric,0));

  if v_type='nights' and v_value>0 then
    select coalesce(sum(
      case when coalesce(i.quantity,0)>0
        then (coalesce(i.total,0)/i.quantity)*least(v_value,i.quantity)
        else 0 end
    ),0)
    into v_penalty_gross
    from public.hotel_folio_items i
    where i.property_id=v.property_id
      and i.reservation_id=v.id
      and i.status='active'
      and i.source_type='lodging';

    -- Explicit reservation discounts are part of the booked rate. Preserve the
    -- same proportional discount when the policy charges one or more nights.
    if coalesce(v.subtotal,0)>0 and coalesce(v.descuento_importe,0)>0 then
      v_discount_factor:=greatest(0,least(1,(v.subtotal-v.descuento_importe)/v.subtotal));
      v_penalty_gross:=v_penalty_gross*v_discount_factor;
    end if;
  elsif v_type='percent' then
    v_penalty_gross:=coalesce(v.precio_total,0)*v_value/100;
  elsif v_type='fixed' then
    v_penalty_gross:=v_value;
  else
    v_penalty_gross:=0;
  end if;
  v_penalty_gross:=round(greatest(0,v_penalty_gross),2);

  if v_status not in ('none','charged','waived') then
    raise exception using errcode='22023',message='Estado de penalidad inválido.';
  end if;
  if v_penalty_gross<=0.01 then
    v_status:='none';
  elsif v_status='none' then
    raise exception using errcode='P0001',message='La política de cancelación prevé una penalidad de '||v_penalty_gross::text||' '||coalesce(v.moneda,'ARS')||'. Indicá si fue cobrada o eximida.';
  end if;

  if v_penalty_gross>0.01 and v_status='charged' then
    select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0)
    into v_paid
    from public.pagos p
    where p.property_id=v.property_id and p.reserva_id=v.id
      and lower(coalesce(p.estado,'')) not in ('void','anulado','anulada','cancelado','cancelada','cancelled','rejected','rechazado','rechazada');
    if v_paid+0.01<v_penalty_gross then
      raise exception using errcode='P0001',message='Primero registrá el cobro de la penalidad antes de cancelar la reserva.';
    end if;
  end if;

  v_vat_rate:=case when coalesce(v.impuestos_desglosados,false) then greatest(0,coalesce(v.iva_porcentaje,0)) else 0 end;
  if v_penalty_gross>0 and v_vat_rate>0 then
    v_penalty_net:=round(v_penalty_gross/(1+v_vat_rate/100),2);
    v_penalty_tax:=round(v_penalty_gross-v_penalty_net,2);
  else
    v_penalty_net:=v_penalty_gross;
    v_penalty_tax:=0;
  end if;

  if v_status='charged' then
    v_obligation_gross:=v_penalty_gross;
    v_obligation_net:=v_penalty_net;
    v_obligation_tax:=v_penalty_tax;
  else
    v_obligation_gross:=0;
    v_obligation_net:=0;
    v_obligation_tax:=0;
  end if;

  v_original_snapshot:=jsonb_build_object(
    'estado',v.estado,
    'fecha_entrada',v.fecha_entrada,
    'fecha_salida',v.fecha_salida,
    'noches',v.noches,
    'tarifa_noche',v.tarifa_noche,
    'subtotal',v.subtotal,
    'descuento_tipo',v.descuento_tipo,
    'descuento_valor',v.descuento_valor,
    'descuento_importe',v.descuento_importe,
    'precio_sin_impuestos_nacionales',v.precio_sin_impuestos_nacionales,
    'iva_porcentaje',v.iva_porcentaje,
    'iva_importe',v.iva_importe,
    'precio_total',v.precio_total,
    'habitacion_id',v.habitacion_id,
    'habitaciones_ids',to_jsonb(v.habitaciones_ids),
    'habitaciones_detalle',v.habitaciones_detalle
  );

  update public.hotel_finance_documents
  set status='void',adjustment_reason=coalesce(adjustment_reason,'Reserva cancelada antes de emitir el borrador.'),updated_at=now()
  where property_id=v.property_id and reservation_id=v.id
    and lower(coalesce(status,'')) in ('draft','borrador')
    and issued_at is null;

  update public.reservas
  set estado='cancelada',
      cancelled_at=now(),
      cancellation_penalty_amount=v_penalty_gross,
      cancellation_penalty_status=v_status,
      cancellation_note=nullif(trim(coalesce(p_note,'')),''),
      subtotal=v_obligation_net,
      precio_sin_impuestos_nacionales=v_obligation_net,
      iva_importe=v_obligation_tax,
      precio_total=v_obligation_gross,
      precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_obligation_gross/tipo_cambio,2) else precio_total_usd end,
      descuento_tipo='none',
      descuento_valor=0,
      descuento_importe=0,
      descuento_motivo=null,
      descuento_origen=null
  where id=v.id
  returning * into v;

  -- Existing auto-synced lodging/services are forced to void by the trigger once
  -- the reservation is cancelled. This sync also makes repeated future ensures safe.
  perform private.hl_sync_reservation_folios_internal(v.id);

  select f.id into v_penalty_folio
  from public.hotel_folios f
  where f.reservation_id=v.id and f.status<>'void'
  order by case when f.folio_type='master' then 0 when f.is_primary then 1 when f.folio_type='room' then 2 else 3 end,
           f.sort_order,f.created_at
  limit 1;

  if v_penalty_gross>0 and v_status='charged' then
    if v_penalty_folio is null then
      insert into public.hotel_folios(property_id,reservation_id,room_id,folio_type,label,payer_type,payer_name,currency,status,is_primary,sort_order)
      values(v.property_id,v.id,v.habitacion_id,'guest','Penalidad de cancelación','guest',v.nombre_huesped,v.moneda,'open',true,1)
      returning id into v_penalty_folio;
    end if;

    insert into public.hotel_folio_items(
      property_id,folio_id,reservation_id,room_id,source_type,source_key,description,detail,
      service_date,quantity,unit_price,discount,tax_rate,tax,subtotal,total,currency,status,metadata
    ) values(
      v.property_id,v_penalty_folio,v.id,null,'fee','cancellation:penalty','Penalidad por cancelación',
      'Política '||coalesce(v_policy->>'name',v_policy->>'code','de cancelación')||' · '||
        case when v_type='nights' then trim(to_char(v_value,'FM999999990.##'))||' noche(s)'
             when v_type='percent' then trim(to_char(v_value,'FM999999990.##'))||'%'
             when v_type='fixed' then 'importe fijo'
             else 'sin cargo' end,
      v_local_date,1,v_penalty_net,0,v_vat_rate,v_penalty_tax,v_penalty_net,v_penalty_gross,
      coalesce(v.moneda,'ARS'),'active',jsonb_build_object(
        'auto_synced',false,
        'cancellation_penalty',true,
        'charge_type',v_type,
        'rule_value',v_value,
        'gross_amount',v_penalty_gross,
        'net_amount',v_penalty_net,
        'tax_amount',v_penalty_tax,
        'policy',v_policy
      )
    )
    on conflict (reservation_id,source_key) where source_key is not null do update
    set folio_id=excluded.folio_id,room_id=excluded.room_id,description=excluded.description,detail=excluded.detail,
        service_date=excluded.service_date,quantity=excluded.quantity,unit_price=excluded.unit_price,tax_rate=excluded.tax_rate,
        tax=excluded.tax,subtotal=excluded.subtotal,total=excluded.total,currency=excluded.currency,status='active',
        metadata=excluded.metadata,updated_at=now()
    where public.hotel_folio_items.invoice_document_id is null;
  else
    update public.hotel_folio_items
    set status='void',updated_at=now()
    where reservation_id=v.id and source_key='cancellation:penalty' and invoice_document_id is null;
  end if;

  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(
    v.property_id,v.id,'cancellation','Reserva cancelada',
    case when v_penalty_gross>0 then
      case when v_status='waived' then 'Cancelación procesada. La penalidad prevista por política fue eximida.'
           else 'Cancelación procesada con penalidad según la política asignada.' end
    else 'Cancelación procesada sin cargo según la política asignada.' end,
    jsonb_build_object(
      'cancellation_policy',v_policy,
      'days_before',v_days,
      'rule',v_rule,
      'penalty_amount',v_penalty_gross,
      'penalty_net',v_penalty_net,
      'penalty_tax',v_penalty_tax,
      'penalty_status',v_status,
      'note',p_note,
      'original_contract',v_original_snapshot
    ),auth.uid()
  );
  return v;
end;
$function$;
