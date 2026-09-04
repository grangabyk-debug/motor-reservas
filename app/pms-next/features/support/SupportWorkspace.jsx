"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./support.module.css"

const STATUS={open:"Abierto",waiting_hotel:"Esperando hotel",waiting_support:"En soporte",resolved:"Resuelto",closed:"Cerrado",received:"Recibida",reviewing:"Evaluando",planned:"Planificada",in_progress:"En desarrollo",shipped:"Publicada",declined:"No planificada"}
const CATEGORY={improvement:"Mejora",idea:"Idea",usability:"Usabilidad",integration:"Integración",report:"Informes",other:"Otro"}
const fmt=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value))

export default function SupportWorkspace({propertyId,property}){
  const[tab,setTab]=useState("support"),[threads,setThreads]=useState([]),[feedback,setFeedback]=useState([]),[messages,setMessages]=useState([]),[selected,setSelected]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[composer,setComposer]=useState(""),[newThread,setNewThread]=useState(false),[newIdea,setNewIdea]=useState(false),[saving,setSaving]=useState(false),[unavailable,setUnavailable]=useState(false)

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("");setUnavailable(false)
    const[threadRes,feedbackRes]=await Promise.all([
      supabase.from("hotel_support_threads").select("id,subject,status,priority,created_by,last_message_at,created_at").eq("property_id",propertyId).order("last_message_at",{ascending:false}),
      supabase.from("hotel_product_feedback").select("id,category,title,body,status,support_note,created_at,updated_at").eq("property_id",propertyId).order("created_at",{ascending:false}),
    ])
    const missing=[threadRes.error,feedbackRes.error].find(err=>err?.code==="42P01"||String(err?.message||"").includes("does not exist"))
    if(missing){setUnavailable(true);setLoading(false);return}
    if(threadRes.error||feedbackRes.error){setError(threadRes.error?.message||feedbackRes.error?.message||"No se pudo abrir Ayuda & feedback.");setLoading(false);return}
    setThreads(threadRes.data||[]);setFeedback(feedbackRes.data||[]);setLoading(false)
  },[propertyId])
  useEffect(()=>{load()},[load])

  const loadMessages=useCallback(async thread=>{
    setSelected(thread);setMessages([]);setError("")
    const{data,error:messageError}=await supabase.from("hotel_support_messages").select("id,sender_kind,body,created_at,read_at").eq("property_id",propertyId).eq("thread_id",thread.id).order("created_at")
    if(messageError){setError(messageError.message);return}
    setMessages(data||[])
  },[propertyId])
  useEffect(()=>{if(selected){const fresh=threads.find(item=>item.id===selected.id);if(fresh)setSelected(fresh)}},[threads,selected?.id])

  async function currentUser(){const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)throw new Error("No pudimos validar tu sesión.");return user}
  async function notifySupport(threadId,messageId){
    const{data:{session}}=await supabase.auth.getSession();if(!session?.access_token)return
    fetch("/api/hotel/support-notify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({propertyId,threadId,messageId})}).catch(()=>{})
  }
  async function createThread(form){
    setSaving(true);setError("");setNotice("")
    try{
      const user=await currentUser()
      const{data:thread,error:threadError}=await supabase.from("hotel_support_threads").insert({property_id:propertyId,subject:form.subject.trim(),priority:form.priority,created_by:user.id,status:"open"}).select("id,subject,status,priority,created_by,last_message_at,created_at").single()
      if(threadError)throw threadError
      const{data:message,error:messageError}=await supabase.from("hotel_support_messages").insert({thread_id:thread.id,property_id:propertyId,sender_user_id:user.id,sender_kind:"hotel",body:form.body.trim()}).select("id").single()
      if(messageError)throw messageError
      setNewThread(false);await load();await loadMessages(thread);notifySupport(thread.id,message.id);setNotice("Consulta enviada a soporte.")
    }catch(err){setError(err?.message||"No se pudo abrir la consulta.")}finally{setSaving(false)}
  }
  async function sendMessage(){
    const body=composer.trim();if(!body||!selected)return
    setSaving(true);setError("")
    try{
      const user=await currentUser()
      const{data:message,error:messageError}=await supabase.from("hotel_support_messages").insert({thread_id:selected.id,property_id:propertyId,sender_user_id:user.id,sender_kind:"hotel",body}).select("id,sender_kind,body,created_at,read_at").single()
      if(messageError)throw messageError
      await supabase.from("hotel_support_threads").update({status:"waiting_support",last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",selected.id).eq("property_id",propertyId)
      setMessages(current=>[...current,message]);setComposer("");notifySupport(selected.id,message.id);await load()
    }catch(err){setError(err?.message||"No se pudo enviar el mensaje.")}finally{setSaving(false)}
  }
  async function createFeedback(form){
    setSaving(true);setError("");setNotice("")
    try{const user=await currentUser();const{error:insertError}=await supabase.from("hotel_product_feedback").insert({property_id:propertyId,created_by:user.id,category:form.category,title:form.title.trim(),body:form.body.trim(),status:"received"});if(insertError)throw insertError;setNewIdea(false);await load();setNotice("Idea recibida. Vas a poder seguir su estado desde acá.")}
    catch(err){setError(err?.message||"No se pudo enviar la idea.")}finally{setSaving(false)}
  }

  const openCount=useMemo(()=>threads.filter(item=>!['resolved','closed'].includes(item.status)).length,[threads])
  return <section className={s.page}>
    <header className={s.header}><div><small>AYUDA & FEEDBACK</small><h1>Hablemos desde el PMS</h1><p>Soporte privado para tu hotel y un espacio separado para proponer mejoras de Habitación Llena.</p></div><div className={s.tabs}><button className={tab==="support"?s.active:""} onClick={()=>setTab("support")}>Soporte</button><button className={tab==="ideas"?s.active:""} onClick={()=>setTab("ideas")}>Ideas y mejoras</button></div></header>
    {error&&<div className={s.error}>{error}</div>}{notice&&<div className={s.notice}>{notice}</div>}
    {unavailable?<div className={s.pending}><span>HL</span><h2>Módulo preparado</h2><p>La interfaz y el modelo seguro ya están listos. Se activa cuando la migración de soporte se aplique en la base de staging; esta rama no modifica la base principal.</p></div>:loading?<div className={s.pending}>Cargando…</div>:tab==="support"?<div className={s.supportLayout}><aside className={s.threadList}><div className={s.listTop}><div><small>CONSULTAS</small><b>{openCount} abiertas</b></div><button onClick={()=>setNewThread(true)}>+ Nueva</button></div>{threads.length?threads.map(thread=><button key={thread.id} className={`${s.thread} ${selected?.id===thread.id?s.threadActive:""}`} onClick={()=>loadMessages(thread)}><div><b>{thread.subject}</b><span>{STATUS[thread.status]||thread.status}</span></div><small>{fmt(thread.last_message_at)}</small></button>):<div className={s.empty}>Todavía no hay conversaciones con soporte.</div>}</aside><main className={s.chat}>{selected?<><header><div><small>SOPORTE · {property?.name||"Hotel"}</small><h2>{selected.subject}</h2></div><span data-status={selected.status}>{STATUS[selected.status]||selected.status}</span></header><div className={s.messages}>{messages.map(message=><article key={message.id} className={message.sender_kind==="hotel"?s.ours:s.theirs}><small>{message.sender_kind==="hotel"?"Tu hotel":"Soporte Habitación Llena"} · {fmt(message.created_at)}</small><p>{message.body}</p></article>)}{!messages.length&&<div className={s.empty}>Sin mensajes todavía.</div>}</div><footer><textarea value={composer} onChange={e=>setComposer(e.target.value)} placeholder="Escribí tu mensaje…" onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()}}}/><button disabled={saving||!composer.trim()} onClick={sendMessage}>Enviar</button></footer></>:<div className={s.chatEmpty}><span>◌</span><h2>Elegí una conversación</h2><p>O abrí una nueva consulta para hablar con soporte sin salir del PMS.</p></div>}</main></div>:<div className={s.ideaPage}><div className={s.ideaIntro}><div><small>MEJORAMOS CON LOS HOTELES</small><h2>Propuestas de producto</h2><p>Contanos qué te haría trabajar mejor. Cada propuesta conserva un estado para que sepas si la estamos evaluando, planificando o ya fue publicada.</p></div><button onClick={()=>setNewIdea(true)}>+ Proponer mejora</button></div><div className={s.ideaGrid}>{feedback.length?feedback.map(item=><article key={item.id}><div className={s.ideaTop}><span>{CATEGORY[item.category]||item.category}</span><b data-status={item.status}>{STATUS[item.status]||item.status}</b></div><h3>{item.title}</h3><p>{item.body}</p>{item.support_note&&<blockquote>{item.support_note}</blockquote>}<small>Enviada {fmt(item.created_at)}</small></article>):<div className={s.emptyCard}>Todavía no enviaste propuestas desde este hotel.</div>}</div></div>}
    {newThread&&<ThreadModal saving={saving} onClose={()=>setNewThread(false)} onSave={createThread}/>} {newIdea&&<IdeaModal saving={saving} onClose={()=>setNewIdea(false)} onSave={createFeedback}/>} 
  </section>
}

