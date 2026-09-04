"use client"

import{useEffect,useMemo,useState}from"react"
import s from"../../pms-next.module.css"

export default function PmsTopbar({title,theme,onToggleTheme,onNewReservation,onNewQuote,onOpenSearch,onOpenActivity,timeZone}){
  const[now,setNow]=useState(()=>new Date())
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[])
  const clock=useMemo(()=>{
    const zone=timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone
    try{return{date:new Intl.DateTimeFormat("es-AR",{weekday:"short",day:"2-digit",month:"short",timeZone:zone}).format(now),time:new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:zone}).format(now)}}catch{return{date:new Intl.DateTimeFormat("es-AR",{weekday:"short",day:"2-digit",month:"short"}).format(now),time:new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}).format(now)}}
  },[now,timeZone])
  return <header className={s.topbar}>
    <div className={s.topbarTitle}><small>HABITACIÓN LLENA</small><b>{title}</b></div>
    <button className={s.globalSearch} type="button" onClick={onOpenSearch}><span>⌕</span><span>Buscar huésped, reserva o habitación…</span><kbd>Ctrl K</kbd></button>
    <div className={s.topbarActions}>
      <time title={timeZone||"Zona horaria del dispositivo"} style={{display:"grid",textAlign:"right",lineHeight:1.08,minWidth:76}}><b>{clock.time}</b><small style={{opacity:.6,textTransform:"capitalize"}}>{clock.date}</small></time>
      <button className={s.iconButton} type="button" onClick={onToggleTheme} aria-label={theme==="dark"?"Activar modo día":"Activar modo noche"}>{theme==="dark"?"☀":"☾"}</button>
      {onOpenActivity&&<button className={s.iconButton} type="button" onClick={onOpenActivity} aria-label="Abrir actividad reciente" title="Actividad reciente">◇</button>}
      {onNewQuote&&<button className={s.iconButton} type="button" onClick={onNewQuote} aria-label="Crear presupuesto" title="Presupuestar">$</button>}
      {onNewReservation&&<button className={s.primaryButton} type="button" onClick={onNewReservation}>＋ Reserva</button>}
    </div>
  </header>
}
