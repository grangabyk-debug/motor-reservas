create or replace function private.hl_prepare_checkout_maintenance_ack(
  p_reserva_id bigint,
  p_room_id bigint,
  p_checkout_date date
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v public.reservas%rowtype;
  v_block public.bloqueos%rowtype;
  v_room public.habitaciones%rowtype;
  v_details jsonb;
  v_found boolean:=false;
begin
  select * into v from public.reservas where id=p_reserva_id for update;
  if not found then return false; end if;
  if p_room_id is null or p_checkout_date is null then return false; end if;
  if coalesce(v.late_checkout,false) then return false; end if;

  select * into v_block
  from public.bloqueos b
  where b.property_id=v.property_id
    and b.habitacion_id=p_room_id
    and b.fecha_desde=p_checkout_date
    and lower(trim(coalesce(b.motivo,''))) like 'manten%'
  order by b.id
  limit 1;
  if not found then return false; end if;

  select * into v_room from public.habitaciones where id=p_room_id and property_id=v.property_id;

  if jsonb_typeof(v.habitaciones_detalle)='array' then
    select coalesce(jsonb_agg(
      case when coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id
        then e||jsonb_build_object(
          'maintenance_checkout_ack',true,
          'maintenance_checkout_block_id',v_block.id,
          'maintenance_checkout_date',p_checkout_date,
          'maintenance_checkout_ack_at',clock_timestamp()
        )
        else e end
      order by ord
    ),'[]'::jsonb),
    bool_or(coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id)
    into v_details,v_found
    from jsonb_array_elements(v.habitaciones_detalle) with ordinality t(e,ord);
  end if;

  if not coalesce(v_found,false) then
    v_details:=coalesce(case when jsonb_typeof(v.habitaciones_detalle)='array' then v.habitaciones_detalle else '[]'::jsonb end,'[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
        'habitacion_id',p_room_id,
        'nombre',coalesce(v_room.nombre,p_room_id::text),
        'categoria_asignada',coalesce(nullif(trim(v_room.tipo),''),'Habitación'),
        'fecha_entrada',public.hl_reservation_room_start_date(v.habitaciones_detalle,p_room_id,v.fecha_entrada),
        'fecha_salida',public.hl_reservation_room_planned_end_date(v.habitaciones_detalle,p_room_id,v.fecha_salida),
        'maintenance_checkout_ack',true,
        'maintenance_checkout_block_id',v_block.id,
        'maintenance_checkout_date',p_checkout_date,
        'maintenance_checkout_ack_at',clock_timestamp()
      ));
  end if;

  update public.reservas
  set habitaciones_detalle=v_details
  where id=v.id;
  return true;
end;
$$;

revoke all on function private.hl_prepare_checkout_maintenance_ack(bigint,bigint,date) from public;

create or replace function public.hl_move_reservation_atomic(
  p_reserva_id bigint,
  p_habitacion_id bigint,
  p_fecha_entrada date,
  p_fecha_salida date default null::date
)
returns reservas
language plpgsql
set search_path to 'public'
as $$
declare
  v_reserva public.reservas%rowtype;
  v_habitacion public.habitaciones%rowtype;
  v_salida date;
  v_span integer;
  v_nights integer;
  v_units integer;
  v_subtotal numeric;
  v_descuento numeric;
  v_total numeric;
  v_ops jsonb:='{}'::jsonb;
  v_arrival time;
  v_departure time;
  v_cutoff time;
  v_business_date date;
  v_start timestamp;
  v_end timestamp;
