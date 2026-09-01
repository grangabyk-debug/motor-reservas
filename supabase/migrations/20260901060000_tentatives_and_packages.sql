alter table public.reservas
  add column if not exists tentative_expires_at timestamptz,
  add column if not exists tentative_note text,
  add column if not exists tentative_expired_at timestamptz,
  add column if not exists regimen text,
  add column if not exists package_snapshot jsonb not null default '{}'::jsonb;

create table if not exists public.hotel_packages (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  code text,
  description text,
  room_type text,
  meal_plan text,
  min_nights integer not null default 1 check (min_nights >= 1),
  valid_from date,
  valid_to date,
  pricing_mode text not null default 'fixed_total' check (pricing_mode in ('fixed_total','nightly_rate','discount_percent','discount_amount')),
  price numeric not null default 0 check (price >= 0),
  currency text not null default 'ARS',
  included_items jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_packages_valid_range check (valid_to is null or valid_from is null or valid_to >= valid_from),
  unique(property_id, code)
);

alter table public.reservas
  add column if not exists package_id uuid references public.hotel_packages(id) on delete set null;

create index if not exists reservas_tentative_expiry_idx
  on public.reservas(property_id, tentative_expires_at)
  where estado = 'tentativa' and tentative_expires_at is not null;
create index if not exists reservas_package_id_idx on public.reservas(package_id);
create index if not exists hotel_packages_property_active_idx on public.hotel_packages(property_id, active, sort_order, name);
create index if not exists hotel_packages_created_by_idx on public.hotel_packages(created_by);

alter table public.hotel_packages enable row level security;

drop policy if exists hotel_packages_select_access on public.hotel_packages;
create policy hotel_packages_select_access
  on public.hotel_packages for select to authenticated
  using (private.user_has_property_access(property_id));

drop policy if exists hotel_packages_insert_access on public.hotel_packages;
create policy hotel_packages_insert_access
  on public.hotel_packages for insert to authenticated
  with check (private.user_has_property_access(property_id));

drop policy if exists hotel_packages_update_access on public.hotel_packages;
create policy hotel_packages_update_access
  on public.hotel_packages for update to authenticated
  using (private.user_has_property_access(property_id))
  with check (private.user_has_property_access(property_id));

drop policy if exists hotel_packages_delete_access on public.hotel_packages;
create policy hotel_packages_delete_access
  on public.hotel_packages for delete to authenticated
  using (private.user_has_property_access(property_id));

grant select,insert,update,delete on public.hotel_packages to authenticated;

comment on column public.reservas.tentative_expires_at is 'Deadline after which a tentative reservation stops holding inventory.';
comment on column public.reservas.package_snapshot is 'Immutable commercial snapshot of the package applied to the reservation.';
comment on table public.hotel_packages is 'Property-scoped stay packages/promotions used by Habitación Llena PMS.';
