import fs from "node:fs"
import path from "node:path"

const roots=["app/dashboard","app/check-in","app/marketing","app/components/hospitality"]
const codeExtensions=new Set([".js",".jsx",".mjs",".ts",".tsx"])
const legacyDebt=new Set([
  "app/dashboard/HotelOSClient.jsx",
  "app/dashboard/AdvancedHotelModules.jsx",
  "app/dashboard/usuarios/page.jsx",
])
const limits={bytes:52000,lines:420}
const problems=[]
const notices=[]

function walk(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full]})}

for(const file of roots.flatMap(walk)){
  if(!codeExtensions.has(path.extname(file)))continue
  const source=fs.readFileSync(file,"utf8"),bytes=Buffer.byteLength(source),lines=source.split(/\r?\n/).length,normalized=file.replaceAll("\\","/")
  if(/SUPABASE_SERVICE_ROLE|service_role/i.test(source))problems.push(`${normalized}: secret/service-role reference is forbidden in client product code`)
  if((bytes>limits.bytes||lines>limits.lines)&&!legacyDebt.has(normalized))problems.push(`${normalized}: ${lines} lines / ${bytes} bytes exceeds modular budget (${limits.lines} lines / ${limits.bytes} bytes)`)
  if(legacyDebt.has(normalized))notices.push(`${normalized}: legacy monolith still pending extraction (${lines} lines / ${bytes} bytes)`)
  if(normalized.includes("/components/")&&/\.from\(["'`]/.test(source))problems.push(`${normalized}: UI component talks directly to a database table; move access to data/service layer`)
}

const hardener="scripts/harden-hotel-os-atomic.mjs"
if(fs.existsSync(hardener)){
  const hardening=fs.readFileSync(hardener,"utf8")
  if(/source\.replace|requiredReplace/.test(hardening))notices.push("build hardener still rewrites HotelOS source; migrate remaining patches into normal modules before removing legacy debt")
}

for(const notice of notices)console.log(`Architecture notice: ${notice}`)
if(problems.length){console.error("Habitación Llena architecture guard failed:\n- "+problems.join("\n- "));process.exit(1)}
console.log("Habitación Llena architecture guard OK: tenant/client boundaries and modular budgets verified")
