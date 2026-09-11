"use client"

import{useCallback,useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./pms-notification-center.module.css"

const FILTERS=[["all","Todas"],["ota","OTAs"],["operation","Operación"],["payments","Cobros"],["system","Sistema"]]
const PRIORITY_LABEL={critical:"Urgente",high:"Importante",normal:"Pendiente",info:"Info"}
const PRIORITY_RANK={critical:0,high:1,normal:2,info:3}
const CLOSED_STATES=new Set(["cancelada","cancelled","canceled","finalizada","no_show"])
const PAID_STATES=new Set(["confirmado","confirmed","pagado","paid"])
const VOID_PAYMENT_STATES=new Set(["anulado","cancelado","reembolsado","refunded","void"])
const CRITICAL_REMINDER_MS=60000
let otaAudioContext=null

function isoToday(timeZone){
  try{return new Intl.DateTimeFormat("en-CA",{timeZone:timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}catch{return new Date().toISOString().slice(0,10)}
}
function shortDate(value){const p=String(value||"").split("-");return p.length===3?`${p[2]}/${p[1]}`:String(value||"")}
function money(value,currency="ARS"){try{return new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)}catch{return`${currency||"ARS"} ${Number(value)||0}`}}
function roomIds(reservation){return[...new Set([reservation?.habitacion_id,...(Array.isArray(reservation?.habitaciones_ids)?reservation.habitaciones_ids:[])].filter(Boolean).map(String))]}
function roomName(rooms,id){return rooms.find(room=>String(room.id)===String(id))?.nombre||"Sin habitación"}
function roomReady(room){return["inspeccionada","inspeccion","disponible","libre","ready"].includes(String(room?.estado||"").toLowerCase())}
function getAudioContext(){if(typeof window==="undefined")return null;const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return null;if(!otaAudioContext||otaAudioContext.state==="closed")otaAudioContext=new Ctx();return otaAudioContext}
async function unlockSound(){try{const ctx=getAudioContext();if(!ctx)return false;if(ctx.state==="suspended")await ctx.resume();if(ctx.state!=="running")return false;const buffer=ctx.createBuffer(1,1,22050),source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);source.start(0);return true}catch{return false}}
async function playSound(){try{const ctx=getAudioContext();if(!ctx)return false;if(ctx.state==="suspended")await ctx.resume();if(ctx.state!=="running")return false;const now=ctx.currentTime,gain=ctx.createGain(),osc=ctx.createOscillator(),osc2=ctx.createOscillator();osc.type="sine";osc2.type="sine";osc.frequency.setValueAtTime(740,now);osc.frequency.exponentialRampToValueAtTime(980,now+.16);osc2.frequency.setValueAtTime(1046,now+.18);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.16,now+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+.48);osc.connect(gain);osc2.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.25);osc2.start(now+.18);osc2.stop(now+.46);return true}catch{return false}}
function otaDetail(notification){const meta=notification?.metadata&&typeof notification.metadata==="object"?notification.metadata:{},stay=meta.arrival_date&&meta.departure_date?`${shortDate(meta.arrival_date)} → ${shortDate(meta.departure_date)}`:"",room=[meta.room_type,meta.room_name?`Hab. ${meta.room_name}`:""].filter(Boolean).join(" · "),reservation=meta.reservation_number?`Reserva ${meta.reservation_number}`:"";return[notification.provider_name||meta.provider||"OTA",meta.guest_name,stay,room,reservation].filter(Boolean).join(" · ")||notification.detail||"Actualización recibida"}
function otaPriority(notification){const meta=notification?.metadata&&typeof notification.metadata==="object"?notification.metadata:{};if(meta.severity==="critical"||meta.requires_action)return"critical";const type=String(notification?.event_type||"").toLowerCase();if(type==="booking_new"||type==="booking_cancelled")return"high";return"normal"}
function localReadKey(propertyId,userId){return`hl:pms-notification-reads:${propertyId||"none"}:${userId||"anonymous"}`}
function getLocalReadIds(propertyId,userId){try{return new Set(JSON.parse(window.localStorage.getItem(localReadKey(propertyId,userId))||"[]").map(String))}catch{return new Set()}}
function saveLocalReadIds(propertyId,userId,ids){try{window.localStorage.setItem(localReadKey(propertyId,userId),JSON.stringify([...ids].slice(-500)))}catch{}}
function sortItems(items){return items.sort((a,b)=>Number(Boolean(a.read))-Number(Boolean(b.read))||String(b.createdAt||"").localeCompare(String(a.createdAt||""))||(PRIORITY_RANK[a.priority]??9)-(PRIORITY_RANK[b.priority]??9))}

