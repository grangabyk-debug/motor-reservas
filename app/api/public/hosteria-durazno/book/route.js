import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const PROPERTY_ID = "46843e01-b551-41ed-84b6-c8805c0beaa4"
const OWNER_ID = "3dcb8ad3-36eb-4d7c-bc27-598bee74a4f0"

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel.")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const checkIn = String(body.check_in || "")
    const checkOut = String(body.check_out || "")
    const unitId = Number(body.unit_id)
    const guests = Number(body.guests)
    const name = String(body.name || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const phone = String(body.phone || "").trim()

    if (!validDate(checkIn) || !validDate(checkOut) || checkOut <= checkIn) return NextResponse.json({ error: "Fechas inválidas." }, { status: 400 })
    if (!Number.isInteger(unitId) || unitId <= 0) return NextResponse.json({ error: "Habitación inválida." }, { status: 400 })
    if (!Number.isInteger(guests) || guests < 1 || guests > 10) return NextResponse.json({ error: "Cantidad de huéspedes inválida." }, { status: 400 })
    if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Nombre inválido." }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) return NextResponse.json({ error: "Email inválido." }, { status: 400 })
    if (phone.length > 50) return NextResponse.json({ error: "Teléfono inválido." }, { status: 400 })

    const supabase = adminClient()

    const { data: room, error: roomError } = await supabase
      .from("habitaciones")
      .select("id,nombre,tipo,capacidad,precio,activa")
      .eq("id", unitId)
      .eq("property_id", PROPERTY_ID)
      .eq("activa", true)
      .maybeSingle()

    if (roomError) throw roomError
    if (!room) return NextResponse.json({ error: "La habitación ya no está disponible." }, { status: 409 })
    if (room.capacidad && guests > room.capacidad) return NextResponse.json({ error: "La cantidad de huéspedes supera la capacidad." }, { status: 409 })

    const { data: conflicts, error: conflictError } = await supabase
      .from("reservas")
      .select("id,estado,fecha_entrada,fecha_salida")
      .eq("property_id", PROPERTY_ID)
      .eq("habitacion_id", unitId)
      .lt("fecha_entrada", checkOut)
      .gt("fecha_salida", checkIn)
      .not("estado", "in", "(cancelada,finalizada)")
      .limit(1)

    if (conflictError) throw conflictError
    if ((conflicts || []).length) return NextResponse.json({ error: "La habitación acaba de ser reservada para esas fechas. Volvé a buscar disponibilidad." }, { status: 409 })

    const nights = Math.round((new Date(`${checkOut}T00:00:00`) - new Date(`${checkIn}T00:00:00`)) / 86400000)
    const nightly = Number(room.precio || 0)
    const total = nightly * nights
    const numeroReserva = `WEB-${Date.now().toString(36).toUpperCase()}`

    const { data: reservation, error: insertError } = await supabase
      .from("reservas")
      .insert({
        alojamiento_id: 2,
        habitacion_id: room.id,
        nombre_huesped: name,
        email_huesped: email,
        telefono_huesped: phone || null,
        fecha_entrada: checkIn,
        fecha_salida: checkOut,
        cantidad_huespedes: guests,
        estado: "pendiente",
        notas: "Reserva realizada desde el sitio web público.",
        user_id: OWNER_ID,
        tarifa_noche: nightly,
        noches: nights,
        precio_total: total,
        dni_huesped: null,
        pasajeros: [],
        numero_reserva: numeroReserva,
        property_id: PROPERTY_ID,
      })
      .select("id,numero_reserva,nombre_huesped,fecha_entrada,fecha_salida,habitacion_id,estado")
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ ok: true, numero_reserva: reservation.numero_reserva, reservation })
  } catch (error) {
    console.error("public booking error", error)
    return NextResponse.json({ error: error.message || "No se pudo crear la reserva." }, { status: 500 })
  }
}
