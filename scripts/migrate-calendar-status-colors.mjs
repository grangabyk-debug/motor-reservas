import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "HL_CALENDAR_STATUS_COLORS_V1"

if (text.includes(marker)) {
  console.log("Calendar status migration already applied")
  process.exit(0)
}

// Las reservas futuras/pendientes/confirmadas deben compartir el violeta.
// Verde = huésped alojado (check-in realizado). Rojo = huésped que ya salió (check-out realizado).
const colorStart = text.indexOf("  function colorReservaCalendario(reserva) {")
if (colorStart < 0) throw new Error("No se encontró colorReservaCalendario")
const nextFunction = text.indexOf("\n  function ", colorStart + 10)
if (nextFunction < 0) throw new Error("No se encontró el cierre de colorReservaCalendario")

const colorFunction = `  function colorReservaCalendario(reserva) {\n    // HL_CALENDAR_STATUS_COLORS_V1\n    const estado = String(reserva?.estado || "").toLowerCase().trim()\n    const estadoNormalizado = estado.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")\n\n    if (["alojado", "check-in", "checkin", "in_house", "in house"].includes(estado) || estadoNormalizado === "alojado" || estadoNormalizado === "checkin" || estadoNormalizado === "in_house" || estadoNormalizado === "in house") {\n      return colors.green || "#16a34a"\n    }\n\n    if (["checkout", "check-out", "salio", "salida", "egresado"].includes(estado) || estadoNormalizado === "checkout" || estadoNormalizado === "check-out" || estadoNormalizado === "salio" || estadoNormalizado === "salida" || estadoNormalizado === "egresado") {\n      return colors.red || "#dc2626"\n    }\n\n    // Todo estado previo al check-in permanece violeta.\n    return "#7c3aed"\n  }`

text = text.slice(0, colorStart) + colorFunction + text.slice(nextFunction)

// Eliminar la leyenda superior que mostraba IN / OUT / FUTURA. Buscamos el div
// contenedor más pequeño que contiene las tres etiquetas y lo quitamos completo.
const labels = ["Alojado", "Ya salió", "Aún no llegó"]
const firstLabel = text.indexOf(labels[0])
const hasAllLabels = firstLabel >= 0 && labels.slice(1).every((label) => text.indexOf(label, firstLabel) >= 0)

if (hasAllLabels) {
  const divOpen = /<div\\b[^>]*>/g
  const divToken = /<div\\b[^>]*>|<\\/div>/g
  let match
  const candidates = []

  while ((match = divOpen.exec(text)) !== null && match.index < firstLabel) {
    candidates.push(match.index)
  }

  let best = null
  for (const start of candidates.reverse()) {
    divToken.lastIndex = start
    let depth = 0
    let end = -1
    let token
    while ((token = divToken.exec(text)) !== null) {
      if (token[0].startsWith("<div")) depth += 1
      else depth -= 1
      if (depth === 0) {
        end = token.index + token[0].length
        break
      }
    }
    if (end > 0) {
      const block = text.slice(start, end)
      if (labels.every((label) => block.includes(label))) {
        best = { start, end }
        break
      }
    }
  }

  if (best) {
    text = text.slice(0, best.start) + text.slice(best.end)
  } else {
    throw new Error("No se pudo localizar el contenedor de la leyenda del calendario")
  }
}

fs.writeFileSync(path, text)
console.log("Calendar status colors/legend migration applied")
