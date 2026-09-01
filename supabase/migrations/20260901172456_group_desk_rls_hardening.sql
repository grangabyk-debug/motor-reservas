drop policy if exists hotel_groups_select_access on public.hotel_groups;
drop policy if exists hotel_groups_write on public.hotel_groups;
create policy hotel_groups_select_access on public.hotel_groups for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_groups_insert_access on public.hotel_groups for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));
create policy hotel_groups_update_access on public.hotel_groups for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));
create policy hotel_groups_delete_access on public.hotel_groups for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));

drop policy if exists hotel_group_quotes_select_access on public.hotel_group_quotes;
drop policy if exists hotel_group_quotes_write on public.hotel_group_quotes;
create policy hotel_group_quotes_select_access on public.hotel_group_quotes for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_group_quotes_insert_access on public.hotel_group_quotes for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));
create policy hotel_group_quotes_update_access on public.hotel_group_quotes for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));
create policy hotel_group_quotes_delete_access on public.hotel_group_quotes for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));

drop policy if exists hotel_group_quote_lines_select_access on public.hotel_group_quote_lines;
drop policy if exists hotel_group_quote_lines_write on public.hotel_group_quote_lines;
create policy hotel_group_quote_lines_select_access on public.hotel_group_quote_lines for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_group_quote_lines_insert_access on public.hotel_group_quote_lines for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));
create policy hotel_group_quote_lines_update_access on public.hotel_group_quote_lines for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));
create policy hotel_group_quote_lines_delete_access on public.hotel_group_quote_lines for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));

drop policy if exists hotel_group_inventory_blocks_select_access on public.hotel_group_inventory_blocks;
drop policy if exists hotel_group_inventory_blocks_write on public.hotel_group_inventory_blocks;
create policy hotel_group_inventory_blocks_select_access on public.hotel_group_inventory_blocks for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_group_inventory_blocks_insert_access on public.hotel_group_inventory_blocks for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));
create policy hotel_group_inventory_blocks_update_access on public.hotel_group_inventory_blocks for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));
create policy hotel_group_inventory_blocks_delete_access on public.hotel_group_inventory_blocks for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));

drop policy if exists hotel_group_rooming_select_access on public.hotel_group_rooming;
drop policy if exists hotel_group_rooming_write on public.hotel_group_rooming;
create policy hotel_group_rooming_select_access on public.hotel_group_rooming for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_group_rooming_insert_access on public.hotel_group_rooming for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit','housekeeping']));
create policy hotel_group_rooming_update_access on public.hotel_group_rooming for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit','housekeeping'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit','housekeeping']));
create policy hotel_group_rooming_delete_access on public.hotel_group_rooming for delete to authenticated using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit','housekeeping']));