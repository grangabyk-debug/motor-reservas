import fs from "node:fs"

const previewPath = "app/preview/pms-next/page.jsx"
const productionPath = "app/page.jsx"

if (!fs.existsSync(previewPath)) {
  throw new Error("No se encontró la landing premium de Habitación Llena")
}

fs.copyFileSync(previewPath, productionPath)
console.log("Habitación Llena premium landing synchronized to production")
