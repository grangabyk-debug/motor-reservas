do $patch$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.hl_change_group_reservation_room_atomic(bigint,bigint,bigint,boolean)'::regprocedure) into v_def;

  v_old:='  select coalesce(sum(greatest(0,coalesce(nullif(e->>''tarifa_noche'','''')::numeric,0))),0)'||chr(10)||
         '  into v_total_rate'||chr(10)||
         '  from jsonb_array_elements(v_new_details) e;';
  v_new:='  select coalesce(sum(greatest(0,coalesce(nullif(e->>''tarifa_noche'','''')::numeric,0))),0)'||chr(10)||
         '  into v_total_rate'||chr(10)||
         '  from jsonb_array_elements(v_new_details) e'||chr(10)||
         '  where not (coalesce(v_before.room_checkout_dates,''{}''::jsonb) ? coalesce(e->>''habitacion_id'',''''));';
  if position(v_old in v_def)=0 then
    raise exception 'No se encontró el cálculo de tarifa activa en hl_change_group_reservation_room_atomic';
  end if;
  v_def:=replace(v_def,v_old,v_new);

  v_old:='    ''Cambio de habitación en reserva grupal'',';
  v_new:='    case when (select count(*) from unnest(v_new_ids) x where not (coalesce(v_before.room_checkout_dates,''{}''::jsonb) ? x::text))<=1 then ''Cambio de habitación del tramo activo'' else ''Cambio de habitación en reserva grupal'' end,';
  if position(v_old in v_def)=0 then
    raise exception 'No se encontró el título del evento de cambio grupal';
  end if;
  v_def:=replace(v_def,v_old,v_new);
  execute v_def;

  select pg_get_functiondef('public.hl_planning_move_reservation_priced_atomic(bigint,bigint,date,date,boolean)'::regprocedure) into v_def;

  if position('v_active_room_count integer;' in v_def)=0 then
    v_def:=replace(v_def,
      '  v_total numeric;'||chr(10)||'begin',
      '  v_total numeric;'||chr(10)||'  v_active_room_count integer:=0;'||chr(10)||'  v_stored_room_count integer:=0;'||chr(10)||'begin'
    );
  end if;

  v_old:='  if coalesce(cardinality(v_before.habitaciones_ids),case when v_before.habitacion_id is null then 0 else 1 end)>1 then'||chr(10)||
         '    raise exception using errcode=''22023'',message=''La reserva ocupa varias habitaciones. Modificá cada habitación desde la ficha grupal.'';'||chr(10)||
         '  end if;';
  v_new:='  v_stored_room_count:=coalesce(cardinality(v_before.habitaciones_ids),case when v_before.habitacion_id is null then 0 else 1 end);'||chr(10)||
         '  select count(*) into v_active_room_count'||chr(10)||
         '  from unnest(coalesce(v_before.habitaciones_ids,case when v_before.habitacion_id is null then array[]::bigint[] else array[v_before.habitacion_id]::bigint[] end)) rid'||chr(10)||
         '  where not (coalesce(v_before.room_checkout_dates,''{}''::jsonb) ? rid::text);'||chr(10)||
         '  if v_active_room_count>1 then'||chr(10)||
         '    raise exception using errcode=''22023'',message=''La reserva tiene varias habitaciones activas. Modificá cada habitación desde la ficha grupal.'';'||chr(10)||
         '  end if;'||chr(10)||
         '  if v_stored_room_count>v_active_room_count then'||chr(10)||
         '    if p_fecha_entrada is distinct from v_before.fecha_entrada or p_fecha_salida is distinct from v_before.fecha_salida then'||chr(10)||
         '      raise exception using errcode=''22023'',message=''La reserva tiene historial de cambios de habitación. Modificá las fechas desde los tramos para no perder ese historial.'';'||chr(10)||
         '    end if;'||chr(10)||
         '    if p_habitacion_id is distinct from v_before.habitacion_id then'||chr(10)||
         '      return public.hl_change_group_reservation_room_atomic(v_before.id,v_before.habitacion_id,p_habitacion_id,coalesce(p_reprice,false));'||chr(10)||
         '    end if;'||chr(10)||
         '  end if;';
  if position(v_old in v_def)=0 then
    raise exception 'No se encontró el guard de múltiples habitaciones en hl_planning_move_reservation_priced_atomic';
  end if;
  v_def:=replace(v_def,v_old,v_new);
  execute v_def;
end
$patch$;
