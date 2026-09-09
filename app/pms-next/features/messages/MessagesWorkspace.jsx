"use client"

import{useEffect,useMemo,useState}from"react"
import useInboxData from"./useInboxData"
import GuestPortalComposer from"./GuestPortalComposer"
import LateCheckoutDecision from"./LateCheckoutDecision"
import s from"./messages.module.css"

const initials=name=>String(name||"H").trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()
const time=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"—"
const date=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):"—"
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const normalize=value=>String(value||"").trim().toLowerCase()
const channelLabel=value=>value==="guest_portal"?"Portal del huésped":value||"Canal"

function reservationTone(status){const value=normalize(status);if(value.includes("cancel")||value.includes("no_show")||value.includes("no show"))return"red";if(value.includes("pend")||value.includes("tent"))return"yellow";if(value)return"green";return"neutral"}
function roomTone(status){const value=normalize(status);if(value.includes("fuera")||value.includes("bloq")||value.includes("manten"))return"red";if(value.includes("sucia")||value.includes("limpieza")||value.includes("pend"))return"yellow";if(value.includes("lista")||value.includes("limpia")||value.includes("dispon"))return"green";return"neutral"}
function ContextCard({label,value,detail,tone="neutral"}){return <article className={s.contextCard} data-tone={tone}><small>{label}</small><b>{value||"—"}</b>{detail&&<span>{detail}</span>}</article>}

function OperationalContext({context,loading,onNavigate,allowedViews=[],propertyId,onRefresh}){
  const allowed=useMemo(()=>new Set(allowedViews),[allowedViews])
  if(loading&&!context)return <div className={s.contextPanel}><div className={s.contextLoading}>Conectando conversación con la operación del hotel…</div></div>
  if(!context?.linked)return <div className={s.contextPanel}><div className={s.contextEmpty}><b>Sin vínculo operativo todavía</b><span>Se vincula automáticamente sólo con coincidencias exactas de email o teléfono. No se adivina por nombre.</span></div></div>
  const reservation=context.reservation,guest=context.guest,rooms=context.rooms||[],payments=context.payments||{},housekeeping=context.housekeeping||[],maintenance=context.maintenance||[],guestRequests=context.guest_requests||[]
  const lateRequest=guestRequests.find(item=>item.kind==="late_checkout"&&!['resolved','cancelled'].includes(item.status))||null
  const roomNames=rooms.map(room=>room.name).filter(Boolean).join(", ")||"Sin habitación"
  const firstRoom=rooms[0]
  return <div className={s.contextPanel}>
    <div className={s.contextTop}><div><small>CONTEXTO OPERATIVO</small><b>{reservation?`Reserva ${reservation.number||reservation.id}`:"Huésped reconocido"}</b></div><span className={s.linkBadge}>● Vinculado</span></div>
    <div className={s.contextGrid}>
      <ContextCard label="Huésped" value={guest?.name||reservation?.guest_name||"Huésped"} detail={[guest?.language,guest?.vip_level].filter(Boolean).join(" · ")}/>
      <ContextCard label="Estadía" value={reservation?`${date(reservation.arrival)} → ${date(reservation.departure)}`:"Sin reserva"} detail={reservation?.status||""} tone={reservationTone(reservation?.status)}/>
      <ContextCard label={rooms.length>1?"Habitaciones":"Habitación"} value={roomNames} detail={rooms.length>1?`${rooms.length} habitaciones`:firstRoom?.status||firstRoom?.type||""} tone={rooms.length===1?roomTone(firstRoom?.status):"neutral"}/>
      <ContextCard label="Saldo" value={money(payments.pending,payments.currency)} detail={`${money(payments.paid,payments.currency)} cobrado de ${money(payments.total,payments.currency)}`} tone={Number(payments.pending||0)>.009?"yellow":"green"}/>
      <ContextCard label="Peticiones" value={guestRequests.length?`${guestRequests.length} pendiente${guestRequests.length===1?"":"s"}`:"Sin pendientes"} detail={guestRequests[0]?.title||"Sin solicitudes abiertas"} tone={guestRequests.length?"yellow":"green"}/>
      <ContextCard label="Housekeeping" value={housekeeping.length?`${housekeeping.length} pendiente${housekeeping.length===1?"":"s"}`:"Sin pendientes"} detail={housekeeping[0]?.task_type||"Habitación al día"} tone={housekeeping.length?"yellow":"green"}/>
      <ContextCard label="Mantenimiento" value={maintenance.length?`${maintenance.length} incidencia${maintenance.length===1?"":"s"}`:"Sin incidencias"} detail={maintenance[0]?.title||"Sin problemas abiertos"} tone={maintenance.length?"red":"green"}/>
    </div>
    {lateRequest?<LateCheckoutDecision propertyId={propertyId} request={lateRequest} onChanged={onRefresh}/>:null}
    {reservation&&allowed.has("reservations")?<div className={s.contextActions}><button type="button" onClick={()=>onNavigate?.("reservations",{reservationId:Number(reservation.id),restoreScroll:false})}>Ver reserva</button></div>:null}
  </div>
}

