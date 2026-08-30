import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "HL_CALENDAR_OCCUPIED_ROOM_V6"

function replaceMaybe(source, from, to, label) {
  if (!source.includes(from)) {
    console.log(`Skip ${label}: pattern not found`)
    return source
  }
  console.log(`Applied ${label}`)
  return source.replace(from, to)
}

// v5 deja el estado de housekeeping limpio, sin "reservada" ni "ocupada".
// A partir de ahora "ocupada" es dinámico: aparece solamente cuando la reserva
// está efectivamente alojada (check-in) y la fecha de hoy está dentro de la estadía.
const oldVisual = `  function estadoHabitacionVisual(habitacion) {
    const manual = estadoHabitacionManual(habitacion.id)
    if (manual === "sucia") return "sucia"
    if (manual === "en_limpieza") return "en_limpieza"
    return "libre"
  }`

const newVisual = `  function estadoHabitacionVisual(habitacion) {
    const manual = estadoHabitacionManual(habitacion.id)
    if (manual === "sucia") return "sucia"
    if (manual === "en_limpieza") return "en_limpieza"

    const hoy = fechaLocal(0)
    const ocupadaPorCheckin = reservas.some((r) =>
      String(r.habitacion_id) === String(habitacion.id) &&
      ["alojado", "check-in", "checkin", "in_house"].includes(String(r.estado || "").toLowerCase()) &&
      !r.no_show &&
      r.fecha_entrada <= hoy &&
      r.fecha_salida > hoy
    )

    if (ocupadaPorCheckin) return "ocupada"
    return "libre"
  }`

if (text.includes(oldVisual)) text = text.replace(oldVisual, newVisual)

const oldDot = `                        background: info.color,`
const newDot = `                        background: estado === "ocupada" ? colors.blue : info.color,`
if (text.includes(oldDot)) text = text.replace(oldDot, newDot)

// -----------------------------------------------------------------------------
// Habitación Llena · paquete de correcciones de producción (agosto 2026)
// Se concentra en este último migrador para evitar múltiples deployments.
// -----------------------------------------------------------------------------

// 1) Vehículos: persistir cantidad + tipo + dominio al editar/crear reserva.
text = replaceMaybe(
  text,
  `          vehiculos: Number(vehiculos) || 0,\n          cochera_total: calculo.cochera,`,
  `          vehiculos: Number(vehiculos) || 0,\n          tipo_vehiculo: tipoVehiculo || null,\n          dominio_vehiculo: dominioVehiculo.trim().toUpperCase() || null,\n          cochera_total: calculo.cochera,`,
  "vehicle persistence"
)

// 2) Modal/ficha de reserva: scroll real para ver notas, pagos y acciones completas.
text = replaceMaybe(
  text,
  `              overflow: "hidden",\n              borderRadius: "18px 18px 0 0",`,
  `              overflowY: "auto",\n              overflowX: "hidden",\n              overscrollBehavior: "contain",\n              borderRadius: "18px 18px 0 0",`,
  "reservation sheet scroll"
)
text = replaceMaybe(
  text,
  `              overflow: "hidden",\n              marginTop: 8,\n            }} className="reservation-sheet-grid">`,
  `              overflowY: "auto",\n              overflowX: "auto",\n              paddingBottom: 12,\n              marginTop: 8,\n            }} className="reservation-sheet-grid">`,
  "reservation grid scroll"
)

// 3) Calendario: sacar el segundo juego de controles de fecha; Calendario() conserva
// el único control de Hoy / flechas / selector / 7-14-30 días.
const duplicateCalendarControls = `              <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
                <button type="button" onClick={() => setFechaCalendario(fechaLocal(0))} style={secondaryButton}>Hoy</button>
                <button type="button" onClick={() => { const d = new Date(\`${'${fechaCalendario}'}T12:00:00\`); d.setDate(d.getDate() - 7); setFechaCalendario(d.toISOString().slice(0,10)) }} style={secondaryButton}>← 7 días</button>
                <input type="date" value={fechaCalendario} onChange={(e) => setFechaCalendario(e.target.value)} style={{ ...inputStyle, width: 160 }} />
                <button type="button" onClick={() => { const d = new Date(\`${'${fechaCalendario}'}T12:00:00\`); d.setDate(d.getDate() + 7); setFechaCalendario(d.toISOString().slice(0,10)) }} style={secondaryButton}>7 días →</button>
              </div>`
