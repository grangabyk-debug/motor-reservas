create table if not exists public.hotel_website_ai_actions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  prompt text not null,
  summary text,
  changes jsonb not null default '[]'::jsonb,
  before_snapshot jsonb not null default '{}'::jsonb,
  proposal jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed','applied','dismissed','reverted')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  reverted_at timestamptz
);

alter table public.hotel_website_ai_actions enable row level security;

drop policy if exists hotel_website_ai_actions_select on public.hotel_website_ai_actions;
create policy hotel_website_ai_actions_select on public.hotel_website_ai_actions
for select using (private.user_has_property_access(property_id));

drop policy if exists hotel_website_ai_actions_insert on public.hotel_website_ai_actions;
create policy hotel_website_ai_actions_insert on public.hotel_website_ai_actions
for insert with check (private.user_has_property_role(property_id,array['owner','manager','admin']::text[]));

drop policy if exists hotel_website_ai_actions_update on public.hotel_website_ai_actions;
create policy hotel_website_ai_actions_update on public.hotel_website_ai_actions
for update using (private.user_has_property_role(property_id,array['owner','manager','admin']::text[]))
with check (private.user_has_property_role(property_id,array['owner','manager','admin']::text[]));

create index if not exists idx_hotel_website_ai_actions_property_created
on public.hotel_website_ai_actions(property_id,created_at desc);

grant select,insert,update on public.hotel_website_ai_actions to authenticated;
