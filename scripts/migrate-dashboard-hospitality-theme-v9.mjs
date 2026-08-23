import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "HL_HOSPITALITY_THEME_V9"

if (text.includes(marker)) {
  console.log("Habitación Llena hospitality theme v9 already applied")
  process.exit(0)
}

function replaceOnce(from, to, label) {
  if (!text.includes(from)) {
    console.log(`Skip ${label}: pattern not found`)
    return false
  }
  text = text.replace(from, to)
  console.log(`Applied ${label}`)
  return true
}

const palette = [
  ["--hl-navy: #0b4aa2;", "--hl-navy: #173d38;"],
  ["--hl-navy-dark: #082f6b;", "--hl-navy-dark: #0d2f2b;"],
  ["--hl-blue: #1677e8;", "--hl-blue: #55766d;"],
  ["--hl-blue-soft: #e8f1ff;", "--hl-blue-soft: #e6ede8;"],
  ["--hl-green: #00875a;", "--hl-green: #477565;"],
  ["--hl-green-soft: #e8f7f0;", "--hl-green-soft: #e8f0eb;"],
  ["--hl-yellow: #b78103;", "--hl-yellow: #b58962;"],
  ["--hl-yellow-soft: #fff7dc;", "--hl-yellow-soft: #f5eadf;"],
  ["--hl-red: #c62828;", "--hl-red: #a56850;"],
  ["--hl-red-soft: #fff0f0;", "--hl-red-soft: #f6e7df;"],
  ["--hl-text: #1f2937;", "--hl-text: #1d2925;"],
  ["--hl-muted: #6b7280;", "--hl-muted: #69766f;"],
  ["--hl-border: #e5e7eb;", "--hl-border: #e3dacd;"],
  ["--hl-bg: #f3f6fb;", "--hl-bg: #f5f0e7;"],
  ["--hl-white: #ffffff;", "--hl-white: #fffdf8;"],
  ["--hl-panel: #ffffff;", "--hl-panel: #fffdf8;"],
  ["--hl-input: #ffffff;", "--hl-input: #fffdfa;"],
  ["--hl-navy: #5fa4ff;", "--hl-navy: #c0d4c9;"],
  ["--hl-navy-dark: #d9e9ff;", "--hl-navy-dark: #f4eadf;"],
  ["--hl-blue: #4d9cff;", "--hl-blue: #8fa99d;"],
  ["--hl-blue-soft: #172b45;", "--hl-blue-soft: #223b35;"],
  ["--hl-green: #39d39a;", "--hl-green: #7fb59d;"],
  ["--hl-green-soft: #12382d;", "--hl-green-soft: #173b30;"],
  ["--hl-yellow: #f0b83f;", "--hl-yellow: #d5b183;"],
  ["--hl-yellow-soft: #3b2e12;", "--hl-yellow-soft: #433525;"],
  ["--hl-red: #ff6b6b;", "--hl-red: #d3876f;"],
  ["--hl-red-soft: #3b1818;", "--hl-red-soft: #42251d;"],
  ["--hl-text: #f3f4f6;", "--hl-text: #f4f0e9;"],
  ["--hl-muted: #a7b0bf;", "--hl-muted: #b6c0ba;"],
  ["--hl-border: #303846;", "--hl-border: #354740;"],
  ["--hl-bg: #090d13;", "--hl-bg: #0f1e1b;"],
  ["--hl-white: #111722;", "--hl-white: #172824;"],
  ["--hl-panel: #111722;", "--hl-panel: #172824;"],
  ["--hl-input: #151c28;", "--hl-input: #1a2d28;"],
]

for (const [from, to] of palette) {
  if (text.includes(from)) text = text.replace(from, to)
}
console.log("Applied hospitality color palette")

replaceOnce(
  '    return "#7c3aed" // violeta para pendiente, confirmada y futuras',
  '    return "#9f7959" // bronce hotelero para pendiente, confirmada y futuras',
  "calendar future reservation color"
)

replaceOnce(
  '        background: "rgba(255,255,255,.94)",',
  '        background: "rgba(251,248,242,.94)",',
  "warm glass app header"
)

replaceOnce(
  '        <div style={{ position: "absolute", bottom: 14, left: 20, right: 20, fontSize: 9, opacity: .45, textAlign: "center" }}>Habitación Llena · MVP</div>',
  `        <div className="hotel-sidebar-signature" title="Un detalle inspirado en los antiguos llaveros de recepción">
          <span className="hotel-key-tag">HL</span>
          <span className="hotel-key-copy"><b>Recepción lista</b><small>{nombreAlojamientoActivo}</small></span>
        </div>`,
  "hotel key fob sidebar detail"
)

const darkButtonAnchor = `          <button
            type="button"
            onClick={alternarModoOscuro}`
