-- Sincroniza huéspedes con movimientos/fusiones y bloquea check-in por habitación antes de su fecha real.
CREATE OR REPLACE FUNCTION public.hl_move_reservation_atomic(p_reserva_id bigint, p_habitacion_id bigint, p_fecha_entrada date, p_fecha_salida date DEFAULT NULL::date)
 RETURNS reservas
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_reserva public.reservas%rowtype; v_habitacion public.habitaciones%rowtype; v_old_room_id bigint; v_old_start date; v_old_end date; v_salida date; v_span integer; v_nights integer; v_units integer; v_subtotal numeric; v_descuento numeric; v_total numeric; v_ops jsonb:='{}'::jsonb; v_arrival time; v_departure time; v_cutoff time; v_business_date date; v_start timestamp; v_end timestamp;
begin
  select * into v_reserva from public.reservas where id=p_reserva_id for update; if not found then raise exception 'Reserva inexistente' using errcode='P0002'; end if; if v_reserva.estado='cancelada' then raise exception 'La reserva no se puede mover'; end if; v_old_room_id:=v_reserva.habitacion_id; v_old_start:=v_reserva.fecha_entrada; v_old_end:=v_reserva.fecha_salida;
  select * into v_habitacion from public.habitaciones where id=p_habitacion_id and property_id=v_reserva.property_id and activa is distinct from false; if not found then raise exception 'Habitación no disponible'; end if; if lower(coalesce(v_habitacion.estado,'')) in ('mantenimiento','fuera_servicio') then raise exception 'Habitación fuera de servicio'; end if;
  v_span:=greatest(0,v_reserva.fecha_salida-v_reserva.fecha_entrada); v_salida:=coalesce(p_fecha_salida,p_fecha_entrada+v_span); if v_salida<p_fecha_entrada then raise exception 'La salida no puede ser anterior a la entrada'; end if;
  select coalesce(operational_settings,'{}'::jsonb) into v_ops from public.hotel_os_settings where property_id=v_reserva.property_id; v_ops:=coalesce(v_ops,'{}'::jsonb); v_arrival:=private.hl_safe_time(v_reserva.hora_llegada_estimada,private.hl_safe_time(v_ops->>'checkin_time','14:00'::time)); v_departure:=private.hl_safe_time(v_reserva.hora_salida_estimada,private.hl_safe_time(v_ops->>'checkout_time','10:00'::time)); v_cutoff:=private.hl_safe_time(v_ops->>'business_day_cutoff','05:00'::time); v_start:=p_fecha_entrada::timestamp+v_arrival; v_end:=v_salida::timestamp+v_departure; if v_end<=v_start then raise exception 'La hora de salida debe ser posterior a la hora de entrada'; end if; if coalesce(v_reserva.tipo_estadia,'overnight')='day_use' and v_salida<>p_fecha_entrada then raise exception 'Day Use debe comenzar y terminar el mismo día'; end if; v_business_date:=case when coalesce(v_reserva.tipo_estadia,'overnight')='overnight' and v_arrival<v_cutoff then p_fecha_entrada-1 else p_fecha_entrada end; v_nights:=case when coalesce(v_reserva.tipo_estadia,'overnight')='day_use' then 0 else greatest(1,v_salida-v_business_date) end; v_units:=case when coalesce(v_reserva.tipo_estadia,'overnight')='day_use' then 1 else v_nights end;

  perform private.hl_prepare_checkout_maintenance_ack(p_reserva_id,p_habitacion_id,v_salida);

  if exists(
    select 1 from public.bloqueos b
    where b.habitacion_id=p_habitacion_id
      and b.property_id=v_reserva.property_id
      and tsrange(b.fecha_desde::timestamp,b.fecha_hasta::timestamp,'[)') && tsrange(v_start,v_end,'[)')
      and not (b.fecha_desde=v_salida and lower(trim(coalesce(b.motivo,''))) like 'manten%' and coalesce(v_reserva.late_checkout,false)=false)
  ) then raise exception 'La habitación está bloqueada durante ese horario' using errcode='23P01'; end if;
  if exists(select 1 from public.reservas r where r.id<>v_reserva.id and r.property_id=v_reserva.property_id and r.estado<>'cancelada' and coalesce(r.no_show,false)=false and (r.habitacion_id=p_habitacion_id or p_habitacion_id=any(coalesce(r.habitaciones_ids,array[]::bigint[]))) and tsrange(coalesce(r.ocupacion_desde_local,r.fecha_entrada::timestamp+private.hl_safe_time(r.hora_llegada_estimada,'14:00'::time)),coalesce(r.ocupacion_hasta_local,r.fecha_salida::timestamp+private.hl_safe_time(r.hora_salida_estimada,'10:00'::time)),'[)') && tsrange(v_start,v_end,'[)')) then raise exception 'La habitación ya tiene una reserva durante parte de ese horario' using errcode='23P01'; end if;
  v_subtotal:=greatest(0,coalesce(v_reserva.tarifa_noche,0)*v_units+coalesce(v_reserva.cochera_total,0)+coalesce(v_reserva.extra,0)+coalesce(v_reserva.early_checkin_importe,0)+coalesce(v_reserva.late_checkout_importe,0)); v_descuento:=case when v_reserva.descuento_tipo='porcentaje' then v_subtotal*coalesce(v_reserva.descuento_valor,0)/100 else coalesce(v_reserva.descuento_importe,v_reserva.descuento_valor,0) end; v_total:=greatest(0,v_subtotal-v_descuento);
  update public.reservas set habitacion_id=p_habitacion_id,alojamiento_id=coalesce(v_habitacion.alojamiento_id,alojamiento_id),fecha_entrada=p_fecha_entrada,fecha_salida=v_salida,noches=v_nights,subtotal=v_subtotal,descuento_importe=v_descuento,precio_total=v_total,precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end,habitaciones_ids=case when habitaciones_ids is null or cardinality(habitaciones_ids)=0 then array[p_habitacion_id] when v_reserva.habitacion_id=any(habitaciones_ids) then array_replace(habitaciones_ids,v_reserva.habitacion_id,p_habitacion_id) else habitaciones_ids end,habitaciones_detalle=case when jsonb_typeof(habitaciones_detalle)='array' then (select coalesce(jsonb_agg(case when nullif(elem->>'habitacion_id','')::bigint=v_reserva.habitacion_id then elem || jsonb_build_object('habitacion_id',p_habitacion_id,'nombre',v_habitacion.nombre,'categoria_asignada',coalesce(nullif(trim(v_habitacion.tipo),''),'Habitación'),'noches',v_nights) else elem end),'[]'::jsonb) from jsonb_array_elements(habitaciones_detalle) elem) else habitaciones_detalle end where id=v_reserva.id returning * into v_reserva;
  update public.hotel_reservation_guests
  set room_id=case when room_id is null or room_id=v_old_room_id then p_habitacion_id else room_id end,
      stay_from=case when stay_from is null or stay_from=v_old_start or stay_from<v_reserva.fecha_entrada or stay_from>=v_reserva.fecha_salida then v_reserva.fecha_entrada else stay_from end,
      stay_to=case when stay_to is null or stay_to=v_old_end or stay_to<=v_reserva.fecha_entrada or stay_to>v_reserva.fecha_salida then v_reserva.fecha_salida else stay_to end,
      updated_at=now()
  where property_id=v_reserva.property_id
    and reservation_id=v_reserva.id
    and checked_out_at is null
    and (room_id is null or room_id=v_old_room_id);
  return v_reserva;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hl_merge_reservations_atomic_impl_v1(p_primary_id bigint, p_secondary_id bigint)
 RETURNS reservas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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

  v_primary_details:=private.hl_stamp_source_room_special_stays(v_primary_details,v_primary_ids,v_primary.room_checkout_dates,v_primary.fecha_entrada,v_primary.fecha_salida,v_primary.early_checkin,v_primary.late_checkout);
  v_secondary_details:=private.hl_stamp_source_room_special_stays(v_secondary_details,v_secondary_ids,v_secondary.room_checkout_dates,v_secondary.fecha_entrada,v_secondary.fecha_salida,v_secondary.early_checkin,v_secondary.late_checkout);

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

  delete from public.hotel_reservation_guests sg
  where sg.property_id=v_primary.property_id
    and sg.reservation_id=v_secondary.id
    and sg.role='primary'
    and exists(
      select 1
      from public.hotel_reservation_guests pg
      where pg.property_id=v_primary.property_id
        and pg.reservation_id=v_primary.id
        and pg.role='primary'
        and lower(trim(coalesce(pg.full_name,'')))=lower(trim(coalesce(sg.full_name,'')))
        and (
          (nullif(trim(coalesce(pg.document_number,'')),'') is not null and lower(trim(pg.document_number))=lower(trim(coalesce(sg.document_number,''))))
          or (nullif(trim(coalesce(pg.email,'')),'') is not null and lower(trim(pg.email))=lower(trim(coalesce(sg.email,''))))
          or (nullif(trim(coalesce(pg.phone,'')),'') is not null and regexp_replace(pg.phone,'\D','','g')=regexp_replace(coalesce(sg.phone,''),'\D','','g'))
          or (
            nullif(trim(coalesce(pg.document_number,'')),'') is null and nullif(trim(coalesce(sg.document_number,'')),'') is null
            and nullif(trim(coalesce(pg.email,'')),'') is null and nullif(trim(coalesce(sg.email,'')),'') is null
            and nullif(trim(coalesce(pg.phone,'')),'') is null and nullif(trim(coalesce(sg.phone,'')),'') is null
          )
        )
    );

  update public.hotel_reservation_guests set role='companion'
    where property_id=v_primary.property_id and reservation_id=v_secondary.id and role='primary';

  update public.hotel_reservation_guests
  set room_id=case
        when room_id=any(v_secondary_ids) then room_id
        when cardinality(v_secondary_ids)=1 then v_secondary_ids[1]
        else null
      end,
      stay_from=case
        when stay_from is null or stay_to is null or stay_to<=v_secondary.fecha_entrada or stay_from>=v_secondary.fecha_salida then v_secondary.fecha_entrada
        else stay_from
      end,
      stay_to=case
        when stay_from is null or stay_to is null or stay_to<=v_secondary.fecha_entrada or stay_from>=v_secondary.fecha_salida then v_secondary.fecha_salida
        else stay_to
      end,
      reservation_id=v_primary.id,
      sort_order=sort_order+1000,
      updated_at=now()
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
    early_checkin=coalesce(v_primary.early_checkin,false) or coalesce(v_secondary.early_checkin,false),
    early_checkin_importe=greatest(0,coalesce(v_primary.early_checkin_importe,0))+greatest(0,coalesce(v_secondary.early_checkin_importe,0)),
    late_checkout=coalesce(v_primary.late_checkout,false) or coalesce(v_secondary.late_checkout,false),
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
$function$
;

