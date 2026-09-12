import fs from"node:fs"

const failures=[]
const read=path=>fs.readFileSync(path,"utf8")
const dashboard=read("app/dashboard/page.jsx")
const dashboardLayout=read("app/dashboard/layout.jsx")
const users=read("app/dashboard/usuarios/page.jsx")
const app=read("app/pms-next/PmsNextApp.jsx")

if(!/redirect\(["']\/pms-next["']\)/.test(dashboard))failures.push("/dashboard debe redirigir exclusivamente a /pms-next")
if(!/redirect\(["']\/pms-next["']\)/.test(dashboardLayout))failures.push("El layout legacy /dashboard debe quedar bloqueado y redirigir a /pms-next")
if(!/redirect\(["']\/pms-next\?view=staff["']\)/.test(users))failures.push("/dashboard/usuarios debe redirigir a /pms-next?view=staff")
if(app.includes("app/dashboard/")||app.includes("../dashboard/")||app.includes("../../dashboard/"))failures.push("PmsNextApp no puede depender del frontend legacy app/dashboard")
if(!fs.existsSync("app/pms-next/features/operations/MaintenancePremium.jsx"))failures.push("MaintenancePremium debe vivir dentro de app/pms-next")
if(!fs.existsSync("app/pms-next/features/intelligence/IntelligenceWorkspace.jsx"))failures.push("Inteligencia debe vivir dentro de app/pms-next")
if(!app.includes('from"./features/intelligence/IntelligenceWorkspace"'))failures.push("PmsNextApp debe montar Inteligencia desde pms-next")

if(failures.length){console.error("PMS canonical guard failed:\n- "+failures.join("\n- "));process.exit(1)}
console.log("PMS canonical guard OK: /pms-next es el único frontend operativo")
