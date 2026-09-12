"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import{buildOperationalNotifications}from"../../core/operationalNotifications"
import{supabase}from"../../../../lib/supabase"
import s from"./notification-center.module.css"

const FILTERS=[["all","Todas"],["ota","OTAs"],["operation","Operación"],["payments","Cobros"],["system","Sistema"]]
const label={critical:"Urgente",high:"Importante",normal:"Pendiente",info:"Info"}
const shortOtaDate=value=>{const parts=String(value||"").split("-");return parts.length===3?`${parts[2]}/${parts[1]}`:String(value||"")}
const otaAlertDetail=notification=>{const meta=notification?.metadata&&typeof notification.metadata==="object"?notification.metadata:{},stay=meta.arrival_date&&meta.departure_date?`${shortOtaDate(meta.arrival_date)} → ${shortOtaDate(meta.departure_date)}`:"",room=[meta.room_type,meta.room_name?`Hab. ${meta.room_name}`:""].filter(Boolean).join(" · "),reservation=meta.reservation_number?`Reserva ${meta.reservation_number}`:"";return[meta.guest_name,stay,room,reservation].filter(Boolean).join(" · ")||notification?.detail||"Abrir la reserva para ver el detalle."}

function SoundIcon({muted=false}){
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/>{muted?<><path d="m16 9 5 6"/><path d="m21 9-5 6"/></>:<><path d="M15 9.5a4 4 0 0 1 0 5"/><path d="M18 7a8 8 0 0 1 0 10"/></>}</svg>
}
function PlayIcon(){return <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m8 5 11 7-11 7V5Z"/></svg>}
function CheckIcon(){return <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>}

let otaAudioContext=null
function getOtaAudioContext(){
  if(typeof window==="undefined")return null
  const AudioCtx=window.AudioContext||window.webkitAudioContext
  if(!AudioCtx)return null
  if(!otaAudioContext||otaAudioContext.state==="closed")otaAudioContext=new AudioCtx()
  return otaAudioContext
}
async function unlockOtaSound(){
  try{
    const ctx=getOtaAudioContext()
    if(!ctx)return false
    if(ctx.state==="suspended")await ctx.resume()
    if(ctx.state!=="running")return false
    const buffer=ctx.createBuffer(1,1,22050),source=ctx.createBufferSource()
    source.buffer=buffer;source.connect(ctx.destination);source.start(0)
    return true
  }catch{return false}
}
async function playOtaSound(){
  try{
    const ctx=getOtaAudioContext()
    if(!ctx)return false
    if(ctx.state==="suspended")await ctx.resume()
    if(ctx.state!=="running")return false
    const now=ctx.currentTime,gain=ctx.createGain(),osc=ctx.createOscillator()
    osc.type="sine";osc.frequency.setValueAtTime(740,now);osc.frequency.exponentialRampToValueAtTime(980,now+.18)
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.16,now+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+.36)
    osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.38)
    return true
  }catch{return false}
}

