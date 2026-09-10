import { createClient } from "@supabase/supabase-js"

function stop(message) {
  console.error(`[channex-test-gbp] ${message}`)
  process.exit(1)
}

if (process.env.VERCEL_ENV !== "preview") {
  console.log(`[channex-test-gbp] omitido: VERCEL_ENV=${process.env.VERCEL_ENV || "unset"}`)
  process.exit(0)
}

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
const supabaseSecret = String(process.env.SUPABASE_SECRET_KEY || "").trim()
const channexKey = String(process.env.CHANNEX_API_KEY || "").trim()
if (!supabaseUrl || !supabaseSecret) stop("faltan credenciales server-side de Supabase en Preview")
if (!channexKey) stop("falta CHANNEX_API_KEY en Preview")

const db = createClient(supabaseUrl, supabaseSecret, {
  auth: { autoRefreshToken: false, persistSession: false },
})

try {
  const { data: payload, error } = await db.rpc("_channex_create_test_gbp", {
    p_channex_key: channexKey,
  })
  if (error) stop(`RPC temporal -> ${error.message}`)

  const plan = payload?.data
  const attrs = plan?.attributes || {}
  const propertyId = plan?.relationships?.property?.data?.id
  const roomTypeId = plan?.relationships?.room_type?.data?.id
  const occupancy = attrs.options?.find(option => option?.is_primary)?.occupancy
  const valid = plan?.id
    && attrs.title === "Doble · TEST GBP"
    && attrs.currency === "GBP"
    && attrs.sell_mode === "per_room"
    && attrs.rate_mode === "manual"
    && propertyId === "2cbed57c-f907-4e77-a8bf-9357c276975e"
    && roomTypeId === "ed88bc12-d2df-454a-817c-5f8286375cc2"
    && Number(occupancy) === 2

  if (!valid) stop(`respuesta inconsistente: ${JSON.stringify({ id: plan?.id, title: attrs.title, currency: attrs.currency, sell_mode: attrs.sell_mode, rate_mode: attrs.rate_mode, property_id: propertyId, room_type_id: roomTypeId, occupancy })}`)

  console.log(`[channex-test-gbp] OK CREATED ${JSON.stringify({
    id: plan.id,
    title: attrs.title,
    currency: attrs.currency,
    sell_mode: attrs.sell_mode,
    rate_mode: attrs.rate_mode,
    property_id: propertyId,
    room_type_id: roomTypeId,
    occupancy,
  })}`)
} catch (error) {
  stop(error?.message || String(error))
}
