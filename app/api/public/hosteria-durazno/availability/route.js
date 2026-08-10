import { NextResponse } from "next/server"

const EDGE_FUNCTION_URL = "https://kklvahycvojoktacpyiu.supabase.co/functions/v1/public-booking-durazno"

export async function GET(request) {
  try {
    const incoming = new URL(request.url)
    const target = new URL(EDGE_FUNCTION_URL)
    target.search = incoming.search

    const response = await fetch(target, { cache: "no-store" })
    const body = await response.json()
    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error("public availability proxy error", error)
    return NextResponse.json({ error: "No se pudo consultar disponibilidad." }, { status: 500 })
  }
}
