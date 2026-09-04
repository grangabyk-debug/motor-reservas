"use client"

import { addDays, money, shortDate } from "../../core/formatters"
import s from "./hotelgest-planning.module.css"
import { channelColor, occupancyFor, paidFor, paymentMeta, sellableRoom, compactDate } from "./planningModel"

export function OccupancyRow({ label, rooms, reservations, days, grid, total = false }) {
  return (
    <div className={s.occupancyRow}>
      <div className={s.occupancyLabel}>{total && <span>{rooms.filter(sellableRoom).length}</span>}{label}</div>
      <div className={s.occupancyGrid} style={grid}>
        {days.map(day => {
          const occupancy = occupancyFor(day, rooms, reservations)
          return (
            <div key={day} data-hot={occupancy.pct >= 85 || undefined} data-mid={(occupancy.pct >= 65 && occupancy.pct < 85) || undefined} title={`${occupancy.occupied}/${occupancy.capacity} habitaciones ocupadas`}>
              <b>{occupancy.pct}%</b>
              <small>{occupancy.occupied}/{occupancy.capacity}</small>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ReservationBlock({ reservation, days, payments, selected, onSelect, onDragStart, onResizeStart, onDragEnd }) {
  const windowStart = days[0]
  const windowEnd = addDays(days.at(-1), 1)
  if (reservation.fecha_salida <= windowStart || reservation.fecha_entrada >= windowEnd) return null

  const startIndex = Math.max(0, days.findIndex(day => day >= reservation.fecha_entrada))
  const rawEnd = days.findIndex(day => day >= reservation.fecha_salida)
  const endIndex = rawEnd < 0 ? days.length : Math.max(startIndex + 1, rawEnd)
  const payment = paymentMeta(reservation, payments)

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={event => onDragStart(event, reservation)}
      onDragEnd={onDragEnd}
      onClick={event => { event.stopPropagation(); onSelect(reservation) }}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect(reservation)
        }
      }}
      data-state={String(reservation.estado || "").toLowerCase()}
      className={`${s.stay} ${selected ? s.staySelected : ""}`}
      style={{ gridColumn: `${startIndex + 1}/${Math.max(startIndex + 2, endIndex + 1)}`, "--channel": channelColor(reservation.canal_reserva) }}
      title={`${reservation.nombre_huesped || "Reserva"} · ${shortDate(reservation.fecha_entrada)} → ${shortDate(reservation.fecha_salida)} · ${payment.label}`}
    >
      <span>
        <b>{reservation.nombre_huesped || "Reserva"}</b>
        <small>{reservation.canal_reserva || "Directa"} · {payment.label}</small>
      </span>
      <em title={payment.label}>{payment.code}</em>
      <i
        draggable
        onMouseDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
        onDragStart={event => onResizeStart(event, reservation)}
        onDragEnd={onDragEnd}
        title="Arrastrar para cambiar la salida"
        aria-label="Cambiar fecha de salida"
      />
    </div>
  )
}

export function Inspector({ reservation, room, payments, onClose, onOpen, onMoveMode }) {
  if (!reservation) return null
  const paid = paidFor(reservation, payments)
  const due = Math.max(0, Number(reservation.precio_total || 0) - paid)
  const phone = String(reservation.telefono_huesped || "").replace(/\D/g, "")

  return (
    <aside className={s.inspector}>
      <header>
        <div>
          <small>RESERVA {reservation.numero_reserva || reservation.id}</small>
          <h3>{reservation.nombre_huesped || "Sin titular"}</h3>
          <p>{room?.nombre || "Sin habitación"} · {reservation.canal_reserva || "Directa"}</p>
        </div>
        <button type="button" onClick={onClose}>×</button>
      </header>
      <div className={s.inspectorInfo}>
        <span><small>Entrada</small><b>{shortDate(reservation.fecha_entrada)}</b></span>
        <span><small>Salida</small><b>{shortDate(reservation.fecha_salida)}</b></span>
        <span><small>Pagado</small><b>{money(paid, reservation.moneda || "ARS")}</b></span>
        <span><small>Pendiente</small><b className={due > 0 ? s.due : ""}>{money(due, reservation.moneda || "ARS")}</b></span>
      </div>
      <div className={s.inspectorActions}>
        <button type="button" className={s.primaryAction} onClick={onOpen}>Ver reserva</button>
        <button type="button" onClick={onMoveMode}>Mover</button>
        {phone && <button type="button" onClick={() => window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer")}>WhatsApp</button>}
      </div>
    </aside>
  )
}

export function RangeBar({ selection, rooms, onClose, onReservation, onTentative, onBlock }) {
  if (!selection) return null
  const names = selection.roomIds.map(id => rooms.find(room => String(room.id) === String(id))?.nombre).filter(Boolean)
  return (
    <div className={s.rangeBar}>
      <div><small>SELECCIÓN</small><b>{compactDate(selection.start)} → {compactDate(selection.end)} · {names.join(", ")}</b></div>
      <div>
        <button onClick={onReservation} className={s.rangePrimary}>Crear reserva</button>
        <button onClick={onTentative}>Tentativa</button>
        <button onClick={onBlock}>Bloquear</button>
        <button onClick={onClose}>×</button>
      </div>
    </div>
  )
}
