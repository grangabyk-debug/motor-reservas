"use client"

import{useEffect,useMemo,useState}from"react"
import{buildOperationalNotifications}from"../../core/operationalNotifications"
import{supabase}from"../../../../lib/supabase"
import s from"./notification-center.module.css"

const FILTERS=[["all","Todas"],["ota","OTAs"],["operation","Operación"],["payments","Cobros"],["messages","Mensajes"],["system","Sistema"]]
const label={critical:"Urgente",high:"Importante",normal:"Pendiente",info:"Info"}
const shortOtaDate=value=>{const parts=String(value||"").split("-");return parts.length===3?`${parts[2]}/${parts[1]}`:String(value||"")}
const otaAlertDetail=notification=>{const meta=notification?.metadata&&typeof notification.metadata==="object"?notification.metadata:{},stay=meta.arrival_date&&meta.departure_date?`${shortOtaDate(meta.arrival_date)} → ${shortOtaDate(meta.departure_date)}`:"",room=[meta.room_type,meta.room_name?`Hab. ${meta.room_name}`:""].filter(Boolean).join(" · "),reservation=meta.reservation_number?`Reserva ${meta.reservation_number}`:"";return[meta.guest_name,stay,room,reservation].filter(Boolean).join(" · ")||notification?.detail||"Abrir la reserva para ver el detalle."}

async function playOtaSound(){
  if(typeof window==="undefined")return
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext
    if(!AudioCtx)return
    const ctx=new AudioCtx()
    if(ctx.state==="suspended")await ctx.resume()
    const gain=ctx.createGain(),osc=ctx.createOscillator()
    osc.type="sine";osc.frequency.setValueAtTime(740,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(980,ctx.currentTime+.18)
    gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.16,ctx.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.36)
    osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.38)
    setTimeout(()=>ctx.close().catch(()=>{}),520)
  }catch{}
}

export default function NotificationCenter({open,onClose,data,onOpenReservation,onView,onOpenMessages}){
  const[filter,setFilter]=useState("all"),[otaAlert,setOtaAlert]=useState(null),[otaSoundEnabled,setOtaSoundEnabled]=useState(true),[userId,setUserId]=useState("")
  const propertyId=String(data.settings?.property_id||data.reservations?.[0]?.property_id||"")
  const items=useMemo(()=>buildOperationalNotifications({rooms:data.rooms,reservations:data.reservations,payments:data.payments,automationEvents:data.automationEvents,inboxConversations:data.inboxConversations,maintenanceTickets:data.maintenanceTickets}),[data.rooms,data.reservations,data.payments,data.automationEvents,data.inboxConversations,data.maintenanceTickets]),visible=filter==="all"?items:items.filter(item=>item.kind===filter)

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
    if(!propertyId)return
    const channel=supabase.channel(`hl-ota-notifications-${propertyId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"hotel_operational_notifications",filter:`property_id=eq.${propertyId}`},payload=>{
      const notification=payload.new||null
      if(!notification)return
      setOtaAlert(notification)
      data.reload?.().catch(()=>{})
      if(otaSoundEnabled)playOtaSound()
      window.setTimeout(()=>setOtaAlert(current=>current?.id===notification.id?null:current),11000)
    }).subscribe()
    return()=>{supabase.removeChannel(channel)}
  },[propertyId,otaSoundEnabled,data.reload])

  async function markRead(notificationId){
    if(!notificationId)return
    let uid=userId
    if(!uid){const{data:auth}=await supabase.auth.getUser();uid=auth?.user?.id||"";if(uid)setUserId(uid)}
    if(!uid)return
    const{error}=await supabase.from("hotel_notification_reads").insert({notification_id:notificationId,user_id:uid})
    if(error&&error.code!=="23505")throw error
    await data.reload?.()
  }

  async function toggleSound(){
    const next=!otaSoundEnabled
    setOtaSoundEnabled(next)
    let uid=userId
    if(!uid){const{data:auth}=await supabase.auth.getUser();uid=auth?.user?.id||"";if(uid)setUserId(uid)}
    if(!uid||!propertyId)return
    await supabase.from("hotel_user_preferences").upsert({property_id:propertyId,user_id:uid,preference_key:"ota_sound_enabled",value:{enabled:next},updated_at:new Date().toISOString()},{onConflict:"property_id,user_id,preference_key"})
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
    else if(item.target==="messages")onOpenMessages?.(item.conversation)
    onClose?.()
  }

  const urgent=items.filter(x=>x.priority==="critical").length
  const alert=otaAlert&&<div className={s.otaToast} role="status" aria-live="polite"><button type="button" className={s.otaToastMain} onClick={()=>openOta(otaAlert)}><span className={s.otaBadge}>OTA</span><span className={s.otaToastCopy}><small>{otaAlert.provider_name||"Canal externo"}</small><b>{otaAlert.title||"Nueva actualización OTA"}</b><span>{otaAlertDetail(otaAlert)}</span><em>Ver reserva →</em></span></button><button type="button" className={s.otaToastClose} onClick={()=>setOtaAlert(null)} aria-label="Cerrar aviso">×</button></div>

  if(!open)return alert
  return <>{alert}<div className={s.shade} onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}>
    <aside className={s.panel}>
      <header className={s.header}><div><small>CENTRO OPERATIVO</small><h2>Notificaciones</h2><p>{items.length?`${items.length} asunto${items.length===1?"":"s"} requieren atención${urgent?` · ${urgent} urgente${urgent===1?"":"s"}`:""}.`:"El turno está al día."}</p></div><button type="button" onClick={onClose} aria-label="Cerrar">×</button></header>
      <nav className={s.filters}>{FILTERS.map(([id,text])=>{const count=id==="all"?items.length:items.filter(x=>x.kind===id).length;return <button type="button" key={id} className={filter===id?s.active:""} onClick={()=>setFilter(id)}><span>{text}</span>{count>0&&<b>{count}</b>}</button>})}</nav>
      <div className={s.list}>{visible.length?visible.map(item=><button type="button" key={item.id} className={`${s.item} ${s[item.priority]||""}`} onClick={()=>act(item)}><span className={s.icon}>{item.icon}</span><span className={s.copy}><span><b>{item.title}</b><em>{label[item.priority]||"Pendiente"}</em></span><small>{item.detail}</small></span><span className={s.arrow}>›</span></button>):<div className={s.empty}><span>✓</span><b>Sin pendientes en esta vista</b><p>Las alertas desaparecen cuando resolvés la causa real en el PMS.</p></div>}</div>
      <footer><span>Actualización en tiempo real</span><button type="button" className={s.soundToggle} onClick={toggleSound}>{otaSoundEnabled?"🔊 Sonido OTA activado":"🔇 Sonido OTA desactivado"}</button><button type="button" onClick={()=>onView?.("automations")}>Ver automatizaciones</button></footer>
    </aside>
  </div></>
}
