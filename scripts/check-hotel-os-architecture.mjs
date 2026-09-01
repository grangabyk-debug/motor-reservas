import fs from "node:fs"
import path from "node:path"

const roots=["app/dashboard","app/check-in","app/access","app/api/hotel"]
const codeExtensions=new Set([".js",".jsx",".mjs",".ts",".tsx"])
const defaultBudget={bytes:24000,lines:520}
const legacyBudgets=new Map()
const forbiddenLegacy=["app/dashboard/HotelOSClient.jsx","app/dashboard/AdvancedHotelModules.jsx","app/dashboard/advanced.module.css","scripts/harden-hotel-os-atomic.mjs"]
const uiMustNotUseSupabase=["app/dashboard/features/frontdesk/ReservationDrawer.jsx","app/dashboard/features/operations/HousekeepingPremium.jsx","app/dashboard/features/commercial/GroupsPremium.jsx","app/dashboard/features/hotel/AccessKeysPremium.jsx"]
const problems=[],warnings=[]
function walk(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full]})}
function read(file){return fs.existsSync(file)?fs.readFileSync(file,"utf8"):""}
function hasDirectSupabase(source){return /(?:lib\/supabase|\bsupabase\.(?:from|rpc|channel|removeChannel)\b)/.test(source)}
for(const file of roots.flatMap(walk)){if(!codeExtensions.has(path.extname(file)))continue;const source=fs.readFileSync(file,"utf8"),bytes=Buffer.byteLength(source),lines=source.split(/\r?\n/).length,normalized=file.replaceAll("\\","/");if(/SUPABASE_SERVICE_ROLE|service_role/i.test(source)&&!normalized.startsWith("app/api/"))problems.push(`${normalized}: service-role/secret reference forbidden outside server routes`);const budget=legacyBudgets.get(normalized)||defaultBudget;if(bytes>budget.bytes||lines>budget.lines)problems.push(`${normalized}: ${lines} lines / ${bytes} bytes exceeds budget (${budget.lines} / ${budget.bytes})`);else if(legacyBudgets.has(normalized)&&(bytes>defaultBudget.bytes||lines>defaultBudget.lines))warnings.push(`${normalized}: legacy oversized component (${lines} lines / ${bytes} bytes); refactor remains required`);if(normalized.includes("/components/")&&hasDirectSupabase(source))problems.push(`${normalized}: UI component talks directly to Supabase; move access to service/repository`)}
for(const file of uiMustNotUseSupabase){const source=read(file);if(!source)problems.push(`${file}: required refactored UI file is missing`);else if(hasDirectSupabase(source))problems.push(`${file}: direct Supabase access reintroduced after service/hook refactor`)}
for(const file of forbiddenLegacy){if(fs.existsSync(file))problems.push(`${file}: legacy Hotel OS artifact must not exist`)}
const shell=read("app/dashboard/HotelOSV2.jsx"),viewRouter=read("app/dashboard/components/shell/HotelViewRouter.jsx")
if(!shell.includes('from"./components/shell/HotelViewRouter"')||!shell.includes("<HotelViewRouter"))problems.push("HotelOSV2 must delegate module rendering to HotelViewRouter")
if(/function\s+renderView\s*\(/.test(shell))problems.push("HotelOSV2 must stay a shell/orchestrator; renderView belongs in HotelViewRouter")
if(!viewRouter.includes("export default function HotelViewRouter"))problems.push("HotelViewRouter is missing or not exported")
if(hasDirectSupabase(viewRouter))problems.push("HotelViewRouter must stay presentation/orchestration only; no direct Supabase access")
const reservationUi=read("app/dashboard/features/frontdesk/ReservationDrawer.jsx"),reservationOverview=read("app/dashboard/features/frontdesk/components/ReservationOverview.jsx"),reservationStay=read("app/dashboard/features/frontdesk/components/ReservationStayArticles.jsx"),reservationMoney=read("app/dashboard/features/frontdesk/components/ReservationMoneyDocuments.jsx")
for(const [needle,label] of [["ReservationOverview","overview"],["ReservationStayArticles","stay/articles"],["ReservationMoneyDocuments","money/documents"]])if(!reservationUi.includes(`./components/${needle}`))problems.push(`ReservationDrawer must delegate ${label} presentation to ${needle}`)
for(const [source,label] of [[reservationOverview,"ReservationOverview"],[reservationStay,"ReservationStayArticles"],[reservationMoney,"ReservationMoneyDocuments"]]){if(!source.includes(`export default function ${label}`))problems.push(`${label} is missing or not exported`);if(hasDirectSupabase(source))problems.push(`${label} must stay presentation-only; no direct Supabase access`)}
const reservationWorkspace=read("app/dashboard/services/reservationWorkspace.js"),reservationHook=read("app/dashboard/hooks/useReservationWorkspace.js")
if(!reservationWorkspace.includes("requirePropertyId")||!reservationWorkspace.includes('.eq("property_id",property)'))problems.push("reservationWorkspace service must enforce property_id through requirePropertyId")
if(!reservationHook.includes("loadReservationWorkspace")||hasDirectSupabase(reservationHook))problems.push("useReservationWorkspace must orchestrate the service without direct Supabase access")
const housekeepingUi=read("app/dashboard/features/operations/HousekeepingPremium.jsx"),housekeepingView=read("app/dashboard/features/operations/components/HousekeepingWorkspaceView.jsx")
if(!housekeepingUi.includes('from"./components/HousekeepingWorkspaceView"'))problems.push("HousekeepingPremium must delegate presentation to HousekeepingWorkspaceView")
if(!housekeepingView.includes("export default function HousekeepingWorkspaceView"))problems.push("HousekeepingWorkspaceView is missing or not exported")
if(hasDirectSupabase(housekeepingView))problems.push("HousekeepingWorkspaceView must stay presentation-only; no direct Supabase access")
const housekeepingWorkspace=read("app/dashboard/services/housekeepingWorkspace.js"),housekeepingHook=read("app/dashboard/hooks/useHousekeepingWorkspace.js")
if(!housekeepingWorkspace.includes("requirePropertyId")||!housekeepingWorkspace.includes('.eq("property_id",property)'))problems.push("housekeepingWorkspace service must enforce property_id for tenant-scoped reads")
if(!housekeepingWorkspace.includes("filter:`property_id=eq.${property}`"))problems.push("housekeeping realtime subscription must stay filtered by property_id")
if(!housekeepingHook.includes("loadHousekeepingWorkspace")||!housekeepingHook.includes("subscribeHousekeepingWorkspace")||hasDirectSupabase(housekeepingHook))problems.push("useHousekeepingWorkspace must own orchestration/realtime without direct Supabase access")
const groupsUi=read("app/dashboard/features/commercial/GroupsPremium.jsx"),groupEditors=read("app/dashboard/features/commercial/components/GroupDeskEditors.jsx")
if(!groupsUi.includes('from"./components/GroupDeskEditors"'))problems.push("GroupsPremium must keep editor modals outside the main workspace UI")
if(!groupEditors.includes("export default function GroupDeskEditors"))problems.push("GroupDeskEditors is missing or not exported")
if(hasDirectSupabase(groupEditors))problems.push("GroupDeskEditors must stay presentation-only; no direct Supabase access")
const groupsWorkspace=read("app/dashboard/services/groupsWorkspace.js"),groupsHook=read("app/dashboard/hooks/useGroupsWorkspace.js")
if(!groupsWorkspace.includes("requirePropertyId")||!groupsWorkspace.includes('.eq("property_id",property)'))problems.push("groupsWorkspace service must enforce property_id for Group Desk data")
for(const rpc of ["hl_group_create_quote_atomic","hl_group_mark_quote_atomic"])if(!groupsWorkspace.includes(rpc))problems.push(`groupsWorkspace service must use atomic RPC ${rpc}`)
if(!groupsHook.includes("loadGroupsWorkspace")||hasDirectSupabase(groupsHook))problems.push("useGroupsWorkspace must orchestrate Group Desk without direct Supabase access")
const groupMigration=read("supabase/migrations/20260901160500_group_desk_atomic_operations.sql")
for(const rpc of ["hl_group_create_quote_atomic","hl_group_mark_quote_atomic"])if(!groupMigration.includes(rpc))problems.push(`Group Desk migration missing ${rpc}`)
if(!/security invoker/i.test(groupMigration))problems.push("Group Desk atomic RPCs must remain security invoker so RLS stays authoritative")
const accessUi=read("app/dashboard/features/hotel/AccessKeysPremium.jsx"),accessEditor=read("app/dashboard/features/hotel/components/AccessPointEditor.jsx")
if(!accessUi.includes('from"./components/AccessPointEditor"'))problems.push("AccessKeysPremium must keep point editing outside the main workspace UI")
if(!accessEditor.includes("export default function AccessPointEditor"))problems.push("AccessPointEditor is missing or not exported")
if(hasDirectSupabase(accessEditor))problems.push("AccessPointEditor must stay presentation-only; no direct Supabase access")
const accessService=read("app/dashboard/services/access.js"),accessHook=read("app/dashboard/hooks/useAccessWorkspace.js")
if(!accessService.includes("requirePropertyId")||!accessService.includes("subscribeAccessWorkspace"))problems.push("Access service must keep tenant validation and realtime orchestration")
if(!accessService.includes("filter:`property_id=eq.${property}`"))problems.push("Access realtime subscription must stay filtered by property_id")
if(!accessHook.includes("loadAccessWorkspace")||!accessHook.includes("subscribeAccessWorkspace")||hasDirectSupabase(accessHook))problems.push("useAccessWorkspace must orchestrate Access without direct Supabase access")
const reportUi=read("app/dashboard/features/finance/ReportsPremium.jsx"),reportEngine=read("app/dashboard/features/finance/reportEngine.js")
for(const fn of ["buildContext","reportData"])if(!reportEngine.includes(`function ${fn}`)&&!reportEngine.includes(`function ${fn}(`)&&!reportEngine.includes(`export function ${fn}`))problems.push(`reportEngine missing ${fn}`)
if(!reportUi.includes('from"./reportEngine"'))problems.push("ReportsPremium must keep report calculations outside presentation UI")
if(/from["']react["']/.test(reportEngine)||hasDirectSupabase(reportEngine))problems.push("reportEngine must stay pure: no React or Supabase dependency")
const page=read("app/dashboard/page.jsx");if(!/HotelOSV2/.test(page))problems.push("app/dashboard/page.jsx: dashboard must use HotelOSV2 modular shell")
const pkg=JSON.parse(read("package.json"));for(const required of ["check:product-boundaries","check:hotel-architecture","build"])if(!pkg.scripts?.[required])problems.push(`package.json: missing ${required} script`);for(const script of ["dev","build"])if(/harden-hotel-os-atomic/.test(pkg.scripts?.[script]||""))problems.push(`package.json: ${script} still depends on legacy Hotel OS hardener`)
const reservationService=read("app/dashboard/services/reservations.js");for(const rpc of ["hl_planning_move_reservation_atomic","hl_checkout_reservation_atomic","hl_planning_change_room_atomic","hl_planning_swap_reservations_atomic","hl_undo_planning_operation_atomic"])if(!reservationService.includes(rpc))problems.push(`app/dashboard/services/reservations.js: missing required atomic RPC ${rpc}`)
const hotelService=read("app/dashboard/services/hotel.js");if(!hotelService.includes("hl_create_web_checkin_token"))problems.push("app/dashboard/services/hotel.js: secure Web Check-in RPC is missing");if(!hotelService.includes("Authorization:`Bearer ${token}`")&&!hotelService.includes("Authorization:`Bearer ${session.access_token}`"))problems.push("app/dashboard/services/hotel.js: authenticated server calls must carry session bearer token")
if(warnings.length)console.warn("Architecture debt still tracked:\n- "+warnings.join("\n- "))
if(problems.length){console.error("Habitación Llena architecture guard failed:\n- "+problems.join("\n- "));process.exit(1)}
console.log("Habitación Llena architecture guard OK: modular shell router, reservation workspace separation, product boundaries, tenant services, UI/Supabase separation, Group Desk atomicity, Access isolation, Reports engine separation, component budgets, atomic operations and server-secret rules verified")
