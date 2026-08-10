import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "HL_CALENDAR_STATUS_COLORS_V2"

if (text.includes(marker)) process.exit(0)

const colorStart = text.indexOf("  function colorReservaCalendario(reserva) {")
if (colorStart < 0) throw new Error("No se encontró colorReservaCalendario")
const nextFunction = text.indexOf("\n  function ", colorStart + 10)
if (nextFunction < 0) throw new Error("No se encontró el cierre de colorReservaCalendario")

const colorFunction = `  function colorReservaCalendario(reserva) {\n    // ${marker}\n    const estado = String(reserva?.estado || "").toLowerCase().trim()\n    const estadoNormalizado = estado.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")\n    if (["alojado", "check-in", "checkin", "in_house", "in house"].includes(estado) || ["alojado", "checkin", "in_house", "in house"].includes(estadoNormalizado)) {\n      return colors.green || "#16a34a"\n    }\n    if (["checkout", "check-out", "salio", "salida", "egresado"].includes(estado) || ["checkout", "check-out", "salio", "salida", "egresado"].includes(estadoNormalizado)) {\n      return colors.red || "#dc2626"\n    }\n    return "#7c3aed"\n  }`
text = text.slice(0, colorStart) + colorFunction + text.slice(nextFunction)

const labels = ["Alojado", "Ya salió", "Aún no llegó"]
const firstLabel = text.indexOf(labels[0])
if (firstLabel >= 0 && labels.every((label) => text.indexOf(label, firstLabel) >= 0)) {
  const tokenRe = /<div\b[^>]*>|<\/div>/g
  const candidates = []
  let m
  while ((m = /<div\b[^>]*>/g.exec(text)) !== null && m.index < firstLabel) candidates.push(m.index)

  let best = null
  for (const start of candidates.reverse()) {
    tokenRe.lastIndex = start
    let depth = 0
    let end = -1
    let token
    while ((token = tokenRe.exec(text)) !== null) {
      depth += token[0].startsWith("<div") ? 1 : -1
      if (depth === 0) { end = token.index + token[0].length; break }
    }
    if (end > 0) {
      const block = text.slice(start, end)
      if (labels.every((label) => block.includes(label))) { best = { start, end }; break }
    }
  }
  if (!best) throw new Error("No se pudo localizar la leyenda del calendario")
  text = text.slice(0, best.start) + text.slice(best.end)
}

fs.writeFileSync(path, text)
console.log("Calendar status migration applied")
