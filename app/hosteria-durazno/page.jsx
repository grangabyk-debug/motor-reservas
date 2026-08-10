"use client"

import { useEffect, useMemo, useState } from "react"

const PROPERTY_ID = "46843e01-b551-41ed-84b6-c8805c0beaa4"

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
})

function todayISO() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function nightsBetween(from, to) {
  if (!from || !to) return 0
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)
  return Math.max(0, Math.round((b - a) / 86400000))
}

export default function HosteriaDuraznoPublicBooking() {
  const [rooms, setRooms] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState("search")
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [form, setForm] = useState({
    checkIn: todayISO(),
    checkOut: "",
    guests: 2,
    name: "",
    email: "",
    phone: "",
  })
  const [bookingResult, setBookingResult] = useState(null)

  const nights = useMemo(() => nightsBetween(form.checkIn, form.checkOut), [form.checkIn, form.checkOut])

  async function loadAvailability() {
    setError("")
    if (!form.checkIn || !form.checkOut || nights <= 0) {
      setError("Elegí una fecha de entrada y una fecha de salida válida.")
      return
    }
    setSearching(true)
    try {
      const params = new URLSearchParams({ check_in: form.checkIn, check_out: form.checkOut, guests: String(form.guests) })
      const res = await fetch(`/api/public/hosteria-durazno/availability?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo consultar la disponibilidad.")
      setRooms(data.rooms || [])
      setStep("rooms")
    } catch (e) {
      setError(e.message || "No se pudo consultar la disponibilidad.")
    } finally {
      setSearching(false)
    }
  }

  async function submitBooking(e) {
    e.preventDefault()
    setError("")
    if (!selectedRoom) return
    if (!form.name.trim() || !form.email.trim()) {
      setError("Completá nombre y email para continuar.")
      return
    }
    setSearching(true)
    try {
      const res = await fetch("/api/public/hosteria-durazno/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          check_in: form.checkIn,
          check_out: form.checkOut,
          guests: Number(form.guests),
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          unit_id: selectedRoom.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear la reserva.")
      setBookingResult(data)
      setStep("success")
    } catch (e) {
      setError(e.message || "No se pudo crear la reserva.")
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    const initialCheckOut = new Date(`${form.checkIn}T00:00:00`)
    initialCheckOut.setDate(initialCheckOut.getDate() + 1)
    const offset = initialCheckOut.getTimezoneOffset()
    setForm((current) => ({ ...current, checkOut: new Date(initialCheckOut.getTime() - offset * 60000).toISOString().slice(0, 10) }))
  }, [])

  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#162033", fontFamily: "Arial, sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e9f0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "22px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>Hosteria Durazno</div>
            <div style={{ color: "#667085", marginTop: 4 }}>Una estadía simple, cómoda y tranquila.</div>
          </div>
          <a href="#reservar" style={{ background: "#1677ff", color: "#fff", padding: "12px 18px", borderRadius: 10, textDecoration: "none", fontWeight: 700 }}>Reservar</a>
        </div>
      </header>

      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "58px 24px 30px" }}>
        <div style={{ maxWidth: 720 }}>
          <span style={{ display: "inline-block", padding: "7px 11px", borderRadius: 999, background: "#e9f2ff", color: "#1264d6", fontWeight: 700, fontSize: 13 }}>Reservas online</span>
          <h1 style={{ fontSize: 48, lineHeight: 1.05, margin: "18px 0 14px" }}>Reservá tu estadía en Hosteria Durazno</h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "#667085", margin: 0 }}>Elegí tus fechas, consultá la disponibilidad real y completá tus datos. La reserva se registra directamente en nuestro sistema de gestión.</p>
        </div>

        <div id="reservar" style={{ marginTop: 34, background: "#fff", border: "1px solid #e1e6ef", borderRadius: 18, padding: 24, boxShadow: "0 12px 35px rgba(16,24,40,.06)" }}>
          {step === "search" && (
            <div>
              <h2 style={{ marginTop: 0 }}>Buscá disponibilidad</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
                <label>Entrada<input type="date" min={todayISO()} value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} style={input} /></label>
                <label>Salida<input type="date" min={form.checkIn || todayISO()} value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} style={input} /></label>
                <label>Huéspedes<input type="number" min="1" max="10" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} style={input} /></label>
                <button onClick={loadAvailability} disabled={searching} style={primary}>{searching ? "Buscando..." : "Buscar disponibilidad"}</button>
              </div>
            </div>
          )}

          {step === "rooms" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15 }}>
                <div><h2 style={{ margin: 0 }}>Habitaciones disponibles</h2><p style={{ color: "#667085" }}>{form.checkIn} → {form.checkOut} · {nights} {nights === 1 ? "noche" : "noches"}</p></div>
                <button onClick={() => setStep("search")} style={secondary}>Cambiar fechas</button>
              </div>
              {rooms.length === 0 ? <div style={empty}>No hay habitaciones disponibles para esas fechas.</div> : <div style={{ display: "grid", gap: 12 }}>{rooms.map((room) => <button key={room.id} onClick={() => { setSelectedRoom(room); setStep("guest") }} style={{ textAlign: "left", background: "#fff", border: "1px solid #dfe5ef", borderRadius: 14, padding: 18, cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}><div><div style={{ fontSize: 19, fontWeight: 800 }}>{room.name}</div><div style={{ color: "#667085", marginTop: 5 }}>{room.type || "Habitación"} · hasta {room.capacity || form.guests} huéspedes</div></div><div style={{ fontWeight: 800 }}>{room.price ? `${money.format(room.price)} / noche` : "Consultar tarifa"}</div></div></button>)}</div>}
            </div>
          )}

          {step === "guest" && selectedRoom && (
            <form onSubmit={submitBooking}>
              <h2 style={{ marginTop: 0 }}>Confirmá tu reserva</h2>
              <div style={{ background: "#f6f8fb", borderRadius: 12, padding: 14, marginBottom: 20 }}><strong>{selectedRoom.name}</strong> · {form.checkIn} → {form.checkOut} · {nights} noches</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
                <label>Nombre y apellido<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Pérez" style={input} /></label>
                <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@email.com" style={input} /></label>
                <label>Teléfono<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+54 9..." style={input} /></label>
                <label>Huéspedes<input type="number" min="1" max="10" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} style={input} /></label>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}><button type="button" onClick={() => setStep("rooms")} style={secondary}>Volver</button><button type="submit" disabled={searching} style={primary}>{searching ? "Confirmando..." : "Confirmar reserva"}</button></div>
            </form>
          )}

          {step === "success" && bookingResult && (
            <div style={{ textAlign: "center", padding: "24px 10px" }}>
              <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#e8f7ee", color: "#0b8f55", display: "grid", placeItems: "center", margin: "0 auto 16px", fontSize: 28 }}>✓</div>
              <h2>Reserva confirmada</h2>
              <p style={{ color: "#667085" }}>Tu reserva fue registrada correctamente en Hosteria Durazno.</p>
              <div style={{ background: "#f6f8fb", borderRadius: 12, padding: 16, display: "inline-block", textAlign: "left" }}><strong>Número de reserva:</strong> {bookingResult.numero_reserva}<br /><strong>Habitación:</strong> {selectedRoom.name}<br /><strong>Entrada:</strong> {form.checkIn}<br /><strong>Salida:</strong> {form.checkOut}</div>
            </div>
          )}
          {error && <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#fff0f0", color: "#b42318" }}>{error}</div>}
        </div>
      </section>
    </main>
  )
}

const input = { width: "100%", boxSizing: "border-box", marginTop: 7, padding: "12px 13px", border: "1px solid #d0d5dd", borderRadius: 9, fontSize: 15, background: "#fff" }
const primary = { border: 0, borderRadius: 9, background: "#1677ff", color: "#fff", padding: "12px 16px", fontWeight: 700, cursor: "pointer", alignSelf: "end" }
const secondary = { border: "1px solid #d0d5dd", borderRadius: 9, background: "#fff", color: "#344054", padding: "11px 15px", fontWeight: 700, cursor: "pointer" }
const empty = { padding: 20, borderRadius: 12, background: "#f8fafc", color: "#667085" }
