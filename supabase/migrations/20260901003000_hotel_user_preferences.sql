create table if not exists public.hotel_user_preferences (
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  preference_key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(property_id,user_id,preference_key)
);

create index if not exists hotel_user_preferences_user_idx
  on public.hotel_user_preferences(user_id,property_id);

alter table public.hotel_user_preferences enable row level security;
revoke all on public.hotel_user_preferences from anon;
grant select,insert,update,delete on public.hotel_user_preferences to authenticated;

drop policy if exists hotel_user_preferences_select_own on public.hotel_user_preferences;
create policy hotel_user_preferences_select_own
on public.hotel_user_preferences for select to authenticated
using (
  user_id=auth.uid()
  and private.user_has_property_access(property_id)
);

drop policy if exists hotel_user_preferences_insert_own on public.hotel_user_preferences;
create policy hotel_user_preferences_insert_own
on public.hotel_user_preferences for insert to authenticated
with check (
  user_id=auth.uid()
  and private.user_has_property_access(property_id)
);

drop policy if exists hotel_user_preferences_update_own on public.hotel_user_preferences;
create policy hotel_user_preferences_update_own
on public.hotel_user_preferences for update to authenticated
using (
  user_id=auth.uid()
  and private.user_has_property_access(property_id)
)
with check (
  user_id=auth.uid()
  and private.user_has_property_access(property_id)
);

drop policy if exists hotel_user_preferences_delete_own on public.hotel_user_preferences;
create policy hotel_user_preferences_delete_own
on public.hotel_user_preferences for delete to authenticated
using (
  user_id=auth.uid()
  and private.user_has_property_access(property_id)
);