export default function MessagesWorkspace({propertyId,onNavigate,allowedViews=[]}){
  const data=useInboxData(propertyId)
  const[filter,setFilter]=useState("open"),[channelFilter,setChannelFilter]=useState("all"),[query,setQuery]=useState(""),[selectedId,setSelectedId]=useState(""),[toast,setToast]=useState(""),[saving,setSaving]=useState(false)
  const channels=useMemo(()=>Array.from(new Set(data.conversations.map(c=>c.channel))).filter(Boolean),[data.conversations])
  const visible=useMemo(()=>data.conversations.filter(thread=>{if(filter!=="all"&&thread.status!==filter)return false;if(channelFilter!=="all"&&thread.channel!==channelFilter)return false;const term=query.trim().toLowerCase();return !term||`${thread.contact_name||""} ${thread.contact_email||""} ${thread.contact_phone||""} ${thread.last_message_text||""} ${thread.channel||""}`.toLowerCase().includes(term)}),[data.conversations,filter,channelFilter,query])
  const selected=data.conversations.find(thread=>thread.id===selectedId)||visible[0]||null
  const messages=selected?data.messagesByConversation.get(selected.id)||[]:[]
  const context=selected?data.contexts[selected.id]:null
  const resolving=selected?Boolean(data.contextLoading[selected.id]):false

  useEffect(()=>{if(selected?.id)data.loadContext(selected.id)},[selected?.id,data.loadContext])
  useEffect(()=>{if(!selected?.id)return;const timer=window.setInterval(()=>data.loadContext(selected.id),5000);return()=>window.clearInterval(timer)},[selected?.id,data.loadContext])
  useEffect(()=>{if(selected?.id&&selected.unread_count>0)data.markRead(selected.id).catch(()=>{})},[selected?.id,selected?.unread_count])
  useEffect(()=>{if(data.loading||typeof window==="undefined")return;const url=new URL(window.location.href),requested=url.searchParams.get("conversation");if(!requested)return;url.searchParams.delete("conversation");window.history.replaceState(window.history.state||{},"",url);const thread=data.conversations.find(item=>item.id===requested);if(!thread)return;setFilter("all");setChannelFilter("all");setSelectedId(thread.id);if(thread.unread_count>0)data.markRead(thread.id).catch(err=>data.setError(err?.message||"No se pudo marcar como leído."))},[data.loading,data.conversations])

  function notify(text){setToast(text);window.setTimeout(()=>setToast(""),2200)}
  function changeMailbox(id){setFilter(id);setSelectedId("")}
  function changeChannel(channel){setChannelFilter(channel);setSelectedId("")}
  async function selectThread(thread){setSelectedId(thread.id);if(thread.unread_count>0){try{await data.markRead(thread.id)}catch(err){data.setError(err?.message||"No se pudo marcar como leído.")}}}
  async function changeStatus(status,label){if(!selected)return;setSaving(true);data.setError("");try{await data.setConversationStatus(selected.id,status);setSelectedId("");notify(label)}catch(err){data.setError(err?.message||"No se pudo actualizar la conversación.")}finally{setSaving(false)}}
  async function refreshSelected(){if(!selected?.id)return;await Promise.all([data.load({silent:true}),data.loadContext(selected.id)])}

  return <section className={s.page}>
    <aside className={s.mailbox}>
      <small className={s.sectionTitle}>BANDEJAS</small>
      {[["open","◎","Abiertas"],["archived","▱","Archivo"],["trash","⌫","Papelera"],["all","▦","Todas"]].map(([id,icon,label])=><button type="button" key={id} className={`${s.mailButton} ${filter===id?s.mailActive:""}`} onClick={()=>changeMailbox(id)}><span>{icon}</span>{label}</button>)}
      <small className={`${s.sectionTitle} ${s.filterTitle}`}>CANALES</small>
      <button type="button" className={`${s.mailButton} ${channelFilter==="all"?s.mailActive:""}`} onClick={()=>changeChannel("all")}><span>◉</span>Todos</button>
      {channels.map(channel=><button type="button" key={channel} className={`${s.mailButton} ${channelFilter===channel?s.mailActive:""}`} onClick={()=>changeChannel(channel)}><span>◌</span>{channelLabel(channel)}</button>)}
    </aside>
    <section className={s.threads}>
      <header className={s.threadHead}><h2>Mensajes</h2><button type="button" className={s.iconButton} aria-label="Actualizar mensajes" onClick={()=>data.load()}>↻</button></header>
      <label className={s.threadSearch}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar conversación"/></label>
      <div className={s.threadList}>{visible.map(thread=><button type="button" key={thread.id} className={`${s.thread} ${selectedId===thread.id?s.threadActive:""}`} onClick={()=>selectThread(thread)}><span className={s.avatar}>{initials(thread.contact_name||thread.channel)}</span><span><b>{thread.contact_name||thread.contact_phone||thread.contact_email||"Contacto"}</b><small>{thread.last_message_text||"Sin mensajes"}</small></span><time>{time(thread.last_message_at)}</time>{thread.unread_count>0&&<em>{thread.unread_count}</em>}</button>)}</div>
      {data.loading&&<div className={s.emptyConversation}>Cargando mensajes…</div>}{!data.loading&&!visible.length&&<div className={s.emptyConversation}>No hay conversaciones en esta bandeja.</div>}
    </section>
    <section className={`${s.conversation} ${selectedId&&selected?s.conversationOpen:""}`}>
      <div className={s.setupBanner}><div><b>{selected?`${channelLabel(selected.channel)} conectado a la operación`:"Inbox unificado"}</b><small>{selected?.channel==="guest_portal"?"Conversación directa con el huésped, vinculada a su reserva y habitación.":"Los mensajes y el contexto provienen de datos reales de esta propiedad."}</small></div><span className={s.integrationBadge}>{selected?.channel==="guest_portal"?"Bidireccional":"Lectura segura"}</span></div>
      {data.error&&<div className={`${s.setupBanner} ${s.errorBanner}`}><small>{data.error}</small></div>}
      {selected?<>
        <header className={s.conversationHead}><div className={s.conversationIdentity}><button type="button" className={`${s.iconButton} ${s.mobileBack}`} aria-label="Volver a conversaciones" onClick={()=>setSelectedId("")}>←</button><span className={s.avatar}>{initials(selected.contact_name||selected.channel)}</span><span><b>{selected.contact_name||selected.contact_phone||selected.contact_email||"Contacto"}</b><small>{channelLabel(selected.channel)} · {selected.contact_phone||selected.contact_email||"Reserva vinculada"}</small></span></div><div className={s.conversationActions}><button type="button" className={s.iconButton} aria-label="Archivar conversación" disabled={saving} onClick={()=>changeStatus("archived","Conversación archivada")}>▱</button><button type="button" className={s.iconButton} aria-label="Mover conversación a papelera" disabled={saving} onClick={()=>changeStatus("trash","Conversación movida a papelera")}>⌫</button></div></header>
        <OperationalContext context={context} loading={resolving} onNavigate={onNavigate} allowedViews={allowedViews} propertyId={propertyId} onRefresh={refreshSelected}/>
        <div className={s.messages}>{messages.map(message=><div key={message.id} className={`${s.bubble} ${message.direction==="outbound"?s.mine:""}`}>{message.text||"Mensaje sin texto"}<time>{time(message.occurred_at)}</time></div>)}{!messages.length&&<div className={s.emptyConversation}>Esta conversación todavía no tiene mensajes almacenados.</div>}</div>
        {selected.channel==="guest_portal"?<GuestPortalComposer propertyId={propertyId} conversationId={selected.id} onSent={refreshSelected}/>:<div className={s.composerPending}><span>↗</span><div><b>Respuesta desde Habitación Llena</b><small>Se habilitará cuando el canal tenga un adaptador de salida seguro. No mostramos un botón que todavía no pueda enviar.</small></div></div>}
      </>:<div className={s.emptyConversation}><div><b>Elegí una conversación</b>Al abrirla vas a ver también su contexto operativo.</div></div>}
    </section>
    {toast&&<div className={s.toast}>{toast}</div>}
  </section>
}
