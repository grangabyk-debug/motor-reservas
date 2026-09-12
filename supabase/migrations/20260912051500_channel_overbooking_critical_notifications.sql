create or replace function public.hl_emit_channel_notification_from_inbox()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  h record;
  b record;
  v_provider text;
  v_title text;
  v_detail text;
  v_overbooking boolean := false;
begin
  if new.status <> 'processed'
     or new.event_type not in ('booking_new','booking_modified','booking_cancelled')
     or new.reservation_id is null then
    return new;
  end if;

  select id, numero_reserva, nombre_huesped, fecha_entrada, fecha_salida,
         habitacion_id, canal_reserva, codigo_canal
    into r
  from public.reservas
  where id=new.reservation_id and property_id=new.property_id;

  if not found then return new; end if;

  select nombre, tipo into h
  from public.habitaciones
  where id=r.habitacion_id and property_id=new.property_id;

  select id, assignment_status, overbooked, conflict_state, updated_at
    into b
  from public.hotel_channel_booking_state
  where property_id=new.property_id
    and reservation_id=new.reservation_id
  order by updated_at desc nulls last
  limit 1;

  if found then
    v_overbooking := coalesce(lower(b.conflict_state),'') <> 'mapping_required'
      and (
        coalesce(b.overbooked,false)
        or lower(coalesce(b.assignment_status,''))='overbooked'
        or exists (
          select 1
          from public.hotel_channel_booking_rooms br
          where br.booking_state_id=b.id
            and lower(coalesce(br.assignment_status,''))='overbooked'
        )
      );
  end if;

  v_provider := case
    when coalesce(new.channel_code,'')='BDC' then 'Booking.com'
    else coalesce(nullif(r.canal_reserva,''), nullif(new.channel_code,''), 'OTA')
  end;

  v_title := case
    when v_overbooking then 'Overbooking OTA · revisar'
    when new.event_type='booking_new' then 'Nueva reserva OTA'
    when new.event_type='booking_modified' then 'Reserva OTA modificada'
    when new.event_type='booking_cancelled' then 'Reserva OTA cancelada'
  end;

  v_detail := concat_ws(' · ',
    nullif(r.nombre_huesped,''),
    case when r.fecha_entrada is not null and r.fecha_salida is not null
      then to_char(r.fecha_entrada,'DD/MM')||' → '||to_char(r.fecha_salida,'DD/MM') end,
    case when h.nombre is not null then 'Hab. '||h.nombre end,
    case when v_overbooking then 'Requiere asignación manual en Planning' end
  );

  insert into public.hotel_operational_notifications(
    property_id, connection_id, source_event_id, event_type, channel_code,
    provider_name, reservation_id, title, detail, metadata
  ) values (
    new.property_id, new.connection_id, new.provider_event_id, new.event_type, new.channel_code,
    v_provider, new.reservation_id, v_title, coalesce(v_detail,''),
    jsonb_strip_nulls(jsonb_build_object(
      'external_reservation_id', new.external_reservation_id,
      'reservation_number', r.numero_reserva,
      'guest_name', r.nombre_huesped,
      'arrival_date', r.fecha_entrada,
      'departure_date', r.fecha_salida,
      'room_name', h.nombre,
      'room_type', h.tipo,
      'channel_code', new.channel_code,
      'provider', v_provider,
      'booking_state_id', b.id,
      'assignment_status', b.assignment_status,
      'overbooked', case when v_overbooking then true else null end,
      'conflict_state', b.conflict_state,
      'requires_action', case when v_overbooking then true else null end,
      'severity', case when v_overbooking then 'critical' else null end,
      'target', case when v_overbooking then 'planning' else null end
    ))
  )
  on conflict (property_id, connection_id, source_event_id) do update
    set reservation_id=excluded.reservation_id,
        title=excluded.title,
        detail=excluded.detail,
        metadata=excluded.metadata;

  return new;
end;
$$;

revoke all on function public.hl_emit_channel_notification_from_inbox() from public;
