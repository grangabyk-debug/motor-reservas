"use client"

import ui from"./shell.module.css"

export default function HotelTopbar({onNewReservation,onMenu,onCommand,onSupport,onSettings,onNotifications,notificationCount=0}){
  return <header className={ui.topbar}>
    <button className={ui.menu} type="button" onClick={onMenu} aria-label="Abrir menú">☰</button>
    <div className={ui.actions}>
      <div className={ui.historyButtons}><button type="button" onClick={()=>history.back()} aria-label="Atrás">‹</button><button type="button" onClick={()=>history.forward()} aria-label="Adelante">›</button></div>
      <button type="button" className={ui.search} onClick={onCommand} aria-label="Buscar en Habitación Llena"><span>⌕</span><span className={ui.searchText}>Buscar huésped, reserva o habitación…</span><kbd>Ctrl K</kbd></button>
      <button type="button" className={`${ui.topIcon} ${ui.notificationButton}`} onClick={onNotifications} aria-label={`${notificationCount} notificaciones pendientes`}><span>♢</span>{notificationCount>0&&<b>{notificationCount>99?"99+":notificationCount}</b>}</button>
      <button type="button" className={ui.topIcon} onClick={onSupport} aria-label="Ayuda">?</button>
      <button type="button" className={ui.topIcon} onClick={onSettings} aria-label="Configuración">⚙</button>
      {onNewReservation&&<button className={ui.primary} type="button" onClick={onNewReservation}>＋ Reserva</button>}
    </div>
  </header>
}
