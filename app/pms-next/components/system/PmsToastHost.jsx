"use client"

import{useEffect,useRef,useState}from"react"
import s from"./pms-toast.module.css"

export default function PmsToastHost(){
  const[toast,setToast]=useState(null)
  const timer=useRef(null)
  useEffect(()=>{
    const show=event=>{
      const detail=event?.detail||{}
      if(timer.current)window.clearTimeout(timer.current)
      setToast({id:Date.now(),tone:detail.tone||"success",title:detail.title||"Listo",message:detail.message||"Cambio guardado."})
      timer.current=window.setTimeout(()=>setToast(null),Math.max(1800,Number(detail.duration)||3200))
    }
    window.addEventListener("hl:pms-toast",show)
    return()=>{window.removeEventListener("hl:pms-toast",show);if(timer.current)window.clearTimeout(timer.current)}
  },[])
  if(!toast)return null
  return <div className={s.host} role="status" aria-live="polite"><div className={s.toast} data-tone={toast.tone}><span className={s.icon}>{toast.tone==="error"?"!":toast.tone==="info"?"i":"✓"}</span><div><b>{toast.title}</b><p>{toast.message}</p></div><button type="button" onClick={()=>setToast(null)} aria-label="Cerrar aviso">×</button></div></div>
}
