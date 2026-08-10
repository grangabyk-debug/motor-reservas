import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "HL_CALENDAR_STATUS_COLORS_V4"
if (text.includes(marker)) process.exit(0)

const colorStart = text.indexOf("  function colorReservaCalendario(reserva) {")
if (colorStart < 0) throw new Error("No se encontró colorReservaCalendario")
const nextFunction = text.indexOf("\n  function ", colorStart + 10)
if (nextFunction < 0) throw new Error("No se encontró el cierre de colorReservaCalendario")

const colorFunction = `  function colorReservaCalendario(reserva) {\n    // ${marker}\n    const estado = String(reserva?.estado || "").toLowerCase().trim()\n    const normalizado = estado.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")\n    if (["alojado", "check-in", "checkin", "in_house", "in house"].includes(estado) || ["alojado", "checkin", "in_house", "in house"].includes(normalizado)) return colors.green || "#16a34a"\n    if (["checkout", "check-out", "salio", "salida", "egresado"].includes(estado) || ["checkout", "check-out", "salio", "salida", "egresado"].includes(normalizado)) return colors.red || "#dc2626"\n    return "#7c3aed"\n  }`
text = text.slice(0, colorStart) + colorFunction + text.slice(nextFunction)

const effectMarker = `  // ${marker}: ocultar la leyenda de estados del calendario.`
const effect = `${effectMarker}\n  useEffect(() => {\n    const ocultarLeyenda = () => {\n      const candidatos = Array.from(document.querySelectorAll("div, span")).filter((el) => {\n        const contenido = String(el.textContent || "").trim()\n        return contenido.includes("Alojado") && contenido.includes("Ya salió") && contenido.includes("Aún no llegó")\n      })\n      if (!candidatos.length) return\n      candidatos.sort((a, b) => String(a.textContent || "").length - String(b.textContent || "").length)\n      candidatos[0].style.display = "none"\n    }\n\n    ocultarLeyenda()\n    const observer = new MutationObserver(ocultarLeyenda)\n    observer.observe(document.body, { childList: true, subtree: true })\n    return () => observer.disconnect()\n  }, [])\n\n`

const insertAt = text.indexOf("  useEffect(() => {", text.indexOf("export default function Home()"))
if (insertAt < 0) throw new Error("No se encontró un punto seguro para insertar el ajuste visual del calendario")
text = text.slice(0, insertAt) + effect + text.slice(insertAt)

fs.writeFileSync(path, text)
console.log("Calendar status colors v4 applied")
