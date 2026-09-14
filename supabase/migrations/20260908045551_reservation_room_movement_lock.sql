create or replace function public.hl_guard_locked_room_movement()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_locked_id bigint;
  v_new_ids bigint[];
  v_room_name text;
begin
  v_new_ids := array(
    select distinct x
    from unnest(coalesce(new.habitaciones_ids, '{}'::bigint[]) || array[new.habitacion_id]::bigint[]) as u(x)
    where x is not null
  );

  for v_locked_id in
    select distinct (d->>'habitacion_id')::bigint
    from jsonb_array_elements(coalesce(old.habitaciones_detalle, '[]'::jsonb)) as t(d)
    where d ? 'habitacion_id'
      and lower(coalesce(d->>'movement_locked','false')) = 'true'
  loop
    if not (v_locked_id = any(coalesce(v_new_ids, '{}'::bigint[]))) then
      select h.nombre into v_room_name
      from public.habitaciones h
      where h.id = v_locked_id and h.property_id = old.property_id;
      raise exception using
        errcode = 'P0001',
        message = format('La habitación %s tiene bloqueado el movimiento. Desbloqueala antes de cambiar la asignación física.', coalesce(v_room_name, v_locked_id::text));
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_reservas_guard_locked_room_movement on public.reservas;
create trigger trg_reservas_guard_locked_room_movement
before update of habitacion_id, habitaciones_ids, habitaciones_detalle
on public.reservas
for each row
execute function public.hl_guard_locked_room_movement();

create or replace function public.hl_set_reservation_room_movement_lock(
  p_reserva_id bigint,
  p_habitacion_id bigint default null,
  p_locked boolean default true,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_res public.reservas%rowtype;
  v_updated public.reservas%rowtype;
  v_assigned_ids bigint[];
  v_target_ids bigint[];
  v_details jsonb;
  v_missing bigint[];
  v_labels text;
  v_reason text := nullif(left(trim(coalesce(p_reason,'')),240),'');
begin
  if v_actor is null then
    raise exception 'Tenés que iniciar sesión para cambiar el bloqueo de una habitación.';
  end if;

  select * into v_res
  from public.reservas
  where id = p_reserva_id
  for update;

  if not found then
    raise exception 'No se encontró la reserva.';
  end if;

  if not exists (
    select 1 from public.property_members pm
    where pm.property_id = v_res.property_id
      and pm.user_id = v_actor
  ) then
    raise exception 'No tenés permisos para modificar esta reserva.';
  end if;

  v_assigned_ids := array(
    select distinct x
    from unnest(coalesce(v_res.habitaciones_ids, '{}'::bigint[]) || array[v_res.habitacion_id]::bigint[]) as u(x)
    where x is not null
  );

  if cardinality(coalesce(v_assigned_ids, '{}'::bigint[])) = 0 then
    raise exception 'La reserva no tiene habitaciones asignadas.';
  end if;

  if p_habitacion_id is null then
    v_target_ids := v_assigned_ids;
  elsif p_habitacion_id = any(v_assigned_ids) then
    v_target_ids := array[p_habitacion_id]::bigint[];
  else
    raise exception 'La habitación indicada no pertenece a esta reserva.';
  end if;

  select array_agg(x)
  into v_missing
  from unnest(v_target_ids) as q(x)
  where not exists (
    select 1
    from jsonb_array_elements(coalesce(v_res.habitaciones_detalle,'[]'::jsonb)) as t(d)
    where (d->>'habitacion_id')::bigint = x
  );

  if cardinality(coalesce(v_missing,'{}'::bigint[])) > 0 then
    select coalesce(v_res.habitaciones_detalle,'[]'::jsonb) || coalesce(jsonb_agg(
      jsonb_build_object(
        'habitacion_id', h.id,
        'nombre', h.nombre,
        'categoria_asignada', h.tipo,
        'categoria_vendida', h.tipo,
        'huespedes', 0,
        'tarifa_noche', h.precio,
        'rooming', jsonb_build_object('matrimonial',0,'individual',0)
      )
    ),'[]'::jsonb)
    into v_details
    from public.habitaciones h
    where h.property_id = v_res.property_id
      and h.id = any(v_missing);
  else
    v_details := coalesce(v_res.habitaciones_detalle,'[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    case
      when (d->>'habitacion_id')::bigint = any(v_target_ids) and p_locked then
        (d - 'movement_lock_reason') || jsonb_strip_nulls(jsonb_build_object(
          'movement_locked', true,
          'movement_lock_reason', v_reason,
          'movement_locked_at', now(),
          'movement_locked_by', v_actor
        ))
      when (d->>'habitacion_id')::bigint = any(v_target_ids) and not p_locked then
        d - 'movement_locked' - 'movement_lock_reason' - 'movement_locked_at' - 'movement_locked_by'
      else d
    end
    order by ord
  ),'[]'::jsonb)
  into v_details
  from jsonb_array_elements(v_details) with ordinality as t(d,ord);

  update public.reservas
  set habitaciones_detalle = v_details
  where id = v_res.id
  returning * into v_updated;

  select string_agg('Hab. ' || coalesce(h.nombre, ids.x::text), ', ' order by coalesce(h.nombre, ids.x::text))
  into v_labels
  from unnest(v_target_ids) as ids(x)
  left join public.habitaciones h on h.id = ids.x and h.property_id = v_res.property_id;

  insert into public.hotel_reservation_events(
    property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name
  ) values (
    v_res.property_id,
    v_res.id,
    case when p_locked then 'room_movement_lock' else 'room_movement_unlock' end,
    case when p_locked then 'Movimiento de habitación bloqueado' else 'Movimiento de habitación desbloqueado' end,
    concat(v_labels, case when p_locked and v_reason is not null then ' · Motivo: ' || v_reason else '' end),
    jsonb_build_object('room_ids',v_target_ids,'locked',p_locked,'reason',v_reason),
    v_actor,
    null
  );

  return to_jsonb(v_updated);
end;
$$;

revoke all on function public.hl_set_reservation_room_movement_lock(bigint,bigint,boolean,text) from public;
grant execute on function public.hl_set_reservation_room_movement_lock(bigint,bigint,boolean,text) to authenticated;
