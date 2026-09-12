"use client"

import{useCallback,useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"
import PmsIcon from"../../components/shell/PmsIcons"
import HealthCenterPanel from"../operations/HealthCenterPanel"
import u from"./dashboardUnified.module.css"

const CLOSED_REVISION=new Set(["cancelled","canceled","cancelada","anulada"])
const ACTIONABLE_CHANNEL=new Set(["overbooked","partial","unassigned"])
const norm=value=>String(value||"").trim().toLowerCase()
const money=(value,currency="ARS")=>{try{return new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)}catch{return`${currency||"ARS"} ${Math.round(Number(value)||0)}`}}
const guestName=item=>item?.nombre_huesped||item?.numero_reserva||"Huésped"
const roomLabel=item=>item?.roomNames?.length?item.roomNames.join(", "):"Sin habitación"

function toneRank(tone){return tone==="red"?0:tone==="yellow"?1:tone==="blue"?2:3}
function Status({tone,label}){return <span className={u.operationStatus} data-tone={tone}><i/><b>{label}</b></span>}

export default function DashboardOperationsPulse({propertyId,data,onNavigate,allowedViews=[]}){
  const[hub,setHub]=useState(null),[channelStates,setChannelStates]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("")
  const[freshIds,setFreshIds]=useState(()=>new Set()),[resolvedSignal,setResolvedSignal]=useState(null),[updatedNow,setUpdatedNow]=useState(false),[contextInsight,setContextInsight]=useState(null)
  const previousSignalsRef=useRef(null),insightSignatureRef=useRef("")
  const allowed=useMemo(()=>new Set(allowedViews),[allowedViews]),can=id=>!allowed.size||allowed.has(id)
  const load=useCallback(async()=>{if(!propertyId)return;setLoading(true);setError("");try{const[hubRes,stateRes]=await Promise.all([
    supabase.from("hotel_channel_hubs").select("id,status,last_sync_at,last_error,updated_at").eq("property_id",propertyId).eq("provider","channex").maybeSingle(),
    supabase.from("hotel_channel_booking_state").select("id,reservation_id,ota_reservation_code,channel_code,ota_name,assignment_status,overbooked,conflict_state,last_revision_status,updated_at").eq("property_id",propertyId).in("assignment_status",["overbooked","partial","unassigned"]).order("updated_at",{ascending:false}).limit(40),
  ]);if(hubRes.error)throw hubRes.error;if(stateRes.error)throw stateRes.error;setHub(hubRes.data||null);setChannelStates(stateRes.data||[])}catch(err){setError(err?.message||"No pudimos comprobar las integraciones.")}finally{setLoading(false)}},[propertyId])
  useEffect(()=>{load()},[load])
  usePmsAutoRefresh(propertyId,load,["hotel_channel_hubs","hotel_channel_booking_state"])

  const current=data?.operationsByOffset?.[0]||{arrivals:[],departures:[]},m=data?.metrics||{}
  const realOverbookings=useMemo(()=>channelStates.filter(row=>ACTIONABLE_CHANNEL.has(norm(row.assignment_status))&&norm(row.conflict_state)!=="mapping_required"&&!CLOSED_REVISION.has(norm(row.last_revision_status))&&(row.overbooked===true||norm(row.assignment_status)==="overbooked")),[channelStates])
  const mappingIssues=useMemo(()=>channelStates.filter(row=>norm(row.conflict_state)==="mapping_required"&&!CLOSED_REVISION.has(norm(row.last_revision_status))),[channelStates])
  const signals=useMemo(()=>{
    const list=[]
    realOverbookings.forEach(row=>list.push({id:`over-${row.id}`,tone:"red",icon:"calendar",title:"Overbooking OTA",detail:`${row.ota_name||row.channel_code||"OTA"}${row.ota_reservation_code?` · ${row.ota_reservation_code}`:""}`,target:"planning"}))
    current.departures.filter(item=>Number(item.balance)>0).forEach(item=>list.push({id:`balance-${item.id}`,tone:"red",icon:"cash",title:"Salida con saldo",detail:`${guestName(item)} · ${money(item.balance,item.moneda)}`,target:"reservations",reservationId:item.id}))
    current.arrivals.filter(item=>item.roomMaintenance).forEach(item=>list.push({id:`maint-${item.id}`,tone:"red",icon:"wrench",title:"Llegada con mantenimiento",detail:`${guestName(item)} · ${roomLabel(item)}`,target:"reservations",reservationId:item.id}))
    current.arrivals.filter(item=>item.roomDirty&&!item.roomMaintenance).forEach(item=>list.push({id:`dirty-${item.id}`,tone:"yellow",icon:"clean",title:"Habitación pendiente",detail:`${guestName(item)} · ${roomLabel(item)}`,target:"housekeeping"}))
    current.arrivals.filter(item=>!item.roomNames?.length).forEach(item=>list.push({id:`room-${item.id}`,tone:"yellow",icon:"booking",title:"Llegada sin habitación",detail:guestName(item),target:"planning"}))
    if(mappingIssues.length)list.push({id:"mapping",tone:"yellow",icon:"link",title:"Mapeo de canal",detail:`${mappingIssues.length} pendiente${mappingIssues.length===1?"":"s"} de revisar`,target:"channelmanager"})
    if(Number(m.urgent)>0)list.push({id:"urgent",tone:"red",icon:"wrench",title:"Mantenimiento urgente",detail:`${m.urgent} orden${m.urgent===1?"":"es"} prioritaria${m.urgent===1?"":"s"}`,target:"maintenance"})
    return list.sort((a,b)=>toneRank(a.tone)-toneRank(b.tone)).slice(0,3)
  },[realOverbookings,mappingIssues,current,m.urgent])
  const signalSignature=signals.map(item=>`${item.id}:${item.tone}`).join("|")

  const critical=signals.filter(item=>item.tone==="red").length,warning=signals.filter(item=>item.tone==="yellow").length
  const tone=critical?"red":warning?"yellow":"green"
  const headline=critical?`${critical} prioridad${critical===1?"":"es"} crítica${critical===1?"":"s"}`:warning?`${warning} pendiente${warning===1?"":"s"}`:"Todo bajo control"
  const hubState=error?{tone:"red",label:"Sin lectura"}:!hub?{tone:"gray",label:"Sin preparar"}:hub.last_error||norm(hub.status)==="error"?{tone:"red",label:"Revisar sync"}:norm(hub.status)==="active"?{tone:"green",label:"Sync activo"}:norm(hub.status)==="paused"?{tone:"yellow",label:"Sync pausado"}:{tone:"yellow",label:"Preparado"}
  const navigate=item=>{if(!item?.target||!can(item.target))return;if(item.reservationId&&item.target==="reservations")onNavigate?.("reservations",{reservationId:item.reservationId});else onNavigate?.(item.target)}

  useEffect(()=>{
    if(loading)return
    const previous=previousSignalsRef.current
    const timers=[]
    if(previous){
      const currentIds=new Set(signals.map(item=>item.id))
      const previousIds=new Set(previous.map(item=>item.id))
      const added=signals.filter(item=>!previousIds.has(item.id)).map(item=>item.id)
      const removed=previous.find(item=>!currentIds.has(item.id)&&["red","yellow"].includes(item.tone))
      if(added.length){setFreshIds(new Set(added));timers.push(window.setTimeout(()=>setFreshIds(new Set()),1900))}
      if(removed){setResolvedSignal(removed);timers.push(window.setTimeout(()=>setResolvedSignal(null),2100))}
    }
    previousSignalsRef.current=signals.map(item=>({...item}))
    setUpdatedNow(true)
    timers.push(window.setTimeout(()=>setUpdatedNow(false),1900))
    return()=>timers.forEach(timer=>window.clearTimeout(timer))
  },[loading,signalSignature])

  useEffect(()=>{
    if(!signals.length||typeof window==="undefined")return
    if(insightSignatureRef.current===signalSignature)return
    if(!insightSignatureRef.current){insightSignatureRef.current=signalSignature;return}
    insightSignatureRef.current=signalSignature
    const first=signals[0]
    const timer=window.setTimeout(()=>{const message=critical?`Veo ${critical} prioridad${critical===1?"":"es"} crítica${critical===1?"":"s"}. Yo empezaría por ${first.title.toLowerCase()}.`:`Hay ${warning} pendiente${warning===1?"":"s"}. Conviene revisar primero ${first.title.toLowerCase()}.`;setContextInsight({signature:signalSignature,message,item:first})},800)
    return()=>window.clearTimeout(timer)
  },[signalSignature,critical,warning])
  useEffect(()=>{if(!contextInsight)return;const timer=window.setTimeout(()=>setContextInsight(null),5200);return()=>window.clearTimeout(timer)},[contextInsight?.signature])

  return <>
    <article className={u.operationCard} data-tone={tone} data-live-state={loading?"loading":"ready"}>
      <header className={u.operationHead}><div><Status tone={tone} label="OPERACIÓN AHORA"/><strong>{headline}</strong></div>{can("tasks")?<button type="button" onClick={()=>onNavigate?.("tasks")}>Ver detalle</button>:null}</header>
      <div className={u.operationSignals}>{loading?<div className={u.operationLoading}><i/><span>Revisando señales…</span></div>:signals.length?<>{signals.map(item=><button type="button" key={item.id} data-tone={item.tone} data-fresh={freshIds.has(item.id)?"true":undefined} onClick={()=>navigate(item)} disabled={!can(item.target)}><span><PmsIcon name={item.icon} size={15}/></span><div><b>{item.title}</b><small>{item.detail}</small></div><em>›</em></button>)}{resolvedSignal?<div data-operation-resolved="true"><span>✓</span><div><b>Resuelto</b><small>{resolvedSignal.title}</small></div></div>:null}</>:<div className={u.operationClear}><span>✓</span><div><b>Sin excepciones críticas</b><small>No vemos nada urgente en la operación actual.</small></div></div>}</div>
      <footer className={u.operationFoot}><span><i data-tone={hubState.tone}/><b>Channel Manager</b><small>{hubState.label}</small></span><span><i data-tone={data?.loading?"yellow":"green"}/><b>Datos PMS</b><small>{data?.loading?"Actualizando":updatedNow?"Actualizado ahora":"En vivo"}</small></span></footer>
    </article>
    {contextInsight?<aside data-olivia-context-insight="true" role="status"><span data-olivia-context-avatar aria-hidden="true"/><div><b>OlivIA detectó algo</b><small>{contextInsight.message}</small>{can(contextInsight.item.target)?<button type="button" onClick={()=>{navigate(contextInsight.item);setContextInsight(null)}}>Ver ahora</button>:null}</div><button type="button" aria-label="Cerrar sugerencia de OlivIA" onClick={()=>setContextInsight(null)}>×</button></aside>:null}
    <HealthCenterPanel propertyId={propertyId} onNavigate={onNavigate} allowedViews={allowedViews}/>
  </>
}
