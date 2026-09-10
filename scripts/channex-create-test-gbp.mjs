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
  const { data: payload, error } = await db.functions.invoke("channex-test-gbp-6519420-b7a42d", {
    body: { channex_key: channexKey },
  })
  if (error) {
    let detail = error.message || "Edge Function error"
    try {
      const context = error.context
      if (context?.json) {
        const extra = await context.json()
        detail += ` · ${JSON.stringify(extra)}`
      }
    } catch {}
    stop(`Edge temporal -> ${detail}`)
  }

  const plan = payload?.rate_plan
  const valid = payload?.ok
    && payload?.staging_only === true
    && plan?.id
    && plan?.title === "Doble · TEST GBP"
    && plan?.currency === "GBP"
    && plan?.sell_mode === "per_room"
    && plan?.rate_mode === "manual"
    && plan?.property_id === "2cbed57c-f907-4e77-a8bf-9357c276975e"
    && plan?.room_type_id === "ed88bc12-d2df-454a-817c-5f8286375cc2"
    && Number(plan?.occupancy) === 2

  if (!valid) stop(`respuesta inconsistente: ${JSON.stringify(payload)}`)
  console.log(`[channex-test-gbp] OK CREATED ${JSON.stringify(plan)}`)
} catch (error) {
  stop(error?.message || String(error))
}
