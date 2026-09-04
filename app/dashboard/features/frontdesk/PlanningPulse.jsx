"use client"

import "./planning-pulse.css"
import { activeReservation, occupancyFor, sellableRoom, usesRoom } from "./planningModel"

function uniqueReservations(reservations) {
  return [...new Map((reservations || []).filter(activeReservation).map(item => [String(item.id), item])).values()]
}

export default function PlanningPulse({ rooms = [], reservations = [], today, onToday, onFocusSearch }) {
  const sellable = rooms.filter(sellableRoom)
  const active = uniqueReservations(reservations)
  const arrivals = active.filter(item => item.fecha_entrada === today).length
  const departures = active.filter(item => item.fecha_salida === today).length
  const inHouse = active.filter(item => item.fecha_entrada <= today && item.fecha_salida > today).length
  const occupancy = occupancyFor(today, sellable, active)
  const occupiedRooms = sellable.filter(room => active.some(item => usesRoom(item, room.id) && item.fecha_entrada <= today && item.fecha_salida > today)).length
  const freeRooms = Math.max(0, sellable.length - occupiedRooms)

  return (
    <section className="hlPlanningPulse" aria-label="Resumen operativo de hoy">
      <div className="hlPlanningPulse__identity">
        <span className="hlPlanningPulse__live"><i />AHORA</span>
        <div><b>Planning operativo</b><small>Todo lo importante de hoy, sin salir del calendario.</small></div>
      </div>

      <div className="hlPlanningPulse__metrics">
        <span><small>Llegadas</small><b>{arrivals}</b></span>
        <span><small>Salidas</small><b>{departures}</b></span>
        <span><small>En casa</small><b>{inHouse}</b></span>
        <span><small>Libres</small><b>{freeRooms}</b></span>
        <span className="hlPlanningPulse__occupancy"><small>Ocupación</small><b>{occupancy.pct}%</b><i><em style={{ width: `${occupancy.pct}%` }} /></i></span>
      </div>

      <div className="hlPlanningPulse__shortcuts">
        <button type="button" onClick={onToday}><kbd>T</kbd> Hoy</button>
        <button type="button" onClick={onFocusSearch}><kbd>/</kbd> Buscar</button>
        <span><kbd>Esc</kbd> Limpiar</span>
      </div>
    </section>
  )
}
