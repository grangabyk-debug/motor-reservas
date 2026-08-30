-- Habitación Llena · códigos de reserva y documentos privados
alter table public.reservas add column if not exists codigo_canal text;
create unique index if not exists reservas_codigo_canal_unique_idx on public.reservas(property_id,canal_reserva,codigo_canal) where codigo_canal is not null and btrim(codigo_canal)<>'';

create or replace function public.hl_assign_reservation_code()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.numero_reserva is null or btrim(new.numero_reserva)='' then
    new.numero_reserva:='HL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  end if;
  return new;
end;$$;
revoke all on function public.hl_assign_reservation_code() from public,anon,authenticated;
drop trigger if exists trg_hl_assign_reservation_code on public.reservas;
create trigger trg_hl_assign_reservation_code before insert on public.reservas for each row execute function public.hl_assign_reservation_code();
update public.reservas set numero_reserva='HL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)) where numero_reserva is null or btrim(numero_reserva)='';

create table if not exists public.hotel_reservation_documents(
 id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id) on delete cascade,reserva_id bigint not null references public.reservas(id) on delete cascade,
 kind text not null default 'documento' check(kind in('dni','pasaporte','licencia','voucher','autorizacion','otro','documento')),file_name text not null,storage_path text not null unique,mime_type text not null,
 original_size_bytes bigint not null default 0 check(original_size_bytes>=0),stored_size_bytes bigint not null default 0 check(stored_size_bytes>=0),uploaded_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now()
);
create index if not exists hotel_reservation_documents_property_reservation_idx on public.hotel_reservation_documents(property_id,reserva_id,created_at desc);
alter table public.hotel_reservation_documents enable row level security;
revoke all on public.hotel_reservation_documents from anon;
grant select,insert,delete on public.hotel_reservation_documents to authenticated;
drop policy if exists hotel_reservation_documents_select_access on public.hotel_reservation_documents;
create policy hotel_reservation_documents_select_access on public.hotel_reservation_documents for select to authenticated using(private.user_has_property_access(property_id));
drop policy if exists hotel_reservation_documents_insert_operational on public.hotel_reservation_documents;
create policy hotel_reservation_documents_insert_operational on public.hotel_reservation_documents for insert to authenticated with check(private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_auditor']::text[]));
drop policy if exists hotel_reservation_documents_delete_operational on public.hotel_reservation_documents;
create policy hotel_reservation_documents_delete_operational on public.hotel_reservation_documents for delete to authenticated using(private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_auditor']::text[]));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('hotel-reservation-documents','hotel-reservation-documents',false,12582912,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists hotel_reservation_files_select on storage.objects;
create policy hotel_reservation_files_select on storage.objects for select to authenticated using(bucket_id='hotel-reservation-documents' and (storage.foldername(name))[1]~*'^[0-9a-f-]{36}$' and private.user_has_property_access(((storage.foldername(name))[1])::uuid));
drop policy if exists hotel_reservation_files_insert on storage.objects;
create policy hotel_reservation_files_insert on storage.objects for insert to authenticated with check(bucket_id='hotel-reservation-documents' and (storage.foldername(name))[1]~*'^[0-9a-f-]{36}$' and private.user_has_property_role(((storage.foldername(name))[1])::uuid,array['owner','manager','reception','admin','night_auditor']::text[]));
drop policy if exists hotel_reservation_files_delete on storage.objects;
create policy hotel_reservation_files_delete on storage.objects for delete to authenticated using(bucket_id='hotel-reservation-documents' and (storage.foldername(name))[1]~*'^[0-9a-f-]{36}$' and private.user_has_property_role(((storage.foldername(name))[1])::uuid,array['owner','manager','reception','admin','night_auditor']::text[]));
