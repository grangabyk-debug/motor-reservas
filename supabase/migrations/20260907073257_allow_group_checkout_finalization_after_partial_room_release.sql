create or replace function private.enforce_reservation_room_integrity()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $function$
declare
  v_room_id bigint; v_room_ids bigint[]; v_room_label text; v_old_count integer; v_new_count integer;
  v_ops jsonb:='{}'::jsonb; v_checkin time:='14:00'; v_checkout time:='10:00'; v_cutoff time:='05:00'; v_arrival time; v_departure time; v_start timestamp; v_end timestamp;
begin
  if tg_op='UPDATE' then
    v_old_count:=coalesce(array_length(old.habitaciones_ids,1),case when old.habitacion_id is null then 0 else 1 end);
    v_new_count:=coalesce(array_length(new.habitaciones_ids,1),case when new.habitacion_id is null then 0 else 1 end);
    if v_old_count>1 and v_new_count<v_old_count and old.habitaciones_ids is distinct from new.habitaciones_ids then raise exception using errcode='23P01',message='La reserva ocupa varias habitaciones. Usá una operación grupal para modificar su asignación.'; end if;
    if new.room_checkout_dates is distinct from old.room_checkout_dates
      and new.habitacion_id is not distinct from old.habitacion_id
      and new.habitaciones_ids is not distinct from old.habitaciones_ids
      and new.fecha_entrada is not distinct from old.fecha_entrada
      and new.fecha_salida is not distinct from old.fecha_salida
      and new.tipo_estadia is not distinct from old.tipo_estadia
      and new.hora_llegada_estimada is not distinct from old.hora_llegada_estimada
      and new.hora_salida_estimada is not distinct from old.hora_salida_estimada then
      return new;
    end if;
  end if;
  new.tipo_estadia:=coalesce(nullif(new.tipo_estadia,''),'overnight');
  if new.tipo_estadia not in('overnight','day_use') then raise exception using errcode='22023',message='Tipo de estadía inválido.'; end if;
  select coalesce(operational_settings,'{}'::jsonb) into v_ops from public.hotel_os_settings where property_id=new.property_id; v_ops:=coalesce(v_ops,'{}'::jsonb);
  v_checkin:=private.hl_safe_time(v_ops->>'checkin_time','14:00'::time); v_checkout:=private.hl_safe_time(v_ops->>'checkout_time','10:00'::time); v_cutoff:=private.hl_safe_time(v_ops->>'business_day_cutoff','05:00'::time);
  v_arrival:=private.hl_safe_time(new.hora_llegada_estimada,v_checkin); v_departure:=private.hl_safe_time(new.hora_salida_estimada,v_checkout);
  new.hora_llegada_estimada:=to_char(v_arrival,'HH24:MI'); new.hora_salida_estimada:=to_char(v_departure,'HH24:MI');
  if new.fecha_entrada is null or new.fecha_salida is null then raise exception using errcode='22007',message='La reserva necesita fecha de entrada y salida.'; end if;
  if new.fecha_salida<new.fecha_entrada then raise exception using errcode='22007',message='La fecha de salida no puede ser anterior a la entrada.'; end if;
  if new.tipo_estadia='day_use' and new.fecha_salida<>new.fecha_entrada then raise exception using errcode='22007',message='Day Use debe comenzar y terminar el mismo día.'; end if;
  v_start:=new.fecha_entrada::timestamp+v_arrival; v_end:=new.fecha_salida::timestamp+v_departure;
  if v_end<=v_start then raise exception using errcode='22007',message='La hora de salida debe ser posterior a la hora de entrada. Para una llegada de madrugada y salida por la mañana usá la misma fecha con horarios reales.'; end if;
  new.ocupacion_desde_local:=v_start; new.ocupacion_hasta_local:=v_end; new.fecha_operativa:=case when new.tipo_estadia='overnight' and v_arrival<v_cutoff then new.fecha_entrada-1 else new.fecha_entrada end; new.noches:=case when new.tipo_estadia='day_use' then 0 else greatest(1,new.fecha_salida-new.fecha_operativa) end;
  if new.estado in ('cancelada','finalizada') or coalesce(new.no_show,false) then return new; end if;
  select coalesce(array_agg(distinct x order by x),array[]::bigint[]) into v_room_ids from unnest(coalesce(new.habitaciones_ids,array[]::bigint[])||array[new.habitacion_id]) x where x is not null;
  if coalesce(array_length(v_room_ids,1),0)=0 then raise exception using errcode='23502',message='La reserva necesita al menos una habitación.'; end if;
  foreach v_room_id in array v_room_ids loop
    select coalesce(nullif(trim(h.nombre),''),h.id::text) into v_room_label from public.habitaciones h where h.id=v_room_id and h.property_id=new.property_id; v_room_label:=coalesce(v_room_label,v_room_id::text);
    perform pg_advisory_xact_lock(hashtextextended(new.property_id::text||':'||v_room_id::text,0));
    if exists(select 1 from public.reservas r where r.property_id=new.property_id and r.id<>coalesce(new.id,-1) and r.estado<>'cancelada' and coalesce(r.no_show,false)=false and v_room_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id]) and tsrange(coalesce(r.ocupacion_desde_local,r.fecha_entrada::timestamp+private.hl_safe_time(r.hora_llegada_estimada,v_checkin)),greatest(coalesce(r.ocupacion_desde_local,r.fecha_entrada::timestamp+private.hl_safe_time(r.hora_llegada_estimada,v_checkin)),public.hl_reservation_room_end_date(r.room_checkout_dates,v_room_id,r.fecha_salida)::timestamp+private.hl_safe_time(r.hora_salida_estimada,v_checkout)),'[)')&&tsrange(v_start,v_end,'[)')) then raise exception using errcode='23P01',message=format('La habitación %s ya está ocupada durante parte de ese horario.',v_room_label); end if;
    if exists(select 1 from public.bloqueos b where b.property_id=new.property_id and b.habitacion_id=v_room_id and tsrange(b.fecha_desde::timestamp,b.fecha_hasta::timestamp,'[)')&&tsrange(v_start,v_end,'[)')) then raise exception using errcode='23P01',message=format('La habitación %s tiene un bloqueo operativo durante ese horario.',v_room_label); end if;
  end loop;
  return new;
end;
$function$;
