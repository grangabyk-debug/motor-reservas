do $patch$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('private.enforce_reservation_room_integrity()'::regprocedure) into v_def;
  v_old:='    v_room_start:=public.hl_reservation_room_start_date(new.habitaciones_detalle,v_room_id,new.fecha_entrada);'||chr(10)||
         '    v_room_end:=public.hl_reservation_room_effective_end_date(new.habitaciones_detalle,new.room_checkout_dates,v_room_id,new.fecha_salida);'||chr(10)||
         '    if v_room_end<=v_room_start then';
  v_new:='    v_room_start:=public.hl_reservation_room_start_date(new.habitaciones_detalle,v_room_id,new.fecha_entrada);'||chr(10)||
         '    v_room_end:=public.hl_reservation_room_effective_end_date(new.habitaciones_detalle,new.room_checkout_dates,v_room_id,new.fecha_salida);'||chr(10)||
         '    if coalesce(new.room_checkout_dates,''{}''::jsonb) ? v_room_id::text then continue; end if;'||chr(10)||
         '    if v_room_end<=v_room_start then';
  if position(v_old in v_def)=0 then
    raise exception 'No se encontró el bloque de validación de habitaciones en enforce_reservation_room_integrity';
  end if;
  v_def:=replace(v_def,v_old,v_new);
  execute v_def;
end
$patch$;
