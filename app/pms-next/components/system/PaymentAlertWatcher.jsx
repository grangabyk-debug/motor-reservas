"use client"

import{useEffect,useRef}from"react"
import{supabase}from"../../../../lib/supabase"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const emit=detail=>window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))
const LIVE_TABLES=["reservas","pagos","habitaciones","bloqueos","hotel_housekeeping_tasks","hotel_housekeeping_history","hotel_maintenance_tickets","hotel_guest_requests","hotel_guest_profiles","hotel_no_show_history","hotel_cancellation_policies","hotel_guarantees","hotel_reservation_events","hotel_cash_movements","hotel_finance_documents","hotel_cash_sessions","hotel_folios","hotel_folio_items","hotel_folio_payment_allocations","hotel_operational_events","inbox_conversations"]
const OPS_TABLES=new Set(["hotel_housekeeping_tasks","hotel_maintenance_tickets","hotel_guest_requests"])
const OPS_KEY_PREFIX="hl:ops-notifications:"
const DEFAULT_AREA_ACCESS={owner:["reception","housekeeping","maintenance"],manager:["reception","housekeeping","maintenance"],admin:["reception","housekeeping","maintenance"],reception:["reception"],night_audit:["reception"],housekeeping:["housekeeping"],maintenance:["maintenance"],revenue:[],member:[]}

function playAlert(kind="info"){
  if(typeof window==="undefined")return
  try{
    const AudioContext=window.AudioContext||window.webkitAudioContext
    if(!AudioContext)return
    const ctx=new AudioContext(),gain=ctx.createGain(),osc=ctx.createOscillator(),osc2=ctx.createOscillator()
    const base=kind==="urgent"?860:kind==="success"?660:740
    osc.type="sine";osc2.type="sine";osc.frequency.setValueAtTime(base,ctx.currentTime);osc2.frequency.setValueAtTime(base*1.32,ctx.currentTime+.1)
    gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.015);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.34)
    osc.connect(gain);osc2.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.17);osc2.start(ctx.currentTime+.11);osc2.stop(ctx.currentTime+.34);osc2.onended=()=>ctx.close().catch(()=>{})
  }catch{}
}
function browserAlert(title,message,tag){
  if(typeof window==="undefined"||!("Notification"in window)||Notification.permission!=="granted")return
  try{new Notification(title,{body:message,tag,renotify:true})}catch{}
}
function operationalArea(table,row={}){
  if(table==="hotel_housekeeping_tasks")return"housekeeping"
  if(table==="hotel_maintenance_tickets")return"maintenance"
  if(table==="hotel_guest_requests")return row.assigned_area||"reception"
  return null
}
function operationalNotificationsEnabled(area){
  if(area==="reception")return true
  if(typeof window==="undefined"||!area)return false
  try{return window.localStorage.getItem(`${OPS_KEY_PREFIX}${area}`)==="1"}catch{return false}
}
function operationalTitle(table,row={}){
  if(table==="hotel_housekeeping_tasks")return`Housekeeping · Hab. ${row.room_id||"—"}`
  if(table==="hotel_maintenance_tickets")return`Mantenimiento · ${row.title||"Nueva tarea"}`
  if(table==="hotel_guest_requests"&&String(row.title||"").toLowerCase().includes("late check-out"))return"Late check-out solicitado"
  if(table==="hotel_guest_requests")return row.assigned_area==="reception"?"Nueva petición para Recepción":`Petición · ${row.title||"Nueva solicitud"}`
  return"Nueva alerta operativa"
}
function operationalMessage(table,row={}){
  const priority=row.priority?` · ${String(row.priority).toUpperCase()}`:""
  if(table==="hotel_housekeeping_tasks")return`${String(row.task_type||"Tarea").replaceAll("_"," ")}${priority}`
  return`${row.detail||row.description||"Requiere atención"}${priority}`
}

