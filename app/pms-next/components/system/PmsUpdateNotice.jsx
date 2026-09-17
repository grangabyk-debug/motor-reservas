"use client"

import{useCallback,useEffect,useRef,useState}from"react"
import{createPortal}from"react-dom"
import s from"./PmsUpdateNotice.module.css"

const POLL_MS=5*60*1000
const SW_VERSION="20260917-1"

const isStandalone=()=>{if(typeof window==="undefined")return false;return window.matchMedia?.("(display-mode: standalone)").matches||window.navigator?.standalone===true}

export default function PmsUpdateNotice({buildId}){
  const[available,setAvailable]=useState(false),[dismissed,setDismissed]=useState(false),[online,setOnline]=useState(true),[installPrompt,setInstallPrompt]=useState(null),[installed,setInstalled]=useState(false),[installDismissed,setInstallDismissed]=useState(false),[mounted,setMounted]=useState(false)
  const timerRef=useRef(null)

  const check=useCallback(async()=>{
    if(!buildId||buildId==="local"||document.visibilityState==="hidden"||!navigator.onLine)return
    try{
      const response=await fetch(`/api/system/version?t=${Date.now()}`,{cache:"no-store"})
      if(!response.ok)return
      const data=await response.json()
      if(data?.buildId&&data.buildId!=="local"&&data.buildId!==buildId){setAvailable(true);setDismissed(false)}
    }catch{}
  },[buildId])

  useEffect(()=>{
    setMounted(true);setOnline(navigator.onLine);setInstalled(isStandalone())
    const onOnline=()=>{setOnline(true);document.documentElement.dataset.offline="0";check()}
    const onOffline=()=>{setOnline(false);document.documentElement.dataset.offline="1"}
    const onInstall=e=>{e.preventDefault();setInstallPrompt(e);setInstallDismissed(false)}
    const onInstalled=()=>{setInstalled(true);setInstallPrompt(null)}
    document.documentElement.dataset.offline=navigator.onLine?"0":"1"
    window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);window.addEventListener("beforeinstallprompt",onInstall);window.addEventListener("appinstalled",onInstalled)
    if("serviceWorker"in navigator){navigator.serviceWorker.register(`/sw.js?v=${SW_VERSION}`,{scope:"/"}).then(registration=>{const worker=registration.active||registration.waiting||registration.installing;worker?.postMessage({type:"CACHE_PMS_SHELL"});navigator.storage?.persist?.().catch(()=>false)}).catch(()=>{})}
    check();timerRef.current=window.setInterval(check,POLL_MS)
    const onVisible=()=>{if(document.visibilityState==="visible")check()};document.addEventListener("visibilitychange",onVisible)
    return()=>{window.clearInterval(timerRef.current);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);window.removeEventListener("beforeinstallprompt",onInstall);window.removeEventListener("appinstalled",onInstalled)}
  },[check])

  async function install(){if(!installPrompt)return;try{await installPrompt.prompt();const result=await installPrompt.userChoice.catch(()=>null);if(result?.outcome==="accepted"){setInstalled(true);setInstallPrompt(null)}}catch{}}

  const offline=!online,showUpdate=available&&!dismissed&&!offline,showInstall=Boolean(installPrompt)&&!installed&&!installDismissed&&!offline&&!showUpdate
  if(!mounted||(!offline&&!showUpdate&&!showInstall)||typeof document==="undefined")return null
  const mode=offline?"offline":showUpdate?"update":"install"
  const compactStyle={position:"fixed",inset:"auto 16px 16px auto",right:16,bottom:16,left:"auto",top:"auto",zIndex:2147483000,width:"min(318px,calc(100vw - 32px))",maxWidth:318,minWidth:0,height:"auto",minHeight:0,maxHeight:"none",margin:0,display:"grid",gridTemplateColumns:"34px minmax(0,1fr)",alignItems:"start",gap:"8px 9px",padding:"9px 10px",overflow:"visible"}
  const notice=<aside className={s.notice} style={compactStyle} data-mode={mode} aria-live="polite">
    <div className={s.icon}><span>HL</span><i/></div>
    <div className={s.copy}>{offline?<><small>MODO OFFLINE</small><b>Sin conexión</b><p>Podés consultar lo disponible; los cambios requieren internet.</p></>:showUpdate?<><small>ACTUALIZACIÓN DISPONIBLE</small><b>Hay una versión nueva</b></>:<><small>INSTALAR HABITACIÓN LLENA</small><b>Usalo como programa</b><p>Podés instalarlo en esta computadora.</p></>}</div>
    <div className={s.actions}>{offline?<button type="button" className={s.later} onClick={()=>window.location.reload()}>Reintentar</button>:showUpdate?<><button type="button" className={s.later} onClick={()=>setDismissed(true)}>Más tarde</button><button type="button" className={s.update} onClick={()=>window.location.reload()}>Actualizar</button></>:<><button type="button" className={s.later} onClick={()=>setInstallDismissed(true)}>Ahora no</button><button type="button" className={s.update} onClick={install}>Instalar</button></>}</div>
  </aside>
  return createPortal(notice,document.body)
}
