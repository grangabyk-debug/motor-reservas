"use client"

import{useEffect,useRef,useState}from"react"
import s from"./pms-toast.module.css"

export default function PmsToastHost(){
  const[toasts,setToasts]=useState([]),timers=useRef(new Map())
  function dismiss(id){const timer=timers.current.get(id);if(timer)window.clearTimeout(timer);timers.current.delete(id);setToasts(list=>list.filter(item=>item.id!==id))}
  useEffect(()=>{
    const show=event=>{
      const detail=event?.detail||{},id=detail.id||`${Date.now()}-${Math.random().toString(36).slice(2)}`,toast={id,tone:detail.tone||"success",title:detail.title||"Listo",message:detail.message||"Cambio guardado.",actionLabel:detail.actionLabel||"",onAction:typeof detail.onAction==="function"?detail.onAction:null}
      setToasts(list=>[...list.filter(item=>item.id!==id),toast].slice(-4))
      const duration=Math.max(1800,Number(detail.duration)||3200),timer=window.setTimeout(()=>dismiss(id),duration);timers.current.set(id,timer)
    }
    window.addEventListener("hl:pms-toast",show)
    return()=>{window.removeEventListener("hl:pms-toast",show);for(const timer of timers.current.values())window.clearTimeout(timer);timers.current.clear()}
  },[])
  if(!toasts.length)return null
  return <div className={s.host} aria-live="polite">{toasts.map(toast=><div key={toast.id} className={s.toast} data-tone={toast.tone} role={toast.tone==="danger"||toast.tone==="warning"?"alert":"status"}><span className={s.icon}>{toast.tone==="danger"||toast.tone==="error"?"!":toast.tone==="warning"?"•":toast.tone==="info"?"i":"✓"}</span><div className={s.body}><b>{toast.title}</b><p>{toast.message}</p>{toast.actionLabel&&toast.onAction?<button type="button" className={s.action} onClick={()=>{try{toast.onAction()}finally{dismiss(toast.id)}}}>{toast.actionLabel}</button>:null}</div><button type="button" className={s.close} onClick={()=>dismiss(toast.id)} aria-label="Cerrar aviso">×</button></div>)}</div>
}
