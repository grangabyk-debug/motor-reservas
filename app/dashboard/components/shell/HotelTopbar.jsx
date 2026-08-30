"use client"

import { VIEW_META } from "../../core/navigation"
import ui from "./shell.module.css"

export default function HotelTopbar({view,title,search,onSearch,onNewReservation,onMenu}){
  const meta=VIEW_META[view]
  return <header className={ui.topbar}><button className={ui.menu} onClick={onMenu}>☰</button><div className={ui.heading}><small>{meta?.label?.toUpperCase()||"HOTEL"}</small><h1>{title}</h1></div><div className={ui.actions}><label className={ui.search}><span>⌕</span><input value={search||""} onChange={e=>onSearch?.(e.target.value)} placeholder="Huésped, reserva, habitación…"/></label>{onNewReservation&&<button className={ui.primary} onClick={onNewReservation}>＋ Nueva reserva</button>}</div></header>
}
