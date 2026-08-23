import fs from "node:fs"

const dashboardPath = "app/dashboard/page.jsx"
const landingPath = "app/preview/pms-next/page.jsx"
const marker = "HL_RESERVATION_CONTRAST_V11"

const IN_COLOR = "#1f7a5c"
const OUT_COLOR = "#b64d3b"
const BOOK_COLOR = "#a8652a"
const WAIT_COLOR = "#b07b22"

let dashboard = fs.readFileSync(dashboardPath, "utf8")
if (!dashboard.includes(marker)) {
  const calendarColorPattern = /const colorReserva =\s*\n\s*estadoVisual === "in"\s*\n\s*\? [^\n]+\s*\n\s*: estadoVisual === "out"\s*\n\s*\? [^\n]+\s*\n\s*: "#[0-9a-fA-F]{6}"/
  dashboard = dashboard.replace(
    calendarColorPattern,
    `const colorReserva =\n                        estadoVisual === "in"\n                          ? "${IN_COLOR}"\n                          : estadoVisual === "out"\n                            ? "${OUT_COLOR}"\n                            : "${BOOK_COLOR}"`
  )

  dashboard = dashboard.replace(
    /function colorReservaCalendario\(reserva\) \{[\s\S]*?\n  \}/,
    `function colorReservaCalendario(reserva) {\n    const estado = String(reserva?.estado || "").toLowerCase()\n    if (["alojado", "check-in", "checkin", "in_house"].includes(estado)) return "${IN_COLOR}"\n    if (["finalizada", "checkout", "check-out"].includes(estado)) return "${OUT_COLOR}"\n    return "${BOOK_COLOR}"\n  }`
  )

  const cssAnchor = "        /* HL_HOSPITALITY_CALENDAR_V10 */"
  if (dashboard.includes(cssAnchor)) {
    dashboard = dashboard.replace(
      cssAnchor,
      `${cssAnchor}\n        /* ${marker} */\n        .hl-app [style*=\"background: #1f7a5c\"], .hl-app [style*=\"background:#1f7a5c\"],\n        .hl-app [style*=\"background: #b64d3b\"], .hl-app [style*=\"background:#b64d3b\"],\n        .hl-app [style*=\"background: #a8652a\"], .hl-app [style*=\"background:#a8652a\"] {\n          box-shadow: 0 4px 12px rgba(22,39,34,.16);\n          border-color: rgba(255,255,255,.34) !important;\n        }`
    )
  }

  fs.writeFileSync(dashboardPath, dashboard)
}

let landing = fs.readFileSync(landingPath, "utf8")
landing = landing.replace(
  `.reservation.in{background:#4f7568}.reservation.book{background:#9f7959}.reservation.wait{background:#b99d67}`,
  `.reservation.in{background:${IN_COLOR}}.reservation.book{background:${BOOK_COLOR}}.reservation.wait{background:${WAIT_COLOR}}`
)
landing = landing.replace(
  `.reservation{z-index:2;align-self:center;border-radius:8px;padding:6px 7px;color:white;margin:4px 2px;min-width:0;box-shadow:0 3px 10px rgba(0,0,0,.08)}`,
  `.reservation{z-index:2;align-self:center;border-radius:8px;padding:6px 7px;color:white;margin:4px 2px;min-width:0;box-shadow:0 4px 12px rgba(24,36,32,.22);border:1px solid rgba(255,255,255,.28)}`
)
fs.writeFileSync(landingPath, landing)

console.log("Habitación Llena reservation contrast v11 applied")
