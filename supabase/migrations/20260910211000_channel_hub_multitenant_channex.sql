-- Habitación Llena · Channel Hub multitenant sobre Channex.
-- Un hub por propiedad; el API key de Channex vive sólo en el servidor.

create table if not exists public.hotel_channel_hubs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  provider text not null default 'channex',
  mode text not null default 'staging',
  status text not null default 'not_configured',
  external_property_id text,
  external_group_id text,
  allowed_channels text[] not null default array['BDC','ABB','EXP','DDC','AGO']::text[],
  diagnostics jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_channel_hubs_provider_check check (provider in ('channex')),
  constraint hotel_channel_hubs_mode_check check (mode in ('staging','live')),
  constraint hotel_channel_hubs_status_check check (status in ('not_configured','staging','active','paused','error')),
  constraint hotel_channel_hubs_property_provider_key unique (property_id, provider)
);

create index if not exists hotel_channel_hubs_property_idx on public.hotel_channel_hubs(property_id);
alter table public.hotel_channel_hubs enable row level security;

drop policy if exists channel_hubs_read on public.hotel_channel_hubs;
create policy channel_hubs_read on public.hotel_channel_hubs for select to authenticated using (private.user_has_property_access(property_id));
drop policy if exists channel_hubs_insert on public.hotel_channel_hubs;
create policy channel_hubs_insert on public.hotel_channel_hubs for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager']::text[]));
drop policy if exists channel_hubs_update on public.hotel_channel_hubs;
create policy channel_hubs_update on public.hotel_channel_hubs for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager']::text[])) with check (private.user_has_property_role(property_id, array['owner','manager']::text[]));
drop policy if exists channel_hubs_delete on public.hotel_channel_hubs;
create policy channel_hubs_delete on public.hotel_channel_hubs for delete to authenticated using (private.user_has_property_role(property_id, array['owner']::text[]));

create table if not exists public.hotel_channel_hub_mappings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  hub_id uuid not null references public.hotel_channel_hubs(id) on delete cascade,
  entity_type text not null,
  local_key text not null,
  external_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_channel_hub_mappings_entity_check check (entity_type in ('room_type','rate_plan')),
  constraint hotel_channel_hub_mappings_unique unique (hub_id, entity_type, local_key)
);

create index if not exists hotel_channel_hub_mappings_property_idx on public.hotel_channel_hub_mappings(property_id);
create index if not exists hotel_channel_hub_mappings_hub_idx on public.hotel_channel_hub_mappings(hub_id);
alter table public.hotel_channel_hub_mappings enable row level security;

drop policy if exists channel_hub_mappings_read on public.hotel_channel_hub_mappings;
create policy channel_hub_mappings_read on public.hotel_channel_hub_mappings for select to authenticated using (private.user_has_property_access(property_id));
drop policy if exists channel_hub_mappings_insert on public.hotel_channel_hub_mappings;
create policy channel_hub_mappings_insert on public.hotel_channel_hub_mappings for insert to authenticated with check (private.user_has_property_role(property_id, array['owner','manager']::text[]));
drop policy if exists channel_hub_mappings_update on public.hotel_channel_hub_mappings;
create policy channel_hub_mappings_update on public.hotel_channel_hub_mappings for update to authenticated using (private.user_has_property_role(property_id, array['owner','manager']::text[])) with check (private.user_has_property_role(property_id, array['owner','manager']::text[]));
drop policy if exists channel_hub_mappings_delete on public.hotel_channel_hub_mappings;
create policy channel_hub_mappings_delete on public.hotel_channel_hub_mappings for delete to authenticated using (private.user_has_property_role(property_id, array['owner']::text[]));
