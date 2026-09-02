"use client"

import { VIEW_META } from "../../core/navigation"
import ui from "./shell.module.css"
import polish from "./shell-polish.module.css"

export default function HotelTopbar({view,title,onNewReservation,onMenu,onCommand}){
  const meta=VIEW_META[view],display=view==="integrations"?"Channel":title||meta?.label||"Hotel"
  return <header className={`${ui.topbar} ${polish.topbarPremium} hlAppTopbar`}>
    <button className={ui.menu} onClick={onMenu} aria-label="Abrir menú">☰</button>
    <div className="hlAppTitle" title={display}>{display}</div>
    <div className={ui.actions}>
      <button type="button" onClick={onCommand} aria-label="Buscar en Habitación Llena" title="Buscar" className="hlAppSearch">⌕</button>
      {onNewReservation&&<button className={`${ui.primary} hlAppReservation`} onClick={onNewReservation}>＋ Reserva</button>}
    </div>
  </header>
}
