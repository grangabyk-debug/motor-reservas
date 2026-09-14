create or replace function public.hl_checkout_reservation_guest_atomic(p_guest_id uuid)
returns jsonb
language plpgsql
set search_path='public','private','pg_temp'
as $$
declare
  g public.hotel_reservation_guests%rowtype;
  r public.reservas%rowtype;
  v_empty boolean:=false;
  v_timezone text:='America/Argentina/Buenos_Aires';
  v_local_date date;
  v_active_room integer:=0;
  v_active_total integer:=0;
  v_details jsonb;
  v_checkout_dates jsonb;
  v_room_name text;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into g from public.hotel_reservation_guests where id=p_guest_id for update;
  if not found then raise exception using errcode='P0002',message='Pasajero inexistente.'; end if;
  select * into r from public.reservas where id=g.reservation_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(r.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para realizar el check-out.'; end if;
  if r.estado='cancelada' or coalesce(r.no_show,false) or r.estado='finalizada' then raise exception using errcode='P0001',message='La reserva no admite check-out de pasajeros.'; end if;
  if r.estado<>'alojado' then raise exception using errcode='P0001',message='Primero realizá el check-in de la reserva.'; end if;

  select coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires') into v_timezone from public.property_settings where property_id=r.property_id;
  v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');
  begin v_local_date:=(now() at time zone v_timezone)::date;exception when others then v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;end;

  if g.checked_out_at is null then
    update public.hotel_reservation_guests
    set checked_out_at=now(),checked_out_by=auth.uid(),stay_to=greatest(coalesce(stay_from,r.fecha_entrada),v_local_date),updated_at=now()
    where id=g.id returning * into g;
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
    values(r.property_id,r.id,'guest_checkout','Check-out de pasajero',coalesce(g.full_name,'Pasajero')||' realizó check-out.',jsonb_build_object('guest_id',g.id,'room_id',g.room_id,'checked_out_at',g.checked_out_at,'stay_to',g.stay_to),auth.uid());
  end if;

  if g.room_id is not null then
    select count(*) into v_active_room from public.hotel_reservation_guests x where x.reservation_id=r.id and x.room_id=g.room_id and x.checked_out_at is null;
    v_empty:=v_active_room=0;
  end if;
  select count(*) into v_active_total from public.hotel_reservation_guests x where x.reservation_id=r.id and x.checked_out_at is null;

  select coalesce(jsonb_agg(case when coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=g.room_id and coalesce(e->>'segment_role','active_room')<>'previous_room' then e||jsonb_build_object('huespedes',v_active_room) else e end order by ord),'[]'::jsonb)
  into v_details from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality t(e,ord);

  v_checkout_dates:=coalesce(r.room_checkout_dates,'{}'::jsonb);
  if v_empty and g.room_id is not null then
    v_checkout_dates:=jsonb_set(v_checkout_dates,array[g.room_id::text],to_jsonb(v_local_date::text),true);
  end if;

  update public.reservas
  set cantidad_huespedes=v_active_total,habitaciones_detalle=v_details,room_checkout_dates=v_checkout_dates
  where id=r.id;

  if v_empty and g.room_id is not null then
    update public.habitaciones set estado='sucia' where id=g.room_id and property_id=r.property_id and lower(coalesce(estado,'')) not in('mantenimiento','fuera_servicio');
    select nombre into v_room_name from public.habitaciones where id=g.room_id and property_id=r.property_id;
    if not (coalesce(r.room_checkout_dates,'{}'::jsonb) ? g.room_id::text) then
      insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
      values(r.property_id,r.id,'room_released_after_guest_checkout','Habitación liberada al salir el último pasajero','Hab. '||coalesce(v_room_name,g.room_id::text)||' quedó sin pasajeros activos y se liberó en el Planning.',jsonb_build_object('room_id',g.room_id,'checkout_date',v_local_date),auth.uid());
    end if;
  end if;

  return jsonb_build_object('guest_id',g.id,'room_id',g.room_id,'checked_out_at',g.checked_out_at,'room_empty',v_empty,'room_released',v_empty,'active_guests',v_active_total);
end $$;

revoke all on function public.hl_checkout_reservation_guest_atomic(uuid) from public,anon;
grant execute on function public.hl_checkout_reservation_guest_atomic(uuid) to authenticated;
