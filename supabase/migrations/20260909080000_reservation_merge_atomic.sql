alter table public.reservas
  add column if not exists merged_into_id bigint references public.reservas(id) on delete set null,
  add column if not exists merged_at timestamptz,
  add column if not exists merged_by uuid,
  add column if not exists merge_note text,
  add column if not exists merge_snapshot jsonb;

create index if not exists reservas_merged_into_idx on public.reservas(property_id, merged_into_id) where merged_into_id is not null;

create or replace function public.hl_merge_reservations_atomic(p_primary_id bigint, p_secondary_id bigint)
returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_primary public.reservas%rowtype;
  v_secondary public.reservas%rowtype;
  v_after public.reservas%rowtype;
  v_primary_ids bigint[];
  v_secondary_ids bigint[];
  v_all_ids bigint[];
  v_primary_details jsonb;
  v_secondary_details jsonb;
  v_target_folio uuid;
  v_secondary_folios uuid[];
  v_note text;
  v_new_start date;
  v_new_end date;
  v_discount numeric;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Tenés que iniciar sesión.';
  end if;
  if p_primary_id is null or p_secondary_id is null or p_primary_id=p_secondary_id then
    raise exception using errcode='22023',message='Elegí dos reservas distintas para fusionar.';
  end if;

  select * into v_primary from public.reservas where id=p_primary_id for update;
  if not found then raise exception using errcode='P0002',message='No encontramos la reserva principal.'; end if;
  select * into v_secondary from public.reservas where id=p_secondary_id for update;
  if not found then raise exception using errcode='P0002',message='No encontramos la reserva a fusionar.'; end if;

  if v_primary.property_id<>v_secondary.property_id then
    raise exception using errcode='22023',message='Las reservas deben pertenecer al mismo alojamiento.';
  end if;
  if not private.user_has_property_role(v_primary.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para fusionar reservas.';
  end if;
  if v_primary.merged_into_id is not null or v_primary.estado in('cancelada','fusionada') or coalesce(v_primary.no_show,false) then
    raise exception using errcode='P0001',message='La reserva principal no está disponible para una fusión.';
  end if;
  if v_secondary.merged_into_id is not null or v_secondary.estado in('cancelada','fusionada') or coalesce(v_secondary.no_show,false) then
    raise exception using errcode='P0001',message='La reserva seleccionada ya no está disponible para fusionar.';
  end if;
  if v_primary.estado='finalizada' or v_secondary.estado='finalizada' then
    raise exception using errcode='P0001',message='No se pueden fusionar reservas finalizadas.';
  end if;
  if coalesce(v_primary.moneda,'ARS')<>coalesce(v_secondary.moneda,'ARS') then
    raise exception using errcode='22023',message='Para fusionar, las dos reservas deben estar expresadas en la misma moneda.';
  end if;

  if exists(
    select 1 from public.hotel_finance_documents d
    where d.property_id=v_primary.property_id
      and d.reservation_id in(v_primary.id,v_secondary.id)
      and coalesce(d.total,0)>0
      and lower(coalesce(d.document_type,'')) not like '%proforma%'
      and lower(coalesce(d.document_type,'')) not like '%presupuesto%'
      and lower(coalesce(d.status,'')) not in('draft','borrador','cancelled','canceled','cancelada','anulado','anulada','void')
      and (d.issued_at is not null or lower(coalesce(d.status,'')) in('issued','emitida','emitido','sent','enviada','enviado','paid','pagada','pagado','final','fiscal'))
  ) then
    raise exception using errcode='P0001',message='Una de las reservas tiene un comprobante emitido. Rectificá ese comprobante antes de fusionar.';
  end if;

  select coalesce(array_agg(distinct x order by x),'{}'::bigint[]) into v_primary_ids
  from unnest(coalesce(v_primary.habitaciones_ids,'{}'::bigint[])||array[v_primary.habitacion_id]) x where x is not null;
  select coalesce(array_agg(distinct x order by x),'{}'::bigint[]) into v_secondary_ids
  from unnest(coalesce(v_secondary.habitaciones_ids,'{}'::bigint[])||array[v_secondary.habitacion_id]) x where x is not null;

  if exists(select 1 from unnest(v_primary_ids) p(id) join unnest(v_secondary_ids) s(id) using(id)) then
    raise exception using errcode='22023',message='Las reservas comparten una misma habitación física. Para evitar duplicar segmentos, separá o reasigná esa habitación antes de fusionar.';
  end if;
  select coalesce(array_agg(distinct x order by x),'{}'::bigint[]) into v_all_ids from unnest(v_primary_ids||v_secondary_ids) x;

  v_primary_details:=coalesce(v_primary.habitaciones_detalle,'[]'::jsonb);
  if jsonb_array_length(v_primary_details)=0 and v_primary.habitacion_id is not null then
    v_primary_details:=jsonb_build_array(jsonb_build_object(
      'habitacion_id',v_primary.habitacion_id,
      'nombre',(select nombre from public.habitaciones where id=v_primary.habitacion_id),
      'categoria_asignada',(select coalesce(tipo,'Habitación') from public.habitaciones where id=v_primary.habitacion_id),
      'categoria_vendida',(select coalesce(tipo,'Habitación') from public.habitaciones where id=v_primary.habitacion_id),
      'huespedes',greatest(1,coalesce(v_primary.cantidad_huespedes,1)),
      'tarifa_noche',coalesce(v_primary.tarifa_noche,0),
      'fecha_entrada',v_primary.fecha_entrada,
      'fecha_salida',v_primary.fecha_salida,
      'titular_nombre',v_primary.nombre_huesped,
      'titular_email',v_primary.email_huesped,
      'titular_telefono',v_primary.telefono_huesped,
      'rooming',jsonb_build_object('matrimonial',0,'individual',0)
    ));
  end if;

  v_secondary_details:=coalesce(v_secondary.habitaciones_detalle,'[]'::jsonb);
  if jsonb_array_length(v_secondary_details)=0 and v_secondary.habitacion_id is not null then
    v_secondary_details:=jsonb_build_array(jsonb_build_object(
      'habitacion_id',v_secondary.habitacion_id,
      'nombre',(select nombre from public.habitaciones where id=v_secondary.habitacion_id),
      'categoria_asignada',(select coalesce(tipo,'Habitación') from public.habitaciones where id=v_secondary.habitacion_id),
      'categoria_vendida',(select coalesce(tipo,'Habitación') from public.habitaciones where id=v_secondary.habitacion_id),
      'huespedes',greatest(1,coalesce(v_secondary.cantidad_huespedes,1)),
      'tarifa_noche',coalesce(v_secondary.tarifa_noche,0),
      'fecha_entrada',v_secondary.fecha_entrada,
      'fecha_salida',v_secondary.fecha_salida,
      'titular_nombre',v_secondary.nombre_huesped,
      'titular_email',v_secondary.email_huesped,
      'titular_telefono',v_secondary.telefono_huesped,
      'rooming',jsonb_build_object('matrimonial',0,'individual',0)
    ));
  end if;

  v_new_start:=least(v_primary.fecha_entrada,v_secondary.fecha_entrada);
  v_new_end:=greatest(v_primary.fecha_salida,v_secondary.fecha_salida);
  v_discount:=greatest(0,coalesce(v_primary.descuento_importe,0))+greatest(0,coalesce(v_secondary.descuento_importe,0));
  v_note:=concat_ws(E'\n',nullif(trim(coalesce(v_primary.notas,'')),''),
    case when nullif(trim(coalesce(v_secondary.notas,'')),'') is not null
      then format('Fusionada desde reserva %s (%s): %s',coalesce(v_secondary.numero_reserva,v_secondary.id::text),v_secondary.nombre_huesped,v_secondary.notas)
      else format('Fusionada desde reserva %s (%s).',coalesce(v_secondary.numero_reserva,v_secondary.id::text),v_secondary.nombre_huesped)
    end);

  perform private.hl_sync_reservation_folios_internal(v_primary.id);
  perform private.hl_sync_reservation_folios_internal(v_secondary.id);
  select id into v_target_folio from public.hotel_folios
    where property_id=v_primary.property_id and reservation_id=v_primary.id
    order by is_primary desc,(folio_type='master') desc,sort_order,created_at limit 1;
  select coalesce(array_agg(id),'{}'::uuid[]) into v_secondary_folios
    from public.hotel_folios where property_id=v_primary.property_id and reservation_id=v_secondary.id;

  if v_target_folio is not null then
    update public.hotel_folio_items set reservation_id=v_primary.id,folio_id=v_target_folio,updated_at=now()
      where property_id=v_primary.property_id and reservation_id=v_secondary.id;
    update public.hotel_folio_payment_allocations set reservation_id=v_primary.id,folio_id=v_target_folio,updated_at=now()
      where property_id=v_primary.property_id and reservation_id=v_secondary.id;
    update public.hotel_folio_item_payment_allocations set reservation_id=v_primary.id,folio_id=v_target_folio
      where property_id=v_primary.property_id and reservation_id=v_secondary.id;
    update public.pagos set reserva_id=v_primary.id,folio_id=v_target_folio,updated_at=now()
      where property_id=v_primary.property_id and reserva_id=v_secondary.id;
    update public.hotel_finance_documents set reservation_id=v_primary.id,folio_id=v_target_folio,updated_at=now()
      where property_id=v_primary.property_id and reservation_id=v_secondary.id;
    delete from public.hotel_folios where property_id=v_primary.property_id and reservation_id=v_secondary.id;
  else
    update public.pagos set reserva_id=v_primary.id,updated_at=now()
      where property_id=v_primary.property_id and reserva_id=v_secondary.id;
  end if;

  update public.hotel_reservation_guests set role='companion'
    where property_id=v_primary.property_id and reservation_id=v_secondary.id and role='primary';
  update public.hotel_reservation_guests set reservation_id=v_primary.id,sort_order=sort_order+1000,updated_at=now()
    where property_id=v_primary.property_id and reservation_id=v_secondary.id;
  update public.hotel_guest_requests set reservation_id=v_primary.id,updated_at=now()
    where property_id=v_primary.property_id and reservation_id=v_secondary.id;
  update public.hotel_reservation_messages set reservation_id=v_primary.id
    where property_id=v_primary.property_id and reservation_id=v_secondary.id;
  update public.inbox_conversations set reservation_id=v_primary.id,context_link_source='reservation_merge',context_linked_at=now(),updated_at=now()
    where property_id=v_primary.property_id and reservation_id=v_secondary.id;
  update public.hotel_reservation_documents set reserva_id=v_primary.id
    where property_id=v_primary.property_id and reserva_id=v_secondary.id;

  update public.reservas set
    habitaciones_ids=v_all_ids,
    habitaciones_detalle=v_primary_details||v_secondary_details,
    fecha_entrada=v_new_start,
    fecha_salida=v_new_end,
    noches=greatest(1,v_new_end-v_new_start),
    cantidad_huespedes=greatest(1,coalesce(v_primary.cantidad_huespedes,1))+greatest(1,coalesce(v_secondary.cantidad_huespedes,1)),
    tarifa_noche=greatest(0,coalesce(v_primary.tarifa_noche,0))+greatest(0,coalesce(v_secondary.tarifa_noche,0)),
    subtotal=greatest(0,coalesce(v_primary.subtotal,0))+greatest(0,coalesce(v_secondary.subtotal,0)),
    precio_sin_impuestos_nacionales=greatest(0,coalesce(v_primary.precio_sin_impuestos_nacionales,0))+greatest(0,coalesce(v_secondary.precio_sin_impuestos_nacionales,0)),
    iva_importe=greatest(0,coalesce(v_primary.iva_importe,0))+greatest(0,coalesce(v_secondary.iva_importe,0)),
    precio_total=greatest(0,coalesce(v_primary.precio_total,0))+greatest(0,coalesce(v_secondary.precio_total,0)),
    precio_total_usd=greatest(0,coalesce(v_primary.precio_total_usd,0))+greatest(0,coalesce(v_secondary.precio_total_usd,0)),
    cochera_total=greatest(0,coalesce(v_primary.cochera_total,0))+greatest(0,coalesce(v_secondary.cochera_total,0)),
    mascotas_total=greatest(0,coalesce(v_primary.mascotas_total,0))+greatest(0,coalesce(v_secondary.mascotas_total,0)),
    extra=greatest(0,coalesce(v_primary.extra,0))+greatest(0,coalesce(v_secondary.extra,0)),
    early_checkin_importe=greatest(0,coalesce(v_primary.early_checkin_importe,0))+greatest(0,coalesce(v_secondary.early_checkin_importe,0)),
    late_checkout_importe=greatest(0,coalesce(v_primary.late_checkout_importe,0))+greatest(0,coalesce(v_secondary.late_checkout_importe,0)),
    descuento_tipo=case when v_discount>0 then 'amount' else 'none' end,
    descuento_valor=v_discount,
    descuento_importe=v_discount,
    descuento_motivo=case when v_discount>0 then 'Descuentos consolidados al fusionar reservas' else null end,
    descuento_origen=case when v_discount>0 then 'manual' else null end,
    pasajeros=coalesce(v_primary.pasajeros,'[]'::jsonb)||coalesce(v_secondary.pasajeros,'[]'::jsonb),
    servicios=coalesce(v_primary.servicios,'[]'::jsonb)||coalesce(v_secondary.servicios,'[]'::jsonb),
    mascotas=coalesce(v_primary.mascotas,'[]'::jsonb)||coalesce(v_secondary.mascotas,'[]'::jsonb),
    notas=v_note
  where id=v_primary.id returning * into v_after;

  update public.reservas set
    estado='fusionada',
    no_show=false,
    merged_into_id=v_primary.id,
    merged_at=now(),
    merged_by=auth.uid(),
    merge_note=format('Fusionada en la reserva %s',coalesce(v_primary.numero_reserva,v_primary.id::text)),
    merge_snapshot=to_jsonb(v_secondary),
    habitacion_id=null,
    habitaciones_ids='{}'::bigint[],
    habitaciones_detalle='[]'::jsonb,
    cantidad_huespedes=0,
    tarifa_noche=0,
    subtotal=0,
    precio_sin_impuestos_nacionales=0,
    iva_importe=0,
    precio_total=0,
    precio_total_usd=0,
    cochera_total=0,
    mascotas_total=0,
    extra=0,
    early_checkin_importe=0,
    late_checkout_importe=0,
    descuento_tipo='none',
    descuento_valor=0,
    descuento_importe=0,
    descuento_motivo=null,
    descuento_origen=null
  where id=v_secondary.id;

  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(v_primary.property_id,v_primary.id,'reservation_merge','Reservas fusionadas',
    format('La reserva %s de %s fue fusionada dentro de esta reserva.',coalesce(v_secondary.numero_reserva,v_secondary.id::text),v_secondary.nombre_huesped),
    jsonb_build_object('primary_reservation_id',v_primary.id,'secondary_reservation_id',v_secondary.id,'secondary_reservation_number',v_secondary.numero_reserva,'secondary_guest',v_secondary.nombre_huesped),auth.uid());

  return v_after;
end;
$function$;

revoke all on function public.hl_merge_reservations_atomic(bigint,bigint) from public;
grant execute on function public.hl_merge_reservations_atomic(bigint,bigint) to authenticated;
