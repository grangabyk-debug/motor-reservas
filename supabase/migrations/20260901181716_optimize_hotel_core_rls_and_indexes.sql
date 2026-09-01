drop policy if exists properties_insert_owner on public.properties;
create policy properties_insert_owner on public.properties
for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists properties_update_owner on public.properties;
create policy properties_update_owner on public.properties
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists properties_delete_owner on public.properties;
create policy properties_delete_owner on public.properties
for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists property_members_select_access on public.property_members;
create policy property_members_select_access on public.property_members
for select to authenticated
using ((user_id = (select auth.uid())) or private.user_has_property_role(property_id,array['owner','manager']::text[]));

drop index if exists public.idx_bloqueos_user_id;
drop index if exists public.idx_pagos_user_id;
alter table public.property_members drop constraint if exists property_members_property_user_unique;
