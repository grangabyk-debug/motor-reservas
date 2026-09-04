"use client"

import { ROLE_LABELS } from "../../core/permissions"
import HotelIcon from "./HotelIcon"
import ui from "./shell.module.css"

const PRIMARY = [
  ["lobby", "Inicio"],
  ["calendar", "Planning"],
  ["reservations", "Reservas"],
  ["guests", "Huéspedes"],
  ["messages", "Mensajes"],
]

const OPERATIONS = [
  ["housekeeping", "Limpieza"],
  ["rooms", "Habitaciones"],
  ["maintenance", "Actividad"],
  ["keys", "Puertas"],
]

const MANAGEMENT = [
  ["rates", "Tarifas"],
  ["reports", "Informes"],
  ["cash", "Caja & Folios"],
  ["partners", "Empresas & Agencias"],
  ["distribution", "Distribución"],
  ["team", "Equipo & Roles"],
  ["settings", "Configuración"],
]

function initials(name = "Hotel") {
  return String(name)
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "HL"
}

function NavItem({ id, label, view, onView }) {
  const active = view === id
  return (
    <button
      type="button"
      className={`${ui.navItem} ${active ? ui.navActive : ""}`}
      onClick={() => onView(id)}
      aria-current={active ? "page" : undefined}
    >
      <span className={ui.navIcon}><HotelIcon name={id} /></span>
      <span className={ui.navLabel}>{label}</span>
      {id === "calendar" && <span className={ui.planningPulse} aria-hidden="true" />}
    </button>
  )
}

function Group({ title, items, view, onView }) {
  return (
    <section className={ui.navSection} aria-label={title}>
      <div className={ui.groupTitle}>{title}</div>
      <div className={ui.navGroup}>
        {items.map(([id, label]) => (
          <NavItem key={id} id={id} label={label} view={view} onView={onView} />
        ))}
      </div>
    </section>
  )
}

export default function HotelSidebar({
  view,
  onView,
  hotelName = "Hotel",
  hotelLogo = "",
  role = "reception",
  properties = [],
  propertyId,
  onPropertyChange,
  onLogout,
  onNewReservation,
  mobileOpen = false,
}) {
  return (
    <aside className={`${ui.rail} ${mobileOpen ? ui.railOpen : ""}`} aria-label="Navegación principal">
      <div className={ui.ambientGlow} aria-hidden="true" />

      <div className={ui.identity}>
        <button type="button" className={ui.brand} onClick={() => onView("lobby")}>
          <span className={ui.brandMark}>
            {hotelLogo ? <img src={hotelLogo} alt="" /> : <span>{initials(hotelName)}</span>}
          </span>
          <span className={ui.brandCopy}>
            <b>{hotelName}</b>
            <small>Habitación Llena</small>
          </span>
        </button>

        <div className={ui.propertyCard}>
          <span className={ui.propertyEyebrow}>Propiedad activa</span>
          {properties.length > 1 ? (
            <select className={ui.propertySelect} value={propertyId} onChange={event => onPropertyChange?.(event.target.value)}>
              {properties.map(property => (
                <option value={property.id} key={property.id}>{property.hotel_name || property.name}</option>
              ))}
            </select>
          ) : (
            <strong className={ui.propertyName}>{hotelName}</strong>
          )}
        </div>
      </div>

      <nav className={ui.navScroll}>
        <div className={ui.reservationCtaWrap}>
          <button type="button" className={ui.reservationCta} onClick={onNewReservation} disabled={!onNewReservation}>
            <span className={ui.reservationCtaIcon}>＋</span>
            <span><b>Nueva reserva</b><small>Crear desde cualquier pantalla</small></span>
          </button>
        </div>

        <Group title="Recepción" items={PRIMARY} view={view} onView={onView} />
        <Group title="Operación" items={OPERATIONS} view={view} onView={onView} />
        <Group title="Gestión" items={MANAGEMENT} view={view} onView={onView} />
      </nav>

      <footer className={ui.sideFooter}>
        <div className={ui.operatorCard}>
          <span className={ui.footerMark}>HL</span>
          <span className={ui.operatorCopy}>
            <b>{ROLE_LABELS[role] || role}</b>
            <small>Sesión operativa</small>
          </span>
        </div>
        <button type="button" className={ui.logout} onClick={onLogout}>Salir</button>
      </footer>
    </aside>
  )
}
