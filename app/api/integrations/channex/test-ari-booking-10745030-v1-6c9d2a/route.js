import { NextResponse } from "next/server"
import { channexMode, channexRequest } from "../../../../../lib/channexServer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PROPERTY_ID = "3e4a91b6-7d40-4230-afa7-0d6758be02ca"
const ROOM_TYPE_ID = "2f0ce963-ab90-45f7-a4a8-9a7b1bc90235"
const RATE_PLAN_ID = "30863ca0-5dd4-4351-b1f3-d57792366d7"
const RATE_PLAN_TITLE = "Doble · TEST GBP"
const BOOKING_TEST_HOTEL_ID = "10745030"
const DATES = ["2026-09-11","2026-09-12","2026-09-13","2026-09-14","2026-09-15","2026-09-16","2026-09-17"]
const TEST_RATE = "100.00"
const TEST_AVAILABILITY = 2

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
    id: data?.id || null,
    title: attrs.title || null,
    currency: attrs.currency || null,
    rate_mode: attrs.rate_mode || null,
    sell_mode: attrs.sell_mode || null,
    property_id: data?.relationships?.property?.data?.id || attrs.property_id || null,
    room_type_id: data?.relationships?.room_type?.data?.id || attrs.room_type_id || null,
    occupancy: attrs.options?.find(option => option?.is_primary)?.occupancy ?? null,
  }
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

    const ratePlan = snapshot(await channexRequest(`/api/v1/rate_plans/${RATE_PLAN_ID}`))
    const valid = ratePlan.id === RATE_PLAN_ID
      && ratePlan.title === RATE_PLAN_TITLE
      && ratePlan.currency === "GBP"
      && ratePlan.rate_mode === "manual"
      && ratePlan.sell_mode === "per_room"
      && ratePlan.property_id === PROPERTY_ID
      && ratePlan.room_type_id === ROOM_TYPE_ID
      && Number(ratePlan.occupancy) === 2

    if (!valid) {
      return json({
        error: "Se abortó el TEST ARI porque el rate plan no coincide con Doble · TEST GBP.",
        rate_plan: ratePlan,
      }, 409)
    }

    const availabilityValues = DATES.map(date => ({
      property_id: PROPERTY_ID,
      room_type_id: ROOM_TYPE_ID,
      date,
      availability: TEST_AVAILABILITY,
    }))

    const restrictionValues = DATES.map(date => ({
      property_id: PROPERTY_ID,
      rate_plan_id: RATE_PLAN_ID,
      date,
      rate: TEST_RATE,
      min_stay: 1,
      max_stay: 0,
      stop_sell: false,
      closed_to_arrival: false,
      closed_to_departure: false,
    }))

    const [availabilityResponse, restrictionsResponse] = await Promise.all([
      channexRequest("/api/v1/availability", {
        method: "POST",
        body: { values: availabilityValues },
      }),
      channexRequest("/api/v1/restrictions", {
        method: "POST",
        body: { values: restrictionValues },
      }),
    ])

    return json({
      ok: true,
      staging: true,
      test: true,
      booking_test_hotel_id: BOOKING_TEST_HOTEL_ID,
      rate_plan: ratePlan,
      ari: {
        date_from: DATES[0],
        date_to: DATES[DATES.length - 1],
        rate_gbp: Number(TEST_RATE),
        availability: TEST_AVAILABILITY,
        min_stay: 1,
        stop_sell: false,
      },
      accepted: {
        availability: Boolean(availabilityResponse),
        restrictions: Boolean(restrictionsResponse),
      },
    })
  } catch (error) {
    console.error("Channex TEST ARI Booking 10745030:", error)
    return json({ error: error?.message || "No se pudo preparar el ARI TEST." }, error?.status || 500)
  }
}
