"use client"

import { useMemo, useState } from "react"
import { isoDate, money } from "../../core/formatters"
import s from "./analytics-overview.module.css"

const DAY = 86400000
const asDate = value => new Date(`${value}T12:00:00Z`)
const iso = date => date.toISOString().slice(0, 10)
const shift = (value, days) => { const d = asDate(value); d.setUTCDate(d.getUTCDate() + days); return iso(d) }
const diff = (start, end) => Math.max(0, Math.round((asDate(end) - asDate(start)) / DAY))
const overlap = (r, start, end) => String(r.fecha_entrada || "") < end && String(r.fecha_salida || "") > start
const status = r => String(r.estado || "").toLowerCase()
const cancelled = r => status(r) === "cancelada" || Boolean(r.no_show)
const safeArray = value => { if (Array.isArray(value)) return value; try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : [] } catch { return [] } }
const roomIds = r => [...new Set([r.habitacion_id, ...(Array.isArray(r.habitaciones_ids) ? r.habitaciones_ids : [])].map(String).filter(Boolean))]
const sellable = room => room?.activa !== false && !["fuera_de_servicio", "out_of_service"].includes(String(room?.estado || "").toLowerCase())

function rangeFor(key) {
  const today = isoDate()
  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7))
  if (key === "today") return { start: today, end: shift(today, 1), label: "Hoy" }
  if (key === "7d") return { start: shift(today, -6), end: shift(today, 1), label: "Últimos 7 días" }
  if (key === "30d") return { start: shift(today, -29), end: shift(today, 1), label: "Últimos 30 días" }
  if (key === "year") return { start: `${year}-01-01`, end: `${year + 1}-01-01`, label: `Año ${year}` }
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`
  return { start: `${year}-${String(month).padStart(2, "0")}-01`, end: next, label: "Este mes" }
}

function previousRange(range) {
  const days = Math.max(1, diff(range.start, range.end))
  return { start: shift(range.start, -days), end: range.start }
}

function reservationRates(r) {
  const ids = roomIds(r), details = safeArray(r.habitaciones_detalle), map = new Map()
  details.forEach(item => {
    const id = String(item?.habitacion_id || item?.roomId || "")
    if (id) map.set(id, Number(item?.tarifa_noche ?? item?.rate ?? 0))
  })
  if (r.habitacion_id != null && !map.has(String(r.habitacion_id))) map.set(String(r.habitacion_id), Number(r.tarifa_noche || 0))
  return ids.map(id => Number(map.get(id) || 0))
}

function periodMetrics({ reservations, rooms, start, end, currency }) {
  const activeRooms = rooms.filter(sellable), capacity = activeRooms.length * Math.max(1, diff(start, end))
  const inRange = reservations.filter(r => overlap(r, start, end) && String(r.moneda || "ARS") === currency)
  const valid = inRange.filter(r => !cancelled(r))
  let occupiedRoomNights = 0, roomRevenue = 0, production = 0

  valid.forEach(r => {
    const from = r.fecha_entrada > start ? r.fecha_entrada : start
    const to = r.fecha_salida < end ? r.fecha_salida : end
    const nightsInRange = Math.max(0, diff(from, to))
    const fullNights = Math.max(1, diff(r.fecha_entrada, r.fecha_salida))
    const ids = roomIds(r), rates = reservationRates(r)
    occupiedRoomNights += nightsInRange * Math.max(1, ids.length)
    const rateSum = rates.reduce((sum, value) => sum + value, 0)
    roomRevenue += rateSum > 0 ? nightsInRange * rateSum : Number(r.precio_total || 0) * (nightsInRange / fullNights)
    production += Number(r.precio_total || 0) * (nightsInRange / fullNights)
  })

  const cancellations = inRange.filter(cancelled).length
  const occupancy = capacity ? Math.min(100, occupiedRoomNights / capacity * 100) : 0
  const adr = occupiedRoomNights ? roomRevenue / occupiedRoomNights : 0
  const revpar = capacity ? roomRevenue / capacity : 0
  const cancellationRate = inRange.length ? cancellations / inRange.length * 100 : 0
  return { occupancy, adr, revpar, roomRevenue, production, occupiedRoomNights, reservations: valid.length, cancellations, cancellationRate, capacity }
}

function dailySeries({ reservations, rooms, start, end, currency }) {
  const rows = []
  for (let day = start; day < end; day = shift(day, 1)) {
    rows.push({ day, ...periodMetrics({ reservations, rooms, start: day, end: shift(day, 1), currency }) })
  }
  if (rows.length <= 32) return rows
  const size = Math.ceil(rows.length / 24), buckets = []
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size)
    const occupied = slice.reduce((a, x) => a + x.occupiedRoomNights, 0), capacity = slice.reduce((a, x) => a + x.capacity, 0), revenue = slice.reduce((a, x) => a + x.roomRevenue, 0)
    buckets.push({ day: slice[0].day, occupancy: capacity ? occupied / capacity * 100 : 0, adr: occupied ? revenue / occupied : 0, revpar: capacity ? revenue / capacity : 0, roomRevenue: revenue })
  }
  return buckets
}

const pct = value => `${Math.round(value)}%`
const metricDelta = (current, previous, inverse = false) => {
  if (!previous) return { text: current ? "Sin base comparable" : "Sin movimiento", tone: "neutral" }
  const delta = (current - previous) / Math.abs(previous) * 100
  const good = inverse ? delta <= 0 : delta >= 0
  return { text: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs período anterior`, tone: good ? "good" : "bad" }
}
const short = value => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(asDate(value))

