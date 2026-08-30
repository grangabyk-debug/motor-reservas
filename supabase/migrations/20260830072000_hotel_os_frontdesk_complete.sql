-- Habitación Llena OS · front desk complete operations
create table if not exists public.hotel_floors (
  id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete cascade,
  name text not null, sort_order integer not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists hotel_floors_property_name_idx on public.hotel_floors(property_id, lower(name));
create index if not exists hotel_floors_property_sort_idx on public.hotel_floors(property_id, sort_order, name);
alter table public.hotel_floors enable row level security;
revoke all on public.hotel_floors from anon; grant select,insert,update,delete on public.hotel_floors to authenticated;
drop policy if exists hotel_floors_select_access on public.hotel_floors;
create policy hotel_floors_select_access on public.hotel_floors for select to authenticated using (private.user_has_property_access(property_id));
drop policy if exists hotel_floors_insert_management on public.hotel_floors;
create policy hotel_floors_insert_management on public.hotel_floors for insert to authenticated with check (private.user_has_property_role(property_id,array['owner','manager']::text[]));
drop policy if exists hotel_floors_update_management on public.hotel_floors;
create policy hotel_floors_update_management on public.hotel_floors for update to authenticated using (private.user_has_property_role(property_id,array['owner','manager']::text[])) with check (private.user_has_property_role(property_id,array['owner','manager']::text[]));
drop policy if exists hotel_floors_delete_management on public.hotel_floors;
create policy hotel_floors_delete_management on public.hotel_floors for delete to authenticated using (private.user_has_property_role(property_id,array['owner','manager']::text[]));

alter table public.habitaciones add column if not exists floor_id uuid references public.hotel_floors(id) on delete set null;
alter table public.habitaciones add column if not exists sort_order integer not null default 0;
alter table public.habitaciones add column if not exists descripcion text;
alter table public.habitaciones add column if not exists housekeeping_zone text;
create index if not exists habitaciones_floor_sort_idx on public.habitaciones(property_id,floor_id,sort_order,id);

alter table public.reservas add column if not exists mascotas jsonb not null default '[]'::jsonb;
alter table public.reservas add column if not exists mascotas_total numeric not null default 0;
alter table public.reservas add column if not exists medio_pago_preferido text;
alter table public.reservas add column if not exists hora_llegada_estimada text;
alter table public.reservas add column if not exists hora_salida_estimada text;

alter table public.hotel_os_settings add column if not exists operational_settings jsonb not null default '{"checkin_time":"14:00","checkout_time":"10:00","parking":{"enabled":true,"default_price":0,"charge_mode":"per_night"},"pets":{"enabled":true,"default_price":0,"charge_mode":"per_stay"},"payment_methods":["Efectivo","Transferencia","Débito","Crédito","Mercado Pago","USD efectivo","Otro"],"guarantee_methods":["Sin garantía","Tarjeta","Transferencia","Seña","Voucher"],"reservation_channels":["Directa","Motor directo","Booking.com","Expedia","Airbnb","Teléfono","WhatsApp","Walk-in","Agencia","Otro"],"currency":"ARS","key_encoder":{"enabled":false,"provider":"","bridge_url":"","default_key_count":2},"email":{"mode":"mailto","sender_name":"Recepción"}}'::jsonb;

create table if not exists public.hotel_charge_catalog (
  id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete cascade,
  name text not null, category text not null default 'extra' check(category in ('parking','pet','extra','service','fee')),
  amount numeric not null default 0 check(amount>=0), charge_mode text not null default 'per_stay' check(charge_mode in ('per_stay','per_night','per_unit','per_person','per_person_night')),
  active boolean not null default true, sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists hotel_charge_catalog_property_idx on public.hotel_charge_catalog(property_id,category,sort_order,name);
alter table public.hotel_charge_catalog enable row level security;
revoke all on public.hotel_charge_catalog from anon; grant select,insert,update,delete on public.hotel_charge_catalog to authenticated;
drop policy if exists hotel_charge_catalog_select_access on public.hotel_charge_catalog;
create policy hotel_charge_catalog_select_access on public.hotel_charge_catalog for select to authenticated using(private.user_has_property_access(property_id));
drop policy if exists hotel_charge_catalog_insert_management on public.hotel_charge_catalog;
create policy hotel_charge_catalog_insert_management on public.hotel_charge_catalog for insert to authenticated with check(private.user_has_property_role(property_id,array['owner','manager']::text[]));
drop policy if exists hotel_charge_catalog_update_management on public.hotel_charge_catalog;
create policy hotel_charge_catalog_update_management on public.hotel_charge_catalog for update to authenticated using(private.user_has_property_role(property_id,array['owner','manager']::text[])) with check(private.user_has_property_role(property_id,array['owner','manager']::text[]));
drop policy if exists hotel_charge_catalog_delete_management on public.hotel_charge_catalog;
create policy hotel_charge_catalog_delete_management on public.hotel_charge_catalog for delete to authenticated using(private.user_has_property_role(property_id,array['owner','manager']::text[]));

create table if not exists public.hotel_key_issues (
  id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete cascade,
  reserva_id bigint references public.reservas(id) on delete cascade, habitacion_id bigint references public.habitaciones(id) on delete set null,
  issued_by uuid references auth.users(id) on delete set null, guest_name text, encoder_provider text, encoder_ref text,
  key_count integer not null default 1 check(key_count between 1 and 20), valid_from timestamptz, valid_until timestamptz,
  status text not null default 'prepared' check(status in ('prepared','encoded','revoked','failed')), message text,
  created_at timestamptz not null default now(), revoked_at timestamptz
);
create index if not exists hotel_key_issues_property_reservation_idx on public.hotel_key_issues(property_id,reserva_id,created_at desc);
alter table public.hotel_key_issues enable row level security;
revoke all on public.hotel_key_issues from anon; grant select,insert,update on public.hotel_key_issues to authenticated;
drop policy if exists hotel_key_issues_select_access on public.hotel_key_issues;
create policy hotel_key_issues_select_access on public.hotel_key_issues for select to authenticated using(private.user_has_property_access(property_id));
drop policy if exists hotel_key_issues_insert_operational on public.hotel_key_issues;
create policy hotel_key_issues_insert_operational on public.hotel_key_issues for insert to authenticated with check(private.user_has_property_role(property_id,array['owner','manager','reception']::text[]));
drop policy if exists hotel_key_issues_update_operational on public.hotel_key_issues;
create policy hotel_key_issues_update_operational on public.hotel_key_issues for update to authenticated using(private.user_has_property_role(property_id,array['owner','manager','reception']::text[])) with check(private.user_has_property_role(property_id,array['owner','manager','reception']::text[]));
