"use client"

import { useMemo, useState } from "react"

const roomsSeed = [
  { id: "101", name: "101", type: "Doble King", floor: "Piso 1", status: "clean", rate: 118000 },
  { id: "102", name: "102", type: "Doble Twin", floor: "Piso 1", status: "clean", rate: 112000 },
  { id: "103", name: "103", type: "Doble King", floor: "Piso 1", status: "dirty", rate: 118000 },
  { id: "201", name: "201", type: "Triple Deluxe", floor: "Piso 2", status: "clean", rate: 148000 },
  { id: "202", name: "202", type: "Suite", floor: "Piso 2", status: "inspection", rate: 185000 },
  { id: "203", name: "203", type: "Suite", floor: "Piso 2", status: "clean", rate: 185000 },
  { id: "301", name: "301", type: "Junior Suite", floor: "Piso 3", status: "clean", rate: 164000 },
  { id: "302", name: "302", type: "Junior Suite", floor: "Piso 3", status: "maintenance", rate: 164000 },
]

const initialReservations = [
  { id: "R-1842", guest: "Sofía Martínez", roomId: "101", start: "2026-08-30", nights: 3, status: "inhouse", pax: 2, total: 354000, channel: "Directa", vip: true },
  { id: "R-1843", guest: "Tomás Beltrán", roomId: "102", start: "2026-08-31", nights: 2, status: "confirmed", pax: 2, total: 224000, channel: "Booking.com" },
  { id: "R-1844", guest: "Familia Ricci", roomId: "201", start: "2026-08-30", nights: 4, status: "inhouse", pax: 3, total: 592000, channel: "Directa" },
  { id: "R-1845", guest: "Lucía Pereira", roomId: "202", start: "2026-09-02", nights: 3, status: "pending", pax: 2, total: 555000, channel: "Instagram" },
  { id: "R-1846", guest: "Martín Ocampo", roomId: "203", start: "2026-09-01", nights: 2, status: "confirmed", pax: 2, total: 370000, channel: "Expedia" },
  { id: "R-1847", guest: "Carla + 2", roomId: "301", start: "2026-08-30", nights: 5, status: "inhouse", pax: 3, total: 820000, channel: "Directa" },
]

const nav = [
  ["dashboard", "Inicio", "⌂"],
  ["calendar", "Calendario", "▤"],
  ["reservations", "Reservas", "◫"],
  ["rooms", "Habitaciones", "◇"],
  ["revenue", "Revenue", "↗"],
  ["connections", "Conexiones", "⌁"],
]

const fmtMoney = (value) => `$ ${Number(value || 0).toLocaleString("es-AR")}`

function addDays(dateString, amount) {
  const d = new Date(`${dateString}T12:00:00`)
  d.setDate(d.getDate() + amount)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function diffDays(a, b) {
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000)
}

function statusCopy(status) {
  return {
    inhouse: ["Alojado", "emerald"],
    confirmed: ["Confirmada", "gold"],
    pending: ["Pendiente", "amber"],
    checkout: ["Salida hoy", "terracotta"],
  }[status] || ["Reserva", "gold"]
}

