import { NextResponse } from "next/server"
import {
  CHANNEX_CHANNELS,
  channexBaseUrl,
  channexRequest,
  requirePropertyRole,
} from "../../../../../lib/channexServer"

export const runtime = "nodejs"

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const propertyId = body?.property_id
    if (!propertyId) return NextResponse.json({ error: "Falta property_id." }, { status: 400 })

    const { db, user } = await requirePropertyRole(request, propertyId)
    const { data: hub, error: hubError } = await db
      .from("hotel_channel_hubs")
      .select("id,external_property_id,external_group_id,allowed_channels,status")
      .eq("property_id", propertyId)
      .eq("provider", "channex")
      .maybeSingle()
    if (hubError) throw hubError
    if (!hub?.external_property_id) {
      return NextResponse.json({ error: "Primero hay que preparar la propiedad en Channex." }, { status: 409 })
    }

    const oneTimeToken = {
      property_id: hub.external_property_id,
      username: user.email || `hotel-${String(propertyId).slice(0, 8)}`,
    }
    if (hub.external_group_id) oneTimeToken.group_id = hub.external_group_id

    const tokenResponse = await channexRequest("/api/v1/auth/one_time_token", {
      method: "POST",
      body: { one_time_token: oneTimeToken },
    })
    const token = tokenResponse?.data?.token
    if (!token) throw new Error("Channex no devolvió el token de acceso temporal.")

    const allowed = Array.isArray(hub.allowed_channels) && hub.allowed_channels.length
      ? hub.allowed_channels
      : CHANNEX_CHANNELS
    const params = new URLSearchParams({
      oauth_session_key: token,
      app_mode: "headless",
      redirect_to: "/channels",
      property_id: hub.external_property_id,
      channels: allowed.join(","),
      lng: "es",
      read_only_availability: "true",
    })

    return NextResponse.json({
      iframe_url: `${channexBaseUrl()}/auth/exchange?${params.toString()}`,
      channels: allowed,
      property_id: hub.external_property_id,
    })
  } catch (error) {
    console.error("Channex iframe session error:", error)
    return NextResponse.json({ error: error?.message || "No se pudo abrir el Channel Hub." }, { status: error?.status || 500 })
  }
}
