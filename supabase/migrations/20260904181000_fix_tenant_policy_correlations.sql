-- Habitación Llena — corrección de correlaciones tenant en policies históricas
-- Aplicar primero en preview/staging.

begin;

-- hotel_import_rows: el batch debe pertenecer a la misma propiedad que la fila.
drop policy if exists hotel_import_rows_insert_management on public.hotel_import_rows;
create policy hotel_import_rows_insert_management
on public.hotel_import_rows
for insert
to authenticated
with check (
  private.user_has_property_role(property_id,array['owner','manager','admin']::text[])
  and exists (
    select 1
    from public.hotel_import_batches b
    where b.id=hotel_import_rows.batch_id
      and b.property_id=hotel_import_rows.property_id
  )
);

-- hotel_reservation_messages: la reserva debe pertenecer a la misma propiedad que el mensaje.
drop policy if exists hotel_reservation_messages_insert_access on public.hotel_reservation_messages;
create policy hotel_reservation_messages_insert_access
on public.hotel_reservation_messages
for insert
to authenticated
with check (
  private.user_has_property_access(property_id)
  and exists (
    select 1
    from public.reservas r
    where r.id=hotel_reservation_messages.reservation_id
      and r.property_id=hotel_reservation_messages.property_id
  )
);

commit;