if (text.includes(duplicateCalendarControls)) {
  text = text.replace(duplicateCalendarControls, "")
  console.log("Applied duplicate calendar controls removal")
}

// 4) Check-out anticipado: la fecha real de salida pasa a ser hoy, recalcula la
// estadía y el calendario se acorta inmediatamente. Conserva extras y descuentos.
const checkoutUpdateOld = `    const { error } = await supabase
      .from("reservas")
      .update({ estado: "finalizada" })
      .eq("id", reserva.id)`
const checkoutUpdateNew = `    const hoyCheckout = fechaLocal(0)
    const salidaReal = hoyCheckout < reserva.fecha_salida ? hoyCheckout : reserva.fecha_salida
    const nochesReales = Math.max(1, diasEntre(reserva.fecha_entrada, salidaReal))
    const tarifaNocheReal = Number(reserva.tarifa_noche || tarifaDeHabitacion(reserva.habitacion_id) || 0)
    const tarifaHabitacionReal = datosTarifaHabitacion(reserva.habitacion_id)
    const cocheraReal = Number(reserva.vehiculos || 0) * Number(tarifaHabitacionReal.cochera || 0) * nochesReales
    const baseReal = tarifaNocheReal * nochesReales + cocheraReal + Number(reserva.early_checkin_importe || 0) + Number(reserva.late_checkout_importe || 0) + Number(reserva.extra || 0)
    const descuentoReal = reserva.descuento_tipo === "porcentaje"
      ? baseReal * Number(reserva.descuento_valor || 0) / 100
      : Number(reserva.descuento_valor || 0)
    const totalReal = Math.max(0, baseReal - descuentoReal)
    const tcReal = Number(reserva.tipo_cambio || 1) || 1

    const { error } = await supabase
      .from("reservas")
      .update({
        estado: "finalizada",
        fecha_salida: salidaReal,
        checkout_real_at: new Date().toISOString(),
        noches: nochesReales,
        cochera_total: cocheraReal,
        subtotal: baseReal,
        descuento_importe: descuentoReal,
        precio_total: totalReal,
        precio_total_usd: totalReal / tcReal,
      })
      .eq("id", reserva.id)`
text = replaceMaybe(text, checkoutUpdateOld, checkoutUpdateNew, "early checkout calendar shrink")
text = replaceMaybe(
  text,
  `    const reservaFinalizada = { ...reserva, estado: "finalizada" }`,
  `    const reservaFinalizada = { ...reserva, estado: "finalizada", fecha_salida: salidaReal, checkout_real_at: new Date().toISOString(), noches: nochesReales, cochera_total: cocheraReal, subtotal: baseReal, descuento_importe: descuentoReal, precio_total: totalReal, precio_total_usd: totalReal / tcReal }`,
  "early checkout local state"
)

