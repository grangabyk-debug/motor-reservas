"use client"

import{useCallback,useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"

export default function ReservationOperationalRules({propertyId}){
  const[settings,setSettings]=useState({}),[open,setOpen]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState("")
  const load=useCallback(async()=>{
    if(!propertyId)return
    const{data,error}=await supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle()
    if(error){setMessage(error.message||"No se pudieron leer las reglas de reservas.");return}
    setSettings(data?.settings||{})
  },[propertyId])
  useEffect(()=>{load()},[load])

  const prefs=settings?.preferences||{},autoNoShow=Boolean(prefs.auto_no_show_enabled),autoTime=prefs.auto_no_show_time||"02:05",dirtyPolicy=prefs.checkin_dirty_room_policy||"allow"
  const input={height:37,border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",padding:"0 9px",font:"inherit",boxSizing:"border-box",width:"100%"}
  const button={height:34,padding:"0 11px",display:"inline-flex",alignItems:"center",gap:7,border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:850,cursor:"pointer"}

  async function saveRules(nextPrefs){
    if(saving)return
    setSaving(true);setMessage("")
    try{
      const next={...settings,preferences:{...(settings?.preferences||{}),...nextPrefs}}
      const{error}=await supabase.from("property_settings").upsert({property_id:propertyId,settings:next,updated_at:new Date().toISOString()},{onConflict:"property_id"})
      if(error)throw error
      setSettings(next);setMessage("Reglas de reservas guardadas.")
    }catch(err){setMessage(err?.message||"No se pudieron guardar las reglas.")}
    finally{setSaving(false)}
  }

  return <section style={{margin:"0 14px 10px",display:"grid",justifyItems:"end",gap:8}}>
    <button type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} style={button}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></svg>
      Reglas de reservas
    </button>
    {open?<div style={{width:"min(720px,100%)",padding:12,border:"1px solid var(--line)",borderRadius:13,background:"color-mix(in srgb,var(--panelSolid) 95%,transparent)",boxShadow:"0 12px 30px rgba(18,30,52,.07)",display:"grid",gap:10}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9}}>
        <label style={{display:"grid",gap:5,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>No Show automático<select disabled={saving} value={autoNoShow?"on":"off"} onChange={e=>saveRules({auto_no_show_enabled:e.target.value==="on"})} style={input}><option value="off">Desactivado</option><option value="on">Activado</option></select></label>
        <label style={{display:"grid",gap:5,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>Hora de No Show<input type="time" disabled={saving||!autoNoShow} value={autoTime} onChange={e=>saveRules({auto_no_show_time:e.target.value})} style={input}/></label>
        <label style={{display:"grid",gap:5,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>Check-in con habitación sucia<select disabled={saving} value={dirtyPolicy} onChange={e=>saveRules({checkin_dirty_room_policy:e.target.value})} style={input}><option value="allow">Permitir con advertencia</option><option value="manager_only">Sólo con supervisor</option><option value="block">Bloquear</option></select></label>
      </div>
      {message?<small style={{fontSize:9.5,color:"var(--muted)"}}>{message}</small>:null}
    </div>:null}
  </section>
}
