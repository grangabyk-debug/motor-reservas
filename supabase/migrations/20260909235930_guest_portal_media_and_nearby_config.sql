alter table public.hotel_guest_guides add column if not exists nearby_config jsonb not null default '{"auto":true,"categories":["restaurant","pharmacy","attraction","supermarket"]}'::jsonb;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hotel-guest-portal-media','hotel-guest-portal-media',true,6291456,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set public=true,file_size_limit=6291456,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists guest_portal_media_insert on storage.objects;
create policy guest_portal_media_insert on storage.objects for insert to authenticated
with check(bucket_id='hotel-guest-portal-media' and exists(select 1 from public.properties p where p.id::text=(storage.foldername(name))[1] and private.user_has_property_access(p.id)));

drop policy if exists guest_portal_media_update on storage.objects;
create policy guest_portal_media_update on storage.objects for update to authenticated
using(bucket_id='hotel-guest-portal-media' and exists(select 1 from public.properties p where p.id::text=(storage.foldername(name))[1] and private.user_has_property_access(p.id)))
with check(bucket_id='hotel-guest-portal-media' and exists(select 1 from public.properties p where p.id::text=(storage.foldername(name))[1] and private.user_has_property_access(p.id)));

drop policy if exists guest_portal_media_delete on storage.objects;
create policy guest_portal_media_delete on storage.objects for delete to authenticated
using(bucket_id='hotel-guest-portal-media' and exists(select 1 from public.properties p where p.id::text=(storage.foldername(name))[1] and private.user_has_property_access(p.id)));