create table if not exists public.hotel_subscriptions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  plan_code text not null check (plan_code in ('essential','pro','total')),
  status text not null default 'inactive' check (status in ('inactive','trial','active','past_due','canceled')),
  billing_cycle text check (billing_cycle in ('monthly','annual')),
  room_tier text,
  room_limit integer check (room_limit is null or room_limit > 0),
  price_amount numeric(12,2) check (price_amount is null or price_amount >= 0),
  price_currency text not null default 'ARS',
  started_at timestamptz,
  renews_at timestamptz,
  external_customer_ref text,
  external_subscription_ref text,
  source text not null default 'platform',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hotel_feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  feature_code text not null,
  enabled boolean not null default true,
  source text not null default 'plan',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id, feature_code)
);
create table if not exists public.hotel_subscription_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  requested_by uuid not null default auth.uid(),
  plan_code text not null check (plan_code in ('essential','pro','total')),
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  room_tier text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','canceled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hotel_feature_entitlements_property_idx on public.hotel_feature_entitlements(property_id);
create index if not exists hotel_subscription_requests_property_created_idx on public.hotel_subscription_requests(property_id,created_at desc);
alter table public.hotel_subscriptions enable row level security;
alter table public.hotel_feature_entitlements enable row level security;
alter table public.hotel_subscription_requests enable row level security;
drop policy if exists hotel_subscriptions_select_access on public.hotel_subscriptions;
create policy hotel_subscriptions_select_access on public.hotel_subscriptions for select using (private.user_has_property_access(property_id));
drop policy if exists hotel_feature_entitlements_select_access on public.hotel_feature_entitlements;
create policy hotel_feature_entitlements_select_access on public.hotel_feature_entitlements for select using (private.user_has_property_access(property_id));
drop policy if exists hotel_subscription_requests_select_owner on public.hotel_subscription_requests;
create policy hotel_subscription_requests_select_owner on public.hotel_subscription_requests for select using (private.user_has_property_role(property_id,array['owner']::text[]));
drop policy if exists hotel_subscription_requests_insert_owner on public.hotel_subscription_requests;
create policy hotel_subscription_requests_insert_owner on public.hotel_subscription_requests for insert with check (private.user_has_property_role(property_id,array['owner']::text[]) and requested_by=auth.uid());
drop policy if exists hotel_subscription_requests_cancel_owner on public.hotel_subscription_requests;
create policy hotel_subscription_requests_cancel_owner on public.hotel_subscription_requests for update using (private.user_has_property_role(property_id,array['owner']::text[]) and status='pending') with check (private.user_has_property_role(property_id,array['owner']::text[]) and status='canceled');
grant select on public.hotel_subscriptions to authenticated;
grant select on public.hotel_feature_entitlements to authenticated;
grant select,insert,update on public.hotel_subscription_requests to authenticated;