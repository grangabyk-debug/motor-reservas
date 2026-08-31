create table if not exists public.hotel_payment_connections (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  provider text not null default 'mercadopago' check (provider in ('mercadopago')),
  external_user_id text,
  public_key text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scope text,
  live_mode boolean not null default false,
  status text not null default 'disconnected' check (status in ('disconnected','connected','expired','error','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotel_payment_connections_property_provider_idx on public.hotel_payment_connections(property_id,provider);
alter table public.hotel_payment_connections enable row level security;
revoke all on public.hotel_payment_connections from anon;
grant select,insert,update,delete on public.hotel_payment_connections to authenticated;
drop policy if exists hotel_payment_connections_select_access on public.hotel_payment_connections;
create policy hotel_payment_connections_select_access on public.hotel_payment_connections for select to authenticated using (private.user_has_property_access(property_id));
drop policy if exists hotel_payment_connections_insert_management on public.hotel_payment_connections;
create policy hotel_payment_connections_insert_management on public.hotel_payment_connections for insert to authenticated with check (private.user_has_property_role(property_id,array['owner','manager','admin']::text[]));
drop policy if exists hotel_payment_connections_update_management on public.hotel_payment_connections;
create policy hotel_payment_connections_update_management on public.hotel_payment_connections for update to authenticated using (private.user_has_property_role(property_id,array['owner','manager','admin']::text[])) with check (private.user_has_property_role(property_id,array['owner','manager','admin']::text[]));
drop policy if exists hotel_payment_connections_delete_management on public.hotel_payment_connections;
create policy hotel_payment_connections_delete_management on public.hotel_payment_connections for delete to authenticated using (private.user_has_property_role(property_id,array['owner','manager','admin']::text[]));

create table if not exists public.hotel_guarantees (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reserva_id bigint not null references public.reservas(id) on delete cascade,
  provider text not null default 'mercadopago' check (provider in ('mercadopago','manual')),
  guarantee_type text not null default 'card' check (guarantee_type in ('card','transfer','deposit','voucher','none')),
  status text not null default 'pending' check (status in ('pending','card_saved','authorized','captured','released','expired','failed','cancelled')),
  customer_id text,
  card_id text,
  payment_method_id text,
  issuer_id text,
  card_brand text,
  last_four text,
  expiration_month integer check (expiration_month is null or expiration_month between 1 and 12),
  expiration_year integer,
  authorized_payment_id text,
  authorized_amount numeric(14,2) not null default 0 check (authorized_amount>=0),
  captured_amount numeric(14,2) not null default 0 check (captured_amount>=0),
  currency text not null default 'ARS',
  authorization_expires_at timestamptz,
  consent_accepted_at timestamptz,
  consent_version text,
  consent_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,reserva_id)
);

create index if not exists hotel_guarantees_property_reservation_idx on public.hotel_guarantees(property_id,reserva_id);
create index if not exists hotel_guarantees_status_idx on public.hotel_guarantees(property_id,status,authorization_expires_at);
alter table public.hotel_guarantees enable row level security;
revoke all on public.hotel_guarantees from anon;
grant select,insert,update on public.hotel_guarantees to authenticated;
drop policy if exists hotel_guarantees_select_access on public.hotel_guarantees;
create policy hotel_guarantees_select_access on public.hotel_guarantees for select to authenticated using (private.user_has_property_access(property_id));
drop policy if exists hotel_guarantees_insert_frontdesk on public.hotel_guarantees;
create policy hotel_guarantees_insert_frontdesk on public.hotel_guarantees for insert to authenticated with check (private.user_has_property_role(property_id,array['owner','manager','admin','reception']::text[]));
drop policy if exists hotel_guarantees_update_frontdesk on public.hotel_guarantees;
create policy hotel_guarantees_update_frontdesk on public.hotel_guarantees for update to authenticated using (private.user_has_property_role(property_id,array['owner','manager','admin','reception']::text[])) with check (private.user_has_property_role(property_id,array['owner','manager','admin','reception']::text[]));

create table if not exists public.hotel_guarantee_events (
  id uuid primary key default gen_random_uuid(),
  guarantee_id uuid not null references public.hotel_guarantees(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  reserva_id bigint not null references public.reservas(id) on delete cascade,
  event_type text not null check (event_type in ('card_saved','authorized','authorization_failed','captured','released','expired','card_removed','connection_error')),
  amount numeric(14,2),
  currency text,
  provider_ref text,
  detail jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hotel_guarantee_events_reservation_idx on public.hotel_guarantee_events(property_id,reserva_id,created_at desc);
alter table public.hotel_guarantee_events enable row level security;
revoke all on public.hotel_guarantee_events from anon;
grant select,insert on public.hotel_guarantee_events to authenticated;
drop policy if exists hotel_guarantee_events_select_access on public.hotel_guarantee_events;
create policy hotel_guarantee_events_select_access on public.hotel_guarantee_events for select to authenticated using (private.user_has_property_access(property_id));
drop policy if exists hotel_guarantee_events_insert_frontdesk on public.hotel_guarantee_events;
create policy hotel_guarantee_events_insert_frontdesk on public.hotel_guarantee_events for insert to authenticated with check (private.user_has_property_role(property_id,array['owner','manager','admin','reception']::text[]));