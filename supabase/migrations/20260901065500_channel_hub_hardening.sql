revoke all on function public.hl_channel_reservation_queue_trigger() from public,anon,authenticated;
revoke all on function public.hl_channel_block_queue_trigger() from public,anon,authenticated;
revoke all on function public.hl_channel_distribution_queue_trigger() from public,anon,authenticated;
revoke all on function public.hl_channel_override_queue_trigger() from public,anon,authenticated;

create index if not exists hotel_channel_sync_runs_connection_idx on public.hotel_channel_sync_runs(connection_id);
create index if not exists hotel_distribution_calendar_updated_by_idx on public.hotel_distribution_calendar(updated_by);

drop policy if exists distribution_calendar_manage on public.hotel_distribution_calendar;
create policy distribution_calendar_insert on public.hotel_distribution_calendar for insert to authenticated with check(private.user_has_property_role(property_id,array['owner','manager','admin']));
create policy distribution_calendar_update on public.hotel_distribution_calendar for update to authenticated using(private.user_has_property_role(property_id,array['owner','manager','admin'])) with check(private.user_has_property_role(property_id,array['owner','manager','admin']));
create policy distribution_calendar_delete on public.hotel_distribution_calendar for delete to authenticated using(private.user_has_property_role(property_id,array['owner','manager','admin']));

drop policy if exists channel_mappings_manage on public.hotel_channel_mappings;
create policy channel_mappings_insert on public.hotel_channel_mappings for insert to authenticated with check(private.user_has_property_role(property_id,array['owner','manager','admin']));
create policy channel_mappings_update on public.hotel_channel_mappings for update to authenticated using(private.user_has_property_role(property_id,array['owner','manager','admin'])) with check(private.user_has_property_role(property_id,array['owner','manager','admin']));
create policy channel_mappings_delete on public.hotel_channel_mappings for delete to authenticated using(private.user_has_property_role(property_id,array['owner','manager','admin']));

drop policy if exists channel_overrides_manage on public.hotel_channel_rate_overrides;
create policy channel_overrides_insert on public.hotel_channel_rate_overrides for insert to authenticated with check(private.user_has_property_role(property_id,array['owner','manager','admin']));
create policy channel_overrides_update on public.hotel_channel_rate_overrides for update to authenticated using(private.user_has_property_role(property_id,array['owner','manager','admin'])) with check(private.user_has_property_role(property_id,array['owner','manager','admin']));
create policy channel_overrides_delete on public.hotel_channel_rate_overrides for delete to authenticated using(private.user_has_property_role(property_id,array['owner','manager','admin']));
