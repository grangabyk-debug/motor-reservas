"use client"

import{useCallback,useEffect,useRef,useState}from"react"
import s from"./PmsUpdateNotice.module.css"

const POLL_MS=5*60*1000

export default function PmsUpdateNotice({buildId}){
  const[available,setAvailable]=useState(false)
  const[dismissed,setDismissed]=useState(false)
  const timerRef=useRef(null)

  const check=useCallback(async()=>{
    if(!buildId||buildId==="local"||document.visibilityState==="hidden")return
    try{
      const response=await fetch(`/api/system/version?t=${Date.now()}`,{cache:"no-store"})
      if(!response.ok)return
      const data=await response.json()
      if(data?.buildId&&data.buildId!=="local"&&data.buildId!==buildId){setAvailable(true);setDismissed(false)}
    }catch{}
  },[buildId])

  useEffect(()=>{
    check()
    timerRef.current=window.setInterval(check,POLL_MS)
    const onVisible=()=>{if(document.visibilityState==="visible")check()}
    document.addEventListener("visibilitychange",onVisible)
    return()=>{window.clearInterval(timerRef.current);document.removeEventListener("visibilitychange",onVisible)}
  },[check])

  if(!available||dismissed)return null
  return <aside className={s.notice} aria-live="polite">
    <div className={s.icon}><span>HL</span><i/></div>
    <div className={s.copy}><small>ACTUALIZACIÓN DISPONIBLE</small><b>Hay una versión nueva de Habitación Llena</b><p>Podés seguir trabajando y actualizar cuando estés en un punto seguro.</p></div>
    <div className={s.actions}><button type="button" className={s.later} onClick={()=>setDismissed(true)}>Más tarde</button><button type="button" className={s.update} onClick={()=>window.location.reload()}>Actualizar ahora</button></div>
  </aside>
}