function buildItems({ota=[],reads=[],localReads=new Set(),reservations=[],payments=[],rooms=[],maintenance=[],operationalEvents=[],timeZone}){
  const today=isoToday(timeZone),readIds=new Set((reads||[]).map(row=>String(row.notification_id))),items=[]
  ;(ota||[]).forEach(row=>items.push({id:`ota-${row.id}`,kind:"ota",priority:otaPriority(row),icon:"OTA",title:row.title||"Actualización OTA",detail:otaDetail(row),reservationId:row.reservation_id||null,notificationId:row.id,createdAt:row.created_at,read:readIds.has(String(row.id))}))
  const paidByReservation=new Map()
  ;(payments||[]).forEach(payment=>{const state=String(payment.estado||"").toLowerCase();if(VOID_PAYMENT_STATES.has(state))return;if(state&& !PAID_STATES.has(state)&&state!=="confirmado")return;const key=String(payment.reserva_id||"");paidByReservation.set(key,(paidByReservation.get(key)||0)+Number(payment.monto||0))})
  ;(reservations||[]).forEach(reservation=>{
    const state=String(reservation.estado||"").toLowerCase();if(CLOSED_STATES.has(state)||reservation.no_show)return
    const ids=roomIds(reservation),primary=rooms.find(room=>String(room.id)===String(ids[0])),guest=reservation.nombre_huesped||reservation.numero_reserva||"Huésped"
    if(String(reservation.fecha_entrada||"")===today&&state!=="alojado"){
      if(!primary||!roomReady(primary)){const id=`room-ready-${reservation.id}-${today}`;items.push({id,kind:"operation",priority:"critical",icon:"!",title:"Habitación no lista para llegada",detail:`${guest} · ${roomName(rooms,ids[0])} · check-in hoy`,reservationId:reservation.id,target:"housekeeping",createdAt:reservation.created_at||`${today}T00:00:00`,read:localReads.has(id)})}
      {const id=`checkin-${reservation.id}-${today}`;items.push({id,kind:"operation",priority:"high",icon:"IN",title:"Check-in pendiente",detail:`${guest} · ${roomName(rooms,ids[0])}`,reservationId:reservation.id,target:"reservation",createdAt:reservation.created_at||`${today}T00:00:00`,read:localReads.has(id)})}
    }
    if(String(reservation.fecha_salida||"")===today&&state==="alojado"){const id=`checkout-${reservation.id}-${today}`;items.push({id,kind:"operation",priority:"high",icon:"OUT",title:"Salida pendiente",detail:`${guest} · ${roomName(rooms,ids[0])}`,reservationId:reservation.id,target:"reservation",createdAt:reservation.created_at||`${today}T00:00:00`,read:localReads.has(id)})}
    const due=Math.max(0,Number(reservation.precio_total||0)-(paidByReservation.get(String(reservation.id))||0))
    if(due>.01&&(state==="alojado"||String(reservation.fecha_entrada||"")===today||String(reservation.fecha_salida||"")===today)){const id=`balance-${reservation.id}-${today}`;items.push({id,kind:"payments",priority:state==="alojado"&&String(reservation.fecha_salida||"")===today?"critical":"normal",icon:"$",title:"Saldo pendiente",detail:`${guest} · ${money(due,reservation.moneda||"ARS")}`,reservationId:reservation.id,target:"reservation",createdAt:reservation.created_at||`${today}T00:00:00`,read:localReads.has(id)})}
  })
  ;(maintenance||[]).filter(ticket=>!["done","resolved","cancelled","canceled","completed"].includes(String(ticket.status||"").toLowerCase())&&["urgent","critical","high"].includes(String(ticket.priority||"").toLowerCase())).slice(0,30).forEach(ticket=>{const id=`maintenance-${ticket.id}`;items.push({id,kind:"operation",priority:["urgent","critical"].includes(String(ticket.priority||"").toLowerCase())?"critical":"high",icon:"!",title:ticket.title||"Mantenimiento prioritario",detail:`${roomName(rooms,ticket.room_id)}${ticket.description?` · ${ticket.description}`:""}`,reservationId:ticket.reservation_id||null,target:"maintenance",createdAt:ticket.created_at,read:localReads.has(id)})})
  ;(operationalEvents||[]).filter(event=>event.event_type==="olivia_reminder").slice(0,20).forEach(event=>{const meta=event.metadata&&typeof event.metadata==="object"?event.metadata:{},area=String(meta.assigned_area||""),id=`system-${event.id}`;items.push({id,kind:"system",priority:"normal",icon:"⚡",title:meta.title||"Recordatorio operativo",detail:meta.detail||`${area?`${area} · `:""}Requiere atención`,target:area==="housekeeping"?"housekeeping":area==="maintenance"?"maintenance":"audit",createdAt:event.created_at,read:localReads.has(id)})})
  return sortItems(items)
}

