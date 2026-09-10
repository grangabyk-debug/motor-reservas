import { NextResponse } from "next/server"
import { adminSupabase, channexMode, channexRequest } from "../../../../../../lib/channexServer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LOCAL_PROPERTY_ID = "46843e01-b551-41ed-84b6-c8805c0beaa4"
const TEST_TITLE = "Doble · TEST GBP"

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}

function rateSnapshot(payload) {
  const data = payload?.data
  const attrs = data?.attributes || {}
  if (!data?.id) return null
  return {
    id: data.id,
    title: attrs.title,
    currency: attrs.currency,
    rate_mode: attrs.rate_mode,
    sell_mode: attrs.sell_mode,
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

    const db = adminSupabase()
    const [{ data: hub, error: hubError }, { data: roomType, error: roomError }] = await Promise.all([
      db.from("hotel_channel_hubs")
        .select("id,external_property_id,mode,status")
        .eq("property_id", LOCAL_PROPERTY_ID)
        .eq("provider", "channex")
        .maybeSingle(),
      db.from("hotel_room_types")
        .select("id,name,code,adults,capacity")
        .eq("property_id", LOCAL_PROPERTY_ID)
        .eq("code", "DOBLE")
        .maybeSingle(),
    ])
    if (hubError) throw hubError
    if (roomError) throw roomError
    if (!hub?.external_property_id || hub.mode !== "staging") {
      return json({ error: "Hub de Hostería Durazno no está preparado en STAGING." }, 409)
    }
    if (!roomType?.id) return json({ error: "No se encontró la categoría Doble." }, 409)

    const { data: roomMapping, error: mappingError } = await db.from("hotel_channel_hub_mappings")
      .select("external_id")
      .eq("property_id", LOCAL_PROPERTY_ID)
      .eq("hub_id", hub.id)
      .eq("entity_type", "room_type")
      .eq("local_key", String(roomType.id))
      .maybeSingle()
    if (mappingError) throw mappingError
    if (!roomMapping?.external_id) return json({ error: "Doble no tiene room type mapeado en Channex." }, 409)

    const propertyId = hub.external_property_id
    const roomTypeId = roomMapping.external_id

    const options = await channexRequest(`/api/v1/rate_plans/options?filter[property_id]=${encodeURIComponent(propertyId)}`)
    const existing = (options?.data || []).find(item => item?.attributes?.title === TEST_TITLE)

    if (existing?.id) {
      const current = rateSnapshot(await channexRequest(`/api/v1/rate_plans/${existing.id}`))
      const valid = current?.title === TEST_TITLE
        && current?.currency === "GBP"
        && current?.rate_mode === "manual"
        && current?.sell_mode === "per_room"
        && current?.property_id === propertyId
        && current?.room_type_id === roomTypeId
        && Number(current?.occupancy) === 2
      if (!valid) {
        return json({ error: "Ya existe un TEST con ese nombre pero su configuración no coincide.", rate_plan: current }, 409)
      }
      return json({ ok: true, created: false, staging: true, test: true, booking_test_hotel_id: "6519420", rate_plan: current })
    }

    const created = await channexRequest("/api/v1/rate_plans", {
      method: "POST",
      body: {
        rate_plan: {
          title: TEST_TITLE,
          property_id: propertyId,
          room_type_id: roomTypeId,
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

    const createdId = created?.data?.id
    if (!createdId) throw new Error("Channex no devolvió el ID del rate plan TEST.")
    const verified = rateSnapshot(await channexRequest(`/api/v1/rate_plans/${createdId}`))
    const valid = verified?.title === TEST_TITLE
      && verified?.currency === "GBP"
      && verified?.rate_mode === "manual"
      && verified?.sell_mode === "per_room"
      && verified?.property_id === propertyId
      && verified?.room_type_id === roomTypeId
      && Number(verified?.occupancy) === 2
    if (!valid) throw new Error(`El TEST fue creado pero la verificación no coincide: ${JSON.stringify(verified)}`)

    return json({ ok: true, created: true, staging: true, test: true, booking_test_hotel_id: "6519420", rate_plan: verified }, 201)
  } catch (error) {
    console.error("Channex TEST GBP v2:", error)
    return json({ error: error?.message || "No se pudo crear Doble · TEST GBP." }, error?.status || 500)
  }
}
