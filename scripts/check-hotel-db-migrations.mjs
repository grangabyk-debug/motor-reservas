import fs from"node:fs"

const checks=[
  ["supabase/migrations/20260901160605_group_desk_atomic_operations.sql",["hl_group_create_quote_atomic","hl_group_mark_quote_atomic","security invoker","to authenticated"]],
  ["supabase/migrations/20260901160822_group_desk_authenticated_grants.sql",["revoke all on table public.hotel_groups from anon","grant select, insert, update, delete on table public.hotel_group_quotes to authenticated"]],
  ["supabase/migrations/20260901172456_group_desk_rls_hardening.sql",["hotel_groups_select_access","hotel_group_quotes_insert_access","hotel_group_quote_lines_update_access","hotel_group_inventory_blocks_delete_access","hotel_group_rooming_select_access","to authenticated"]],
  ["supabase/migrations/20260901172800_hotel_rls_policy_shape_hardening.sql",["hotel_cash_movements_insert_access","hotel_guest_profiles_update_access","hotel_housekeeping_tasks_delete_access","hotel_resources_insert_access","hotel_web_checkins_update_access","to authenticated"]],
  ["supabase/migrations/20260901173404_hotel_user_preferences_rls_initplan.sql",["hotel_user_preferences_select_own","hotel_user_preferences_update_own","(select auth.uid())","to authenticated"]],
  ["supabase/migrations/20260901180817_harden_hotel_client_table_privileges.sql",["revoke truncate, references, trigger, maintain","from anon, authenticated","grant select, insert, update on table public.hotel_planning_operation_log to authenticated","revoke all on table public.hotel_planning_operation_log from anon","alter default privileges in schema public"]],
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
console.log("Habitación Llena DB migration guard OK: applied migration timestamps, RLS markers and client privilege hardening match Supabase")
