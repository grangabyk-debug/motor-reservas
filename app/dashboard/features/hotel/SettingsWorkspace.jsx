"use client"

import{useEffect,useState}from"react"
import{SettingsView}from"./HotelViews"
import RegionalCommerceSettings from"./RegionalCommerceSettings"
import ui from"../../v2.module.css"
import s from"./settings-workspace.module.css"

function operational(settings){const value=settings?.operational_settings;return value&&typeof value==="object"?value:{}}

export default function SettingsWorkspace({settings,canManage,onSave}){
  const[draft,setDraft]=useState(settings),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false)
  useEffect(()=>setDraft(settings),[settings?.property_id,settings?.updated_at])
  const ops=operational(draft),settingsKey=`${ops?.region?.country||"AR"}:${ops.currency||"ARS"}:${ops?.region?.locale||""}:${ops?.region?.timezone||""}`
  const setOps=patch=>{setSaved(false);setDraft(current=>({...current,operational_settings:{...operational(current),...patch}}))}
  async function saveRegional(){if(!canManage)return;setBusy(true);setSaved(false);try{await onSave(draft);setSaved(true)}finally{setBusy(false)}}
  function editDashboardWidgets(){if(typeof window!=="undefined")window.location.assign("/dashboard?widgets=1")}
  return <div className={s.workspace}>
    <div className={ui.content}>
      <section className={s.dashboardCard}>
        <div><small>PANEL OPERATIVO</small><h3>Widgets del panel</h3><p>Elegí qué bloques querés ver, su tamaño y el orden. La personalización queda guardada para tu usuario.</p></div>
        <button type="button" onClick={editDashboardWidgets}>Editar widgets del panel</button>
      </section>
      <div className={ui.editorial}><div><small>REGIONAL COMMERCE</small><h2>El PMS habla el idioma operativo del hotel.</h2><p>País, moneda, zona horaria, pagos y fiscalidad se configuran por propiedad. Argentina sigue siendo la base local; el mismo producto puede adaptarse a otros mercados.</p></div></div>
      <RegionalCommerceSettings ops={ops} canManage={canManage} onChange={setOps}/>
      {canManage&&<div className={s.actions}><span>{saved?"✓ Región guardada":"Cambiar país ajusta valores recomendados; podés editarlos antes de guardar."}</span><button type="button" disabled={busy} onClick={saveRegional}>{busy?"Guardando…":"Guardar región y comercio"}</button></div>}
    </div>
    <SettingsView key={settingsKey} settings={draft} canManage={canManage} onSave={onSave}/>
  </div>
}
