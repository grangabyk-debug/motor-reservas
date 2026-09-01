create or replace function public.hl_change_reservation_room_atomic(
  p_reserva_id bigint,
  p_habitacion_id bigint,
  p_reprice boolean default false
)
returns public.reservas
language plpgsql
set search_path to 'public','private','pg_temp'
as $$
declare
  v public.reservas%rowtype;
  v_room public.habitaciones%rowtype;
  v_start timestamp;
  v_end timestamp;
  v_units integer;
  v_old_room_component numeric;
  v_non_room numeric;
  v_subtotal numeric;
  v_discount numeric;
  v_total numeric;
begin
  select * into v from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002', message='Reserva inexistente.'; end if;
  if v.estado='cancelada' or coalesce(v.no_show,false) then raise exception using errcode='22023', message='La reserva no admite cambios de habitación.'; end if;
  if coalesce(cardinality(v.habitaciones_ids),case when v.habitacion_id is null then 0 else 1 end)>1 then raise exception using errcode='22023', message='La reserva ocupa varias habitaciones. Usá una operación grupal.'; end if;

  select * into v_room from public.habitaciones
  where id=p_habitacion_id and property_id=v.property_id and activa is distinct from false;
  if not found then raise exception using errcode='P0002', message='Habitación inexistente o inactiva.'; end if;
  if lower(coalesce(v_room.estado,'')) in ('mantenimiento','fuera_servicio') then raise exception using errcode='23P01', message='La habitación está fuera de servicio.'; end if;

  v_start:=coalesce(v.ocupacion_desde_local,v.fecha_entrada::timestamp+private.hl_safe_time(v.hora_llegada_estimada,'14:00'::time));
  v_end:=coalesce(v.ocupacion_hasta_local,v.fecha_salida::timestamp+private.hl_safe_time(v.hora_salida_estimada,'10:00'::time));

  if exists(
    select 1 from public.bloqueos b
    where b.property_id=v.property_id and b.habitacion_id=p_habitacion_id
      and tsrange(b.fecha_desde::timestamp,b.fecha_hasta::timestamp,'[)') && tsrange(v_start,v_end,'[)')
  ) then raise exception using errcode='23P01', message='La habitación tiene un bloqueo operativo durante esa estadía.'; end if;

  if exists(
    select 1 from public.reservas r
    where r.property_id=v.property_id and r.id<>v.id and r.estado<>'cancelada' and coalesce(r.no_show,false)=false
      and p_habitacion_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id])
      and tsrange(coalesce(r.ocupacion_desde_local,r.fecha_entrada::timestamp+private.hl_safe_time(r.hora_llegada_estimada,'14:00'::time)),coalesce(r.ocupacion_hasta_local,r.fecha_salida::timestamp+private.hl_safe_time(r.hora_salida_estimada,'10:00'::time)),'[)') && tsrange(v_start,v_end,'[)')
  ) then raise exception using errcode='23P01', message='La habitación ya está ocupada durante parte de esa estadía.'; end if;

  v_units:=case when coalesce(v.tipo_estadia,'overnight')='day_use' then 1 else greatest(1,coalesce(v.noches,v.fecha_salida-v.fecha_entrada,1)) end;
  if p_reprice then
    v_old_room_component:=greatest(0,coalesce(v.tarifa_noche,0)*v_units);
    v_non_room:=greatest(0,case when coalesce(v.subtotal,0)>0 then v.subtotal-v_old_room_component else coalesce(v.cochera_total,0)+coalesce(v.extra,0)+coalesce(v.early_checkin_importe,0)+coalesce(v.late_checkout_importe,0)+coalesce(v.mascotas_total,0) end);
    v_subtotal:=greatest(0,coalesce(v_room.precio,0)*v_units+v_non_room);
    v_discount:=case when v.descuento_tipo='porcentaje' then v_subtotal*coalesce(v.descuento_valor,0)/100 else coalesce(v.descuento_importe,v.descuento_valor,0) end;
    v_total:=greatest(0,v_subtotal-v_discount);
  else
    v_subtotal:=v.subtotal;
    v_discount:=v.descuento_importe;
    v_total:=v.precio_total;
  end if;

  update public.reservas
  set habitacion_id=p_habitacion_id,
      alojamiento_id=coalesce(v_room.alojamiento_id,alojamiento_id),
      habitaciones_ids=array[p_habitacion_id],
      habitaciones_detalle=case when jsonb_typeof(habitaciones_detalle)='array' then (
        select coalesce(jsonb_agg(jsonb_set(elem,'{habitacion_id}',to_jsonb(p_habitacion_id),true)),'[]'::jsonb)
        from jsonb_array_elements(habitaciones_detalle) elem
      ) else habitaciones_detalle end,
      tarifa_noche=case when p_reprice then coalesce(v_room.precio,0) else tarifa_noche end,
      subtotal=case when p_reprice then v_subtotal else subtotal end,
      descuento_importe=case when p_reprice then v_discount else descuento_importe end,
      precio_total=case when p_reprice then v_total else precio_total end,
      precio_total_usd=case when p_reprice and coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end
  where id=v.id
  returning * into v;
  return v;
end;
$$;

create or replace function public.hl_swap_reservations_atomic(
  p_reserva_a bigint,
  p_reserva_b bigint
)
returns jsonb
language plpgsql
set search_path to 'public','private','pg_temp'
as $$
declare
  a public.reservas%rowtype;
  b public.reservas%rowtype;
  a_start timestamp;
  a_end timestamp;
  b_start timestamp;
  b_end timestamp;
  a_room bigint;
  b_room bigint;