// 5) Reportes dentro de Recepción + exportación CSV de IN/OUT.
const recepcionHelperMarker = `  function Recepcion() {`
if (text.includes(recepcionHelperMarker) && !text.includes("function descargarReporteRecepcionCSV")) {
  const helper = `  function descargarReporteRecepcionCSV(tipo = "checkin") {
    const esIn = tipo === "checkin"
    const lista = reservas
      .filter((r) => r.estado !== "cancelada" && !r.no_show)
      .sort((a, b) => String(esIn ? a.fecha_entrada : a.fecha_salida).localeCompare(String(esIn ? b.fecha_entrada : b.fecha_salida)))
    const filas = [["Reserva", "Huésped", "Habitación", esIn ? "Check-in" : "Check-out", "Teléfono", "Estado"], ...lista.map((r) => [
      r.numero_reserva || "",
      r.nombre_huesped || "",
      nombreHabitacion(r.habitacion_id),
      esIn ? r.fecha_entrada : r.fecha_salida,
      r.telefono_huesped || "",
      estadoBadge(r.estado).label,
    ])]
    const csv = filas.map((fila) => fila.map((v) => '"' + String(v ?? "").replaceAll('"', '""') + '"').join(",")).join("\\n")
    const blob = new Blob(["\\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = \`habitacion-llena-${'${tipo}'}-${'${fechaLocal(0)}'}.csv\`
    a.click()
    URL.revokeObjectURL(url)
  }

`
  text = text.replace(recepcionHelperMarker, helper + recepcionHelperMarker)
}
if (!text.includes('["reportes","📊 Reportes"]') && !text.includes('["reportes","📄 Reportes"]')) {
  text = replaceMaybe(
    text,
    `              ["caja","💵 Caja diaria"],`,
    `              ["caja","💵 Caja diaria"],\n              ["reportes","📊 Reportes"],`,
    "reception reports tab"
  )
}
const receptionReportsAnchor = `          {recepcionSeccion === "caja" && (`
if (text.includes(receptionReportsAnchor) && !text.includes('recepcionSeccion === "reportes"')) {
  const reportsSection = `          {recepcionSeccion === "reportes" && (
            <section style={cardStyle}>
              <div style={sectionHeader}><div><h2 style={{ margin: 0 }}>📊 Reportes de recepción</h2><div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Descargá planillas de entradas y salidas para recepción.</div></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
                <div style={{ border: \`1px solid ${'${colors.border}'}\`, borderRadius: 12, padding: 16 }}><strong>Check-in</strong><p style={{ color: colors.muted, fontSize: 12 }}>Reservas y huéspedes ordenados por fecha de entrada.</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button onClick={() => imprimirPlanillaIn()} style={secondaryButton}>🖨 Imprimir IN de hoy</button><button onClick={() => descargarReporteRecepcionCSV("checkin")} style={primaryButton}>↓ Descargar CSV</button></div></div>
                <div style={{ border: \`1px solid ${'${colors.border}'}\`, borderRadius: 12, padding: 16 }}><strong>Check-out</strong><p style={{ color: colors.muted, fontSize: 12 }}>Salidas programadas y finalizadas ordenadas por fecha.</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button onClick={() => imprimirHousekeeping()} style={secondaryButton}>🖨 Imprimir OUT / Housekeeping</button><button onClick={() => descargarReporteRecepcionCSV("checkout")} style={primaryButton}>↓ Descargar CSV</button></div></div>
              </div>
            </section>
          )}

`
  text = text.replace(receptionReportsAnchor, reportsSection + receptionReportsAnchor)
  console.log("Applied reception reports section")
}

// 6) IA: autenticar correctamente el endpoint y enviar más contexto del tenant.
const oldAssistantFetch = `      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: pregunta, context: { ...contexto, plataforma: "Habitación Llena PMS", instruccionesAyuda: "Respondé también preguntas sobre cómo usar la plataforma. Explicá paso a paso dónde debe tocar el usuario para crear habitaciones, configurar tarifas, hacer reservas, bloquear habitaciones, usar housekeeping, check-in/check-out, configurar integraciones, bandeja de entrada y asistencia humana. No inventes funciones que no existan. Si la consulta requiere una conexión externa todavía no implementada, indicá que debe configurarse en la etapa de integración correspondiente." } }),
      })`
const newAssistantFetch = `      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("La sesión expiró. Volvé a iniciar sesión.")
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: \`Bearer ${'${session.access_token}'}\` },
        body: JSON.stringify({ question: pregunta, context: { ...contexto, plataforma: "Habitación Llena PMS", instruccionesAyuda: "Respondé sobre el uso integral del PMS y sobre los datos reales del alojamiento del usuario. Tenés calendario, reservas, huéspedes, habitaciones, housekeeping, bloqueos, recepción, caja, pagos divididos en varios movimientos, early check-in, late check-out, vehículos, extras, notas, reportes, comunicaciones e integraciones. Interpretá fechas, nombres y estados. Nunca mezcles datos entre tenants. No inventes datos ni funciones; si falta una integración externa, explicalo con claridad." } }),
      })`
