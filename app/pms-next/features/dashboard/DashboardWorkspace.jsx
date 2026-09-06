"use client"

import { useEffect, useMemo, useState } from "react"
import OliviaAssistant from "../../components/OliviaAssistant"
import useDashboardData from "./useDashboardData"
import s from "./dashboard.module.css"
import d from "./frontDesk.module.css"

const shortcuts = [
  { id: "planning", label: "Planning", icon: "▦" },
  { id: "quotes", label: "Presupuestar", icon: "◇" },
  { id: "messages", label: "Mensajes", icon: "◌" },
  { id: "finance", label: "Finanzas", icon: "▤" },
  { id: "rates", label: "Tarifas y disponibilidad", icon: "↗" },
]

const DEFAULT_WIDGETS = ["occupancy", "arrivals", "departures", "inhouse", "ready", "collected"]
const money = (value, currency = "ARS") =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

const initials = (value) =>
  String(value || "H")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

const actualVip = (value) => {
  const normalized = String(value || "").trim()
  return normalized && !["standard", "normal", "none", "sin vip", "default"].includes(normalized.toLowerCase())
    ? normalized
    : ""
}

function MetricIcon({ type }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }
  if (type === "occupancy") return <svg {...common}><path d="M3 17V9h18v8"/><path d="M5 9V6h6a3 3 0 0 1 3 3"/><path d="M3 17v3M21 17v3M3 14h18"/></svg>
  if (type === "arrivals") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.7L16 9"/></svg>
  if (type === "departures") return <svg {...common}><path d="M10 17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="m14 8 4 4-4 4M18 12H9"/></svg>
  if (type === "inhouse") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  if (type === "ready") return <svg {...common}><path d="m4 19 8-8"/><path d="m9 6 9 9"/><path d="M14 3 3 14l7 7L21 10z"/></svg>
  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M16 8.5c-.8-.7-2-1.1-3.2-1.1-1.8 0-3 .8-3 2s1 1.8 3.2 2.3c2.1.5 3.2 1.2 3.2 2.5 0 1.4-1.4 2.4-3.4 2.4-1.4 0-2.8-.5-3.8-1.3M12.8 5.6v12.8"/></svg>
}

function GuestRow({ item, kind, onOpen }) {
  const time = kind === "arrival" ? item.hora_llegada_estimada : kind === "departure" ? item.hora_salida_estimada : null
  const roomLabel = item.roomNames?.length ? item.roomNames.join(", ") : "Sin habitación"
  const vip = actualVip(item.vipLevel)
  const tags = (item.guestTags || []).slice(0, 2)
  return (
    <button type="button" className={d.guestRow} onClick={onOpen} title={item.guestProfileNotes || undefined}>
      <span className={d.guestAvatar}>{initials(item.nombre_huesped)}</span>
      <span className={d.guestMain}>
        <b>{item.nombre_huesped}</b>
        <small>{roomLabel} · {item.canal_reserva || "Directa"}{time ? ` · ${time}` : ""}</small>
        <span className={d.guestFlags}>
          {vip ? <em data-kind="vip">VIP {vip}</em> : null}
          {item.guestLanguage ? <em data-kind="info">{item.guestLanguage}</em> : null}
          {tags.map((tag) => <em data-kind="info" key={tag}>{tag}</em>)}
          {item.roomMaintenance ? <em data-kind="danger">Mantenimiento</em> : item.roomDirty && kind === "arrival" ? <em data-kind="warn">Habitación sucia</em> : null}
          {item.balance > 0 ? <em data-kind="money">Saldo {money(item.balance, item.moneda)}</em> : <em data-kind="ok">Pago cubierto</em>}
        </span>
      </span>
      <span className={d.guestPax}>{item.cantidad_huespedes || 1} pax<br/><small>›</small></span>
    </button>
  )
}

function ReservationPreview({ item, onOpen }) {
  const state = String(item.estado || "reservada").toLowerCase()
  const label = state === "checkin" || state === "alojado" || state === "en_casa" ? "En estadía" : state === "confirmada" ? "Confirmada" : "Próxima"
  return (
    <button type="button" className={s.reservationPreview} onClick={onOpen}>
      <span className={s.reservationAvatar}>{initials(item.nombre_huesped)}</span>
      <span className={s.reservationCopy}>
        <strong>{item.nombre_huesped || "Huésped"}</strong>
        <small>{item.fecha_entrada} → {item.fecha_salida} · {item.roomNames?.[0] || "Sin habitación"}</small>
      </span>
      <span className={s.reservationStatus} data-state={state}>{label}</span>
    </button>
  )
}

