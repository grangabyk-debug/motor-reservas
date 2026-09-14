import { NextResponse } from "next/server"
import {
  CHANNEX_CHANNELS,
  channexMode,
  channexRequest,
  requirePropertyRole,
} from "../../../../../lib/channexServer"

export const runtime = "nodejs"

const cleanCurrency = value => /^[A-Z]{3}$/.test(String(value || "").toUpperCase()) ? String(value).toUpperCase() : "ARS"
const cleanCountry = value => /^[A-Z]{2}$/.test(String(value || "").toUpperCase()) ? String(value).toUpperCase() : null

async function ensureHub(db, user, property, settings) {
  const { data: existing, error: readError } = await db
    .from("hotel_channel_hubs")
    .select("*")
    .eq("property_id", property.id)
    .eq("provider", "channex")
    .maybeSingle()
  if (readError) throw readError
  if (existing?.external_property_id) return existing

  const currency = cleanCurrency(settings?.pricing?.rate_currency)
  const country = cleanCountry(settings?.taxes?.country)
  const propertyPayload = {
    title: property.name,
    currency,
    property_type: "hotel",
    settings: {
      allow_availability_autoupdate_on_modification: false,
      allow_availability_autoupdate_on_cancellation: false,
      min_stay_type: "both",
      state_length: 500,
    },
  }
  if (property.city) propertyPayload.city = property.city
  if (country) propertyPayload.country = country
  if (country === "AR") propertyPayload.timezone = "America/Argentina/Buenos_Aires"

  const created = await channexRequest("/api/v1/properties", {
    method: "POST",
    body: { property: propertyPayload },
  })
  const externalPropertyId = created?.data?.id || created?.data?.attributes?.id
  if (!externalPropertyId) throw new Error("Channex no devolvió el ID de la propiedad creada.")

  const row = {
    property_id: property.id,
    provider: "channex",
    mode: channexMode(),
    status: "staging",
    external_property_id: externalPropertyId,
    allowed_channels: CHANNEX_CHANNELS,
    created_by: user.id,
    updated_at: new Date().toISOString(),
    diagnostics: { currency, country, provisioned_at: new Date().toISOString() },
    last_error: null,
  }
  const { data: saved, error: saveError } = await db
    .from("hotel_channel_hubs")
    .upsert(row, { onConflict: "property_id,provider" })
    .select("*")
    .single()
  if (saveError) throw saveError
  return saved
}

