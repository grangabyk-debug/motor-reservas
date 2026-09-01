"use client"

import { VIEW_META,groupForView } from "../../core/navigation"
import ui from "./shell.module.css"
import polish from "./shell-polish.module.css"

export default function HotelTopbar({view,title,search,onSearch,onNewReservation,onMenu,onCommand}){
  const meta=VIEW_META[view],support=view==="support",group=support?null:groupForView(view),display=title||meta?.label||"Hotel"
  return <header className={`${ui.topbar} ${polish.topbarPremium}`}><button className={ui.menu} onClick={onMenu}>☰</button><div className={ui.heading}><small>{support?"AYUDA & SOPORTE":group?.label?.toUpperCase()||"HOTEL"}</small><h1 title={display}>{display}</h1></div><div className={ui.actions}><button type="button" className={ui.search} onClick={onCommand} aria-label="Abrir búsqueda global"><span>⌕</span><input readOnly value={search||""} placeholder="Buscar en todo Habitación Llena…" tabIndex={-1}/><kbd>⌘K</kbd></button>{onNewReservation&&<button className={ui.primary} onClick={onNewReservation}>＋ Nueva reserva</button>}</div></header>
}
