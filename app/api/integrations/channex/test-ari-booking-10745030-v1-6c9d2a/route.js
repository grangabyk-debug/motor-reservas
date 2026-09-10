import { NextResponse } from "next/server"
import { channexMode, channexRequest } from "../../../../../lib/channexServer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PROPERTY_ID = "3e4a91b6-7d40-4230-afa7-0d6758be02ca"
const ROOM_TYPE_ID = "2f0ce963-ab90-45f7-a4a8-9a7b1bc90235"
const RATE_PLAN_TITLE = "Doble · TEST GBP"
const BOOKING_TEST_HOTEL_ID = "10745030"
const DATE_FROM = "2026-09-11"
const DATE_TO = "2026-09-17"
const TEST_RATE = "100.00"
const TEST_AVAILABILITY = 2
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}

function snapshot(payload) {
  const data = payload?.data
  const attrs = data?.attributes || {}
  return {
    id: data?.id || attrs.id || null,
    title: attrs.title || null,
    currency: attrs.currency || null,
    rate_mode: attrs.rate_mode || null,
    sell_mode: attrs.sell_mode || null,
    property_id: data?.relationships?.property?.data?.id || attrs.property_id || null,
    room_type_id: data?.relationships?.room_type?.data?.id || attrs.room_type_id || null,
    occupancy: attrs.options?.find(option => option?.is_primary)?.occupancy ?? null,
  }
}

function assertNoWarnings(label, response) {
  const warnings = response?.meta?.warnings
  if (Array.isArray(warnings) && warnings.length) {
    const error = new Error(`${label} devolvió warnings: ${JSON.stringify(warnings)}`)
    error.status = 422
    throw error
  }
}

function extractTaskIds(response) {
  return (Array.isArray(response?.data) ? response.data : [])
    .filter(item => item?.type === "task" && item?.id)
    .map(item => item.id)
}

