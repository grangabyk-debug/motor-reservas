import fs from "node:fs"
import path from "node:path"

const roots=["app/dashboard","app/check-in","app/access","app/api/hotel"]
const codeExtensions=new Set([".js",".jsx",".mjs",".ts",".tsx"])
const defaultBudget={bytes:24000,lines:520}
const legacyBudgets=new Map([
  ["app/dashboard/features/frontdesk/ReservationDrawer.jsx",{bytes:38000,lines:820}],
  ["app/dashboard/features/operations/HousekeepingPremium.jsx",{bytes:36000,lines:780}],
  ["app/dashboard/features/commercial/GroupsPremium.jsx",{bytes:28000,lines:700}],
  ["app/dashboard/features/hotel/AccessKeysPremium.jsx",{bytes:25000,lines:600}],
  ["app/dashboard/HotelOSV2.jsx",{bytes:30000,lines:700}],
])
const forbiddenLegacy=["app/dashboard/HotelOSClient.jsx","app/dashboard/AdvancedHotelModules.jsx","app/dashboard/advanced.module.css","scripts/harden-hotel-os-atomic.mjs"]
const uiMustNotUseSupabase=[
  "app/dashboard/features/frontdesk/ReservationDrawer.jsx",
  "app/dashboard/features/operations/HousekeepingPremium.jsx",
  "app/dashboard/features/commercial/GroupsPremium.jsx",
  "app/dashboard/features/hotel/AccessKeysPremium.jsx",
]
const problems=[],warnings=[]

function walk(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full]})}
function read(file){return fs.existsSync(file)?fs.readFileSync(file,"utf8"):""}
function hasDirectSupabase(source){return /(?:lib\/supabase|\bsupabase\.(?:from|rpc|channel|removeChannel)\b)/.test(source)}

for(const file of roots.flatMap(walk)){
  if(!codeExtensions.has(path.extname(file)))continue
  const source=fs.readFileSync(file,"utf8"),bytes=Buffer.byteLength(source),lines=source.split(/\r?\n/).length,normalized=file.replaceAll("\\","/")
  if(/SUPABASE_SERVICE_ROLE|service_role/i.test(source)&&!normalized.startsWith("app/api/"))problems.push(`${normalized}: service-role/secret reference forbidden outside server routes`)
  const budget=legacyBudgets.get(normalized)||defaultBudget
  if(bytes>budget.bytes||lines>budget.lines)problems.push(`${normalized}: ${lines} lines / ${bytes} bytes exceeds budget (${budget.lines} / ${budget.bytes})`)
  else if(legacyBudgets.has(normalized)&&(bytes>defaultBudget.bytes||lines>defaultBudget.lines))warnings.push(`${normalized}: legacy oversized component (${lines} lines / ${bytes} bytes); refactor remains required`)
  if(normalized.includes("/components/")&&hasDirectSupabase(source))problems.push(`${normalized}: UI component talks directly to Supabase; move access to service/repository`)
}

for(const file of uiMustNotUseSupabase){
  const source=read(file)
  if(!source)problems.push(`${file}: required refactored UI file is missing`)
  else if(hasDirectSupabase(source))problems.push(`${file}: direct Supabase access reintroduced after service/hook refactor`)
}
for(const file of forbiddenLegacy){if(fs.existsSync(file))problems.push(`${file}: legacy Hotel OS artifact must not exist`)}

const reservationWorkspace=read("app/dashboard/services/reservationWorkspace.js")
const reservationHook=read("app/dashboard/hooks/useReservationWorkspace.js")
if(!reservationWorkspace.includes("requirePropertyId")||!reservationWorkspace.includes('.eq("property_id",property)'))problems.push("reservationWorkspace service must enforce property_id through requirePropertyId")
if(!reservationHook.includes("loadReservationWorkspace")||hasDirectSupabase(reservationHook))problems.push("useReservationWorkspace must orchestrate the service without direct Supabase access")

const housekeepingWorkspace=read("app/dashboard/services/housekeepingWorkspace.js")
const housekeepingHook=read("app/dashboard/hooks/useHousekeepingWorkspace.js")
if(!housekeepingWorkspace.includes("requirePropertyId")||!housekeepingWorkspace.includes('.eq("property_id",property)'))problems.push("housekeepingWorkspace service must enforce property_id for tenant-scoped reads")
if(!housekeepingWorkspace.includes("filter:`property_id=eq.${property}`"))problems.push("housekeeping realtime subscription must stay filtered by property_id")
if(!housekeepingHook.includes("loadHousekeepingWorkspace")||!housekeepingHook.includes("subscribeHousekeepingWorkspace")||hasDirectSupabase(housekeepingHook))problems.push("useHousekeepingWorkspace must own orchestration/realtime without direct Supabase access")

