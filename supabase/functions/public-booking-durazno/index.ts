import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROPERTY_ID = "46843e01-b551-41ed-84b6-c8805c0beaa4";
const OWNER_ID = "3dcb8ad3-36eb-4d7c-bc27-598bee74a4f0";
const ALQUILAMIENTO_ID = 2;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server configuration is incomplete.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function validDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 180;
}

function roomIds(reservation: any) {
  const ids = Array.isArray(reservation?.habitaciones_ids) ? reservation.habitaciones_ids : [];
  if (reservation?.habitacion_id != null) ids.push(reservation.habitacion_id);
  return [...new Set(ids.map(Number).filter(Number.isFinite))];
}

function roomRange(reservation: any, roomId: number) {
  const details = Array.isArray(reservation?.habitaciones_detalle) ? reservation.habitaciones_detalle : [];
  const candidates = details.filter((detail: any) => Number(detail?.habitacion_id) === Number(roomId));
  const detail = [...candidates].reverse().find((row: any) => String(row?.segment_role || "active_room") !== "previous_room") || candidates[candidates.length - 1] || null;
  const start = validDate(detail?.fecha_entrada) ? detail.fecha_entrada : reservation?.fecha_entrada;
  const plannedEnd = validDate(detail?.fecha_salida) ? detail.fecha_salida : reservation?.fecha_salida;
  const checkout = reservation?.room_checkout_dates?.[String(roomId)];
  const end = validDate(checkout) && (!validDate(plannedEnd) || checkout < plannedEnd) ? checkout : plannedEnd;
  return { start, end };
}

function overlaps(reservation: any, roomId: number, checkIn: string, checkOut: string) {
  if (!roomIds(reservation).includes(Number(roomId))) return false;
  const { start, end } = roomRange(reservation, roomId);
  if (!validDate(start) || !validDate(end)) return false;
  return start < checkOut && end > checkIn;
}

async function loadPotentialConflicts(supabase: ReturnType<typeof adminClient>, checkOut: string) {
  const { data, error } = await supabase
    .from("reservas")
    .select("id,habitacion_id,habitaciones_ids,habitaciones_detalle,room_checkout_dates,fecha_entrada,fecha_salida,estado,no_show")
    .eq("property_id", PROPERTY_ID)
    .lt("fecha_entrada", checkOut)
    .not("estado", "in", "(cancelada,finalizada)");
  if (error) throw error;
  return (data || []).filter((row: any) => !row.no_show);
}

async function availability(req: Request) {
  const url = new URL(req.url);
  const checkIn = url.searchParams.get("check_in");
  const checkOut = url.searchParams.get("check_out");
  const guests = Number(url.searchParams.get("guests") || 1);

  if (!validDate(checkIn) || !validDate(checkOut) || checkOut! <= checkIn!) return json({ error: "Fechas inválidas." }, 400);
  if (!Number.isInteger(guests) || guests < 1 || guests > 10) return json({ error: "Cantidad de huéspedes inválida." }, 400);

  const supabase = adminClient();
  const { data: rooms, error: roomsError } = await supabase
    .from("habitaciones")
    .select("id,nombre,tipo,capacidad,precio,activa")
    .eq("property_id", PROPERTY_ID)
    .eq("activa", true)
    .order("id");
  if (roomsError) throw roomsError;

  const reservations = await loadPotentialConflicts(supabase, checkOut!);
  const occupied = new Set<number>();
  for (const reservation of reservations) {
    for (const roomId of roomIds(reservation)) {
      if (overlaps(reservation, roomId, checkIn!, checkOut!)) occupied.add(roomId);
    }
  }

  const available = (rooms || []).filter((room) => !occupied.has(Number(room.id)) && (!room.capacidad || room.capacidad >= guests));
  return json({ property_id: PROPERTY_ID, check_in: checkIn, check_out: checkOut, rooms: available.map((room) => ({ id: room.id, name: room.nombre, type: room.tipo, capacity: room.capacidad, price: room.precio })) });
}

async function createBooking(req: Request) {
  const body = await req.json();
  const checkIn = String(body.check_in || "");
  const checkOut = String(body.check_out || "");
  const unitId = Number(body.unit_id);
  const guests = Number(body.guests);
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();

  if (!validDate(checkIn) || !validDate(checkOut) || checkOut <= checkIn) return json({ error: "Fechas inválidas." }, 400);
  if (!Number.isInteger(unitId) || unitId <= 0) return json({ error: "Habitación inválida." }, 400);
  if (!Number.isInteger(guests) || guests < 1 || guests > 10) return json({ error: "Cantidad de huéspedes inválida." }, 400);
  if (name.length < 2 || name.length > 120) return json({ error: "Nombre inválido." }, 400);
  if (!validEmail(email)) return json({ error: "Email inválido." }, 400);
  if (phone.length > 50) return json({ error: "Teléfono inválido." }, 400);

  const supabase = adminClient();
  const { data: room, error: roomError } = await supabase
    .from("habitaciones")
    .select("id,nombre,tipo,capacidad,precio,activa")
    .eq("id", unitId)
    .eq("property_id", PROPERTY_ID)
    .eq("activa", true)
    .maybeSingle();
  if (roomError) throw roomError;
  if (!room) return json({ error: "La habitación ya no está disponible." }, 409);
  if (room.capacidad && guests > room.capacidad) return json({ error: "La cantidad de huéspedes supera la capacidad." }, 409);

  const reservations = await loadPotentialConflicts(supabase, checkOut);
  if (reservations.some((reservation: any) => overlaps(reservation, unitId, checkIn, checkOut))) {
    return json({ error: "La habitación acaba de ser reservada para esas fechas. Volvé a buscar disponibilidad." }, 409);
  }

  const nights = Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86400000);
  const nightly = Number(room.precio || 0);
  const total = nightly * nights;
  const numeroReserva = `WEB-${Date.now().toString(36).toUpperCase()}`;

  const { data: reservation, error: insertError } = await supabase
    .from("reservas")
    .insert({
      alojamiento_id: ALQUILAMIENTO_ID,
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
    .single();
  if (insertError) throw insertError;

  return json({ ok: true, numero_reserva: reservation.numero_reserva, reservation });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method === "GET") return await availability(req);
    if (req.method === "POST") return await createBooking(req);
    return json({ error: "Método no permitido." }, 405);
  } catch (error) {
    console.error("public-booking-durazno error", error);
    return json({ error: error instanceof Error ? error.message : "No se pudo procesar la solicitud." }, 500);
  }
});
