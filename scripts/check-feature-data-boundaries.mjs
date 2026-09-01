import fs from"node:fs"
import path from"node:path"

const root="app/dashboard/features",extensions=new Set([".js",".jsx",".mjs",".ts",".tsx"]),problems=[]
function walk(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full]})}
function read(file){return fs.existsSync(file)?fs.readFileSync(file,"utf8"):""}
function hasDirectSupabase(source){return /(?:lib\/supabase|\bsupabase\.(?:auth|from|rpc|channel|removeChannel)\b)/.test(source)}
for(const file of walk(root)){if(!extensions.has(path.extname(file)))continue;const source=read(file),normalized=file.replaceAll("\\","/");if(hasDirectSupabase(source))problems.push(`${normalized}: feature UI must not access Supabase directly; use a service/repository`)}
const serviceChecks=[
 ["app/dashboard/services/session.js",["currentUserId","supabase.auth.getUser"]],
 ["app/dashboard/services/preferences.js",["requirePropertyId","hotel_user_preferences",'.eq("property_id",property)']],
 ["app/dashboard/services/resourceCatalog.js",["requirePropertyId","hotel_resources",'.eq("property_id",property)']],
 ["app/dashboard/services/mercadoPagoOAuth.js",["mercadoPagoAuthFetch","supabase.auth.getSession","Authorization:`Bearer ${session.access_token}`"]],
]
for(const[file,markers]of serviceChecks){const source=read(file);if(!source){problems.push(`${file}: required service is missing`);continue}for(const marker of markers)if(!source.includes(marker))problems.push(`${file}: missing boundary marker ${marker}`)}
if(problems.length){console.error("Habitación Llena feature data boundary guard failed:\n- "+problems.join("\n- "));process.exit(1)}
console.log("Habitación Llena feature data boundary guard OK: features are presentation-only and data/auth access stays in services")
