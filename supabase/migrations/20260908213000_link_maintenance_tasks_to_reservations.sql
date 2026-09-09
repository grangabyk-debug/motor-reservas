alter table public.hotel_maintenance_tickets
  add column if not exists reservation_id bigint references public.reservas(id) on delete set null;

create index if not exists hotel_maintenance_tickets_reservation_id_idx
  on public.hotel_maintenance_tickets(reservation_id);
