import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "HL_CALENDAR_STATUS_COLORS_V5"

if (text.includes(marker)) process.exit(0)

function replaceRequired(from, to, label) {
  if (!text.includes(from)) throw new Error(`No se encontró el bloque requerido: ${label}`)
  text = text.replace(from, to)
}

// El color de la reserva depende únicamente del estado operativo real.
// Confirmada/pendiente/futura = violeta. Check-in = verde. Check-out = rojo.
const colorBlock = `                      const estadoVisual =\n                        reserva.estado === "alojado"\n                          ? "in"\n                          : reserva.estado === "finalizada"\n                            ? "out"\n                            : "futura"\n\n                      const colorReserva =\n                        estadoVisual === "in"\n                          ? colors.green\n                          : estadoVisual === "out"\n                            ? colors.red\n                            : "#7c3aed"\n`

const colorStart = text.indexOf(`                      const estadoVisual =`, text.indexOf(`{reservasHabitacion.map((reserva) => {`))
const colorEnd = text.indexOf(`\n\n                      /*`, colorStart)
if (colorStart < 0 || colorEnd < 0) throw new Error("No se encontró el cálculo de color de las reservas")
text = text.slice(0, colorStart) + colorBlock.trimEnd() + text.slice(colorEnd)

// No se usa borde punteado para pendientes: pendiente y futura comparten el violeta.
replaceRequired(
  `                            border: pendiente\n                              ? "1px dashed rgba(255,255,255,.85)"\n                              : "1px solid rgba(255,255,255,.2)",`,
  `                            border: "1px solid rgba(255,255,255,.2)",`,
  "borde de reserva pendiente"
)

// El estado de la habitación en el calendario es housekeeping, no disponibilidad de reservas.
// Se conservan solamente: libre / limpia, en limpieza y sucia.
replaceRequired(
  `  function estadoHabitacionVisual(habitacion) {\n    const manual = estadoHabitacionManual(habitacion.id)\n    if (manual === "fuera_servicio") return "fuera_servicio"\n    if (manual === "sucia") return "sucia"\n    if (manual === "en_limpieza") return "en_limpieza"\n    const hoy = fechaLocal(0)\n    const ocupada = reservas.some((r) => String(r.habitacion_id) === String(habitacion.id) && r.estado !== "cancelada" && !r.no_show && r.fecha_entrada <= hoy && r.fecha_salida > hoy)\n    if (ocupada) return "ocupada"\n    const futura = reservas.some((r) => String(r.habitacion_id) === String(habitacion.id) && r.estado !== "cancelada" && !r.no_show && r.fecha_entrada > hoy && r.fecha_entrada <= fechaLocal(30))\n    if (manual === "libre" && futura) return "reservada"\n    return manual\n  }`,
  `  function estadoHabitacionVisual(habitacion) {\n    const manual = estadoHabitacionManual(habitacion.id)\n    if (manual === "sucia") return "sucia"\n    if (manual === "en_limpieza") return "en_limpieza"\n    return "libre"\n  }`,
  "estado visual de habitación en calendario"
)

replaceRequired(
  `                        background: ocupada ? colors.blue : info.color,`,
  `                        background: info.color,`,
  "indicador de estado de habitación"
)

// La leyenda superior se elimina del JSX: el título Plano de ocupación queda limpio.
const legendStart = text.indexOf(`        <div style={{\n          display: "flex",\n          gap: 14,\n          flexWrap: "wrap",\n          alignItems: "center",\n          fontSize: 11,\n          fontWeight: 700,\n        }}>`, text.indexOf(`function Calendario()`))
if (legendStart < 0) throw new Error("No se encontró la leyenda del calendario")
const legendEnd = text.indexOf(`\n\n        <div style={{\n          overflowX: "auto",`, legendStart)
if (legendEnd < 0) throw new Error("No se encontró el final de la leyenda del calendario")
text = text.slice(0, legendStart) + text.slice(legendEnd + 2)

// El helper v4 ocultaba la leyenda con MutationObserver. Ya no hace falta y se elimina.
const effectMarker = `  // HL_CALENDAR_STATUS_COLORS_V4: ocultar la leyenda de estados del calendario.`
const effectStart = text.indexOf(effectMarker)
if (effectStart >= 0) {
  const effectEnd = text.indexOf(`  useEffect(() => {`, effectStart + effectMarker.length)
  if (effectEnd < 0) throw new Error("No se encontró el cierre del helper de leyenda")
  text = text.slice(0, effectStart) + text.slice(effectEnd)
}

fs.writeFileSync(path, text)
console.log("Calendar status colors v5 applied")
