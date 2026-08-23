import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "HL_BLOCK1_FINAL_V8"

function replaceOnce(from, to, label) {
  if (!text.includes(from)) {
    console.log(`Skip ${label}: pattern not found`)
    return false
  }
  text = text.replace(from, to)
  console.log(`Applied ${label}`)
  return true
}

if (!text.includes(marker)) {
  // Marcador sin impacto funcional.
  text = text.replace(`  const HL_BLOCK1_FINAL_V7 = true`, `  const HL_BLOCK1_FINAL_V7 = true\n  const ${marker} = true`)

  // Validación fallback de TODAS las habitaciones antes de calcular/guardar.
  if (!text.includes("const habitacionesAValidar = habitacionesElegidasFormulario()")) {
    replaceOnce(
      `    const calculo = calcularImporteReserva()`,
      `    const habitacionesAValidar = habitacionesElegidasFormulario()\n    for (const habitacionId of habitacionesAValidar) {\n      const bloqueoExtra = bloqueoParaHabitacion(habitacionId, fechaEntrada, fechaSalida)\n      if (bloqueoExtra) {\n        setMensaje(\`La habitación ${'${nombreHabitacion(habitacionId)}'} está bloqueada del ${'${formatearFecha(bloqueoExtra.fecha_desde)}'} al ${'${formatearFecha(bloqueoExtra.fecha_hasta)}'} (${'${bloqueoExtra.motivo}'}).\`)\n        setCargando(false)\n        return\n      }\n      const conflictoReserva = reservas.some((otra) =>\n        String(otra.id) !== String(reservaId || "") &&\n        otra.estado !== "cancelada" && !otra.no_show &&\n        reservaIncluyeHabitacion(otra, habitacionId) &&\n        bloquesSeCruzan(fechaEntrada, fechaSalida, otra.fecha_entrada, otra.fecha_salida)\n      )\n      if (conflictoReserva) {\n        setMensaje(\`La habitación ${'${nombreHabitacion(habitacionId)}'} ya está ocupada en esas fechas.\`)\n        setCargando(false)\n        return\n      }\n    }\n\n    const calculo = calcularImporteReserva()`,
      "multi-room availability validation fallback"
    )
  }

  // Check-out anticipado: recalcular todas las habitaciones, no sólo la principal.
  replaceOnce(
    `    const tarifaNocheReal = Number(reserva.tarifa_noche || tarifaDeHabitacion(reserva.habitacion_id) || 0)\n    const tarifaHabitacionReal = datosTarifaHabitacion(reserva.habitacion_id)\n    const cocheraReal = Number(reserva.vehiculos || 0) * Number(tarifaHabitacionReal.cochera || 0) * nochesReales\n    const baseReal = tarifaNocheReal * nochesReales + cocheraReal + Number(reserva.early_checkin_importe || 0) + Number(reserva.late_checkout_importe || 0) + Number(reserva.extra || 0)`,
    `    const tarifaNocheReal = Number(reserva.tarifa_noche || tarifaDeHabitacion(reserva.habitacion_id) || 0)\n    const tarifaHabitacionReal = datosTarifaHabitacion(reserva.habitacion_id)\n    const cocheraReal = Number(reserva.vehiculos || 0) * Number(tarifaHabitacionReal.cochera || 0) * nochesReales\n    const detalleHabitacionesReal = Array.isArray(reserva.habitaciones_detalle) && reserva.habitaciones_detalle.length\n      ? reserva.habitaciones_detalle.map((h) => ({ ...h, noches: nochesReales, subtotal: Number(h.tarifa_noche || 0) * nochesReales }))\n      : [{ habitacion_id: reserva.habitacion_id, nombre: nombreHabitacion(reserva.habitacion_id), tarifa_noche: tarifaNocheReal, noches: nochesReales, subtotal: tarifaNocheReal * nochesReales }]\n    const alojamientoReal = detalleHabitacionesReal.reduce((acc, h) => acc + Number(h.subtotal || 0), 0)\n    const baseReal = alojamientoReal + cocheraReal + Number(reserva.early_checkin_importe || 0) + Number(reserva.late_checkout_importe || 0) + Number(reserva.extra || 0)`,
    "early checkout multi-room recalculation"
  )
  replaceOnce(
    `        noches: nochesReales,\n        cochera_total: cocheraReal,`,
    `        noches: nochesReales,\n        habitaciones_detalle: detalleHabitacionesReal,\n        cochera_total: cocheraReal,`,
    "early checkout room detail persistence"
  )
  replaceOnce(
    `    const reservaFinalizada = { ...reserva, estado: "finalizada", fecha_salida: salidaReal, checkout_real_at: new Date().toISOString(), noches: nochesReales, cochera_total: cocheraReal, subtotal: baseReal, descuento_importe: descuentoReal, precio_total: totalReal, precio_total_usd: totalReal / tcReal }`,
    `    const reservaFinalizada = { ...reserva, estado: "finalizada", fecha_salida: salidaReal, checkout_real_at: new Date().toISOString(), noches: nochesReales, habitaciones_detalle: detalleHabitacionesReal, cochera_total: cocheraReal, subtotal: baseReal, descuento_importe: descuentoReal, precio_total: totalReal, precio_total_usd: totalReal / tcReal }`,
    "early checkout local multi-room detail"
  )

  // Agregar una noche: recalcular tarifa total de todas las habitaciones.
  replaceOnce(
    `    const subtotal = tarifaNoche * noches + cocheraPorNoche * vehiculosReserva * noches + early + late + extra`,
    `    const detalleHabitacionesExtendido = Array.isArray(reserva.habitaciones_detalle) && reserva.habitaciones_detalle.length\n      ? reserva.habitaciones_detalle.map((h) => ({ ...h, noches, subtotal: Number(h.tarifa_noche || 0) * noches }))\n      : [{ habitacion_id: reserva.habitacion_id, nombre: nombreHabitacion(reserva.habitacion_id), tarifa_noche: tarifaNoche, noches, subtotal: tarifaNoche * noches }]\n    const alojamientoExtendido = detalleHabitacionesExtendido.reduce((acc, h) => acc + Number(h.subtotal || 0), 0)\n    const subtotal = alojamientoExtendido + cocheraPorNoche * vehiculosReserva * noches + early + late + extra`,
    "extend stay multi-room recalculation"
  )
  replaceOnce(
    `        fecha_salida: nuevaSalida,\n        noches,\n        precio_total: precioTotal,`,
    `        fecha_salida: nuevaSalida,\n        noches,\n        habitaciones_detalle: detalleHabitacionesExtendido,\n        precio_total: precioTotal,`,
    "extend stay room detail persistence"
  )

  // Drag & drop de una reserva multi-habitación: evitar mover sólo la principal sin avisar.
  replaceOnce(
    `      const mismoDestino =\n        String(reserva.habitacion_id) === String(nuevaHabitacionId) &&\n        reserva.fecha_entrada === nuevaEntrada`,
    `      if (idsHabitacionesReserva(reserva).length > 1 && String(reserva.habitacion_id) !== String(nuevaHabitacionId)) {\n        alert("Esta reserva ocupa varias habitaciones. Para cambiar habitaciones usá Editar reserva, así se mantiene el grupo completo.")\n        return\n      }\n\n      const mismoDestino =\n        String(reserva.habitacion_id) === String(nuevaHabitacionId) &&\n        reserva.fecha_entrada === nuevaEntrada`,
    "protect multi-room drag move"
  )

  fs.writeFileSync(path, text)
  console.log("Habitación Llena block 1 final v8 applied")
} else {
  console.log("Habitación Llena block 1 final v8 already applied")
}
