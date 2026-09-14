"use client"

import{useCallback,useEffect,useRef,useState}from"react"
import s from"./PmsUpdateNotice.module.css"

const POLL_MS=5*60*1000
const SW_VERSION="20260913-3"

const isStandalone=()=>{if(typeof window==="undefined")return false;return window.matchMedia?.("(display-mode: standalone)").matches||window.navigator?.standalone===true}

export default function PmsUpdateNotice({buildId}){
  const[available,setAvailable]=useState(false),[dismissed,setDismissed]=useState(false),[online,setOnline]=useState(true),[installPrompt,setInstallPrompt]=useState(null),[installed,setInstalled]=useState(false),[installDismissed,setInstallDismissed]=useState(false)
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
    setOnline(navigator.onLine);setInstalled(isStandalone())
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
  if(!offline&&!showUpdate&&!showInstall)return null
  const mode=offline?"offline":showUpdate?"update":"install"
  return <aside className={s.notice} data-mode={mode} aria-live="polite">
    <div className={s.icon}><span>HL</span><i/></div>
    <div className={s.copy}>{offline?<><small>MODO OFFLINE</small><b>Seguís dentro de Habitación Llena</b><p>Mostramos la última información disponible en este dispositivo. Los cambios, cobros, mensajes y facturación requieren conexión.</p></>:showUpdate?<><small>ACTUALIZACIÓN DISPONIBLE</small><b>Hay una versión nueva de Habitación Llena</b><p>Podés seguir trabajando y actualizar cuando estés en un punto seguro.</p></>:<><small>INSTALAR HABITACIÓN LLENA</small><b>Usalo como un programa en esta computadora</b><p>Se abre en su propia ventana y queda disponible desde el escritorio o menú de aplicaciones.</p></>}</div>
    <div className={s.actions}>{offline?<button type="button" className={s.later} onClick={()=>window.location.reload()}>Reintentar conexión</button>:showUpdate?<><button type="button" className={s.later} onClick={()=>setDismissed(true)}>Más tarde</button><button type="button" className={s.update} onClick={()=>window.location.reload()}>Actualizar ahora</button></>:<><button type="button" className={s.later} onClick={()=>setInstallDismissed(true)}>Ahora no</button><button type="button" className={s.update} onClick={install}>Instalar</button></>}</div>
  </aside>
}