function buildDates() {
  const dates = []
  for (let cursor = new Date(`${DATE_FROM}T00:00:00Z`); cursor <= new Date(`${DATE_TO}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10))
  }
  return dates
}

async function readVerification(ratePlanId, dates) {
  const restrictionNames = "rate,min_stay_arrival,min_stay_through,max_stay,stop_sell,closed_to_arrival,closed_to_departure"
  const [verifiedRestrictions, verifiedAvailability] = await Promise.all([
    channexRequest(`/api/v1/restrictions?filter[property_id]=${encodeURIComponent(PROPERTY_ID)}&filter[date][gte]=${DATE_FROM}&filter[date][lte]=${DATE_TO}&filter[restrictions]=${restrictionNames}`),
    channexRequest(`/api/v1/availability?filter[property_id]=${encodeURIComponent(PROPERTY_ID)}&filter[date][gte]=${DATE_FROM}&filter[date][lte]=${DATE_TO}`),
  ])

  const restrictionState = verifiedRestrictions?.data?.[ratePlanId] || {}
  const availabilityState = verifiedAvailability?.data?.[ROOM_TYPE_ID] || {}
  const verification = dates.map(date => ({
    date,
    rate: restrictionState?.[date]?.rate ?? null,
    availability: availabilityState?.[date] ?? null,
    min_stay_arrival: restrictionState?.[date]?.min_stay_arrival ?? null,
    min_stay_through: restrictionState?.[date]?.min_stay_through ?? null,
    stop_sell: restrictionState?.[date]?.stop_sell ?? null,
  }))

  const allVerified = verification.every(row =>
    Number(row.rate) === 100
    && Number(row.availability) === TEST_AVAILABILITY
    && Number(row.min_stay_arrival) === 1
    && Number(row.min_stay_through) === 1
    && row.stop_sell === false
  )

  return { allVerified, verification }
}

export async function GET() {
  try {
    if (process.env.VERCEL_ENV !== "preview") {
      return json({ error: "TEST disponible únicamente en Vercel Preview." }, 403)
    }
    if (process.env.VERCEL_GIT_COMMIT_REF && process.env.VERCEL_GIT_COMMIT_REF !== "pms-rebuild-zero") {
      return json({ error: "TEST bloqueado fuera de pms-rebuild-zero." }, 403)
    }
    if (channexMode() !== "staging") {
      return json({ error: "TEST bloqueado: Channex no está en STAGING." }, 403)
    }

    const options = await channexRequest(`/api/v1/rate_plans/options?filter[property_id]=${encodeURIComponent(PROPERTY_ID)}`)
    const candidate = (options?.data || []).find(item => item?.attributes?.title === RATE_PLAN_TITLE)
    const ratePlanId = candidate?.id || candidate?.attributes?.id || null

    if (!ratePlanId || !UUID_RE.test(ratePlanId)) {
      return json({
        error: "No se encontró un UUID válido para Doble · TEST GBP en Channex Staging.",
        found_id: ratePlanId,
      }, 409)
    }

    const ratePlan = snapshot(await channexRequest(`/api/v1/rate_plans/${ratePlanId}`))
    const valid = ratePlan.id === ratePlanId
      && ratePlan.title === RATE_PLAN_TITLE
      && ratePlan.currency === "GBP"
      && ratePlan.rate_mode === "manual"
      && ratePlan.sell_mode === "per_room"
      && ratePlan.property_id === PROPERTY_ID
      && ratePlan.room_type_id === ROOM_TYPE_ID
      && Number(ratePlan.occupancy) === 2

    if (!valid) {
      return json({
        error: "Se abortó el TEST ARI porque el rate plan no coincide exactamente con Doble · TEST GBP.",
        rate_plan: ratePlan,
      }, 409)
    }

    const restrictionsResponse = await channexRequest("/api/v1/restrictions", {
      method: "POST",
      body: {
        values: [{
          property_id: PROPERTY_ID,
          rate_plan_id: ratePlanId,
          date_from: DATE_FROM,
          date_to: DATE_TO,
          rate: TEST_RATE,
          min_stay_arrival: 1,
          min_stay_through: 1,
          max_stay: 0,
          stop_sell: false,
          closed_to_arrival: false,
          closed_to_departure: false,
        }],
      },
    })
    assertNoWarnings("Restrictions", restrictionsResponse)

    const availabilityResponse = await channexRequest("/api/v1/availability", {
      method: "POST",
      body: {
        values: [{
          property_id: PROPERTY_ID,
          room_type_id: ROOM_TYPE_ID,
          date_from: DATE_FROM,
          date_to: DATE_TO,
          availability: TEST_AVAILABILITY,
        }],
      },
    })
    assertNoWarnings("Availability", availabilityResponse)

    const taskIds = {
      restrictions: extractTaskIds(restrictionsResponse),
      availability: extractTaskIds(availabilityResponse),
    }

    const dates = buildDates()
    let latest = await readVerification(ratePlanId, dates)
    let attempts = 1

    while (!latest.allVerified && attempts < 12) {
      await sleep(attempts < 4 ? 750 : 1250)
      latest = await readVerification(ratePlanId, dates)
      attempts += 1
    }

    if (!latest.allVerified) {
      return json({
        error: "Channex aceptó las tareas ARI pero no terminó de reflejar el estado esperado dentro de la ventana de verificación.",
        staging: true,
        task_ids: taskIds,
        verification_attempts: attempts,
        rate_plan: ratePlan,
        verification: latest.verification,
      }, 409)
    }

    return json({
      ok: true,
      staging: true,
      test: true,
      booking_test_hotel_id: BOOKING_TEST_HOTEL_ID,
      task_ids: taskIds,
      verification_attempts: attempts,
      rate_plan: ratePlan,
      ari: {
        date_from: DATE_FROM,
        date_to: DATE_TO,
        rate_gbp: Number(TEST_RATE),
        availability: TEST_AVAILABILITY,
        min_stay_arrival: 1,
        min_stay_through: 1,
        stop_sell: false,
      },
      verified: true,
      verification: latest.verification,
    })
  } catch (error) {
    console.error("Channex TEST ARI Booking 10745030:", error)
    return json({ error: error?.message || "No se pudo preparar el ARI TEST." }, error?.status || 500)
  }
}
