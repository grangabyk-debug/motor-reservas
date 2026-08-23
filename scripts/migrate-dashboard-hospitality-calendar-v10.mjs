import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "HL_HOSPITALITY_CALENDAR_V10"

if (text.includes(marker)) process.exit(0)

const replacements = [
  ['"#7c3aed"', '"#9f7959"'],
  ['"#2563eb"', '"#55766d"'],
  ['"#1d4ed8"', '"#173d38"'],
  ['"#3b82f6"', '"#6f8d82"'],
  ['"#0b4aa2"', '"#173d38"'],
  ['"#1677e8"', '"#55766d"'],
]

let changed = 0
for (const [from, to] of replacements) {
  if (text.includes(from)) {
    text = text.split(from).join(to)
    changed += 1
  }
}

const cssAnchor = '        /* HL_HOSPITALITY_THEME_V9 */'
if (text.includes(cssAnchor)) {
  text = text.replace(cssAnchor, `${cssAnchor}\n        /* ${marker} */\n        .hl-app [style*=\"background: #f8fafc\"], .hl-app [style*=\"background:#f8fafc\"] { background:#f7f3ec !important; }\n        .hl-app [style*=\"background: #fafbfe\"], .hl-app [style*=\"background:#fafbfe\"] { background:#fbf8f2 !important; }\n        .hl-app [style*=\"border: 1px solid #e5e7eb\"], .hl-app [style*=\"border:1px solid #e5e7eb\"] { border-color:#e3dacd !important; }\n        .hl-app [style*=\"box-shadow: 0 8px 24px rgba(15,23,42\"] { box-shadow:0 12px 30px rgba(46,58,51,.07) !important; }\n        .hl-dark [style*=\"background: #f7f3ec\"], .hl-dark [style*=\"background:#f7f3ec\"], .hl-dark [style*=\"background: #fbf8f2\"], .hl-dark [style*=\"background:#fbf8f2\"] { background:var(--hl-white) !important; }`)
}

fs.writeFileSync(path, text)
console.log(`Habitación Llena hospitality calendar v10 applied (${changed} color groups normalized)`)