export default function PaymentAlertWatcher({propertyId,onNavigate,onUnreadChange}){
  const knownPayments=useRef(new Set()),paymentsPrimed=useRef(false),syncTimer=useRef(null),pendingTables=useRef(new Set()),allowedAreasRef=useRef(new Set()),inboxKnown=useRef(new Map()),inboxPrimed=useRef(false)

  function openConversation(id){
    if(!id)return
    const url=new URL(window.location.href);url.searchParams.set("conversation",String(id));window.history.replaceState(window.history.state||{},"",url);onNavigate?.("messages",{restoreScroll:false})
  }
  function openRequest(row){
    if(!row?.id)return
    const url=new URL(window.location.href);url.searchParams.set("guest_request",String(row.id));url.searchParams.delete("request_reservation");window.history.replaceState(window.history.state||{},"",url);window.dispatchEvent(new CustomEvent("hl:guest-request-focus",{detail:{id:row.id,reservationId:""}}));onNavigate?.("requests",{restoreScroll:false})
  }
  function openReservation(id){if(id!=null)onNavigate?.("reservations",{reservationId:Number(id),restoreScroll:false})}

  function pushAlert({tone="info",title,message,duration=8500,actionLabel,onAction,tag,kind="info"}){
    playAlert(kind);emit({tone,title,message,duration,actionLabel,onAction});browserAlert(title,message,tag||`hl-${Date.now()}`)
  }

  async function refreshUnread(rows=null){
    let list=rows
    if(!list){const{data,error}=await supabase.from("inbox_conversations").select("id,unread_count,last_message_at,last_message_text,contact_name,channel,reservation_id,status").eq("property_id",propertyId).limit(300);if(error)return;list=data||[]}
    const total=(list||[]).filter(row=>row.status!=="trash"&&row.status!=="archived").reduce((sum,row)=>sum+Math.max(0,Number(row.unread_count)||0),0)
    onUnreadChange?.(total)
  }
  function notifyInbox(row,previous=null){
    if(!row?.id)return
    const before=previous||inboxKnown.current.get(String(row.id))||{}
    const unread=Number(row.unread_count)||0,oldUnread=Number(before.unread_count)||0,last=String(row.last_message_at||""),oldLast=String(before.last_message_at||"")
    inboxKnown.current.set(String(row.id),{unread_count:unread,last_message_at:last})
    if(!inboxPrimed.current||unread<=oldUnread||!last||last===oldLast)return
    const text=String(row.last_message_text||"Nuevo mensaje")
    if(row.channel==="guest_portal"&&text.toLowerCase().startsWith("solicitud de late check-out"))return
    const title=row.channel==="guest_portal"?`Mensaje del huésped · ${row.contact_name||"Reserva"}`:`Nuevo mensaje · ${row.contact_name||row.channel||"Huésped"}`
    pushAlert({tone:"warning",title,message:text,duration:10000,actionLabel:"Abrir chat",onAction:()=>openConversation(row.id),tag:`hl-inbox-${row.id}-${last}`,kind:"urgent"})
  }
  async function pollInbox(){
    const{data,error}=await supabase.from("inbox_conversations").select("id,unread_count,last_message_at,last_message_text,contact_name,channel,reservation_id,status").eq("property_id",propertyId).order("last_message_at",{ascending:false,nullsFirst:false}).limit(100)
    if(error)return
    const rows=data||[]
    if(!inboxPrimed.current){for(const row of rows)inboxKnown.current.set(String(row.id),{unread_count:Number(row.unread_count)||0,last_message_at:String(row.last_message_at||"")});inboxPrimed.current=true}else for(const row of rows)notifyInbox(row)
    refreshUnread(rows)
  }
  function notifyOperational(table,row){
    const area=operationalArea(table,row)
    if(!area||!allowedAreasRef.current.has(area)||!operationalNotificationsEnabled(area))return
    if(table==="hotel_guest_requests"&&area==="reception"&&row.created_by==null&&row.title==="Solicitud del huésped")return
    const title=operationalTitle(table,row),message=operationalMessage(table,row),urgent=row.priority==="urgent"||String(row.title||"").toLowerCase().includes("late check-out")
    pushAlert({tone:urgent?"danger":row.priority==="high"?"warning":"info",title,message,duration:urgent?11000:8500,actionLabel:table==="hotel_guest_requests"?"Abrir petición":null,onAction:table==="hotel_guest_requests"?()=>openRequest(row):null,tag:`hl-${table}-${row.id||Date.now()}`,kind:urgent?"urgent":"info"})
  }
  async function notifyPayment(row){
    if(!row?.id||String(row.estado||"").toLowerCase()!=="confirmado")return
    knownPayments.current.add(String(row.id))
    const{data:reservation}=row.reserva_id!=null?await supabase.from("reservas").select("id,nombre_huesped,numero_reserva,precio_total,moneda").eq("property_id",propertyId).eq("id",row.reserva_id).maybeSingle():{data:null}
    const currency=reservation?.moneda||row.moneda||"ARS",label=reservation?.nombre_huesped||reservation?.numero_reserva||"Reserva"
    pushAlert({tone:"success",title:"Pago recibido",message:`${label} · ${money(row.monto,row.moneda||currency)}${row.metodo?` · ${row.metodo}`:""}`,duration:8500,actionLabel:row.reserva_id?"Ver reserva":null,onAction:row.reserva_id?()=>openReservation(row.reserva_id):null,tag:`hl-payment-${row.id}`,kind:"success"})
  }
  function notifyReservation(row){
    if(!row?.id)return
    const guest=row.nombre_huesped||row.numero_reserva||"Nueva reserva",dates=row.fecha_entrada&&row.fecha_salida?`${row.fecha_entrada} → ${row.fecha_salida}`:"Reserva creada"
    pushAlert({tone:"info",title:"Nueva reserva",message:`${guest} · ${dates}`,duration:9000,actionLabel:"Abrir reserva",onAction:()=>openReservation(row.id),tag:`hl-reservation-${row.id}`,kind:"info"})
  }

  useEffect(()=>{
    allowedAreasRef.current=new Set();if(!propertyId)return
    let cancelled=false
    ;(async()=>{try{
      const{data:userData}=await supabase.auth.getUser(),uid=userData?.user?.id;if(!uid||cancelled)return
      const[memberRes,settingsRes]=await Promise.all([supabase.from("property_members").select("role").eq("property_id",propertyId).eq("user_id",uid).maybeSingle(),supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle()])
      if(cancelled)return
      const role=memberRes.data?.role||"member",custom=settingsRes.data?.settings?.role_permissions?.[role],views=Array.isArray(custom)?custom:null
      allowedAreasRef.current=new Set(views?[views.includes("messages")||views.includes("requests")||views.includes("reservations")?"reception":null,views.includes("housekeeping")?"housekeeping":null,views.includes("maintenance")?"maintenance":null].filter(Boolean):(DEFAULT_AREA_ACCESS[role]||[]))
    }catch{allowedAreasRef.current=new Set()} })()
    return()=>{cancelled=true}
  },[propertyId])

  useEffect(()=>{
    inboxKnown.current=new Map();inboxPrimed.current=false;if(!propertyId)return
    let cancelled=false,timer=null
    const run=async()=>{if(!cancelled)await pollInbox()}
    run();timer=window.setInterval(run,5000)
    const focus=()=>run();window.addEventListener("focus",focus)
    return()=>{cancelled=true;if(timer)window.clearInterval(timer);window.removeEventListener("focus",focus)}
  },[propertyId])

  useEffect(()=>{
    knownPayments.current=new Set();paymentsPrimed.current=false;if(!propertyId)return
    let cancelled=false,timer=null
    async function check(){
      const{data,error}=await supabase.from("pagos").select("id,reserva_id,monto,moneda,metodo,estado,created_at,reservas(nombre_huesped,numero_reserva,precio_total,moneda)").eq("property_id",propertyId).eq("estado","confirmado").order("created_at",{ascending:false}).limit(500)
      if(cancelled||error)return
      const rows=data||[],ids=new Set(rows.map(row=>String(row.id)))
      if(!paymentsPrimed.current){knownPayments.current=ids;paymentsPrimed.current=true;return}
      const fresh=rows.filter(row=>!knownPayments.current.has(String(row.id)));knownPayments.current=ids;if(!fresh.length)return
      const latest=fresh[0],reservation=Array.isArray(latest.reservas)?latest.reservas[0]:latest.reservas,currency=reservation?.moneda||latest.moneda||"ARS"
      playAlert("success");emit({tone:"success",title:fresh.length>1?`${fresh.length} pagos recibidos`:"Pago recibido",message:`${reservation?.nombre_huesped||reservation?.numero_reserva||"Reserva"} · ${money(latest.monto,latest.moneda||currency)}${latest.metodo?` · ${latest.metodo}`:""}.`,duration:7000,actionLabel:latest.reserva_id?"Ver reserva":null,onAction:latest.reserva_id?()=>openReservation(latest.reserva_id):null})
    }
    check();timer=window.setInterval(check,20000);return()=>{cancelled=true;if(timer)window.clearInterval(timer)}
  },[propertyId])

  useEffect(()=>{
    if(!propertyId)return
    const flush=()=>{syncTimer.current=null;const tables=[...pendingTables.current];pendingTables.current.clear();window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables,at:Date.now()}}))}
    const queue=table=>{if(table)pendingTables.current.add(table);if(syncTimer.current)clearTimeout(syncTimer.current);syncTimer.current=setTimeout(flush,80)}
    const changed=(table,payload)=>{
      queue(table);const row=payload?.new||{},detail={propertyId,table,eventType:payload?.eventType||"*",new:row||null,old:payload?.old||null}
      if(table==="reservas"){window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail}));if(payload?.eventType==="INSERT")notifyReservation(row)}
      if(table==="pagos"){window.dispatchEvent(new CustomEvent("hl:pms-payment-updated",{detail}));if(payload?.eventType==="INSERT")notifyPayment(row)}
      if(table==="hotel_cancellation_policies")window.dispatchEvent(new CustomEvent("hl:pms-cancellation-policies-updated",{detail}))
      if(OPS_TABLES.has(table)&&payload?.eventType==="INSERT")notifyOperational(table,row)
      if(table==="inbox_conversations"){notifyInbox(row,payload?.old||null);refreshUnread()}
    }
    let channel=supabase.channel(`hl-pms-sync-${propertyId}`)
    for(const table of LIVE_TABLES)channel=channel.on("postgres_changes",{event:"*",schema:"public",table,filter:`property_id=eq.${propertyId}`},payload=>changed(table,payload))
    channel.subscribe(status=>{if(status==="SUBSCRIBED")queue("reconnected")})
    const resume=()=>queue("resume"),visible=()=>{if(document.visibilityState==="visible")resume()};window.addEventListener("focus",resume);document.addEventListener("visibilitychange",visible)
    return()=>{if(syncTimer.current)clearTimeout(syncTimer.current);pendingTables.current.clear();window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",visible);supabase.removeChannel(channel)}
  },[propertyId,onNavigate,onUnreadChange])
  return null
}
