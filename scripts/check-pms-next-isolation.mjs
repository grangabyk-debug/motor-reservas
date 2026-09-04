import fs from"node:fs"
import path from"node:path"

const root=path.resolve("app/pms-next")
const allowedExtensions=new Set([".js",".jsx",".ts",".tsx",".css",".md"])
const violations=[]

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name)
    if(entry.isDirectory()){walk(full);continue}
    if(!allowedExtensions.has(path.extname(entry.name)))continue
    const rel=path.relative(process.cwd(),full)
    const source=fs.readFileSync(full,"utf8")
    if(/app\/dashboard|from\s*["'][^"']*dashboard|import\s*["'][^"']*dashboard/i.test(source))violations.push(`${rel}: imports or references legacy dashboard code`)
    const bytes=Buffer.byteLength(source)
    const lines=source.split(/\r?\n/).length
    if(lines>520||bytes>26000)violations.push(`${rel}: ${lines} lines / ${bytes} bytes exceeds PMS Next module budget`)
  }
}

if(!fs.existsSync(root)){
  console.error("PMS Next isolation guard failed: app/pms-next does not exist")
  process.exit(1)
}
walk(root)

if(violations.length){
  console.error("PMS Next isolation guard failed:\n- "+violations.join("\n- "))
  process.exit(1)
}
console.log("PMS Next isolation guard OK: greenfield UI remains independent from app/dashboard")