begin
  if p_reserva_a=p_reserva_b then raise exception using errcode='22023', message='Elegí dos reservas diferentes.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hl-swap:'||least(p_reserva_a,p_reserva_b)::text||':'||greatest(p_reserva_a,p_reserva_b)::text,0));
  select * into a from public.reservas where id=p_reserva_a for update;
  select * into b from public.reservas where id=p_reserva_b for update;
  if a.id is null or b.id is null then raise exception using errcode='P0002', message='No pudimos encontrar una de las reservas.'; end if;
  if a.property_id is distinct from b.property_id then raise exception using errcode='22023', message='Las reservas deben pertenecer al mismo hotel.'; end if;
  if a.estado='cancelada' or b.estado='cancelada' or coalesce(a.no_show,false) or coalesce(b.no_show,false) then raise exception using errcode='22023', message='No se pueden intercambiar reservas canceladas o No Show.'; end if;
  if a.habitacion_id is null or b.habitacion_id is null or a.habitacion_id=b.habitacion_id then raise exception using errcode='22023', message='Las dos reservas necesitan habitaciones diferentes.'; end if;
  if coalesce(cardinality(a.habitaciones_ids),1)>1 or coalesce(cardinality(b.habitaciones_ids),1)>1 then raise exception using errcode='22023', message='El intercambio simple no admite reservas multi-habitación.'; end if;

  a_room:=a.habitacion_id; b_room:=b.habitacion_id;
  a_start:=coalesce(a.ocupacion_desde_local,a.fecha_entrada::timestamp+private.hl_safe_time(a.hora_llegada_estimada,'14:00'::time));
  a_end:=coalesce(a.ocupacion_hasta_local,a.fecha_salida::timestamp+private.hl_safe_time(a.hora_salida_estimada,'10:00'::time));
  b_start:=coalesce(b.ocupacion_desde_local,b.fecha_entrada::timestamp+private.hl_safe_time(b.hora_llegada_estimada,'14:00'::time));
  b_end:=coalesce(b.ocupacion_hasta_local,b.fecha_salida::timestamp+private.hl_safe_time(b.hora_salida_estimada,'10:00'::time));

  if exists(select 1 from public.bloqueos x where x.property_id=a.property_id and x.habitacion_id=b_room and tsrange(x.fecha_desde::timestamp,x.fecha_hasta::timestamp,'[)') && tsrange(a_start,a_end,'[)')) then raise exception using errcode='23P01', message='La habitación destino de la primera reserva está bloqueada.'; end if;
  if exists(select 1 from public.bloqueos x where x.property_id=a.property_id and x.habitacion_id=a_room and tsrange(x.fecha_desde::timestamp,x.fecha_hasta::timestamp,'[)') && tsrange(b_start,b_end,'[)')) then raise exception using errcode='23P01', message='La habitación destino de la segunda reserva está bloqueada.'; end if;

  if exists(
    select 1 from public.reservas r where r.property_id=a.property_id and r.id not in(a.id,b.id) and r.estado<>'cancelada' and coalesce(r.no_show,false)=false
      and b_room=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id])
      and tsrange(coalesce(r.ocupacion_desde_local,r.fecha_entrada::timestamp+private.hl_safe_time(r.hora_llegada_estimada,'14:00'::time)),coalesce(r.ocupacion_hasta_local,r.fecha_salida::timestamp+private.hl_safe_time(r.hora_salida_estimada,'10:00'::time)),'[)') && tsrange(a_start,a_end,'[)')
  ) then raise exception using errcode='23P01', message='La habitación destino de la primera reserva tiene otro huésped en esas fechas.'; end if;
  if exists(
    select 1 from public.reservas r where r.property_id=a.property_id and r.id not in(a.id,b.id) and r.estado<>'cancelada' and coalesce(r.no_show,false)=false
      and a_room=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id])
      and tsrange(coalesce(r.ocupacion_desde_local,r.fecha_entrada::timestamp+private.hl_safe_time(r.hora_llegada_estimada,'14:00'::time)),coalesce(r.ocupacion_hasta_local,r.fecha_salida::timestamp+private.hl_safe_time(r.hora_salida_estimada,'10:00'::time)),'[)') && tsrange(b_start,b_end,'[)')
  ) then raise exception using errcode='23P01', message='La habitación destino de la segunda reserva tiene otro huésped en esas fechas.'; end if;

  update public.reservas set no_show=true where id in(a.id,b.id);
  update public.reservas set habitacion_id=b_room, habitaciones_ids=array[b_room], habitaciones_detalle=case when jsonb_typeof(habitaciones_detalle)='array' then (select coalesce(jsonb_agg(jsonb_set(elem,'{habitacion_id}',to_jsonb(b_room),true)),'[]'::jsonb) from jsonb_array_elements(habitaciones_detalle) elem) else habitaciones_detalle end where id=a.id;
  update public.reservas set habitacion_id=a_room, habitaciones_ids=array[a_room], habitaciones_detalle=case when jsonb_typeof(habitaciones_detalle)='array' then (select coalesce(jsonb_agg(jsonb_set(elem,'{habitacion_id}',to_jsonb(a_room),true)),'[]'::jsonb) from jsonb_array_elements(habitaciones_detalle) elem) else habitaciones_detalle end where id=b.id;
  update public.reservas set no_show=false where id in(a.id,b.id);

  return jsonb_build_object('reservation_a',a.id,'room_a',b_room,'reservation_b',b.id,'room_b',a_room);
end;
$$;

revoke execute on function public.hl_change_reservation_room_atomic(bigint,bigint,boolean) from anon;
revoke execute on function public.hl_swap_reservations_atomic(bigint,bigint) from anon;
grant execute on function public.hl_change_reservation_room_atomic(bigint,bigint,boolean) to authenticated;
grant execute on function public.hl_swap_reservations_atomic(bigint,bigint) to authenticated;