function ThreadModal({saving,onClose,onSave}){const[form,setForm]=useState({subject:"",body:"",priority:"normal"});return <div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className={s.modal}><button className={s.close} onClick={onClose} aria-label="Cerrar">×</button><small>SOPORTE</small><h2>Nueva consulta</h2><label>Asunto<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} autoFocus/></label><label>Prioridad<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Mensaje<textarea rows="6" value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label><footer><button onClick={onClose}>Cancelar</button><button disabled={saving||!form.subject.trim()||!form.body.trim()} onClick={()=>onSave(form)}>{saving?"Enviando…":"Enviar a soporte"}</button></footer></div></div>}
function IdeaModal({saving,onClose,onSave}){const[form,setForm]=useState({title:"",body:"",category:"improvement"});return <div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className={s.modal}><button className={s.close} onClick={onClose} aria-label="Cerrar">×</button><small>IDEAS Y MEJORAS</small><h2>Proponer una mejora</h2><label>Categoría<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{Object.entries(CATEGORY).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Título<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} autoFocus/></label><label>¿Qué te gustaría mejorar?<textarea rows="7" value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label><footer><button onClick={onClose}>Cancelar</button><button disabled={saving||form.title.trim().length<3||form.body.trim().length<3} onClick={()=>onSave(form)}>{saving?"Enviando…":"Enviar propuesta"}</button></footer></div></div>}
