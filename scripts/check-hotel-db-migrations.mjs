import fs from"node:fs"

const checks=[
  ["supabase/migrations/20260901160605_group_desk_atomic_operations.sql",["hl_group_create_quote_atomic","hl_group_mark_quote_atomic","security invoker","to authenticated"]],
  ["supabase/migrations/20260901160822_group_desk_authenticated_grants.sql",["revoke all on table public.hotel_groups from anon","grant select, insert, update, delete on table public.hotel_group_quotes to authenticated"]],
  ["supabase/migrations/20260901172456_group_desk_rls_hardening.sql",["hotel_groups_select_access","hotel_group_quotes_insert_access","hotel_group_quote_lines_update_access","hotel_group_inventory_blocks_delete_access","hotel_group_rooming_select_access","to authenticated"]],
  ["supabase/migrations/20260901172800_hotel_rls_policy_shape_hardening.sql",["hotel_cash_movements_insert_access","hotel_guest_profiles_update_access","hotel_housekeeping_tasks_delete_access","hotel_resources_insert_access","hotel_web_checkins_update_access","to authenticated"]],
  ["supabase/migrations/20260901173404_hotel_user_preferences_rls_initplan.sql",["hotel_user_preferences_select_own","hotel_user_preferences_update_own","(select auth.uid())","to authenticated"]],
  ["supabase/migrations/20260901180817_harden_hotel_client_table_privileges.sql",["revoke truncate, references, trigger, maintain","from anon, authenticated","grant select, insert, update on table public.hotel_planning_operation_log to authenticated","revoke all on table public.hotel_planning_operation_log from anon","alter default privileges in schema public"]],
  ["supabase/migrations/20260901181716_optimize_hotel_core_rls_and_indexes.sql",["properties_insert_owner","property_members_select_access","(select auth.uid())","drop index if exists public.idx_bloqueos_user_id","drop index if exists public.idx_pagos_user_id","drop constraint if exists property_members_property_user_unique"]],
  ["supabase/migrations/20260901211148_hotel_onboarding_projects.sql",["create table public.hotel_onboarding_projects","alter table public.hotel_onboarding_projects enable row level security","hotel_onboarding_projects_select_access","hotel_onboarding_projects_insert_access","hotel_onboarding_projects_update_access","hl_onboarding_set_task","security invoker","revoke all on table public.hotel_onboarding_projects from anon","grant select, insert, update on table public.hotel_onboarding_projects to authenticated"]],
  ["supabase/migrations/20260901212641_hotel_import_center.sql",["create table public.hotel_import_batches","create table public.hotel_import_rows","alter table public.hotel_import_batches enable row level security","alter table public.hotel_import_rows enable row level security","hotel_import_batches_select_access","hotel_import_rows_insert_management","hl_import_validate_batch","hl_import_commit_batch","security definer","app.hl_import_mode","revoke all on table public.hotel_import_batches from anon,authenticated","grant select,insert on table public.hotel_import_rows to authenticated"]],
]
const forbiddenMigrationNames=[
  "supabase/migrations/20260901160500_group_desk_atomic_operations.sql",
  "supabase/migrations/20260901161500_group_desk_authenticated_grants.sql",
]
const problems=[]
for(const file of forbiddenMigrationNames)if(fs.existsSync(file))problems.push(`${file}: stale migration timestamp must not coexist with the applied Supabase migration history`)
for(const[file,needles]of checks){
  if(!fs.existsSync(file)){problems.push(`${file}: applied hotel hardening migration is missing from the repository`);continue}
  const source=fs.readFileSync(file,"utf8").toLowerCase()
  for(const needle of needles)if(!source.includes(needle.toLowerCase()))problems.push(`${file}: missing required hardening marker ${needle}`)
  if(/\bfor\s+all\b/i.test(source))problems.push(`${file}: broad FOR ALL policy reintroduced; keep SELECT/INSERT/UPDATE/DELETE explicit`)
}
if(problems.length){console.error("Habitación Llena DB migration guard failed:\n- "+problems.join("\n- "));process.exit(1)}
console.log("Habitación Llena DB migration guard OK: applied migration timestamps, RLS markers, client privileges, onboarding/import isolation and core RLS/index optimizations match Supabase")
