create or replace function public.hl_checkin_reservation_atomic(p_reserva_id bigint)
returns public.reservas
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v public.reservas%rowtype;
  v_room_ids bigint[];
  v_bad_rooms text;
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

  if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para realizar el check-in.';
  end if;

  if v.estado in ('cancelada','finalizada') or coalesce(v.no_show,false) then
    raise exception using errcode='P0001',message='La reserva no admite check-in en su estado actual.';
  end if;

  v_room_ids:=case
    when v.habitaciones_ids is not null and cardinality(v.habitaciones_ids)>0 then v.habitaciones_ids
    when v.habitacion_id is not null then array[v.habitacion_id]
    else array[]::bigint[]
  end;

  if cardinality(v_room_ids)=0 then
    raise exception using errcode='P0001',message='Asigná una habitación antes de hacer el check-in.';
  end if;

  if (select count(*) from public.habitaciones h where h.property_id=v.property_id and h.id=any(v_room_ids))<>cardinality(v_room_ids) then
    raise exception using errcode='P0001',message='Hay una habitación asignada que no pertenece a la propiedad o ya no existe.';
  end if;

  select string_agg(coalesce(h.nombre,h.id::text)||' ('||coalesce(h.estado,'sin estado')||')',', ' order by h.nombre)
  into v_bad_rooms
  from public.habitaciones h
  where h.property_id=v.property_id
    and h.id=any(v_room_ids)
    and (
      h.activa is false
      or lower(coalesce(h.estado,'')) not in ('libre','limpia','inspeccionada','sucia')
    );

  if v_bad_rooms is not null then
    raise exception using errcode='P0001',message='No se puede hacer check-in: revisá el estado de '||v_bad_rooms||'. La habitación no puede estar fuera de servicio o en mantenimiento.';
  end if;

  update public.reservas
  set estado='alojado'
  where id=v.id
  returning * into v;

  return v;
end;
$function$;

revoke all on function public.hl_checkin_reservation_atomic(bigint) from public;
revoke all on function public.hl_checkin_reservation_atomic(bigint) from anon;
grant execute on function public.hl_checkin_reservation_atomic(bigint) to authenticated;
grant execute on function public.hl_checkin_reservation_atomic(bigint) to service_role;
