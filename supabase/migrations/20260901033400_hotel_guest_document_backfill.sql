-- Backfill reusable ownership for personal reservation documents already stored.

update public.hotel_reservation_documents d
set guest_profile_id = r.guest_profile_id,
    holder_role = 'primary',
    holder_name = coalesce(nullif(trim(r.nombre_huesped), ''), d.holder_name),
    metadata = coalesce(d.metadata, '{}'::jsonb) || jsonb_build_object('ownership_backfilled', true)
from public.reservas r
where r.id = d.reserva_id
  and r.property_id = d.property_id
  and r.guest_profile_id is not null
  and d.guest_profile_id is null
  and lower(coalesce(d.kind, '')) in ('documento','dni','pasaporte','licencia');

create index if not exists hotel_reservation_documents_uploaded_by_idx
  on public.hotel_reservation_documents(uploaded_by)
  where uploaded_by is not null;
