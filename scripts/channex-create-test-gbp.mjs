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

async function request(path, options = {}) {
  const response = await fetch(`${STAGING_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "user-api-key": apiKey,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.errors) {
    const detail = payload?.errors?.details ? ` ${JSON.stringify(payload.errors.details)}` : ""
    throw new Error(`${payload?.errors?.title || payload?.errors?.code || `HTTP ${response.status}`}${detail}`)
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
  const options = await request(`/api/v1/rate_plans/options?filter[property_id]=${PROPERTY_ID}`)
  const existing = (options?.data || []).find(item => {
    const attrs = item?.attributes || {}
    return attrs.title === TITLE && attrs.room_type_id === ROOM_TYPE_ID
  })

  let id = existing?.id
  let created = false

  if (!id) {
    const response = await request("/api/v1/rate_plans", {
      method: "POST",
      body: {
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
      },
    })
    id = response?.data?.id
    created = true
  }

  if (!id) stop("Channex no devolvió un ID para el rate plan TEST GBP")

  const verified = snapshot(await request(`/api/v1/rate_plans/${id}`))
  const valid = verified?.title === TITLE
    && verified?.currency === "GBP"
    && verified?.property_id === PROPERTY_ID
    && verified?.room_type_id === ROOM_TYPE_ID
    && verified?.rate_mode === "manual"
    && verified?.sell_mode === "per_room"
    && Number(verified?.occupancy) === 2

  if (!valid) stop(`verificación inconsistente: ${JSON.stringify(verified)}`)

  console.log(`[channex-test-gbp] OK ${created ? "CREATED" : "EXISTING"} ${JSON.stringify(verified)}`)
} catch (error) {
  stop(error?.message || String(error))
}
