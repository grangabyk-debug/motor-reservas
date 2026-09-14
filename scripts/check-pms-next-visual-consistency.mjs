import fs from"node:fs"
import path from"node:path"

const roots=["app/pms-next/features","app/pms-next/components/system","app/pms-next/components/boot"].map(p=>path.resolve(p))
const violations=[]
const minPx=10
const allowedTinySelectors=new Map([
  ["app/pms-next/features/planning/planning.module.css",new Set([".propertyHeader>span",".avatar"])],
  ["app/pms-next/components/system/pms-notification-center.module.css",new Set([".unreadDot"])],
])

// Estos CSS fueron migrados desde el frontend legacy. Sólo pueden conservar reglas
// históricas menores a 10px mientras el workspace canónico aplique un piso visual
// efectivo >=10px con !important. La excepción es deliberadamente por archivo exacto.
const scopedMigratedCss=new Map([
  ["app/pms-next/features/operations/maintenance-premium.module.css",{wrapper:"app/pms-next/features/operations/OperationsWorkspace.jsx",marker:"data-maintenance-premium",checks:["small{font-size:11px!important","span,[data-maintenance-premium] em,[data-maintenance-premium] label,[data-maintenance-premium] footer{font-size:max(10px"]}],
  ["app/pms-next/features/intelligence/analytics-overview.module.css",{wrapper:"app/pms-next/features/intelligence/IntelligenceWorkspace.jsx",marker:"data-intelligence",checks:["small{font-size:11px!important","span,[data-intelligence] em,[data-intelligence] label,[data-intelligence] footer{font-size:max(10px"]}],
  ["app/pms-next/features/intelligence/booking-window.module.css",{wrapper:"app/pms-next/features/intelligence/IntelligenceWorkspace.jsx",marker:"data-intelligence",checks:["small{font-size:11px!important","span,[data-intelligence] em,[data-intelligence] label,[data-intelligence] footer{font-size:max(10px"]}],
  ["app/pms-next/features/intelligence/channel-performance.module.css",{wrapper:"app/pms-next/features/intelligence/IntelligenceWorkspace.jsx",marker:"data-intelligence",checks:["small{font-size:11px!important","span,[data-intelligence] em,[data-intelligence] label,[data-intelligence] footer{font-size:max(10px"]}],
  ["app/pms-next/features/intelligence/financial-performance.module.css",{wrapper:"app/pms-next/features/intelligence/IntelligenceWorkspace.jsx",marker:"data-intelligence",checks:["small{font-size:11px!important","span,[data-intelligence] em,[data-intelligence] label,[data-intelligence] footer{font-size:max(10px"]}],
  ["app/pms-next/features/intelligence/intelligence-signals.module.css",{wrapper:"app/pms-next/features/intelligence/IntelligenceWorkspace.jsx",marker:"data-intelligence",checks:["small{font-size:11px!important","span,[data-intelligence] em,[data-intelligence] label,[data-intelligence] footer{font-size:max(10px"]}],
  ["app/pms-next/features/intelligence/room-type-performance.module.css",{wrapper:"app/pms-next/features/intelligence/IntelligenceWorkspace.jsx",marker:"data-intelligence",checks:["small{font-size:11px!important","span,[data-intelligence] em,[data-intelligence] label,[data-intelligence] footer{font-size:max(10px"]}],
])
const scopedCache=new Map()

function selectorBefore(source,index){
  const open=source.lastIndexOf("{",index)
  if(open<0)return""
  const close=source.lastIndexOf("}",open)
  return source.slice(close+1,open).trim()
}

function migratedScopeIsEnforced(rel){
  const config=scopedMigratedCss.get(rel)
  if(!config)return false
  if(scopedCache.has(rel))return scopedCache.get(rel)
  let ok=false
  try{
    const source=fs.readFileSync(path.resolve(config.wrapper),"utf8")
    ok=source.includes(config.marker)&&config.checks.every(check=>source.includes(check))
  }catch{ok=false}
  scopedCache.set(rel,ok)
  return ok
}

function walk(dir){
  if(!fs.existsSync(dir))return
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name)
    if(entry.isDirectory()){walk(full);continue}
    if(!entry.name.endsWith(".css"))continue
    const source=fs.readFileSync(full,"utf8"),rel=path.relative(process.cwd(),full).replaceAll("\\","/")
    const re=/font-size\s*:\s*([0-9]*\.?[0-9]+)px/gi
    let match
    while((match=re.exec(source))){
      const value=Number(match[1])
      if(value>=minPx)continue
      const selector=selectorBefore(source,match.index)
      if(allowedTinySelectors.get(rel)?.has(selector))continue
      if(migratedScopeIsEnforced(rel))continue
      const line=source.slice(0,match.index).split(/\r?\n/).length
      violations.push(`${rel}:${line} ${selector||"unknown selector"} uses ${value}px below ${minPx}px`)
    }
  }
}

for(const root of roots)walk(root)
for(const[rel]of scopedMigratedCss)if(!migratedScopeIsEnforced(rel))violations.push(`${rel}: migrated microtype exception requires its canonical scoped >=10px wrapper`)
if(violations.length){
  console.error("PMS Next visual consistency guard failed:\n- "+violations.join("\n- "))
  process.exit(1)
}
console.log(`PMS Next visual guard OK: product text stays >= ${minPx}px; migrated CSS is accepted only behind canonical scoped minimums`)
