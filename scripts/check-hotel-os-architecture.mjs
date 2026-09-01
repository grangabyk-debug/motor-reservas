import fs from "node:fs"
import path from "node:path"

const roots=["app/dashboard","app/check-in","app/access","app/api/hotel"]
const codeExtensions=new Set([".js",".jsx",".mjs",".ts",".tsx"])
const defaultBudget={bytes:24000,lines:520}
const legacyBudgets=new Map([
  ["app/dashboard/features/frontdesk/ReservationDrawer.jsx",{bytes:43000,lines:900}],
  ["app/dashboard/features/operations/HousekeepingPremium.jsx",{bytes:44000,lines:900}],
  ["app/dashboard/features/commercial/GroupsPremium.jsx",{bytes:38000,lines:800}],
  ["app/dashboard/features/finance/ReportsPremium.jsx",{bytes:32000,lines:700}],
  ["app/dashboard/features/hotel/AccessKeysPremium.jsx",{bytes:30000,lines:650}],
  ["app/dashboard/HotelOSV2.jsx",{bytes:30000,lines:700}],
])
const forbiddenLegacy=["app/dashboard/HotelOSClient.jsx","app/dashboard/AdvancedHotelModules.jsx","app/dashboard/advanced.module.css","scripts/harden-hotel-os-atomic.mjs"]
const problems=[],warnings=[]

function walk(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full]})}

for(const file of roots.flatMap(walk)){
  if(!codeExtensions.has(path.extname(file)))continue
  const source=fs.readFileSync(file,"utf8"),bytes=Buffer.byteLength(source),lines=source.split(/\r?\n/).length,normalized=file.replaceAll("\\","/")
  if(/SUPABASE_SERVICE_ROLE|service_role/i.test(source)&&!normalized.startsWith("app/api/"))problems.push(`${normalized}: service-role/secret reference forbidden outside server routes`)
  const budget=legacyBudgets.get(normalized)||defaultBudget
  if(bytes>budget.bytes||lines>budget.lines)problems.push(`${normalized}: ${lines} lines / ${bytes} bytes exceeds budget (${budget.lines} / ${budget.bytes})`)
  else if(legacyBudgets.has(normalized)&&(bytes>defaultBudget.bytes||lines>defaultBudget.lines))warnings.push(`${normalized}: legacy oversized component (${lines} lines / ${bytes} bytes); refactor remains required`)
  if(normalized.includes("/components/")&&/\.from\(["'`]|\.rpc\(["'`]/.test(source))problems.push(`${normalized}: UI component talks directly to Supabase; move access to service/repository`)
}

for(const file of forbiddenLegacy){if(fs.existsSync(file))problems.push(`${file}: legacy Hotel OS artifact must not exist`)}

const pagePath="app/dashboard/page.jsx",page=fs.existsSync(pagePath)?fs.readFileSync(pagePath,"utf8"):""
if(!/HotelOSV2/.test(page))problems.push("app/dashboard/page.jsx: dashboard must use HotelOSV2 modular shell")

const pkg=JSON.parse(fs.readFileSync("package.json","utf8"))
for(const required of ["check:product-boundaries","check:hotel-architecture","build"]){if(!pkg.scripts?.[required])problems.push(`package.json: missing ${required} script`)}
for(const script of ["dev","build"]){if(/harden-hotel-os-atomic/.test(pkg.scripts?.[script]||""))problems.push(`package.json: ${script} still depends on legacy Hotel OS hardener`)}

const reservationService=fs.existsSync("app/dashboard/services/reservations.js")?fs.readFileSync("app/dashboard/services/reservations.js","utf8"):""
for(const rpc of ["hl_planning_move_reservation_atomic","hl_checkout_reservation_atomic","hl_planning_change_room_atomic","hl_planning_swap_reservations_atomic","hl_undo_planning_operation_atomic"]){if(!reservationService.includes(rpc))problems.push(`app/dashboard/services/reservations.js: missing required atomic RPC ${rpc}`)}

const hotelService=fs.existsSync("app/dashboard/services/hotel.js")?fs.readFileSync("app/dashboard/services/hotel.js","utf8"):""
if(!hotelService.includes("hl_create_web_checkin_token"))problems.push("app/dashboard/services/hotel.js: secure Web Check-in RPC is missing")
if(!hotelService.includes("Authorization:`Bearer ${token}`")&&!hotelService.includes("Authorization:`Bearer ${session.access_token}`"))problems.push("app/dashboard/services/hotel.js: authenticated server calls must carry session bearer token")

if(warnings.length)console.warn("Architecture debt still tracked:\n- "+warnings.join("\n- "))
if(problems.length){console.error("Habitación Llena architecture guard failed:\n- "+problems.join("\n- "));process.exit(1)}
console.log("Habitación Llena architecture guard OK: boundaries, component budgets, atomic operations and server-secret rules verified")
