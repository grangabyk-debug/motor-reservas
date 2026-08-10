import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const PROPERTY_ID = "46843e01-b551-41ed-84b6-c8805c0beaa4"

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel.")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const checkIn = searchParams.get("check_in")
    const checkOut = searchParams.get("check_out")
    const guests = Number(searchParams.get("guests") || 1)

    if (!checkIn || !checkOut || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) || checkOut <= checkIn) {
      return NextResponse.json({ error: "Fechas inválidas." }, { status: 400 })
    }
    if (!Number.isInteger(guests) || guests < 1 || guests > 10) {
      return NextResponse.json({ error: "Cantidad de huéspedes inválida." }, { status: 400 })
    }

    const supabase = adminClient()
    const { data: rooms, error: roomsError } = await supabase
      .from("habitaciones")
      .select("id,nombre,tipo,capacidad,precio,activa")
      .eq("property_id", PROPERTY_ID)
      .eq("activa", true)
      .order("id")

    if (roomsError) throw roomsError

    const { data: reservations, error: reservationsError } = await supabase
      .from("reservas")
      .select("habitacion_id,fecha_entrada,fecha_salida,estado")
      .eq("property_id", PROPERTY_ID)
      .lt("fecha_entrada", checkOut)
      .gt("fecha_salida", checkIn)
      .not("estado", "in", "(cancelada,finalizada)")

    if (reservationsError) throw reservationsError

    const occupied = new Set((reservations || []).map((r) => r.habitacion_id))
    const available = (rooms || []).filter((room) => !occupied.has(room.id) && (!room.capacidad || room.capacidad >= guests))

    return NextResponse.json({ property_id: PROPERTY_ID, check_in: checkIn, check_out: checkOut, rooms: available.map((room) => ({ id: room.id, name: room.nombre, type: room.tipo, capacity: room.capacidad, price: room.precio })) })
  } catch (error) {
    console.error("public availability error", error)
    return NextResponse.json({ error: error.message || "No se pudo consultar disponibilidad." }, { status: 500 })
  }
}
