-- Payment module performance hardening after advisor review.
create index if not exists hotel_payment_requests_reserva_id_idx on public.hotel_payment_requests(reserva_id);
create index if not exists hotel_payment_requests_created_by_idx on public.hotel_payment_requests(created_by);
create index if not exists hotel_deposits_reserva_id_idx on public.hotel_deposits(reserva_id);
create index if not exists hotel_deposits_created_by_idx on public.hotel_deposits(created_by);
create index if not exists hotel_ota_prepayments_reserva_id_idx on public.hotel_ota_prepayments(reserva_id);
create index if not exists hotel_ota_prepayments_created_by_idx on public.hotel_ota_prepayments(created_by);
create index if not exists pagos_created_by_idx on public.pagos(created_by);

drop policy if exists hotel_payment_requests_write_operational on public.hotel_payment_requests;
create policy hotel_payment_requests_insert_operational on public.hotel_payment_requests for insert to authenticated
  with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));
create policy hotel_payment_requests_update_operational on public.hotel_payment_requests for update to authenticated
  using (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']))
  with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));
create policy hotel_payment_requests_delete_operational on public.hotel_payment_requests for delete to authenticated
  using (private.user_has_property_role(property_id,array['owner','manager','admin']));

drop policy if exists hotel_deposits_write_operational on public.hotel_deposits;
create policy hotel_deposits_insert_operational on public.hotel_deposits for insert to authenticated
  with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));
create policy hotel_deposits_update_operational on public.hotel_deposits for update to authenticated
  using (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']))
  with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));
create policy hotel_deposits_delete_operational on public.hotel_deposits for delete to authenticated
  using (private.user_has_property_role(property_id,array['owner','manager','admin']));

drop policy if exists hotel_ota_prepayments_write_operational on public.hotel_ota_prepayments;
create policy hotel_ota_prepayments_insert_operational on public.hotel_ota_prepayments for insert to authenticated
  with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));
create policy hotel_ota_prepayments_update_operational on public.hotel_ota_prepayments for update to authenticated
  using (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']))
  with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));
create policy hotel_ota_prepayments_delete_operational on public.hotel_ota_prepayments for delete to authenticated
  using (private.user_has_property_role(property_id,array['owner','manager','admin']));
