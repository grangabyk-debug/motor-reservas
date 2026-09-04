"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./audit.module.css"

const fmtDate=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".","")
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)

export default function AuditWorkspace({propertyId,property}){
  const[events,setEvents]=useState([]),[profiles,setProfiles]=useState({}),[filter,setFilter]=useState("all"),[query,setQuery]=useState(""),[loading,setLoading]=useState(false),[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[planning,reservation,cash,automation]=await Promise.all([
        supabase.from("hotel_planning_operation_log").select("id,action,reservation_id,meta,created_by,created_at,undone_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
        supabase.from("hotel_reservation_events").select("id,reservation_id,event_type,title,detail,actor_user_id,actor_name,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
        supabase.from("hotel_cash_movements").select("id,reservation_id,movement_type,method,amount,currency,concept,reference,created_by,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
        supabase.from("hotel_automation_events").select("id,event_type,message,reservation_id,status,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
      ])
      for(const result of[planning,reservation,cash,automation])if(result.error)throw result.error
      const rows=[
        ...(planning.data||[]).map(x=>({id:`p-${x.id}`,kind:"planning",at:x.created_at,actorId:x.created_by,title:planningLabel(x.action),detail:`Reserva #${x.meta?.code||x.reservation_id}${x.undone_at?" · operación deshecha":""}`,reservationId:x.reservation_id})),
        ...(reservation.data||[]).map(x=>({id:`r-${x.id}`,kind:"reservation",at:x.created_at,actorId:x.actor_user_id,actorName:x.actor_name,title:x.title||reservationLabel(x.event_type),detail:x.detail||`Reserva #${x.reservation_id}`,reservationId:x.reservation_id})),
        ...(cash.data||[]).map(x=>({id:`c-${x.id}`,kind:"cash",at:x.created_at,actorId:x.created_by,title:cashLabel(x.movement_type),detail:`${x.concept} · ${money(x.amount,x.currency||"ARS")}${x.method?` · ${x.method}`:""}`,reservationId:x.reservation_id})),
        ...(automation.data||[]).map(x=>({id:`a-${x.id}`,kind:"automation",at:x.created_at,title:automationLabel(x.event_type),detail:`${x.message}${x.status?` · ${x.status}`:""}`,reservationId:x.reservation_id})),
      ].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,250)
      const actorIds=[...new Set(rows.map(x=>x.actorId).filter(Boolean))]
      if(actorIds.length){const{data,error:profileError}=await supabase.from("profiles").select("id,full_name").in("id",actorIds);if(profileError)throw profileError;setProfiles(Object.fromEntries((data||[]).map(p=>[p.id,p.full_name||"Usuario"])))}else setProfiles({})
      setEvents(rows)
    }catch(err){setError(err?.message||"No se pudo cargar la actividad.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])
  const visible=useMemo(()=>events.filter(event=>{if(filter!=="all"&&event.kind!==filter)return false;const term=query.trim().toLowerCase();if(!term)return true;return`${event.title} ${event.detail} ${event.actorName||profiles[event.actorId]||""}`.toLowerCase().includes(term)}),[events,filter,query,profiles])

  return <section className={s.page}>
    <header className={s.header}><div><small>TRAZABILIDAD</small><h1>Actividad</h1><p>{property?.name||"Propiedad activa"} · movimientos y eventos operativos registrados por el sistema.</p></div><button className={s.refresh} onClick={load} disabled={loading}>{loading?"Actualizando…":"Actualizar"}</button></header>
    <div className={s.toolbar}><label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar reserva, acción o usuario"/></label><div className={s.filters}>{[["all","Todo"],["planning","Planning"],["reservation","Reservas"],["cash","Caja"],["automation","Automatizaciones"]].map(([id,label])=><button key={id} className={filter===id?s.active:""} onClick={()=>setFilter(id)}>{label}</button>)}</div></div>
    {error&&<div className={s.notice}>{error}</div>}
    <div className={s.timeline}>{visible.length?visible.map(event=><article key={event.id} className={s.event} data-kind={event.kind}><div className={s.dot}/><div className={s.eventBody}><div className={s.eventTop}><span className={s.badge}>{kindLabel(event.kind)}</span><time>{fmtDate(event.at)}</time></div><h3>{event.title}</h3><p>{event.detail}</p><footer><span>{event.actorName||profiles[event.actorId]||actorFallback(event.kind)}</span>{event.reservationId&&<span>Reserva #{event.reservationId}</span>}</footer></div></article>):<div className={s.empty}>{loading?"Cargando actividad…":"No hay eventos que coincidan con esta vista."}</div>}</div>
    <div className={s.footnote}>Esta vista es de sólo lectura. No muestra payloads internos, credenciales ni datos sensibles de integraciones.</div>
  </section>
}

function planningLabel(value){return({move:"Reserva movida",resize:"Estadía redimensionada",swap:"Reservas intercambiadas",change_room:"Habitación cambiada",split:"Reserva dividida",undo:"Operación deshecha"})[value]||`Planning · ${value||"operación"}`}
function reservationLabel(value){return({created:"Reserva creada",updated:"Reserva actualizada",checkin:"Check-in",checkout:"Check-out",cancelled:"Reserva cancelada",payment:"Pago registrado"})[String(value||"").toLowerCase()]||`Reserva · ${value||"evento"}`}
function cashLabel(value){return({income:"Ingreso de caja",expense:"Egreso de caja",deposit:"Depósito",withdrawal:"Retiro",adjustment:"Ajuste de caja"})[String(value||"").toLowerCase()]||`Caja · ${value||"movimiento"}`}
function automationLabel(value){return`Automatización · ${String(value||"evento").replaceAll("_"," ")}`}
function kindLabel(value){return({planning:"Planning",reservation:"Reserva",cash:"Caja",automation:"Automatización"})[value]||"Sistema"}
function actorFallback(kind){return kind==="automation"?"Sistema":"Usuario autenticado"}
