import fs from"node:fs"

const checks=[
  ["supabase/migrations/20260901172456_group_desk_rls_hardening.sql",["hotel_groups_select_access","hotel_group_quotes_insert_access","hotel_group_quote_lines_update_access","hotel_group_inventory_blocks_delete_access","hotel_group_rooming_select_access","to authenticated"]],
  ["supabase/migrations/20260901172800_hotel_rls_policy_shape_hardening.sql",["hotel_cash_movements_insert_access","hotel_guest_profiles_update_access","hotel_housekeeping_tasks_delete_access","hotel_resources_insert_access","hotel_web_checkins_update_access","to authenticated"]],
  ["supabase/migrations/20260901173404_hotel_user_preferences_rls_initplan.sql",["hotel_user_preferences_select_own","hotel_user_preferences_update_own","(select auth.uid())","to authenticated"]],
]
const problems=[]
for(const[file,needles]of checks){
  if(!fs.existsSync(file)){problems.push(`${file}: applied hotel hardening migration is missing from the repository`);continue}
  const source=fs.readFileSync(file,"utf8").toLowerCase()
  for(const needle of needles)if(!source.includes(needle.toLowerCase()))problems.push(`${file}: missing required hardening marker ${needle}`)
  if(/\bfor\s+all\b/i.test(source))problems.push(`${file}: broad FOR ALL policy reintroduced; keep SELECT/INSERT/UPDATE/DELETE explicit`)
}
if(problems.length){console.error("Habitación Llena DB migration guard failed:\n- "+problems.join("\n- "));process.exit(1)}
console.log("Habitación Llena DB migration guard OK: applied RLS hardening is versioned and regression markers are present")
