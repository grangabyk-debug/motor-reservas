import fs from "node:fs"

const path = "app/dashboard/HotelOSClient.jsx"
const cssPath = "app/dashboard/frontdesk.module.css"
const advancedPath = "app/dashboard/AdvancedHotelModules.jsx"
if (!fs.existsSync(path) || !fs.existsSync(cssPath) || !fs.existsSync(advancedPath)) throw new Error("Habitación Llena OS sources are missing. Refusing to build.")
let source = fs.readFileSync(path, "utf8")
let css = fs.readFileSync(cssPath, "utf8")

function requiredReplace(find, replacement, label) {
  if (!source.includes(find)) throw new Error(`Habitación Llena OS advanced patch failed: ${label}`)
  source = source.replace(find, replacement)
}

if (!source.includes("HOTEL_OS_ADVANCED_PATCH")) {
  requiredReplace(
    'import s from "./frontdesk.module.css"',
    'import s from "./frontdesk.module.css"\nimport AdvancedHotelModules, { AdvancedCommandCenter } from "./AdvancedHotelModules"',
    "advanced import"
  )
  requiredReplace(
    '["team", "Equipo & Roles", "♙"], ["distribution", "Distribution", "⌁"], ["settings", "Configuración", "⚙"],',
    '["team", "Equipo & Roles", "♙"], ["automations", "Automatizaciones", "⚡"], ["intelligence", "Llena Intelligence", "✦"],\n  ["twin", "Digital Twin", "◈"], ["distribution", "Distribution", "⌁"], ["settings", "Configuración", "⚙"],',
    "navigation"
  )
  requiredReplace(
    'email: { mode: "mailto", sender_name: "Recepción" },',
    'email: { mode: "api", sender_name: "Recepción" },',
    "email default"
  )
  requiredReplace(
    'const ROLE_LABELS = { owner: "Propietario", manager: "Gerencia", reception: "Recepción", housekeeping: "Housekeeping", admin: "Administración" }',
    'const ROLE_LABELS = { owner: "Propietario", manager: "Gerencia", reception: "Recepción", housekeeping: "Housekeeping", admin: "Administración", revenue: "Revenue", maintenance: "Mantenimiento", night_audit: "Auditor nocturno" }',
    "role labels"
  )
  requiredReplace(
    '  admin: "Pagos, reportes y lectura administrativa.",\n}',
    '  admin: "Pagos, reportes y lectura administrativa.", revenue: "Tarifas, restricciones, revenue y distribución.",\n  maintenance: "Estado técnico de habitaciones y bloqueos.", night_audit: "Recepción nocturna, pagos, IN/OUT, llaves y auditoría.",\n}',
    "role details"
  )
  requiredReplace(
    'const canManage=["owner","manager"].includes(currentRole), canFront=["owner","manager","reception"].includes(currentRole)',
    'const canManage=["owner","manager"].includes(currentRole), canFront=["owner","manager","reception","night_audit"].includes(currentRole)',
    "front desk roles"
  )
  requiredReplace(
    '<button className={s.primary} onClick={()=>setReservationModal(blankReservation(activeRooms[0]?.id||""))}>＋ Nueva reserva</button>',
    '{canFront&&<button className={s.primary} onClick={()=>setReservationModal(blankReservation(activeRooms[0]?.id||""))}>＋ Nueva reserva</button>}',
    "new reservation permission"
  )
  requiredReplace(
    '{view==="calendar"&&<CommandCenter ',
    '{view==="calendar"&&<AdvancedCommandCenter ',
    "command center replacement"
  )
  const ratesLine = '      {view==="rates"&&<Rates rooms={activeRooms} charges={charges} canManage={canManage} chargeDraft={chargeDraft} setChargeDraft={setChargeDraft} onRate={updateRate} onCharge={updateCharge} onCreateCharge={saveCharge}/>} '
  requiredReplace(ratesLine, ratesLine + '\n      {view==="rates"&&<AdvancedHotelModules view="rates" propertyId={propertyId} user={user} currentRole={currentRole} settings={settings} rooms={activeRooms} reservations={live} payments={payments} floors={floors} charges={charges} notify={notify}/>} ', "rate calendar")
  const teamLine = '      {view==="team"&&<Team members={members} currentRole={currentRole} onRole={updateMemberRole}/>} '
  requiredReplace(teamLine, teamLine + '\n      {view==="team"&&<AdvancedHotelModules view="permissions" propertyId={propertyId} user={user} currentRole={currentRole} settings={settings} rooms={activeRooms} reservations={live} payments={payments} floors={floors} charges={charges} notify={notify}/>} \n      {view==="automations"&&<AdvancedHotelModules view="automations" propertyId={propertyId} user={user} currentRole={currentRole} settings={settings} rooms={activeRooms} reservations={live} payments={payments} floors={floors} charges={charges} notify={notify}/>} \n      {view==="intelligence"&&<AdvancedHotelModules view="intelligence" propertyId={propertyId} user={user} currentRole={currentRole} settings={settings} rooms={activeRooms} reservations={live} payments={payments} floors={floors} charges={charges} notify={notify}/>} \n      {view==="twin"&&<AdvancedHotelModules view="twin" propertyId={propertyId} user={user} currentRole={currentRole} settings={settings} rooms={activeRooms} reservations={live} payments={payments} floors={floors} charges={charges} notify={notify}/>} ', "advanced modules")
  const settingsLine = '      {view==="settings"&&<Settings draft={settingsDraft} setDraft={setSettingsDraft} onSave={saveSettings} canManage={canManage} onLogo={()=>logoRef.current?.click()} ops={operational(settingsDraft)}/>} '
  requiredReplace(settingsLine, settingsLine + '\n      {view==="settings"&&<AdvancedHotelModules view="settings" propertyId={propertyId} user={user} currentRole={currentRole} settings={settings} rooms={activeRooms} reservations={live} payments={payments} floors={floors} charges={charges} notify={notify}/>} ', "advanced settings")
  requiredReplace(
    'team:"Cada persona ve lo que necesita.",distribution:"Una disponibilidad. Todos los canales.",settings:"Tu hotel, tus reglas."',
    'team:"Cada persona ve lo que necesita.",automations:"El hotel reacciona solo.",intelligence:"El hotel, leído en contexto.",twin:"El edificio vivo, en una mirada.",distribution:"Una disponibilidad. Todos los canales.",settings:"Tu hotel, tus reglas."',
    "advanced titles"
  )
  source = source.replace('Propietario, Gerencia, Recepción, Housekeeping y Administración.', 'Propietario, Gerencia, Recepción, Housekeeping, Administración, Revenue, Mantenimiento y Auditor nocturno.')
  const emailPattern = /  function emailReservation\(r\)\{[\s\S]*?\n\n  const reportRows=/
  if (!emailPattern.test(source)) throw new Error("Habitación Llena OS advanced patch failed: email function")
  source = source.replace(emailPattern, `  async function emailReservation(r){if(!r?.email_huesped)return notify("La reserva no tiene email cargado.");try{const {data:{session}}=await supabase.auth.getSession();const response=await fetch("/api/hotel/email",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+(session?.access_token||"")},body:JSON.stringify({reservation_id:r.id})});const data=await response.json();if(data.mode==="sent")return notify("Confirmación enviada por email.");if(data.mailto){location.href=data.mailto;return notify(data.error?"El proveedor no respondió; abrí el correo prearmado.":"Abrí el correo prearmado para enviar.")}notify(data.error||"No se pudo preparar el email.")}catch(error){notify(error.message)}}\n\n  const reportRows=`)
  source += "\n/* HOTEL_OS_ADVANCED_PATCH */\n"
  fs.writeFileSync(path, source)
}

if (!css.includes("HOTEL_OS_READABILITY_PATCH")) {
  css += `\n/* HOTEL_OS_READABILITY_PATCH */\n.shell{font-size:16px;line-height:1.45}.shell small{font-size:11px;line-height:1.35}.sidebar nav button{min-height:46px;font-size:14px}.sidebar nav button span{font-size:14px}.roleCard b{font-size:14px}.roleCard small{font-size:11px}.topbar h1{font-size:clamp(25px,2.2vw,35px);line-height:1.08}.topbar>div>small{font-size:11px}.shell input,.shell select,.shell textarea,.shell button{font-size:14px}.shell input,.shell select{min-height:42px}.shell textarea{line-height:1.5}.editorial h2,.commandHead h2,.reportHero h2,.keyHero h2{font-size:clamp(30px,3vw,43px)}.editorial p,.commandHead p,.reportHero p,.keyHero p{font-size:15px;line-height:1.55}.tableCard table{font-size:14px}.tableCard th{font-size:11px}.tableCard td small{font-size:11px}.reservationModal fieldset legend{font-size:14px}.reservationModal label,.smallModal label{font-size:13px}.reservationModal header p{font-size:13px}.resBar b{font-size:13px}.resBar small{font-size:9px}.roomLabel span{font-size:17px}.roomLabel small{font-size:11px}@media(max-width:700px){.shell{font-size:16px}.topbar h1{font-size:24px}.sidebar nav button{min-height:50px}.shell input,.shell select,.shell textarea,.shell button{font-size:16px}.tableCard{overflow:auto}.reservationModal{font-size:16px}}\n`
  fs.writeFileSync(cssPath, css)
}

source = fs.readFileSync(path, "utf8")
const advanced = fs.readFileSync(advancedPath, "utf8")
const required = [
  'supabase.rpc("hl_move_reservation_atomic"',
  'supabase.rpc("hl_checkout_reservation_atomic"',
  'from("hotel_floors")',
  'from("hotel_charge_catalog")',
  'from("hotel_key_issues")',
  'AdvancedCommandCenter',
  'AdvancedHotelModules view="automations"',
  'AdvancedHotelModules view="intelligence"',
  'AdvancedHotelModules view="twin"',
]
const missing = required.filter(token => !source.includes(token))
const advancedRequired = ['hotel_rate_calendar','hotel_automations','hotel_role_permissions','hotel_automation_events','Stop Sell','LLENA INTELLIGENCE']
const advancedMissing = advancedRequired.filter(token => !advanced.includes(token))
if (missing.length || advancedMissing.length) throw new Error(`Habitación Llena OS safety check failed: ${[...missing,...advancedMissing].join(", ")}`)
console.log("Habitación Llena OS: full front-desk, advanced rates, roles, automations, Intelligence and Digital Twin verified")
