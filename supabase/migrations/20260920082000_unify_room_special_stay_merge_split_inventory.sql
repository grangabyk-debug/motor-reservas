-- Unifica la ocupación operativa de early/late por habitación y la conserva en fusionar/dividir.

create or replace function public.hl_reservation_room_early_checkin(
  p_details jsonb,p_room_id bigint,p_room_start date,p_reservation_start date,p_global boolean
) returns boolean language plpgsql immutable set search_path to 'pg_catalog','public' as $$
declare v jsonb; v_explicit text;
begin
  select e into v from jsonb_array_elements(case when jsonb_typeof(p_details)='array' then p_details else '[]'::jsonb end) e
  where coalesce(e->>'habitacion_id','')~'^\\d+$' and (e->>'habitacion_id')::bigint=p_room_id limit 1;
  if v ? 'early_checkin_requested' then
    v_explicit:=lower(coalesce(v->>'early_checkin_requested','false'));
    return v_explicit in ('true','t','1','yes','on');
  end if;
  if coalesce(v->>'early_checkin_time','')<>'' or coalesce(nullif(v->>'early_checkin_net','')::numeric,0)>0 then return true; end if;
  return coalesce(p_global,false) and p_room_start is not distinct from p_reservation_start;
end $$;

create or replace function public.hl_reservation_room_late_checkout(
  p_details jsonb,p_checkout_dates jsonb,p_room_id bigint,p_room_end date,p_reservation_end date,p_global boolean
) returns boolean language plpgsql immutable set search_path to 'pg_catalog','public' as $$
declare v jsonb; v_explicit text;
begin
  if coalesce(p_checkout_dates->>('late:'||p_room_id::text),'')~'^\\d{4}-\\d{2}-\\d{2}$' then return true; end if;
  select e into v from jsonb_array_elements(case when jsonb_typeof(p_details)='array' then p_details else '[]'::jsonb end) e
  where coalesce(e->>'habitacion_id','')~'^\\d+$' and (e->>'habitacion_id')::bigint=p_room_id limit 1;
  if v ? 'late_checkout_requested' then
    v_explicit:=lower(coalesce(v->>'late_checkout_requested','false'));
    return v_explicit in ('true','t','1','yes','on');
  end if;
  if coalesce(v->>'late_checkout_time','')<>'' or coalesce(nullif(v->>'late_checkout_net','')::numeric,0)>0 then return true; end if;
  return coalesce(p_global,false) and p_room_end is not distinct from p_reservation_end;
end $$;

create or replace function private.hl_stamp_source_room_special_stays(
  p_details jsonb,p_room_ids bigint[],p_checkout_dates jsonb,p_source_start date,p_source_end date,p_early boolean,p_late boolean
) returns jsonb language plpgsql immutable set search_path to 'pg_catalog','public','private' as $$
declare v_result jsonb:='[]'::jsonb; v jsonb; v_id bigint; v_start date; v_end date; v_early boolean; v_late boolean;
begin
  for v in select value from jsonb_array_elements(case when jsonb_typeof(p_details)='array' then p_details else '[]'::jsonb end)
  loop
    if coalesce(v->>'habitacion_id','')~'^\\d+$' then v_id:=(v->>'habitacion_id')::bigint; else v_id:=null; end if;
    if v_id is not null and v_id=any(coalesce(p_room_ids,'{}'::bigint[])) then
      v_start:=coalesce(nullif(v->>'fecha_entrada','')::date,p_source_start);
      v_end:=coalesce(nullif(v->>'fecha_salida','')::date,p_source_end);
      v_early:=public.hl_reservation_room_early_checkin(p_details,v_id,v_start,p_source_start,p_early);
      v_late:=public.hl_reservation_room_late_checkout(p_details,p_checkout_dates,v_id,v_end,p_source_end,p_late);
      v:=v||jsonb_build_object('early_checkin_requested',v_early,'late_checkout_requested',v_late);
    end if;
    v_result:=v_result||jsonb_build_array(v);
  end loop;
  return v_result;
