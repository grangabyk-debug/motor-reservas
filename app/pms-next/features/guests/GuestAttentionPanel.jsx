"use client"

import{useCallback,useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const todayKey=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const clean=value=>String(value||"").trim()
const norm=value=>clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ")

function Icon({name,size=17}){
  const common={viewBox:"0 0 24 24",width:size,height:size,fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true}
  if(name==="occasion")return <svg {...common}><path d="M4 11h16v9H4zM12 11v9M4 15h16"/><path d="M12 11H8.4a2.4 2.4 0 1 1 2.15-3.48L12 11Zm0 0h3.6a2.4 2.4 0 1 0-2.15-3.48L12 11Z"/></svg>
  if(name==="return")return <svg {...common}><path d="M8 7H4v-4"/><path d="M4.5 7.5A8 8 0 1 1 4 15"/><path d="M9 12h6M12 9v6"/></svg>
  return <svg {...common}><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></svg>
}

function daysUntilBirthday(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||"")))return null
  const now=new Date(`${todayKey()}T12:00:00`),parts=String(value).split("-"),month=Number(parts[1])-1,day=Number(parts[2]);let next=new Date(now.getFullYear(),month,day,12)
  if(next<now)next=new Date(now.getFullYear()+1,month,day,12)
  return Math.round((next-now)/86400000)
}

