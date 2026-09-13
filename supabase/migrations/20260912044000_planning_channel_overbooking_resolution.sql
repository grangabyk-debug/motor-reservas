-- Resolve real OTA overbookings from Planning without confusing mapping conflicts.
-- Keeps the existing public RPC signature used by PlanningUnassigned.

create or replace function public.hl_assign_channel_booking_room_atomic(
  p_booking_room_id uuid,
  p_habitacion_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_br public.hotel_channel_booking_rooms%rowtype;
  v_state public.hotel_channel_booking_state%rowtype;
  v_res public.reservas%rowtype;
  v_res_after public.reservas%rowtype;
  v_room public.habitaciones%rowtype;
  v_total integer := 0;
  v_pending integer := 0;
  v_pending_overbooked integer := 0;
  v_assigned integer := 0;
  v_new_status text;
  v_details jsonb;
  v_detail_matched boolean := false;
begin
  if v_uid is null then
    raise exception using errcode='42501', message='Tenés que iniciar sesión.';
  end if;

  select * into v_br
  from public.hotel_channel_booking_rooms
  where id = p_booking_room_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Pendiente OTA inexistente.';
  end if;

  select * into v_state
  from public.hotel_channel_booking_state
  where id = v_br.booking_state_id
  for update;

  if not found or v_state.reservation_id is null then
    raise exception using errcode='P0002', message='La reserva OTA vinculada no existe.';
  end if;

  if not private.user_has_property_role(
    v_state.property_id,
    array['owner','admin','manager','reception']::text[]
  ) then
    raise exception using errcode='42501', message='No tenés permisos para asignar habitaciones.';
  end if;

  if lower(coalesce(v_state.assignment_status,'')) not in ('overbooked','partial','unassigned') then
    raise exception using errcode='P0001', message='Esta reserva ya no tiene una asignación pendiente para resolver.';
  end if;

  if lower(coalesce(v_state.conflict_state,'')) = 'mapping_required'
     or v_br.local_room_type_id is null then
    raise exception using errcode='P0001', message='Primero resolvé el mapeo de habitación en Channel Manager.';
  end if;

  if lower(coalesce(v_state.last_revision_status,'')) in ('cancelled','canceled','cancelada','anulada') then
    raise exception using errcode='P0001', message='La reserva OTA fue cancelada y ya no admite asignación.';
  end if;

  if v_br.local_room_id is not null
     or lower(coalesce(v_br.assignment_status,'')) not in ('overbooked','unassigned') then
    raise exception using errcode='P0001', message='Esta unidad OTA ya no está pendiente de asignación.';
  end if;

  select * into v_res
  from public.reservas
  where id = v_state.reservation_id
  for update;

  if not found
     or lower(coalesce(v_res.estado,'')) in ('cancelada','cancelled','anulada','canceled','finalizada')
     or coalesce(v_res.no_show,false) then
    raise exception using errcode='P0001', message='La reserva ya no admite asignación.';
  end if;

  -- Lock the physical room before the final availability checks. Two receptionists
  -- resolving overbookings against the same room are serialized by this row lock.
  select * into v_room
  from public.habitaciones
  where id = p_habitacion_id
    and property_id = v_state.property_id
    and activa is distinct from false
  for update;

  if not found then
    raise exception using errcode='P0002', message='Habitación inexistente o inactiva.';
  end if;

  if lower(coalesce(v_room.estado,'')) in ('mantenimiento','fuera_servicio','fuera de servicio') then
    raise exception using errcode='23P01', message='La habitación está fuera de servicio.';
  end if;

  if v_room.room_type_id is distinct from v_br.local_room_type_id then
    raise exception using errcode='P0001', message='La habitación elegida no corresponde a la categoría vendida por la OTA.';
  end if;

  if v_br.arrival_date is null
     or v_br.departure_date is null
     or v_br.departure_date <= v_br.arrival_date then
    raise exception using errcode='22007', message='La unidad OTA tiene fechas inválidas.';
  end if;

  -- Never assign the same physical room twice inside a multi-room OTA booking.
  if exists(
    select 1
    from public.hotel_channel_booking_rooms other
    where other.booking_state_id = v_state.id
      and other.id <> v_br.id
      and other.local_room_id = p_habitacion_id
      and lower(coalesce(other.assignment_status,'')) = 'assigned'
  ) then
    raise exception using errcode='23P01', message='Esa habitación ya está asignada a otra unidad de la misma reserva.';
  end if;

  -- Final server-side recheck after locking the room: operational blocks first.
  if exists(
    select 1
    from public.bloqueos b
    where b.property_id = v_state.property_id
      and b.habitacion_id = p_habitacion_id
      and b.fecha_desde < v_br.departure_date
      and b.fecha_hasta > v_br.arrival_date
  ) then
    raise exception using errcode='23P01', message='La habitación tiene un bloqueo operativo durante esas fechas.';
  end if;

  -- Then confirmed/local reservations. This is intentionally independent from the
  -- optimistic room list rendered in the browser.
  if exists(
    select 1
    from public.reservas r
    where r.property_id = v_state.property_id
      and r.id <> v_res.id
      and lower(coalesce(r.estado,'')) not in ('cancelada','cancelled','anulada','canceled')
      and coalesce(r.no_show,false) = false
      and (
        r.habitacion_id = p_habitacion_id
        or p_habitacion_id = any(coalesce(r.habitaciones_ids,array[]::bigint[]))
      )
      and r.fecha_entrada < v_br.departure_date
      and r.fecha_salida > v_br.arrival_date
  ) then
    raise exception using errcode='23P01', message='La habitación ya está ocupada durante parte de esas fechas.';
  end if;

  update public.hotel_channel_booking_rooms
  set local_room_id = p_habitacion_id,
      assignment_status = 'assigned',
      updated_at = now()
  where id = v_br.id;

  if jsonb_typeof(v_res.habitaciones_detalle) = 'array' then
    select
      coalesce(bool_or(
        (v_br.ota_unique_id is not null and elem->>'ota_unique_id' = v_br.ota_unique_id)
        or (v_br.ota_unique_id is null and ord = v_br.room_index)
      ),false),
      coalesce(jsonb_agg(
        case
          when (v_br.ota_unique_id is not null and elem->>'ota_unique_id' = v_br.ota_unique_id)
            or (v_br.ota_unique_id is null and ord = v_br.room_index)
          then elem || jsonb_build_object(
            'habitacion_id',p_habitacion_id,
            'nombre',v_room.nombre,
            'categoria_asignada',coalesce(nullif(trim(v_room.tipo),''),v_br.local_room_type,'Habitación'),
            'assignment_status','assigned'
          )
          else elem
        end
        order by ord
      ),'[]'::jsonb)
    into v_detail_matched,v_details
    from jsonb_array_elements(v_res.habitaciones_detalle) with ordinality x(elem,ord);
  else
    v_details := '[]'::jsonb;
  end if;

  if not coalesce(v_detail_matched,false) then
    v_details := coalesce(v_details,'[]'::jsonb) || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'habitacion_id',p_habitacion_id,
        'nombre',v_room.nombre,
        'categoria_vendida',v_br.local_room_type,
        'categoria_asignada',coalesce(nullif(trim(v_room.tipo),''),v_br.local_room_type,'Habitación'),
        'huespedes',v_br.guests,
        'tarifa_noche',v_br.nightly_rate,
        'fecha_entrada',v_br.arrival_date,
        'fecha_salida',v_br.departure_date,
        'ota_unique_id',v_br.ota_unique_id,
        'external_room_type_id',v_br.external_room_type_id,
        'external_rate_plan_id',v_br.external_rate_plan_id,
        'assignment_status','assigned',
        'channel_manager',true
      ))
    );
  end if;

  update public.reservas
  set habitacion_id = coalesce(habitacion_id,p_habitacion_id),
      habitaciones_ids = case
        when p_habitacion_id = any(coalesce(habitaciones_ids,array[]::bigint[]))
          then coalesce(habitaciones_ids,array[]::bigint[])
        else array_append(coalesce(habitaciones_ids,array[]::bigint[]),p_habitacion_id)
      end,
      habitaciones_detalle = v_details
  where id = v_res.id
  returning * into v_res_after;

  select
    count(*),
    count(*) filter(
      where local_room_id is not null
        and lower(coalesce(assignment_status,'')) = 'assigned'
    ),
    count(*) filter(
      where local_room_id is null
        and lower(coalesce(assignment_status,'')) = 'overbooked'
    )
  into v_total,v_assigned,v_pending_overbooked
  from public.hotel_channel_booking_rooms
  where booking_state_id = v_state.id;

  v_pending := greatest(v_total - v_assigned,0);
  v_new_status := case
    when v_total > 0 and v_pending = 0 then 'assigned'
    when v_assigned > 0 then 'partial'
    when v_pending_overbooked > 0 then 'overbooked'
    else 'unassigned'
  end;

  update public.hotel_channel_booking_state
  set assignment_status = v_new_status,
      overbooked = (v_pending_overbooked > 0),
      conflict_state = case
        when v_pending = 0
          and lower(coalesce(conflict_state,'')) in ('overbooked','assignment_required','unassigned')
        then null
        else conflict_state
      end,
      updated_at = now()
  where id = v_state.id;

  insert into public.hotel_planning_operation_log(
    operation_group,property_id,action,reservation_id,before_state,after_state,meta,created_by
  )
  values(
    gen_random_uuid(),
    v_state.property_id,
    'assign_overbooking',
    v_res.id,
    private.hl_planning_reservation_state(v_res),
    private.hl_planning_reservation_state(v_res_after),
    jsonb_build_object(
      'booking_room_id',v_br.id,
      'room_index',v_br.room_index,
      'new_room_id',p_habitacion_id,
      'source','planning_unassigned',
      'remaining_pending',v_pending,
      'resulting_assignment_status',v_new_status
    ),
    v_uid
  );

  return jsonb_build_object(
    'ok',true,
    'reservation_id',v_res.id,
    'booking_room_id',v_br.id,
    'room_id',p_habitacion_id,
    'assignment_status',v_new_status,
    'remaining_pending',v_pending,
    'overbooked',v_pending_overbooked > 0
  );
end;
$function$;

revoke all on function public.hl_assign_channel_booking_room_atomic(uuid,bigint) from public;
grant execute on function public.hl_assign_channel_booking_room_atomic(uuid,bigint) to authenticated, service_role;
