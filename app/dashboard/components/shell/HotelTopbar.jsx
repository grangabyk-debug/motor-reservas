"use client"

import { VIEW_META,groupForView } from "../../core/navigation"
import ui from "./shell.module.css"
import polish from "./shell-polish.module.css"

export default function HotelTopbar({view,title,onNewReservation,onMenu,onCommand}){
  const meta=VIEW_META[view],support=view==="support",group=support?null:groupForView(view),display=view==="integrations"?"Channel":title||meta?.label||"Hotel"
  if(view==="calendar")return <header className={`${ui.topbar} ${polish.topbarPremium}`} style={{minHeight:38,height:38,padding:"3px 10px",gap:8}}><button className={ui.menu} onClick={onMenu} style={{height:32}}>☰</button><div style={{fontSize:13,fontWeight:850,color:"#27364d",letterSpacing:"-.01em",whiteSpace:"nowrap"}}>Planning</div><div className={ui.actions}><button type="button" onClick={onCommand} aria-label="Buscar en Habitación Llena" title="Buscar" style={{width:32,height:32,padding:0,border:"1px solid #dfe6ef",borderRadius:8,background:"#fff",color:"#53627a",fontSize:15,cursor:"pointer"}}>⌕</button>{onNewReservation&&<button className={ui.primary} onClick={onNewReservation} style={{height:32,padding:"0 11px",borderRadius:8,fontSize:10}}>＋ Reserva</button>}</div></header>
  return <header className={`${ui.topbar} ${polish.topbarPremium}`}><button className={ui.menu} onClick={onMenu}>☰</button><div className={ui.heading}><small>{support?"AYUDA & SOPORTE":group?.label?.toUpperCase()||"HOTEL"}</small><h1 title={display}>{display}</h1></div><div className={ui.actions}><div className={ui.search} role="button" tabIndex={0} onClick={onCommand} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&onCommand?.()} aria-label="Abrir búsqueda global"><span>⌕</span><input readOnly value="" placeholder="Buscar en todo Habitación Llena…" tabIndex={-1}/><kbd>⌘K</kbd></div>{onNewReservation&&<button className={ui.primary} onClick={onNewReservation}>＋ Nueva reserva</button>}</div></header>
}
