import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "HL_BLOCK1_FINAL_V7"

function replaceOnce(from, to, label) {
  if (!text.includes(from)) {
    console.log(`Skip ${label}: pattern not found`)
    return
  }
  text = text.replace(from, to)
  console.log(`Applied ${label}`)
}

if (!text.includes(marker)) {
  // State: reserva multi-habitación + servicios detallados.
  replaceOnce(
    `  const [habitacionSeleccionada, setHabitacionSeleccionada] = useState("")`,
    `  const [habitacionSeleccionada, setHabitacionSeleccionada] = useState("")\n  const [habitacionesAdicionales, setHabitacionesAdicionales] = useState([])\n  const [serviciosReserva, setServiciosReserva] = useState([])\n  const ${marker} = true`,
    "multi-room/service state"
  )

  // Helpers para que una reserva pueda ocupar más de una habitación.
  replaceOnce(
    `  function bloquesSeCruzan(inicioA, finA, inicioB, finB) {\n    return inicioA < finB && finA > inicioB\n  }`,
    `  function bloquesSeCruzan(inicioA, finA, inicioB, finB) {\n    return inicioA < finB && finA > inicioB\n  }\n\n  function idsHabitacionesReserva(reserva) {\n    const ids = Array.isArray(reserva?.habitaciones_ids) && reserva.habitaciones_ids.length\n      ? reserva.habitaciones_ids\n      : (reserva?.habitacion_id ? [reserva.habitacion_id] : [])\n    return [...new Set(ids.map((id) => String(id)).filter(Boolean))]\n  }\n\n  function reservaIncluyeHabitacion(reserva, habitacionId) {\n    return idsHabitacionesReserva(reserva).includes(String(habitacionId))\n  }\n\n  function habitacionesElegidasFormulario() {\n    return [...new Set([habitacionSeleccionada, ...habitacionesAdicionales].map(String).filter(Boolean))]\n  }\n\n  function normalizarServiciosReserva(lista = serviciosReserva) {\n    return (Array.isArray(lista) ? lista : []).map((s, index) => ({\n      id: s.id || \`srv_${'${Date.now()}'}_${'${index}'}\`,\n      tipo: s.tipo || "extra",\n      descripcion: String(s.descripcion || "").trim(),\n      cantidad: Math.max(1, Number(s.cantidad || 1)),\n      dias: Math.max(1, Number(s.dias || 1)),\n      precio_unitario: Math.max(0, Number(s.precio_unitario || 0)),\n    }))\n  }\n\n  function totalServiciosReserva(lista = serviciosReserva) {\n    return normalizarServiciosReserva(lista).reduce((acc, s) => acc + s.cantidad * s.dias * s.precio_unitario, 0)\n  }\n\n  function agregarServicioReserva(tipo = "extra") {\n    setServiciosReserva((actual) => [...actual, { id: \`srv_${'${Date.now()}'}_${'${Math.random().toString(36).slice(2,7)}'}\`, tipo, descripcion: "", cantidad: 1, dias: 1, precio_unitario: 0 }])\n  }\n\n  function actualizarServicioReserva(id, campo, valor) {\n    setServiciosReserva((actual) => actual.map((s) => s.id === id ? { ...s, [campo]: valor } : s))\n  }\n\n  function quitarServicioReserva(id) {\n    setServiciosReserva((actual) => actual.filter((s) => s.id !== id))\n  }`,
    "multi-room helpers"
  )

  // Cálculo integral: suma todas las habitaciones y servicios por cantidad/días.
  const oldCalc = `  function calcularImporteReserva() {\n    if (!habitacionSeleccionada || !fechaEntrada || !fechaSalida) {\n      const extra = Number(extraReserva) || 0\n      return { noches: 0, tarifaNoche: 0, alojamiento: 0, cochera: 0, early: 0, late: 0, extra, descuento: 0, subtotal: extra, total: extra, totalUSD: 0, tipoCambio: Number(tipoCambioReserva || config.tipoCambioUSD || 1) || 1 }\n    }\n\n    const noches = diasEntre(fechaEntrada, fechaSalida)\n    const tarifaHabitacion = datosTarifaHabitacion(habitacionSeleccionada)\n    const tarifaNoche = tarifaHabitacion.precio\n    const alojamiento = tarifaNoche * noches\n    const cochera = (Number(vehiculos) || 0) * tarifaHabitacion.cochera * noches\n    const early = earlyCheckin\n      ? calcularRecargoServicio(tarifaNoche, { tipo: tarifaHabitacion.earlyTipo, valor: tarifaHabitacion.earlyValor })\n      : 0\n    const late = lateCheckout\n      ? calcularRecargoServicio(tarifaNoche, { tipo: tarifaHabitacion.lateTipo, valor: tarifaHabitacion.lateValor })\n      : 0\n    const extra = Number(extraReserva) || 0\n    const subtotal = alojamiento + cochera + early + late + extra\n    const descuento = descuentoTipo === "porcentaje"\n      ? subtotal * (Number(descuentoValor) || 0) / 100\n      : Number(descuentoValor) || 0\n    const total = Math.max(0, subtotal - descuento)\n    const tipoCambio = Number(tipoCambioReserva || config.tipoCambioUSD || 1) || 1\n\n    return { noches, tarifaNoche, alojamiento, cochera, early, late, extra, descuento, subtotal, total, totalUSD: total / tipoCambio, tipoCambio }\n  }`
  const newCalc = `  function calcularImporteReserva() {\n    const servicios = normalizarServiciosReserva()\n    const serviciosTotal = totalServiciosReserva(servicios)\n    const extraManual = Number(extraReserva) || 0\n    if (!habitacionSeleccionada || !fechaEntrada || !fechaSalida) {\n      const extra = extraManual + serviciosTotal\n      return { noches: 0, tarifaNoche: 0, alojamiento: 0, cochera: 0, early: 0, late: 0, extra, extraManual, serviciosTotal, servicios, habitacionesIds: [], habitacionesDetalle: [], descuento: 0, subtotal: extra, total: extra, totalUSD: 0, tipoCambio: Number(tipoCambioReserva || config.tipoCambioUSD || 1) || 1 }\n    }\n\n    const noches = diasEntre(fechaEntrada, fechaSalida)\n    const habitacionesIds = habitacionesElegidasFormulario()\n    const habitacionesDetalle = habitacionesIds.map((id) => {\n      const habitacion = habitaciones.find((h) => String(h.id) === String(id))\n      const tarifa = datosTarifaHabitacion(id)\n      return { habitacion_id: Number(id), nombre: habitacion?.nombre || nombreHabitacion(id), tipo: habitacion?.tipo || "", tarifa_noche: Number(tarifa.precio || 0), noches, subtotal: Number(tarifa.precio || 0) * noches }\n    })\n    const tarifaHabitacion = datosTarifaHabitacion(habitacionSeleccionada)\n    const tarifaNoche = Number(tarifaHabitacion.precio || 0)\n    const alojamiento = habitacionesDetalle.reduce((acc, h) => acc + Number(h.subtotal || 0), 0)\n    const cochera = (Number(vehiculos) || 0) * Number(tarifaHabitacion.cochera || 0) * noches\n    const early = earlyCheckin\n      ? calcularRecargoServicio(tarifaNoche, { tipo: tarifaHabitacion.earlyTipo, valor: tarifaHabitacion.earlyValor })\n      : 0\n    const late = lateCheckout\n      ? calcularRecargoServicio(tarifaNoche, { tipo: tarifaHabitacion.lateTipo, valor: tarifaHabitacion.lateValor })\n      : 0\n    const extra = extraManual + serviciosTotal\n    const subtotal = alojamiento + cochera + early + late + extra\n    const descuento = descuentoTipo === "porcentaje"\n      ? subtotal * (Number(descuentoValor) || 0) / 100\n      : Number(descuentoValor) || 0\n    const total = Math.max(0, subtotal - descuento)\n    const tipoCambio = Number(tipoCambioReserva || config.tipoCambioUSD || 1) || 1\n\n    return { noches, tarifaNoche, alojamiento, cochera, early, late, extra, extraManual, serviciosTotal, servicios, habitacionesIds: habitacionesIds.map(Number), habitacionesDetalle, descuento, subtotal, total, totalUSD: total / tipoCambio, tipoCambio }\n  }`
  replaceOnce(oldCalc, newCalc, "multi-room total calculation")

  // Persistencia principal.
  replaceOnce(
    `      habitacion_id: Number(habitacionSeleccionada),\n      nombre_huesped: nombre.trim(),`,
    `      habitacion_id: Number(habitacionSeleccionada),\n      habitaciones_ids: calculo.habitacionesIds,\n      habitaciones_detalle: calculo.habitacionesDetalle,\n      servicios: calculo.servicios,\n      nombre_huesped: nombre.trim(),`,
    "reservation multi-room payload"
  )

  // Persistencia en el update de importes post-guardado (después del migrador v6).
  replaceOnce(
    `          tarifa_noche: calculo.tarifaNoche,\n          noches: calculo.noches,`,
    `          tarifa_noche: calculo.tarifaNoche,\n          noches: calculo.noches,\n          habitaciones_ids: calculo.habitacionesIds,\n          habitaciones_detalle: calculo.habitacionesDetalle,\n          servicios: calculo.servicios,`,
    "reservation totals multi-room payload"
  )

  // Validación de disponibilidad de todas las habitaciones elegidas.
  replaceOnce(
    `    const calculo = calcularImporteReserva()\n\n    const datos = {`,
    `    const habitacionesAValidar = habitacionesElegidasFormulario()\n    for (const habitacionId of habitacionesAValidar) {\n      const bloqueoExtra = bloqueoParaHabitacion(habitacionId, fechaEntrada, fechaSalida)\n      if (bloqueoExtra) {\n        setMensaje(\`La habitación ${'${nombreHabitacion(habitacionId)}'} está bloqueada del ${'${formatearFecha(bloqueoExtra.fecha_desde)}'} al ${'${formatearFecha(bloqueoExtra.fecha_hasta)}'} (${'${bloqueoExtra.motivo}'}).\`)\n        setCargando(false)\n        return\n      }\n      const conflictoReserva = reservas.some((otra) =>\n        String(otra.id) !== String(reservaId || "") &&\n        otra.estado !== "cancelada" && !otra.no_show &&\n        reservaIncluyeHabitacion(otra, habitacionId) &&\n        bloquesSeCruzan(fechaEntrada, fechaSalida, otra.fecha_entrada, otra.fecha_salida)\n      )\n      if (conflictoReserva) {\n        setMensaje(\`La habitación ${'${nombreHabitacion(habitacionId)}'} ya está ocupada en esas fechas.\`)\n        setCargando(false)\n        return\n      }\n    }\n\n    const calculo = calcularImporteReserva()\n\n    const datos = {`,
    "multi-room availability validation"
  )

  // Edición: recuperar habitaciones y servicios previamente guardados.
  replaceOnce(
    `    setHabitacionSeleccionada(String(reserva.habitacion_id))`,
    `    setHabitacionSeleccionada(String(reserva.habitacion_id))\n    setHabitacionesAdicionales(idsHabitacionesReserva(reserva).filter((id) => String(id) !== String(reserva.habitacion_id)))\n    setServiciosReserva(normalizarServiciosReserva(Array.isArray(reserva.servicios) ? reserva.servicios : []))`,
    "edit multi-room/services"
  )

  // UI selector de habitaciones adicionales.
  const roomField = `                <Field label="Habitación *">\n                  <select\n                    required\n                    value={habitacionSeleccionada}\n                    onChange={(e) => setHabitacionSeleccionada(e.target.value)}\n                    style={inputStyle}\n                    disabled={!alojamientoSeleccionado}\n                  >\n                    <option value="">Seleccionar habitación</option>\n                    {habitacionesDisponibles.map((h) => (\n                      <option key={h.id} value={h.id}>\n                        {h.nombre}{h.tipo ? \` · ${'${h.tipo}'}\` : ""}\n                      </option>\n                    ))}\n                  </select>\n                </Field>`
  const roomFieldNew = `${roomField}\n\n                <Field label="Habitaciones adicionales">\n                  <div style={{ border: \`1px solid ${'${colors.border}'}\`, borderRadius: 9, padding: 10, maxHeight: 150, overflowY: "auto", background: colors.white }}>\n                    {!habitacionSeleccionada ? <div style={{ color: colors.muted, fontSize: 12 }}>Elegí primero la habitación principal.</div> : habitacionesDisponibles.filter((h) => String(h.id) !== String(habitacionSeleccionada)).map((h) => {\n                      const checked = habitacionesAdicionales.includes(String(h.id))\n                      return <label key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 2px", fontSize: 12, cursor: "pointer" }}>\n                        <input type="checkbox" checked={checked} onChange={(e) => setHabitacionesAdicionales((actual) => e.target.checked ? [...new Set([...actual, String(h.id)])] : actual.filter((id) => String(id) !== String(h.id)))} />\n                        <span><strong>{h.nombre}</strong>{h.tipo ? \` · ${'${h.tipo}'}\` : ""} · $ {Number(datosTarifaHabitacion(h.id).precio || 0).toLocaleString("es-AR")}/noche</span>\n                      </label>\n                    })}\n                  </div>\n                </Field>`
  replaceOnce(roomField, roomFieldNew, "multi-room form UI")

  // Servicios detallados: cochera/vehículo, mascota y extras con cantidad/días/precio.
  const summaryAnchor = `                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Resumen de tarifa</div>`
  const servicesUI = `                  <div style={{ marginBottom: 16, padding: 14, border: \`1px solid ${'${colors.border}'}\`, borderRadius: 10, background: colors.bg }}>\n                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>\n                      <div><strong>Servicios / extras detallados</strong><div style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>Cochera, vehículos, mascotas o cualquier adicional con cantidad y días independientes.</div></div>\n                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button type="button" onClick={() => agregarServicioReserva("cochera")} style={secondaryButton}>+ Cochera</button><button type="button" onClick={() => agregarServicioReserva("mascota")} style={secondaryButton}>+ Mascota</button><button type="button" onClick={() => agregarServicioReserva("extra")} style={secondaryButton}>+ Extra</button></div>\n                    </div>\n                    {serviciosReserva.length === 0 ? <div style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>Sin servicios adicionales cargados.</div> : <div style={{ display: "grid", gap: 8, marginTop: 10 }}>{serviciosReserva.map((s) => <div key={s.id} style={{ display: "grid", gridTemplateColumns: "110px minmax(150px,1fr) 78px 78px 110px 34px", gap: 7, alignItems: "center" }}>\n                      <select value={s.tipo} onChange={(e) => actualizarServicioReserva(s.id, "tipo", e.target.value)} style={{ ...inputStyle, padding: "8px 9px", fontSize: 12 }}><option value="cochera">Cochera</option><option value="vehiculo">Vehículo</option><option value="mascota">Mascota</option><option value="extra">Extra</option></select>\n                      <input value={s.descripcion || ""} onChange={(e) => actualizarServicioReserva(s.id, "descripcion", e.target.value)} placeholder="Detalle (patente, mascota, servicio...)" style={{ ...inputStyle, padding: "8px 9px", fontSize: 12 }} />\n                      <input type="number" min="1" value={s.cantidad} onChange={(e) => actualizarServicioReserva(s.id, "cantidad", e.target.value)} title="Cantidad" style={{ ...inputStyle, padding: "8px 9px", fontSize: 12 }} />\n                      <input type="number" min="1" value={s.dias} onChange={(e) => actualizarServicioReserva(s.id, "dias", e.target.value)} title="Días" style={{ ...inputStyle, padding: "8px 9px", fontSize: 12 }} />\n                      <input type="number" min="0" value={s.precio_unitario} onChange={(e) => actualizarServicioReserva(s.id, "precio_unitario", e.target.value)} title="Precio por unidad/día" style={{ ...inputStyle, padding: "8px 9px", fontSize: 12 }} />\n                      <button type="button" onClick={() => quitarServicioReserva(s.id)} style={{ border: 0, background: "transparent", color: colors.red, cursor: "pointer", fontSize: 18 }}>×</button>\n                    </div>)}</div>}\n                    <div style={{ marginTop: 10, fontSize: 12 }}>Total servicios: <strong>$ {totalServiciosReserva().toLocaleString("es-AR")}</strong></div>\n                  </div>\n\n${summaryAnchor}`
  replaceOnce(summaryAnchor, servicesUI, "detailed services UI")

  // Resumen tarifario más claro para multi-habitación y servicios.
  replaceOnce(
    `<div>Habitación / noche: <strong>${'${calcularImporteReserva().tarifaNoche.toLocaleString("es-AR")}'}</strong></div>`,
    `<div>Habitaciones: <strong>{calcularImporteReserva().habitacionesIds?.length || 1}</strong></div>`,
    "rate summary room count"
  )
  replaceOnce(
    `<div>Extra {extraDescripcion ? \`(${'${extraDescripcion}'})\` : ""}: <strong>${'${calcularImporteReserva().extra.toLocaleString("es-AR")}'}</strong></div>`,
    `<div>Extras / servicios: <strong>$ {calcularImporteReserva().extra.toLocaleString("es-AR")}</strong></div>`,
    "rate summary services"
  )

  // Calendario, housekeeping y validaciones reconocen habitaciones adicionales.
  text = text.replaceAll(`String(r.habitacion_id) === String(habitacion.id)`, `reservaIncluyeHabitacion(r, habitacion.id)`)
  text = text.replaceAll(`String(r.habitacion_id) === String(h.id)`, `reservaIncluyeHabitacion(r, h.id)`)
  text = text.replaceAll(`String(otra.habitacion_id) === String(nuevaHabitacionId)`, `reservaIncluyeHabitacion(otra, nuevaHabitacionId)`)
  text = text.replaceAll(`String(r.habitacion_id) === String(habitacion.id)`, `reservaIncluyeHabitacion(r, habitacion.id)`)

  // Texto e impresión: mostrar todas las habitaciones y servicios.
  replaceOnce(
    `      \`Habitación: ${'${nombreHabitacion(reserva.habitacion_id)}'}\`,`,
    `      \`Habitación/es: ${'${idsHabitacionesReserva(reserva).map((id) => nombreHabitacion(id)).join(", ") || nombreHabitacion(reserva.habitacion_id)}'}\`,`,
    "reservation text multi-room"
  )
  replaceOnce(
    `<table><tr><th>Alojamiento</th><td>${'${nombreAlojamiento(reserva.alojamiento_id)}'}</td></tr><tr><th>Habitación</th><td>${'${nombreHabitacion(reserva.habitacion_id)}'}</td></tr>`,
    `<table><tr><th>Alojamiento</th><td>${'${nombreAlojamiento(reserva.alojamiento_id)}'}</td></tr><tr><th>Habitación/es</th><td>${'${idsHabitacionesReserva(reserva).map((id)=>nombreHabitacion(id)).join(", ")}'}</td></tr>`,
    "print reservation multi-room"
  )

  // Ficha lateral: detalle visible de habitaciones y servicios si existen.
  const reservationNumberAnchor = `<div style={{ color: colors.blue, fontWeight: 800, fontSize: 12, marginTop: 4 }}>{reservaSeleccionada.numero_reserva || "Sin número"}</div>`
  if (text.includes(reservationNumberAnchor) && !text.includes("Habitaciones de esta reserva")) {
    text = text.replace(reservationNumberAnchor, `${reservationNumberAnchor}\n                <div style={{ marginTop: 8, color: colors.muted, fontSize: 11 }}><strong style={{ color: colors.text }}>Habitaciones de esta reserva:</strong> {idsHabitacionesReserva(reservaSeleccionada).map((id) => nombreHabitacion(id)).join(", ")}</div>\n                {Array.isArray(reservaSeleccionada.servicios) && reservaSeleccionada.servicios.length > 0 && <div style={{ marginTop: 5, color: colors.muted, fontSize: 11 }}><strong style={{ color: colors.text }}>Servicios:</strong> {reservaSeleccionada.servicios.map((s) => \`${'${s.tipo || "extra"}'}${'${s.descripcion ? ` · ${s.descripcion}` : ""}'} x${'${s.cantidad || 1}'} · ${'${s.dias || 1}'} día(s)\`).join(" | ")}</div>}`)
  }

  // Limpieza tras guardar/cancelar formulario: evitar arrastrar selección anterior.
  text = text.replaceAll(`setHabitacionSeleccionada("")`, `setHabitacionSeleccionada(""); setHabitacionesAdicionales([]); setServiciosReserva([])`)

  fs.writeFileSync(path, text)
  console.log("Habitación Llena block 1 final v7 applied")
} else {
  console.log("Habitación Llena block 1 final v7 already applied")
}
