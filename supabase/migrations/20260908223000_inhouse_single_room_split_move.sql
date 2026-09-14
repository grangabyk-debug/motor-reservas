create or replace function public.hl_move_inhouse_room_segment_atomic(
  p_reserva_id bigint,
  p_from_room_id bigint,
  p_to_room_id bigint,
  p_effective_date date,
  p_reprice boolean default false,
  p_reason text default null
)
returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
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
  v_total_rate numeric := 0;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_net numeric := 0;
  v_vat_rate numeric := 0;
  v_vat numeric := 0;
  v_total numeric := 0;
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
  v_operation_group uuid := gen_random_uuid();
  v_master_before uuid;
  v_master_after uuid;
  v_source_folio uuid;
  v_target_folio uuid;
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
  if p_effective_date>v_today then
    raise exception using errcode='22023',message='El cambio de habitación no puede registrarse con una fecha futura.';
  end if;

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
    where r.property_id=v_before.property_id and r.id<>v_before.id and r.estado<>'cancelada' and coalesce(r.no_show,false)=false
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
  v_new_rate:=case when coalesce(p_reprice,false) then greatest(0,coalesce(v_target.precio,0)) else v_old_rate end;
  v_rate_delta:=round((v_new_rate-v_old_rate)*v_remaining_nights,2);
  v_total_rate:=greatest(0,coalesce(v_before.tarifa_noche,0)-v_old_rate+v_new_rate);

  select coalesce(jsonb_agg(
    case when coalesce(d->>'habitacion_id','') ~ '^\d+$' and (d->>'habitacion_id')::bigint=p_from_room_id then
      (d - 'movement_locked' - 'movement_lock_reason' - 'movement_locked_at' - 'movement_locked_by') || jsonb_build_object(
        'fecha_salida',p_effective_date,
        'noches',greatest(1,p_effective_date-v_start),
        'segment_role','previous_room',
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
    (v_source_detail - 'movement_locked' - 'movement_lock_reason' - 'movement_locked_at' - 'movement_locked_by') || jsonb_build_object(
      'habitacion_id',p_to_room_id,
      'nombre',v_target.nombre,
      'categoria_asignada',coalesce(nullif(trim(v_target.tipo),''),'Habitación'),
      'tarifa_noche',v_new_rate,
      'fecha_entrada',p_effective_date,
      'fecha_salida',v_end,
      'noches',v_remaining_nights,
      'segment_role','active_room',
      'moved_from_room_id',p_from_room_id,
      'split_effective_date',p_effective_date,
      'split_reason',v_reason,
      'moved_at',now()
    )
  );

  select array_agg(x order by ord) into v_new_ids from (
    select p_to_room_id as x,0::bigint as ord
    union all
    select x,ord from unnest(v_existing_ids) with ordinality as a(x,ord) where x<>p_to_room_id
  ) q;
  v_new_checkout_dates:=coalesce(v_before.room_checkout_dates,'{}'::jsonb)||jsonb_build_object(p_from_room_id::text,p_effective_date);

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

  update public.hotel_reservation_guests set room_id=p_to_room_id,updated_at=now()
  where property_id=v_before.property_id and reservation_id=v_before.id and room_id=p_from_room_id and checked_out_at is null;
  update public.hotel_group_rooming set room_id=p_to_room_id,updated_at=now()
  where property_id=v_before.property_id and reservation_id=v_before.id and room_id=p_from_room_id;

  update public.reservas set
    habitacion_id=p_to_room_id,
    alojamiento_id=coalesce(v_target.alojamiento_id,alojamiento_id),
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

  update public.habitaciones set estado='sucia'
  where id=p_from_room_id and property_id=v_before.property_id and lower(coalesce(estado,'')) not in ('mantenimiento','fuera_servicio');

  perform private.hl_sync_reservation_folios_internal(v_after.id);

  select id into v_source_folio from public.hotel_folios where reservation_id=v_after.id and room_id=p_from_room_id and folio_type='room' limit 1;
  select id into v_target_folio from public.hotel_folios where reservation_id=v_after.id and room_id=p_to_room_id and folio_type='room' limit 1;
  select id into v_master_after from public.hotel_folios where reservation_id=v_after.id and folio_type='master' order by created_at limit 1;

  if v_source_folio is not null then
    update public.hotel_folios set label='Habitación '||coalesce(v_source.nombre,p_from_room_id::text)||' · hasta '||p_effective_date::text,is_primary=false,sort_order=1,updated_at=now() where id=v_source_folio;
  end if;
  if v_target_folio is not null then
    update public.hotel_folios set label='Habitación '||coalesce(v_target.nombre,p_to_room_id::text)||' · desde '||p_effective_date::text,is_primary=true,sort_order=2,updated_at=now() where id=v_target_folio;
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
    v_before.property_id,v_before.id,'room','Reserva dividida por cambio de habitación',
    format('Hab. %s hasta %s → Hab. %s desde %s hasta %s · Motivo: %s%s',coalesce(v_source.nombre,p_from_room_id::text),p_effective_date,coalesce(v_target.nombre,p_to_room_id::text),p_effective_date,v_end,v_reason,case when p_reprice then format(' · tarifa del nuevo tramo %s → %s',v_old_rate,v_new_rate) else ' · tarifa original mantenida' end),
    jsonb_build_object('mid_stay_split',true,'from_room_id',p_from_room_id,'to_room_id',p_to_room_id,'split_date',p_effective_date,'room_start',v_start,'room_end',v_end,'reason',v_reason,'before_rate',v_old_rate,'after_rate',v_new_rate,'reprice',coalesce(p_reprice,false),'source_folio_id',v_source_folio,'target_folio_id',v_target_folio),
    v_actor,null
  );
  insert into public.hotel_planning_operation_log(operation_group,property_id,action,reservation_id,before_state,after_state,meta,created_by)
  values(v_operation_group,v_before.property_id,'split_room_move',v_before.id,private.hl_planning_reservation_state(v_before),private.hl_planning_reservation_state(v_after),jsonb_build_object('mid_stay_split',true,'from_room_id',p_from_room_id,'to_room_id',p_to_room_id,'split_date',p_effective_date,'reason',v_reason,'reprice',coalesce(p_reprice,false),'old_rate',v_old_rate,'new_rate',v_new_rate,'source_folio_id',v_source_folio,'target_folio_id',v_target_folio),v_actor);

  return v_after;
end;
$function$;

revoke all on function public.hl_move_inhouse_room_segment_atomic(bigint,bigint,bigint,date,boolean,text) from public;
revoke all on function public.hl_move_inhouse_room_segment_atomic(bigint,bigint,bigint,date,boolean,text) from anon;
grant execute on function public.hl_move_inhouse_room_segment_atomic(bigint,bigint,bigint,date,boolean,text) to authenticated;
grant execute on function public.hl_move_inhouse_room_segment_atomic(bigint,bigint,bigint,date,boolean,text) to service_role;
