import{spawnSync}from"node:child_process"

const branch=process.env.VERCEL_GIT_COMMIT_REF||process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME||""
const greenfield=branch==="pms-rebuild-zero"||process.env.PMS_NEXT_BUILD==="1"

function run(command,args){
  const result=spawnSync(command,args,{stdio:"inherit",shell:process.platform==="win32"})
  if(result.status!==0)process.exit(result.status??1)
}

if(greenfield){
  console.log(`PMS Next prebuild: isolated validation for ${branch||"local PMS_NEXT_BUILD"}`)
  run("npm",["run","check:product-boundaries"])
  run("node",["scripts/check-pms-next-isolation.mjs"])
  run("node",["scripts/check-pms-next-visual-consistency.mjs"])
}else{
  console.log(`Habitación Llena prebuild: legacy architecture validation for ${branch||"local build"}`)
  run("npm",["run","check:hotel-architecture"])
}
