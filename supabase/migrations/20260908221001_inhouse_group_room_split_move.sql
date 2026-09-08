create or replace function public.hl_move_inhouse_group_room_segment_atomic(
  p_reserva_id bigint,
  p_from_room_id bigint,
  p_to_room_id bigint,
  p_effective_date date,
  p_reprice boolean default false
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
  v_new_details jsonb;
  v_new_ids bigint[];
  v_new_checkout_dates jsonb;
  v_start date;
  v_end date;
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
  v_operation_group uuid := gen_random_uuid();
begin
  if v_actor is null then
    raise exception using errcode='42501',message='Tenés que iniciar sesión.';
  end if;
  if p_from_room_id is null or p_to_room_id is null or p_from_room_id=p_to_room_id then
    raise exception using errcode='22023',message='Elegí una habitación de origen y otra de destino.';
  end if;
  if p_effective_date is null then
    raise exception using errcode='22007',message='Indicá desde qué fecha se realiza el cambio de habitación.';
  end if;

  select * into v_before from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v_before.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para modificar esta reserva.';
  end if;
  if lower(coalesce(v_before.estado,'')) not in ('alojado','inhouse','in_house','in house') then
    raise exception using errcode='22023',message='El corte de estadía se usa solamente con huéspedes ya alojados.';
  end if;
  if v_before.estado in ('cancelada','finalizada') or coalesce(v_before.no_show,false) then
    raise exception using errcode='P0001',message='Esta reserva ya no admite cambios de habitación.';
  end if;
  if coalesce(cardinality(v_before.habitaciones_ids),case when v_before.habitacion_id is null then 0 else 1 end)<=1 then
    raise exception using errcode='22023',message='Esta operación es para una habitación dentro de una reserva grupal.';
  end if;
  if not (p_from_room_id=any(coalesce(v_before.habitaciones_ids,array[]::bigint[])||array[v_before.habitacion_id])) then
    raise exception using errcode='22023',message='La habitación de origen no pertenece a esta reserva.';
  end if;
  if coalesce(v_before.room_checkout_dates,'{}'::jsonb) ? p_from_room_id::text then
    raise exception using errcode='P0001',message='Ese tramo ya fue cerrado y no se puede volver a mover.';
  end if;
  if p_to_room_id=any(coalesce(v_before.habitaciones_ids,array[]::bigint[])||array[v_before.habitacion_id]) then
    raise exception using errcode='22023',message='La habitación de destino ya forma parte de esta reserva.';
  end if;

  if exists(
    select 1 from public.hotel_finance_documents d
    where d.property_id=v_before.property_id and d.reservation_id=v_before.id and coalesce(d.total,0)>0
      and lower(coalesce(d.document_type,'')) not like '%proforma%'
      and lower(coalesce(d.document_type,'')) not like '%presupuesto%'
      and lower(coalesce(d.status,'')) not in ('draft','borrador','cancelled','canceled','cancelada','anulado','anulada','void')
      and (d.issued_at is not null or lower(coalesce(d.status,'')) in ('issued','emitida','emitido','sent','enviada','enviado','paid','pagada','pagado','final','fiscal'))
  ) then
    raise exception using errcode='P0001',message='La reserva ya tiene un comprobante emitido. Rectificá el comprobante antes de cambiar la habitación.';
  end if;

  select e into v_source_detail
  from jsonb_array_elements(coalesce(v_before.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','') ~ '^\d+$' and (e->>'habitacion_id')::bigint=p_from_room_id
  limit 1;
  if v_source_detail is null then raise exception using errcode='P0002',message='No encontramos el detalle de esa habitación dentro del grupo.'; end if;
  if lower(coalesce(v_source_detail->>'movement_locked','false'))='true' then
    raise exception using errcode='P0001',message='Esta habitación tiene bloqueado el movimiento. Desbloqueala antes de reasignarla.';
  end if;

  select * into v_source from public.habitaciones where id=p_from_room_id and property_id=v_before.property_id;
  select * into v_target from public.habitaciones where id=p_to_room_id and property_id=v_before.property_id and activa is distinct from false;
  if not found then raise exception using errcode='P0002',message='Habitación de destino inexistente o inactiva.'; end if;
  if lower(coalesce(v_target.estado,'')) in ('mantenimiento','fuera_servicio') then
    raise exception using errcode='23P01',message='La habitación de destino está fuera de servicio.';
  end if;

  v_start:=public.hl_reservation_room_start_date(v_before.habitaciones_detalle,p_from_room_id,v_before.fecha_entrada);
  v_end:=public.hl_reservation_room_planned_end_date(v_before.habitaciones_detalle,p_from_room_id,v_before.fecha_salida);
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

  v_old_rate:=greatest(0,coalesce(nullif(v_source_detail->>'tarifa_noche','')::numeric,v_source.precio,0));
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
        'moved_at',now()
      )
    else d end order by ord
  ),'[]'::jsonb)
  into v_new_details
  from jsonb_array_elements(coalesce(v_before.habitaciones_detalle,'[]'::jsonb)) with ordinality as t(d,ord);

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
      'moved_at',now()
    )
  );

  select array_agg(x order by ord) into v_new_ids
  from (
    select x,ord from unnest(coalesce(v_before.habitaciones_ids,array[v_before.habitacion_id]::bigint[])) with ordinality as a(x,ord)
    union all
    select p_to_room_id,coalesce(cardinality(v_before.habitaciones_ids),1)+1
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

  update public.hotel_reservation_guests set room_id=p_to_room_id,updated_at=now()
  where property_id=v_before.property_id and reservation_id=v_before.id and room_id=p_from_room_id and checked_out_at is null;
  update public.hotel_group_rooming set room_id=p_to_room_id,updated_at=now()
  where property_id=v_before.property_id and reservation_id=v_before.id and room_id=p_from_room_id;

  update public.reservas set
    habitacion_id=case when habitacion_id=p_from_room_id then p_to_room_id else habitacion_id end,
    alojamiento_id=case when habitacion_id=p_from_room_id then coalesce(v_target.alojamiento_id,alojamiento_id) else alojamiento_id end,
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

  update public.habitaciones set estado='sucia' where id=p_from_room_id and property_id=v_before.property_id and lower(coalesce(estado,'')) not in ('mantenimiento','fuera_servicio');

  perform private.hl_sync_reservation_folios_internal(v_after.id);

  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
  values(
    v_before.property_id,v_before.id,'room','Cambio de habitación durante la estadía',
    format('Hab. %s hasta %s → Hab. %s desde %s hasta %s%s',coalesce(v_source.nombre,p_from_room_id::text),p_effective_date,coalesce(v_target.nombre,p_to_room_id::text),p_effective_date,v_end,case when p_reprice then format(' · tarifa del nuevo tramo %s → %s',v_old_rate,v_new_rate) else ' · tarifa original mantenida' end),
    jsonb_build_object('mid_stay_split',true,'from_room_id',p_from_room_id,'to_room_id',p_to_room_id,'split_date',p_effective_date,'room_start',v_start,'room_end',v_end,'before_rate',v_old_rate,'after_rate',v_new_rate,'reprice',coalesce(p_reprice,false)),
    v_actor,null
  );
  insert into public.hotel_planning_operation_log(operation_group,property_id,action,reservation_id,before_state,after_state,meta,created_by)
  values(v_operation_group,v_before.property_id,'split_room_move',v_before.id,private.hl_planning_reservation_state(v_before),private.hl_planning_reservation_state(v_after),jsonb_build_object('mid_stay_split',true,'from_room_id',p_from_room_id,'to_room_id',p_to_room_id,'split_date',p_effective_date,'reprice',coalesce(p_reprice,false),'old_rate',v_old_rate,'new_rate',v_new_rate),v_actor);

  return v_after;
end;
$function$;

revoke all on function public.hl_move_inhouse_group_room_segment_atomic(bigint,bigint,bigint,date,boolean) from public;
revoke all on function public.hl_move_inhouse_group_room_segment_atomic(bigint,bigint,bigint,date,boolean) from anon;
grant execute on function public.hl_move_inhouse_group_room_segment_atomic(bigint,bigint,bigint,date,boolean) to authenticated;
