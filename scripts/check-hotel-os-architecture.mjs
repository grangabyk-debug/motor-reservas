import fs from "node:fs"
import path from "node:path"

const roots=["app/dashboard","app/check-in","app/marketing","app/components/hospitality"]
const codeExtensions=new Set([".js",".jsx",".mjs",".ts",".tsx"])
const limits={bytes:52000,lines:420}
const forbiddenLegacy=["app/dashboard/HotelOSClient.jsx","app/dashboard/AdvancedHotelModules.jsx","app/dashboard/advanced.module.css","scripts/harden-hotel-os-atomic.mjs"]
const problems=[]

function walk(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full]})}

for(const file of roots.flatMap(walk)){
  if(!codeExtensions.has(path.extname(file)))continue
  const source=fs.readFileSync(file,"utf8"),bytes=Buffer.byteLength(source),lines=source.split(/\r?\n/).length,normalized=file.replaceAll("\\","/")
  if(/SUPABASE_SERVICE_ROLE|service_role/i.test(source))problems.push(`${normalized}: secret/service-role reference is forbidden in client product code`)
  if(bytes>limits.bytes||lines>limits.lines)problems.push(`${normalized}: ${lines} lines / ${bytes} bytes exceeds modular budget (${limits.lines} lines / ${limits.bytes} bytes)`)
  if(normalized.includes("/components/")&&/\.from\(["'`]|\.rpc\(["'`]/.test(source))problems.push(`${normalized}: UI component talks directly to Supabase; move access to data/service layer`)
}

for(const file of forbiddenLegacy){if(fs.existsSync(file))problems.push(`${file}: legacy Hotel OS artifact must not exist`)}

const pagePath="app/dashboard/page.jsx",page=fs.existsSync(pagePath)?fs.readFileSync(pagePath,"utf8"):""
if(!/HotelOSV2/.test(page))problems.push("app/dashboard/page.jsx: dashboard must use HotelOSV2 modular shell")

const pkg=JSON.parse(fs.readFileSync("package.json","utf8"))
for(const script of ["dev","build"]){if(/harden-hotel-os-atomic/.test(pkg.scripts?.[script]||""))problems.push(`package.json: ${script} still depends on legacy Hotel OS hardener`)}

const reservationService=fs.existsSync("app/dashboard/services/reservations.js")?fs.readFileSync("app/dashboard/services/reservations.js","utf8"):""
for(const rpc of ["hl_move_reservation_atomic","hl_checkout_reservation_atomic"]){if(!reservationService.includes(rpc))problems.push(`app/dashboard/services/reservations.js: missing required atomic RPC ${rpc}`)}

const hotelService=fs.existsSync("app/dashboard/services/hotel.js")?fs.readFileSync("app/dashboard/services/hotel.js","utf8"):""
if(!hotelService.includes("hl_create_web_checkin_token"))problems.push("app/dashboard/services/hotel.js: secure Web Check-in RPC is missing")
if(!hotelService.includes("Authorization:`Bearer ${token}`")&&!hotelService.includes("Authorization:`Bearer ${session.access_token}`"))problems.push("app/dashboard/services/hotel.js: authenticated server calls must carry the session bearer token")

if(problems.length){console.error("Habitación Llena architecture guard failed:\n- "+problems.join("\n- "));process.exit(1)}
console.log("Habitación Llena architecture guard OK: modular shell, tenant/client boundaries, atomic operations and legacy removal verified")
