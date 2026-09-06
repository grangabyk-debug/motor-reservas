-- Habitación Llena — invitaciones seguras de equipo
-- La generación/envío/aceptación del token debe ejecutarse server-side.
-- Aplicar primero en preview/staging.

begin;

create table if not exists public.property_member_invitations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','manager','reception','night_audit','housekeeping','maintenance','revenue','member')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index if not exists property_member_invitations_one_pending_idx on public.property_member_invitations(property_id,lower(email)) where status='pending';
create index if not exists property_member_invitations_property_status_idx on public.property_member_invitations(property_id,status,created_at desc);

alter table public.property_member_invitations enable row level security;

drop policy if exists property_member_invitations_select_manage on public.property_member_invitations;
create policy property_member_invitations_select_manage on public.property_member_invitations
for select to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));

drop policy if exists property_member_invitations_insert_manage on public.property_member_invitations;
create policy property_member_invitations_insert_manage on public.property_member_invitations
for insert to authenticated
with check (
  private.user_has_property_role(property_id,array['owner','admin','manager']::text[])
  and invited_by=(select auth.uid())
  and status='pending'
);

drop policy if exists property_member_invitations_update_manage on public.property_member_invitations;
create policy property_member_invitations_update_manage on public.property_member_invitations
for update to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]))
with check (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));

-- No public SELECT policy is created. Raw token hashes must never be exposed to anonymous users.
-- Acceptance will be implemented behind a server endpoint/Edge Function that:
-- 1. hashes the bearer token;
-- 2. verifies pending + expiry + authenticated email;
-- 3. upserts property_members(property_id,user_id,role);
-- 4. marks this invitation accepted atomically.

commit;
