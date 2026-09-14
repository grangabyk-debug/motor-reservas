"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./daily-report.module.css"

const DEFAULT={enabled:false,send_time:"08:00",timezone:"America/Argentina/Buenos_Aires",recipients:[],include:{payments:true,reservations:true,arrivals:true,departures:true,cash:true,occupancy:true,channels:true}}
const ITEMS=[["payments","Pagos y medios de cobro"],["reservations","Reservas creadas"],["arrivals","Llegadas"],["departures","Salidas"],["cash","Cierres y diferencias de caja"],["occupancy","Ocupación"],["channels","Origen de reservas"]]
function toast(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}

export default function DailyReportSettings({propertyId,property}){
  const[settings,setSettings]=useState({}),[form,setForm]=useState(DEFAULT),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[testing,setTesting]=useState(false),[error,setError]=useState("")
  const canManage=["owner","manager","admin"].includes(property?.role)
  useEffect(()=>{let live=true;(async()=>{setLoading(true);const{data,error:loadError}=await supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle();if(!live)return;if(loadError)setError(loadError.message);else{const all=data?.settings||{};setSettings(all);setForm({...DEFAULT,...(all.daily_report||{}),include:{...DEFAULT.include,...(all.daily_report?.include||{})}})}setLoading(false)})();return()=>{live=false}},[propertyId])
  const patch=value=>setForm(current=>({...current,...value}))
  const toggle=key=>setForm(current=>({...current,include:{...current.include,[key]:!current.include[key]}}))
  async function save(){
    if(!canManage)return
    const recipients=form.recipients.map(x=>x.trim()).filter(Boolean)
    if(form.enabled&&!recipients.length)return setError("Agregá al menos un destinatario antes de activar el envío automático.")
    setSaving(true);setError("")
    try{const next={...settings,daily_report:{...form,recipients}};const{error:writeError}=await supabase.from("property_settings").upsert({property_id:propertyId,settings:next,updated_at:new Date().toISOString()},{onConflict:"property_id"});if(writeError)throw writeError;setSettings(next);setForm(next.daily_report);window.dispatchEvent(new CustomEvent("hl:property-settings-updated",{detail:{propertyId,settings:next}}));toast({title:"Informe diario configurado",message:form.enabled?`Se preparó el resumen diario para las ${form.send_time}.`:"El envío automático quedó desactivado."})}catch(err){setError(err?.message||"No se pudo guardar la configuración.")}finally{setSaving(false)}
  }
  async function sendTest(){
    setTesting(true);setError("")
    try{const{data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("La sesión venció. Volvé a iniciar sesión.");const response=await fetch("/api/hotel/reports/daily-test",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({property_id:propertyId})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"No se pudo generar el correo de prueba.");if(result.mode==="not_configured")toast({tone:"info",title:"Correo preparado",message:"La plantilla funciona. Falta configurar el remitente/Resend del servidor para enviarlo."});else toast({title:"Informe enviado",message:`Se envió el resumen de prueba a ${result.recipients||form.recipients.length} destinatario(s).`})}catch(err){setError(err?.message||"No se pudo enviar la prueba.")}finally{setTesting(false)}
  }
  if(loading)return <div className={s.loading}>Cargando automatización de informes…</div>
  return <article className={s.card}>
    <header><div><small>INFORME AUTOMÁTICO</small><h2>Resumen de cada mañana</h2><p>Condensa el día anterior y deja a gerencia lista para empezar el día sin abrir diez pantallas.</p></div><label className={s.master}><input type="checkbox" checked={form.enabled} disabled={!canManage} onChange={e=>patch({enabled:e.target.checked})}/><i/><span>{form.enabled?"Activo":"Inactivo"}</span></label></header>
    {error&&<div className={s.error}>{error}</div>}
    <div className={s.grid}><label>Horario de envío<input type="time" value={form.send_time} disabled={!canManage} onChange={e=>patch({send_time:e.target.value})}/></label><label>Zona horaria<input value={form.timezone} disabled={!canManage} onChange={e=>patch({timezone:e.target.value})}/></label><label className={s.wide}>Destinatarios<input value={form.recipients.join(", ")} disabled={!canManage} onChange={e=>patch({recipients:e.target.value.split(",")})} placeholder="gerencia@hotel.com, dueño@hotel.com"/><small>Separalos con coma. El correo sale con la identidad de Habitación Llena.</small></label></div>
    <div className={s.contents}><b>Qué incluye el resumen</b><div>{ITEMS.map(([id,label])=><label key={id} className={form.include[id]?s.on:""}><input type="checkbox" checked={Boolean(form.include[id])} disabled={!canManage} onChange={()=>toggle(id)}/><span>✓</span>{label}</label>)}</div></div>
    <footer><span>{canManage?"Los cambios se guardan por propiedad.":"Sólo Propietario, Gerencia o Administrador pueden cambiar esta automatización."}</span><div><button type="button" disabled={testing||!form.recipients.filter(Boolean).length} onClick={sendTest}>{testing?"Generando…":"Enviar prueba ahora"}</button>{canManage&&<button type="button" className={s.primary} disabled={saving} onClick={save}>{saving?"Guardando…":"Guardar automatización"}</button>}</div></footer>
  </article>
}
