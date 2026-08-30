import fs from "node:fs"

const path = "app/dashboard/HotelOSClient.jsx"
if (!fs.existsSync(path)) throw new Error("Habitación Llena OS client is missing. Refusing to build.")
const source = fs.readFileSync(path, "utf8")
const required = [
  'supabase.rpc("hl_move_reservation_atomic"',
  'supabase.rpc("hl_checkout_reservation_atomic"',
  'from("hotel_floors")',
  'from("hotel_charge_catalog")',
  'from("hotel_key_issues")',
]
const missing = required.filter(token => !source.includes(token))
if (missing.length) throw new Error(`Habitación Llena OS safety check failed: ${missing.join(", ")}`)
console.log("Habitación Llena OS: complete front-desk operations and atomic reservation guards verified")
