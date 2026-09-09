"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import{useParams}from"next/navigation"
import{supabase}from"../../../lib/supabase"
import PremiumPortalClient from"./PremiumPortalClient"
import GuestIcon from"./GuestIcon"
import s from"./guestRuntime.module.css"

const statusLabel={open:"Recibido",in_progress:"En proceso",resolved:"Resuelto",cancelled:"Cancelado"}
const kindLabel={towels:"Toallas",pillows:"Almohadas",cleaning:"Limpieza",maintenance:"Mantenimiento",late_checkout:"Late check-out",other:"Solicitud"}
const requestKey=item=>`${item?.status||""}:${item?.decision||""}:${item?.updated_at||""}:${item?.requested_time||""}`

function notificationText(request){
  if(request?.kind==="late_checkout"&&request?.decision==="approved")return `Late check-out aprobado${request.requested_time?` hasta las ${request.requested_time}`:""}.`
  if(request?.kind==="late_checkout"&&request?.decision==="rejected")return"Recepción revisó tu late check-out y no pudo aprobarlo."
  const label=kindLabel[request?.kind]||request?.title||"Tu pedido"
  return `${label}: ${statusLabel[request?.status]||request?.status||"actualizado"}.`
}

export default function GuestPortalRuntime(){
  const params=useParams(),token=String(params?.token||""),demo=token==="demo"
  const[snapshot,setSnapshot]=useState(null),[revision,setRevision]=useState(0),[chatOpen,setChatOpen]=useState(false),[chatText,setChatText]=useState(""),[sending,setSending]=useState(false),[chatNotice,setChatNotice]=useState(""),[activityNotice,setActivityNotice]=useState(""),[notifyPrompt,setNotifyPrompt]=useState(false),[notifyState,setNotifyState]=useState("default")
  const knownRequests=useRef(new Map()),knownMessages=useRef(new Set()),initialized=useRef(false),messagesEnd=useRef(null)

  async function showDeviceNotification(title,body){
    if(typeof window==="undefined"||!("Notification"in window)||Notification.permission!=="granted")return
    try{
      if("serviceWorker"in navigator){const reg=await navigator.serviceWorker.ready;await reg.showNotification(title,{body,icon:"/favicon.ico",tag:"hl-guest-stay",renotify:true,data:{url:window.location.href}});return}
      new Notification(title,{body})
    }catch{}
  }

  async function refresh({initial=false}={}){
    if(!token||demo)return
    const{data,error}=await supabase.rpc("hl_guest_stay_portal_snapshot",{p_token:token})
    if(error||!data?.ok)return
    const nextRequests=new Map((data.requests||[]).map(item=>[item.id,requestKey(item)])),nextMessages=new Set((data.messages||[]).map(item=>item.id))
    if(initial||!initialized.current){knownRequests.current=nextRequests;knownMessages.current=nextMessages;initialized.current=true;setSnapshot(data);return}
    const changedRequest=(data.requests||[]).find(item=>knownRequests.current.get(item.id)!==requestKey(item))
    const freshOutbound=(data.messages||[]).filter(item=>!knownMessages.current.has(item.id)&&item.direction==="outbound")
    const requestsChanged=Boolean(changedRequest)||nextRequests.size!==knownRequests.current.size
    const messagesChanged=(data.messages||[]).some(item=>!knownMessages.current.has(item.id))||nextMessages.size!==knownMessages.current.size
    knownRequests.current=nextRequests;knownMessages.current=nextMessages;setSnapshot(data)
    if(requestsChanged){setRevision(value=>value+1);if(changedRequest){const text=notificationText(changedRequest);setActivityNotice(text);window.setTimeout(()=>setActivityNotice(""),5200);if(document.hidden)showDeviceNotification(data?.hotel?.name||"Tu hotel",text)}}
    if(messagesChanged&&freshOutbound.length){const text=freshOutbound[freshOutbound.length-1]?.text||"Recepción respondió tu mensaje.";setActivityNotice(text);window.setTimeout(()=>setActivityNotice(""),5200);if(document.hidden)showDeviceNotification(data?.hotel?.name||"Recepción",text)}
  }

  useEffect(()=>{
    if(typeof window==="undefined")return
    if("serviceWorker"in navigator)navigator.serviceWorker.register("/guest-portal-sw.js").catch(()=>{})
    if("Notification"in window)setNotifyState(Notification.permission)
    const key=`hl:guest-notify-prompt:${window.location.pathname}`
    const dismissed=window.localStorage.getItem(key)==="dismissed"
    if(!dismissed&&("Notification"in window)&&Notification.permission==="default")window.setTimeout(()=>setNotifyPrompt(true),900)
  },[])

  useEffect(()=>{
    refresh({initial:true})
    if(demo)return
    const timer=window.setInterval(()=>refresh(),5000)
    const focus=()=>refresh()
    const visibility=()=>{if(!document.hidden)refresh()}
    window.addEventListener("focus",focus);document.addEventListener("visibilitychange",visibility)
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",visibility)}
  },[token,demo])

  useEffect(()=>{
    const capture=event=>{
      const button=event.target?.closest?.("button")
      if(!button)return
      const text=String(button.textContent||"").trim().toLowerCase()
      if(["escribir a recepción","message reception","falar com a recepção"].includes(text)){event.preventDefault();event.stopPropagation();setChatOpen(true);setChatNotice("")}
    }
    document.addEventListener("click",capture,true)
    return()=>document.removeEventListener("click",capture,true)
  },[])

  useEffect(()=>{if(chatOpen)window.setTimeout(()=>messagesEnd.current?.scrollIntoView({behavior:"smooth",block:"end"}),80)},[chatOpen,snapshot?.messages?.length])

  async function enableNotifications(){
    if(!("Notification"in window)){setNotifyPrompt(false);return}
    try{const value=await Notification.requestPermission();setNotifyState(value);setNotifyPrompt(false);window.localStorage.setItem(`hl:guest-notify-prompt:${window.location.pathname}`,"dismissed");if(value==="granted")showDeviceNotification(snapshot?.hotel?.name||"Portal del huésped","Listo. Te avisaremos cuando cambie un pedido mientras el portal esté activo.")}catch{setNotifyPrompt(false)}
  }
  function dismissNotifications(){setNotifyPrompt(false);try{window.localStorage.setItem(`hl:guest-notify-prompt:${window.location.pathname}`,"dismissed")}catch{}}
  async function sendMessage(event){
    event.preventDefault();const text=chatText.trim();if(!text||sending)return
    setSending(true);setChatNotice("")
    if(demo){setSnapshot(current=>({...current,messages:[...(current?.messages||[]),{id:`demo-${Date.now()}`,direction:"inbound",text,occurred_at:new Date().toISOString()}]}));setChatText("");setSending(false);return}
    const{data,error}=await supabase.rpc("hl_guest_stay_portal_message",{p_token:token,p_text:text})
    if(error||!data?.ok)setChatNotice("No pudimos enviar el mensaje. Probá nuevamente.")
    else{setChatText("");setChatNotice("Mensaje enviado a Recepción.");await refresh()}
    setSending(false)
  }

  const active=useMemo(()=>((snapshot?.requests||[]).filter(item=>!["resolved","cancelled"].includes(item.status))).slice(0,3),[snapshot])
  const latest=useMemo(()=>snapshot?.requests?.[0]||null,[snapshot])
  const messages=snapshot?.messages||[]

  return <>
    <PremiumPortalClient key={revision}/>
    <div className={s.topLayer}>
      {notifyPrompt?<div className={s.notifyCard}><span><GuestIcon name="bell" size={20}/></span><div><b>Activá las notificaciones</b><small>Recomendado para enterarte cuando Recepción, Housekeeping o Mantenimiento actualicen tus pedidos.</small></div><button type="button" onClick={enableNotifications}>Activar</button><button type="button" className={s.dismiss} onClick={dismissNotifications} aria-label="Ahora no">×</button></div>:null}
      {active.length?<button type="button" className={s.activityCard} onClick={()=>document.getElementById("mis-pedidos")?.scrollIntoView({behavior:"smooth",block:"start"})}><span className={s.pulse}/><div><b>{active.length===1?"1 solicitud activa":`${active.length} solicitudes activas`}</b><small>{active.map(item=>`${kindLabel[item.kind]||item.title}: ${statusLabel[item.status]||item.status}`).join(" · ")}</small></div><GuestIcon name="chevron-right" size={18}/></button>:latest&&latest.decision==="approved"?<div className={`${s.activityCard} ${s.done}`}><GuestIcon name="check" size={18}/><div><b>Late check-out aprobado</b><small>{latest.requested_time?`Salida confirmada a las ${latest.requested_time}`:"Recepción confirmó tu solicitud."}</small></div></div>:null}
      {activityNotice?<div className={s.toast}><GuestIcon name="bell" size={17}/><span>{activityNotice}</span></div>:null}
    </div>
    <button type="button" className={s.chatFab} onClick={()=>{setChatOpen(true);setChatNotice("")}} aria-label="Escribir a recepción"><GuestIcon name="message" size={22}/></button>
    {chatOpen?<div className={s.backdrop} onMouseDown={event=>{if(event.target===event.currentTarget)setChatOpen(false)}}><section className={s.chatSheet}><header><div><span><GuestIcon name="message" size={22}/></span><div><b>Recepción</b><small>Mensajes vinculados a tu reserva</small></div></div><button type="button" onClick={()=>setChatOpen(false)}>×</button></header><div className={s.chatMessages}>{messages.length?messages.map(message=><article key={message.id} data-direction={message.direction}><div>{message.text}</div><small>{message.direction==="outbound"?"Recepción":"Vos"}</small></article>):<div className={s.chatEmpty}>Escribinos lo que necesites. El mensaje llega a Recepción con tu reserva y habitación vinculadas.</div>}<div ref={messagesEnd}/></div><form onSubmit={sendMessage}><textarea value={chatText} onChange={event=>setChatText(event.target.value)} maxLength={2000} placeholder="Escribí tu mensaje…" rows={2}/><button type="submit" disabled={sending||!chatText.trim()}>{sending?"Enviando…":"Enviar"}</button></form>{chatNotice?<div className={s.chatNotice}>{chatNotice}</div>:null}</section></div>:null}
    {notifyState==="denied"?<div className={s.permissionHint}>Las notificaciones están bloqueadas en el navegador. Podés habilitarlas desde los permisos del sitio.</div>:null}
  </>
}
