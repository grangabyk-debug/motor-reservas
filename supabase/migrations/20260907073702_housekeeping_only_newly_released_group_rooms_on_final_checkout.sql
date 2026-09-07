create or replace function private.hl_housekeeping_reservation_state_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_room_id bigint;
  v_previous text;
  v_rooms bigint[];
  v_source text;
begin
  if new.estado is not distinct from old.estado or new.estado not in ('alojado','finalizada') then return new; end if;
  v_source := case when new.estado='alojado' then 'checkin' else 'checkout' end;
  v_rooms := case when coalesce(cardinality(new.habitaciones_ids),0)>0 then new.habitaciones_ids when new.habitacion_id is not null then array[new.habitacion_id] else array[]::bigint[] end;
  foreach v_room_id in array v_rooms loop
    if new.estado='finalizada' and coalesce(old.room_checkout_dates,'{}'::jsonb) ? v_room_id::text then
      continue;
    end if;
    select lower(coalesce(estado,'libre')) into v_previous from public.habitaciones where id=v_room_id and property_id=new.property_id for update;
    if found and v_previous not in ('mantenimiento','fuera_servicio') then
      update public.habitaciones set estado='sucia' where id=v_room_id and property_id=new.property_id;
      insert into public.hotel_housekeeping_history(property_id,room_id,reservation_id,from_status,to_status,source,note,actor_id)
      values(new.property_id,v_room_id,new.id,v_previous,'sucia',v_source,case when v_source='checkin' then 'Habitación marcada sucia automáticamente al hacer check-in.' else 'Habitación liberada a housekeeping al hacer check-out.' end,auth.uid());
    end if;
  end loop;
  return new;
end;
$function$;
