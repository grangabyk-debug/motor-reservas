"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDays, isoDate } from "../../core/formatters"
import s from "./hotelgest-planning.module.css"
import { Inspector, OccupancyRow, RangeBar, ReservationBlock } from "./PlanningPresentation"
import {
  activeReservation,
  compactDate,
  dayName,
  monthName,
  occupancyFor,
  overlaps,
  rangeAvailable,
  roomStateLabel,
  stayNights,
  usesRoom,
  validateTarget,
} from "./planningModel"

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
