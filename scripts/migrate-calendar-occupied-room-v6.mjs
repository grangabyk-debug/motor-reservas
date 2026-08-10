import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "HL_CALENDAR_OCCUPIED_ROOM_V6"

if (text.includes(marker)) {
  console.log("Calendar occupied-room v6 migration already applied")
  process.exit(0)
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

if (!text.includes(oldVisual)) {
  throw new Error("No se encontró el estado visual post-v5 del calendario")
}
text = text.replace(oldVisual, newVisual)

const oldDot = `                        background: info.color,`
const newDot = `                        background: estado === "ocupada" ? colors.blue : info.color,`
if (!text.includes(oldDot)) {
  throw new Error("No se encontró el indicador visual de estado de habitación")
}
text = text.replace(oldDot, newDot)

fs.writeFileSync(path, text)
console.log("Calendar occupied-room v6 migration applied")
