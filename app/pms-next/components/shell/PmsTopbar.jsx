"use client"

import{useEffect,useMemo,useState}from"react"
import s from"../../pms-next.module.css"
import c from"./pmsTopbarControls.module.css"
import PmsIcon from"./PmsIcons"

export default function PmsTopbar({title,info,theme,onToggleTheme,onNewReservation,onNewQuote,onOpenSearch,onOpenActivity,timeZone}){
  const[now,setNow]=useState(()=>new Date())
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[])
  const clock=useMemo(()=>{
    const zone=timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone
    try{return{date:new Intl.DateTimeFormat("es-AR",{weekday:"short",day:"2-digit",month:"short",timeZone:zone}).format(now),time:new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:zone}).format(now)}}catch{return{date:new Intl.DateTimeFormat("es-AR",{weekday:"short",day:"2-digit",month:"short"}).format(now),time:new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}).format(now)}}
  },[now,timeZone])
  return <header className={s.topbar}>
    <div className={s.topbarTitle}><small>HABITACIÓN LLENA</small><span style={{display:"flex",alignItems:"center",gap:6}}><b>{title}</b>{info?<button type="button" aria-label={`Información sobre ${title}`} title={info} style={{width:18,height:18,padding:0,border:"1px solid var(--lineStrong)",borderRadius:"50%",background:"color-mix(in srgb,var(--panelSolid) 80%,transparent)",color:"var(--muted)",fontSize:10,fontWeight:900,lineHeight:1,cursor:"help"}}>i</button>:null}</span></div>
    <button className={s.globalSearch} type="button" onClick={onOpenSearch}><span>⌕</span><span>Buscar huésped, reserva o habitación…</span><kbd>Ctrl K</kbd></button>
    <div className={s.topbarActions}>
      <time title={timeZone||"Zona horaria del dispositivo"} style={{display:"grid",textAlign:"right",lineHeight:1.08,minWidth:76}}><b>{clock.time}</b><small style={{opacity:.6,textTransform:"capitalize"}}>{clock.date}</small></time>
      <div className={c.hotelToolGroup} aria-label="Acciones rápidas del hotel">
        <button className={`${s.iconButton} ${c.hotelTool}`} data-kind="theme" data-tooltip={theme==="dark"?"Modo día":"Modo noche"} type="button" onClick={onToggleTheme} aria-label={theme==="dark"?"Activar modo día":"Activar modo noche"} title={theme==="dark"?"Cambiar a modo día":"Cambiar a modo noche"}><PmsIcon name={theme==="dark"?"sun":"moon"}/></button>
        {onOpenActivity&&<button className={`${s.iconButton} ${c.hotelTool}`} data-kind="activity" data-tooltip="Actividad del hotel" type="button" onClick={onOpenActivity} aria-label="Abrir actividad reciente" title="Actividad del hotel"><PmsIcon name="bell"/></button>}
        {onNewQuote&&<button className={`${s.iconButton} ${c.hotelTool}`} data-kind="quote" data-tooltip="Presupuesto" type="button" onClick={onNewQuote} aria-label="Crear presupuesto" title="Crear presupuesto"><PmsIcon name="quote"/></button>}
      </div>
      {onNewReservation&&<button className={s.primaryButton} type="button" onClick={onNewReservation}>＋ Nueva reserva</button>}
    </div>
  </header>
}