CREATE OR REPLACE FUNCTION public.hl_checkin_reservation_rooms_atomic(p_reserva_id bigint, p_room_ids bigint[])
 RETURNS reservas
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v public.reservas%rowtype;
  v_all_room_ids bigint[]:=array[]::bigint[];
  v_requested bigint[]:=array[]::bigint[];
  v_pending bigint[]:=array[]::bigint[];
  v_explicit_checked bigint[]:=array[]::bigint[];
  v_after_checked bigint[]:=array[]::bigint[];
  v_bad_rooms text;
  v_dirty_rooms text;
  v_timezone text:='America/Argentina/Buenos_Aires';
  v_local_date date;
  v_policy text:='allow';
  v_is_manager boolean:=false;
  v_now timestamptz:=now();
  v_details jsonb;
  v_room_names text;
  v_pending_names text;
  v_future_rooms text;
  v_expired_rooms text;
  v_total integer:=0;
  v_room_id bigint;
  v_previous text;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Tenés que iniciar sesión.';
  end if;

  select * into v
  from public.reservas
  where id=p_reserva_id
  for update;

  if not found then
    raise exception using errcode='P0002',message='Reserva inexistente.';
  end if;

  if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para realizar el check-in.';
  end if;

  if v.estado in('cancelada','finalizada') or coalesce(v.no_show,false) then
    raise exception using errcode='P0001',message='La reserva no admite check-in en su estado actual.';
  end if;

  select
    coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires'),
    coalesce(nullif(settings->'preferences'->>'checkin_dirty_room_policy',''),'allow')
  into v_timezone,v_policy
  from public.property_settings
  where property_id=v.property_id;

  v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');
  v_policy:=lower(coalesce(v_policy,'allow'));

  begin
    v_local_date:=(now() at time zone v_timezone)::date;
  exception when others then
    v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
  end;

  if v.fecha_entrada>v_local_date then
    raise exception using errcode='P0001',message='El check-in no puede realizarse antes de la fecha de llegada.';
  end if;
  if v.fecha_salida<v_local_date then
    raise exception using errcode='P0001',message='La estadía ya quedó fuera de fecha. Revisá las fechas antes del check-in.';
  end if;

  v_all_room_ids:=case
    when v.habitaciones_ids is not null and cardinality(v.habitaciones_ids)>0 then v.habitaciones_ids
    when v.habitacion_id is not null then array[v.habitacion_id]
    else array[]::bigint[]
  end;

  select coalesce(array_agg(room_id order by room_id),array[]::bigint[])
  into v_all_room_ids
  from (
    select distinct x as room_id
    from unnest(v_all_room_ids) x
    where not (coalesce(v.room_checkout_dates,'{}'::jsonb) ? x::text)
      and not exists(
        select 1
        from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) e
        where coalesce(e->>'habitacion_id','') ~ '^\d+$'
          and (e->>'habitacion_id')::bigint=x
          and lower(coalesce(e->>'segment_role','')) in('previous_room','transient_room')
      )
  ) active_rooms;

  v_total:=cardinality(v_all_room_ids);
  if v_total=0 then
    raise exception using errcode='P0001',message='Asigná una habitación antes de hacer el check-in.';
  end if;

  if p_room_ids is null or cardinality(p_room_ids)=0 then
    v_requested:=v_all_room_ids;
  else
    if exists(
      select 1
      from unnest(p_room_ids) x
      where not (x=any(v_all_room_ids))
    ) then
      raise exception using errcode='22023',message='Hay una habitación seleccionada que no pertenece al tramo activo de esta reserva.';
    end if;
    select coalesce(array_agg(distinct x order by x),array[]::bigint[])
      into v_requested
    from unnest(p_room_ids) x;
  end if;

  select coalesce(array_agg(distinct (e->>'habitacion_id')::bigint order by (e->>'habitacion_id')::bigint),array[]::bigint[])
  into v_explicit_checked
  from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','') ~ '^\d+$'
    and (e->>'habitacion_id')::bigint=any(v_all_room_ids)
    and nullif(e->>'checked_in_at','') is not null
    and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room');

  -- Las reservas alojadas antes de incorporar el check-in por habitación se consideran completas.
  if v.estado='alojado' and cardinality(v_explicit_checked)=0 then
    return v;
  end if;

  select coalesce(array_agg(x order by x),array[]::bigint[])
  into v_pending
  from unnest(v_requested) x
  where not (x=any(v_explicit_checked));

  if cardinality(v_pending)=0 then
    raise exception using errcode='P0001',message='Las habitaciones seleccionadas ya tienen el check-in realizado.';
  end if;

  select string_agg(coalesce(h.nombre,h.id::text)||' ('||to_char(public.hl_reservation_room_start_date(v.habitaciones_detalle,h.id,v.fecha_entrada),'DD/MM/YYYY')||')',', ' order by h.nombre)
  into v_future_rooms
  from public.habitaciones h
  where h.property_id=v.property_id
    and h.id=any(v_pending)
    and public.hl_reservation_room_start_date(v.habitaciones_detalle,h.id,v.fecha_entrada)>v_local_date;

  if v_future_rooms is not null then
    raise exception using errcode='P0001',message='Todavía no corresponde el check-in de: '||v_future_rooms||'. Se habilita en la fecha de llegada de cada habitación.';
  end if;

  select string_agg(coalesce(h.nombre,h.id::text),', ' order by h.nombre)
  into v_expired_rooms
  from public.habitaciones h
  where h.property_id=v.property_id
    and h.id=any(v_pending)
    and public.hl_reservation_room_planned_end_date(v.habitaciones_detalle,h.id,v.fecha_salida)<=v_local_date;

  if v_expired_rooms is not null then
    raise exception using errcode='P0001',message='La estadía de estas habitaciones ya finalizó: '||v_expired_rooms||'. Revisá las fechas antes de hacer check-in.';
  end if;

  if (
    select count(*)
    from public.habitaciones h
    where h.property_id=v.property_id and h.id=any(v_pending)
  )<>cardinality(v_pending) then
    raise exception using errcode='P0001',message='Hay una habitación seleccionada que no pertenece a la propiedad o ya no existe.';
  end if;

  select string_agg(coalesce(h.nombre,h.id::text)||' ('||coalesce(h.estado,'sin estado')||')',', ' order by h.nombre)
  into v_bad_rooms
  from public.habitaciones h
  where h.property_id=v.property_id
    and h.id=any(v_pending)
    and (h.activa is false or lower(coalesce(h.estado,'')) not in('libre','limpia','inspeccionada','sucia'));

  if v_bad_rooms is not null then
    raise exception using errcode='P0001',message='No se puede hacer check-in: revisá el estado de '||v_bad_rooms||'.';
  end if;

  select string_agg(coalesce(h.nombre,h.id::text),', ' order by h.nombre)
  into v_dirty_rooms
  from public.habitaciones h
  where h.property_id=v.property_id
    and h.id=any(v_pending)
    and lower(coalesce(h.estado,''))='sucia';

  v_is_manager:=private.user_has_property_role(v.property_id,array['owner','admin','manager']::text[]);
  if v_dirty_rooms is not null and (v_policy='block' or (v_policy='manager_only' and not v_is_manager)) then
    raise exception using errcode='P0001',message=case
      when v_policy='manager_only' then 'La habitación está sucia. Se requiere autorización de supervisor para continuar: '||v_dirty_rooms
      else 'No se puede hacer check-in con habitaciones sucias: '||v_dirty_rooms
    end;
  end if;

  select coalesce(jsonb_agg(
    case
      when coalesce(e->>'habitacion_id','') ~ '^\d+$'
       and (e->>'habitacion_id')::bigint=any(v_pending)
       and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room')
      then e || jsonb_build_object(
        'checked_in_at',v_now,
        'checked_in_by',auth.uid(),
        'checkin_operational_date',v_local_date,
        'checkin_status','checked_in'
      )
      else e
    end
    order by ord
  ),'[]'::jsonb)
  into v_details
  from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) with ordinality t(e,ord);

  update public.reservas
  set estado='alojado',
      habitaciones_detalle=v_details
  where id=v.id
  returning * into v;

  -- Sólo las habitaciones que realmente ingresan pasan a ocupadas/sucias.
  -- Las habitaciones pendientes mantienen su estado de Housekeeping y siguen reservadas.
  for v_room_id in
    select h.id
    from public.habitaciones h
    where h.property_id=v.property_id
      and h.id=any(v_pending)
    for update
  loop
    select lower(coalesce(h.estado,'libre'))
      into v_previous
    from public.habitaciones h
    where h.id=v_room_id and h.property_id=v.property_id;

    if v_previous not in ('mantenimiento','fuera_servicio') then
      update public.habitaciones
      set estado='sucia'
      where id=v_room_id and property_id=v.property_id;

      insert into public.hotel_housekeeping_history(
        property_id,room_id,reservation_id,from_status,to_status,source,note,actor_id
      )
      values(
        v.property_id,v_room_id,v.id,v_previous,'sucia','checkin',
        'Habitación marcada sucia automáticamente al hacer check-in.',auth.uid()
      );
    end if;
  end loop;

  update public.hotel_reservation_guests
  set stay_from=coalesce(stay_from,v.fecha_entrada),
      stay_to=coalesce(stay_to,v.fecha_salida),
      updated_at=now()
  where reservation_id=v.id
    and property_id=v.property_id
    and (
      room_id=any(v_pending)
      or (v_total=1 and room_id is null)
    );

  select coalesce(array_agg(distinct (e->>'habitacion_id')::bigint order by (e->>'habitacion_id')::bigint),array[]::bigint[])
  into v_after_checked
  from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','') ~ '^\d+$'
    and (e->>'habitacion_id')::bigint=any(v_all_room_ids)
    and nullif(e->>'checked_in_at','') is not null
    and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room');

  select string_agg(coalesce(h.nombre,h.id::text),', ' order by h.nombre)
  into v_room_names
  from public.habitaciones h
  where h.property_id=v.property_id and h.id=any(v_pending);

  select string_agg(coalesce(h.nombre,h.id::text),', ' order by h.nombre)
  into v_pending_names
  from public.habitaciones h
  where h.property_id=v.property_id
    and h.id=any(v_all_room_ids)
    and not (h.id=any(v_after_checked));

  insert into public.hotel_reservation_events(
    property_id,reservation_id,event_type,title,detail,payload,actor_user_id
  )
  values(
    v.property_id,
    v.id,
    case when cardinality(v_after_checked)>=v_total then 'checkin' else 'room_checkin' end,
    case when cardinality(v_after_checked)>=v_total then 'Check-in completo' else 'Check-in parcial' end,
    case
      when cardinality(v_after_checked)>=v_total then 'Ingresaron todas las habitaciones de la reserva: '||coalesce(v_room_names,'—')||'.'
      else 'Ingresaron Hab. '||coalesce(v_room_names,'—')||'. Pendientes: '||coalesce(v_pending_names,'—')||'.'
    end,
    jsonb_build_object(
      'room_ids',v_pending,
      'checked_in_room_ids',v_after_checked,
      'pending_room_ids',(
        select coalesce(jsonb_agg(x order by x),'[]'::jsonb)
        from unnest(v_all_room_ids) x
        where not (x=any(v_after_checked))
      ),
      'partial',cardinality(v_after_checked)<v_total,
      'checked_in_at',v_now,
      'operational_date',v_local_date
    ),
    auth.uid()
  );

  return v;
end;
$function$
;