replaceOnce(
  darkButtonAnchor,
  `          <div className="hotel-reception-detail" title="Recepción activa">
            <span className="hotel-bell" aria-hidden="true" />
            <span className="hotel-reception-copy"><b>Recepción</b><small>{nombreAlojamientoActivo}</small></span>
          </div>
${darkButtonAnchor}`,
  "reception bell header detail"
)

const cssAnchor = '        .app-header { box-shadow: 0 1px 0 rgba(15,23,42,.02), 0 8px 24px rgba(15,23,42,.025); }'
const hospitalityCss = `        .app-header { box-shadow: 0 1px 0 rgba(23,61,56,.035), 0 12px 32px rgba(46,58,51,.055); }
        /* ${marker} */
        .hl-app {
          background:
            radial-gradient(circle at 86% 0%, rgba(181,137,98,.08), transparent 24%),
            linear-gradient(90deg, rgba(23,61,56,.016) 1px, transparent 1px),
            linear-gradient(rgba(23,61,56,.012) 1px, transparent 1px),
            var(--hl-bg);
          background-size: auto, 54px 54px, 54px 54px, auto;
        }
        .desktop-sidebar > aside {
          background: linear-gradient(180deg,#173d38 0%,#0d2f2b 100%) !important;
          box-shadow: 14px 0 40px rgba(13,47,43,.09);
        }
        .desktop-sidebar button { border-radius: 10px !important; }
        .app-header {
          backdrop-filter: blur(18px) saturate(1.08);
          border-bottom-color: rgba(91,103,97,.13) !important;
        }
        input, select, textarea {
          border-radius: 10px !important;
          transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
        }
        input:focus, select:focus, textarea:focus {
          border-color: #789087 !important;
          box-shadow: 0 0 0 3px rgba(85,118,109,.11) !important;
        }
        button { border-radius: 10px; }
        .hotel-reception-detail {
          display:flex;align-items:center;gap:9px;padding:7px 10px 7px 9px;
          border:1px solid rgba(181,137,98,.28);border-radius:999px;
          background:linear-gradient(180deg,rgba(255,253,248,.94),rgba(245,234,223,.78));
          box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 7px 20px rgba(87,68,52,.06);
          min-width:132px;
        }
        .hotel-bell {
          position:relative;display:block;width:25px;height:15px;
          border-radius:16px 16px 4px 4px;
          background:linear-gradient(145deg,#d3b18c,#a97851 62%,#8d6241);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.42),0 2px 5px rgba(72,50,34,.15);
          flex:0 0 auto;
        }
        .hotel-bell:before { content:"";position:absolute;width:5px;height:5px;border-radius:50%;background:#a97851;left:10px;top:-5px;box-shadow:inset 0 1px 0 rgba(255,255,255,.4); }
        .hotel-bell:after { content:"";position:absolute;left:-4px;right:-4px;height:3px;bottom:-4px;border-radius:999px;background:#8d6241;box-shadow:0 1px 2px rgba(61,40,25,.16); }
        .hotel-reception-copy {display:grid;line-height:1.05;min-width:0}.hotel-reception-copy b{font-size:10px;color:#3d514b}.hotel-reception-copy small{font-size:8px;color:#84796c;margin-top:3px;max-width:92px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hotel-sidebar-signature {
          position:absolute;bottom:12px;left:13px;right:13px;display:flex;align-items:center;gap:9px;
          padding:8px 9px;border-radius:14px;background:rgba(255,255,255,.075);
          border:1px solid rgba(255,255,255,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.045);
        }
        .hotel-key-tag {
          position:relative;width:29px;height:38px;border-radius:14px 14px 8px 8px;display:grid;place-items:center;
          background:linear-gradient(145deg,#cfa982,#9f7653);color:#173d38;font-family:Georgia,serif;font-size:9px;font-weight:900;
          box-shadow:0 5px 12px rgba(0,0,0,.14);transform:rotate(-3deg);flex:0 0 auto;
        }
        .hotel-key-tag:before {content:"";position:absolute;width:5px;height:5px;border-radius:50%;background:#173d38;top:5px;opacity:.58}
        .hotel-key-copy{display:grid;line-height:1.1;min-width:0}.hotel-key-copy b{font-size:9px;color:#f4eadf}.hotel-key-copy small{font-size:7px;color:#b9cbc4;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hl-dark .app-header { background: rgba(15,30,27,.94) !important; }
        .hl-dark .desktop-sidebar > aside { background: linear-gradient(180deg,#0d2f2b,#081d1a) !important; }
        .hl-dark .hotel-reception-detail { background:linear-gradient(180deg,rgba(35,60,53,.94),rgba(28,48,43,.94));border-color:rgba(213,177,131,.22) }
        .hl-dark .hotel-reception-copy b{color:#f4eadf}.hl-dark .hotel-reception-copy small{color:#b6c0ba}
        @media (max-width: 1120px) { .hotel-reception-detail { display:none; } }`
replaceOnce(cssAnchor, hospitalityCss, "hospitality UI styling")

fs.writeFileSync(path, text)
console.log("Habitación Llena hospitality dashboard theme v9 applied")