async function provisionInventoryModel(db, propertyId, hub, settings) {
  const currency = cleanCurrency(settings?.pricing?.rate_currency)
  const [{ data: roomTypes, error: typeError }, { data: rooms, error: roomError }, { data: existingMappings, error: mappingError }] = await Promise.all([
    db.from("hotel_room_types").select("id,name,code,capacity,adults,children,description,base_price,active,online_bookable").eq("property_id", propertyId).eq("active", true).eq("online_bookable", true).order("sort_order"),
    db.from("habitaciones").select("id,room_type_id").eq("property_id", propertyId).eq("activa", true).eq("online_bookable", true),
    db.from("hotel_channel_hub_mappings").select("id,entity_type,local_key,external_id").eq("property_id", propertyId).eq("hub_id", hub.id),
  ])
  if (typeError) throw typeError
  if (roomError) throw roomError
  if (mappingError) throw mappingError

  const mappingKey = (entityType, localKey) => `${entityType}:${localKey}`
  const mappingMap = new Map((existingMappings || []).map(row => [mappingKey(row.entity_type, row.local_key), row]))
  let createdRoomTypes = 0
  let createdRatePlans = 0

  for (const type of roomTypes || []) {
    const localKey = String(type.id)
    const countOfRooms = (rooms || []).filter(room => String(room.room_type_id || "") === localKey).length
    if (!countOfRooms) continue

    let roomMapping = mappingMap.get(mappingKey("room_type", localKey))
    if (!roomMapping) {
      const adults = Math.max(1, Number(type.adults || type.capacity || 1))
      const children = Math.max(0, Number(type.children || 0))
      const createdRoom = await channexRequest("/api/v1/room_types", {
        method: "POST",
        body: {
          room_type: {
            property_id: hub.external_property_id,
            title: type.name,
            count_of_rooms: countOfRooms,
            occ_adults: adults,
            occ_children: children,
            occ_infants: 0,
            default_occupancy: adults,
            room_kind: "room",
            facilities: [],
            content: type.description ? { description: type.description, photos: [] } : undefined,
          },
        },
      })
      const externalId = createdRoom?.data?.id || createdRoom?.data?.attributes?.id
      if (!externalId) throw new Error(`Channex no devolvió ID para ${type.name}.`)
      const { data: inserted, error: insertError } = await db
        .from("hotel_channel_hub_mappings")
        .insert({
          property_id: propertyId,
          hub_id: hub.id,
          entity_type: "room_type",
          local_key: localKey,
          external_id: externalId,
          metadata: { name: type.name, code: type.code, count_of_rooms: countOfRooms },
        })
        .select("id,entity_type,local_key,external_id")
        .single()
      if (insertError) throw insertError
      roomMapping = inserted
      mappingMap.set(mappingKey("room_type", localKey), inserted)
      createdRoomTypes += 1
    }

    if (!mappingMap.get(mappingKey("rate_plan", localKey))) {
      const occupancy = Math.max(1, Number(type.adults || type.capacity || 1))
      const createdRate = await channexRequest("/api/v1/rate_plans", {
        method: "POST",
        body: {
          rate_plan: {
            title: `BAR · ${type.name}`,
            property_id: hub.external_property_id,
            room_type_id: roomMapping.external_id,
            currency,
            sell_mode: "per_room",
            rate_mode: "manual",
            min_stay_arrival: [1,1,1,1,1,1,1],
            min_stay_through: [1,1,1,1,1,1,1],
            stop_sell: [false,false,false,false,false,false,false],
            closed_to_arrival: [false,false,false,false,false,false,false],
            closed_to_departure: [false,false,false,false,false,false,false],
            options: [{ occupancy, is_primary: true, rate: 0 }],
          },
        },
      })
      const externalRateId = createdRate?.data?.id || createdRate?.data?.attributes?.id
      if (!externalRateId) throw new Error(`Channex no devolvió plan tarifario para ${type.name}.`)
      const { data: insertedRate, error: rateInsertError } = await db
        .from("hotel_channel_hub_mappings")
        .insert({
          property_id: propertyId,
          hub_id: hub.id,
          entity_type: "rate_plan",
          local_key: localKey,
          external_id: externalRateId,
          metadata: { title: `BAR · ${type.name}`, base_price: Number(type.base_price || 0), currency },
        })
        .select("id,entity_type,local_key,external_id")
        .single()
      if (rateInsertError) throw rateInsertError
      mappingMap.set(mappingKey("rate_plan", localKey), insertedRate)
      createdRatePlans += 1
    }
  }

  return {
    room_types_total: (roomTypes || []).length,
    room_types_mapped: [...mappingMap.values()].filter(row => row.entity_type === "room_type").length,
    rate_plans_mapped: [...mappingMap.values()].filter(row => row.entity_type === "rate_plan").length,
    created_room_types: createdRoomTypes,
    created_rate_plans: createdRatePlans,
  }
}

export async function POST(request) {
  let db
  let propertyId
  try {
    const body = await request.json().catch(() => ({}))
    propertyId = body?.property_id
    if (!propertyId) return NextResponse.json({ error: "Falta property_id." }, { status: 400 })

    const auth = await requirePropertyRole(request, propertyId)
    db = auth.db
    const { data: settingsRow, error: settingsError } = await db
      .from("property_settings")
      .select("settings")
      .eq("property_id", propertyId)
      .maybeSingle()
    if (settingsError) throw settingsError

    const hub = await ensureHub(db, auth.user, auth.property, settingsRow?.settings || {})
    const model = await provisionInventoryModel(db, propertyId, hub, settingsRow?.settings || {})
    const diagnostics = {
      ...(hub.diagnostics || {}),
      ...model,
      prepared_at: new Date().toISOString(),
    }
    const { data: updatedHub, error: updateError } = await db
      .from("hotel_channel_hubs")
      .update({ status: "staging", diagnostics, last_error: null, updated_at: new Date().toISOString() })
      .eq("id", hub.id)
      .select("*")
      .single()
    if (updateError) throw updateError

    return NextResponse.json({ hub: updatedHub, model })
  } catch (error) {
    console.error("Channex provision error:", error)
    if (db && propertyId) {
      await db.from("hotel_channel_hubs").update({ status: "error", last_error: error?.message || "Error de Channex", updated_at: new Date().toISOString() }).eq("property_id", propertyId).eq("provider", "channex")
    }
    return NextResponse.json({ error: error?.message || "No se pudo preparar Channex." }, { status: error?.status || 500 })
  }
}
