"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import useDashboardData from"./useDashboardData"
import s from"./dashboard.module.css"

const shortcuts=[{id:"planning",label:"Planning",icon:"▦"},{id:"quotes",label:"Presupuestar",icon:"◇"},{id:"messages",label:"Mensajes",icon:"◌"},{id:"finance",label:"Finanzas",icon:"▤"},{id:"rates",label:"Tarifas y disponibilidad",icon:"↗"}]

export default function DashboardWorkspace({propertyId,property,onNavigate,allowedViews=[]}){
  const data=useDashboardData(propertyId),m=data.metrics
  const[hotelPhoto,setHotelPhoto]=useState("")
  const allowed=useMemo(()=>new Set(allowedViews),[allowedViews])
  const can=id=>allowed.size===0||allowed.has(id)
  useEffect(()=>{
    let active=true
    async function loadPhoto(){const{data:row}=await supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle();if(active)setHotelPhoto(row?.settings?.branding?.hotel_photo_url||"")}
    if(propertyId)loadPhoto()
    const onSettings=event=>{if(event.detail?.propertyId===propertyId)setHotelPhoto(event.detail?.settings?.branding?.hotel_photo_url||"")}
    window.addEventListener("hl:property-settings-updated",onSettings)
    return()=>{active=false;window.removeEventListener("hl:property-settings-updated",onSettings)}
  },[propertyId])
  const quickLinks=shortcuts.filter(item=>can(item.id))
  return <section className={s.page}>
    <header className={s.intro}><div><small>OPERACIÓN DE HOY</small><h1>{property?.name||"Habitación Llena"}</h1><p>Lo importante del hotel, actualizado desde la propiedad activa.</p></div><button className={s.statusPill} onClick={data.load}>{data.loading?"Actualizando…":"Datos en vivo"}</button></header>
    {data.error&&<div className={s.notice}>{data.error}</div>}
    <div className={`${s.hotelHero} ${hotelPhoto?s.hasPhoto:""}`}>{hotelPhoto?<img src={hotelPhoto} alt={`Vista de ${property?.name||"hotel"}`}/>:null}<div className={s.heroGlow}/><div className={s.heroGlass}><small>MI PROPIEDAD</small><b>{property?.name||"Habitación Llena"}</b><span>{hotelPhoto?"Imagen configurada por el hotel":"Agregá una foto para personalizar el panel de recepción."}</span></div>{can("settings")&&<button type="button" className={s.heroEdit} onClick={()=>onNavigate?.("settings")}>{hotelPhoto?"Cambiar foto":"Subir foto"}</button>}</div>
    <div className={s.todayGrid}>{can("reservations")&&<button onClick={()=>onNavigate?.("reservations")}><small>Llegadas</small><b>{m.arrivals}</b><span>hoy</span></button>}{can("reservations")&&<button onClick={()=>onNavigate?.("reservations")}><small>Salidas</small><b>{m.departures}</b><span>hoy</span></button>}{can("planning")&&<button onClick={()=>onNavigate?.("planning")}><small>Ocupación</small><b>{m.occupancy.toFixed(0)}%</b><span>{m.inhouse}/{m.totalRooms} habitaciones</span></button>}{can("housekeeping")&&<button onClick={()=>onNavigate?.("housekeeping")}><small>Habitaciones sucias</small><b>{m.dirty}</b><span>{m.ready} listas</span></button>}</div>
    {(can("tasks")||can("maintenance"))&&<div className={s.mainGrid}>{can("tasks")&&<button className={s.operationCard} type="button" onClick={()=>onNavigate?.("tasks")}><div className={s.operationHead}><small>HOUSEKEEPING · CHECK-LISTS</small><span>›</span></div><div className={s.operationBody}><div className={s.ring} style={{"--progress":m.checkPct}}><div className={s.ringContent}><b>{m.checkDone}<span>/{m.checkTotal}</span></b><small>{m.checkPct}%</small></div></div><small>pasos completados hoy</small></div></button>}{can("maintenance")&&<button className={s.operationCard} type="button" onClick={()=>onNavigate?.("maintenance")}><div className={s.operationHead}><small>MANTENIMIENTO</small><span>›</span></div><div className={s.operationBody}><div className={s.bigNumber}>{m.maintenance}</div><small className={s.bigNumberNote}>tareas abiertas · {m.urgent} urgentes</small></div></button>}</div>}
    {quickLinks.length>0&&<div className={s.quickGrid}>{quickLinks.map(item=><button key={item.id} className={s.quickLink} type="button" onClick={()=>onNavigate?.(item.id)}><span>{item.icon}</span>{item.label}</button>)}</div>}
    <div className={s.hint}><span><b>{property?.name||"Propiedad"}</b> · {m.totalRooms} habitaciones activas</span><span>Accesos adaptados al rol · modo día/noche · datos separados por propiedad</span></div>
  </section>
}