text = replaceMaybe(text, oldAssistantFetch, newAssistantFetch, "assistant auth/context")
text = text.replace(`      reservas: reservas.slice(0, 100).map((r) => ({`, `      reservas: reservas.slice(0, 500).map((r) => ({`)

// 7) Notificación de nuevas reservas en tiempo real.
if (!text.includes("const [reservasNuevasPendientes")) {
  text = text.replace(
    `  const [webIntegracion, setWebIntegracion] = useState("propia")`,
    `  const [webIntegracion, setWebIntegracion] = useState("propia")\n  const [reservasNuevasPendientes, setReservasNuevasPendientes] = useState(0)\n  const [avisoReservaNueva, setAvisoReservaNueva] = useState(null)`
  )
}
const realtimeAnchor = `  async function cargarDatos() {`
if (text.includes(realtimeAnchor) && !text.includes("hl-reservas-realtime")) {
  const realtimeEffect = `  useEffect(() => {
    if (!user?.id) return
    const channel = supabase.channel("hl-reservas-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservas" }, (payload) => {
        const nueva = payload?.new
        if (!nueva) return
        const propiedades = new Set(alojamientos.map((a) => String(a.property_id || "")).filter(Boolean))
        const alojamientosIds = new Set(alojamientos.map((a) => String(a.id)))
        if ((nueva.property_id && propiedades.has(String(nueva.property_id))) || alojamientosIds.has(String(nueva.alojamiento_id))) {
          setReservasNuevasPendientes((n) => n + 1)
          setAvisoReservaNueva(nueva)
          cargarDatos()
          window.setTimeout(() => setAvisoReservaNueva(null), 9000)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, alojamientos.length])

`
  text = text.replace(realtimeAnchor, realtimeEffect + realtimeAnchor)
}
const headerActionsAnchor = `        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>`
if (text.includes(headerActionsAnchor) && !text.includes("Reservas nuevas pendientes")) {
  text = text.replace(
    headerActionsAnchor,
    `        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>\n          <button type="button" title="Reservas nuevas pendientes" onClick={() => { setReservasNuevasPendientes(0); setVista("reservas") }} style={{ ...topActionButton, position: "relative", minWidth: 42, padding: "9px 11px" }}>🔔{reservasNuevasPendientes > 0 && <span style={{ position: "absolute", right: -5, top: -6, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 99, display: "grid", placeItems: "center", background: colors.red, color: "#fff", fontSize: 9, fontWeight: 900 }}>{reservasNuevasPendientes}</span>}</button>`
  )
}
const mainCloseAnchor = `</main>`
if (text.includes(mainCloseAnchor) && !text.includes("Nueva reserva recibida")) {
  text = text.replace(
    mainCloseAnchor,
    `{avisoReservaNueva && <div style={{ position: "fixed", right: 18, top: 86, zIndex: 120, width: "min(380px,calc(100vw - 36px))", background: colors.white, border: \`1px solid ${'${colors.border}'}\`, borderRadius: 14, boxShadow: "0 18px 45px rgba(15,23,42,.2)", padding: 15 }}><div style={{ color: colors.green, fontSize: 11, fontWeight: 900 }}>● NUEVA RESERVA RECIBIDA</div><strong style={{ display: "block", marginTop: 5 }}>{avisoReservaNueva.nombre_huesped || "Nueva reserva"}</strong><div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{avisoReservaNueva.numero_reserva || ""} · {formatearFecha(avisoReservaNueva.fecha_entrada)} → {formatearFecha(avisoReservaNueva.fecha_salida)}</div><button onClick={() => { setAvisoReservaNueva(null); setReservasNuevasPendientes(0); setVista("reservas") }} style={{ ...primaryButton, marginTop: 10, padding: "7px 11px" }}>Ver reserva</button></div>}\n\n${mainCloseAnchor}`
  )
}