export default function DashboardWorkspace({ propertyId, property, onNavigate, allowedViews = [] }) {
  const data = useDashboardData(propertyId)
  const m = data.metrics
  const [opsDay, setOpsDay] = useState(0)
  const [opsQuery, setOpsQuery] = useState("")
  const [widgetOrder, setWidgetOrder] = useState(DEFAULT_WIDGETS)
  const [dragging, setDragging] = useState("")
  const [oliviaHidden, setOliviaHidden] = useState(false)
  const allowed = useMemo(() => new Set(allowedViews), [allowedViews])
  const can = (id) => allowed.size === 0 || allowed.has(id)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`hl:dashboard-widgets:${propertyId}`) || "null")
      if (Array.isArray(saved) && saved.length) {
        setWidgetOrder([
          ...saved.filter((id) => DEFAULT_WIDGETS.includes(id)),
          ...DEFAULT_WIDGETS.filter((id) => !saved.includes(id)),
        ])
      }
    } catch {}
  }, [propertyId])

  useEffect(() => {
    try {
      setOliviaHidden(localStorage.getItem(`hl:olivia-hidden:${propertyId}`) === "1")
    } catch {
      setOliviaHidden(false)
    }
  }, [propertyId])

  function saveOrder(next) {
    setWidgetOrder(next)
    try {
      localStorage.setItem(`hl:dashboard-widgets:${propertyId}`, JSON.stringify(next))
    } catch {}
  }

  function dropOn(target) {
    if (!dragging || dragging === target) return
    const next = widgetOrder.filter((id) => id !== dragging)
    const index = next.indexOf(target)
    next.splice(index, 0, dragging)
    saveOrder(next)
    setDragging("")
  }

  function setOliviaVisibility(hidden) {
    setOliviaHidden(hidden)
    try {
      if (hidden) localStorage.setItem(`hl:olivia-hidden:${propertyId}`, "1")
      else localStorage.removeItem(`hl:olivia-hidden:${propertyId}`)
    } catch {}
  }

  const quickLinks = shortcuts.filter((item) => can(item.id))
  const ops = data.operationsByOffset?.[opsDay] || { arrivals: [], inhouse: [], departures: [] }
  const assistantContext = useMemo(() => {
    const current = data.operationsByOffset?.[0] || { arrivals: [], inhouse: [], departures: [] }
    const unique = new Map()
    ;[...(current.arrivals || []), ...(current.inhouse || []), ...(current.departures || [])].forEach((item) => unique.set(item.id, item))
    return {
      plataforma: "HabitaciónLlena.com · PMS hotelero",
      hoy: new Date().toLocaleDateString("en-CA"),
      alojamientos: propertyId ? [{ id: propertyId, nombre: property?.name || "Alojamiento actual" }] : [],
      metricas: {
        llegadasHoy: m.arrivals,
        salidasHoy: m.departures,
        alojados: m.inhouse,
        ocupacion: Number(m.occupancy || 0),
        habitacionesActivas: m.totalRooms,
        habitacionesSucias: m.dirty,
        habitacionesListas: m.ready,
        mantenimiento: m.maintenance,
        mantenimientoUrgente: m.urgent,
        checklistCompletado: m.checkPct,
        cobradoHoy: m.collected,
      },
      reservas: [...unique.values()].slice(0, 80).map((item) => ({
        id: item.id,
        numero: item.numero_reserva || null,
        nombre: item.nombre_huesped || "Huésped",
        entrada: item.fecha_entrada,
        salida: item.fecha_salida,
        estado: item.estado,
        habitaciones: item.roomNames || [],
        canal: item.canal_reserva || "Directa",
        huespedes: item.cantidad_huespedes || 1,
        saldo: Number(item.balance || 0),
        moneda: item.moneda || "ARS",
        vip: actualVip(item.vipLevel) || null,
        alertaHabitacion: item.roomMaintenance ? "mantenimiento" : item.roomDirty ? "sucia" : null,
      })),
    }
  }, [data.operationsByOffset, m, propertyId, property?.name])

  const filterRows = (rows) => {
    const term = opsQuery.trim().toLowerCase()
    return term
      ? rows.filter((item) => `${item.nombre_huesped} ${item.numero_reserva || ""} ${(item.roomNames || []).join(" ")} ${item.canal_reserva || ""} ${actualVip(item.vipLevel)} ${(item.guestTags || []).join(" ")}`.toLowerCase().includes(term))
      : rows
  }

  const columns = [
    { key: "arrivals", title: "Llegadas", kind: "arrival" },
    { key: "inhouse", title: "En casa", kind: "inhouse" },
    { key: "departures", title: "Salidas", kind: "departure" },
  ]
  const openReservation = (item) => onNavigate?.("reservations", { reservationId: item.id })

  const widgets = {
    occupancy: { label: "Ocupación hoy", value: `${m.occupancy.toFixed(0)}%`, note: `${m.inhouse} / ${m.totalRooms} habitaciones`, view: "planning", tone: "violet", icon: "occupancy" },
    arrivals: { label: "Llegadas hoy", value: m.arrivals, note: "check-in programados", view: "reservations", tone: "green", icon: "arrivals" },
    departures: { label: "Salidas hoy", value: m.departures, note: "check-out programados", view: "reservations", tone: "rose", icon: "departures" },
    inhouse: { label: "Huéspedes", value: m.inhouse, note: "habitaciones ocupadas", view: "guests", tone: "blue", icon: "inhouse" },
    ready: { label: "Habitaciones listas", value: m.ready, note: `${m.dirty} requieren limpieza`, view: "housekeeping", tone: "cyan", icon: "ready" },
    collected: { label: "Cobros del día", value: money(m.collected), note: "pagos registrados hoy", view: "finance", tone: "emerald", icon: "collected" },
  }

  const visibleWidgets = widgetOrder.filter((id) => widgets[id] && can(widgets[id].view))
  const occupancyBars = [-1, 0, 1].map((offset) => {
    const item = data.operationsByOffset?.[offset] || { inhouse: [] }
    const labels = { [-1]: "Ayer", [0]: "Hoy", [1]: "Mañana" }
    const rooms = item.inhouse?.length || 0
    return {
      offset,
      label: labels[offset],
      rooms,
      pct: m.totalRooms ? Math.min(100, Math.round((rooms / m.totalRooms) * 100)) : 0,
      today: offset === 0,
    }
  })
  const reservationPreviewRows = (() => {
    const unique = new Map()
    for (const offset of [0, 1]) {
      const item = data.operationsByOffset?.[offset] || { arrivals: [], inhouse: [], departures: [] }
      ;[...(item.arrivals || []), ...(item.inhouse || []), ...(item.departures || [])].forEach((row) => unique.set(row.id, row))
    }
    return [...unique.values()].slice(0, 4)
  })()
  const pendingChecklist = Math.max(0, Number(m.checkTotal || 0) - Number(m.checkDone || 0))
  const taskRows = [
    can("housekeeping") ? { label: "Habitaciones sucias", value: m.dirty, icon: "✦", view: "housekeeping", tone: "rose" } : null,
    can("maintenance") ? { label: "Mantenimiento", value: m.maintenance, icon: "⌁", view: "maintenance", tone: "blue" } : null,
    can("maintenance") && m.urgent ? { label: "Mantenimiento urgente", value: m.urgent, icon: "!", view: "maintenance", tone: "red" } : null,
    can("tasks") ? { label: "Check-list pendientes", value: pendingChecklist, icon: "✓", view: "tasks", tone: "amber" } : null,
  ].filter(Boolean)

  return (
    <section className={s.page}>
      <header className={s.hero}>
        <div>
          <small>DASHBOARD</small>
          <h1>¡Hola! <span aria-hidden="true">👋</span></h1>
          <p>Acá tenés un resumen claro de la operación de hoy en {property?.name || "tu alojamiento"}.</p>
        </div>
        <div className={s.heroTools}>
          {oliviaHidden ? <button className={s.secondaryButton} type="button" onClick={() => setOliviaVisibility(false)}>✦ Mostrar OlivIA</button> : null}
          <button className={s.secondaryButton} type="button" onClick={() => saveOrder(DEFAULT_WIDGETS)}>Restablecer widgets</button>
          <button className={s.liveButton} type="button" onClick={data.load}>{data.loading ? "Actualizando…" : "● Datos en vivo"}</button>
        </div>
      </header>

      {data.error ? <div className={s.notice}>{data.error}</div> : null}

      <div className={s.metricGrid}>
        {visibleWidgets.map((id) => {
          const widget = widgets[id]
          return (
            <button
              key={id}
              type="button"
              draggable
              onDragStart={() => setDragging(id)}
              onDragEnd={() => setDragging("")}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOn(id)}
              data-tone={widget.tone}
              className={`${s.metricCard} ${dragging === id ? s.dragging : ""}`}
              onClick={() => onNavigate?.(widget.view)}
            >
              <span className={s.metricIcon}><MetricIcon type={widget.icon}/></span>
              <span className={s.metricBody}>
                <small>{widget.label}</small>
                <strong className={id === "collected" ? s.moneyValue : ""}>{widget.value}</strong>
                <em>{widget.note}</em>
              </span>
              <i className={s.dragHandle}>⋮⋮</i>
            </button>
          )
        })}
      </div>

      <div className={s.insightGrid}>
        <article className={`${s.panelCard} ${s.occupancyCard}`}>
          <header className={s.panelHeader}>
            <div><strong>Ocupación</strong><small>Ayer, hoy y mañana</small></div>
            <button type="button" onClick={() => onNavigate?.("planning")}>Ver planning</button>
          </header>
          <div className={s.occupancyChart}>
            <div className={s.chartScale}><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
            <div className={s.barPlot}>
              {occupancyBars.map((item) => (
                <div className={s.barColumn} key={item.offset} data-today={item.today ? "1" : "0"}>
                  <span className={s.barValue}>{item.pct}%</span>
                  <div className={s.barTrack}><i style={{ height: `${Math.max(item.pct, 4)}%` }}/></div>
                  <b>{item.label}</b>
                  <small>{item.rooms} hab.</small>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className={s.panelCard}>
          <header className={s.panelHeader}>
            <div><strong>Reservas próximas</strong><small>Lo que viene ahora</small></div>
            <button type="button" onClick={() => onNavigate?.("reservations")}>Ver todas</button>
          </header>
          <div className={s.reservationList}>
            {reservationPreviewRows.length ? reservationPreviewRows.map((item) => (
              <ReservationPreview key={item.id} item={item} onOpen={() => openReservation(item)}/>
            )) : <div className={s.emptyPanel}>No hay reservas próximas para mostrar.</div>}
          </div>
        </article>

        <article className={s.panelCard}>
          <header className={s.panelHeader}>
            <div><strong>Tareas pendientes</strong><small>Prioridades operativas</small></div>
          </header>
          <div className={s.taskList}>
            {taskRows.map((task) => (
              <button type="button" key={task.label} data-tone={task.tone} onClick={() => onNavigate?.(task.view)}>
                <span className={s.taskIcon}>{task.icon}</span>
                <b>{task.label}</b>
                <strong>{task.value}</strong>
                <i>›</i>
              </button>
            ))}
            {!taskRows.length ? <div className={s.emptyPanel}>Sin tareas visibles para tu rol.</div> : null}
          </div>
        </article>
      </div>

      {can("reservations") ? (
        <section className={`${d.frontDesk} ${s.frontDeskWrap}`}>
          <header className={d.frontDeskHead}>
            <div><small>RECEPCIÓN</small><h2>Movimiento del hotel</h2><p>Entradas, huéspedes alojados y salidas con alertas operativas.</p></div>
            <div className={d.frontDeskTools}>
              <div className={d.dayTabs}>{[[-1, "Ayer"], [0, "Hoy"], [1, "Mañana"]].map(([value, label]) => <button type="button" key={value} className={opsDay === value ? d.dayActive : ""} onClick={() => setOpsDay(value)}>{label}</button>)}</div>
              <label className={d.deskSearch}>⌕<input value={opsQuery} onChange={(event) => setOpsQuery(event.target.value)} placeholder="Huésped, habitación o reserva"/></label>
            </div>
          </header>
          <div className={d.frontDeskGrid}>{columns.map((column) => {
            const rows = filterRows(ops[column.key] || [])
            return <article className={d.deskColumn} key={column.key}><header><b>{column.title}</b><span>{rows.length}</span></header><div className={d.guestList}>{rows.length ? rows.map((item) => <GuestRow key={`${column.key}-${item.id}`} item={item} kind={column.kind} onOpen={() => openReservation(item)}/>) : <div className={d.emptyOps}>Sin movimientos para esta vista.</div>}</div></article>
          })}</div>
        </section>
      ) : null}

      {quickLinks.length > 0 ? (
        <section className={s.quickSection}>
          <header><strong>Accesos rápidos</strong><small>Atajos frecuentes del PMS</small></header>
          <div className={s.quickGrid}>{quickLinks.map((item) => <button key={item.id} className={s.quickLink} type="button" onClick={() => onNavigate?.(item.id)}><span>{item.icon}</span>{item.label}</button>)}</div>
        </section>
      ) : null}

      {!oliviaHidden ? <OliviaAssistant propertyId={propertyId} propertyName={property?.name} context={assistantContext} onHide={() => setOliviaVisibility(true)}/> : null}
    </section>
  )
}