end $$;

create or replace function private.hl_guard_special_stay_inventory()
returns trigger language plpgsql set search_path to 'pg_catalog','public','private' as $$
declare
  v_room_id bigint; v_room_ids bigint[]; v_room_label text;
  v_inventory_start date; v_inventory_end date; v_room_start date; v_room_end date; v_effective_end date;
  v_prefs jsonb:='{}'::jsonb; v_ops jsonb:='{}'::jsonb;
  v_early_time time:='08:00'; v_late_time time:='18:00'; v_checkin time:='14:00'; v_checkout time:='10:00';
  v_room_early boolean; v_room_late boolean; v_merge_secondary bigint;
  v_start_ts timestamp; v_end_ts timestamp; v_min_start timestamp; v_max_end timestamp;
begin
  if new.fecha_entrada is null or new.fecha_salida is null then return new; end if;
  select coalesce(settings->'preferences','{}'::jsonb) into v_prefs from public.property_settings where property_id=new.property_id;
  select coalesce(operational_settings,'{}'::jsonb) into v_ops from public.hotel_os_settings where property_id=new.property_id;
  v_prefs:=coalesce(v_prefs,'{}'::jsonb);v_ops:=coalesce(v_ops,'{}'::jsonb);
  v_early_time:=private.hl_safe_time(v_prefs->>'early_checkin_time','08:00'::time);
  v_late_time:=private.hl_safe_time(v_prefs->>'late_checkout_time','18:00'::time);
  v_checkin:=private.hl_safe_time(v_ops->>'checkin_time','14:00'::time);
  v_checkout:=private.hl_safe_time(v_ops->>'checkout_time','10:00'::time);
  if new.estado in('cancelada','fusionada') or coalesce(new.no_show,false) then return new; end if;
  begin v_merge_secondary:=nullif(current_setting('app.hl_merge_secondary_id',true),'')::bigint; exception when others then v_merge_secondary:=null; end;
  select coalesce(array_agg(distinct x order by x),array[]::bigint[]) into v_room_ids
    from unnest(coalesce(new.habitaciones_ids,array[]::bigint[])||array[new.habitacion_id]) x where x is not null;
  foreach v_room_id in array v_room_ids loop
    v_room_start:=public.hl_reservation_room_start_date(new.habitaciones_detalle,v_room_id,new.fecha_entrada);
    v_room_end:=public.hl_reservation_room_planned_end_date(new.habitaciones_detalle,v_room_id,new.fecha_salida);
    v_effective_end:=public.hl_reservation_room_effective_end_date(new.habitaciones_detalle,new.room_checkout_dates,v_room_id,new.fecha_salida);
    v_room_early:=public.hl_reservation_room_early_checkin(new.habitaciones_detalle,v_room_id,v_room_start,new.fecha_entrada,new.early_checkin);
    v_room_late:=public.hl_reservation_room_late_checkout(new.habitaciones_detalle,new.room_checkout_dates,v_room_id,v_room_end,new.fecha_salida,new.late_checkout);
    v_inventory_start:=public.hl_reservation_inventory_start_date(v_room_start,v_room_early);
    v_inventory_end:=public.hl_reservation_room_inventory_end_date(new.room_checkout_dates,v_room_id,v_room_end,v_room_late);
    if v_inventory_end<=v_inventory_start then continue; end if;
    v_start_ts:=v_room_start::timestamp+case when v_room_early then v_early_time else private.hl_safe_time(new.hora_llegada_estimada,v_checkin) end;
    v_end_ts:=v_effective_end::timestamp+case when v_effective_end<v_room_end then v_checkout when v_room_late then v_late_time else private.hl_safe_time(new.hora_salida_estimada,v_checkout) end;
    v_min_start:=case when v_min_start is null or v_start_ts<v_min_start then v_start_ts else v_min_start end;
    v_max_end:=case when v_max_end is null or v_end_ts>v_max_end then v_end_ts else v_max_end end;
    select coalesce(nullif(trim(h.nombre),''),h.id::text) into v_room_label from public.habitaciones h where h.id=v_room_id and h.property_id=new.property_id;
    v_room_label:=coalesce(v_room_label,v_room_id::text);
    perform pg_advisory_xact_lock(hashtextextended(new.property_id::text||':'||v_room_id::text,0));
    if exists(
      select 1 from public.reservas r
      where r.property_id=new.property_id and r.id<>coalesce(new.id,-1)
        and (v_merge_secondary is null or r.id<>v_merge_secondary)
        and r.estado not in('cancelada','fusionada') and coalesce(r.no_show,false)=false
        and v_room_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id])
        and public.hl_reservation_inventory_start_date(
          public.hl_reservation_room_start_date(r.habitaciones_detalle,v_room_id,r.fecha_entrada),
          public.hl_reservation_room_early_checkin(r.habitaciones_detalle,v_room_id,public.hl_reservation_room_start_date(r.habitaciones_detalle,v_room_id,r.fecha_entrada),r.fecha_entrada,r.early_checkin)
        )<v_inventory_end
        and public.hl_reservation_room_inventory_end_date(
          r.room_checkout_dates,v_room_id,public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,v_room_id,r.fecha_salida),
          public.hl_reservation_room_late_checkout(r.habitaciones_detalle,r.room_checkout_dates,v_room_id,public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,v_room_id,r.fecha_salida),r.fecha_salida,r.late_checkout)
        )>v_inventory_start
    ) then raise exception using errcode='23P01',message=format('La habitación %s está ocupada en el turno requerido.',v_room_label); end if;
    if exists(select 1 from public.bloqueos b where b.property_id=new.property_id and b.habitacion_id=v_room_id and b.fecha_desde<v_inventory_end and b.fecha_hasta>v_inventory_start)
    then raise exception using errcode='23P01',message=format('La habitación %s tiene un bloqueo operativo en el turno requerido.',v_room_label); end if;
  end loop;
  if v_min_start is not null then new.ocupacion_desde_local:=v_min_start; end if;
  if v_max_end is not null then new.ocupacion_hasta_local:=v_max_end; end if;
  return new;
