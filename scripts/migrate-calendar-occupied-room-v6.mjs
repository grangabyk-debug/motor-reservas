import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "HL_CALENDAR_OCCUPIED_ROOM_V6"

if (text.includes(marker)) {
  console.log("Calendar occupied-room v6 migration already applied")
  process.exit(0)
}

const oldVisual = `    const hoy = fechaLocal(0)\n    const ocupada = reservas.some((r) => String(r.habitacion_id) === String(habitacion.id) && r.estado !== "cancelada" && !r.no_show && r.fecha_entrada <= hoy && r.fecha_salida > hoy)\n    if (ocupada) return "ocupada"\n    const futura = reservas.some((r) => String(r.habitacion_id) === String(habitacion.id) && r.estado !== "cancelada" && !r.no_show && r.fecha_entrada > hoy && r.fecha_entrada <= fechaLocal(30))\n    if (manual === "libre" && futura) return "reservada"\n    return manual`

const newVisual = `    const hoy = fechaLocal(0)\n    const ocupadaPorCheckin = reservas.some((r) =>\n      String(r.habitacion_id) === String(habitacion.id) &&\n      ["alojado", "check-in", "checkin", "in_house"].includes(String(r.estado || "").toLowerCase()) &&\n      !r.no_show &&\n      r.fecha_entrada <= hoy &&\n      r.fecha_salida > hoy\n    )\n    if (ocupadaPorCheckin) return "ocupada"\n    // Las reservas futuras no cambian el estado operativo de la habitación.\n    // La habitación sigue mostrando su estado de housekeeping hasta el check-in.\n    return manual`

if (!text.includes(oldVisual)) {
  throw new Error("No se encontró el bloque de estado visual del calendario")
}
text = text.replace(oldVisual, newVisual)

const oldDot = `                        background: ocupada ? colors.blue : info.color,`
const newDot = `                        background: estado === "ocupada" ? colors.blue : info.color,`
if (!text.includes(oldDot)) {
  throw new Error("No se encontró el indicador visual de estado de habitación")
}
text = text.replace(oldDot, newDot)

fs.writeFileSync(path, text)
console.log("Calendar occupied-room v6 migration applied")