begin
  select * into v_reserva from public.reservas where id=p_reserva_id for update;
  if not found then raise exception 'Reserva inexistente' using errcode='P0002'; end if;
  if v_reserva.estado='cancelada' then raise exception 'La reserva no se puede mover'; end if;

  select * into v_habitacion from public.habitaciones
  where id=p_habitacion_id and property_id=v_reserva.property_id and activa is distinct from false;
  if not found then raise exception 'Habitación no disponible'; end if;
  if lower(coalesce(v_habitacion.estado,'')) in ('mantenimiento','fuera_servicio') then raise exception 'Habitación fuera de servicio'; end if;

  v_span:=greatest(0,v_reserva.fecha_salida-v_reserva.fecha_entrada);
  v_salida:=coalesce(p_fecha_salida,p_fecha_entrada+v_span);
  if v_salida<p_fecha_entrada then raise exception 'La salida no puede ser anterior a la entrada'; end if;

  select coalesce(operational_settings,'{}'::jsonb) into v_ops from public.hotel_os_settings where property_id=v_reserva.property_id;
  v_ops:=coalesce(v_ops,'{}'::jsonb);
  v_arrival:=private.hl_safe_time(v_reserva.hora_llegada_estimada,private.hl_safe_time(v_ops->>'checkin_time','14:00'::time));
  v_departure:=private.hl_safe_time(v_reserva.hora_salida_estimada,private.hl_safe_time(v_ops->>'checkout_time','10:00'::time));
  v_cutoff:=private.hl_safe_time(v_ops->>'business_day_cutoff','05:00'::time);
  v_start:=p_fecha_entrada::timestamp+v_arrival;
  v_end:=v_salida::timestamp+v_departure;
  if v_end<=v_start then raise exception 'La hora de salida debe ser posterior a la hora de entrada'; end if;
  if coalesce(v_reserva.tipo_estadia,'overnight')='day_use' and v_salida<>p_fecha_entrada then raise exception 'Day Use debe comenzar y terminar el mismo día'; end if;
  v_business_date:=case when coalesce(v_reserva.tipo_estadia,'overnight')='overnight' and v_arrival<v_cutoff then p_fecha_entrada-1 else p_fecha_entrada end;
  v_nights:=case when coalesce(v_reserva.tipo_estadia,'overnight')='day_use' then 0 else greatest(1,v_salida-v_business_date) end;
  v_units:=case when coalesce(v_reserva.tipo_estadia,'overnight')='day_use' then 1 else v_nights end;

  perform private.hl_prepare_checkout_maintenance_ack(p_reserva_id,p_habitacion_id,v_salida);

  if exists(
    select 1 from public.bloqueos b
    where b.habitacion_id=p_habitacion_id
      and b.property_id=v_reserva.property_id
      and tsrange(b.fecha_desde::timestamp,b.fecha_hasta::timestamp,'[)') && tsrange(v_start,v_end,'[)')
      and not (
        b.fecha_desde=v_salida
        and lower(trim(coalesce(b.motivo,''))) like 'manten%'
        and coalesce(v_reserva.late_checkout,false)=false
      )
  ) then raise exception 'La habitación está bloqueada durante ese horario' using errcode='23P01'; end if;

  if exists(
    select 1 from public.reservas r
    where r.id<>v_reserva.id
      and r.property_id=v_reserva.property_id
      and r.estado<>'cancelada'
      and coalesce(r.no_show,false)=false
      and (r.habitacion_id=p_habitacion_id or p_habitacion_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])))
      and tsrange(
        coalesce(r.ocupacion_desde_local,r.fecha_entrada::timestamp+private.hl_safe_time(r.hora_llegada_estimada,'14:00'::time)),
        coalesce(r.ocupacion_hasta_local,r.fecha_salida::timestamp+private.hl_safe_time(r.hora_salida_estimada,'10:00'::time)),
        '[)'
      ) && tsrange(v_start,v_end,'[)')
  ) then raise exception 'La habitación ya tiene una reserva durante parte de ese horario' using errcode='23P01'; end if;

  v_subtotal:=greatest(0,coalesce(v_reserva.tarifa_noche,0)*v_units+coalesce(v_reserva.cochera_total,0)+coalesce(v_reserva.extra,0)+coalesce(v_reserva.early_checkin_importe,0)+coalesce(v_reserva.late_checkout_importe,0));
  v_descuento:=case when v_reserva.descuento_tipo='porcentaje' then v_subtotal*coalesce(v_reserva.descuento_valor,0)/100 else coalesce(v_reserva.descuento_importe,v_reserva.descuento_valor,0) end;
  v_total:=greatest(0,v_subtotal-v_descuento);

  update public.reservas
  set habitacion_id=p_habitacion_id,
      alojamiento_id=coalesce(v_habitacion.alojamiento_id,alojamiento_id),
      fecha_entrada=p_fecha_entrada,
      fecha_salida=v_salida,
      noches=v_nights,
      subtotal=v_subtotal,
      descuento_importe=v_descuento,
      precio_total=v_total,
      precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end,
      habitaciones_ids=case when habitaciones_ids is null or cardinality(habitaciones_ids)=0 then array[p_habitacion_id] when v_reserva.habitacion_id=any(habitaciones_ids) then array_replace(habitaciones_ids,v_reserva.habitacion_id,p_habitacion_id) else habitaciones_ids end,
      habitaciones_detalle=case when jsonb_typeof(habitaciones_detalle)='array' then (
        select coalesce(jsonb_agg(
          case when nullif(elem->>'habitacion_id','')::bigint=v_reserva.habitacion_id then elem||jsonb_build_object(
            'habitacion_id',p_habitacion_id,
            'nombre',v_habitacion.nombre,
            'categoria_asignada',coalesce(nullif(trim(v_habitacion.tipo),''),'Habitación'),
            'noches',v_nights
          ) else elem end
        ),'[]'::jsonb)
        from jsonb_array_elements(habitaciones_detalle) elem
      ) else habitaciones_detalle end
  where id=v_reserva.id
  returning * into v_reserva;
  return v_reserva;