end $$;


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

CREATE OR REPLACE FUNCTION public.hl_move_inhouse_room_segment_atomic(p_reserva_id bigint, p_from_room_id bigint, p_to_room_id bigint, p_effective_date date, p_reprice boolean DEFAULT false, p_reason text DEFAULT NULL::text)
 RETURNS reservas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_before public.reservas%rowtype;
  v_after public.reservas%rowtype;
  v_source public.habitaciones%rowtype;
  v_target public.habitaciones%rowtype;
  v_source_detail jsonb;
  v_details_base jsonb;
  v_new_details jsonb;
  v_existing_ids bigint[];
  v_new_ids bigint[];
  v_new_checkout_dates jsonb;
  v_start date;
  v_end date;
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_remaining_nights integer;
  v_old_rate numeric := 0;
  v_new_rate numeric := 0;
  v_rate_delta numeric := 0;
  v_calendar_total numeric := 0;
  v_pricing_quote jsonb;
  v_total_rate numeric := 0;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_net numeric := 0;
  v_vat_rate numeric := 0;
  v_vat numeric := 0;
  v_total numeric := 0;
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
  v_operation_group uuid := gen_random_uuid();
  v_scheduled boolean:=false;
  v_master_before uuid;
  v_master_after uuid;
  v_source_folio uuid;
  v_target_folio uuid;
  v_expected_target_final numeric := 0;
  v_target_folio_lodging_total numeric := 0;
