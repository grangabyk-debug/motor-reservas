"use client"

import{useMemo,useState}from"react"
import s from"./messages.module.css"

const INITIAL_THREADS=[
  {id:"t1",kind:"team",name:"Hotel Demo",preview:"hola",time:"11:31",messages:[{id:"m1",mine:true,text:"hola",time:"11:31"}]},
  {id:"t2",kind:"guests",name:"Karim C.",preview:"¿Puedo llegar después de las 22?",time:"10:42",messages:[{id:"m2",mine:false,text:"¿Puedo llegar después de las 22?",time:"10:42"}]},
  {id:"t3",kind:"guests",name:"Lena H.",preview:"Gracias por la información",time:"09:18",messages:[{id:"m3",mine:false,text:"Gracias por la información",time:"09:18"}]},
  {id:"t4",kind:"external",name:"Marie R.",preview:"Factura recibida",time:"Ayer",messages:[{id:"m4",mine:false,text:"Factura recibida. Muchas gracias.",time:"Ayer"}]},
  {id:"t5",kind:"team",name:"Tom M.",preview:"Reviso la 204",time:"Ayer",messages:[{id:"m5",mine:false,text:"Reviso la habitación 204 y te aviso.",time:"Ayer"}]},
]

const initials=name=>String(name).trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()

export default function MessagesWorkspace(){
  const[threads,setThreads]=useState(INITIAL_THREADS)
  const[mailbox,setMailbox]=useState("team")
  const[filter,setFilter]=useState("all")
  const[query,setQuery]=useState("")
  const[selectedId,setSelectedId]=useState("t1")
  const[draft,setDraft]=useState("")
  const[toast,setToast]=useState("")

  const visible=useMemo(()=>threads.filter(thread=>{
    if(filter==="archive"&&!thread.archived)return false
    if(filter==="trash"&&!thread.trashed)return false
    if(filter==="all"&&(thread.archived||thread.trashed))return false
    if(!["archive","trash"].includes(filter)&&thread.kind!==mailbox)return false
    const term=query.trim().toLowerCase()
    return !term||`${thread.name} ${thread.preview}`.toLowerCase().includes(term)
  }),[threads,mailbox,filter,query])
  const selected=threads.find(thread=>thread.id===selectedId)||visible[0]||null

  function notify(text){setToast(text);window.setTimeout(()=>setToast(""),2200)}
  function send(){
    const text=draft.trim();if(!text||!selected)return
    const time=new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit"}).format(new Date())
    setThreads(list=>list.map(thread=>thread.id===selected.id?{...thread,preview:text,time,messages:[...thread.messages,{id:`m${Date.now()}`,mine:true,text,time}]}:thread))
    setDraft("")
  }
  function patchSelected(patch,label){
    if(!selected)return
    setThreads(list=>list.map(thread=>thread.id===selected.id?{...thread,...patch}:thread));setSelectedId("");notify(label)
  }

  return <section className={s.page}>
    <aside className={s.mailbox}>
      <small className={s.sectionTitle}>BUZONES</small>
      {[["guests","◎","Huéspedes"],["external","▣","Externos"],["team","▦","Equipo"]].map(([id,icon,label])=><button type="button" key={id} className={`${s.mailButton} ${mailbox===id&&filter==="all"?s.mailActive:""}`} onClick={()=>{setMailbox(id);setFilter("all");setSelectedId("")}}><span>{icon}</span>{label}</button>)}
      <small className={`${s.sectionTitle} ${s.filterTitle}`}>FILTROS</small>
      {[["promotions","☆","Promociones"],["personal","✉","Personal"],["reminders","♧","Recordatorios"],["archive","▱","Archivo"],["trash","⌫","Papelera"]].map(([id,icon,label])=><button type="button" key={id} className={`${s.mailButton} ${filter===id?s.mailActive:""}`} onClick={()=>{setFilter(id);setSelectedId("")}}><span>{icon}</span>{label}</button>)}
    </aside>

    <section className={s.threads}>
      <header className={s.threadHead}><h2>Mensajes</h2><div><button className={s.iconButton} onClick={()=>notify("Bandeja actualizada")}>↻</button><button className={s.iconButton} onClick={()=>notify("Configuración de mensajería")}>⚙</button></div></header>
      <label className={s.threadSearch}>⌕<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar..."/></label>
      <div className={s.threadList}>{visible.map(thread=><button type="button" key={thread.id} className={`${s.thread} ${selected?.id===thread.id?s.threadActive:""}`} onClick={()=>setSelectedId(thread.id)}><span className={s.avatar}>{initials(thread.name)}</span><span><b>{thread.name}</b><small>{thread.preview}</small></span><time>{thread.time}</time></button>)}</div>
    </section>

    <section className={`${s.conversation} ${selected?s.conversationOpen:""}`}>
      <div className={s.setupBanner}><div><b>Configurá el envío y recepción de emails</b><small>Después esta bandeja podrá reunir mensajes reales del huésped.</small></div><button onClick={()=>notify("Configuración pendiente de conectar al servicio de correo")}>Configurar ›</button></div>
      {selected?<>
        <header className={s.conversationHead}><div className={s.conversationIdentity}><span className={s.avatar}>{initials(selected.name)}</span><span><b>{selected.name}</b><small>{selected.kind==="team"?"Equipo":selected.kind==="guests"?"Huésped":"Externo"}</small></span></div><div className={s.conversationActions}><button className={s.iconButton} onClick={()=>notify("Llamadas se conectarán en la capa de integración")}>☎</button><button className={s.iconButton} onClick={()=>notify("Videollamadas se conectarán en la capa de integración")}>◫</button></div></header>
        <div className={s.messages}>{selected.messages.map(message=><div key={message.id} className={`${s.bubble} ${message.mine?s.mine:""}`}>{message.text}<time>{message.time}</time></div>)}</div>
        <div className={s.composer}><button className={s.iconButton} onClick={()=>notify("Adjuntos preparados para la integración")}>＋</button><textarea value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();send()}}} placeholder="Escribí un mensaje..."/><button className={s.iconButton} onClick={()=>patchSelected({archived:true},"Conversación archivada")}>▱</button><button className={s.iconButton} onClick={()=>patchSelected({trashed:true},"Conversación movida a papelera")}>⌫</button><button className={s.send} onClick={send}>Enviar</button></div>
      </>:<div className={s.emptyConversation}><div><b>Elegí una conversación</b>Los mensajes aparecerán acá.</div></div>}
    </section>
    {toast&&<div className={s.toast}>{toast}</div>}
  </section>
}