// 8) Estado luminoso + pagos más visibles + aclaración de pagos divididos.
const reservationTitleAnchor = `                <div style={{ color: colors.blue, fontWeight: 800, fontSize: 12, marginTop: 4 }}>{reservaSeleccionada.numero_reserva || "Sin número"}</div>`
if (text.includes(reservationTitleAnchor) && !text.includes("ESTADO ACTUAL")) {
  text = text.replace(
    reservationTitleAnchor,
    `${reservationTitleAnchor}\n                <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, padding: "7px 12px", background: reservaSeleccionada.estado === "alojado" ? "#86efac" : reservaSeleccionada.estado === "finalizada" ? "#fca5a5" : "#fde68a", color: "#111827", fontWeight: 900, fontSize: 11, boxShadow: reservaSeleccionada.estado === "alojado" ? "0 0 18px rgba(34,197,94,.45)" : reservaSeleccionada.estado === "finalizada" ? "0 0 18px rgba(239,68,68,.35)" : "0 0 18px rgba(245,158,11,.35)" }}><span style={{ width: 8, height: 8, borderRadius: 99, background: reservaSeleccionada.estado === "alojado" ? "#16a34a" : reservaSeleccionada.estado === "finalizada" ? "#dc2626" : "#d97706" }} />ESTADO ACTUAL · {reservaSeleccionada.no_show ? "NO SHOW" : estadoBadge(reservaSeleccionada.estado).label.toUpperCase()}</div>`
  )
}
text = text.replace(
  `<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><div style={{ padding: 10, background: colors.greenSoft, borderRadius: 8 }}>`,
  `<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, fontSize: 15 }}><div style={{ padding: 13, background: colors.greenSoft, borderRadius: 8 }}>`
)
text = text.replace(
  `<button onClick={()=>registrarPago(reservaSeleccionada)} style={{ ...primaryButton, width:"100%", marginTop:8 }} disabled={saldoReserva(reservaSeleccionada)<=0}>＋ Registrar pago</button>`,
  `<div style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>Podés dividir el pago registrando varios movimientos con distintos medios (por ejemplo efectivo + transferencia).</div><button onClick={()=>registrarPago(reservaSeleccionada)} style={{ ...primaryButton, width:"100%", marginTop:8 }} disabled={saldoReserva(reservaSeleccionada)<=0}>＋ Registrar pago</button>`
)

// 9) Cambiar habitación / upgrade desde una reserva ya creada.
if (!text.includes("async function cambiarHabitacionRapido")) {
  const anchor = `  async function cancelarReserva(reserva) {`
  const helper = `  async function cambiarHabitacionRapido(reserva, soloUpgrade = false) {
    const actual = habitaciones.find((h) => String(h.id) === String(reserva.habitacion_id))
    const precioActual = Number(datosTarifaHabitacion(actual?.id).precio || 0)
    const candidatas = habitacionesDisponibles.filter((h) => String(h.id) !== String(reserva.habitacion_id) && (!soloUpgrade || Number(datosTarifaHabitacion(h.id).precio || 0) > precioActual))
    if (!candidatas.length) return alert(soloUpgrade ? "No hay habitaciones de tarifa superior disponibles para ofrecer como upgrade." : "No hay otras habitaciones disponibles.")
    const detalle = candidatas.map((h) => \`${'${h.id}'} · ${'${h.nombre}'} · ${'${h.tipo || "Sin tipo"}'} · $${'${Number(datosTarifaHabitacion(h.id).precio || 0).toLocaleString("es-AR")}'}\`).join("\\n")
    const elegido = window.prompt((soloUpgrade ? "UPGRADE" : "CAMBIO DE HABITACIÓN") + "\\nIngresá el ID de la habitación destino:\\n\\n" + detalle)
    if (!elegido) return
    const destino = candidatas.find((h) => String(h.id) === String(elegido).trim())
    if (!destino) return alert("La habitación elegida no es válida.")
    const conflicto = reservas.some((r) => String(r.id) !== String(reserva.id) && r.estado !== "cancelada" && !r.no_show && String(r.habitacion_id) === String(destino.id) && bloquesSeCruzan(reserva.fecha_entrada, reserva.fecha_salida, r.fecha_entrada, r.fecha_salida))
    if (conflicto) return alert("La habitación elegida tiene una reserva que se cruza con estas fechas.")
    const nuevaTarifa = Number(datosTarifaHabitacion(destino.id).precio || 0)
    const noches = Math.max(1, diasEntre(reserva.fecha_entrada, reserva.fecha_salida))
    const subtotal = nuevaTarifa * noches + Number(reserva.cochera_total || 0) + Number(reserva.early_checkin_importe || 0) + Number(reserva.late_checkout_importe || 0) + Number(reserva.extra || 0)
    const descuento = reserva.descuento_tipo === "porcentaje" ? subtotal * Number(reserva.descuento_valor || 0) / 100 : Number(reserva.descuento_valor || 0)
    const total = Math.max(0, subtotal - descuento)
    const { error } = await supabase.from("reservas").update({ habitacion_id: destino.id, tarifa_noche: nuevaTarifa, subtotal, descuento_importe: descuento, precio_total: total, precio_total_usd: total / (Number(reserva.tipo_cambio || 1) || 1) }).eq("id", reserva.id)
    if (error) { console.error(error); return alert("No se pudo cambiar la habitación.") }
    setReservaSeleccionada(null)
    await cargarDatos()
  }

`
  if (text.includes(anchor)) text = text.replace(anchor, helper + anchor)
}
const editButtonAnchor = `              <button onClick={() => editarReserva(reservaSeleccionada)} style={secondaryButton}>
                Editar reserva
              </button>`
