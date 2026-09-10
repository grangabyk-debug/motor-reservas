const STAGING_BASE = "https://staging.channex.io"
const PROPERTY_ID = "2cbed57c-f907-4e77-a8bf-9357c276975e"
const ROOM_TYPE_ID = "ed88bc12-d2df-454a-817c-5f8286375cc2"
const TITLE = "Doble · TEST GBP"

function stop(message) {
  console.error(`[channex-test-gbp] ${message}`)
  process.exit(1)
}

if (process.env.VERCEL_ENV !== "preview") {
  console.log(`[channex-test-gbp] omitido: VERCEL_ENV=${process.env.VERCEL_ENV || "unset"}`)
  process.exit(0)
}

const configuredBase = String(process.env.CHANNEX_BASE_URL || "").trim().replace(/\/$/, "")
const configuredEnv = String(process.env.CHANNEX_ENV || "staging").toLowerCase()
if ((configuredBase && configuredBase !== STAGING_BASE) || (!configuredBase && configuredEnv === "production")) {
  stop("bloqueado: la configuración de Channex no apunta a STAGING")
}

const apiKey = String(process.env.CHANNEX_API_KEY || "").trim()
if (!apiKey) stop("falta CHANNEX_API_KEY en Preview")

async function createRatePlan() {
  const response = await fetch(`${STAGING_BASE}/api/v1/rate_plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "user-api-key": apiKey,
    },
    body: JSON.stringify({
      rate_plan: {
        title: TITLE,
        property_id: PROPERTY_ID,
        room_type_id: ROOM_TYPE_ID,
        parent_rate_plan_id: null,
        children_fee: "0.00",
        infant_fee: "0.00",
        max_stay: [0,0,0,0,0,0,0],
        min_stay_arrival: [1,1,1,1,1,1,1],
        min_stay_through: [1,1,1,1,1,1,1],
        closed_to_arrival: [false,false,false,false,false,false,false],
        closed_to_departure: [false,false,false,false,false,false,false],
        stop_sell: [false,false,false,false,false,false,false],
        options: [{ occupancy: 2, is_primary: true, rate: 0 }],
        currency: "GBP",
        sell_mode: "per_room",
        rate_mode: "manual",
        inherit_rate: false,
        inherit_closed_to_arrival: false,
        inherit_closed_to_departure: false,
        inherit_stop_sell: false,
        inherit_min_stay_arrival: false,
        inherit_min_stay_through: false,
        inherit_max_stay: false,
        inherit_max_sell: false,
        inherit_max_availability: false,
        inherit_availability_offset: false,
        auto_rate_settings: null,
      },
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.errors) {
    const details = payload?.errors?.details ? ` ${JSON.stringify(payload.errors.details)}` : ""
    throw new Error(`POST /rate_plans -> ${response.status} ${payload?.errors?.title || payload?.errors?.code || response.statusText}${details}`)
  }
  return payload
}

function snapshot(payload) {
  const data = payload?.data
  if (!data) return null
  return {
    id: data.id,
    title: data.attributes?.title,
    currency: data.attributes?.currency,
    rate_mode: data.attributes?.rate_mode,
    sell_mode: data.attributes?.sell_mode,
    occupancy: data.attributes?.options?.find(option => option?.is_primary)?.occupancy,
    property_id: data.relationships?.property?.data?.id,
    room_type_id: data.relationships?.room_type?.data?.id,
  }
}

try {
  const created = snapshot(await createRatePlan())
  const valid = created?.id
    && created?.title === TITLE
    && created?.currency === "GBP"
    && created?.property_id === PROPERTY_ID
    && created?.room_type_id === ROOM_TYPE_ID
    && created?.rate_mode === "manual"
    && created?.sell_mode === "per_room"
    && Number(created?.occupancy) === 2

  if (!valid) stop(`creado pero respuesta inconsistente: ${JSON.stringify(created)}`)
  console.log(`[channex-test-gbp] OK CREATED ${JSON.stringify(created)}`)
} catch (error) {
  stop(error?.message || String(error))
}
