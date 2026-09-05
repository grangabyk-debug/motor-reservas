import fs from"node:fs"
import path from"node:path"

const roots=["app/pms-next/features","app/pms-next/components/system","app/pms-next/components/boot"].map(p=>path.resolve(p))
const violations=[]
const minPx=10
const allowedTinySelectors=new Map([
  ["app/pms-next/features/planning/planning.module.css",new Set([".propertyHeader>span",".avatar"])],
])

function selectorBefore(source,index){
  const open=source.lastIndexOf("{",index)
  if(open<0)return""
  const close=source.lastIndexOf("}",open)
  return source.slice(close+1,open).trim()
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
      const line=source.slice(0,match.index).split(/\r?\n/).length
      violations.push(`${rel}:${line} ${selector||"unknown selector"} uses ${value}px below ${minPx}px`)
    }
  }
}

for(const root of roots)walk(root)
if(violations.length){
  console.error("PMS Next visual consistency guard failed:\n- "+violations.join("\n- "))
  process.exit(1)
}
console.log(`PMS Next visual guard OK: product text stays >= ${minPx}px; only documented planning glyphs are exempt`)
