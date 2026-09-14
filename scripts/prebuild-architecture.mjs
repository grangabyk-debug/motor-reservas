import{spawnSync}from"node:child_process"

const branch=process.env.VERCEL_GIT_COMMIT_REF||process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME||""
const legacyBuild=process.env.PMS_LEGACY_BUILD==="1"

function run(command,args){
  const result=spawnSync(command,args,{stdio:"inherit",shell:process.platform==="win32"})
  if(result.status!==0)process.exit(result.status??1)
}

if(!legacyBuild){
  console.log(`PMS Next prebuild: canonical validation for ${branch||"local build"}`)
  run("npm",["run","check:product-boundaries"])
  run("node",["scripts/check-pms-next-isolation.mjs"])
  run("node",["scripts/check-pms-next-visual-consistency.mjs"])
  run("npm",["run","check:pms-sitemap"])
}else{
  console.log(`Habitación Llena prebuild: explicit legacy validation for ${branch||"local build"}`)
  run("npm",["run","check:hotel-architecture"])
}
