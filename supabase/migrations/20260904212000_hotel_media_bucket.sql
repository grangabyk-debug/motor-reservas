-- Habitación Llena — fotos públicas de la propiedad con escritura tenant-safe
-- Aplicar primero en preview/staging. Las fotos del hotel pueden ser públicas porque
-- también podrán reutilizarse en el motor de reservas / landing del establecimiento.

begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'hotel-media',
  'hotel-media',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- La primera carpeta del objeto SIEMPRE debe ser el property_id.
-- Ejemplo: <property_id>/branding/cover-123.webp

drop policy if exists hotel_media_read_members on storage.objects;
create policy hotel_media_read_members on storage.objects
for select to authenticated
using (
  bucket_id='hotel-media'
  and private.user_has_property_access(
    case
      when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end
  )
);

drop policy if exists hotel_media_insert_managers on storage.objects;
create policy hotel_media_insert_managers on storage.objects
for insert to authenticated
with check (
  bucket_id='hotel-media'
  and private.user_has_property_role(
    case
      when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end,
    array['owner','admin','manager']::text[]
  )
);

drop policy if exists hotel_media_update_managers on storage.objects;
create policy hotel_media_update_managers on storage.objects
for update to authenticated
using (
  bucket_id='hotel-media'
  and private.user_has_property_role(
    case
      when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end,
    array['owner','admin','manager']::text[]
  )
)
with check (
  bucket_id='hotel-media'
  and private.user_has_property_role(
    case
      when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end,
    array['owner','admin','manager']::text[]
  )
);

drop policy if exists hotel_media_delete_managers on storage.objects;
create policy hotel_media_delete_managers on storage.objects
for delete to authenticated
using (
  bucket_id='hotel-media'
  and private.user_has_property_role(
    case
      when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end,
    array['owner','admin','manager']::text[]
  )
);

commit;
