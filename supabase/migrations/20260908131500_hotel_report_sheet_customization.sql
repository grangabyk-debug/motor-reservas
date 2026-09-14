create table if not exists public.hotel_report_sheet_preferences (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  report_key text not null,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id, report_key)
);

create table if not exists public.hotel_report_sheet_rows (
  property_id uuid not null references public.properties(id) on delete cascade,
  report_key text not null,
  report_date date not null,
  row_key text not null,
  note text not null default '',
  hidden boolean not null default false,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(property_id, report_key, report_date, row_key)
);

create index if not exists hotel_report_sheet_rows_lookup_idx on public.hotel_report_sheet_rows(property_id, report_date, report_key);

alter table public.hotel_report_sheet_preferences enable row level security;
alter table public.hotel_report_sheet_rows enable row level security;

drop policy if exists hotel_report_sheet_preferences_select_access on public.hotel_report_sheet_preferences;
create policy hotel_report_sheet_preferences_select_access on public.hotel_report_sheet_preferences for select using (private.user_has_property_access(property_id));
drop policy if exists hotel_report_sheet_preferences_insert_access on public.hotel_report_sheet_preferences;
create policy hotel_report_sheet_preferences_insert_access on public.hotel_report_sheet_preferences for insert with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']::text[]));
drop policy if exists hotel_report_sheet_preferences_update_access on public.hotel_report_sheet_preferences;
create policy hotel_report_sheet_preferences_update_access on public.hotel_report_sheet_preferences for update using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']::text[])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']::text[]));
drop policy if exists hotel_report_sheet_preferences_delete_access on public.hotel_report_sheet_preferences;
create policy hotel_report_sheet_preferences_delete_access on public.hotel_report_sheet_preferences for delete using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']::text[]));

drop policy if exists hotel_report_sheet_rows_select_access on public.hotel_report_sheet_rows;
create policy hotel_report_sheet_rows_select_access on public.hotel_report_sheet_rows for select using (private.user_has_property_access(property_id));
drop policy if exists hotel_report_sheet_rows_insert_access on public.hotel_report_sheet_rows;
create policy hotel_report_sheet_rows_insert_access on public.hotel_report_sheet_rows for insert with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']::text[]));
drop policy if exists hotel_report_sheet_rows_update_access on public.hotel_report_sheet_rows;
create policy hotel_report_sheet_rows_update_access on public.hotel_report_sheet_rows for update using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']::text[])) with check (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']::text[]));
drop policy if exists hotel_report_sheet_rows_delete_access on public.hotel_report_sheet_rows;
create policy hotel_report_sheet_rows_delete_access on public.hotel_report_sheet_rows for delete using (private.user_has_property_role(property_id, array['owner','manager','reception','housekeeping','maintenance','night_audit']::text[]));

grant select,insert,update,delete on public.hotel_report_sheet_preferences to authenticated;
grant select,insert,update,delete on public.hotel_report_sheet_rows to authenticated;
