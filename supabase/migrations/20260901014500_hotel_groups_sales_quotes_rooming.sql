alter table public.hotel_groups
  add column if not exists event_type text not null default 'other',
  add column if not exists estimated_pax integer not null default 0 check (estimated_pax >= 0),
  add column if not exists coordinator_name text,
  add column if not exists coordinator_email text,
  add column if not exists coordinator_phone text,
  add column if not exists meal_plan text,
  add column if not exists release_date date,
  add column if not exists sales_stage text not null default 'inquiry' check (sales_stage in ('inquiry','quoted','tentative','confirmed','in_house','completed','lost')),
  add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high')),
  add column if not exists department_notes jsonb not null default '{}'::jsonb,
  add column if not exists budget_currency text not null default 'ARS',
  add column if not exists budget_total numeric(14,2) not null default 0 check (budget_total >= 0);

create table if not exists public.hotel_group_quotes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  group_id uuid not null references public.hotel_groups(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  quote_number text,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired')),
  valid_until date,
  currency text not null default 'ARS',
  accommodation_total numeric(14,2) not null default 0,
  food_total numeric(14,2) not null default 0,
  extras_total numeric(14,2) not null default 0,
  taxes_total numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  deposit_percent numeric(7,2) not null default 0 check (deposit_percent >= 0 and deposit_percent <= 100),
  deposit_due_date date,
  terms text,
  internal_notes text,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_id, version),
  unique(property_id, quote_number)
);

create table if not exists public.hotel_group_quote_lines (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  quote_id uuid not null references public.hotel_group_quotes(id) on delete cascade,
  category text not null default 'extra' check (category in ('room','food','extra','tax','discount','other')),
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hotel_group_rooming (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  group_id uuid not null references public.hotel_groups(id) on delete cascade,
  reservation_id bigint references public.reservas(id) on delete set null,
  room_id bigint references public.habitaciones(id) on delete set null,
  guest_name text not null,
  document text,
  email text,
  phone text,
  role_label text,
  arrival_date date,
  departure_date date,
  status text not null default 'pending' check (status in ('pending','assigned','reserved','checked_in','checked_out','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hotel_group_inventory_blocks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  group_id uuid not null references public.hotel_groups(id) on delete cascade,
  room_type text not null,
  quantity integer not null default 1 check (quantity > 0),
  arrival_date date not null,
  departure_date date not null,
  status text not null default 'tentative' check (status in ('tentative','firm','released')),
  release_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (departure_date > arrival_date)
);

create index if not exists hotel_group_quotes_property_group_idx on public.hotel_group_quotes(property_id, group_id, created_at desc);
create index if not exists hotel_group_quote_lines_quote_idx on public.hotel_group_quote_lines(quote_id, sort_order);
create index if not exists hotel_group_rooming_group_idx on public.hotel_group_rooming(property_id, group_id, status);
create index if not exists hotel_group_inventory_blocks_range_idx on public.hotel_group_inventory_blocks(property_id, arrival_date, departure_date, status);

alter table public.hotel_group_quotes enable row level security;
alter table public.hotel_group_quote_lines enable row level security;
alter table public.hotel_group_rooming enable row level security;
alter table public.hotel_group_inventory_blocks enable row level security;

drop policy if exists hotel_group_quotes_select_access on public.hotel_group_quotes;
create policy hotel_group_quotes_select_access on public.hotel_group_quotes for select using (private.user_has_property_access(property_id));
drop policy if exists hotel_group_quotes_write on public.hotel_group_quotes;
create policy hotel_group_quotes_write on public.hotel_group_quotes for all using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));

drop policy if exists hotel_group_quote_lines_select_access on public.hotel_group_quote_lines;
create policy hotel_group_quote_lines_select_access on public.hotel_group_quote_lines for select using (private.user_has_property_access(property_id));
drop policy if exists hotel_group_quote_lines_write on public.hotel_group_quote_lines;
create policy hotel_group_quote_lines_write on public.hotel_group_quote_lines for all using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));

drop policy if exists hotel_group_rooming_select_access on public.hotel_group_rooming;
create policy hotel_group_rooming_select_access on public.hotel_group_rooming for select using (private.user_has_property_access(property_id));
drop policy if exists hotel_group_rooming_write on public.hotel_group_rooming;
create policy hotel_group_rooming_write on public.hotel_group_rooming for all using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit','housekeeping'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit','housekeeping']));

drop policy if exists hotel_group_inventory_blocks_select_access on public.hotel_group_inventory_blocks;
create policy hotel_group_inventory_blocks_select_access on public.hotel_group_inventory_blocks for select using (private.user_has_property_access(property_id));
drop policy if exists hotel_group_inventory_blocks_write on public.hotel_group_inventory_blocks;
create policy hotel_group_inventory_blocks_write on public.hotel_group_inventory_blocks for all using (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit'])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','admin','revenue','night_audit']));