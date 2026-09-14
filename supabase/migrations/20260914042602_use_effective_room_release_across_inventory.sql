-- Usa la fecha efectiva de liberación de cada habitación en motor web y channel manager.
-- Una salida anticipada libera inventario sin modificar automáticamente el total comercial de la reserva.

do $$
declare v text;
begin
  select pg_get_functiondef('public.hl_public_booking_availability(text,date,date,integer)'::regprocedure) into v;
  if position('and r.fecha_entrada<p_check_out and public.hl_reservation_room_end_date(r.room_checkout_dates,h.id,r.fecha_salida)>p_check_in' in v)=0 then
    raise exception 'Expected availability overlap fragment not found';
  end if;
  v:=replace(v,
    'and r.fecha_entrada<p_check_out and public.hl_reservation_room_end_date(r.room_checkout_dates,h.id,r.fecha_salida)>p_check_in',
    'and public.hl_reservation_room_start_date(r.habitaciones_detalle,h.id,r.fecha_entrada)<p_check_out and public.hl_reservation_room_effective_end_date(r.habitaciones_detalle,r.room_checkout_dates,h.id,r.fecha_salida)>p_check_in'
  );
  v:=replace(v,
    'coalesce(r.estado,'''')<>''cancelada''',
    'coalesce(r.estado,'''') not in (''cancelada'',''finalizada'')'
  );
  execute v;

  select pg_get_functiondef('public.hl_public_booking_create(text,jsonb)'::regprocedure) into v;
  if position('and x.fecha_entrada<v_out and x.fecha_salida>v_in' in v)=0 then
    raise exception 'Expected booking-create overlap fragment not found';
  end if;
  v:=replace(v,
    'and x.fecha_entrada<v_out and x.fecha_salida>v_in',
    'and public.hl_reservation_room_start_date(x.habitaciones_detalle,h0.id,x.fecha_entrada)<v_out and public.hl_reservation_room_effective_end_date(x.habitaciones_detalle,x.room_checkout_dates,h0.id,x.fecha_salida)>v_in'
  );
  v:=replace(v,
    'coalesce(x.estado,'''')<>''cancelada''',
    'coalesce(x.estado,'''') not in (''cancelada'',''finalizada'')'
  );
  execute v;

  select pg_get_functiondef('public.hl_channel_inventory_snapshot(uuid,date,date)'::regprocedure) into v;
  if position('select r.id,r.fecha_entrada,public.hl_reservation_room_end_date(r.room_checkout_dates,x.room_id,r.fecha_salida) fecha_salida,x.room_id' in v)=0 then
    raise exception 'Expected channel snapshot room-range fragment not found';
  end if;
  v:=replace(v,
    'select r.id,r.fecha_entrada,public.hl_reservation_room_end_date(r.room_checkout_dates,x.room_id,r.fecha_salida) fecha_salida,x.room_id',
    'select r.id,public.hl_reservation_room_start_date(r.habitaciones_detalle,x.room_id,r.fecha_entrada) fecha_entrada,public.hl_reservation_room_effective_end_date(r.habitaciones_detalle,r.room_checkout_dates,x.room_id,r.fecha_salida) fecha_salida,x.room_id'
  );
  v:=replace(v,
    'r.estado<>''cancelada'' and not r.no_show',
    'r.estado not in (''cancelada'',''finalizada'') and not r.no_show'
  );
  execute v;
end $$;
