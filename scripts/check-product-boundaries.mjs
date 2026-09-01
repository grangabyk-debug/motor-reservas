import fs from "node:fs"
import path from "node:path"

const roots=["app","lib"]
const extensions=new Set([".js",".jsx",".mjs",".ts",".tsx"])
const problems=[]
const forbiddenProductRefs=[/comercio[-_/ ]?lleno/i,/comanda[-_/ ]?llena/i,/postula(mejor)?/i,/central[-_/ ]?llena/i]

function walk(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full]})}

for(const file of roots.flatMap(walk)){
  if(!extensions.has(path.extname(file)))continue
  const normalized=file.replaceAll("\\","/")
  const source=fs.readFileSync(file,"utf8")
  for(const pattern of forbiddenProductRefs){if(pattern.test(source))problems.push(`${normalized}: referencia cruzada a otro producto detectada (${pattern})`)}
}

if(problems.length){console.error("Product boundary guard failed:\n- "+problems.join("\n- "));process.exit(1)}
console.log("Product boundary guard OK: Habitación Llena permanece aislado de otros productos")