export default function GuestAttentionPanel({propertyId}){
  const[rows,setRows]=useState([]),[settings,setSettings]=useState({}),[loading,setLoading]=useState(true),[rulesOpen,setRulesOpen]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState("")
  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setMessage("")
    try{
      const[resRes,settingsRes,roomRes]=await Promise.all([
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,habitacion_id,fecha_entrada,fecha_salida,estado,no_show,guest_profile_id").eq("property_id",propertyId).eq("estado","alojado").eq("no_show",false),
        supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
        supabase.from("habitaciones").select("id,nombre").eq("property_id",propertyId),
      ])
      if(resRes.error)throw resRes.error;if(settingsRes.error)throw settingsRes.error;if(roomRes.error)throw roomRes.error
      const loadedSettings=settingsRes.data?.settings||{},prefs=loadedSettings.preferences||{},birthdayLead=Math.max(0,Math.min(30,Number(prefs.birthday_notice_days??3)||0)),returnThreshold=Math.max(2,Math.min(20,Number(prefs.returning_guest_threshold??2)||2)),birthdayBenefit=clean(prefs.birthday_benefit)||"Evaluar cortesía o beneficio de cumpleaños según disponibilidad y política del hotel.",returnBenefit=clean(prefs.returning_guest_benefit)||"Revisar preferencias históricas y considerar reconocimiento de huésped recurrente.",reservations=resRes.data||[],ids=reservations.map(r=>r.id),roomById=new Map((roomRes.data||[]).map(r=>[Number(r.id),r.nombre]))
      setSettings(loadedSettings)
      if(!ids.length){setRows([]);return}
      const guestRes=await supabase.from("hotel_reservation_guests").select("id,reservation_id,room_id,guest_profile_id,full_name,birth_date,checked_out_at,stay_from,stay_to").eq("property_id",propertyId).in("reservation_id",ids).is("checked_out_at",null)
      if(guestRes.error)throw guestRes.error
      const guests=guestRes.data||[],profileIds=[...new Set(guests.map(g=>g.guest_profile_id).filter(Boolean))]
      let profiles=[],historyGuests=[],historyReservations=[]
      if(profileIds.length){
        const[pRes,hgRes]=await Promise.all([
          supabase.from("hotel_guest_profiles").select("id,full_name,birth_date,vip_level,preferences,tags").eq("property_id",propertyId).in("id",profileIds),
          supabase.from("hotel_reservation_guests").select("guest_profile_id,reservation_id").eq("property_id",propertyId).in("guest_profile_id",profileIds).limit(5000),
        ])
        if(pRes.error)throw pRes.error;if(hgRes.error)throw hgRes.error;profiles=pRes.data||[];historyGuests=hgRes.data||[]
        const historyIds=[...new Set(historyGuests.map(g=>g.reservation_id).filter(Boolean))]
        if(historyIds.length){const hr=await supabase.from("reservas").select("id,estado,no_show").eq("property_id",propertyId).in("id",historyIds);if(hr.error)throw hr.error;historyReservations=hr.data||[]}
      }
      const profileById=new Map(profiles.map(p=>[String(p.id),p])),reservationById=new Map(reservations.map(r=>[Number(r.id),r])),validHistory=new Set(historyReservations.filter(r=>r.estado!=="cancelada"&&!r.no_show).map(r=>Number(r.id))),stayCounts=new Map()
      for(const g of historyGuests){if(!validHistory.has(Number(g.reservation_id)))continue;const key=String(g.guest_profile_id||"");if(!key)continue;if(!stayCounts.has(key))stayCounts.set(key,new Set());stayCounts.get(key).add(Number(g.reservation_id))}
      const today=todayKey(),attention=new Map()
      for(const guest of guests){
        if(guest.stay_from&&guest.stay_from>today)continue;if(guest.stay_to&&guest.stay_to<today)continue
        const profile=profileById.get(String(guest.guest_profile_id||""))||{},reservation=reservationById.get(Number(guest.reservation_id));if(!reservation)continue
        const birth=guest.birth_date||profile.birth_date,days=daysUntilBirthday(birth),count=stayCounts.get(String(guest.guest_profile_id||""))?.size||1,vip=profile.vip_level||"standard",birthday=days!=null&&days<=birthdayLead,returning=count>=returnThreshold
        if(!birthday&&!returning&&!["vip","signature"].includes(vip))continue
        const kind=birthday?"birthday":["vip","signature"].includes(vip)?"vip":"returning",name=guest.full_name||profile.full_name||reservation.nombre_huesped||"Huésped",benefit=clean(profile.preferences?.benefit_note)||(birthday?birthdayBenefit:returning?returnBenefit:"Revisar preferencias y nivel de servicio antes de atender.")
        const identity=guest.guest_profile_id?`profile:${guest.guest_profile_id}`:`name:${norm(name)}`,key=`${identity}|reservation:${reservation.id}`
        if(attention.has(key))continue
        attention.set(key,{id:key,kind,name,days,count,vip,reservation,room:roomById.get(Number(guest.room_id||reservation.habitacion_id))||"—",benefit})
      }
      const next=[...attention.values()].sort((a,b)=>(a.kind==="birthday"?0:a.kind==="vip"?1:2)-(b.kind==="birthday"?0:b.kind==="vip"?1:2)||(a.days??99)-(b.days??99))
      setRows(next.slice(0,8))
    }catch(err){setMessage(err?.message||"No se pudieron leer las señales de huéspedes.")}
    finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{load()},[load])
  useEffect(()=>{if(typeof window==="undefined")return;const refresh=()=>load();window.addEventListener("hl:pms-reservation-updated",refresh);return()=>window.removeEventListener("hl:pms-reservation-updated",refresh)},[load])

  const prefs=settings?.preferences||{},birthdayDays=Number(prefs.birthday_notice_days??3)||0,returnThreshold=Number(prefs.returning_guest_threshold??2)||2,hasAttention=rows.length>0
  const shell={marginBottom:12,border:"1px solid color-mix(in srgb,var(--line) 82%,transparent)",borderRadius:16,background:"color-mix(in srgb,var(--panelSolid) 88%,transparent)",boxShadow:"inset 0 1px color-mix(in srgb,#fff 50%,transparent),0 10px 28px rgba(20,32,58,.06)",overflow:"hidden"},button={height:34,padding:"0 11px",display:"inline-flex",alignItems:"center",gap:7,border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:850,cursor:"pointer"},input={height:37,border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",padding:"0 9px",font:"inherit",boxSizing:"border-box",width:"100%"}

  async function saveRules(nextPrefs){
    if(saving)return
    setSaving(true);setMessage("")
    try{
      const next={...settings,preferences:{...(settings?.preferences||{}),...nextPrefs}}
      const{error}=await supabase.from("property_settings").upsert({property_id:propertyId,settings:next,updated_at:new Date().toISOString()},{onConflict:"property_id"})
      if(error)throw error
      setSettings(next);setMessage("Reglas CRM guardadas.");setTimeout(()=>load(),50)
    }catch(err){setMessage(err?.message||"No se pudieron guardar las reglas CRM.")}
    finally{setSaving(false)}
  }

  return <section style={shell} aria-label="Atención de huéspedes">
    <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"11px 13px",borderBottom:hasAttention||rulesOpen?"1px solid var(--line)":"0"}}><div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}><span style={{width:32,height:32,display:"grid",placeItems:"center",borderRadius:10,background:"color-mix(in srgb,var(--accent) 9%,var(--panelSolid))",color:"var(--accent)"}}><Icon name="occasion"/></span><div><small style={{display:"block",fontSize:9,fontWeight:900,letterSpacing:".09em",color:"var(--muted)"}}>ATENCIÓN DE HUÉSPEDES</small><b style={{display:"block",fontSize:12}}>{loading?"Leyendo huéspedes alojados…":hasAttention?`${rows.length} señal${rows.length===1?"":"es"} de CRM`:"Sin ocasiones especiales pendientes"}</b></div></div><button type="button" onClick={()=>setRulesOpen(value=>!value)} style={button}><Icon name="rules" size={15}/>Reglas CRM</button></header>
    {message?<div style={{margin:"9px 12px 0",padding:"8px 10px",borderRadius:9,background:"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))",fontSize:10,color:"var(--muted)"}}>{message}</div>:null}
    {hasAttention?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(245px,1fr))",gap:8,padding:11}}>{rows.map(row=><article key={row.id} style={{padding:11,border:"1px solid var(--line)",borderRadius:12,background:"color-mix(in srgb,var(--bg) 28%,var(--panelSolid))"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}><div style={{display:"flex",alignItems:"center",gap:7,color:row.kind==="birthday"?"#9b6b16":row.kind==="vip"?"#7257d9":"var(--accent)"}}><Icon name={row.kind==="birthday"?"occasion":"return"} size={15}/><b style={{fontSize:11,color:"var(--text)"}}>{row.name}</b></div><small style={{fontSize:8.8,fontWeight:900,color:"var(--muted)"}}>{row.kind==="birthday"?(row.days===0?"CUMPLE HOY":`CUMPLE EN ${row.days} DÍAS`):row.kind==="vip"?String(row.vip).toUpperCase():`${row.count} ESTADÍAS`}</small></div><p style={{margin:"6px 0 0",fontSize:9.8,color:"var(--muted)"}}>Hab. {row.room} · {row.reservation.numero_reserva||row.reservation.id}</p><p style={{margin:"7px 0 0",fontSize:10.2,lineHeight:1.45}}>{row.benefit}</p></article>)}</div>:null}
    {rulesOpen?<div style={{padding:12,borderTop:hasAttention?"1px solid var(--line)":"0",display:"grid",gap:10}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:9}}><label style={{display:"grid",gap:5,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>Avisar cumpleaños con anticipación<input type="number" min="0" max="30" defaultValue={birthdayDays} onBlur={e=>saveRules({birthday_notice_days:Math.max(0,Math.min(30,Number(e.target.value)||0))})} style={input}/></label><label style={{display:"grid",gap:5,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>Considerar recurrente desde<input type="number" min="2" max="20" defaultValue={returnThreshold} onBlur={e=>saveRules({returning_guest_threshold:Math.max(2,Math.min(20,Number(e.target.value)||2))})} style={input}/></label><label style={{gridColumn:"1/-1",display:"grid",gap:5,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>Beneficio sugerido por cumpleaños<input defaultValue={prefs.birthday_benefit||"Evaluar cortesía o beneficio de cumpleaños según disponibilidad y política del hotel."} onBlur={e=>saveRules({birthday_benefit:e.target.value.trim()})} style={input}/></label><label style={{gridColumn:"1/-1",display:"grid",gap:5,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>Reconocimiento sugerido para recurrentes<input defaultValue={prefs.returning_guest_benefit||"Revisar preferencias históricas y considerar reconocimiento de huésped recurrente."} onBlur={e=>saveRules({returning_guest_benefit:e.target.value.trim()})} style={input}/></label></div><small style={{fontSize:9.5,lineHeight:1.45,color:"var(--muted)"}}>Estas reglas pertenecen al módulo de Huéspedes/CRM. Las sugerencias no modifican reservas ni aplican beneficios automáticamente.</small></div>:null}
  </section>
}