if (text.includes(editButtonAnchor) && !text.includes("Upgrade")) {
  text = text.replace(
    editButtonAnchor,
    `<button onClick={() => cambiarHabitacionRapido(reservaSeleccionada, false)} style={secondaryButton}>⇄ Cambio de habitación</button><button onClick={() => cambiarHabitacionRapido(reservaSeleccionada, true)} style={{ ...secondaryButton, color: "#7c3aed", borderColor: "#c4b5fd" }}>↑ Upgrade</button>\n${editButtonAnchor}`
  )
}

// 10) Early / late y cochera se guardan en la habitación (Supabase), no solo localStorage.
text = text.replace(
  `      precio: Number(guardada.precio ?? habitacion?.precio ?? precioAnterior ?? 0),\n      cochera: Number(guardada.cochera ?? config.tarifas?.cochera ?? 0),\n      earlyTipo: guardada.earlyTipo || "monto",\n      earlyValor: Number(guardada.earlyValor ?? config.earlyCheckin?.valor ?? 0),\n      lateTipo: guardada.lateTipo || "monto",\n      lateValor: Number(guardada.lateValor ?? config.lateCheckout?.valor ?? 0),`,
  `      precio: Number(habitacion?.precio ?? guardada.precio ?? precioAnterior ?? 0),\n      cochera: Number(habitacion?.cochera_precio ?? guardada.cochera ?? config.tarifas?.cochera ?? 0),\n      earlyTipo: habitacion?.early_checkin_tipo || guardada.earlyTipo || "monto",\n      earlyValor: Number(habitacion?.early_checkin_valor ?? guardada.earlyValor ?? config.earlyCheckin?.valor ?? 0),\n      lateTipo: habitacion?.late_checkout_tipo || guardada.lateTipo || "monto",\n      lateValor: Number(habitacion?.late_checkout_valor ?? guardada.lateValor ?? config.lateCheckout?.valor ?? 0),`
)
if (!text.includes("earlyTipo: \"monto\",")) {
  // previous migration may already have expanded the form; no-op
}
text = text.replace(
  `    precio: 0,\n  })`,
  `    precio: 0,\n    cochera: 0,\n    earlyTipo: "monto",\n    earlyValor: 0,\n    lateTipo: "monto",\n    lateValor: 0,\n  })`
)
text = text.replace(
  `      precio: tarifa.precio,\n    })`,
  `      precio: tarifa.precio,\n      cochera: tarifa.cochera,\n      earlyTipo: tarifa.earlyTipo,\n      earlyValor: tarifa.earlyValor,\n      lateTipo: tarifa.lateTipo,\n      lateValor: tarifa.lateValor,\n    })`
)
text = text.replace(
  `        alojamiento_id: Number(habitacionForm.alojamiento_id),\n      })`,
  `        alojamiento_id: Number(habitacionForm.alojamiento_id),\n        precio: Number(habitacionForm.precio) || 0,\n        cochera_precio: Number(habitacionForm.cochera) || 0,\n        early_checkin_tipo: habitacionForm.earlyTipo || "monto",\n        early_checkin_valor: Number(habitacionForm.earlyValor) || 0,\n        late_checkout_tipo: habitacionForm.lateTipo || "monto",\n        late_checkout_valor: Number(habitacionForm.lateValor) || 0,\n      })`
)

