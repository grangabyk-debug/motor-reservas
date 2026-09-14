grant insert on table public.hotel_reservation_events to authenticated;

drop policy if exists hotel_reservation_events_insert_access on public.hotel_reservation_events;
create policy hotel_reservation_events_insert_access
on public.hotel_reservation_events
for insert
to authenticated
with check (
  private.user_has_property_role(
    property_id,
    array['owner','admin','manager','reception','night_audit']::text[]
  )
  and exists (
    select 1
    from public.reservas r
    where r.id = reservation_id
      and r.property_id = property_id
  )
  and (actor_user_id is null or actor_user_id = auth.uid())
);