end;
$$;

create or replace function public.hl_extend_reservation_room_atomic(
  p_reserva_id bigint,
  p_room_id bigint,
  p_new_end date
)
returns reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v public.reservas%rowtype;
  v_room public.habitaciones%rowtype;
  v_detail jsonb;
  v_old_start date;
  v_old_end date;
  v_old_rate numeric;
  v_old_nights integer;
  v_new_nights integer;
  v_extra_nights integer;
  v_extra_net numeric;
  v_extra_avg numeric;
  v_new_room_total numeric;
  v_new_avg numeric;
  v_details jsonb;
  v_new_global_end date;
  v_new_net numeric;
  v_vat numeric;
  v_total numeric;
  v_total_rate numeric;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into v from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception']::text[]) then raise exception using errcode='42501',message='No tenés permisos para extender esta habitación.'; end if;
  if v.estado in('cancelada','finalizada','fusionada') or coalesce(v.no_show,false) then raise exception using errcode='P0001',message='La reserva ya no admite extensiones.'; end if;
  if not(p_room_id=any(coalesce(v.habitaciones_ids,array[]::bigint[])||array[v.habitacion_id])) then raise exception using errcode='22023',message='La habitación no pertenece a la reserva.'; end if;
  if exists(select 1 from public.hotel_finance_documents d where d.property_id=v.property_id and d.reservation_id=v.id and coalesce(d.total,0)>0 and lower(coalesce(d.status,'')) not in('draft','borrador','cancelled','canceled','cancelada','anulado','anulada','void') and d.issued_at is not null) then raise exception using errcode='P0001',message='La reserva tiene comprobantes emitidos. Rectificá la facturación antes de extenderla.'; end if;

  select * into v_room from public.habitaciones where id=p_room_id and property_id=v.property_id and activa is distinct from false;
  if not found then raise exception using errcode='P0002',message='Habitación inexistente.'; end if;
  v_old_start:=public.hl_reservation_room_start_date(v.habitaciones_detalle,p_room_id,v.fecha_entrada);
  v_old_end:=public.hl_reservation_room_planned_end_date(v.habitaciones_detalle,p_room_id,v.fecha_salida);
  if p_new_end is null or p_new_end<=v_old_end then raise exception using errcode='22023',message='La nueva salida debe ser posterior a la salida actual de la habitación.'; end if;

  if exists(
    select 1 from public.reservas r
    where r.property_id=v.property_id
      and r.id<>v.id
      and r.estado not in('cancelada','fusionada')
      and coalesce(r.no_show,false)=false
      and p_room_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id])
      and public.hl_reservation_room_start_date(r.habitaciones_detalle,p_room_id,r.fecha_entrada)<p_new_end
      and public.hl_reservation_room_effective_end_date(r.habitaciones_detalle,r.room_checkout_dates,p_room_id,r.fecha_salida)>v_old_end
  ) then raise exception using errcode='23P01',message=format('La habitación %s no está disponible para toda la extensión.',coalesce(v_room.nombre,p_room_id::text)); end if;

  if exists(
    select 1 from public.bloqueos b
    where b.property_id=v.property_id
      and b.habitacion_id=p_room_id
      and b.fecha_desde<p_new_end
      and b.fecha_hasta>v_old_end
  ) then raise exception using errcode='23P01',message=format('La habitación %s tiene un bloqueo durante la extensión.',coalesce(v_room.nombre,p_room_id::text)); end if;

  perform private.hl_prepare_checkout_maintenance_ack(p_reserva_id,p_room_id,p_new_end);

  select q.nights,q.net_total,q.avg_rate into v_extra_nights,v_extra_net,v_extra_avg
  from private.hl_calendar_room_pricing(v.property_id,p_room_id,v_old_end,p_new_end) q;
  select e into v_detail
  from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id
  order by coalesce(nullif(e->>'fecha_salida','')::date,v.fecha_salida) desc
  limit 1;
  v_old_rate:=greatest(0,coalesce(nullif(v_detail->>'tarifa_noche','')::numeric,v.tarifa_noche,v_room.precio,0));
  v_old_nights:=greatest(1,v_old_end-v_old_start);
  v_new_nights:=greatest(1,p_new_end-v_old_start);
  v_new_room_total:=round(v_old_rate*v_old_nights+v_extra_net,2);
  v_new_avg:=round(v_new_room_total/v_new_nights,6);

  select coalesce(jsonb_agg(
    case when ord=target_ord then e||jsonb_build_object(
      'fecha_salida',p_new_end,
      'noches',v_new_nights,
      'tarifa_noche',v_new_avg,
      'extension_from',v_old_end,
      'extension_nights',v_extra_nights,
      'extension_rate_net',v_extra_avg,
      'extension_net_total',v_extra_net,
      'rate_segments',coalesce(e->'rate_segments','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
        'kind','extension','from',v_old_end,'to',p_new_end,'nights',v_extra_nights,'avg_rate_net',v_extra_avg,'net_total',v_extra_net
      ))
    ) else e end
    order by ord
  ),'[]'::jsonb)
  into v_details
  from (
    select e,ord,max(ord) filter(where coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id) over() target_ord
    from jsonb_array_elements(coalesce((select habitaciones_detalle from public.reservas where id=v.id),'[]'::jsonb)) with ordinality t(e,ord)
  ) q;

  select coalesce(sum(case when coalesce(e->>'segment_role','') in('previous_room','cancelled_room') then 0 else greatest(0,coalesce(nullif(e->>'tarifa_noche','')::numeric,0)) end),0)
  into v_total_rate
  from jsonb_array_elements(v_details) e;

  v_new_global_end:=greatest(v.fecha_salida,p_new_end);
  v_new_net:=round(coalesce(v.precio_sin_impuestos_nacionales,v.subtotal,v.precio_total,0)+v_extra_net,2);
  v_vat:=case when coalesce(v.impuestos_desglosados,false) then round(v_new_net*greatest(0,coalesce(v.iva_porcentaje,0))/100,2) else 0 end;
  v_total:=round(v_new_net+v_vat,2);

  update public.reservas
  set habitaciones_detalle=v_details,
      fecha_salida=v_new_global_end,
      tarifa_noche=v_total_rate,
      subtotal=v_new_net,
      precio_sin_impuestos_nacionales=v_new_net,
      iva_importe=v_vat,
      precio_total=v_total,
      precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end
  where id=v.id
  returning * into v;

  perform private.hl_sync_reservation_folios_internal(v.id);
  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(v.property_id,v.id,'room_extension','Extensión de habitación',format('Hab. %s · %s → %s · %s noche(s) nuevas con tarifa vigente',coalesce(v_room.nombre,p_room_id::text),v_old_end,p_new_end,v_extra_nights),jsonb_build_object('room_id',p_room_id,'old_end',v_old_end,'new_end',p_new_end,'extra_nights',v_extra_nights,'extra_net',v_extra_net,'extra_avg_rate',v_extra_avg),auth.uid());
  return v;
end;
$$;
