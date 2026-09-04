import { addDays, money, shortDate } from "../../../core/formatters"
import s from "../hotelgest-planning.module.css"

export const roomIds = reservation => [
  ...new Set([
    reservation?.habitacion_id,
    ...(Array.isArray(reservation?.habitaciones_ids) ? reservation.habitaciones_ids : []),
  ].filter(Boolean).map(String)),
]

export const usesRoom = (reservation, roomId) => roomIds(reservation).includes(String(roomId))
export const activeReservation = reservation => reservation && String(reservation.estado || "").toLowerCase() !== "cancelada" && !reservation.no_show
export const overlaps = (startA, endA, startB, endB) => startA < endB && endA > startB
export const stayNights = reservation => Math.max(1, Math.round((new Date(`${reservation.fecha_salida}T12:00:00Z`) - new Date(`${reservation.fecha_entrada}T12:00:00Z`)) / 86400000))
export const compactDate = value => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`))
export const dayName = value => new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(new Date(`${value}T12:00:00`)).replace(".", "")
export const monthName = value => new Intl.DateTimeFormat("es-AR", { month: "short" }).format(new Date(`${value}T12:00:00`)).replace(".", "")

function channelColor(value) {
  const channel = String(value || "").toLowerCase()
  if (channel.includes("booking")) return "#2f58bf"
  if (channel.includes("airbnb")) return "#dc6170"
  if (channel.includes("expedia")) return "#cf991d"
  if (channel.includes("agencia")) return "#765cc2"
  if (channel.includes("motor")) return "#1f9fae"
  if (channel.includes("whatsapp")) return "#39a66b"
  return "#48a76b"
}

export function roomStateLabel(value) {
  const state = String(value || "").toLowerCase()
  if (["mantenimiento", "fuera_servicio"].includes(state)) return "Fuera de servicio"
  if (state === "sucia") return "Sucia"
  if (state === "limpia") return "Limpia"
  if (["inspeccionada", "disponible", "libre"].includes(state)) return "Lista"
  return value || "Disponible"
}

const sellableRoom = room => room?.activa !== false && !["mantenimiento", "fuera_servicio"].includes(String(room?.estado || "").toLowerCase())

function paidFor(reservation, payments) {
  return (payments || [])
    .filter(payment => String(payment.reserva_id) === String(reservation.id) && !["anulado", "cancelado", "reembolsado"].includes(String(payment.estado || "").toLowerCase()))
    .reduce((sum, payment) => sum + Number(payment.monto || 0), 0)
}

function paymentMeta(reservation, payments) {
  const total = Number(reservation.precio_total || 0)
  const paid = paidFor(reservation, payments)
  const due = Math.max(0, total - paid)
  if (total > 0 && due <= 0.01) return { due, code: "✓", label: "Pagado" }
  if (paid > 0) return { due, code: "◐", label: "Parcial" }
  return { due, code: "$", label: "Pendiente" }
}

export function occupancyFor(day, rooms, reservations) {
  const sellable = rooms.filter(sellableRoom)
  const occupied = sellable.filter(room =>
    (reservations || []).some(reservation =>
      activeReservation(reservation) &&
      usesRoom(reservation, room.id) &&
      overlaps(day, addDays(day, 1), reservation.fecha_entrada, reservation.fecha_salida)
    )
  ).length
  const capacity = sellable.length
  return { occupied, capacity, pct: capacity ? Math.round((occupied / capacity) * 100) : 0 }
}

export function validateTarget({ kind, reservation, room, day, reservations, blocks, grabOffset = 0 }) {
  if (!reservation || !room || !day) return { ok: false, reason: "Destino inválido" }
  if (roomIds(reservation).length > 1) return { ok: false, reason: "Esta reserva ocupa varias habitaciones. Movela desde la ficha grupal." }

  const roomState = String(room.estado || "").toLowerCase()
  const dayUse = String(reservation.tipo_estadia || "") === "day_use"
  if (room.activa === false) return { ok: false, reason: "La habitación está inactiva." }
  if (["mantenimiento", "fuera_servicio"].includes(roomState)) return { ok: false, reason: "La habitación está fuera de servicio." }
  if (kind === "resize" && dayUse) return { ok: false, reason: "El Day Use se modifica desde la ficha porque depende de horarios." }

  const targetStart = kind === "resize" ? reservation.fecha_entrada : addDays(day, -Math.max(0, grabOffset || 0))
  const targetEnd = kind === "resize" ? addDays(day, 1) : (dayUse ? targetStart : addDays(targetStart, stayNights(reservation)))
  const intervalEnd = dayUse ? addDays(targetStart, 1) : targetEnd

  if (!dayUse && targetEnd <= targetStart) return { ok: false, reason: "La salida tiene que quedar después de la entrada." }

  const blocked = (blocks || []).find(block =>
    String(block.habitacion_id) === String(room.id) && overlaps(targetStart, intervalEnd, block.fecha_desde, block.fecha_hasta)
  )
  if (blocked) return { ok: false, reason: `Bloqueada: ${blocked.motivo || blocked.detalle || "bloqueo operativo"}` }

  const conflict = (reservations || []).find(other =>
    activeReservation(other) &&
    String(other.id) !== String(reservation.id) &&
    usesRoom(other, room.id) &&
    overlaps(targetStart, intervalEnd, other.fecha_entrada, other.fecha_salida)
  )
  if (conflict) return { ok: false, reason: `Ocupada por ${conflict.nombre_huesped || "otra reserva"} (${compactDate(conflict.fecha_entrada)}–${compactDate(conflict.fecha_salida)})` }

  return {
    ok: true,
    targetStart,
    targetEnd,
    reason: kind === "resize" ? `Nueva salida ${compactDate(targetEnd)}` : `Mover a ${room.nombre} · ${compactDate(targetStart)}`,
  }
}

export function rangeAvailable({ roomId, start, end, reservations, blocks }) {
  const blocked = (blocks || []).find(block => String(block.habitacion_id) === String(roomId) && overlaps(start, end, block.fecha_desde, block.fecha_hasta))
  if (blocked) return { ok: false, reason: `Bloqueada: ${blocked.motivo || blocked.detalle || "bloqueo operativo"}` }

  const conflict = (reservations || []).find(reservation => activeReservation(reservation) && usesRoom(reservation, roomId) && overlaps(start, end, reservation.fecha_entrada, reservation.fecha_salida))
  if (conflict) return { ok: false, reason: `Ocupada por ${conflict.nombre_huesped || "otra reserva"}` }
  return { ok: true, reason: "Disponible" }
}

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
