"use client"

import ui from"./shell.module.css"

export default function HotelTopbar({onNewReservation,onMenu,onCommand,onSupport,onSettings}){
  return <header className={ui.topbar}>
    <button className={ui.menu} type="button" onClick={onMenu} aria-label="Abrir menú">☰</button>
    <div className={ui.actions}>
      <div className={ui.historyButtons}><button type="button" onClick={()=>history.back()} aria-label="Atrás">‹</button><button type="button" onClick={()=>history.forward()} aria-label="Adelante">›</button></div>
      <button type="button" className={ui.search} onClick={onCommand} aria-label="Buscar en Habitación Llena"><span>⌕</span><span className={ui.searchText}>Buscar...</span><kbd>Ctrl K</kbd></button>
      <button type="button" className={ui.topIcon} onClick={onSupport} aria-label="Ayuda">?</button>
      <button type="button" className={ui.topIcon} onClick={onSettings} aria-label="Configuración">⚙</button>
      {onNewReservation&&<button className={ui.primary} type="button" onClick={onNewReservation}>＋ Reserva</button>}
    </div>
  </header>
}