const groupsWorkspace=read("app/dashboard/services/groupsWorkspace.js")
const groupsHook=read("app/dashboard/hooks/useGroupsWorkspace.js")
if(!groupsWorkspace.includes("requirePropertyId")||!groupsWorkspace.includes('.eq("property_id",property)'))problems.push("groupsWorkspace service must enforce property_id for Group Desk data")
for(const rpc of ["hl_group_create_quote_atomic","hl_group_mark_quote_atomic"]){if(!groupsWorkspace.includes(rpc))problems.push(`groupsWorkspace service must use atomic RPC ${rpc}`)}
if(!groupsHook.includes("loadGroupsWorkspace")||hasDirectSupabase(groupsHook))problems.push("useGroupsWorkspace must orchestrate Group Desk without direct Supabase access")
const groupMigration=read("supabase/migrations/20260901160500_group_desk_atomic_operations.sql")
for(const rpc of ["hl_group_create_quote_atomic","hl_group_mark_quote_atomic"]){if(!groupMigration.includes(rpc))problems.push(`Group Desk migration missing ${rpc}`)}
if(!/security invoker/i.test(groupMigration))problems.push("Group Desk atomic RPCs must remain security invoker so RLS stays authoritative")

const accessService=read("app/dashboard/services/access.js")
const accessHook=read("app/dashboard/hooks/useAccessWorkspace.js")
if(!accessService.includes("requirePropertyId")||!accessService.includes("subscribeAccessWorkspace"))problems.push("Access service must keep tenant validation and realtime orchestration")
if(!accessService.includes("filter:`property_id=eq.${property}`"))problems.push("Access realtime subscription must stay filtered by property_id")
if(!accessHook.includes("loadAccessWorkspace")||!accessHook.includes("subscribeAccessWorkspace")||hasDirectSupabase(accessHook))problems.push("useAccessWorkspace must orchestrate Access without direct Supabase access")

const reportUi=read("app/dashboard/features/finance/ReportsPremium.jsx")
const reportEngine=read("app/dashboard/features/finance/reportEngine.js")
for(const fn of ["buildContext","reportData"]){if(!reportEngine.includes(`function ${fn}`)&&!reportEngine.includes(`function ${fn}(`)&&!reportEngine.includes(`export function ${fn}`))problems.push(`reportEngine missing ${fn}`)}
if(!reportUi.includes('from"./reportEngine"'))problems.push("ReportsPremium must keep report calculations outside presentation UI")
if(/from["']react["']/.test(reportEngine)||hasDirectSupabase(reportEngine))problems.push("reportEngine must stay pure: no React or Supabase dependency")

const pagePath="app/dashboard/page.jsx",page=read(pagePath)
if(!/HotelOSV2/.test(page))problems.push("app/dashboard/page.jsx: dashboard must use HotelOSV2 modular shell")

const pkg=JSON.parse(read("package.json"))
for(const required of ["check:product-boundaries","check:hotel-architecture","build"]){if(!pkg.scripts?.[required])problems.push(`package.json: missing ${required} script`)}
for(const script of ["dev","build"]){if(/harden-hotel-os-atomic/.test(pkg.scripts?.[script]||""))problems.push(`package.json: ${script} still depends on legacy Hotel OS hardener`)}

const reservationService=read("app/dashboard/services/reservations.js")
for(const rpc of ["hl_planning_move_reservation_atomic","hl_checkout_reservation_atomic","hl_planning_change_room_atomic","hl_planning_swap_reservations_atomic","hl_undo_planning_operation_atomic"]){if(!reservationService.includes(rpc))problems.push(`app/dashboard/services/reservations.js: missing required atomic RPC ${rpc}`)}

const hotelService=read("app/dashboard/services/hotel.js")
if(!hotelService.includes("hl_create_web_checkin_token"))problems.push("app/dashboard/services/hotel.js: secure Web Check-in RPC is missing")
if(!hotelService.includes("Authorization:`Bearer ${token}`")&&!hotelService.includes("Authorization:`Bearer ${session.access_token}`"))problems.push("app/dashboard/services/hotel.js: authenticated server calls must carry session bearer token")

if(warnings.length)console.warn("Architecture debt still tracked:\n- "+warnings.join("\n- "))
if(problems.length){console.error("Habitación Llena architecture guard failed:\n- "+problems.join("\n- "));process.exit(1)}
console.log("Habitación Llena architecture guard OK: product boundaries, tenant services, UI/Supabase separation, Group Desk atomicity, Access isolation, Reports engine separation, component budgets, atomic operations and server-secret rules verified")
