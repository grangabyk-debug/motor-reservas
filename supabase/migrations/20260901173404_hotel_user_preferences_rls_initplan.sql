drop policy if exists hotel_user_preferences_select_own on public.hotel_user_preferences;
drop policy if exists hotel_user_preferences_insert_own on public.hotel_user_preferences;
drop policy if exists hotel_user_preferences_update_own on public.hotel_user_preferences;
drop policy if exists hotel_user_preferences_delete_own on public.hotel_user_preferences;

create policy hotel_user_preferences_select_own on public.hotel_user_preferences
for select to authenticated
using ((user_id = (select auth.uid())) and private.user_has_property_access(property_id));

create policy hotel_user_preferences_insert_own on public.hotel_user_preferences
for insert to authenticated
with check ((user_id = (select auth.uid())) and private.user_has_property_access(property_id));

create policy hotel_user_preferences_update_own on public.hotel_user_preferences
for update to authenticated
using ((user_id = (select auth.uid())) and private.user_has_property_access(property_id))
with check ((user_id = (select auth.uid())) and private.user_has_property_access(property_id));

create policy hotel_user_preferences_delete_own on public.hotel_user_preferences
for delete to authenticated
using ((user_id = (select auth.uid())) and private.user_has_property_access(property_id));