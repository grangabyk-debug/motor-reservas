import fs from"node:fs"
import path from"node:path"

const roots=["app/pms-next/features","app/pms-next/components/system","app/pms-next/components/boot"].map(p=>path.resolve(p))
const violations=[]
const minPx=10

function walk(dir){
  if(!fs.existsSync(dir))return
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name)
    if(entry.isDirectory()){walk(full);continue}
    if(!entry.name.endsWith(".css"))continue
    const source=fs.readFileSync(full,"utf8")
    const re=/font-size\s*:\s*([0-9]*\.?[0-9]+)px/gi
    let match
    while((match=re.exec(source))){
      const value=Number(match[1])
      if(value>=minPx)continue
      const before=source.slice(0,match.index)
      const line=before.split(/\r?\n/).length
      violations.push(`${path.relative(process.cwd(),full)}:${line} font-size ${value}px is below ${minPx}px`)
    }
  }
}

for(const root of roots)walk(root)
if(violations.length){
  console.error("PMS Next visual consistency guard failed:\n- "+violations.join("\n- "))
  process.exit(1)
}
console.log(`PMS Next visual guard OK: no product-module font-size below ${minPx}px`)
