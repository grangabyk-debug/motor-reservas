import { NextResponse } from "next/server"
import { channexMode, channexRequest } from "../../../../../lib/channexServer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PROPERTY_ID = "2cbed57c-f907-4e77-a8bf-9357c276975e"
const ROOM_TYPE_ID = "ed88bc12-d2df-454a-817c-5f8286375cc2"
const TITLE = "Doble · TEST GBP"

function safeRatePlan(plan) {
  if (!plan?.data) return null
  return {
    id: plan.data.id,
    title: plan.data.attributes?.title,
    currency: plan.data.attributes?.currency,
    sell_mode: plan.data.attributes?.sell_mode,
    rate_mode: plan.data.attributes?.rate_mode,
    options: plan.data.attributes?.options,
    property_id: plan.data.relationships?.property?.data?.id,
    room_type_id: plan.data.relationships?.room_type?.data?.id,
  }
}

export async function GET() {
  try {
    if (process.env.VERCEL_ENV !== "preview") {
      return NextResponse.json({ error: "TEST bloqueado fuera de Vercel Preview." }, { status: 403 })
    }
    if (channexMode() !== "staging") {
      return NextResponse.json({ error: "TEST bloqueado: Channex no está en staging." }, { status: 403 })
    }

    const options = await channexRequest(`/api/v1/rate_plans/options?filter[property_id]=${PROPERTY_ID}`)
    const existing = (options?.data || []).find(item => {
      const attrs = item?.attributes || {}
      return attrs.title === TITLE && attrs.room_type_id === ROOM_TYPE_ID
    })

    if (existing?.id) {
      const current = await channexRequest(`/api/v1/rate_plans/${existing.id}`)
      const ratePlan = safeRatePlan(current)
      if (ratePlan?.currency !== "GBP") {
        return NextResponse.json({ error: "Ya existe el TEST con una moneda distinta de GBP.", rate_plan: ratePlan }, { status: 409 })
      }
      return NextResponse.json({ ok: true, created: false, staging_only: true, rate_plan: ratePlan }, {
        headers: { "Cache-Control": "no-store" },
      })
    }

    const created = await channexRequest("/api/v1/rate_plans", {
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

    const id = created?.data?.id
    if (!id) throw new Error("Channex no devolvió ID para el rate plan TEST GBP.")

    const verified = await channexRequest(`/api/v1/rate_plans/${id}`)
    const ratePlan = safeRatePlan(verified)
    const valid = ratePlan?.title === TITLE
      && ratePlan?.currency === "GBP"
      && ratePlan?.property_id === PROPERTY_ID
      && ratePlan?.room_type_id === ROOM_TYPE_ID
      && ratePlan?.rate_mode === "manual"
      && ratePlan?.sell_mode === "per_room"

    if (!valid) {
      return NextResponse.json({ error: "El rate plan fue creado pero la verificación no coincide.", rate_plan: ratePlan }, { status: 500 })
    }

    return NextResponse.json({ ok: true, created: true, staging_only: true, rate_plan: ratePlan }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Channex TEST GBP error:", error)
    return NextResponse.json({ error: error?.message || "No se pudo crear el rate plan TEST GBP." }, { status: error?.status || 500 })
  }
}