function Kpi({ label, value, detail, delta }) {
  return <article className={s.kpi}><span>{label}</span><strong>{value}</strong><small>{detail}</small><em data-tone={delta.tone}>{delta.text}</em></article>
}

export default function AnalyticsOverview({ rooms = [], reservations = [], settings = {} }) {
  const [period, setPeriod] = useState("month")
  const range = useMemo(() => rangeFor(period), [period]), previous = useMemo(() => previousRange(range), [range])
  const currencies = useMemo(() => [...new Set(reservations.map(r => String(r.moneda || "ARS")))], [reservations])
  const preferredCurrency = String(settings?.currency || settings?.default_currency || settings?.moneda || "ARS")
  const [chosenCurrency, setChosenCurrency] = useState(preferredCurrency)
  const currency = currencies.includes(chosenCurrency) ? chosenCurrency : (currencies.includes(preferredCurrency) ? preferredCurrency : currencies[0] || "ARS")
  const current = useMemo(() => periodMetrics({ reservations, rooms, ...range, currency }), [reservations, rooms, range, currency])
  const prior = useMemo(() => periodMetrics({ reservations, rooms, ...previous, currency }), [reservations, rooms, previous, currency])
  const series = useMemo(() => dailySeries({ reservations, rooms, ...range, currency }), [reservations, rooms, range, currency])
  const maxRevenue = Math.max(1, ...series.map(x => x.roomRevenue))

  const cards = [
    ["Ocupación", pct(current.occupancy), `${current.occupiedRoomNights} noches / ${current.capacity} disponibles`, metricDelta(current.occupancy, prior.occupancy)],
    ["ADR", money(current.adr, currency), "Tarifa media por habitación ocupada", metricDelta(current.adr, prior.adr)],
    ["RevPAR", money(current.revpar, currency), "Ingreso habitación por unidad disponible", metricDelta(current.revpar, prior.revpar)],
    ["Producción", money(current.production, currency), "Valor proporcional de las reservas", metricDelta(current.production, prior.production)],
    ["Noches vendidas", current.occupiedRoomNights.toLocaleString("es-AR"), `${current.reservations} reservas activas`, metricDelta(current.occupiedRoomNights, prior.occupiedRoomNights)],
    ["Cancelación", pct(current.cancellationRate), `${current.cancellations} canceladas / no-show`, metricDelta(current.cancellationRate, prior.cancellationRate, true)],
  ]

  return <main className={s.page}>
    <header className={s.hero}>
      <div><small>INTELIGENCIA HOTELERA</small><h1>El negocio, en una sola lectura.</h1><p>Indicadores calculados con reservas y habitaciones reales del PMS. Sin datos ficticios ni estimaciones decorativas.</p></div>
      <div className={s.heroStatus}><span>PERÍODO</span><b>{range.label}</b><small>{short(range.start)} → {short(shift(range.end, -1))}</small></div>
    </header>

    <section className={s.filters} aria-label="Filtros de inteligencia">
      <div className={s.periods}>{[["today","Hoy"],["7d","7 días"],["30d","30 días"],["month","Mes"],["year","Año"]].map(([id,label])=><button key={id} type="button" data-active={period===id} onClick={()=>setPeriod(id)}>{label}</button>)}</div>
      {currencies.length>1&&<label>Moneda<select value={currency} onChange={e=>setChosenCurrency(e.target.value)}>{currencies.map(item=><option key={item} value={item}>{item}</option>)}</select></label>}
    </section>

    <section className={s.kpis}>{cards.map(([label,value,detail,delta])=><Kpi key={label} label={label} value={value} detail={detail} delta={delta}/>)}</section>

    <section className={s.grid}>
      <article className={s.chartCard}>
        <header><div><small>DESEMPEÑO DEL PERÍODO</small><h2>Ingresos de habitación y ocupación</h2></div><span>{money(current.roomRevenue,currency)} en alojamiento</span></header>
        <div className={s.chart}>
          {series.map((row,index)=><div className={s.barColumn} key={`${row.day}-${index}`} title={`${short(row.day)} · ${pct(row.occupancy)} · ${money(row.roomRevenue,currency)}`}><div className={s.barTrack}><i style={{height:`${Math.max(3,row.roomRevenue/maxRevenue*100)}%`}}/><b style={{bottom:`${Math.min(94,row.occupancy)}%`}}/></div><small>{index===0||index===series.length-1||series.length<=12?short(row.day):""}</small></div>)}
        </div>
        <footer><span><i/> Ingreso habitación</span><span><b/> Ocupación</span></footer>
      </article>

      <aside className={s.reading}>
        <small>LECTURA RÁPIDA</small><h2>Qué está pasando</h2>
        <div><span>01</span><p><b>{pct(current.occupancy)} de ocupación</b> sobre {current.capacity.toLocaleString("es-AR")} habitaciones-noche disponibles.</p></div>
        <div><span>02</span><p><b>ADR {money(current.adr,currency)}</b> y RevPAR {money(current.revpar,currency)}.</p></div>
        <div><span>03</span><p><b>{current.reservations} reservas activas</b> y {current.cancellations} cancelaciones/no-show dentro del período.</p></div>
        <div><span>04</span><p><b>{money(current.roomRevenue,currency)} de alojamiento</b> dentro de {money(current.production,currency)} de producción asociada.</p></div>
      </aside>
    </section>

    <section className={s.definition}><b>Cómo se calcula</b><span>Ocupación = noches vendidas / noches disponibles · ADR = ingreso de alojamiento / noches vendidas · RevPAR = ingreso de alojamiento / noches disponibles.</span><small>Cuando una reserva no tiene tarifa nocturna desglosada, el ingreso de habitación se distribuye proporcionalmente desde el total registrado.</small></section>
  </main>
}