export default function PMSNextPreview() {
  const [view, setView] = useState("dashboard")
  const [role, setRole] = useState("reception")
  const [rooms, setRooms] = useState(roomsSeed)
  const [reservations, setReservations] = useState(initialReservations)
  const [calendarStart, setCalendarStart] = useState("2026-08-30")
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState("")
  const [newReservationOpen, setNewReservationOpen] = useState(false)
  const [newReservation, setNewReservation] = useState({ guest: "", roomId: "101", start: "2026-08-30", nights: 2, pax: 2, channel: "Directa" })
  const [toast, setToast] = useState("")

  const calendarDays = useMemo(() => Array.from({ length: 12 }, (_, i) => addDays(calendarStart, i)), [calendarStart])
  const today = "2026-08-30"

  const activeToday = reservations.filter(r => r.start <= today && addDays(r.start, r.nights) > today)
  const arrivalsToday = reservations.filter(r => r.start === today)
  const departuresToday = reservations.filter(r => addDays(r.start, r.nights) === today)
  const occupancy = Math.round((activeToday.length / rooms.filter(r => r.status !== "maintenance").length) * 100)
  const gross = reservations.reduce((sum, r) => sum + r.total, 0)
  const adr = reservations.length ? Math.round(gross / reservations.reduce((s, r) => s + r.nights, 0)) : 0
  const revpar = Math.round((gross / Math.max(1, rooms.length * 30)))

  const filteredReservations = reservations.filter(r => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [r.guest, r.id, r.roomId, r.channel].some(x => String(x).toLowerCase().includes(q))
  })

  function notify(message) {
    setToast(message)
    window.setTimeout(() => setToast(""), 2200)
  }

  function moveReservation(id, roomId, start) {
    const target = reservations.find(r => r.id === id)
    if (!target) return
    const end = addDays(start, target.nights)
    const collision = reservations.some(r => r.id !== id && r.roomId === roomId && start < addDays(r.start, r.nights) && end > r.start)
    const blocked = rooms.find(r => r.id === roomId)?.status === "maintenance"
    if (blocked) return notify("Esa habitación está fuera de servicio.")
    if (collision) return notify("Ese movimiento genera un cruce de reservas.")
    setReservations(list => list.map(r => r.id === id ? { ...r, roomId, start } : r))
    notify(`Reserva ${id} movida a habitación ${roomId}.`)
  }

  function createReservation(e) {
    e.preventDefault()
    if (!newReservation.guest.trim()) return notify("Ingresá el nombre del huésped.")
    const room = rooms.find(r => r.id === newReservation.roomId)
    if (!room || room.status === "maintenance") return notify("Elegí una habitación disponible.")
    const end = addDays(newReservation.start, Number(newReservation.nights))
    const collision = reservations.some(r => r.roomId === newReservation.roomId && newReservation.start < addDays(r.start, r.nights) && end > r.start)
    if (collision) return notify("La habitación ya está ocupada en esas fechas.")
    const id = `R-${1850 + reservations.length}`
    const item = {
      id,
      guest: newReservation.guest.trim(),
      roomId: newReservation.roomId,
      start: newReservation.start,
      nights: Number(newReservation.nights),
      pax: Number(newReservation.pax),
      status: "confirmed",
      total: room.rate * Number(newReservation.nights),
      channel: newReservation.channel,
    }
    setReservations(list => [...list, item])
    setNewReservationOpen(false)
    setSelected(item)
    notify("Reserva creada en el preview.")
  }

  function changeReservationStatus(id, status) {
    setReservations(list => list.map(r => r.id === id ? { ...r, status } : r))
    setSelected(current => current?.id === id ? { ...current, status } : current)
    notify(status === "inhouse" ? "Check-in realizado." : "Estado actualizado.")
  }

  function changeRoomStatus(roomId) {
    const order = ["clean", "dirty", "inspection", "maintenance"]
    setRooms(list => list.map(room => {
      if (room.id !== roomId) return room
      const index = order.indexOf(room.status)
      return { ...room, status: order[(index + 1) % order.length] }
    }))
  }

  const roomStatusText = {
    clean: "Lista",
    dirty: "Sucia",
    inspection: "Inspección",
    maintenance: "Fuera de servicio",
  }

  return (
    <div className="hotelOS">
      <aside className="side">
        <div className="brandBlock">
          <div className="brandMark"><span>H</span><i /></div>
          <div><strong>Habitación Llena</strong><small>Hospitality OS · Preview</small></div>
        </div>

        <div className="propertyCard">
          <small>PROPIEDAD ACTIVA</small>
          <b>Casa Oliva Hotel</b>
          <span>Buenos Aires · 8 habitaciones</span>
        </div>

        <nav>
          {nav.map(([id, label, icon]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
              <span>{icon}</span>{label}
              {id === "calendar" && <i className="liveDot" />}
            </button>
          ))}
        </nav>

        <div className="sideBottom">
          <div className="shift"><span /><div><b>Turno mañana</b><small>Recepción sincronizada</small></div></div>
          <div className="roleSwitch">
            <button className={role === "reception" ? "on" : ""} onClick={() => setRole("reception")}>Recepción</button>
            <button className={role === "owner" ? "on" : ""} onClick={() => setRole("owner")}>Dueño</button>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <small>{role === "owner" ? "VISTA DEL PROPIETARIO" : "RECEPCIÓN · DOMINGO 30 AGOSTO"}</small>
            <h1>{view === "dashboard" ? (role === "owner" ? "Tu hotel, en una mirada." : "Todo listo para recibir.") : nav.find(n => n[0] === view)?.[1]}</h1>
          </div>
          <div className="topActions">
            <div className="searchBox"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar huésped, reserva o habitación" /></div>
            <button className="glassButton" onClick={() => setView("calendar")}>Ver agenda</button>
            <button className="primaryButton" onClick={() => setNewReservationOpen(true)}>＋ Nueva reserva</button>
          </div>
        </header>

        {view === "dashboard" && (
          <div className="content dashboardGrid">
            <section className="welcomePanel">
              <div className="welcomeCopy">
                <small>{role === "owner" ? "PULSO DEL NEGOCIO" : "PULSO DE RECEPCIÓN"}</small>
                <h2>{role === "owner" ? "Ocupación sólida. Operación tranquila." : "Hay movimiento, pero está todo bajo control."}</h2>
                <p>{role === "owner" ? "Las próximas noches vienen con buen ritmo y el canal directo está liderando el mix de ventas." : "Tenés 3 huéspedes alojados, una habitación por inspeccionar y ninguna alerta crítica de overbooking."}</p>
                <div className="welcomeActions">
                  <button onClick={() => setView("calendar")}>Abrir calendario</button>
                  <button onClick={() => setView(role === "owner" ? "revenue" : "rooms")}>{role === "owner" ? "Ver revenue" : "Ver habitaciones"}</button>
                </div>
              </div>
              <div className="pulseOrb"><span>{occupancy}%</span><small>ocupación hoy</small></div>
            </section>

            <section className="metrics">
              {role === "owner" ? [
                ["Ocupación", `${occupancy}%`, "+8 pts vs. semana pasada", "emerald"],
                ["ADR", fmtMoney(adr), "+4,2%", "gold"],
                ["RevPAR", fmtMoney(revpar), "+6,8%", "violet"],
                ["Venta directa", "50%", "canal #1", "rose"],
              ].map(([l,v,d,c]) => <Metric key={l} label={l} value={v} detail={d} tone={c} />) : [
                ["Llegadas hoy", arrivalsToday.length, "2 listas para check-in", "emerald"],
                ["Salidas hoy", departuresToday.length, "sin saldo pendiente", "terracotta"],
                ["Habitaciones listas", rooms.filter(r => r.status === "clean").length, `${rooms.length} en inventario`, "gold"],
                ["Alertas", "1", "inspección pendiente", "violet"],
              ].map(([l,v,d,c]) => <Metric key={l} label={l} value={v} detail={d} tone={c} />)}
            </section>

            <section className="today card">
              <div className="sectionHead"><div><small>HOY EN EL HOTEL</small><h3>Operación de recepción</h3></div><button onClick={() => setView("calendar")}>Agenda completa →</button></div>
              <div className="todayColumns">
                <OperationColumn title="Llegan" tone="emerald" items={reservations.filter(r => r.start === today)} onSelect={setSelected} />
                <OperationColumn title="Alojados" tone="gold" items={activeToday} onSelect={setSelected} />
                <OperationColumn title="Próximos" tone="violet" items={reservations.filter(r => r.start > today).slice(0,3)} onSelect={setSelected} />
              </div>
            </section>

            <section className="smart card">
              <div className="sectionHead"><div><small>LLENA INTELLIGENCE</small><h3>Sugerencias útiles, no ruido.</h3></div><span className="aiBadge">✦ activo</span></div>
              <div className="smartList">
                <article><i>01</i><div><b>Podés vender una noche más en la 102</b><p>Queda libre entre el 2 y 4 de septiembre. Buena ventana para una promo de último momento.</p></div><button onClick={() => setView("revenue")}>Analizar</button></article>
                <article><i>02</i><div><b>Suite 202 requiere inspección</b><p>Tiene ingreso el 2 de septiembre. Housekeeping todavía la dejó como “Inspección”.</p></div><button onClick={() => setView("rooms")}>Resolver</button></article>
                <article><i>03</i><div><b>50% de las reservas entran directas</b><p>Es el canal más rentable de este preview. Conviene proteger disponibilidad propia.</p></div><button onClick={() => setView("connections")}>Ver canales</button></article>
              </div>
            </section>

            <section className="roomPulse card">
              <div className="sectionHead"><div><small>HOUSEKEEPING</small><h3>Estado vivo de habitaciones</h3></div><button onClick={() => setView("rooms")}>Gestionar →</button></div>
              <div className="roomChips">
                {rooms.map(room => <button key={room.id} className={`roomChip ${room.status}`} onClick={() => changeRoomStatus(room.id)}><b>{room.id}</b><span>{roomStatusText[room.status]}</span></button>)}
              </div>
            </section>
          </div>
        )}

        {view === "calendar" && (
          <div className="content calendarView">
            <div className="calendarToolbar card">
              <div><small>ROOM DIARY · DRAG & DROP</small><h2>Calendario vivo</h2><p>Arrastrá una reserva para cambiar fecha o habitación. El preview bloquea cruces y habitaciones fuera de servicio.</p></div>
              <div className="calendarNav"><button onClick={() => setCalendarStart(addDays(calendarStart, -7))}>←</button><button onClick={() => setCalendarStart(today)}>Hoy</button><button onClick={() => setCalendarStart(addDays(calendarStart, 7))}>→</button></div>
            </div>

            <div className="legend"><span><i className="emerald"/>Alojado</span><span><i className="gold"/>Confirmada</span><span><i className="amber"/>Pendiente</span><span><i className="maintenance"/>Fuera de servicio</span></div>

            <section className="calendarShell card">
              <div className="calendarScroll">
                <div className="calendarHeader" style={{ gridTemplateColumns: `190px repeat(${calendarDays.length}, 104px)` }}>
                  <div className="roomHeader"><b>Habitaciones</b><small>{rooms.length} unidades</small></div>
                  {calendarDays.map(day => {
                    const d = new Date(`${day}T12:00:00`)
                    return <div className={day === today ? "todayHead" : ""} key={day}><small>{d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")}</small><b>{day.slice(8)}</b><span>{d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")}</span></div>
                  })}
                </div>

                {rooms.map(room => (
                  <div className="calendarRow" key={room.id} style={{ gridTemplateColumns: `190px repeat(${calendarDays.length}, 104px)` }}>
                    <div className="roomLabel"><div><b>{room.name}</b><small>{room.type}</small></div><span className={`statusDot ${room.status}`} /></div>
                    {calendarDays.map(day => (
                      <div
                        className={`dayCell ${day === today ? "todayCell" : ""} ${room.status === "maintenance" ? "blocked" : ""}`}
                        key={`${room.id}-${day}`}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); moveReservation(e.dataTransfer.getData("reservationId"), room.id, day) }}
                        onDoubleClick={() => { setNewReservation({ guest: "", roomId: room.id, start: day, nights: 2, pax: 2, channel: "Directa" }); setNewReservationOpen(true) }}
                      />
                    ))}
                    {reservations.filter(r => r.roomId === room.id && addDays(r.start, r.nights) > calendarDays[0] && r.start <= calendarDays[calendarDays.length - 1]).map(r => {
                      const visibleStart = Math.max(0, diffDays(calendarDays[0], r.start))
                      const pre = r.start < calendarDays[0] ? diffDays(r.start, calendarDays[0]) : 0
                      const span = Math.min(r.nights - pre, calendarDays.length - visibleStart)
                      const [label, tone] = statusCopy(r.status)
                      return <button
                        key={r.id}
                        draggable
                        onDragStart={e => e.dataTransfer.setData("reservationId", r.id)}
                        onClick={() => setSelected(r)}
                        className={`bookingBar ${tone}`}
                        style={{ gridColumn: `${visibleStart + 2} / span ${Math.max(1, span)}`, gridRow: 1 }}
                      ><b>{r.guest}</b><span>{r.id} · {label}</span></button>
                    })}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === "reservations" && (
          <div className="content listView">
            <div className="listHeader card"><div><small>RESERVAS</small><h2>Una lista pensada para operar, no para mirar.</h2><p>Buscá, abrí y accioná cada estadía sin navegar por pantallas innecesarias.</p></div><div className="listSearch"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."/><span>{filteredReservations.length} resultados</span></div></div>
            <section className="reservationList card">
              {filteredReservations.map(r => {
                const room = rooms.find(x => x.id === r.roomId)
                const [label,tone] = statusCopy(r.status)
                return <button className="reservationRow" key={r.id} onClick={() => setSelected(r)}>
                  <div className="guestAvatar">{r.guest.slice(0,1)}</div>
                  <div className="guestMain"><b>{r.guest}{r.vip && <em>VIP</em>}</b><span>{r.id} · {r.channel}</span></div>
                  <div><small>HABITACIÓN</small><b>{room?.name} · {room?.type}</b></div>
                  <div><small>ESTADÍA</small><b>{r.start.slice(8)}/{r.start.slice(5,7)} → {addDays(r.start,r.nights).slice(8)}/{addDays(r.start,r.nights).slice(5,7)}</b></div>
                  <div><small>TOTAL</small><b>{fmtMoney(r.total)}</b></div>
                  <span className={`statusPill ${tone}`}>{label}</span>
                  <span className="openArrow">›</span>
                </button>
              })}
            </section>
          </div>
        )}

        {view === "rooms" && (
          <div className="content roomsView">
            <div className="listHeader card"><div><small>HOUSEKEEPING + INVENTARIO</small><h2>Cada habitación cuenta su estado.</h2><p>Un toque cambia el estado para simular el flujo de limpieza → inspección → lista → fuera de servicio.</p></div><div className="roomSummary"><b>{rooms.filter(r=>r.status==="clean").length}</b><span>listas ahora</span></div></div>
            <div className="roomsGrid">
              {rooms.map(room => {
                const current = reservations.find(r => r.roomId === room.id && r.start <= today && addDays(r.start,r.nights) > today)
                const next = reservations.filter(r => r.roomId === room.id && r.start > today).sort((a,b)=>a.start.localeCompare(b.start))[0]
                return <article className={`roomCard ${room.status}`} key={room.id}>
                  <div className="roomCardTop"><div><small>{room.floor}</small><h3>{room.name}</h3><span>{room.type}</span></div><button onClick={() => changeRoomStatus(room.id)}>{roomStatusText[room.status]}</button></div>
                  <div className="roomGuest"><small>AHORA</small><b>{current?.guest || "Disponible"}</b><span>{current ? `${current.nights} noches · ${current.pax} huéspedes` : "Lista para vender"}</span></div>
                  <div className="roomGuest next"><small>PRÓXIMO</small><b>{next?.guest || "Sin reserva próxima"}</b><span>{next ? `${next.start.slice(8)}/${next.start.slice(5,7)} · ${next.channel}` : `Tarifa base ${fmtMoney(room.rate)}`}</span></div>
                </article>
              })}
            </div>
          </div>
        )}

        {view === "revenue" && (
          <div className="content revenueView">
            <section className="revenueHero card"><div><small>REVENUE COCKPIT</small><h2>Precios con contexto, no por intuición.</h2><p>Este preview muestra cómo queremos que el dueño entienda demanda, ADR, RevPAR, pickup y canal directo sin convertirse en analista.</p></div><div className="revenueValue"><span>{occupancy}%</span><small>ocupación actual</small></div></section>
            <section className="metrics">
              <Metric label="ADR" value={fmtMoney(adr)} detail="+4,2% vs. período previo" tone="gold" />
              <Metric label="RevPAR" value={fmtMoney(revpar)} detail="+6,8%" tone="emerald" />
              <Metric label="Ingreso en agenda" value={fmtMoney(gross)} detail="reservas del preview" tone="violet" />
              <Metric label="Venta directa" value="50%" detail="mejor margen" tone="rose" />
            </section>
            <section className="chartCard card"><div className="sectionHead"><div><small>DEMANDA · PRÓXIMOS 12 DÍAS</small><h3>Ocupación proyectada</h3></div><span className="forecast">Pronóstico estable</span></div><div className="bars">{[68,72,78,84,92,88,76,63,70,82,90,86].map((v,i)=><div key={i}><span style={{height:`${v}%`}}/><b>{v}%</b><small>{calendarDays[i]?.slice(8)}</small></div>)}</div></section>
            <section className="rateRecommendations card"><div className="sectionHead"><div><small>RECOMENDACIONES</small><h3>Ajustes sugeridos</h3></div></div>{[["01–02 SEP","Demanda alta","+12%","Subir tarifa en Suites y Junior Suites"],["03–04 SEP","Demanda media","Mantener","Proteger venta directa"],["05–06 SEP","Demanda baja","-8%","Activar oferta de 2 noches"]].map(([d,s,a,t])=><div className="rateRow" key={d}><b>{d}</b><span>{s}</span><em>{a}</em><p>{t}</p></div>)}</section>
          </div>
        )}

        {view === "connections" && (
          <div className="content connectionsView">
            <section className="connectionsHero card"><div><small>ECOSISTEMA CONECTADO</small><h2>Una sola verdad para todo el hotel.</h2><p>El objetivo final: disponibilidad, tarifas, pagos, mensajes, motor de reservas y operación interna hablando entre sí. En este preview mostramos el mapa de producto, sin simular conexiones que todavía no existen.</p></div><div className="coreOrb"><b>HL</b><span>core</span></div></section>
            <div className="connectionGrid">
              {[
                ["Motor de reservas","Inventario y tarifas propias","ready"],
                ["Booking.com","Channel manager","planned"],
                ["Expedia","Channel manager","planned"],
                ["Airbnb","Channel manager","planned"],
                ["WhatsApp","Mensajería al huésped","planned"],
                ["Instagram","Bandeja omnicanal","ready"],
                ["Mercado Pago","Cobros y señas","planned"],
                ["ARCA","Facturación fiscal","planned"],
              ].map(([name,desc,status])=><article className="connectionCard card" key={name}><span className={`connectionState ${status}`}>{status === "ready" ? "PREPARADO" : "PRÓXIMA CONEXIÓN"}</span><h3>{name}</h3><p>{desc}</p><div className="connectionLine"><i/><span>{status === "ready" ? "Interfaz lista para conectar" : "No se presenta como activa"}</span></div></article>)}
            </div>
          </div>
        )}
      </main>

      {selected && (
        <div className="modalBackdrop" onClick={() => setSelected(null)}>
          <section className="reservationDrawer" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>×</button>
            <div className="drawerHead"><small>{selected.id}</small><h2>{selected.guest}</h2><div className="drawerMeta"><span>Habitación {selected.roomId}</span><span>{selected.pax} huéspedes</span><span>{selected.channel}</span></div></div>
            <div className="stayVisual"><div><small>CHECK-IN</small><b>{selected.start.slice(8)}/{selected.start.slice(5,7)}</b></div><i><span>{selected.nights} noches</span></i><div><small>CHECK-OUT</small><b>{addDays(selected.start,selected.nights).slice(8)}/{addDays(selected.start,selected.nights).slice(5,7)}</b></div></div>
            <div className="drawerInfo"><Info label="Estado" value={statusCopy(selected.status)[0]} /><Info label="Total" value={fmtMoney(selected.total)} /><Info label="Tarifa promedio" value={fmtMoney(Math.round(selected.total/selected.nights))} /><Info label="Canal" value={selected.channel} /></div>
            <div className="drawerActions">
              {selected.status !== "inhouse" && <button className="checkin" onClick={() => changeReservationStatus(selected.id,"inhouse")}>✓ Realizar check-in</button>}
              <button onClick={() => { setView("calendar"); setSelected(null) }}>Ver en calendario</button>
              <button onClick={() => { setView("reservations"); setSelected(null) }}>Abrir reservas</button>
            </div>
          </section>
        </div>
      )}

      {newReservationOpen && (
        <div className="modalBackdrop" onClick={() => setNewReservationOpen(false)}>
          <form className="newReservationModal" onClick={e => e.stopPropagation()} onSubmit={createReservation}>
            <button type="button" className="close" onClick={() => setNewReservationOpen(false)}>×</button>
            <small>NUEVA RESERVA · PREVIEW</small><h2>Reservar debería sentirse así de simple.</h2>
            <label>Huésped<input autoFocus value={newReservation.guest} onChange={e => setNewReservation(v=>({...v,guest:e.target.value}))} placeholder="Nombre y apellido" /></label>
            <div className="formGrid"><label>Habitación<select value={newReservation.roomId} onChange={e=>setNewReservation(v=>({...v,roomId:e.target.value}))}>{rooms.map(r=><option value={r.id} key={r.id} disabled={r.status==="maintenance"}>{r.id} · {r.type}{r.status==="maintenance"?" · fuera de servicio":""}</option>)}</select></label><label>Entrada<input type="date" value={newReservation.start} onChange={e=>setNewReservation(v=>({...v,start:e.target.value}))}/></label></div>
            <div className="formGrid"><label>Noches<input type="number" min="1" max="30" value={newReservation.nights} onChange={e=>setNewReservation(v=>({...v,nights:e.target.value}))}/></label><label>Huéspedes<input type="number" min="1" max="8" value={newReservation.pax} onChange={e=>setNewReservation(v=>({...v,pax:e.target.value}))}/></label></div>
            <label>Canal<select value={newReservation.channel} onChange={e=>setNewReservation(v=>({...v,channel:e.target.value}))}><option>Directa</option><option>Booking.com</option><option>Expedia</option><option>Instagram</option><option>Teléfono</option></select></label>
            <div className="pricePreview"><span>Total estimado</span><b>{fmtMoney((rooms.find(r=>r.id===newReservation.roomId)?.rate||0)*Number(newReservation.nights||0))}</b></div>
            <button className="createButton">Crear reserva</button>
          </form>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      <style jsx global>{`
        :root{--ink:#1d2824;--deep:#102823;--forest:#173d38;--moss:#5e7e73;--sage:#aabbb1;--paper:#f3eee5;--ivory:#fbf8f1;--line:#ddd3c4;--gold:#b68b5a;--terracotta:#a8644f;--emerald:#4c816e;--violet:#786c93;--rose:#986b78;--amber:#b68245;--shadow:0 18px 55px rgba(43,39,32,.09)}
        *{box-sizing:border-box}html,body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,select{font:inherit}.hotelOS{min-height:100vh;background:radial-gradient(circle at 78% 0%,rgba(182,139,90,.10),transparent 26%),linear-gradient(120deg,rgba(23,61,56,.028),transparent 32%),var(--paper)}
        .side{position:fixed;left:0;top:0;bottom:0;width:238px;padding:20px 14px 16px;background:linear-gradient(180deg,#12352f 0%,#0d2824 100%);color:#fff;display:flex;flex-direction:column;z-index:50;box-shadow:18px 0 50px rgba(13,40,36,.12)}
        .brandBlock{display:flex;align-items:center;gap:11px;padding:4px 8px 20px}.brandBlock strong{display:block;font-family:Georgia,serif;font-size:17px;font-weight:500;letter-spacing:-.025em}.brandBlock small{display:block;margin-top:4px;font-size:8px;letter-spacing:.13em;text-transform:uppercase;color:#a7c0b6}.brandMark{width:38px;height:44px;border:1px solid rgba(255,255,255,.18);border-radius:19px 19px 11px 11px;display:grid;place-items:center;position:relative;background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.035));box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}.brandMark span{font-family:Georgia,serif;font-size:17px;color:#e4c29b}.brandMark i{position:absolute;width:5px;height:5px;border-radius:50%;background:#d9b48a;top:5px}
        .propertyCard{padding:13px 14px;margin:0 3px 18px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.055);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}.propertyCard small{font-size:8px;letter-spacing:.15em;color:#92b1a6}.propertyCard b{display:block;margin-top:7px;font-size:13px}.propertyCard span{display:block;color:#9fb6ae;font-size:9px;margin-top:4px}
        .side nav{display:grid;gap:3px}.side nav button{border:0;background:transparent;color:#d7e2de;border-radius:11px;padding:11px 12px;display:flex;align-items:center;gap:11px;text-align:left;cursor:pointer;font-size:12px;font-weight:650;position:relative;transition:.2s}.side nav button>span{width:19px;text-align:center;color:#aac2b8}.side nav button:hover{background:rgba(255,255,255,.06)}.side nav button.active{background:linear-gradient(90deg,rgba(255,255,255,.14),rgba(255,255,255,.07));box-shadow:inset 3px 0 0 #d0ab81;color:#fff}.liveDot{position:absolute;right:12px;width:6px;height:6px;border-radius:50%;background:#6ed5aa;box-shadow:0 0 12px rgba(110,213,170,.75)}
        .sideBottom{margin-top:auto}.shift{display:flex;align-items:center;gap:10px;padding:12px}.shift>span{width:9px;height:9px;border-radius:50%;background:#74d1ab;box-shadow:0 0 16px rgba(116,209,171,.7)}.shift b{display:block;font-size:10px}.shift small{display:block;font-size:8px;color:#9db6ad;margin-top:3px}.roleSwitch{display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:13px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}.roleSwitch button{border:0;border-radius:9px;padding:8px 6px;background:transparent;color:#a9bbb5;font-size:9px;font-weight:800;cursor:pointer}.roleSwitch button.on{background:rgba(255,255,255,.12);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.09)}
        .workspace{margin-left:238px;min-height:100vh}.topbar{height:92px;padding:0 28px;position:sticky;top:0;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid rgba(80,65,50,.10);background:rgba(243,238,229,.78);backdrop-filter:blur(24px) saturate(1.08)}.topbar small{font-size:8px;letter-spacing:.16em;color:#7c766f;font-weight:850}.topbar h1{font-family:Georgia,serif;font-size:23px;font-weight:500;margin:4px 0 0;letter-spacing:-.025em}.topActions{display:flex;align-items:center;gap:8px}.searchBox{height:40px;width:295px;border:1px solid rgba(65,55,45,.12);background:rgba(255,255,255,.52);border-radius:13px;display:flex;align-items:center;padding:0 11px;gap:7px}.searchBox input{border:0;outline:0;background:transparent;width:100%;font-size:11px;color:var(--ink)}.searchBox span{color:#887e73}.glassButton,.primaryButton{height:40px;padding:0 14px;border-radius:13px;cursor:pointer;font-size:10px;font-weight:850}.glassButton{border:1px solid rgba(65,55,45,.14);background:rgba(255,255,255,.5);color:var(--forest)}.primaryButton{border:0;background:linear-gradient(135deg,#1d4a42,#12362f);color:#fff;box-shadow:0 9px 22px rgba(23,61,56,.19)}
        .content{padding:22px 28px 60px}.dashboardGrid{display:grid;grid-template-columns:1.2fr .8fr;gap:15px}.card{background:rgba(251,248,241,.84);border:1px solid rgba(92,77,60,.12);border-radius:19px;box-shadow:0 12px 36px rgba(54,47,38,.055);backdrop-filter:blur(16px)}
        .welcomePanel{grid-column:1/-1;min-height:240px;display:flex;align-items:center;justify-content:space-between;gap:30px;padding:32px 38px;border-radius:24px;color:white;background:radial-gradient(circle at 88% 30%,rgba(208,171,129,.22),transparent 20%),linear-gradient(120deg,#163e37,#0d2d28 72%);box-shadow:0 24px 64px rgba(13,45,40,.17);position:relative;overflow:hidden}.welcomePanel:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(90deg,#000,transparent)}.welcomeCopy{position:relative;z-index:2;max-width:690px}.welcomeCopy small{font-size:8px;letter-spacing:.18em;color:#d6b791;font-weight:900}.welcomeCopy h2{font-family:Georgia,serif;font-size:37px;line-height:1.02;letter-spacing:-.04em;font-weight:500;margin:11px 0}.welcomeCopy p{font-size:12px;line-height:1.65;color:#c6d2ce;max-width:620px}.welcomeActions{display:flex;gap:8px;margin-top:18px}.welcomeActions button{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#fff;border-radius:999px;padding:9px 13px;font-size:9px;font-weight:800;cursor:pointer;backdrop-filter:blur(10px)}.welcomeActions button:first-child{background:#f2e4d2;color:#163a34;border-color:#f2e4d2}.pulseOrb{position:relative;z-index:2;width:145px;height:145px;flex:0 0 145px;border-radius:50%;display:grid;place-items:center;text-align:center;background:radial-gradient(circle at 34% 26%,rgba(255,255,255,.2),rgba(255,255,255,.04) 42%,rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.17);box-shadow:inset 0 0 30px rgba(255,255,255,.04),0 0 0 11px rgba(255,255,255,.025)}.pulseOrb span{font-family:Georgia,serif;font-size:34px}.pulseOrb small{display:block;font-size:8px;color:#aac1b9;margin-top:-34px}
        .metrics{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric{padding:17px 18px}.metric small{font-size:8px;letter-spacing:.12em;color:#8b837a;font-weight:850}.metric strong{display:block;font-family:Georgia,serif;font-size:26px;font-weight:500;margin-top:8px;letter-spacing:-.03em}.metric span{display:block;font-size:9px;margin-top:6px}.metric.emerald span{color:var(--emerald)}.metric.gold span{color:var(--gold)}.metric.violet span{color:var(--violet)}.metric.rose span{color:var(--rose)}.metric.terracotta span{color:var(--terracotta)}
        .today{padding:20px}.sectionHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.sectionHead small{font-size:8px;letter-spacing:.15em;color:#9a7955;font-weight:900}.sectionHead h3{font-family:Georgia,serif;font-size:22px;font-weight:500;margin:5px 0 0}.sectionHead button{border:0;background:transparent;color:var(--forest);font-size:9px;font-weight:850;cursor:pointer}.todayColumns{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:17px}.operationColumn{padding:11px;border:1px solid rgba(70,60,50,.09);border-radius:14px;background:rgba(255,255,255,.35)}.operationTitle{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}.operationTitle b{font-size:10px}.operationTitle span{width:7px;height:7px;border-radius:50%}.operationColumn.emerald .operationTitle span{background:var(--emerald)}.operationColumn.gold .operationTitle span{background:var(--gold)}.operationColumn.violet .operationTitle span{background:var(--violet)}.miniGuest{width:100%;border:0;background:transparent;padding:8px 4px;text-align:left;cursor:pointer;border-top:1px solid rgba(70,60,50,.08)}.miniGuest:first-of-type{border-top:0}.miniGuest b{display:block;font-size:10px}.miniGuest span{display:block;font-size:8px;color:#8a8178;margin-top:3px}.emptyMini{font-size:9px;color:#948a80;padding:8px 3px}
        .smart{padding:20px}.aiBadge{font-size:8px;color:var(--emerald);font-weight:850}.smartList{display:grid;margin-top:11px}.smartList article{display:grid;grid-template-columns:26px 1fr auto;gap:10px;align-items:center;padding:11px 0;border-top:1px solid rgba(70,60,50,.09)}.smartList article:first-child{border-top:0}.smartList i{font-style:normal;width:24px;height:24px;border-radius:9px;display:grid;place-items:center;background:#ede3d6;color:#8d6842;font-size:8px;font-weight:900}.smartList b{font-size:10px}.smartList p{font-size:8px;line-height:1.5;color:#80786f;margin:4px 0 0}.smartList button{border:1px solid rgba(70,60,50,.12);background:white;border-radius:9px;padding:7px 9px;font-size:8px;font-weight:850;color:var(--forest);cursor:pointer}
        .roomPulse{grid-column:1/-1;padding:20px}.roomChips{display:grid;grid-template-columns:repeat(8,1fr);gap:8px;margin-top:15px}.roomChip{border:1px solid rgba(70,60,50,.1);border-radius:13px;padding:10px 8px;background:white;text-align:left;cursor:pointer}.roomChip b{display:block;font-size:12px}.roomChip span{display:block;font-size:8px;margin-top:5px}.roomChip.clean{background:#edf5f1;color:#346d5a}.roomChip.dirty{background:#f5e8e2;color:#9d5e4b}.roomChip.inspection{background:#f5efe2;color:#9b7743}.roomChip.maintenance{background:#ece9e6;color:#756e68}
        .calendarView,.listView,.roomsView,.revenueView,.connectionsView{display:grid;gap:14px}.calendarToolbar,.listHeader,.revenueHero,.connectionsHero{padding:22px 24px;display:flex;align-items:center;justify-content:space-between;gap:25px}.calendarToolbar small,.listHeader small,.revenueHero small,.connectionsHero small{font-size:8px;letter-spacing:.15em;color:#9a7955;font-weight:900}.calendarToolbar h2,.listHeader h2,.revenueHero h2,.connectionsHero h2{font-family:Georgia,serif;font-size:29px;font-weight:500;letter-spacing:-.035em;margin:5px 0}.calendarToolbar p,.listHeader p,.revenueHero p,.connectionsHero p{font-size:10px;line-height:1.6;color:#7d756d;margin:0;max-width:740px}.calendarNav{display:flex;gap:6px}.calendarNav button{border:1px solid rgba(70,60,50,.12);background:white;border-radius:10px;padding:8px 11px;font-size:9px;font-weight:850;cursor:pointer}.legend{display:flex;gap:16px;padding:0 6px;font-size:8px;font-weight:750;color:#70685f}.legend span{display:flex;align-items:center;gap:5px}.legend i{width:8px;height:8px;border-radius:3px}.legend i.emerald{background:var(--emerald)}.legend i.gold{background:var(--gold)}.legend i.amber{background:var(--amber)}.legend i.maintenance{background:#726d67}.calendarShell{overflow:hidden;padding:0}.calendarScroll{overflow:auto}.calendarHeader,.calendarRow{display:grid;min-width:max-content;position:relative}.calendarHeader{height:66px;border-bottom:1px solid var(--line);background:#f7f2ea;position:sticky;top:0;z-index:15}.calendarHeader>div{border-left:1px solid rgba(80,65,50,.08);display:grid;place-items:center;align-content:center}.calendarHeader>div:not(.roomHeader) small{font-size:7px;text-transform:uppercase;color:#968b80;font-weight:800}.calendarHeader>div:not(.roomHeader) b{font-family:Georgia,serif;font-size:18px;font-weight:500}.calendarHeader>div:not(.roomHeader) span{font-size:7px;color:#9d9388}.roomHeader{position:sticky;left:0;z-index:18;background:#f7f2ea!important;display:block!important;padding:14px}.roomHeader b{display:block;font-size:10px}.roomHeader small{display:block;font-size:7px;color:#948a80;margin-top:3px}.todayHead{background:#e8f0eb!important;box-shadow:inset 2px 0 0 #719c8d,inset -2px 0 0 #719c8d}.calendarRow{height:76px;border-bottom:1px solid rgba(80,65,50,.08)}.roomLabel{grid-row:1;position:sticky;left:0;z-index:11;background:#fbf8f1;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-right:1px solid rgba(80,65,50,.09)}.roomLabel b{display:block;font-size:11px}.roomLabel small{display:block;font-size:8px;color:#81786f;margin-top:3px}.statusDot{width:7px;height:7px;border-radius:50%}.statusDot.clean{background:#56a083}.statusDot.dirty{background:#b76f57}.statusDot.inspection{background:#bd9050}.statusDot.maintenance{background:#77716b}.dayCell{grid-row:1;border-left:1px solid rgba(80,65,50,.07);background:rgba(255,255,255,.26);transition:.15s}.dayCell:hover{background:rgba(181,139,90,.08)}.dayCell.todayCell{background:rgba(76,129,110,.055)}.dayCell.blocked{background:repeating-linear-gradient(135deg,rgba(80,75,70,.08) 0,rgba(80,75,70,.08) 7px,rgba(80,75,70,.02) 7px,rgba(80,75,70,.02) 14px)}.bookingBar{align-self:center;height:50px;margin:0 5px;z-index:9;border:0;border-radius:12px;color:#fff;padding:8px 10px;text-align:left;cursor:grab;overflow:hidden;box-shadow:0 7px 18px rgba(50,45,40,.13)}.bookingBar:active{cursor:grabbing}.bookingBar b{display:block;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bookingBar span{display:block;font-size:7px;margin-top:5px;opacity:.82;white-space:nowrap}.bookingBar.emerald{background:linear-gradient(135deg,#4e806f,#3a6658)}.bookingBar.gold{background:linear-gradient(135deg,#c39a67,#9c7547)}.bookingBar.amber{background:linear-gradient(135deg,#c08a49,#9c6830)}
        .listSearch{display:flex;align-items:center;gap:10px}.listSearch input{width:250px;border:1px solid rgba(70,60,50,.12);background:white;border-radius:11px;padding:10px 11px;outline:0;font-size:10px}.listSearch span{font-size:8px;color:#82796f}.reservationList{padding:8px}.reservationRow{width:100%;display:grid;grid-template-columns:38px 1.35fr 1.1fr 1fr .8fr auto 18px;gap:12px;align-items:center;padding:12px 10px;border:0;border-bottom:1px solid rgba(70,60,50,.08);background:transparent;text-align:left;cursor:pointer;border-radius:11px;transition:.16s}.reservationRow:hover{background:rgba(181,139,90,.06)}.reservationRow:last-child{border-bottom:0}.guestAvatar{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:#e7ded1;color:#765737;font-family:Georgia,serif;font-size:15px}.guestMain b{font-size:10px}.guestMain em{font-style:normal;margin-left:6px;background:#eadcc9;color:#8c6841;padding:3px 5px;border-radius:999px;font-size:6px}.guestMain span,.reservationRow>div:not(.guestMain):not(.guestAvatar) small{display:block;font-size:7px;color:#91877d;margin-top:3px}.reservationRow>div:not(.guestMain):not(.guestAvatar) b{font-size:9px}.statusPill{padding:6px 8px;border-radius:999px;font-size:7px;font-weight:900}.statusPill.emerald{background:#e2f0ea;color:#40755f}.statusPill.gold{background:#f1e6d7;color:#947047}.statusPill.amber{background:#f2e4d0;color:#9b6a30}.openArrow{font-size:18px;color:#9a8f82}
        .roomSummary{text-align:center;border-left:1px solid var(--line);padding-left:28px}.roomSummary b{display:block;font-family:Georgia,serif;font-size:34px;font-weight:500;color:var(--emerald)}.roomSummary span{font-size:8px;color:#80766c}.roomsGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.roomCard{padding:17px;border:1px solid rgba(70,60,50,.11);border-radius:18px;background:rgba(251,248,241,.82);box-shadow:0 12px 34px rgba(54,47,38,.05)}.roomCardTop{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.roomCardTop small{font-size:7px;color:#91877d}.roomCardTop h3{font-family:Georgia,serif;font-size:28px;font-weight:500;margin:2px 0}.roomCardTop span{display:block;font-size:8px;color:#746b62}.roomCardTop button{border:0;border-radius:999px;padding:6px 8px;font-size:7px;font-weight:850;cursor:pointer}.roomCard.clean .roomCardTop button{background:#e4f1eb;color:#42735f}.roomCard.dirty .roomCardTop button{background:#f4e4dd;color:#9e5f4b}.roomCard.inspection .roomCardTop button{background:#f2ead9;color:#95723e}.roomCard.maintenance .roomCardTop button{background:#e9e6e2;color:#6c6761}.roomGuest{margin-top:17px;padding:11px;border-radius:12px;background:rgba(255,255,255,.55);border:1px solid rgba(70,60,50,.07)}.roomGuest.next{margin-top:8px}.roomGuest small{font-size:6px;letter-spacing:.12em;color:#998d80;font-weight:900}.roomGuest b{display:block;font-size:10px;margin-top:4px}.roomGuest span{display:block;font-size:7px;color:#867c72;margin-top:3px}
        .revenueHero,.connectionsHero{min-height:175px;background:linear-gradient(120deg,#173d38,#102e29);color:#fff}.revenueHero p,.connectionsHero p{color:#b9cbc4}.revenueValue{text-align:center;padding:20px 30px;border-left:1px solid rgba(255,255,255,.1)}.revenueValue span{display:block;font-family:Georgia,serif;font-size:42px}.revenueValue small{font-size:8px;color:#b6c6c0}.chartCard,.rateRecommendations{padding:21px}.forecast{font-size:8px;color:var(--emerald);font-weight:850}.bars{height:260px;display:grid;grid-template-columns:repeat(12,1fr);gap:8px;align-items:end;margin-top:24px}.bars>div{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px}.bars span{width:70%;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,#6f9688,#3f6d5e);box-shadow:0 6px 16px rgba(63,109,94,.14)}.bars b{font-size:7px;color:#5d6d67}.bars small{font-size:7px;color:#968b7f}.rateRow{display:grid;grid-template-columns:110px 120px 90px 1fr;gap:12px;align-items:center;padding:12px 0;border-top:1px solid rgba(70,60,50,.08)}.rateRow b{font-size:9px}.rateRow span{font-size:8px;color:#766d64}.rateRow em{font-style:normal;font-size:8px;font-weight:900;color:var(--emerald)}.rateRow p{font-size:8px;color:#80766d;margin:0}
        .coreOrb{width:100px;height:100px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.22),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.14);box-shadow:0 0 0 10px rgba(255,255,255,.025)}.coreOrb b{font-family:Georgia,serif;font-size:28px}.coreOrb span{font-size:7px;margin-top:-28px;color:#b7c9c2}.connectionGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.connectionCard{padding:17px}.connectionState{font-size:6px;font-weight:900;letter-spacing:.1em;padding:5px 6px;border-radius:999px}.connectionState.ready{background:#e4f1eb;color:#477763}.connectionState.planned{background:#eee9e2;color:#7f766c}.connectionCard h3{font-family:Georgia,serif;font-size:20px;font-weight:500;margin:13px 0 5px}.connectionCard p{font-size:8px;color:#80766d;min-height:26px}.connectionLine{display:flex;align-items:center;gap:6px;margin-top:14px;font-size:7px;color:#8b8176}.connectionLine i{width:6px;height:6px;border-radius:50%;background:#a69582}
        .modalBackdrop{position:fixed;inset:0;background:rgba(12,23,20,.52);backdrop-filter:blur(9px);z-index:100;display:flex;justify-content:flex-end;align-items:stretch}.reservationDrawer{width:min(520px,100%);height:100%;background:#f8f3eb;padding:32px;box-shadow:-25px 0 70px rgba(0,0,0,.18);position:relative;overflow:auto}.close{position:absolute;right:20px;top:18px;width:34px;height:34px;border:0;border-radius:50%;background:#e9e1d6;color:#685f56;font-size:20px;cursor:pointer}.drawerHead small,.newReservationModal>small{font-size:8px;letter-spacing:.14em;color:#9c7953;font-weight:900}.drawerHead h2,.newReservationModal h2{font-family:Georgia,serif;font-size:31px;font-weight:500;letter-spacing:-.03em;margin:7px 0}.drawerMeta{display:flex;gap:7px;flex-wrap:wrap}.drawerMeta span{padding:6px 8px;border-radius:999px;background:#ece4d9;font-size:7px;color:#6e655c}.stayVisual{margin-top:26px;display:grid;grid-template-columns:1fr 1.4fr 1fr;align-items:center;padding:20px;border-radius:16px;background:#173d38;color:#fff}.stayVisual>div small{display:block;font-size:6px;color:#a9c0b7}.stayVisual>div b{font-family:Georgia,serif;font-size:24px;font-weight:500}.stayVisual>div:last-child{text-align:right}.stayVisual i{height:1px;background:rgba(255,255,255,.25);position:relative}.stayVisual i span{position:absolute;left:50%;top:-11px;transform:translateX(-50%);white-space:nowrap;background:#173d38;padding:4px 7px;font-size:7px;color:#d1b18c}.drawerInfo{margin-top:18px}.infoRow{display:flex;justify-content:space-between;padding:11px 2px;border-bottom:1px solid rgba(70,60,50,.09);font-size:9px}.infoRow span{color:#857b71}.drawerActions{display:grid;gap:8px;margin-top:22px}.drawerActions button{border:1px solid rgba(70,60,50,.13);background:white;border-radius:11px;padding:11px;font-size:9px;font-weight:850;color:var(--forest);cursor:pointer}.drawerActions button.checkin{border:0;background:var(--emerald);color:white}
        .newReservationModal{width:min(520px,calc(100% - 28px));margin:auto;background:#f8f3eb;border-radius:22px;padding:30px;position:relative;box-shadow:0 30px 100px rgba(0,0,0,.24)}.newReservationModal label{display:grid;gap:6px;margin-top:12px;font-size:8px;font-weight:850;color:#6f665c}.newReservationModal input,.newReservationModal select{width:100%;border:1px solid rgba(70,60,50,.13);background:white;border-radius:10px;padding:10px 11px;font-size:10px;outline:0;color:var(--ink)}.formGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pricePreview{display:flex;justify-content:space-between;align-items:center;margin-top:17px;padding:13px 14px;border-radius:12px;background:#ece4d8}.pricePreview span{font-size:8px;color:#746b62}.pricePreview b{font-family:Georgia,serif;font-size:19px;font-weight:500}.createButton{width:100%;margin-top:12px;border:0;border-radius:11px;background:linear-gradient(135deg,#1d4a42,#12362f);color:white;padding:12px;font-size:9px;font-weight:900;cursor:pointer}.toast{position:fixed;right:24px;bottom:24px;z-index:200;padding:12px 15px;border-radius:12px;background:#173d38;color:white;font-size:9px;font-weight:800;box-shadow:0 16px 40px rgba(13,45,40,.22)}
        @media(max-width:1180px){.searchBox{display:none}.roomsGrid,.connectionGrid{grid-template-columns:repeat(2,1fr)}.roomChips{grid-template-columns:repeat(4,1fr)}}
        @media(max-width:900px){.side{width:76px;padding-left:8px;padding-right:8px}.brandBlock>div:last-child,.propertyCard,.side nav button:not(.active){font-size:0}.side nav button{justify-content:center}.side nav button span{font-size:15px}.side nav button.active{font-size:0}.sideBottom .shift div,.roleSwitch{display:none}.workspace{margin-left:76px}.topbar{padding:0 14px}.topActions .glassButton{display:none}.content{padding:16px 14px 45px}.dashboardGrid{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}.welcomePanel{padding:24px}.pulseOrb{width:110px;height:110px;flex-basis:110px}.todayColumns{grid-template-columns:1fr}.smart,.today{grid-column:1/-1}.roomChips{grid-template-columns:repeat(4,1fr)}}
        @media(max-width:650px){.topbar{height:auto;min-height:84px;align-items:flex-start;padding-top:14px;padding-bottom:14px}.topbar h1{font-size:19px}.topActions{margin-left:auto}.primaryButton{font-size:0;width:40px;padding:0}.primaryButton:after{content:"+";font-size:18px}.welcomePanel{display:block}.welcomeCopy h2{font-size:29px}.pulseOrb{margin-top:22px}.metrics{grid-template-columns:1fr 1fr}.roomsGrid,.connectionGrid{grid-template-columns:1fr}.roomChips{grid-template-columns:repeat(2,1fr)}.calendarToolbar,.listHeader,.revenueHero,.connectionsHero{display:block}.calendarNav,.roomSummary,.revenueValue,.coreOrb{margin-top:16px}.reservationRow{grid-template-columns:34px 1fr auto}.reservationRow>div:not(.guestAvatar):not(.guestMain),.reservationRow>.statusPill{display:none}.formGrid{grid-template-columns:1fr}.modalBackdrop{justify-content:center}.reservationDrawer{width:100%}.rateRow{grid-template-columns:1fr 1fr}.rateRow p{grid-column:1/-1}}
      `}</style>
    </div>
  )
}

function Metric({ label, value, detail, tone }) {
  return <article className={`metric card ${tone}`}><small>{label.toUpperCase()}</small><strong>{value}</strong><span>{detail}</span></article>
}

function OperationColumn({ title, tone, items, onSelect }) {
  return <div className={`operationColumn ${tone}`}><div className="operationTitle"><b>{title}</b><span /></div>{items.length ? items.slice(0,3).map(item => <button className="miniGuest" key={item.id} onClick={() => onSelect(item)}><b>{item.guest}</b><span>Hab. {item.roomId} · {item.id}</span></button>) : <div className="emptyMini">Sin movimientos</div>}</div>
}

function Info({ label, value }) {
  return <div className="infoRow"><span>{label}</span><b>{value}</b></div>
}
