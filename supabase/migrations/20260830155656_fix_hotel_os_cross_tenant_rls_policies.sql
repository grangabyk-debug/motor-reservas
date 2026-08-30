drop policy if exists hotel_automation_events_insert_access on public.hotel_automation_events;
drop policy if exists hotel_automation_events_select_access on public.hotel_automation_events;
drop policy if exists hotel_automation_events_update_access on public.hotel_automation_events;

create policy hotel_automation_events_insert_management
on public.hotel_automation_events
for insert to authenticated
with check (private.user_has_property_role(property_id, array['owner','manager']::text[]));

create policy hotel_automation_events_select_access
on public.hotel_automation_events
for select to authenticated
using (private.user_has_property_access(property_id));

create policy hotel_automation_events_update_access
on public.hotel_automation_events
for update to authenticated
using (private.user_has_property_access(property_id))
with check (private.user_has_property_access(property_id));

drop policy if exists hotel_role_permissions_delete_management on public.hotel_role_permissions;
drop policy if exists hotel_role_permissions_insert_management on public.hotel_role_permissions;
drop policy if exists hotel_role_permissions_select_access on public.hotel_role_permissions;
drop policy if exists hotel_role_permissions_update_management on public.hotel_role_permissions;

create policy hotel_role_permissions_select_access
on public.hotel_role_permissions
for select to authenticated
using (private.user_has_property_access(property_id));

create policy hotel_role_permissions_insert_owner
on public.hotel_role_permissions
for insert to authenticated
with check (private.user_has_property_role(property_id, array['owner']::text[]));

create policy hotel_role_permissions_update_owner
on public.hotel_role_permissions
for update to authenticated
using (private.user_has_property_role(property_id, array['owner']::text[]))
with check (private.user_has_property_role(property_id, array['owner']::text[]));

create policy hotel_role_permissions_delete_owner
on public.hotel_role_permissions
for delete to authenticated
using (private.user_has_property_role(property_id, array['owner']::text[]));
