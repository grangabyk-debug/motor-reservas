-- Evita que usuarios autenticados lean callbacks PriceLabs todavía no asociados a una propiedad.
drop policy if exists hotel_pricelabs_events_select_access on public.hotel_pricelabs_events;

create policy hotel_pricelabs_events_select_access
on public.hotel_pricelabs_events
for select
to authenticated
using (
  property_id is not null
  and private.user_has_property_access(property_id)
);