export default function PmsNotificationCenter({open,onClose,propertyId,onNavigate,onCountChange,timeZone}){
  const[filter,setFilter]=useState("all"),[items,setItems]=useState([]),[userId,setUserId]=useState(""),[soundEnabled,setSoundEnabled]=useState(true),[realtimeStatus,setRealtimeStatus]=useState("connecting"),[soundTest,setSoundTest]=useState("")
  const soundRef=useRef(soundEnabled),navigateRef=useRef(onNavigate),refreshRef=useRef(null)
  useEffect(()=>{soundRef.current=soundEnabled},[soundEnabled])
  useEffect(()=>{navigateRef.current=onNavigate},[onNavigate])

  const refresh=useCallback(async()=>{
    if(!propertyId){setItems([]);onCountChange?.(0);return}
    const{data:auth}=await supabase.auth.getUser(),uid=auth?.user?.id||"";setUserId(uid)
    const queries=[
      supabase.from("hotel_operational_notifications").select("id,reservation_id,event_type,title,detail,provider_name,metadata,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(120),
      uid?supabase.from("hotel_notification_reads").select("notification_id,user_id,read_at").eq("user_id",uid).order("read_at",{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
      supabase.from("reservas").select("id,habitacion_id,habitaciones_ids,nombre_huesped,numero_reserva,fecha_entrada,fecha_salida,estado,no_show,precio_total,moneda,created_at").eq("property_id",propertyId).order("fecha_entrada",{ascending:true}).limit(800),
      supabase.from("pagos").select("id,reserva_id,monto,estado,moneda").eq("property_id",propertyId).limit(1200),
      supabase.from("habitaciones").select("id,nombre,tipo,estado,activa").eq("property_id",propertyId).limit(300),
      supabase.from("hotel_maintenance_tickets").select("id,room_id,reservation_id,title,description,priority,status,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(120),
      supabase.from("hotel_operational_events").select("id,event_type,metadata,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(80),
    ]
    const results=await Promise.all(queries),localReads=getLocalReadIds(propertyId,uid),next=buildItems({ota:results[0].data||[],reads:results[1].data||[],localReads,reservations:results[2].data||[],payments:results[3].data||[],rooms:results[4].data||[],maintenance:results[5].data||[],operationalEvents:results[6].data||[],timeZone})
    setItems(next);onCountChange?.(next.filter(item=>!item.read).length)
    if(uid){const pref=await supabase.from("hotel_user_preferences").select("value").eq("property_id",propertyId).eq("user_id",uid).eq("preference_key","ota_sound_enabled").maybeSingle();if(!pref.error)setSoundEnabled(pref.data?.value?.enabled!==false)}
  },[propertyId,onCountChange,timeZone])
  useEffect(()=>{refreshRef.current=refresh},[refresh])

  useEffect(()=>{refresh().catch(()=>{})},[refresh])
  useEffect(()=>{if(open)refresh().catch(()=>{})},[open,refresh])
  useEffect(()=>{const unlock=()=>{unlockSound().catch(()=>{})};window.addEventListener("pointerdown",unlock,{capture:true,once:true});window.addEventListener("keydown",unlock,{capture:true,once:true});return()=>{window.removeEventListener("pointerdown",unlock,true);window.removeEventListener("keydown",unlock,true)}},[])
  useEffect(()=>{const handler=()=>refreshRef.current?.().catch?.(()=>{});window.addEventListener("hl:pms-data-updated",handler);return()=>window.removeEventListener("hl:pms-data-updated",handler)},[])
  useEffect(()=>{
    if(!propertyId){setRealtimeStatus("idle");return}
    setRealtimeStatus("connecting")
    const channel=supabase.channel(`pms-next-notifications-${propertyId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"hotel_operational_notifications",filter:`property_id=eq.${propertyId}`},payload=>{
      const row=payload.new||null;if(!row)return
      const incoming={id:`ota-${row.id}`,kind:"ota",priority:otaPriority(row),icon:"OTA",title:row.title||"Actualización OTA",detail:otaDetail(row),reservationId:row.reservation_id||null,notificationId:row.id,createdAt:row.created_at,read:false}
      setItems(current=>{const next=sortItems([incoming,...current.filter(item=>item.id!==incoming.id)]);onCountChange?.(next.filter(item=>!item.read).length);return next})
      refreshRef.current?.().catch?.(()=>{})
      if(soundRef.current)playSound().catch(()=>{})
      const priority=otaPriority(row),detail=otaDetail(row)
      window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{tone:priority==="critical"?"danger":"ota",title:row.title||"Actualización OTA",message:detail,duration:priority==="critical"?16000:12000,actionLabel:row.reservation_id?"Ver reserva":null,onAction:row.reservation_id?()=>navigateRef.current?.("reservations",{reservationId:Number(row.reservation_id),restoreScroll:false}):null}}))
    }).subscribe(status=>{if(status==="SUBSCRIBED")setRealtimeStatus("connected");else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")setRealtimeStatus("error");else if(status==="CLOSED")setRealtimeStatus("closed")})
    return()=>{setRealtimeStatus("closed");supabase.removeChannel(channel)}
  },[propertyId])

  useEffect(()=>{
    if(!soundEnabled||!items.some(item=>!item.read&&item.priority==="critical"))return
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")playSound().catch(()=>{})},CRITICAL_REMINDER_MS)
    return()=>window.clearInterval(timer)
  },[items,soundEnabled])

  async function ensureUser(){if(userId)return userId;const{data:auth}=await supabase.auth.getUser(),uid=auth?.user?.id||"";if(uid)setUserId(uid);return uid}
  function applyReadState(ids){setItems(current=>{const next=current.map(item=>ids.has(item.id)?{...item,read:true}:item);onCountChange?.(next.filter(item=>!item.read).length);return next})}
  async function markItemRead(item){if(item.read)return;const uid=await ensureUser();if(!uid)return;if(item.notificationId){const{error}=await supabase.from("hotel_notification_reads").insert({notification_id:item.notificationId,user_id:uid});if(error&&error.code!=="23505")throw error}else{const localReads=getLocalReadIds(propertyId,uid);localReads.add(item.id);saveLocalReadIds(propertyId,uid,localReads)}applyReadState(new Set([item.id]))}
  async function act(item){try{await markItemRead(item)}catch{};onClose?.();if(item.reservationId)onNavigate?.("reservations",{reservationId:Number(item.reservationId),restoreScroll:false});else if(item.target)onNavigate?.(item.target,{restoreScroll:false})}
  async function toggleSound(){const next=!soundEnabled;setSoundEnabled(next);soundRef.current=next;if(next)await unlockSound();let uid=userId;if(!uid){const{data:auth}=await supabase.auth.getUser();uid=auth?.user?.id||"";if(uid)setUserId(uid)}if(uid&&propertyId)await supabase.from("hotel_user_preferences").upsert({property_id:propertyId,user_id:uid,preference_key:"ota_sound_enabled",value:{enabled:next},updated_at:new Date().toISOString()},{onConflict:"property_id,user_id,preference_key"})}
  async function testSound(){setSoundTest("testing");const unlocked=await unlockSound(),played=unlocked&&await playSound();setSoundTest(played?"ok":"blocked");window.setTimeout(()=>setSoundTest(""),2600)}
  async function markAllRead(){const uid=await ensureUser();if(!uid)return;const unread=items.filter(item=>!item.read),rows=unread.filter(item=>item.notificationId).map(item=>({notification_id:item.notificationId,user_id:uid}));if(rows.length)await supabase.from("hotel_notification_reads").upsert(rows,{onConflict:"notification_id,user_id",ignoreDuplicates:true});const localReads=getLocalReadIds(propertyId,uid);unread.filter(item=>!item.notificationId).forEach(item=>localReads.add(item.id));saveLocalReadIds(propertyId,uid,localReads);applyReadState(new Set(unread.map(item=>item.id)))}

  const visible=useMemo(()=>filter==="all"?items:items.filter(item=>item.kind===filter),[items,filter]),unread=items.filter(item=>!item.read),urgent=unread.filter(item=>item.priority==="critical").length
  if(!open)return null
  const realtimeLabel=realtimeStatus==="connected"?"● Realtime conectado":realtimeStatus==="error"?"● Realtime con error":realtimeStatus==="connecting"?"● Conectando Realtime":"● Realtime desconectado"
  return <div className={s.shade} onMouseDown={event=>event.target===event.currentTarget&&onClose?.()}>
    <aside className={s.panel} role="dialog" aria-modal="true" aria-label="Centro de notificaciones">
      <header className={s.header}><div><small>CENTRO OPERATIVO</small><h2>Notificaciones</h2><p>{unread.length?`${unread.length} sin leer${urgent?` · ${urgent} urgente${urgent===1?"":"s"}`:""}.`:"No hay notificaciones sin leer."}</p></div><button type="button" onClick={onClose} aria-label="Cerrar">×</button></header>
      <nav className={s.filters}>{FILTERS.map(([id,label])=>{const count=id==="all"?unread.length:unread.filter(item=>item.kind===id).length;return <button type="button" key={id} className={filter===id?s.active:""} onClick={()=>setFilter(id)}><span>{label}</span>{count>0&&<b>{count}</b>}</button>})}</nav>
      <div className={s.list}>{visible.length?visible.map(item=><button type="button" key={item.id} className={`${s.item} ${s[item.priority]||""} ${item.read?s.read:s.unread}`} onClick={()=>act(item)} aria-label={`${item.read?"Leída":"Sin leer"}: ${item.title}. ${item.detail}`}><span className={s.icon}>{item.icon}</span><span className={s.copy}><span><b>{item.title}</b>{!item.read&&<i className={s.unreadDot}>NUEVA</i>}<em>{PRIORITY_LABEL[item.priority]||"Pendiente"}</em></span><small>{item.detail}</small></span><span className={s.arrow}>›</span></button>):<div className={s.empty}><span>✓</span><b>Sin notificaciones en esta vista</b><p>Las notificaciones nuevas aparecerán aquí en tiempo real.</p></div>}</div>
      <footer className={s.footer}><span className={realtimeStatus==="connected"?s.connected:s.disconnected}>{realtimeLabel}</span><button type="button" onClick={toggleSound}>{soundEnabled?"🔊 Sonido OTA activado":"🔇 Sonido OTA desactivado"}</button><button type="button" onClick={testSound}>{soundTest==="ok"?"✓ Sonido reproducido":soundTest==="blocked"?"⚠ Audio bloqueado":"▶ Probar sonido"}</button>{unread.length>0&&<button type="button" className={s.markAll} onClick={markAllRead}>✓ Marcar todo como leído</button>}</footer>
    </aside>
  </div>
}