// 11) Responsive extra para notebooks/tablets/celulares.
const cssAnchor = `        @media (max-width: 760px) {`
if (text.includes(cssAnchor) && !text.includes(".hl-app main > *")) {
  text = text.replace(
    cssAnchor,
    `        @media (max-width: 1180px) {\n          .app-header { gap: 10px; }\n          .app-header > div:last-child { flex-wrap: wrap; justify-content: flex-end; }\n          .hl-app main > * { max-width: 100vw; }\n        }\n        @media (max-width: 760px) {`
  )
}

fs.writeFileSync(path, text)

// Landing pública: botón de inicio de sesión visible y CTA de prueba actualizado.
const landingPath = "app/page.jsx"
if (fs.existsSync(landingPath)) {
  let landing = fs.readFileSync(landingPath, "utf8")
  landing = landing.replace(
    `<a href="#contacto" className="cta">Probar gratis</a>`,
    `<Link href="/login" className="loginLink">Iniciar sesión</Link><a href="#contacto" className="cta">Probar gratis</a>`
  )
  landing = landing.replaceAll("Probá gratis 14 días", "Probá gratis 30 días")
  landing = landing.replaceAll("Prueba gratis 14 días", "Prueba gratis 30 días")
  landing = landing.replace(
    `.links .cta,.primary{`,
    `.links .loginLink{font-size:14px;font-weight:850;color:#1264d6;text-decoration:none;border:1px solid #bfd3ef;padding:10px 14px;border-radius:10px;background:#fff}.links .cta,.primary{`
  )
  landing = landing.replace(
    `@media(max-width:900px){.links a:not(.cta){display:none}`,
    `@media(max-width:900px){.links a:not(.cta):not(.loginLink){display:none}`
  )
  fs.writeFileSync(landingPath, landing)
  console.log("Applied landing login / trial CTA")
}

// Asistente: ampliar conocimiento operativo y mantener respuesta por tenant.
const assistantPath = "app/api/assistant/route.js"
if (fs.existsSync(assistantPath)) {
  let assistant = fs.readFileSync(assistantPath, "utf8")
  assistant = assistant.replace(
    `    reservas: Array.isArray(context.reservas) ? context.reservas.slice(-300) : [],`,
    `    reservas: Array.isArray(context.reservas) ? context.reservas.slice(-500) : [],`
  )
  if (!assistant.includes("Conocés el funcionamiento del PMS")) {
    assistant = assistant.replace(
      `- Podés hacer recomendaciones operativas, aclarando que son recomendaciones.`,
      `- Podés hacer recomendaciones operativas, aclarando que son recomendaciones.\n- Conocés el funcionamiento del PMS: calendario, reservas, huéspedes, habitaciones, housekeeping, bloqueos, recepción, caja, pagos parciales/divididos, early check-in, late check-out, vehículos, extras, notas, reportes, comunicaciones e integraciones.\n- Interpretá nombres, fechas y estados usando los datos del tenant autenticado. Nunca mezcles información entre alojamientos o usuarios.`
    )
  }
  fs.writeFileSync(assistantPath, assistant)
  console.log("Applied assistant operational knowledge")
}

console.log("Habitación Llena production fixes applied")
