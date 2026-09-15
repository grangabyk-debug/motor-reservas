do $migration$
declare
  v_def text;
  v_old text := $old$
    if exists(select 1 from public.bloqueos b where b.property_id=new.property_id and b.habitacion_id=v_room_id and tsrange(b.fecha_desde::timestamp,b.fecha_hasta::timestamp,'[)')&&tsrange(v_room_start_ts,v_room_end_ts,'[)')) then
      raise exception using errcode='23P01',message=format('La habitación %s tiene un bloqueo operativo durante ese horario.',v_room_label);
    end if;
$old$;
  v_new text := $new$
    if exists(
      select 1
      from public.bloqueos b
      where b.property_id=new.property_id
        and b.habitacion_id=v_room_id
        and tsrange(b.fecha_desde::timestamp,b.fecha_hasta::timestamp,'[)')&&tsrange(v_room_start_ts,v_room_end_ts,'[)')
        and not (
          lower(trim(coalesce(b.motivo,'')))='mantenimiento'
          and b.fecha_desde=v_room_end
          and coalesce(new.late_checkout,false)=false
          and exists (
            select 1
            from jsonb_array_elements(
              case when jsonb_typeof(new.habitaciones_detalle)='array' then new.habitaciones_detalle else '[]'::jsonb end
            ) d
            where coalesce(d->>'habitacion_id','') ~ '^\d+$'
              and (d->>'habitacion_id')::bigint=v_room_id
              and coalesce(nullif(d->>'maintenance_checkout_ack','')::boolean,false)=true
              and coalesce(d->>'maintenance_checkout_block_id','') ~ '^\d+$'
              and (d->>'maintenance_checkout_block_id')::bigint=b.id
              and coalesce(d->>'maintenance_checkout_date','')=v_room_end::text
          )
        )
    ) then
      raise exception using errcode='23P01',message=format('La habitación %s tiene un bloqueo operativo durante ese horario.',v_room_label);
    end if;
$new$;
begin
  select pg_get_functiondef(p.oid)
  into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private'
    and p.proname='enforce_reservation_room_integrity'
    and p.prokind='f'
  limit 1;

  if v_def is null then
    raise exception 'No se encontró private.enforce_reservation_room_integrity';
  end if;

  if position(v_old in v_def)=0 then
    raise exception 'No se encontró el bloque esperado para actualizar enforce_reservation_room_integrity';
  end if;

  execute replace(v_def,v_old,v_new);
end
$migration$;
