"use client"

import { useEffect, useState } from "react"
import ui from "./shell.module.css"

function LiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  const date = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "2-digit", month: "short" })
    .format(now)
    .replace(/\./g, "")
  const time = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(now)

  return (
    <div className={ui.clock} aria-label={`${date}, ${time}`}>
      <span>{date}</span>
      <b>{time}</b>
    </div>
  )
}

export default function HotelTopbar({
  title = "",
  onNewReservation,
  onMenu,
  onCommand,
  onSupport,
  onSettings,
  onNotifications,
  notificationCount = 0,
}) {
  return (
    <header className={ui.topbar}>
      <button className={ui.menu} type="button" onClick={onMenu} aria-label="Abrir menú">☰</button>
      <div className={ui.actions}>
        <div className={ui.historyButtons}>
          <button type="button" onClick={() => history.back()} aria-label="Atrás">‹</button>
          <button type="button" onClick={() => history.forward()} aria-label="Adelante">›</button>
        </div>

        {title && <div className={ui.viewTitle}><small>Habitación Llena</small><b>{title}</b></div>}

        <button type="button" className={ui.search} onClick={onCommand} aria-label="Buscar en Habitación Llena">
          <span>⌕</span>
          <span className={ui.searchText}>Buscar huésped, reserva o habitación…</span>
          <kbd>Ctrl K</kbd>
        </button>

        <LiveClock />

        <button type="button" className={`${ui.topIcon} ${ui.notificationButton}`} onClick={onNotifications} aria-label={`${notificationCount} notificaciones pendientes`}>
          <span>♢</span>
          {notificationCount > 0 && <b>{notificationCount > 99 ? "99+" : notificationCount}</b>}
        </button>
        <button type="button" className={ui.topIcon} onClick={onSupport} aria-label="Ayuda">?</button>
        <button type="button" className={ui.topIcon} onClick={onSettings} aria-label="Configuración">⚙</button>
        {onNewReservation && <button className={ui.primary} type="button" onClick={onNewReservation}>＋ Reserva</button>}
      </div>
    </header>
  )
}
