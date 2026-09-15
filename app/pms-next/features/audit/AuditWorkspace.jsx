"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import NightAuditPanel from"./NightAuditPanel"
import s from"./audit.module.css"

const fmtDate=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".","")
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)
function readTab(){if(typeof window==="undefined")return"close";return new URL(window.location.href).searchParams.get("audit_tab")==="activity"?"activity":"close"}

export default function AuditWorkspace({propertyId,property,onNavigate}){
  const[tab,setTab]=useState(readTab),[events,setEvents]=useState([]),[profiles,setProfiles]=useState({}),[filter,setFilter]=useState("all"),[query,setQuery]=useState(""),[loading,setLoading]=useState(false),[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[planning,reservation,cash,automation,roomBlocks,operation]=await Promise.all([
        supabase.from("hotel_planning_operation_log").select("id,action,reservation_id,meta,created_by,created_at,undone_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
        supabase.from("hotel_reservation_events").select("id,reservation_id,event_type,title,detail,actor_user_id,actor_name,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
        supabase.from("hotel_cash_movements").select("id,reservation_id,movement_type,method,amount,currency,concept,reference,created_by,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
        supabase.from("hotel_automation_events").select("id,event_type,message,reservation_id,status,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
        supabase.from("hotel_room_block_events").select("id,block_id,block_group,habitacion_id,event_type,actor_id,motivo,detalle,fecha_desde,fecha_hasta,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
        supabase.from("hotel_operation_events").select("id,item_type,item_id,action,actor_id,note,metadata,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
      ])
      for(const result of[planning,reservation,cash,automation,roomBlocks,operation])if(result.error)throw result.error
      const roomIds=[...new Set((roomBlocks.data||[]).map(x=>x.habitacion_id).filter(Boolean))]
      let roomMap={}
      if(roomIds.length){const{data,error:roomError}=await supabase.from("habitaciones").select("id,nombre").eq("property_id",propertyId).in("id",roomIds);if(roomError)throw roomError;roomMap=Object.fromEntries((data||[]).map(room=>[room.id,room.nombre]))}
      const rows=[
        ...(planning.data||[]).map(x=>({id:`p-${x.id}`,kind:"planning",at:x.created_at,actorId:x.created_by,title:planningLabel(x.action),detail:`Reserva #${x.meta?.code||x.reservation_id}${x.undone_at?" · operación deshecha":""}`,reservationId:x.reservation_id})),
        ...(reservation.data||[]).map(x=>({id:`r-${x.id}`,kind:"reservation",at:x.created_at,actorId:x.actor_user_id,actorName:x.actor_name,title:x.title||reservationLabel(x.event_type),detail:x.detail||`Reserva #${x.reservation_id}`,reservationId:x.reservation_id})),
        ...(cash.data||[]).map(x=>({id:`c-${x.id}`,kind:"cash",at:x.created_at,actorId:x.created_by,title:cashLabel(x.movement_type),detail:`${x.concept} · ${money(x.amount,x.currency||"ARS")}${x.method?` · ${x.method}`:""}`,reservationId:x.reservation_id})),
        ...(automation.data||[]).map(x=>({id:`a-${x.id}`,kind:"automation",at:x.created_at,title:automationLabel(x.event_type),detail:`${x.message}${x.status?` · ${x.status}`:""}`,reservationId:x.reservation_id})),
        ...(roomBlocks.data||[]).map(x=>({id:`b-${x.id}`,kind:"block",at:x.created_at,actorId:x.actor_id,title:blockLabel(x.event_type),detail:`Habitación ${roomMap[x.habitacion_id]||x.habitacion_id} · ${x.fecha_desde} → ${x.fecha_hasta} · ${x.motivo||"Sin motivo"}${x.detalle?` · ${x.detalle}`:""}`})),
        ...(operation.data||[]).map(x=>({id:`o-${x.id}`,kind:x.item_type==="night_audit"?"nightaudit":"operation",at:x.created_at,actorId:x.actor_id,title:x.item_type==="night_audit"&&x.action==="closed"?"Día operativo cerrado":operationLabel(x),detail:x.item_type==="night_audit"?`Fecha operativa ${x.metadata?.business_date||"—"}${x.metadata?.cutoff_time?` · corte ${x.metadata.cutoff_time}`:""}`:x.note||String(x.action||"Operación")})),
      ].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,300)
      const actorIds=[...new Set(rows.map(x=>x.actorId).filter(Boolean))]
      if(actorIds.length){const{data,error:profileError}=await supabase.from("profiles").select("id,full_name").in("id",actorIds);if(profileError)throw profileError;setProfiles(Object.fromEntries((data||[]).map(p=>[p.id,p.full_name||"Usuario"])))}else setProfiles({})
      setEvents(rows)
    }catch(err){setError(err?.message||"No se pudo cargar la actividad.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{if(tab==="activity")load()},[tab,load])
  useEffect(()=>{if(typeof window==="undefined")return;const sync=()=>setTab(readTab());window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync)},[])
  const visible=useMemo(()=>events.filter(event=>{if(filter!=="all"&&event.kind!==filter)return false;const term=query.trim().toLowerCase();if(!term)return true;return`${event.title} ${event.detail} ${event.actorName||profiles[event.actorId]||""}`.toLowerCase().includes(term)}),[events,filter,query,profiles])

  function chooseTab(next){setTab(next);if(typeof window==="undefined")return;const url=new URL(window.location.href);if(next==="activity")url.searchParams.set("audit_tab","activity");else url.searchParams.delete("audit_tab");window.history.replaceState(window.history.state,"",url)}

  return <section className={s.page}>
    <header className={s.header}><div><small>{tab==="close"?"RECEPCIÓN · NIGHT AUDIT":"TRAZABILIDAD"}</small><h1>{tab==="close"?"Cierre diario":"Actividad"}</h1><p>{tab==="close"?"Validá pendientes y sellá el día operativo sin cargos ni cambios automáticos.":`${property?.name||"Propiedad activa"} · movimientos y eventos operativos registrados por el sistema.`}</p></div><div className={s.headerActions}><div className={s.viewTabs}><button type="button" className={tab==="close"?s.active:""} onClick={()=>chooseTab("close")}>Cierre diario</button><button type="button" className={tab==="activity"?s.active:""} onClick={()=>chooseTab("activity")}>Actividad</button></div>{tab==="activity"?<button className={s.refresh} onClick={load} disabled={loading}>{loading?"Actualizando…":"Actualizar"}</button>:null}</div></header>
    {tab==="close"?<NightAuditPanel propertyId={propertyId} property={property} onNavigate={onNavigate}/>:<>
      <div className={s.toolbar}><label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar reserva, bloqueo, acción o usuario"/></label><div className={s.filters}>{[["all","Todo"],["nightaudit","Cierres"],["planning","Planning"],["block","Bloqueos"],["reservation","Reservas"],["cash","Caja"],["automation","Automatizaciones"],["operation","Operación"]].map(([id,label])=><button key={id} className={filter===id?s.active:""} onClick={()=>setFilter(id)}>{label}</button>)}</div></div>
      {error&&<div className={s.notice}>{error}</div>}
      <div className={s.timeline}>{visible.length?visible.map(event=><article key={event.id} className={s.event} data-kind={event.kind}><div className={s.dot}/><div className={s.eventBody}><div className={s.eventTop}><span className={s.badge}>{kindLabel(event.kind)}</span><time>{fmtDate(event.at)}</time></div><h3>{event.title}</h3><p>{event.detail}</p><footer><span>{event.actorName||profiles[event.actorId]||actorFallback(event.kind)}</span>{event.reservationId&&<span>Reserva #{event.reservationId}</span>}</footer></div></article>):<div className={s.empty}>{loading?"Cargando actividad…":"No hay eventos que coincidan con esta vista."}</div>}</div>
      <div className={s.footnote}>Esta vista es de sólo lectura. No muestra payloads internos, credenciales ni datos sensibles de integraciones.</div>
    </>}
  </section>
}

function planningLabel(value){return({move:"Reserva movida",resize:"Estadía redimensionada",swap:"Reservas intercambiadas",change_room:"Habitación cambiada",split:"Reserva dividida",undo:"Operación deshecha"})[value]||`Planning · ${value||"operación"}`}
function reservationLabel(value){return({created:"Reserva creada",updated:"Reserva actualizada",checkin:"Check-in",checkout:"Check-out",cancelled:"Reserva cancelada",payment:"Pago registrado",no_show_restored:"No Show reabierto"})[String(value||"").toLowerCase()]||`Reserva · ${value||"evento"}`}
function cashLabel(value){return({income:"Ingreso de caja",expense:"Egreso de caja",deposit:"Depósito",withdrawal:"Retiro",adjustment:"Ajuste de caja"})[String(value||"").toLowerCase()]||`Caja · ${value||"movimiento"}`}
function automationLabel(value){return`Automatización · ${String(value||"evento").replaceAll("_"," ")}`}
function blockLabel(value){return({created:"Bloqueo creado",updated:"Bloqueo modificado",released:"Bloqueo liberado"})[String(value||"").toLowerCase()]||"Bloqueo operativo"}
function operationLabel(row){return `${String(row.item_type||"Operación").replaceAll("_"," ")} · ${String(row.action||"evento").replaceAll("_"," ")}`}
function kindLabel(value){return({planning:"Planning",block:"Bloqueo",reservation:"Reserva",cash:"Caja",automation:"Automatización",nightaudit:"Cierre diario",operation:"Operación"})[value]||"Sistema"}
function actorFallback(kind){return kind==="automation"?"Sistema":"Usuario autenticado"}
