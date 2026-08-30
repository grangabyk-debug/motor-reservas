import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let source = fs.readFileSync(path, "utf8")

if (source.includes('supabase.rpc("hl_move_reservation_atomic"')) {
  console.log("Habitación Llena OS atomic operations already materialized")
  process.exit(0)
}

const movePattern = /  async function moveReservation\(reservation, roomId, start\) \{[\s\S]*?\n  \}\n\n(?=  async function resizeReservation)/
const resizePattern = /  async function resizeReservation\(reservation, delta\) \{[\s\S]*?\n  \}\n\n(?=  async function updateStayStatus)/
const statusPattern = /  async function updateStayStatus\(reservation, next\) \{[\s\S]*?\n  \}\n\n(?=  async function updateRoomStatus)/

if (!movePattern.test(source) || !resizePattern.test(source) || !statusPattern.test(source)) {
  throw new Error("Hotel OS source changed: atomic hardening patterns no longer match. Refusing to build an unverified reservation flow.")
}

source = source.replace(movePattern, `  async function moveReservation(reservation, roomId, start) {
    if (!reservation || !roomId || !start) return
    const nights = Number(reservation.noches) || nightsBetween(reservation.fecha_entrada, reservation.fecha_salida)
    const end = addDays(start, nights)
    const room = rooms.find(r => String(r.id) === String(roomId))
    if (!roomAvailable(roomId, start, end, reservation.id)) return notify("Ese movimiento no es posible: hay ocupación o bloqueo.")

    const { data, error } = await supabase.rpc("hl_move_reservation_atomic", {
      p_reserva_id: Number(reservation.id),
      p_habitacion_id: Number(room.id),
      p_fecha_entrada: start,
      p_fecha_salida: null,
    })

    if (error) return notify(error.code === "23P01" ? "Conflicto detectado por el motor de disponibilidad." : error.message)
    const updated = Array.isArray(data) ? data[0] : data
    if (updated?.id) {
      setReservations(list => list.map(r => String(r.id) === String(updated.id) ? updated : r))
      setSelectedReservation(current => String(current?.id) === String(updated.id) ? updated : current)
    } else {
      await loadHotel(false)
    }
    notify(\`${"${reservation.nombre_huesped}"} pasó a ${"${room.nombre}"} · ${"${shortDate(start)}"}.\`)
  }

`)

source = source.replace(resizePattern, `  async function resizeReservation(reservation, delta) {
    const end = addDays(reservation.fecha_salida, delta)
    if (end <= reservation.fecha_entrada) return notify("La estadía debe tener al menos una noche.")
    if (!roomAvailable(reservation.habitacion_id, reservation.fecha_entrada, end, reservation.id)) return notify("No se puede extender: invade otra estadía o bloqueo.")

    const { data, error } = await supabase.rpc("hl_move_reservation_atomic", {
      p_reserva_id: Number(reservation.id),
      p_habitacion_id: Number(reservation.habitacion_id),
      p_fecha_entrada: reservation.fecha_entrada,
      p_fecha_salida: end,
    })

    if (error) return notify(error.code === "23P01" ? "Conflicto detectado por disponibilidad." : error.message)
    const updated = Array.isArray(data) ? data[0] : data
    if (updated?.id) {
      setReservations(list => list.map(r => String(r.id) === String(updated.id) ? updated : r))
      setSelectedReservation(updated)
      notify(\`Estadía ajustada a ${"${updated.noches || nightsBetween(updated.fecha_entrada, updated.fecha_salida)}"} noches.\`)
    } else {
      await loadHotel(false)
      notify("Estadía ajustada.")
    }
  }

`)

source = source.replace(statusPattern, `  async function updateStayStatus(reservation, next) {
    if (next === "finalizada") {
      const { data, error } = await supabase.rpc("hl_checkout_reservation_atomic", {
        p_reserva_id: Number(reservation.id),
      })
      if (error) return notify(error.message)
      const updated = Array.isArray(data) ? data[0] : data
      if (updated?.id) {
        setReservations(list => list.map(r => String(r.id) === String(updated.id) ? updated : r))
        setSelectedReservation(updated)
      }
      await loadHotel(false)
      notify("Checkout realizado y habitación enviada a Housekeeping.")
      return
    }

    const { data, error } = await supabase
      .from("reservas")
      .update({ estado: next })
      .eq("id", reservation.id)
      .eq("property_id", propertyId)
      .select("*")
      .single()

    if (error) return notify(error.message)
    setReservations(list => list.map(r => String(r.id) === String(data.id) ? data : r))
    setSelectedReservation(data)
    notify("Check-in realizado.")
  }

`)

fs.writeFileSync(path, source)
console.log("Habitación Llena OS: atomic reservation operations materialized")
