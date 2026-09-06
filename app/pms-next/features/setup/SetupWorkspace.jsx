"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./setup.module.css"

export default function SetupWorkspace({propertyId,property,onNavigate}){
  const[data,setData]=useState({rooms:0,rates:0,services:0,staff:0,channels:0,settings:false})
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{if(!propertyId)return;setLoading(true);setError("");try{const[rooms,rates,services,staff,channels,settings]=await Promise.all([
    supabase.from("habitaciones").select("id",{count:"exact",head:true}).eq("property_id",propertyId).eq("activa",true),
    supabase.from("hotel_rate_calendar").select("id",{count:"exact",head:true}).eq("property_id",propertyId),
    supabase.from("hotel_charge_catalog").select("id",{count:"exact",head:true}).eq("property_id",propertyId).eq("active",true),
    supabase.from("property_members").select("user_id",{count:"exact",head:true}).eq("property_id",propertyId),
    supabase.from("hotel_channel_connections").select("id",{count:"exact",head:true}).eq("property_id",propertyId).in("status",["connected","sandbox"]),
    supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
  ]);for(const r of[rooms,rates,services,staff,channels,settings])if(r.error)throw r.error;setData({rooms:rooms.count||0,rates:rates.count||0,services:services.count||0,staff:staff.count||0,channels:channels.count||0,settings:Boolean(settings.data?.settings&&Object.keys(settings.data.settings).length)})}catch(err){setError(err?.message||"No se pudo revisar la puesta a punto.")}finally{setLoading(false)}},[propertyId])
  useEffect(()=>{load()},[load])

  const steps=useMemo(()=>[
    {id:"property",title:"Datos de la propiedad",done:Boolean(property?.name&&property?.city),detail:property?.city?`${property.name} · ${property.city}`:"Completá nombre y ciudad",view:"settings"},
    {id:"rooms",title:"Habitaciones",done:data.rooms>0,detail:data.rooms?`${data.rooms} habitaciones activas`:"Cargá las habitaciones del hotel",view:"settings"},
    {id:"rates",title:"Tarifas y disponibilidad",done:data.rates>0,detail:data.rates?"Calendario tarifario configurado":"Definí al menos una tarifa",view:"rates"},
    {id:"preferences",title:"Preferencias operativas",done:data.settings,detail:data.settings?"Horarios y preferencias guardados":"Configurá check-in, check-out y moneda",view:"settings"},
    {id:"services",title:"Servicios y extras",done:data.services>0,detail:data.services?`${data.services} ítems activos`:"Agregá cochera, desayuno u otros extras",view:"services"},
    {id:"staff",title:"Equipo",done:data.staff>0,detail:data.staff?`${data.staff} miembros con acceso`:"Agregá el equipo que operará el PMS",view:"staff"},
    {id:"channels",title:"Canales",done:data.channels>0,optional:true,detail:data.channels?`${data.channels} canales conectados`:"Opcional: conectá OTAs / channel manager",view:"integrations"},
  ],[data,property])
  const required=steps.filter(x=>!x.optional),completed=required.filter(x=>x.done).length,pct=required.length?Math.round(completed/required.length*100):0

  return <section className={s.page}><header className={s.header}><div><small>PUESTA A PUNTO</small><h1>Prepará el hotel para operar</h1><p>{property?.name||"Propiedad activa"} · validación real de la configuración.</p></div><button onClick={load}>↻ Revisar</button></header>{error&&<div className={s.notice}>{error}</div>}
    <div className={s.progressCard}><div><small>PREPARACIÓN</small><b>{loading?"…":`${pct}%`}</b><span>{completed}/{required.length} pasos esenciales completos</span></div><div className={s.ring} style={{"--pct":pct}}><span>{pct}%</span></div></div>
    <div className={s.steps}>{steps.map((step,index)=><button key={step.id} onClick={()=>onNavigate?.(step.view)} className={step.done?s.done:""}><span className={s.number}>{step.done?"✓":index+1}</span><div><b>{step.title}{step.optional&&<em>Opcional</em>}</b><small>{step.detail}</small></div><span className={s.arrow}>›</span></button>)}</div>
    {pct===100&&<div className={s.ready}><b>La configuración esencial está completa.</b><span>Podés operar reservas, Planning, housekeeping y finanzas con la propiedad activa.</span></div>}
  </section>
}
