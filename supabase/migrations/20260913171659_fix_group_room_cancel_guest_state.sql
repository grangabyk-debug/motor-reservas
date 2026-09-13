create or replace function private.hl_deactivate_guests_after_group_room_cancel()
returns trigger
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  v_room_id bigint;
  v_reservation public.reservas%rowtype;
begin
  if new.event_type <> 'group_room_cancelled' then return new; end if;
  begin
    v_room_id := nullif(new.payload->>'room_id','')::bigint;
  exception when others then
    v_room_id := null;
  end;
  if v_room_id is null then return new; end if;

  select * into v_reservation from public.reservas where id=new.reservation_id and property_id=new.property_id;
  if not found then return new; end if;

  -- A room cancelled from its very first night leaves its assigned passengers
  -- with a zero-length stay. Mark only those rows inactive; future/partial
  -- cancellations keep the passenger active until the shortened departure.
  update public.hotel_reservation_guests g
  set checked_out_at=coalesce(g.checked_out_at,new.created_at,now()),
      checked_out_by=coalesce(g.checked_out_by,new.actor_user_id),
      updated_at=now()
  where g.property_id=new.property_id
    and g.reservation_id=new.reservation_id
    and g.room_id=v_room_id
    and g.checked_out_at is null
    and coalesce(g.stay_to,v_reservation.fecha_salida) <= coalesce(g.stay_from,v_reservation.fecha_entrada);

  update public.reservas r
  set cantidad_huespedes=(
    select count(*)::integer
    from public.hotel_reservation_guests g
    where g.property_id=r.property_id
      and g.reservation_id=r.id
      and g.checked_out_at is null
      and coalesce(g.stay_to,r.fecha_salida) > coalesce(g.stay_from,r.fecha_entrada)
  )
  where r.id=new.reservation_id and r.property_id=new.property_id;

  return new;
end $$;

drop trigger if exists trg_hl_group_room_cancel_guest_cleanup on public.hotel_reservation_events;
create trigger trg_hl_group_room_cancel_guest_cleanup
after insert on public.hotel_reservation_events
for each row
when (new.event_type='group_room_cancelled')
execute function private.hl_deactivate_guests_after_group_room_cancel();