begin
  if v_actor is null then
    raise exception using errcode='42501',message='Tenés que iniciar sesión.';
  end if;
  if p_from_room_id is null or p_to_room_id is null or p_from_room_id=p_to_room_id then
    raise exception using errcode='22023',message='Elegí una habitación de origen y otra de destino.';
  end if;
  if p_effective_date is null then
    raise exception using errcode='22007',message='Indicá la fecha del cambio de habitación.';
  end if;
  if v_reason is null then
    raise exception using errcode='22023',message='Indicá el motivo del cambio de habitación.';
  end if;
  if length(v_reason)>500 then
    raise exception using errcode='22023',message='El motivo del cambio no puede superar los 500 caracteres.';
  end if;
  v_scheduled:=p_effective_date>v_today;

  select * into v_before from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v_before.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para modificar esta reserva.';
  end if;
  if lower(coalesce(v_before.estado,'')) not in ('alojado','inhouse','in_house','in house') then
    raise exception using errcode='22023',message='Dividir la estadía se usa solamente con huéspedes que ya hicieron check-in.';
  end if;
  if v_before.estado in ('cancelada','finalizada') or coalesce(v_before.no_show,false) then
    raise exception using errcode='P0001',message='Esta reserva ya no admite cambios de habitación.';
  end if;

  v_existing_ids:=case when cardinality(coalesce(v_before.habitaciones_ids,'{}'::bigint[]))>0 then v_before.habitaciones_ids when v_before.habitacion_id is not null then array[v_before.habitacion_id]::bigint[] else '{}'::bigint[] end;
  if not (p_from_room_id=any(v_existing_ids)) then
    raise exception using errcode='22023',message='La habitación de origen no pertenece a esta reserva.';
  end if;
  if coalesce(v_before.room_checkout_dates,'{}'::jsonb) ? p_from_room_id::text then
    raise exception using errcode='P0001',message='Ese tramo ya fue cerrado y no se puede volver a dividir.';
  end if;
  if p_to_room_id=any(v_existing_ids) then
    raise exception using errcode='22023',message='La habitación de destino ya fue utilizada en esta reserva. Elegí otra habitación para conservar el historial por tramos.';
  end if;

  if exists(
    select 1 from public.hotel_finance_documents d
    where d.property_id=v_before.property_id and d.reservation_id=v_before.id and coalesce(d.total,0)>0
      and lower(coalesce(d.document_type,'')) not like '%proforma%'
      and lower(coalesce(d.document_type,'')) not like '%presupuesto%'
      and lower(coalesce(d.status,'')) not in ('draft','borrador','cancelled','canceled','cancelada','anulado','anulada','void')
      and (d.issued_at is not null or lower(coalesce(d.status,'')) in ('issued','emitida','emitido','sent','enviada','enviado','paid','pagada','pagado','final','fiscal'))
  ) then
    raise exception using errcode='P0001',message='La reserva ya tiene un comprobante emitido. Rectificá el comprobante antes de dividir la estadía.';
  end if;

  select * into v_source from public.habitaciones where id=p_from_room_id and property_id=v_before.property_id;
  if not found then raise exception using errcode='P0002',message='Habitación de origen inexistente.'; end if;
  select * into v_target from public.habitaciones where id=p_to_room_id and property_id=v_before.property_id and activa is distinct from false;
  if not found then raise exception using errcode='P0002',message='Habitación de destino inexistente o inactiva.'; end if;
  if lower(coalesce(v_target.estado,'')) in ('mantenimiento','fuera_servicio') then
    raise exception using errcode='23P01',message='La habitación de destino está fuera de servicio.';
  end if;

  select e into v_source_detail
  from jsonb_array_elements(coalesce(v_before.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','') ~ '^\d+$' and (e->>'habitacion_id')::bigint=p_from_room_id
  limit 1;
  if v_source_detail is null then
    v_source_detail:=jsonb_build_object(
      'habitacion_id',p_from_room_id,
      'nombre',v_source.nombre,
      'categoria_asignada',coalesce(nullif(trim(v_source.tipo),''),'Habitación'),
      'categoria_vendida',coalesce(nullif(trim(v_source.tipo),''),'Habitación'),
      'huespedes',greatest(1,coalesce(v_before.cantidad_huespedes,1)),
      'tarifa_noche',greatest(0,coalesce(v_before.tarifa_noche,v_source.precio,0)),
      'fecha_entrada',v_before.fecha_entrada,
      'fecha_salida',v_before.fecha_salida
    );
    v_details_base:=coalesce(v_before.habitaciones_detalle,'[]'::jsonb)||jsonb_build_array(v_source_detail);
  else
    v_details_base:=coalesce(v_before.habitaciones_detalle,'[]'::jsonb);
  end if;
  if lower(coalesce(v_source_detail->>'movement_locked','false'))='true' then
    raise exception using errcode='P0001',message='Esta habitación tiene bloqueado el movimiento. Desbloqueala antes de dividir la estadía.';
  end if;

  v_start:=coalesce(nullif(v_source_detail->>'fecha_entrada','')::date,v_before.fecha_entrada);
  v_end:=coalesce(nullif(v_source_detail->>'fecha_salida','')::date,v_before.fecha_salida);
  if v_start is null or v_end is null or v_end<=v_start then raise exception using errcode='22007',message='La habitación de origen no tiene una estadía válida.'; end if;
  if p_effective_date<=v_start or p_effective_date>=v_end then
    raise exception using errcode='22023',message=format('El cambio debe hacerse después del ingreso de este tramo (%s) y antes de su salida (%s).',v_start,v_end);
  end if;
  v_remaining_nights:=greatest(1,v_end-p_effective_date);

  perform pg_advisory_xact_lock(hashtextextended(v_before.property_id::text||':'||least(p_from_room_id,p_to_room_id)::text,0));
  perform pg_advisory_xact_lock(hashtextextended(v_before.property_id::text||':'||greatest(p_from_room_id,p_to_room_id)::text,0));

  if exists(
    select 1 from public.reservas r
    where r.property_id=v_before.property_id and r.id<>v_before.id and r.estado not in('cancelada','fusionada') and coalesce(r.no_show,false)=false
      and p_to_room_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id])
      and public.hl_reservation_room_start_date(r.habitaciones_detalle,p_to_room_id,r.fecha_entrada)<v_end
      and public.hl_reservation_room_effective_end_date(r.habitaciones_detalle,r.room_checkout_dates,p_to_room_id,r.fecha_salida)>p_effective_date
  ) then
    raise exception using errcode='23P01',message=format('La habitación %s está ocupada durante parte de %s → %s.',coalesce(v_target.nombre,p_to_room_id::text),p_effective_date,v_end);
  end if;
  if exists(
    select 1 from public.bloqueos b where b.property_id=v_before.property_id and b.habitacion_id=p_to_room_id
      and b.fecha_desde<v_end and b.fecha_hasta>p_effective_date
  ) then
    raise exception using errcode='23P01',message=format('La habitación %s tiene un bloqueo operativo durante el tramo nuevo.',coalesce(v_target.nombre,p_to_room_id::text));
  end if;

  v_old_rate:=greatest(0,coalesce(nullif(v_source_detail->>'tarifa_noche','')::numeric,v_before.tarifa_noche,v_source.precio,0));
  if coalesce(p_reprice,false) then
    v_pricing_quote:=private.hl_room_change_pricing_quote(v_before.id,p_from_room_id,p_to_room_id,p_effective_date,v_end);
    v_new_rate:=coalesce((v_pricing_quote->>'target_booked_rate')::numeric,v_old_rate);
    v_rate_delta:=coalesce((v_pricing_quote->>'reservation_delta')::numeric,0);
    v_expected_target_final:=coalesce((v_pricing_quote->>'target_reservation_final_total')::numeric,0);
  else
    v_new_rate:=v_old_rate;
    v_rate_delta:=0;
  end if;
  v_total_rate:=greatest(0,coalesce(v_before.tarifa_noche,0)-v_old_rate+v_new_rate);

  select coalesce(jsonb_agg(
    case when coalesce(d->>'habitacion_id','') ~ '^\d+$' and (d->>'habitacion_id')::bigint=p_from_room_id then
      (d - 'movement_locked' - 'movement_lock_reason' - 'movement_locked_at' - 'movement_locked_by') || jsonb_build_object(
        'fecha_salida',p_effective_date,
        'noches',greatest(1,p_effective_date-v_start),
        'early_checkin_requested',public.hl_reservation_room_early_checkin(v_details_base,p_from_room_id,v_start,v_before.fecha_entrada,v_before.early_checkin),
        'late_checkout_requested',false,
        'segment_role',case when v_scheduled then 'active_room' else 'previous_room' end,
        'moved_to_room_id',p_to_room_id,
        'split_effective_date',p_effective_date,
        'split_reason',v_reason,
        'moved_at',now()
      )
    else d end order by ord
  ),'[]'::jsonb)
  into v_new_details
  from jsonb_array_elements(v_details_base) with ordinality as t(d,ord);

  v_new_details:=v_new_details || jsonb_build_array(
    (case when v_scheduled then v_source_detail - 'movement_locked' - 'movement_lock_reason' - 'movement_locked_at' - 'movement_locked_by' - 'checked_in_at' - 'checked_in_by' - 'checkin_operational_date' - 'checkin_status' else v_source_detail - 'movement_locked' - 'movement_lock_reason' - 'movement_locked_at' - 'movement_locked_by' end) || jsonb_build_object(
      'habitacion_id',p_to_room_id,
      'nombre',v_target.nombre,
      'categoria_asignada',coalesce(nullif(trim(v_target.tipo),''),'Habitación'),
      'categoria_vendida',case when coalesce(p_reprice,false) then coalesce(nullif(trim(v_target.tipo),''),'Habitación') else coalesce(nullif(v_source_detail->>'categoria_vendida',''),nullif(trim(v_source.tipo),''),'Habitación') end,
      'tarifa_categoria',case when coalesce(p_reprice,false) then coalesce(nullif(trim(v_target.tipo),''),'Habitación') else coalesce(nullif(v_source_detail->>'tarifa_categoria',''),nullif(v_source_detail->>'categoria_vendida',''),nullif(trim(v_source.tipo),''),'Habitación') end,
      'tarifa_fuente',case when coalesce(p_reprice,false) then 'calendar_room' else coalesce(nullif(v_source_detail->>'tarifa_fuente',''),'reservation') end,
      'tarifa_manual',case when coalesce(p_reprice,false) then false else coalesce((v_source_detail->>'tarifa_manual')::boolean,false) end,
      'tarifa_noche',v_new_rate,
      'fecha_entrada',p_effective_date,
      'fecha_salida',v_end,
      'noches',v_remaining_nights,
      'early_checkin_requested',false,
      'late_checkout_requested',public.hl_reservation_room_late_checkout(v_details_base,v_before.room_checkout_dates,p_from_room_id,v_end,v_before.fecha_salida,v_before.late_checkout),
      'segment_role',case when v_scheduled then 'scheduled_room' else 'active_room' end,
      'scheduled_move',v_scheduled,
      'moved_from_room_id',p_from_room_id,
      'split_effective_date',p_effective_date,
      'split_reason',v_reason,
      'moved_at',now()
    )
  );

  if v_scheduled then
    select array_agg(x order by ord) into v_new_ids from (
      select x,ord from unnest(v_existing_ids) with ordinality as a(x,ord)
      union all select p_to_room_id,1000000::bigint
    ) q;
    v_new_checkout_dates:=coalesce(v_before.room_checkout_dates,'{}'::jsonb);
  else
    select array_agg(x order by ord) into v_new_ids from (
      select p_to_room_id as x,0::bigint as ord
      union all
      select x,ord from unnest(v_existing_ids) with ordinality as a(x,ord) where x<>p_to_room_id
    ) q;
    v_new_checkout_dates:=coalesce(v_before.room_checkout_dates,'{}'::jsonb)||jsonb_build_object(p_from_room_id::text,p_effective_date);
  end if;

  if coalesce(v_before.room_checkout_dates,'{}'::jsonb) ? ('late:'||p_from_room_id::text) then
    v_new_checkout_dates:=(v_new_checkout_dates-('late:'||p_from_room_id::text))
      ||jsonb_build_object('late:'||p_to_room_id::text,v_before.room_checkout_dates->('late:'||p_from_room_id::text));
  end if;

  if coalesce(p_reprice,false) then
    v_subtotal:=greatest(0,coalesce(v_before.subtotal,0)+v_rate_delta);
    if lower(coalesce(v_before.descuento_tipo,'')) in ('percent','porcentaje','percentage') then
      v_discount:=round(v_subtotal*least(100,greatest(0,coalesce(v_before.descuento_valor,0)))/100,2);
    elsif lower(coalesce(v_before.descuento_tipo,'')) in ('amount','importe','fixed','fijo') then
      v_discount:=least(v_subtotal,greatest(0,coalesce(v_before.descuento_importe,v_before.descuento_valor,0)));
    else
      v_discount:=least(v_subtotal,greatest(0,coalesce(v_before.descuento_importe,0)));
    end if;
    v_net:=round(greatest(0,v_subtotal-v_discount),2);
    v_vat_rate:=case when coalesce(v_before.impuestos_desglosados,false) then greatest(0,coalesce(v_before.iva_porcentaje,0)) else 0 end;
    v_vat:=case when coalesce(v_before.impuestos_desglosados,false) then round(v_net*v_vat_rate/100,2) else 0 end;
    v_total:=round(v_net+v_vat,2);
  else
    v_subtotal:=v_before.subtotal;
    v_discount:=v_before.descuento_importe;
    v_net:=coalesce(v_before.precio_sin_impuestos_nacionales,case when coalesce(v_before.impuestos_desglosados,false) then greatest(0,coalesce(v_before.precio_total,0)-coalesce(v_before.iva_importe,0)) else v_before.precio_total end);
    v_vat:=coalesce(v_before.iva_importe,0);
    v_total:=v_before.precio_total;
  end if;

  select id into v_master_before from public.hotel_folios where reservation_id=v_before.id and folio_type='master' and status<>'void' order by created_at limit 1;

  if not v_scheduled then
    update public.hotel_reservation_guests set room_id=p_to_room_id,updated_at=now()
    where property_id=v_before.property_id and reservation_id=v_before.id and room_id=p_from_room_id and checked_out_at is null;
    update public.hotel_group_rooming set room_id=p_to_room_id,updated_at=now()
    where property_id=v_before.property_id and reservation_id=v_before.id and room_id=p_from_room_id;
  end if;

  update public.reservas set
    habitacion_id=case when v_scheduled then v_before.habitacion_id else p_to_room_id end,
    alojamiento_id=case when v_scheduled then v_before.alojamiento_id else coalesce(v_target.alojamiento_id,alojamiento_id) end,
    habitaciones_ids=v_new_ids,
    habitaciones_detalle=v_new_details,
    room_checkout_dates=v_new_checkout_dates,
    tarifa_noche=v_total_rate,
    subtotal=case when p_reprice then v_subtotal else subtotal end,
    descuento_importe=case when p_reprice then v_discount else descuento_importe end,
    precio_sin_impuestos_nacionales=case when p_reprice then v_net else precio_sin_impuestos_nacionales end,
    iva_importe=case when p_reprice then v_vat else iva_importe end,
    precio_total=case when p_reprice then v_total else precio_total end,
    precio_total_usd=case when p_reprice and coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end
  where id=v_before.id returning * into v_after;

  if not v_scheduled then
    update public.habitaciones set estado='sucia'
    where id=p_from_room_id and property_id=v_before.property_id and lower(coalesce(estado,'')) not in ('mantenimiento','fuera_servicio');
  end if;

  perform private.hl_sync_reservation_folios_internal(v_after.id);
  perform private.hl_rebalance_split_payment_allocations(v_after.id,p_from_room_id,p_to_room_id);

  if coalesce(p_reprice,false) then
    select coalesce(sum(i.total),0)
      into v_target_folio_lodging_total
    from public.hotel_folio_items i
    where i.reservation_id=v_after.id
      and i.room_id=p_to_room_id
      and i.status='active'
      and lower(coalesce(i.source_type,''))='lodging';

    if abs(v_target_folio_lodging_total-v_expected_target_final)>0.01 then
      raise exception using errcode='P0001',
        message=format(
          'La tarifa sincronizada del nuevo tramo no coincide con la cotización (%s vs %s). No se aplicó el cambio.',
          v_target_folio_lodging_total,
          v_expected_target_final
        );
    end if;
  end if;

  select id into v_source_folio from public.hotel_folios where reservation_id=v_after.id and room_id=p_from_room_id and folio_type='room' limit 1;
  select id into v_target_folio from public.hotel_folios where reservation_id=v_after.id and room_id=p_to_room_id and folio_type='room' limit 1;
  select id into v_master_after from public.hotel_folios where reservation_id=v_after.id and folio_type='master' order by created_at limit 1;

  if v_source_folio is not null then
    update public.hotel_folios set label='Habitación '||coalesce(v_source.nombre,p_from_room_id::text)||' · hasta '||p_effective_date::text,is_primary=v_scheduled,sort_order=1,updated_at=now() where id=v_source_folio;
  end if;
  if v_target_folio is not null then
    update public.hotel_folios set label='Habitación '||coalesce(v_target.nombre,p_to_room_id::text)||' · desde '||p_effective_date::text,is_primary=not v_scheduled,sort_order=2,updated_at=now() where id=v_target_folio;
  end if;
  if v_master_before is null and v_master_after is not null and v_target_folio is not null then
    update public.hotel_folio_items set folio_id=v_target_folio,room_id=p_to_room_id,updated_at=now()
    where folio_id=v_master_after and invoice_document_id is null;
    if not exists(select 1 from public.hotel_folio_payment_allocations a where a.folio_id=v_master_after)
       and not exists(select 1 from public.hotel_finance_documents d where d.folio_id=v_master_after and lower(coalesce(d.status,'')) not in ('void','cancelled','canceled','cancelada','anulado','anulada')) then
      update public.hotel_folios set status='void',is_primary=false,updated_at=now() where id=v_master_after;
    end if;
  end if;

  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
  values(
    v_before.property_id,v_before.id,'room',case when v_scheduled then 'Cambio de habitación programado' else 'Reserva dividida por cambio de habitación' end,
    format('Hab. %s hasta %s → Hab. %s desde %s hasta %s · Motivo: %s%s',coalesce(v_source.nombre,p_from_room_id::text),p_effective_date,coalesce(v_target.nombre,p_to_room_id::text),p_effective_date,v_end,v_reason,case when p_reprice then format(' · tarifa del nuevo tramo %s → %s',v_old_rate,v_new_rate) else ' · tarifa original mantenida' end),
    jsonb_build_object('mid_stay_split',true,'from_room_id',p_from_room_id,'to_room_id',p_to_room_id,'split_date',p_effective_date,'room_start',v_start,'room_end',v_end,'reason',v_reason,'before_rate',v_old_rate,'after_rate',v_new_rate,'reprice',coalesce(p_reprice,false),'source_folio_id',v_source_folio,'target_folio_id',v_target_folio,'scheduled',v_scheduled),
    v_actor,null
  );
  insert into public.hotel_planning_operation_log(operation_group,property_id,action,reservation_id,before_state,after_state,meta,created_by)
  values(v_operation_group,v_before.property_id,'split_room_move',v_before.id,private.hl_planning_reservation_state(v_before),private.hl_planning_reservation_state(v_after),jsonb_build_object('mid_stay_split',true,'from_room_id',p_from_room_id,'to_room_id',p_to_room_id,'split_date',p_effective_date,'reason',v_reason,'reprice',coalesce(p_reprice,false),'old_rate',v_old_rate,'new_rate',v_new_rate,'source_folio_id',v_source_folio,'target_folio_id',v_target_folio,'scheduled',v_scheduled),v_actor);

  return v_after;
end;
$function$
;
