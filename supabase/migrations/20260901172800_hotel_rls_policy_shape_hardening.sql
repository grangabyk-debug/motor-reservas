drop policy if exists hotel_cash_movements_write on public.hotel_cash_movements;
create policy hotel_cash_movements_insert_access on public.hotel_cash_movements for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit']));
create policy hotel_cash_movements_update_access on public.hotel_cash_movements for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit']));
create policy hotel_cash_movements_delete_access on public.hotel_cash_movements for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit']));

drop policy if exists hotel_cash_sessions_write on public.hotel_cash_sessions;
create policy hotel_cash_sessions_insert_access on public.hotel_cash_sessions for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit']));
create policy hotel_cash_sessions_update_access on public.hotel_cash_sessions for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit']));
create policy hotel_cash_sessions_delete_access on public.hotel_cash_sessions for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit']));

drop policy if exists hotel_finance_documents_write on public.hotel_finance_documents;
create policy hotel_finance_documents_insert_access on public.hotel_finance_documents for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit']));
create policy hotel_finance_documents_update_access on public.hotel_finance_documents for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit']));
create policy hotel_finance_documents_delete_access on public.hotel_finance_documents for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','night_audit']));

drop policy if exists hotel_guest_profiles_write on public.hotel_guest_profiles;
create policy hotel_guest_profiles_insert_access on public.hotel_guest_profiles for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','night_audit']));
create policy hotel_guest_profiles_update_access on public.hotel_guest_profiles for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','night_audit']));
create policy hotel_guest_profiles_delete_access on public.hotel_guest_profiles for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','night_audit']));

drop policy if exists hotel_guest_tag_catalog_select_access on public.hotel_guest_tag_catalog;
drop policy if exists hotel_guest_tag_catalog_write_management on public.hotel_guest_tag_catalog;
create policy hotel_guest_tag_catalog_select_access on public.hotel_guest_tag_catalog for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_guest_tag_catalog_insert_access on public.hotel_guest_tag_catalog for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager']));
create policy hotel_guest_tag_catalog_update_access on public.hotel_guest_tag_catalog for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager'])) with check (private.user_has_property_role(property_id, array['owner','manager']));
create policy hotel_guest_tag_catalog_delete_access on public.hotel_guest_tag_catalog for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager']));

drop policy if exists hotel_housekeeping_assignment_rules_write_access on public.hotel_housekeeping_assignment_rules;
create policy hotel_housekeeping_assignment_rules_insert_access on public.hotel_housekeeping_assignment_rules for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping']));
create policy hotel_housekeeping_assignment_rules_update_access on public.hotel_housekeeping_assignment_rules for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping']));
create policy hotel_housekeeping_assignment_rules_delete_access on public.hotel_housekeeping_assignment_rules for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping']));

drop policy if exists hotel_housekeeping_room_reports_write_access on public.hotel_housekeeping_room_reports;
create policy hotel_housekeeping_room_reports_insert_access on public.hotel_housekeeping_room_reports for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']));
create policy hotel_housekeeping_room_reports_update_access on public.hotel_housekeeping_room_reports for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']));
create policy hotel_housekeeping_room_reports_delete_access on public.hotel_housekeeping_room_reports for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']));

drop policy if exists hotel_housekeeping_tasks_write on public.hotel_housekeeping_tasks;
create policy hotel_housekeeping_tasks_insert_access on public.hotel_housekeeping_tasks for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']));
create policy hotel_housekeeping_tasks_update_access on public.hotel_housekeeping_tasks for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']));
create policy hotel_housekeeping_tasks_delete_access on public.hotel_housekeeping_tasks for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']));

drop policy if exists hotel_maintenance_tickets_write on public.hotel_maintenance_tickets;
create policy hotel_maintenance_tickets_insert_access on public.hotel_maintenance_tickets for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']));
create policy hotel_maintenance_tickets_update_access on public.hotel_maintenance_tickets for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']));
create policy hotel_maintenance_tickets_delete_access on public.hotel_maintenance_tickets for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']));

drop policy if exists hotel_partners_write on public.hotel_partners;
create policy hotel_partners_insert_access on public.hotel_partners for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));
create policy hotel_partners_update_access on public.hotel_partners for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));
create policy hotel_partners_delete_access on public.hotel_partners for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));

drop policy if exists hotel_resources_write on public.hotel_resources;
create policy hotel_resources_insert_access on public.hotel_resources for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','revenue']));
create policy hotel_resources_update_access on public.hotel_resources for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','revenue'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','revenue']));
create policy hotel_resources_delete_access on public.hotel_resources for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','revenue']));

drop policy if exists hotel_upsell_catalog_write on public.hotel_upsell_catalog;
create policy hotel_upsell_catalog_insert_access on public.hotel_upsell_catalog for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','revenue']));
create policy hotel_upsell_catalog_update_access on public.hotel_upsell_catalog for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','revenue'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','revenue']));
create policy hotel_upsell_catalog_delete_access on public.hotel_upsell_catalog for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','revenue']));

drop policy if exists hotel_web_checkins_write on public.hotel_web_checkins;
create policy hotel_web_checkins_insert_access on public.hotel_web_checkins for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','night_audit']));
create policy hotel_web_checkins_update_access on public.hotel_web_checkins for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','night_audit']));
create policy hotel_web_checkins_delete_access on public.hotel_web_checkins for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','night_audit']));