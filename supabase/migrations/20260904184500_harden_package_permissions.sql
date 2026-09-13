-- Habitación Llena — endurecer permisos de paquetes comerciales
-- Aplicar primero en preview/staging.

begin;

drop policy if exists hotel_packages_insert_access on public.hotel_packages;
create policy hotel_packages_insert_access on public.hotel_packages
for insert to authenticated
with check (private.user_has_property_role(property_id,array['owner','admin','manager','revenue']::text[]));

drop policy if exists hotel_packages_update_access on public.hotel_packages;
create policy hotel_packages_update_access on public.hotel_packages
for update to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager','revenue']::text[]))
with check (private.user_has_property_role(property_id,array['owner','admin','manager','revenue']::text[]));

drop policy if exists hotel_packages_delete_access on public.hotel_packages;
create policy hotel_packages_delete_access on public.hotel_packages
for delete to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager','revenue']::text[]));

commit;
