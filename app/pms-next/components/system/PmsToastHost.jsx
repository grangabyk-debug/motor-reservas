"use client"

import{useEffect,useRef,useState}from"react"
import PmsLiveFeedbackBridge from"./PmsLiveFeedbackBridge"
import s from"./pms-toast.module.css"

export default function PmsToastHost(){
  const[toasts,setToasts]=useState([]),timers=useRef(new Map())

  function clearTimers(id){
    const entry=timers.current.get(id)
    if(!entry)return
    if(entry.leave)window.clearTimeout(entry.leave)
    if(entry.dismiss)window.clearTimeout(entry.dismiss)
    timers.current.delete(id)
  }

  function dismiss(id){
    clearTimers(id)
    setToasts(list=>list.filter(item=>item.id!==id))
  }

  useEffect(()=>{
    const show=event=>{
      const detail=event?.detail||{}
      const id=detail.id||`${Date.now()}-${Math.random().toString(36).slice(2)}`
      const tone=detail.tone||"success"
      const toast={
        id,
        tone,
        phase:"enter",
        title:detail.title||"Listo",
        message:detail.message||"Cambio guardado.",
        actionLabel:detail.actionLabel||"",
        onAction:typeof detail.onAction==="function"?detail.onAction:null,
      }
      for(const activeId of [...timers.current.keys()])clearTimers(activeId)
      setToasts([toast])
      window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>setToasts(list=>list.map(item=>item.id===id?{...item,phase:"stable"}:item))))
      const duration=Math.max(1800,Number(detail.duration)||3200)
      const leave=window.setTimeout(()=>setToasts(list=>list.map(item=>item.id===id?{...item,phase:"leave"}:item)),Math.max(900,duration-460))
      const remove=window.setTimeout(()=>dismiss(id),duration)
      timers.current.set(id,{leave,dismiss:remove})
    }
    window.addEventListener("hl:pms-toast",show)
    return()=>{
      window.removeEventListener("hl:pms-toast",show)
      for(const entry of timers.current.values()){
        if(entry.leave)window.clearTimeout(entry.leave)
        if(entry.dismiss)window.clearTimeout(entry.dismiss)
      }
      timers.current.clear()
    }
  },[])

  return <><PmsLiveFeedbackBridge/>{toasts.length?<div className={s.host} aria-live="polite">{toasts.map(toast=>{
    const alertTone=toast.tone==="danger"||toast.tone==="warning"||toast.tone==="ota"
    return <div key={toast.id} className={s.toast} data-tone={toast.tone} data-phase={toast.phase} role={alertTone?"alert":"status"}>
      <span className={s.icon} aria-hidden="true">{toast.tone==="olivia"?"":toast.tone==="danger"||toast.tone==="error"?"!":toast.tone==="warning"?"•":toast.tone==="ota"?"OTA":toast.tone==="info"?"i":"✓"}</span>
      <div className={s.body}><b>{toast.title}</b><p>{toast.message}</p>{toast.actionLabel&&toast.onAction?<button type="button" className={s.action} onClick={()=>{try{toast.onAction()}finally{dismiss(toast.id)}}}>{toast.actionLabel}</button>:null}</div>
      <button type="button" className={s.close} onClick={()=>dismiss(toast.id)} aria-label="Cerrar aviso">×</button>
    </div>
  })}</div>:null}</>
}
