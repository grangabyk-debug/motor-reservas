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
const normalize=value=>String(value||"").trim().toLowerCase()
const MAIN_VIEW_LABELS={
  stay:["mi estadía","my stay","minha estadia"],
  services:["servicios","services","serviços"],
  hotel:["hotel"],
  explore:["explorar","explore"],
  home:["inicio","home","início"],
  help:["ayuda","help","ajuda"],
}
const CHAT_LABELS=["escribir a recepción","message reception","falar com a recepção","recepción","reception","recepção"]
const REQUEST_BANNER_MARKERS=["pedido en curso","pedidos en curso","request in progress","requests in progress","pedido em andamento","pedidos em andamento"]

function notificationText(request){
  if(request?.kind==="late_checkout"&&request?.decision==="approved")return `Late check-out aprobado${request.requested_time?` hasta las ${request.requested_time}`:""}.`
  if(request?.kind==="late_checkout"&&request?.decision==="rejected")return"Recepción revisó tu late check-out y no pudo aprobarlo."
  const label=kindLabel[request?.kind]||request?.title||"Tu pedido"
  return `${label}: ${statusLabel[request?.status]||request?.status||"actualizado"}.`
}

export default function GuestPortalRuntime(){
  const params=useParams(),token=String(params?.token||""),demo=token==="demo"
  const[snapshot,setSnapshot]=useState(null),[revision,setRevision]=useState(0),[chatOpen,setChatOpen]=useState(false),[chatText,setChatText]=useState(""),[sending,setSending]=useState(false),[chatNotice,setChatNotice]=useState(""),[activityNotice,setActivityNotice]=useState(""),[notifyPrompt,setNotifyPrompt]=useState(false),[notifyState,setNotifyState]=useState("default"),[activityOpen,setActivityOpen]=useState(false),[portalView,setPortalView]=useState("home")
  const knownRequests=useRef(new Map()),knownMessages=useRef(new Set()),initialized=useRef(false),messagesEnd=useRef(null),portalRoot=useRef(null)

  async function showDeviceNotification(title,body){
    if(typeof window==="undefined"||!("Notification"in window)||Notification.permission!=="granted")return
    try{
      if("serviceWorker"in navigator){const reg=await navigator.serviceWorker.ready;await reg.showNotification(title,{body,icon:"/favicon.ico",tag:"hl-guest-stay",renotify:true,data:{url:window.location.href}});return}
      new Notification(title,{body})
    }catch{}
  }

  function pulseDevice(){try{navigator.vibrate?.(60)}catch{}}

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
    if(requestsChanged){setRevision(value=>value+1);if(changedRequest){const text=notificationText(changedRequest);setActivityNotice(text);window.setTimeout(()=>setActivityNotice(""),4200);pulseDevice();if(document.hidden)showDeviceNotification(data?.hotel?.name||"Tu hotel",text)}}
    if(messagesChanged&&freshOutbound.length){const text=freshOutbound[freshOutbound.length-1]?.text||"Recepción respondió tu mensaje.";setActivityNotice(`Recepción: ${text}`);window.setTimeout(()=>setActivityNotice(""),4200);pulseDevice();if(document.hidden)showDeviceNotification(data?.hotel?.name||"Recepción",text)}
  }

  useEffect(()=>{
    if(typeof window==="undefined")return
    if("serviceWorker"in navigator)navigator.serviceWorker.register("/guest-portal-sw.js").catch(()=>{})
    if("Notification"in window)setNotifyState(Notification.permission)
    const key=`hl:guest-notify-prompt:${window.location.pathname}`
    const dismissed=window.localStorage.getItem(key)==="dismissed"
    if(!dismissed&&("Notification"in window)&&Notification.permission==="default")window.setTimeout(()=>setNotifyPrompt(true),1200)
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
    const openChat=()=>{setChatOpen(true);setChatNotice("")}
    const openView=event=>{const next=event?.detail?.view;if(next)setPortalView(next)}
    window.addEventListener("hl:guest-chat-open",openChat)
    window.addEventListener("hl:guest-portal-view",openView)
    return()=>{window.removeEventListener("hl:guest-chat-open",openChat);window.removeEventListener("hl:guest-portal-view",openView)}
  },[])

  useEffect(()=>{
    const capture=event=>{
      const button=event.target?.closest?.("button")
      if(!button||!portalRoot.current?.contains(button))return
      const text=normalize(button.textContent)
      const insideSection=Boolean(button.closest("section[id]"))
      if(CHAT_LABELS.some(label=>text===label||text.startsWith(`${label} `))){event.preventDefault();event.stopPropagation();setChatOpen(true);setChatNotice("");return}
      if(REQUEST_BANNER_MARKERS.some(marker=>text.includes(marker))){event.preventDefault();event.stopPropagation();setPortalView("requests");return}
      if(insideSection)return
      for(const[view,labels]of Object.entries(MAIN_VIEW_LABELS)){
        if(labels.some(label=>text===label||text.startsWith(`${label} `))){event.preventDefault();event.stopPropagation();if(view==="help"){setChatOpen(true);setChatNotice("")}else setPortalView(view);return}
      }
    }
    document.addEventListener("click",capture,true)
    return()=>document.removeEventListener("click",capture,true)
  },[])

  useEffect(()=>{
    const root=portalRoot.current
    if(!root)return
    const apply=()=>{
      const sections=[...root.querySelectorAll("section[id]")]
      const visibleIds={home:[],services:["pedidos"],stay:["mi-estadia"],hotel:["wifi","guia"],explore:["cerca"],requests:["mis-pedidos"]}[portalView]||[]
      sections.forEach(section=>{section.style.display=visibleIds.includes(section.id)?"block":"none";section.style.borderBottom="0";section.style.paddingTop="16px"})
      const buttons=[...root.querySelectorAll("button")]
      const stayButton=buttons.find(button=>MAIN_VIEW_LABELS.stay.some(label=>normalize(button.textContent).startsWith(label)))
      const appGrid=stayButton?.parentElement
      if(appGrid&&appGrid.children.length>=3){appGrid.style.display=portalView==="home"?"grid":"none";appGrid.style.marginBottom="10px";[...appGrid.children].forEach(card=>{card.style.minHeight="94px";card.style.borderRadius="21px";card.style.padding="13px"})}
      buttons.forEach(button=>{const text=normalize(button.textContent);if(REQUEST_BANNER_MARKERS.some(marker=>text.includes(marker)))button.style.display=portalView==="home"?"flex":"none"})
      const hero=root.querySelector("header")
      if(hero&&hero.children.length>=4){hero.children[2].style.display=portalView==="home"?"block":"none";hero.children[3].style.display=portalView==="home"?"grid":"none";hero.style.paddingBottom=portalView==="home"?"18px":"10px"}
      const footer=root.querySelector("footer");if(footer)footer.style.display="none"
      const nav=root.querySelector("nav")
      if(nav){nav.style.position="fixed";nav.style.left="50%";nav.style.transform="translateX(-50%)";nav.style.bottom="10px";nav.style.width="min(calc(100% - 28px),560px)";nav.style.margin="0";nav.style.zIndex="60"}
      const phone=root.querySelector("main>div");if(phone)phone.style.paddingBottom="82px"
      const content=hero?.nextElementSibling;if(content){content.style.minHeight=portalView==="home"?"auto":"calc(100dvh - 160px)";content.style.paddingBottom="92px"}
      if(portalView!=="home"&&visibleIds.length){const target=root.querySelector(`#${visibleIds[0]}`);target?.scrollIntoView({block:"start"})}else if(portalView==="home")window.scrollTo({top:0,behavior:"instant"})
    }
    const frame=requestAnimationFrame(apply)
    return()=>cancelAnimationFrame(frame)
  },[portalView,revision])

  useEffect(()=>{if(chatOpen)window.setTimeout(()=>messagesEnd.current?.scrollIntoView({behavior:"smooth",block:"end"}),80)},[chatOpen,snapshot?.messages?.length])

  async function enableNotifications(){
    if(!("Notification"in window)){setNotifyPrompt(false);return}
    try{const value=await Notification.requestPermission();setNotifyState(value);setNotifyPrompt(false);window.localStorage.setItem(`hl:guest-notify-prompt:${window.location.pathname}`,"dismissed");if(value==="granted")showDeviceNotification(snapshot?.hotel?.name||"Portal del huésped","Listo. Te avisaremos cuando haya novedades durante tu estadía.")}catch{setNotifyPrompt(false)}
  }
  function dismissNotifications(){setNotifyPrompt(false);try{window.localStorage.setItem(`hl:guest-notify-prompt:${window.location.pathname}`,"dismissed")}catch{}}
  async function sendMessage(event){
    event.preventDefault();const text=chatText.trim();if(!text||sending)return
    setSending(true);setChatNotice("")
    if(demo){setSnapshot(current=>({...current,messages:[...(current?.messages||[]),{id:`demo-${Date.now()}`,direction:"inbound",text,occurred_at:new Date().toISOString()}]}));setChatText("");setSending(false);return}
    const{data,error}=await supabase.rpc("hl_guest_stay_portal_message",{p_token:token,p_text:text})
    if(error||!data?.ok)setChatNotice("No pudimos enviar el mensaje. Probá nuevamente.")
    else{setChatText("");setChatNotice("Mensaje enviado.");await refresh()}
    setSending(false)
  }

  const active=useMemo(()=>((snapshot?.requests||[]).filter(item=>!["resolved","cancelled"].includes(item.status))).slice(0,6),[snapshot])
  const recentRequests=useMemo(()=>((snapshot?.requests||[]).slice(0,6)),[snapshot])
  const messages=snapshot?.messages||[]
  const recentReception=useMemo(()=>messages.filter(item=>item.direction==="outbound").slice(-3).reverse(),[messages])
  const activityCount=active.length+recentReception.length

  return <>
    <div ref={portalRoot}><PremiumPortalClient key={revision}/></div>

    <div className={s.topLayer}>{activityNotice?<div className={s.toast}><GuestIcon name="bell" size={17}/><span>{activityNotice}</span></div>:null}</div>

    {activityCount>0?<button type="button" className="hlGuestActivityFab" onClick={()=>setActivityOpen(true)} aria-label="Ver actividad"><GuestIcon name="bell" size={20}/><span>{activityCount}</span></button>:null}
    <button type="button" className={s.chatFab} onClick={()=>{setChatOpen(true);setChatNotice("")}} aria-label="Escribir a recepción"><GuestIcon name="message" size={22}/></button>

    {notifyPrompt?<div className="hlGuestNotifyPrompt"><span><GuestIcon name="bell" size={20}/></span><div><b>Activá los avisos</b><small>Te avisamos cuando Recepción o el equipo actualicen algo.</small></div><button type="button" onClick={enableNotifications}>Activar</button><button type="button" onClick={dismissNotifications} aria-label="Ahora no">×</button></div>:null}

    {activityOpen?<div className={s.backdrop} onMouseDown={event=>{if(event.target===event.currentTarget)setActivityOpen(false)}}><section className="hlGuestActivitySheet"><header><div><span><GuestIcon name="bell" size={21}/></span><div><b>Actividad</b><small>Todo lo importante de tu estadía</small></div></div><button type="button" onClick={()=>setActivityOpen(false)}>×</button></header><div className="hlGuestActivityList">{active.length?<><h3>Solicitudes activas</h3>{active.map(item=><button type="button" key={item.id} onClick={()=>{setActivityOpen(false);setPortalView("requests")}}><span className="hlStatusDot" data-status={item.status}/><div><b>{kindLabel[item.kind]||item.title||"Solicitud"}</b><small>{statusLabel[item.status]||item.status}{item.requested_time?` · ${item.requested_time}`:""}</small></div><GuestIcon name="chevron-right" size={17}/></button>)}</>:null}{recentReception.length?<><h3>Mensajes de Recepción</h3>{recentReception.map(message=><button type="button" key={message.id} onClick={()=>{setActivityOpen(false);setChatOpen(true)}}><span className="hlMessageIcon"><GuestIcon name="message" size={16}/></span><div><b>Recepción</b><small>{message.text}</small></div><GuestIcon name="chevron-right" size={17}/></button>)}</>:null}{!active.length&&!recentReception.length?<div className="hlGuestActivityEmpty">No hay novedades pendientes.</div>:null}</div><footer><button type="button" onClick={()=>{setActivityOpen(false);setPortalView("requests")}}>Ver solicitudes</button><button type="button" onClick={()=>{setActivityOpen(false);setChatOpen(true)}}>Hablar con Recepción</button></footer></section></div>:null}

    {chatOpen?<div className={`${s.backdrop} hlGuestChatBackdrop`}><section className={`${s.chatSheet} hlGuestChatSheet`}><header><div><button type="button" className="hlGuestChatBack" onClick={()=>setChatOpen(false)} aria-label="Volver">‹</button><span><GuestIcon name="message" size={22}/></span><div><b>Recepción</b><small>Tu conversación con el hotel</small></div></div><button type="button" onClick={()=>setChatOpen(false)}>×</button></header><div className={s.chatMessages}>{messages.length?messages.map(message=><article key={message.id} data-direction={message.direction}><div>{message.text}</div><small>{message.direction==="outbound"?"Recepción":"Vos"}</small></article>):<div className={s.chatEmpty}>Escribinos lo que necesites. Tu reserva y habitación ya están vinculadas.</div>}<div ref={messagesEnd}/></div><form onSubmit={sendMessage}><textarea value={chatText} onChange={event=>setChatText(event.target.value)} maxLength={2000} placeholder="Escribí un mensaje…" rows={1}/><button type="submit" disabled={sending||!chatText.trim()}>{sending?"…":"Enviar"}</button></form>{chatNotice?<div className={s.chatNotice}>{chatNotice}</div>:null}</section></div>:null}

    {notifyState==="denied"?<div className={s.permissionHint}>Las notificaciones están bloqueadas. Podés habilitarlas desde los permisos del sitio.</div>:null}

    <style jsx global>{`
      .hlGuestActivityFab{position:fixed;left:max(16px,calc((100vw - 600px)/2 + 16px));bottom:90px;z-index:76;width:48px;height:48px;border:1px solid rgba(255,255,255,.84);border-radius:17px;background:rgba(248,249,252,.94);color:#29384e;display:grid;place-items:center;box-shadow:0 14px 34px rgba(22,31,46,.2),inset 0 1px rgba(255,255,255,.9);backdrop-filter:blur(20px);cursor:pointer}.hlGuestActivityFab span{position:absolute;right:-3px;top:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#e34949;color:white;border:2px solid white;display:grid;place-items:center;font-size:9px;font-weight:900}.hlGuestActivityFab:active{transform:scale(.96)}
      .hlGuestNotifyPrompt{position:fixed;z-index:88;left:50%;bottom:88px;transform:translateX(-50%);width:min(calc(100% - 28px),520px);display:grid;grid-template-columns:38px 1fr auto auto;align-items:center;gap:9px;padding:9px 10px;border:1px solid rgba(255,255,255,.86);border-radius:18px;background:rgba(249,250,252,.95);box-shadow:0 18px 46px rgba(18,26,38,.2);backdrop-filter:blur(22px)}.hlGuestNotifyPrompt>span{width:38px;height:38px;border-radius:13px;background:#eef1ff;color:#5b5ee1;display:grid;place-items:center}.hlGuestNotifyPrompt div{display:grid;gap:2px}.hlGuestNotifyPrompt b{font-size:11px}.hlGuestNotifyPrompt small{font-size:8.7px;color:#7c828c;line-height:1.3}.hlGuestNotifyPrompt button{border:0;border-radius:11px;background:#27364d;color:#fff;padding:8px 10px;font-size:9.5px;font-weight:800;cursor:pointer}.hlGuestNotifyPrompt button:last-child{width:28px;height:28px;padding:0;border-radius:50%;background:#eceef2;color:#666c75;font-size:16px}
      .hlGuestActivitySheet{width:min(100%,560px);max-height:min(76dvh,650px);background:rgba(251,252,253,.98);border:1px solid rgba(255,255,255,.86);border-radius:28px 28px 22px 22px;box-shadow:0 30px 90px rgba(18,23,32,.3);display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}.hlGuestActivitySheet>header{display:flex;align-items:center;justify-content:space-between;padding:14px 15px;border-bottom:1px solid rgba(42,50,64,.08)}.hlGuestActivitySheet>header>div{display:flex;align-items:center;gap:10px}.hlGuestActivitySheet>header span{width:40px;height:40px;border-radius:14px;background:#eef1ff;color:#5b5ee1;display:grid;place-items:center}.hlGuestActivitySheet>header div div{display:grid;gap:1px}.hlGuestActivitySheet>header b{font-size:13px}.hlGuestActivitySheet>header small{font-size:9px;color:#838892}.hlGuestActivitySheet>header>button{width:32px;height:32px;border:0;border-radius:50%;background:#eceef2;color:#555b65;font-size:20px}.hlGuestActivityList{overflow:auto;padding:12px;display:grid;gap:7px}.hlGuestActivityList h3{font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:#8b9098;margin:8px 4px 3px}.hlGuestActivityList button{width:100%;min-height:62px;border:1px solid rgba(43,52,66,.07);border-radius:17px;background:#fff;padding:10px 11px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;text-align:left;color:#171a20}.hlGuestActivityList button>div{display:grid;gap:2px;min-width:0}.hlGuestActivityList button b{font-size:11px}.hlGuestActivityList button small{font-size:9px;color:#838892;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hlStatusDot{width:10px;height:10px;border-radius:50%;background:#59c98a;box-shadow:0 0 0 5px rgba(89,201,138,.12)}.hlStatusDot[data-status="in_progress"]{background:#e4a941;box-shadow:0 0 0 5px rgba(228,169,65,.12)}.hlMessageIcon{width:34px!important;height:34px!important;border-radius:12px!important;background:#eef1ff!important;color:#5b5ee1!important}.hlGuestActivitySheet footer{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px;border-top:1px solid rgba(42,50,64,.08)}.hlGuestActivitySheet footer button{border:0;border-radius:13px;padding:11px;font-size:9.5px;font-weight:850;background:#eef0f4;color:#313845}.hlGuestActivitySheet footer button:last-child{background:#27374f;color:#fff}.hlGuestActivityEmpty{padding:36px 18px;text-align:center;color:#868c95;font-size:10px}
      .hlGuestChatBack{display:none!important}.hlGuestChatSheet form textarea{min-height:42px;max-height:90px}.hlGuestChatSheet form{padding-bottom:max(10px,env(safe-area-inset-bottom))}
      @media(max-width:600px){.hlGuestNotifyPrompt{bottom:82px;grid-template-columns:36px 1fr auto}.hlGuestNotifyPrompt button:last-child{position:absolute;right:-5px;top:-7px}.hlGuestActivitySheet{height:78dvh;border-radius:26px 26px 0 0}.hlGuestChatBackdrop{padding:0!important;align-items:stretch!important}.hlGuestChatSheet{width:100%!important;height:100dvh!important;max-height:none!important;border-radius:0!important;border:0!important;padding-top:env(safe-area-inset-top)}.hlGuestChatSheet header{min-height:68px;padding-top:max(12px,env(safe-area-inset-top))}.hlGuestChatBack{display:grid!important;width:32px!important;height:32px!important;border-radius:50%!important;background:#eef0f4!important;color:#27374f!important;font-size:25px!important;place-items:center}.hlGuestChatSheet header>button:last-child{display:none}.hlGuestChatSheet .${s.chatMessages}{padding:14px 12px}.hlGuestChatSheet form{position:sticky;bottom:0;background:#f7f8fb}}
    `}</style>
  </>
}
