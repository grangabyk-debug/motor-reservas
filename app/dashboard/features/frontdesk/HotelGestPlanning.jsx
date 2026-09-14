"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDays, isoDate, money, shortDate } from "../../core/formatters"
import s from "./hotelgest-planning.module.css"

const roomIds = reservation => [
  ...new Set([
    reservation?.habitacion_id,
    ...(Array.isArray(reservation?.habitaciones_ids) ? reservation.habitaciones_ids : []),
  ].filter(Boolean).map(String)),
]

const usesRoom = (reservation, roomId) => roomIds(reservation).includes(String(roomId))
const activeReservation = reservation => reservation && String(reservation.estado || "").toLowerCase() !== "cancelada" && !reservation.no_show
const overlaps = (startA, endA, startB, endB) => startA < endB && endA > startB
const stayNights = reservation => Math.max(1, Math.round((new Date(`${reservation.fecha_salida}T12:00:00Z`) - new Date(`${reservation.fecha_entrada}T12:00:00Z`)) / 86400000))
const compactDate = value => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`))
const dayName = value => new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(new Date(`${value}T12:00:00`)).replace(".", "")
const monthName = value => new Intl.DateTimeFormat("es-AR", { month: "short" }).format(new Date(`${value}T12:00:00`)).replace(".", "")

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

function roomStateLabel(value) {
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

function occupancyFor(day, rooms, reservations) {
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

function validateTarget({ kind, reservation, room, day, reservations, blocks, grabOffset = 0 }) {
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

function rangeAvailable({ roomId, start, end, reservations, blocks }) {
  const blocked = (blocks || []).find(block => String(block.habitacion_id) === String(roomId) && overlaps(start, end, block.fecha_desde, block.fecha_hasta))
  if (blocked) return { ok: false, reason: `Bloqueada: ${blocked.motivo || blocked.detalle || "bloqueo operativo"}` }

  const conflict = (reservations || []).find(reservation => activeReservation(reservation) && usesRoom(reservation, roomId) && overlaps(start, end, reservation.fecha_entrada, reservation.fecha_salida))
  if (conflict) return { ok: false, reason: `Ocupada por ${conflict.nombre_huesped || "otra reserva"}` }
  return { ok: true, reason: "Disponible" }
}

function OccupancyRow({ label, rooms, reservations, days, grid, total = false }) {
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

function ReservationBlock({ reservation, days, payments, selected, onSelect, onDragStart, onResizeStart, onDragEnd }) {
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

function Inspector({ reservation, room, payments, onClose, onOpen, onMoveMode }) {
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

function RangeBar({ selection, rooms, onClose, onReservation, onTentative, onBlock }) {
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

export default function HotelGestPlanning({
  rooms = [], reservations = [], payments = [], blocks = [], floors = [],
  onMove, onResize, onOpen, onNew, onNewRange, onBlockRange, onBlock,
}) {
  const today = isoDate()
  const [start, setStart] = useState(today)
  const [count, setCount] = useState(21)
  const [query, setQuery] = useState("")
  const [type, setType] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [drag, setDrag] = useState(null)
  const [hover, setHover] = useState(null)
  const [notice, setNotice] = useState(null)
  const [moveMode, setMoveMode] = useState("")
  const [range, setRange] = useState(null)
  const [selecting, setSelecting] = useState(null)
  const pointerDown = useRef(false)

  const days = useMemo(() => Array.from({ length: count }, (_, index) => addDays(start, index)), [start, count])
  const activeRooms = useMemo(() => rooms.filter(room => room.activa !== false), [rooms])
  const types = useMemo(() => [...new Set(activeRooms.map(room => room.tipo || "Habitación"))].sort(), [activeRooms])
  const filteredRooms = useMemo(() => {
    const term = query.trim().toLowerCase()
    return activeRooms.filter(room => {
      if (type && String(room.tipo || "Habitación") !== type) return false
      if (!term) return true
      const reservationMatch = reservations.filter(reservation => usesRoom(reservation, room.id)).some(reservation =>
        `${reservation.nombre_huesped || ""} ${reservation.numero_reserva || ""} ${reservation.canal_reserva || ""}`.toLowerCase().includes(term)
      )
      return `${room.nombre || ""} ${room.tipo || ""}`.toLowerCase().includes(term) || reservationMatch
    })
  }, [activeRooms, type, query, reservations])

  const grouped = useMemo(() => {
    const map = new Map()
    filteredRooms.forEach(room => {
      const key = room.tipo || "Habitación"
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(room)
    })
    return [...map.entries()]
  }, [filteredRooms])

  const selected = reservations.find(reservation => String(reservation.id) === String(selectedId)) || null
  const selectedRoom = selected ? activeRooms.find(room => String(room.id) === String(selected.habitacion_id)) : null
  const grid = { gridTemplateColumns: `repeat(${count},minmax(47px,1fr))` }

  useEffect(() => {
    const finish = () => {
      pointerDown.current = false
      if (selecting) finishSelection(selecting)
    }
    window.addEventListener("mouseup", finish)
    return () => window.removeEventListener("mouseup", finish)
  }, [selecting])

  function flash(kind, text) {
    setNotice({ kind, text })
    window.setTimeout(() => setNotice(null), 3600)
  }

  function beginMove(event, reservation) {
    const rect = event.currentTarget.getBoundingClientRect()
    const nights = stayNights(reservation)
    const unit = Math.max(1, rect.width / nights)
    const grabOffset = Math.max(0, Math.min(nights - 1, Math.floor((event.clientX - rect.left) / unit)))
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", String(reservation.id))
    setRange(null)
    setDrag({ kind: "move", reservation, grabOffset })
    setHover(null)
  }

  function beginResize(event, reservation) {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", String(reservation.id))
    setRange(null)
    setDrag({ kind: "resize", reservation, grabOffset: 0 })
    setHover(null)
  }

  function targetFor(room, day) {
    return validateTarget({
      kind: drag?.kind,
      reservation: drag?.reservation,
      room,
      day,
      reservations,
      blocks,
      grabOffset: drag?.grabOffset || 0,
    })
  }

  function endDrag() {
    if (hover && !hover.ok) flash("error", hover.reason)
    setDrag(null)
    setHover(null)
  }

  async function dropTarget(event, room, day) {
    if (!drag) return
    const current = drag
    const result = targetFor(room, day)
    setHover(null)
    if (!result.ok) {
      flash("error", result.reason)
      setDrag(null)
      return
    }
    event.preventDefault()
    const saved = current.kind === "resize"
      ? await onResize?.(current.reservation.id, result.targetEnd)
      : await onMove?.(current.reservation.id, room.id, result.targetStart)
    if (saved) flash("success", current.kind === "resize" ? `Salida actualizada al ${compactDate(result.targetEnd)}.` : `${current.reservation.nombre_huesped || "Reserva"} movida a ${room.nombre} · ${compactDate(result.targetStart)}.`)
    setDrag(null)
  }

  async function tapMoveTarget(room, day) {
    if (!moveMode) return
    const reservation = reservations.find(item => String(item.id) === String(moveMode))
    if (!reservation) return
    const result = validateTarget({ kind: "move", reservation, room, day, reservations, blocks })
    if (!result.ok) return flash("error", result.reason)
    const saved = await onMove?.(reservation.id, room.id, result.targetStart)
    if (saved) {
      setMoveMode("")
      flash("success", `${reservation.nombre_huesped || "Reserva"} movida a ${room.nombre}.`)
    }
  }

  function beginSelection(room, day, event) {
    if (event.button !== 0 || drag || moveMode) return
    const availability = rangeAvailable({ roomId: room.id, start: day, end: addDays(day, 1), reservations, blocks })
    if (!availability.ok) return
    pointerDown.current = true
    setSelectedId("")
    setRange(null)
    setSelecting({ anchorRoomId: String(room.id), roomIds: [String(room.id)], start: day, end: addDays(day, 1), lastDay: day })
  }

  function extendSelection(room, day) {
    if (!pointerDown.current || !selecting || String(room.id) !== selecting.anchorRoomId) return
    const from = day < selecting.start ? day : selecting.start
    const to = day < selecting.start ? addDays(selecting.start, 1) : addDays(day, 1)
    setSelecting({ ...selecting, start: from, end: to, lastDay: day })
  }

  function finishSelection(selection) {
    if (!selection) return
    const check = rangeAvailable({ roomId: selection.anchorRoomId, start: selection.start, end: selection.end, reservations, blocks })
    if (!check.ok) {
      flash("error", check.reason)
      setSelecting(null)
      return
    }
    setRange({ roomIds: [selection.anchorRoomId], start: selection.start, end: selection.end })
    setSelecting(null)
  }

  function toggleSelectionRoom(roomId) {
    if (!range) return
    const id = String(roomId)
    const selectedAlready = range.roomIds.includes(id)
    if (selectedAlready && range.roomIds.length === 1) return
    const check = rangeAvailable({ roomId: id, start: range.start, end: range.end, reservations, blocks })
    if (!selectedAlready && !check.ok) return flash("error", check.reason)
    setRange({ ...range, roomIds: selectedAlready ? range.roomIds.filter(item => item !== id) : [...range.roomIds, id] })
  }

  function isRangeCell(roomId, day) {
    const source = selecting || range
    return Boolean(source && source.roomIds.includes(String(roomId)) && day >= source.start && day < source.end)
  }

  return (
    <section className={s.page}>
      <header className={s.toolbar}>
        <div className={s.navDate}>
          <button type="button" onClick={() => setStart(addDays(start, -7))}>‹</button>
          <button type="button" className={s.today} onClick={() => setStart(today)}>Hoy</button>
          <button type="button" onClick={() => setStart(addDays(start, 7))}>›</button>
          <b>{compactDate(days[0])} — {compactDate(days.at(-1))}</b>
        </div>
        <div className={s.filters}>
          <label>⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Huésped, reserva o habitación" /></label>
          <select value={type} onChange={event => setType(event.target.value)}>
            <option value="">Todas las tipologías</option>
            {types.map(item => <option key={item}>{item}</option>)}
          </select>
          <div className={s.rangeSwitch}>
            <button className={count === 7 ? s.active : ""} onClick={() => setCount(7)}>7d</button>
            <button className={count === 21 ? s.active : ""} onClick={() => setCount(21)}>21d</button>
            <button className={count === 30 ? s.active : ""} onClick={() => setCount(30)}>30d</button>
          </div>
        </div>
      </header>

      {notice && <div className={`${s.notice} ${notice.kind === "error" ? s.noticeError : s.noticeSuccess}`}>{notice.kind === "error" ? "⛔" : "✓"} {notice.text}</div>}
      {moveMode && <div className={s.moveBanner}>Mover <b>{reservations.find(item => String(item.id) === String(moveMode))?.nombre_huesped || "reserva"}</b>: tocá una celda disponible.<button onClick={() => setMoveMode("")}>Cancelar</button></div>}

      <RangeBar
        selection={range}
        rooms={activeRooms}
        onClose={() => setRange(null)}
        onReservation={() => onNewRange?.({ ...range, tentative: false })}
        onTentative={() => onNewRange?.({ ...range, tentative: true })}
        onBlock={async () => {
          const ok = await onBlockRange?.({ roomIds: range.roomIds, start: range.start, end: range.end, reason: "Bloqueo operativo", detail: "Creado desde selección del Planning" })
          if (ok) setRange(null)
        }}
      />

      <div className={s.calendar}>
        <div className={s.head}>
          <div className={s.roomHead}>Tipología / habitación</div>
          <div className={s.days} style={grid}>
            {days.map(day => <div key={day} className={day === today ? s.todayHead : ""}><small>{dayName(day)}</small><b>{new Date(`${day}T12:00:00`).getDate()}</b><em>{monthName(day)}</em></div>)}
          </div>
        </div>

        <OccupancyRow total label="Ocup. total" rooms={activeRooms} reservations={reservations} days={days} grid={grid} />

        {grouped.map(([group, groupRooms]) => (
          <section className={s.group} key={group}>
            <div className={s.groupTitle}><b>{group}</b><small>{groupRooms.length} habitaciones</small><em>{occupancyFor(today, groupRooms, reservations).pct}% hoy</em></div>
            <OccupancyRow label="Ocupación" rooms={groupRooms} reservations={reservations} days={days} grid={grid} />

            {groupRooms.map(room => {
              const roomReservations = reservations.filter(reservation => activeReservation(reservation) && usesRoom(reservation, room.id))
              const canJoin = range && !range.roomIds.includes(String(room.id)) && rangeAvailable({ roomId: room.id, start: range.start, end: range.end, reservations, blocks }).ok

              return (
                <div className={s.row} key={room.id}>
                  <button type="button" className={`${s.room} ${range?.roomIds.includes(String(room.id)) ? s.roomSelected : ""}`} onClick={() => range ? toggleSelectionRoom(room.id) : onNew?.(room, today)}>
                    <span><b>{room.nombre}</b><small>{room.tipo || "Habitación"}</small></span>
                    <em>{range ? (range.roomIds.includes(String(room.id)) ? "✓" : canJoin ? "＋" : "×") : roomStateLabel(room.estado)}</em>
                  </button>

                  <div className={s.dayGrid} style={grid}>
                    {days.map(day => {
                      const blocked = (blocks || []).some(block => String(block.habitacion_id) === String(room.id) && overlaps(day, addDays(day, 1), block.fecha_desde, block.fecha_hasta))
                      const hovered = hover && hover.roomId === String(room.id) && hover.day === day
                      const chosen = isRangeCell(room.id, day)
                      return (
                        <div
                          key={day}
                          data-date={day}
                          className={`${s.cell} ${day === today ? s.todayCell : ""} ${blocked ? s.blocked : ""} ${chosen ? s.rangeCell : ""} ${hovered ? (hover.ok ? s.validTarget : s.invalidTarget) : ""}`}
                          onDoubleClick={() => !moveMode && !blocked && !range && onNew?.(room, day)}
                          onContextMenu={event => { event.preventDefault(); if (!moveMode && !range) onBlock?.(room, day) }}
                          onClick={() => tapMoveTarget(room, day)}
                          onPointerUp={event => {
                            if (event.pointerType !== "mouse" && !moveMode && !blocked && !drag) {
                              setSelectedId("")
                              setRange({ roomIds: [String(room.id)], start: day, end: addDays(day, 1) })
                            }
                          }}
                          onMouseDown={event => beginSelection(room, day, event)}
                          onMouseEnter={() => extendSelection(room, day)}
                          onDragEnter={() => { if (drag) setHover({ roomId: String(room.id), day, ...targetFor(room, day) }) }}
                          onDragOver={event => {
                            if (!drag) return
                            const result = targetFor(room, day)
                            if (result.ok) { event.preventDefault(); event.dataTransfer.dropEffect = "move" }
                            else event.dataTransfer.dropEffect = "none"
                          }}
                          onDrop={event => dropTarget(event, room, day)}
                        >
                          {hovered && <span className={s.dropHint}>{hover.reason}</span>}
                        </div>
                      )
                    })}

                    {roomReservations.map(reservation => (
                      <ReservationBlock
                        key={`${reservation.id}-${room.id}`}
                        reservation={reservation}
                        days={days}
                        payments={payments}
                        selected={String(reservation.id) === String(selectedId)}
                        onSelect={item => { setRange(null); setSelectedId(String(item.id)) }}
                        onDragStart={beginMove}
                        onResizeStart={beginResize}
                        onDragEnd={endDrag}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        ))}
      </div>

      <Inspector
        reservation={selected}
        room={selectedRoom}
        payments={payments}
        onClose={() => setSelectedId("")}
        onOpen={() => onOpen?.(selected)}
        onMoveMode={() => { setMoveMode(String(selected.id)); setSelectedId("") }}
      />
    </section>
  )
}
