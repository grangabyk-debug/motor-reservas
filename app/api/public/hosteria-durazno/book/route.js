import { NextResponse } from "next/server"

const EDGE_FUNCTION_URL = "https://kklvahycvojoktacpyiu.supabase.co/functions/v1/public-booking-durazno"

export async function POST(request) {
  try {
    const body = await request.text()
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    })
    const responseBody = await response.json()
    return NextResponse.json(responseBody, { status: response.status })
  } catch (error) {
    console.error("public booking proxy error", error)
    return NextResponse.json({ error: "No se pudo crear la reserva." }, { status: 500 })
  }
}
