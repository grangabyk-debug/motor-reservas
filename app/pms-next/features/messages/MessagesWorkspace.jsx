"use client"

import{useMemo,useState}from"react"
import useInboxData from"./useInboxData"
import s from"./messages.module.css"

const initials=name=>String(name||"H").trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()
const time=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"—"

export default function MessagesWorkspace({propertyId}){
  const data=useInboxData(propertyId)
  const[filter,setFilter]=useState("open")
  const[query,setQuery]=useState("")
  const[selectedId,setSelectedId]=useState("")
  const[toast,setToast]=useState("")
  const[saving,setSaving]=useState(false)

  const visible=useMemo(()=>data.conversations.filter(thread=>{
    if(filter!=="all"&&thread.status!==filter)return false
    const term=query.trim().toLowerCase()
    return !term||`${thread.contact_name||""} ${thread.contact_email||""} ${thread.contact_phone||""} ${thread.last_message_text||""} ${thread.channel||""}`.toLowerCase().includes(term)
  }),[data.conversations,filter,query])
  const selected=data.conversations.find(thread=>thread.id===selectedId)||visible[0]||null
  const messages=selected?data.messagesByConversation.get(selected.id)||[]:[]

  function notify(text){setToast(text);window.setTimeout(()=>setToast(""),2200)}
  async function selectThread(thread){setSelectedId(thread.id);if(thread.unread_count>0){try{await data.markRead(thread.id)}catch(err){data.setError(err?.message||"No se pudo marcar como leído.")}}}
  async function changeStatus(status,label){if(!selected)return;setSaving(true);data.setError("");try{await data.setConversationStatus(selected.id,status);setSelectedId("");notify(label)}catch(err){data.setError(err?.message||"No se pudo actualizar la conversación.")}finally{setSaving(false)}}

  return <section className={s.page}>
    <aside className={s.mailbox}><small className={s.sectionTitle}>BANDEJAS</small>{[["open","◎","Abiertas"],["archived","▱","Archivo"],["trash","⌫","Papelera"],["all","▦","Todas"]].map(([id,icon,label])=><button type="button" key={id} className={`${s.mailButton} ${filter===id?s.mailActive:""}`} onClick={()=>{setFilter(id);setSelectedId("")}}><span>{icon}</span>{label}</button>)}<small className={`${s.sectionTitle} ${s.filterTitle}`}>CANALES</small>{Array.from(new Set(data.conversations.map(c=>c.channel))).filter(Boolean).map(channel=><div key={channel} className={s.mailButton}><span>◌</span>{channel}</div>)}</aside>
    <section className={s.threads}><header className={s.threadHead}><h2>Mensajes</h2><div><button className={s.iconButton} onClick={()=>data.load()}>↻</button></div></header><label className={s.threadSearch}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar conversación"/></label><div className={s.threadList}>{visible.map(thread=><button type="button" key={thread.id} className={`${s.thread} ${selected?.id===thread.id?s.threadActive:""}`} onClick={()=>selectThread(thread)}><span className={s.avatar}>{initials(thread.contact_name||thread.channel)}</span><span><b>{thread.contact_name||thread.contact_phone||thread.contact_email||"Contacto"}</b><small>{thread.last_message_text||"Sin mensajes"}</small></span><time>{time(thread.last_message_at)}</time>{thread.unread_count>0&&<em>{thread.unread_count}</em>}</button>)}</div>{data.loading&&<div className={s.emptyConversation}>Cargando mensajes…</div>}</section>
    <section className={`${s.conversation} ${selected?s.conversationOpen:""}`}>
      <div className={s.setupBanner}><div><b>{selected?`${selected.channel||"Canal"} conectado para recepción`:"Inbox unificado"}</b><small>Los mensajes mostrados vienen de las conexiones reales de la propiedad.</small></div><button disabled>Envío pendiente de adaptador seguro</button></div>
      {data.error&&<div className={s.setupBanner}><small>{data.error}</small></div>}
      {selected?<><header className={s.conversationHead}><div className={s.conversationIdentity}><span className={s.avatar}>{initials(selected.contact_name||selected.channel)}</span><span><b>{selected.contact_name||selected.contact_phone||selected.contact_email||"Contacto"}</b><small>{selected.channel} · {selected.contact_phone||selected.contact_email||"Sin contacto visible"}</small></span></div><div className={s.conversationActions}><button className={s.iconButton} disabled={saving} onClick={()=>changeStatus("archived","Conversación archivada")}>▱</button><button className={s.iconButton} disabled={saving} onClick={()=>changeStatus("trash","Conversación movida a papelera")}>⌫</button></div></header><div className={s.messages}>{messages.map(message=><div key={message.id} className={`${s.bubble} ${message.direction==="outbound"?s.mine:""}`}>{message.text||"Mensaje sin texto"}<time>{time(message.occurred_at)}</time></div>)}{!messages.length&&<div className={s.emptyConversation}>Esta conversación todavía no tiene mensajes almacenados.</div>}</div><div className={s.composer}><textarea disabled placeholder="El envío se habilitará cuando exista un outbox seguro para este canal."/><button className={s.send} disabled>Enviar</button></div></>:<div className={s.emptyConversation}><div><b>Elegí una conversación</b>Los mensajes reales aparecerán acá.</div></div>}
    </section>{toast&&<div className={s.toast}>{toast}</div>}
  </section>
}