export default function NotificationCenter({open,onClose,data,onOpenReservation,onView}){
  const[filter,setFilter]=useState("all"),[otaAlert,setOtaAlert]=useState(null),[otaSoundEnabled,setOtaSoundEnabled]=useState(true),[userId,setUserId]=useState(""),[realtimeStatus,setRealtimeStatus]=useState("connecting"),[soundTestStatus,setSoundTestStatus]=useState(""),[markingAll,setMarkingAll]=useState(false)
  const reloadRef=useRef(data.reload),soundEnabledRef=useRef(otaSoundEnabled)
  const propertyId=String(data.settings?.property_id||data.reservations?.[0]?.property_id||"")
  const items=useMemo(()=>buildOperationalNotifications({rooms:data.rooms,reservations:data.reservations,payments:data.payments,automationEvents:data.automationEvents,maintenanceTickets:data.maintenanceTickets}),[data.rooms,data.reservations,data.payments,data.automationEvents,data.maintenanceTickets]),visible=filter==="all"?items:items.filter(item=>item.kind===filter)
  const unreadNotificationIds=useMemo(()=>[...new Set(items.map(item=>item.notificationId).filter(Boolean).map(String))],[items])

  useEffect(()=>{reloadRef.current=data.reload},[data.reload])
  useEffect(()=>{soundEnabledRef.current=otaSoundEnabled},[otaSoundEnabled])

  useEffect(()=>{
    const unlock=()=>{unlockOtaSound().catch(()=>{})}
    window.addEventListener("pointerdown",unlock,{capture:true,once:true})
    window.addEventListener("keydown",unlock,{capture:true,once:true})
    return()=>{window.removeEventListener("pointerdown",unlock,true);window.removeEventListener("keydown",unlock,true)}
  },[])

  useEffect(()=>{
    let active=true
    ;(async()=>{
      const{data:auth}=await supabase.auth.getUser(),uid=auth?.user?.id||""
      if(!active)return
      setUserId(uid)
      if(!uid||!propertyId)return
      const{data:pref}=await supabase.from("hotel_user_preferences").select("value").eq("property_id",propertyId).eq("user_id",uid).eq("preference_key","ota_sound_enabled").maybeSingle()
      if(active)setOtaSoundEnabled(pref?.value?.enabled!==false)
    })().catch(()=>{})
    return()=>{active=false}
  },[propertyId])

  useEffect(()=>{
    if(!propertyId){setRealtimeStatus("idle");return}
    setRealtimeStatus("connecting")
    const channel=supabase.channel(`hl-ota-notifications-${propertyId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"hotel_operational_notifications",filter:`property_id=eq.${propertyId}`},payload=>{
      const notification=payload.new||null
      if(!notification)return
      setOtaAlert(notification)
      reloadRef.current?.().catch?.(()=>{})
      if(soundEnabledRef.current)playOtaSound().catch(()=>{})
      window.setTimeout(()=>setOtaAlert(current=>current?.id===notification.id?null:current),11000)
    }).subscribe(status=>{
      if(status==="SUBSCRIBED")setRealtimeStatus("connected")
      else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")setRealtimeStatus("error")
      else if(status==="CLOSED")setRealtimeStatus("closed")
    })
    return()=>{setRealtimeStatus("closed");supabase.removeChannel(channel)}
  },[propertyId])

  async function resolveUserId(){
    if(userId)return userId
    const{data:auth}=await supabase.auth.getUser(),uid=auth?.user?.id||""
    if(uid)setUserId(uid)
    return uid
  }

  async function markRead(notificationId){
    if(!notificationId)return
    const uid=await resolveUserId()
    if(!uid)return
    const{error}=await supabase.from("hotel_notification_reads").insert({notification_id:notificationId,user_id:uid})
    if(error&&error.code!=="23505")throw error
    await reloadRef.current?.()
  }

  async function markAllRead(){
    if(markingAll||!unreadNotificationIds.length)return
    const uid=await resolveUserId()
    if(!uid)return
    setMarkingAll(true)
    try{
      const rows=unreadNotificationIds.map(notificationId=>({notification_id:notificationId,user_id:uid}))
      const{error}=await supabase.from("hotel_notification_reads").upsert(rows,{onConflict:"notification_id,user_id",ignoreDuplicates:true})
      if(error)throw error
      await reloadRef.current?.()
    }finally{setMarkingAll(false)}
  }

  async function toggleSound(){
    const next=!otaSoundEnabled
    setOtaSoundEnabled(next)
    if(next)await unlockOtaSound()
    const uid=await resolveUserId()
    if(!uid||!propertyId)return
    await supabase.from("hotel_user_preferences").upsert({property_id:propertyId,user_id:uid,preference_key:"ota_sound_enabled",value:{enabled:next},updated_at:new Date().toISOString()},{onConflict:"property_id,user_id,preference_key"})
  }

  async function testSound(){
    setSoundTestStatus("probando")
    const unlocked=await unlockOtaSound(),played=unlocked&&await playOtaSound()
    setSoundTestStatus(played?"ok":"blocked")
    window.setTimeout(()=>setSoundTestStatus(""),2500)
  }

  async function openOta(notification){
    if(!notification)return
    try{await markRead(notification.id)}catch{}
    setOtaAlert(null)
    const reservation=data.reservations.find(r=>String(r.id)===String(notification.reservation_id))
    if(reservation)onOpenReservation?.(reservation)
    else if(notification.reservation_id&&typeof window!=="undefined")window.location.assign(`/dashboard?reservation=${encodeURIComponent(notification.reservation_id)}`)
  }

  async function act(item){
    if(item.notificationId){try{await markRead(item.notificationId)}catch{}}
    if(item.target==="reservation"&&item.reservationId){const reservation=data.reservations.find(r=>String(r.id)===String(item.reservationId));if(reservation)onOpenReservation?.(reservation)}
    else if(item.target==="housekeeping")onView?.("housekeeping")
    else if(item.target==="maintenance")onView?.("maintenance")
    else if(item.target==="automations")onView?.("automations")
    onClose?.()
  }

  const urgent=items.filter(x=>x.priority==="critical").length
  const alert=otaAlert&&<div className={s.otaToast} role="status" aria-live="polite"><button type="button" className={s.otaToastMain} onClick={()=>openOta(otaAlert)}><span className={s.otaBadge}>OTA</span><span className={s.otaToastCopy}><small>{otaAlert.provider_name||"Canal externo"}</small><b>{otaAlert.title||"Nueva actualización OTA"}</b><span>{otaAlertDetail(otaAlert)}</span><em>Ver reserva →</em></span></button><button type="button" className={s.otaToastClose} onClick={()=>setOtaAlert(null)} aria-label="Cerrar aviso">×</button></div>

  if(!open)return alert
  const realtimeLabel=realtimeStatus==="connected"?"● Realtime conectado":realtimeStatus==="error"?"● Realtime con error":realtimeStatus==="connecting"?"● Conectando Realtime":"● Realtime desconectado"
  return <>{alert}<div className={s.shade} onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}>
    <aside className={s.panel}>
      <header className={s.header}><div><small>CENTRO OPERATIVO</small><h2>Notificaciones</h2><p>{items.length?`${items.length} asunto${items.length===1?"":"s"} requieren atención${urgent?` · ${urgent} urgente${urgent===1?"":"s"}`:""}.`:"El turno está al día."}</p></div><div className={s.headerActions}>{unreadNotificationIds.length>0&&<button type="button" className={s.markAll} onClick={markAllRead} disabled={markingAll} title="Marca como leídos los avisos persistentes. Los pendientes operativos permanecen hasta resolver su causa.">{markingAll?"Marcando…":"Marcar todo leído"}</button>}<button type="button" className={s.close} onClick={onClose} aria-label="Cerrar">×</button></div></header>
      <nav className={s.filters}>{FILTERS.map(([id,text])=>{const count=id==="all"?items.length:items.filter(x=>x.kind===id).length;return <button type="button" key={id} className={filter===id?s.active:""} onClick={()=>setFilter(id)}><span>{text}</span>{count>0&&<b>{count}</b>}</button>})}</nav>
      <div className={s.list}>{visible.length?visible.map(item=><button type="button" key={item.id} className={`${s.item} ${s[item.priority]||""}`} onClick={()=>act(item)}><span className={s.icon}>{item.icon}</span><span className={s.copy}><span><b>{item.title}</b><em>{label[item.priority]||"Pendiente"}</em></span><small>{item.detail}</small></span><span className={s.arrow}>›</span></button>):<div className={s.empty}><span>✓</span><b>Sin pendientes en esta vista</b><p>Las alertas desaparecen cuando resolvés la causa real en el PMS.</p></div>}</div>
      <footer><span>{realtimeLabel}</span><button type="button" className={s.soundToggle} onClick={toggleSound}><SoundIcon muted={!otaSoundEnabled}/><span>OTA {otaSoundEnabled?"con sonido":"en silencio"}</span></button><button type="button" className={s.soundToggle} onClick={testSound}>{soundTestStatus==="ok"?<CheckIcon/>:<PlayIcon/>}<span>{soundTestStatus==="ok"?"Sonido reproducido":soundTestStatus==="blocked"?"Audio bloqueado":"Probar sonido"}</span></button><button type="button" onClick={()=>onView?.("automations")}>Ver automatizaciones</button></footer>
    </aside>
  </div></>
}
