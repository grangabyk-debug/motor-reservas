import { NextResponse } from "next/server"
import { channexMode, channexRequest } from "../../../../../lib/channexServer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PROPERTY_ID = "3e4a91b6-7d40-4230-afa7-0d6758be02ca"
const ROOM_TYPE_ID = "2f0ce963-ab90-45f7-a4a8-9a7b1bc90235"
const RATE_PLAN_TITLE = "Doble · TEST GBP"
const CHANNEL_TITLE = "Booking.com · TEST"
const DATE_FROM = "2026-09-11"
const DATE_TO = "2026-09-17"

function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } })
}

async function safeGet(path) {
  try {
    const data = await channexRequest(path)
    return { ok: true, data }
  } catch (error) {
    return { ok: false, status: error?.status || null, error: error?.message || String(error) }
  }
}

function safeChannel(item) {
  const attrs = item?.attributes || {}
  const pick = [
    "title", "is_active", "status", "channel", "channel_code", "provider_code",
    "hotel_id", "hotel_code", "inserted_at", "updated_at", "last_sync_at",
    "last_error", "error", "errors", "warnings", "mapping_status", "health"
  ]
  const selected = {}
  for (const key of pick) if (attrs[key] !== undefined) selected[key] = attrs[key]
  return {
    id: item?.id || attrs?.id || null,
    type: item?.type || null,
    attributes: selected,
    attribute_keys: Object.keys(attrs).sort(),
  }
}

function findRatePlanId(options) {
  const candidate = (options?.data || []).find(item => item?.attributes?.title === RATE_PLAN_TITLE)
  return candidate?.id || candidate?.attributes?.id || null
}

export async function GET() {
  try {
    if (process.env.VERCEL_ENV !== "preview") return json({ error: "Sólo Preview." }, 403)
    if (process.env.VERCEL_GIT_COMMIT_REF && process.env.VERCEL_GIT_COMMIT_REF !== "pms-rebuild-zero") {
      return json({ error: "Sólo pms-rebuild-zero." }, 403)
    }
    if (channexMode() !== "staging") return json({ error: "Sólo Channex Staging." }, 403)

    const [propertyRes, channelsRes, rateOptionsRes, restrictionsRes, availabilityRes, rulesRes, bookingsRes] = await Promise.all([
      safeGet(`/api/v1/properties/${PROPERTY_ID}`),
      safeGet(`/api/v1/channels?filter[property_id]=${encodeURIComponent(PROPERTY_ID)}&pagination[limit]=100`),
      safeGet(`/api/v1/rate_plans/options?filter[property_id]=${encodeURIComponent(PROPERTY_ID)}`),
      safeGet(`/api/v1/restrictions?filter[property_id]=${encodeURIComponent(PROPERTY_ID)}&filter[date][gte]=${DATE_FROM}&filter[date][lte]=${DATE_TO}&filter[restrictions]=rate,min_stay_arrival,min_stay_through,max_stay,stop_sell,closed_to_arrival,closed_to_departure`),
      safeGet(`/api/v1/availability?filter[property_id]=${encodeURIComponent(PROPERTY_ID)}&filter[date][gte]=${DATE_FROM}&filter[date][lte]=${DATE_TO}`),
      safeGet(`/api/v1/channel_availability_rules?filter[property_id]=${encodeURIComponent(PROPERTY_ID)}&pagination[limit]=100`),
      safeGet(`/api/v1/bookings?filter[property_id]=${encodeURIComponent(PROPERTY_ID)}&pagination[limit]=20`),
    ])

    const channelItems = channelsRes.ok && Array.isArray(channelsRes.data?.data) ? channelsRes.data.data : []
    const channels = channelItems.map(safeChannel)
    const bookingChannel = channels.find(item => item.attributes?.title === CHANNEL_TITLE)
      || channels.find(item => String(item.attributes?.channel_code || item.attributes?.channel || "").toUpperCase() === "BDC")
      || null

    const ratePlanId = rateOptionsRes.ok ? findRatePlanId(rateOptionsRes.data) : null
    const restrictionState = ratePlanId && restrictionsRes.ok ? (restrictionsRes.data?.data?.[ratePlanId] || {}) : {}
    const availabilityState = availabilityRes.ok ? (availabilityRes.data?.data?.[ROOM_TYPE_ID] || {}) : {}
    const verification = []
    for (let cursor = new Date(`${DATE_FROM}T00:00:00Z`); cursor <= new Date(`${DATE_TO}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10)
      verification.push({
        date,
        rate: restrictionState?.[date]?.rate ?? null,
        availability: availabilityState?.[date] ?? null,
        min_stay_arrival: restrictionState?.[date]?.min_stay_arrival ?? null,
        min_stay_through: restrictionState?.[date]?.min_stay_through ?? null,
        stop_sell: restrictionState?.[date]?.stop_sell ?? null,
        closed_to_arrival: restrictionState?.[date]?.closed_to_arrival ?? null,
        closed_to_departure: restrictionState?.[date]?.closed_to_departure ?? null,
      })
    }

    const ari_ok = verification.length === 7 && verification.every(row =>
      Number(row.rate) === 100 && Number(row.availability) === 2 &&
      Number(row.min_stay_arrival) === 1 && Number(row.min_stay_through) === 1 &&
      row.stop_sell === false && row.closed_to_arrival === false && row.closed_to_departure === false
    )

    const channelId = bookingChannel?.id || null
    const logAttempts = {}
    if (channelId) {
      const paths = {
        channel_events: `/api/v1/channel_events?filter[channel_id]=${encodeURIComponent(channelId)}&pagination[limit]=50`,
        channel_logs: `/api/v1/channel_logs?filter[channel_id]=${encodeURIComponent(channelId)}&pagination[limit]=50`,
        sync_logs: `/api/v1/sync_logs?filter[channel_id]=${encodeURIComponent(channelId)}&pagination[limit]=50`,
      }
      for (const [name, path] of Object.entries(paths)) {
        const result = await safeGet(path)
        logAttempts[name] = result.ok
          ? { ok: true, count: Array.isArray(result.data?.data) ? result.data.data.length : null, data: result.data?.data || result.data?.meta || null }
          : { ok: false, status: result.status, error: result.error }
      }
    }

    const propertyAttrs = propertyRes.ok ? (propertyRes.data?.data?.attributes || {}) : {}
    const property = propertyRes.ok ? {
      id: propertyRes.data?.data?.id || PROPERTY_ID,
      title: propertyAttrs.title || null,
      is_active: propertyAttrs.is_active ?? null,
      currency: propertyAttrs.currency || null,
      acc_channels_count: propertyAttrs.acc_channels_count ?? propertyAttrs.acc_cannels_count ?? null,
      updated_at: propertyAttrs.updated_at || null,
    } : propertyRes

    return json({
      ok: true,
      staging: true,
      read_only: true,
      checked_at: new Date().toISOString(),
      property,
      channel_query_ok: channelsRes.ok,
      channels,
      booking_channel: bookingChannel,
      rate_plan_id: ratePlanId,
      ari_ok,
      ari: verification,
      availability_rules: rulesRes.ok ? (rulesRes.data?.data || []) : rulesRes,
      bookings_count: bookingsRes.ok && Array.isArray(bookingsRes.data?.data) ? bookingsRes.data.data.length : null,
      log_attempts: logAttempts,
    })
  } catch (error) {
    console.error("Channex read-only diagnostic:", error)
    return json({ error: error?.message || "No se pudo ejecutar diagnóstico read-only." }, error?.status || 500)
  }
}
