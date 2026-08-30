"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../../lib/supabase"
import s from "./hotel-os.module.css"

const DAY = 86400000
const THEMES = {
  olive: { accent: "#c6a36a", accent2: "#728b78", ink: "#11271f", side: "#10231d", paper: "#f2eee5" },
  cognac: { accent: "#bf8757", accent2: "#9a725b", ink: "#2c2019", side: "#241914", paper: "#f3ede5" },
  midnight: { accent: "#c5ad75", accent2: "#75859a", ink: "#17202a", side: "#10161d", paper: "#eeeae2" },
}

const NAV = [
  ["lobby", "Lobby", "⌂"],
  ["calendar", "Command Center", "▦"],
  ["guests", "Huéspedes", "◎"],
  ["housekeeping", "Housekeeping", "◇"],
  ["revenue", "Revenue", "↗"],
  ["distribution", "Distribution", "⌁"],
  ["automations", "Automatizaciones", "✦"],
  ["twin", "Hotel Digital Twin", "▥"],
  ["brand", "Identidad del hotel", "✺"],
]

const PROVIDERS = [
  ["SiteMinder", "Hub de distribución global"],
  ["Booking.com", "Connectivity Partner"],
  ["Expedia", "Expedia Group Connectivity"],
  ["Airbnb", "Channel connectivity"],
  ["Motor directo", "Nativo Habitación Llena"],
]

function isoDate(date = new Date()) {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function addDays(value, amount) {
  const d = new Date(`${value}T12:00:00`)
  d.setDate(d.getDate() + Number(amount))
  return isoDate(d)
}

function nightsBetween(start, end) {
  if (!start || !end) return 0
  return Math.max(1, Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / DAY))
}

function money(value, currency = "ARS") {
  const n = Number(value || 0)
  return currency === "USD" ? `US$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}` : `$ ${Math.round(n).toLocaleString("es-AR")}`
}

function shortDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
}

function guestKey(r) {
  return String(r.email_huesped || r.telefono_huesped || r.nombre_huesped || "sin-dato").trim().toLowerCase()
}

function roomIsBlocked(blocks, roomId, start, end) {
  return blocks.some(b => String(b.habitacion_id) === String(roomId) && start < b.fecha_hasta && end > b.fecha_desde)
}

function initials(name = "Hotel") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join("") || "HL"
}

export default function HotelOS() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [properties, setProperties] = useState([])
  const [propertyId, setPropertyId] = useState("")
  const [rooms, setRooms] = useState([])
  const [reservations, setReservations] = useState([])
  const [payments, setPayments] = useState([])
  const [blocks, setBlocks] = useState([])
  const [settings, setSettings] = useState({ hotel_name: "Habitación Llena", city: "", motto: "La hospitalidad se siente en cada detalle.", welcome_message: "Bienvenidos a casa.", theme: "olive", logo_data_url: "" })
  const [automations, setAutomations] = useState([])
  const [channels, setChannels] = useState([])
  const [view, setView] = useState("lobby")
  const [calendarStart, setCalendarStart] = useState(isoDate())
  const [search, setSearch] = useState("")
  const [selectedReservation, setSelectedReservation] = useState(null)
  const [selectedGuest, setSelectedGuest] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [reservationOpen, setReservationOpen] = useState(false)
  const [brandDraft, setBrandDraft] = useState(settings)
  const [automationDraft, setAutomationDraft] = useState("")
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState("")
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMessages, setAiMessages] = useState([{ role: "assistant", content: "Estoy mirando la operación real del hotel. Podés pedirme una lectura o una acción concreta." }])
  const [toast, setToast] = useState("")
  const [newReservation, setNewReservation] = useState({ guest: "", email: "", phone: "", roomId: "", start: isoDate(), end: addDays(isoDate(), 2), pax: 2, channel: "Directa", notes: "" })
  const logoRef = useRef(null)

  const theme = THEMES[settings.theme] || THEMES.olive
  const activeProperty = properties.find(p => String(p.id) === String(propertyId)) || properties[0] || null
  const today = isoDate()

  useEffect(() => {
    let mounted = true
    async function boot() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (!session?.user) {
        window.location.href = "/login"
        return
      }
      setUser(session.user)
      const [{ data: memberships }, { data: owned }] = await Promise.all([
        supabase.from("property_members").select("property_id,role").eq("user_id", session.user.id),
        supabase.from("properties").select("id,name,city,description,owner_id,created_at").eq("owner_id", session.user.id),
      ])
      const ids = Array.from(new Set([...(memberships || []).map(m => m.property_id), ...(owned || []).map(p => p.id)]))
      if (!ids.length) {
        setProperties([])
        setLoading(false)
        return
      }
      const { data: props } = await supabase.from("properties").select("id,name,city,description,owner_id,created_at").in("id", ids).order("created_at")
      if (!mounted) return
      setProperties(props || [])
      setPropertyId(String(props?.[0]?.id || ""))
      setLoading(false)
    }
    boot()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!propertyId || !user?.id) return
    loadHotel()
    const channel = supabase.channel(`hl-os-${propertyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas", filter: `property_id=eq.${propertyId}` }, () => loadHotel(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "habitaciones", filter: `property_id=eq.${propertyId}` }, () => loadHotel(false))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [propertyId, user?.id])

  async function loadHotel(showLoader = true) {
    if (!propertyId) return
    if (showLoader) setLoading(true)
    const [roomRes, reservationRes, paymentRes, blockRes, settingsRes, automationRes, channelRes] = await Promise.all([
      supabase.from("habitaciones").select("*").eq("property_id", propertyId).order("id"),
      supabase.from("reservas").select("*").eq("property_id", propertyId).order("fecha_entrada", { ascending: true }),
      supabase.from("pagos").select("*").eq("property_id", propertyId).order("created_at", { ascending: false }),
      supabase.from("bloqueos").select("*").eq("property_id", propertyId).order("fecha_desde"),
      supabase.from("hotel_os_settings").select("*").eq("property_id", propertyId).maybeSingle(),
      supabase.from("hotel_automations").select("*").eq("property_id", propertyId).order("created_at", { ascending: false }),
      supabase.from("hotel_channel_connections").select("*").eq("property_id", propertyId).order("provider"),
    ])
    const firstError = [roomRes, reservationRes, paymentRes, blockRes].find(x => x.error)?.error
    if (firstError) notify(`No se pudo leer toda la operación: ${firstError.message}`)
    setRooms(roomRes.data || [])
    setReservations(reservationRes.data || [])
    setPayments(paymentRes.data || [])
    setBlocks(blockRes.data || [])
    const base = settingsRes.data || { property_id: propertyId, hotel_name: activeProperty?.name || "Habitación Llena", city: activeProperty?.city || "", motto: "La hospitalidad se siente en cada detalle.", welcome_message: "Bienvenidos a casa.", theme: "olive", logo_data_url: "" }
    setSettings(base)
    setBrandDraft(base)
    setAutomations(automationRes.data || [])
    setChannels(channelRes.data || [])
    setLoading(false)
  }

  function notify(message) {
    setToast(message)
    window.setTimeout(() => setToast(""), 2600)
  }

  const liveReservations = useMemo(() => reservations.filter(r => r.estado !== "cancelada" && !r.no_show), [reservations])
  const activeToday = useMemo(() => liveReservations.filter(r => r.fecha_entrada <= today && r.fecha_salida > today && r.estado !== "finalizada"), [liveReservations, today])
  const arrivals = useMemo(() => liveReservations.filter(r => r.fecha_entrada === today), [liveReservations, today])
  const departures = useMemo(() => liveReservations.filter(r => r.fecha_salida === today && r.estado !== "finalizada"), [liveReservations, today])
  const activeRooms = rooms.filter(r => r.activa !== false)
  const occupiedIds = new Set(activeToday.map(r => String(r.habitacion_id)))
  const sellableRooms = activeRooms.filter(r => !["mantenimiento", "fuera_servicio"].includes(String(r.estado || "").toLowerCase()))
  const occupancy = sellableRooms.length ? Math.round(occupiedIds.size / sellableRooms.length * 100) : 0
  const soldNights = liveReservations.reduce((sum, r) => sum + (Number(r.noches) || nightsBetween(r.fecha_entrada, r.fecha_salida)), 0)
  const gross = liveReservations.reduce((sum, r) => sum + Number(r.precio_total || 0), 0)
  const adr = soldNights ? gross / soldNights : 0
  const revpar = sellableRooms.length ? gross / Math.max(1, sellableRooms.length * 30) : 0
  const paidByReservation = useMemo(() => {
    const map = new Map()
    payments.forEach(p => map.set(String(p.reserva_id), (map.get(String(p.reserva_id)) || 0) + Number(p.monto || 0)))
    return map
  }, [payments])
  const outstanding = liveReservations.reduce((sum, r) => sum + Math.max(0, Number(r.precio_total || 0) - (paidByReservation.get(String(r.id)) || 0)), 0)
  const directShare = liveReservations.length ? Math.round(liveReservations.filter(r => ["Directa", "directa", "web", "Motor directo"].includes(r.canal_reserva)).length / liveReservations.length * 100) : 0
  const calendarDays = useMemo(() => Array.from({ length: 18 }, (_, i) => addDays(calendarStart, i)), [calendarStart])

  const guests = useMemo(() => {
    const map = new Map()
    liveReservations.forEach(r => {
      const key = guestKey(r)
      const old = map.get(key) || { key, name: r.nombre_huesped || "Huésped", email: r.email_huesped || "", phone: r.telefono_huesped || "", stays: 0, nights: 0, revenue: 0, last: "", notes: [], channels: new Set() }
      old.stays += 1
      old.nights += Number(r.noches) || nightsBetween(r.fecha_entrada, r.fecha_salida)
      old.revenue += Number(r.precio_total || 0)
      if (r.fecha_salida > old.last) old.last = r.fecha_salida
      if (r.notas) old.notes.push(r.notas)
      if (r.canal_reserva) old.channels.add(r.canal_reserva)
      map.set(key, old)
    })
    return [...map.values()].map(g => ({ ...g, channels: [...g.channels] })).sort((a, b) => b.revenue - a.revenue)
  }, [liveReservations])

  const filteredGuests = guests.filter(g => !search.trim() || `${g.name} ${g.email} ${g.phone} ${g.notes.join(" ")}`.toLowerCase().includes(search.toLowerCase()))

  function roomAvailable(roomId, start, end, ignoreId = null) {
    if (!roomId || !start || !end || end <= start) return false
    const room = rooms.find(r => String(r.id) === String(roomId))
    if (!room || room.activa === false || ["mantenimiento", "fuera_servicio"].includes(String(room.estado || "").toLowerCase())) return false
    if (roomIsBlocked(blocks, roomId, start, end)) return false
    return !liveReservations.some(r => String(r.id) !== String(ignoreId) && String(r.habitacion_id) === String(roomId) && start < r.fecha_salida && end > r.fecha_entrada)
  }

  async function createReservation(e) {
    e.preventDefault()
    const room = rooms.find(r => String(r.id) === String(newReservation.roomId))
    if (!room) return notify("Elegí una habitación.")
    if (!newReservation.guest.trim()) return notify("Ingresá el nombre del huésped.")
    if (!roomAvailable(room.id, newReservation.start, newReservation.end)) return notify("La habitación no está libre en esas fechas.")
    const nights = nightsBetween(newReservation.start, newReservation.end)
    const rate = Number(room.precio || 0)
    const total = rate * nights
    const number = `HL-${today.replaceAll("-", "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    const payload = {
      property_id: propertyId,
      user_id: user.id,
      alojamiento_id: room.alojamiento_id,
      habitacion_id: room.id,
      habitaciones_ids: [room.id],
      nombre_huesped: newReservation.guest.trim(),
      email_huesped: newReservation.email.trim() || null,
      telefono_huesped: newReservation.phone.trim() || null,
      fecha_entrada: newReservation.start,
      fecha_salida: newReservation.end,
      cantidad_huespedes: Math.max(1, Number(newReservation.pax || 1)),
      estado: "confirmada",
      notas: newReservation.notes.trim() || null,
      canal_reserva: newReservation.channel,
      tarifa_noche: rate,
      noches: nights,
      subtotal: total,
      precio_total: total,
      moneda: "ARS",
      numero_reserva: number,
      no_show: false,
      early_checkin: false,
      late_checkout: false,
      vehiculos: 0,
      extra: 0,
      cochera_total: 0,
    }
    const { data, error } = await supabase.from("reservas").insert(payload).select("*").single()
    if (error) return notify(error.code === "23P01" ? "Otra reserva ocupó esa habitación. Elegí otra." : `No se pudo crear: ${error.message}`)
    setReservations(list => [...list, data].sort((a, b) => a.fecha_entrada.localeCompare(b.fecha_entrada)))
    setReservationOpen(false)
    setSelectedReservation(data)
    notify("Reserva creada. Inventario protegido.")
  }

  async function moveReservation(reservation, roomId, start) {
    if (!reservation || !roomId || !start) return
    const nights = Number(reservation.noches) || nightsBetween(reservation.fecha_entrada, reservation.fecha_salida)
    const end = addDays(start, nights)
    const room = rooms.find(r => String(r.id) === String(roomId))
    if (!roomAvailable(roomId, start, end, reservation.id)) return notify("Ese movimiento no es posible: hay ocupación o bloqueo.")
    const { data, error } = await supabase.from("reservas").update({ habitacion_id: room.id, alojamiento_id: room.alojamiento_id, habitaciones_ids: [room.id], fecha_entrada: start, fecha_salida: end }).eq("id", reservation.id).eq("property_id", propertyId).select("*").single()
    if (error) return notify(error.code === "23P01" ? "Conflicto detectado por el motor de disponibilidad." : error.message)
    setReservations(list => list.map(r => String(r.id) === String(data.id) ? data : r))
    notify(`${reservation.nombre_huesped} pasó a ${room.nombre} · ${shortDate(start)}.`)
  }

  async function resizeReservation(reservation, delta) {
    const end = addDays(reservation.fecha_salida, delta)
    if (end <= reservation.fecha_entrada) return notify("La estadía debe tener al menos una noche.")
    if (!roomAvailable(reservation.habitacion_id, reservation.fecha_entrada, end, reservation.id)) return notify("No se puede extender: invade otra estadía o bloqueo.")
    const nights = nightsBetween(reservation.fecha_entrada, end)
    const rate = Number(reservation.tarifa_noche || rooms.find(r => String(r.id) === String(reservation.habitacion_id))?.precio || 0)
    const newBase = rate * nights
    const extras = Number(reservation.cochera_total || 0) + Number(reservation.extra || 0) + Number(reservation.early_checkin_importe || 0) + Number(reservation.late_checkout_importe || 0)
    const subtotal = newBase + extras
    const discount = reservation.descuento_tipo === "porcentaje" ? subtotal * Number(reservation.descuento_valor || 0) / 100 : Number(reservation.descuento_importe || reservation.descuento_valor || 0)
    const total = Math.max(0, subtotal - discount)
    const { data, error } = await supabase.from("reservas").update({ fecha_salida: end, noches: nights, subtotal, precio_total: total, descuento_importe: discount }).eq("id", reservation.id).eq("property_id", propertyId).select("*").single()
    if (error) return notify(error.code === "23P01" ? "Conflicto detectado por disponibilidad." : error.message)
    setReservations(list => list.map(r => String(r.id) === String(data.id) ? data : r))
    setSelectedReservation(data)
    notify(`Estadía ajustada a ${nights} noches.`)
  }

  async function updateStayStatus(reservation, next) {
    const patch = next === "finalizada" ? { estado: next, checkout_real_at: new Date().toISOString() } : { estado: next }
    const { data, error } = await supabase.from("reservas").update(patch).eq("id", reservation.id).eq("property_id", propertyId).select("*").single()
    if (error) return notify(error.message)
    if (next === "finalizada") await supabase.from("habitaciones").update({ estado: "sucia" }).eq("id", reservation.habitacion_id).eq("property_id", propertyId)
    setReservations(list => list.map(r => String(r.id) === String(data.id) ? data : r))
    setSelectedReservation(data)
    await loadHotel(false)
    notify(next === "alojado" ? "Check-in realizado." : "Checkout realizado y habitación enviada a Housekeeping.")
  }

  async function updateRoomStatus(room, status) {
    const { data, error } = await supabase.from("habitaciones").update({ estado: status }).eq("id", room.id).eq("property_id", propertyId).select("*").single()
    if (error) return notify(error.message)
    setRooms(list => list.map(r => String(r.id) === String(data.id) ? data : r))
    setSelectedRoom(data)
    notify(`${room.nombre}: ${status}.`)
  }

  async function updateRates(percent, onlySuites = false) {
    const targets = activeRooms.filter(r => !onlySuites || /suite|deluxe|superior/i.test(`${r.tipo || ""} ${r.nombre || ""}`))
    if (!targets.length) return notify("No encontré habitaciones para ese ajuste.")
    const results = await Promise.all(targets.map(room => supabase.from("habitaciones").update({ precio: Math.round(Number(room.precio || 0) * (1 + percent / 100)) }).eq("id", room.id).eq("property_id", propertyId)))
    if (results.some(r => r.error)) return notify("Algunas tarifas no pudieron actualizarse.")
    await loadHotel(false)
    notify(`${onlySuites ? "Categorías premium" : "Tarifas"} ajustadas ${percent > 0 ? "+" : ""}${percent}%.`)
  }

  async function saveBrand(e) {
    e?.preventDefault?.()
    const payload = { property_id: propertyId, hotel_name: brandDraft.hotel_name?.trim() || activeProperty?.name || "Hotel", city: brandDraft.city?.trim() || "", motto: brandDraft.motto?.trim() || "", welcome_message: brandDraft.welcome_message?.trim() || "", theme: brandDraft.theme || "olive", logo_data_url: brandDraft.logo_data_url || null, updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from("hotel_os_settings").upsert(payload, { onConflict: "property_id" }).select("*").single()
    if (error) return notify(`No se pudo guardar identidad: ${error.message}`)
    setSettings(data)
    setBrandDraft(data)
    notify("Identidad aplicada a todo el Hotel OS.")
  }

  function loadLogo(file) {
    if (!file) return
    if (file.size > 700000) return notify("Usá un logo de menos de 700 KB para esta versión.")
    const reader = new FileReader()
    reader.onload = () => setBrandDraft(x => ({ ...x, logo_data_url: String(reader.result || "") }))
    reader.readAsDataURL(file)
  }

  async function createAutomation(e) {
    e.preventDefault()
    if (automationDraft.trim().length < 12) return notify("Describí mejor la automatización.")
    const payload = { property_id: propertyId, name: automationDraft.trim().slice(0, 70), trigger_text: automationDraft.trim(), action_text: "Llena Intelligence interpreta y prepara la acción operativa.", enabled: true, created_by: user.id }
    const { data, error } = await supabase.from("hotel_automations").insert(payload).select("*").single()
    if (error) return notify(error.message)
    setAutomations(list => [data, ...list])
    setAutomationDraft("")
    notify("Automatización guardada para este hotel.")
  }

  async function toggleAutomation(item) {
    const { data, error } = await supabase.from("hotel_automations").update({ enabled: !item.enabled, updated_at: new Date().toISOString() }).eq("id", item.id).eq("property_id", propertyId).select("*").single()
    if (error) return notify(error.message)
    setAutomations(list => list.map(a => a.id === data.id ? data : a))
  }

  async function prepareChannel(provider) {
    const payload = { property_id: propertyId, provider, status: provider === "Motor directo" ? "connected" : "sandbox", mode: provider === "Motor directo" ? "production" : "sandbox", account_ref: provider === "Motor directo" ? "native" : "certification-required", updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from("hotel_channel_connections").upsert(payload, { onConflict: "property_id,provider" }).select("*").single()
    if (error) return notify(error.message)
    setChannels(list => [...list.filter(x => x.provider !== provider), data])
    notify(provider === "Motor directo" ? "Motor directo marcado como nativo." : `${provider}: entorno sandbox preparado; producción requiere credenciales/certificación.`)
  }

  async function runAI(e) {
    e.preventDefault()
    const q = aiInput.trim()
    if (!q || aiBusy) return
    setAiMessages(m => [...m, { role: "user", content: q }])
    setAiInput("")
    setAiBusy(true)
    const low = q.toLowerCase()
    try {
      const pct = Number(low.match(/(\d{1,2})\s*%/)?.[1] || 0)
      if ((low.includes("sub") || low.includes("aument")) && low.includes("tarifa") && pct) {
        await updateRates(Math.min(30, pct), low.includes("suite") || low.includes("premium"))
        setAiMessages(m => [...m, { role: "assistant", content: `Hecho. Apliqué el ajuste solicitado dentro del inventario real de ${settings.hotel_name}.` }])
      } else if ((low.includes("limpia") || low.includes("lista")) && rooms.some(r => low.includes(String(r.nombre).toLowerCase()))) {
        const room = rooms.find(r => low.includes(String(r.nombre).toLowerCase()))
        await updateRoomStatus(room, "limpia")
        setAiMessages(m => [...m, { role: "assistant", content: `${room.nombre} quedó marcada como limpia y lista para asignar.` }])
      } else if (low.includes("saldo")) {
        setAiMessages(m => [...m, { role: "assistant", content: `El saldo pendiente registrado es ${money(outstanding)} entre las reservas activas.` }])
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify({ question: q, context: { plataforma: "Habitación Llena OS", property_id: propertyId, hotel: settings.hotel_name, ocupacion: occupancy, llegadas_hoy: arrivals.length, salidas_hoy: departures.length, saldo_pendiente: outstanding, habitaciones: rooms.slice(0, 100), reservas: reservations.slice(-250) } }) })
        const data = await response.json()
        setAiMessages(m => [...m, { role: "assistant", content: data.answer || "No pude completar esa consulta." }])
      }
    } catch (error) {
      setAiMessages(m => [...m, { role: "assistant", content: `No pude completar la acción: ${error.message}` }])
    } finally {
      setAiBusy(false)
    }
  }

  if (loading) return <div className={s.loading}><span>HL</span><div><b>Habitación Llena OS</b><small>Preparando el hotel…</small></div></div>

  if (!properties.length) return <div className={s.emptyAccount}><span>HL</span><h1>Primero creemos tu hotel.</h1><p>Tu cuenta todavía no tiene una propiedad asociada.</p><a href="/registro">Configurar propiedad</a></div>

  const shellStyle = { "--accent": theme.accent, "--accent2": theme.accent2, "--ink": theme.ink, "--side": theme.side, "--paper": theme.paper }

  return <div className={s.shell} style={shellStyle}>
    <aside className={s.sidebar}>
      <div className={s.sideTexture} />
      <button className={s.brandButton} onClick={() => setView("brand")}>
        <Logo settings={settings} />
        <div><b>{settings.hotel_name || activeProperty?.name}</b><small>Hospitality Operating System</small></div>
      </button>
      <label className={s.propertyPicker}><span>PROPIEDAD</span><select value={propertyId} onChange={e => setPropertyId(e.target.value)}>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <nav className={s.nav}>{NAV.map(([id, label, icon]) => <button key={id} className={view === id ? s.active : ""} onClick={() => setView(id)}><i>{icon}</i><span>{label}</span>{id === "calendar" && <em />}</button>)}</nav>
      <div className={s.shiftCard}><div className={s.avatarStack}><span>R</span><span>H</span><span>C</span></div><div><b>Equipo conectado</b><small>Recepción · Pisos · Concierge</small></div></div>
      <div className={s.sidebarFooter}><button onClick={() => setAiOpen(true)}>✦ Llena Intelligence</button><button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login" }}>Salir</button></div>
    </aside>

    <main className={s.work}>
      <header className={s.topbar}>
        <div><small className={s.eyebrow}>{view === "lobby" ? `${settings.city || activeProperty?.city || "HOTEL"} · ${new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}` : NAV.find(x => x[0] === view)?.[1]?.toUpperCase()}</small><h1>{view === "lobby" ? settings.welcome_message || "Bienvenidos a casa." : titleFor(view)}</h1></div>
        <div className={s.topActions}><label className={s.search}><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar huésped, reserva, habitación…" /></label><button className={s.ghost} onClick={() => setView("brand")}>Identidad</button><button className={s.primary} onClick={() => { setNewReservation(x => ({ ...x, roomId: x.roomId || String(activeRooms[0]?.id || "") })); setReservationOpen(true) }}>＋ Nueva reserva</button></div>
      </header>

      {view === "lobby" && <Lobby settings={settings} occupancy={occupancy} arrivals={arrivals} departures={departures} rooms={rooms} outstanding={outstanding} adr={adr} revpar={revpar} directShare={directShare} onCalendar={() => setView("calendar")} onRevenue={() => setView("revenue")} onHousekeeping={() => setView("housekeeping")} onAI={() => setAiOpen(true)} onOpen={setSelectedReservation} />}
      {view === "calendar" && <CommandCenter days={calendarDays} rooms={activeRooms} reservations={liveReservations} blocks={blocks} start={calendarStart} setStart={setCalendarStart} onMove={moveReservation} onOpen={setSelectedReservation} onEmpty={(room, day) => { setNewReservation({ guest: "", email: "", phone: "", roomId: String(room.id), start: day, end: addDays(day, 2), pax: 2, channel: "Directa", notes: "" }); setReservationOpen(true) }} />}
      {view === "guests" && <Guests guests={filteredGuests} selected={selectedGuest} onSelect={setSelectedGuest} />}
      {view === "housekeeping" && <Housekeeping rooms={activeRooms} reservations={liveReservations} today={today} onRoom={setSelectedRoom} onStatus={updateRoomStatus} />}
      {view === "revenue" && <Revenue rooms={activeRooms} occupancy={occupancy} adr={adr} revpar={revpar} gross={gross} directShare={directShare} onRates={updateRates} reservations={liveReservations} />}
      {view === "distribution" && <Distribution providers={PROVIDERS} channels={channels} onPrepare={prepareChannel} />}
      {view === "automations" && <Automations items={automations} draft={automationDraft} setDraft={setAutomationDraft} onCreate={createAutomation} onToggle={toggleAutomation} />}
      {view === "twin" && <DigitalTwin settings={settings} rooms={activeRooms} reservations={activeToday} onRoom={setSelectedRoom} />}
      {view === "brand" && <BrandStudio draft={brandDraft} setDraft={setBrandDraft} onSave={saveBrand} onLogo={() => logoRef.current?.click()} logoRef={logoRef} loadLogo={loadLogo} />}
    </main>

    {selectedReservation && <ReservationDrawer reservation={selectedReservation} room={rooms.find(r => String(r.id) === String(selectedReservation.habitacion_id))} paid={paidByReservation.get(String(selectedReservation.id)) || 0} onClose={() => setSelectedReservation(null)} onCheckin={() => updateStayStatus(selectedReservation, "alojado")} onCheckout={() => updateStayStatus(selectedReservation, "finalizada")} onResize={delta => resizeReservation(selectedReservation, delta)} />}
    {selectedRoom && <RoomDrawer room={selectedRoom} current={activeToday.find(r => String(r.habitacion_id) === String(selectedRoom.id))} onClose={() => setSelectedRoom(null)} onStatus={status => updateRoomStatus(selectedRoom, status)} />}
    {reservationOpen && <ReservationModal data={newReservation} setData={setNewReservation} rooms={activeRooms} onSubmit={createReservation} onClose={() => setReservationOpen(false)} />}
    {aiOpen && <AIPanel messages={aiMessages} input={aiInput} setInput={setAiInput} busy={aiBusy} onSubmit={runAI} onClose={() => setAiOpen(false)} />}
    <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={e => loadLogo(e.target.files?.[0])} />
    {toast && <div className={s.toast}>{toast}</div>}
  </div>
}

function titleFor(view) {
  return ({ calendar: "El hotel entero, en una sola mirada.", guests: "Recordar bien también es hospitalidad.", housekeeping: "Prioridad antes que listas.", revenue: "Precio con criterio.", distribution: "Una disponibilidad. Todos los canales.", automations: "Que el hotel recuerde por vos.", twin: "Tu edificio también puede hablar.", brand: "Que el sistema se parezca a tu hotel." })[view] || "Habitación Llena OS"
}

function Logo({ settings, large = false }) {
  return <span className={`${s.logo} ${large ? s.logoLarge : ""}`}>{settings.logo_data_url ? <img src={settings.logo_data_url} alt={`Logo ${settings.hotel_name}`} /> : <b>{initials(settings.hotel_name)}</b>}</span>
}

function Lobby({ settings, occupancy, arrivals, departures, rooms, outstanding, adr, revpar, directShare, onCalendar, onRevenue, onHousekeeping, onAI, onOpen }) {
  const clean = rooms.filter(r => ["limpia", "libre", "lista"].includes(String(r.estado || "").toLowerCase())).length
  const attention = rooms.filter(r => ["sucia", "inspeccion", "mantenimiento"].includes(String(r.estado || "").toLowerCase())).length
  return <div className={s.content}>
    <section className={s.lobbyHero}>
      <div className={s.wood} /><div className={s.marble} /><div className={s.heroGlow} />
      <div className={s.heroCopy}><div className={s.heroBrand}><Logo settings={settings} large /><span>EL ESCRITORIO DIGITAL DE {settings.hotel_name?.toUpperCase()}</span></div><h2>Una recepción serena.<br/><em>Una operación impecable.</em></h2><p>“{settings.motto}”</p><div className={s.heroActions}><button onClick={onCalendar}>Abrir Command Center <span>→</span></button><button onClick={onAI}>Hablar con Llena Intelligence <span>✦</span></button></div></div>
      <div className={s.occupancyOrb}><small>OCUPACIÓN HOY</small><strong>{occupancy}%</strong><span>{arrivals.length} llegadas · {departures.length} salidas</span></div>
    </section>
    <section className={s.deskStrip}>
      <button onClick={onCalendar}><i>☼</i><span><small>RITMO DEL DÍA</small><b>{arrivals.length} llegadas previstas</b><em>{departures.length} salidas por acompañar</em></span></button>
      <button onClick={onHousekeeping}><i>◇</i><span><small>HOUSEKEEPING</small><b>{clean} habitaciones listas</b><em>{attention} requieren atención</em></span></button>
      <button onClick={onRevenue}><i>$</i><span><small>SALDOS</small><b>{money(outstanding)}</b><em>pendientes de cobro</em></span></button>
      <button onClick={onRevenue}><i>↗</i><span><small>REVENUE</small><b>{money(adr)} ADR</b><em>{directShare}% venta directa</em></span></button>
    </section>
    <div className={s.lobbyGrid}>
      <section className={s.arrivalSalon}><PanelHead eyebrow="EL RITMO DE HOY" title="Próximos momentos" action="Agenda completa →" onAction={onCalendar} /><div className={s.timeline}>{arrivals.slice(0, 5).length ? arrivals.slice(0, 5).map((r, i) => <button key={r.id} onClick={() => onOpen(r)} className={s.timelineItem}><time>{i === 0 ? "14:00" : `${15 + i}:00`}</time><span /><div><b>{r.nombre_huesped}</b><small>{r.numero_reserva || "Reserva"} · Hab. {r.habitacion_id}</small></div></button>) : <div className={s.softEmpty}>No hay llegadas pendientes para hoy. El lobby está tranquilo.</div>}</div></section>
      <section className={s.staffSalon}><PanelHead eyebrow="PERSONAS, NO TICKETS" title="Equipo en servicio" /><div className={s.staffList}><HumanRole letter="R" title="Recepción" detail="Operación y bienvenida" /><HumanRole letter="H" title="Housekeeping" detail={`${attention} prioridades activas`} /><HumanRole letter="C" title="Concierge" detail="Experiencia del huésped" /></div><blockquote>“La tecnología debe desaparecer cuando el huésped necesita una persona.”</blockquote></section>
      <section className={s.intelligence}><PanelHead eyebrow="LLENA INTELLIGENCE" title="Lo que merece atención" action="Preguntar ✦" onAction={onAI} /><div className={s.brief}><button onClick={onRevenue}><i>01</i><span><b>ADR actual {money(adr)}</b><small>Revisá si la demanda permite defender una tarifa superior.</small></span><em>→</em></button><button onClick={onHousekeeping}><i>02</i><span><b>{attention ? `${attention} habitaciones requieren atención` : "Housekeeping sin pendientes críticos"}</b><small>La prioridad se recalcula con cada salida y llegada.</small></span><em>→</em></button><button onClick={onRevenue}><i>03</i><span><b>RevPAR {money(revpar)}</b><small>Una lectura simple del rendimiento de tu inventario.</small></span><em>→</em></button></div></section>
    </div>
  </div>
}

function PanelHead({ eyebrow, title, action, onAction }) {
  return <div className={s.panelHead}><div><small>{eyebrow}</small><h3>{title}</h3></div>{action && <button onClick={onAction}>{action}</button>}</div>
}

function HumanRole({ letter, title, detail }) {
  return <article className={s.humanRole}><span>{letter}</span><div><b>{title}</b><small>Conectado al Hotel OS</small><p>{detail}</p></div><i>●</i></article>
}

function CommandCenter({ days, rooms, reservations, blocks, start, setStart, onMove, onOpen, onEmpty }) {
  return <div className={`${s.content} ${s.command}`}><section className={s.commandIntro}><div><small>ROOM DIARY · INVENTARIO REAL</small><h2>Arrastrar, resolver, seguir.</h2><p>La disponibilidad está protegida también en PostgreSQL. Si dos operaciones chocan, el motor evita la sobreventa.</p></div><div><button onClick={() => setStart(addDays(start, -7))}>←</button><button onClick={() => setStart(isoDate())}>Hoy</button><button onClick={() => setStart(addDays(start, 7))}>→</button></div></section><section className={s.calendarShell}><div className={s.calendarGrid} style={{ gridTemplateColumns: `176px repeat(${days.length}, minmax(84px, 1fr))` }}><div className={s.calCorner}><small>HABITACIÓN</small><b>{shortDate(start)} — {shortDate(days.at(-1))}</b></div>{days.map(day => <div key={day} className={`${s.dayHead} ${day === isoDate() ? s.today : ""}`}><small>{new Date(`${day}T12:00:00`).toLocaleDateString("es-AR", { weekday: "short" })}</small><b>{new Date(`${day}T12:00:00`).getDate()}</b></div>)}{rooms.map(room => <CalendarRow key={room.id} room={room} days={days} reservations={reservations} blocks={blocks} onMove={onMove} onOpen={onOpen} onEmpty={onEmpty} />)}</div></section></div>
}

function CalendarRow({ room, days, reservations, blocks, onMove, onOpen, onEmpty }) {
  const rowReservations = reservations.filter(r => String(r.habitacion_id) === String(room.id) && r.fecha_salida > days[0] && r.fecha_entrada <= days.at(-1))
  return <><button className={s.roomLabel}><span>{room.nombre}</span><small>{room.tipo || "Habitación"} · {money(room.precio)}</small></button>{days.map(day => { const blocked = roomIsBlocked(blocks, room.id, day, addDays(day, 1)); return <div key={`${room.id}-${day}`} className={`${s.calCell} ${blocked ? s.blocked : ""}`} onDoubleClick={() => !blocked && onEmpty(room, day)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData("text/reservation"); const reservation = reservations.find(r => String(r.id) === String(id)); if (reservation) onMove(reservation, room.id, day) }}>{blocked && <span className={s.blockMark}>bloqueo</span>}</div> })}{rowReservations.map(r => { const visibleStart = r.fecha_entrada < days[0] ? days[0] : r.fecha_entrada; const visibleEnd = r.fecha_salida > addDays(days.at(-1), 1) ? addDays(days.at(-1), 1) : r.fecha_salida; const col = days.indexOf(visibleStart) + 2; const span = Math.max(1, nightsBetween(visibleStart, visibleEnd)); return <button key={r.id} draggable onDragStart={e => e.dataTransfer.setData("text/reservation", String(r.id))} onClick={() => onOpen(r)} className={`${s.resBar} ${s[`status_${r.estado}`] || ""}`} style={{ gridColumn: `${col} / span ${span}` }}><b>{r.nombre_huesped}</b><small>{r.estado === "alojado" ? "IN · " : ""}{r.canal_reserva || "Directa"}</small></button> })}</>
}

function Guests({ guests, selected, onSelect }) {
  return <div className={s.content}><section className={s.editorialIntro}><small>GUEST GRAPH</small><h2>Recordar bien es una forma de hospitalidad.</h2><p>El historial se arma desde las reservas reales: estadías, noches, valor, canales y notas.</p></section><div className={s.guestLayout}><section className={s.guestBook}>{guests.length ? guests.map(g => <button key={g.key} className={selected?.key === g.key ? s.selectedGuest : ""} onClick={() => onSelect(g)}><span>{initials(g.name)}</span><div><b>{g.name}</b><small>{g.stays} estadías · {g.nights} noches</small></div><em>{money(g.revenue)}</em></button>) : <div className={s.softEmpty}>Todavía no hay historial suficiente.</div>}</section><section className={s.guestProfile}>{selected ? <><div className={s.guestHero}><span>{initials(selected.name)}</span><div><small>HUÉSPED</small><h3>{selected.name}</h3><p>{selected.email || selected.phone || "Sin contacto cargado"}</p></div></div><div className={s.profileStats}><div><small>Estadías</small><b>{selected.stays}</b></div><div><small>Noches</small><b>{selected.nights}</b></div><div><small>Lifetime</small><b>{money(selected.revenue)}</b></div></div><div className={s.preferenceCloud}>{selected.channels.map(x => <span key={x}>{x}</span>)}{selected.notes.slice(0, 5).map((x, i) => <span key={i}>{x.slice(0, 42)}</span>)}</div></> : <div className={s.profileEmpty}><span>◎</span><h3>Elegí un huésped</h3><p>Su historia aparecerá acá sin ruido administrativo.</p></div>}</section></div></div>
}

function Housekeeping({ rooms, reservations, today, onRoom, onStatus }) {
  function priority(room) {
    const out = reservations.some(r => String(r.habitacion_id) === String(room.id) && r.fecha_salida === today && r.estado !== "finalizada")
    const incoming = reservations.some(r => String(r.habitacion_id) === String(room.id) && r.fecha_entrada === today && r.estado !== "cancelada")
    if (String(room.estado).toLowerCase() === "sucia" && incoming) return ["URGENTE", 0]
    if (String(room.estado).toLowerCase() === "sucia" || out) return ["ALTA", 1]
    if (String(room.estado).toLowerCase() === "mantenimiento") return ["BLOQUEADA", 2]
    return ["LISTA", 3]
  }
  const sorted = [...rooms].sort((a, b) => priority(a)[1] - priority(b)[1])
  return <div className={s.content}><section className={s.editorialIntro}><small>HOUSEKEEPING INTELLIGENCE</small><h2>El próximo huésped define la prioridad.</h2><p>El estado se guarda en la habitación real y recepción lo ve al instante.</p></section><div className={s.houseGrid}>{sorted.map(room => { const [p] = priority(room); return <article key={room.id} className={s.houseCard}><button className={s.door} onClick={() => onRoom(room)}><span>{room.nombre}</span><i /></button><div><small>{room.tipo || "Habitación"}</small><h3>{room.nombre}</h3><p>{p === "URGENTE" ? "Tiene llegada hoy y todavía requiere preparación." : p === "ALTA" ? "Conviene resolverla antes de seguir con habitaciones sin llegada." : p === "BLOQUEADA" ? "Está fuera de servicio hasta mantenimiento." : "Preparada para recibir."}</p><div className={s.houseTags}><span>{room.estado || "libre"}</span><b>{p}</b></div></div><div className={s.houseActions}><button onClick={() => onStatus(room, "limpia")}>Lista</button><button onClick={() => onStatus(room, "sucia")}>Sucia</button><button onClick={() => onStatus(room, "inspeccion")}>Inspección</button></div></article> })}</div></div>
}

function Revenue({ rooms, occupancy, adr, revpar, gross, directShare, onRates, reservations }) {
  const channelData = useMemo(() => {
    const map = new Map()
    reservations.forEach(r => { const key = r.canal_reserva || "Directa"; const x = map.get(key) || { name: key, bookings: 0, gross: 0 }; x.bookings++; x.gross += Number(r.precio_total || 0); map.set(key, x) })
    return [...map.values()].sort((a, b) => b.gross - a.gross)
  }, [reservations])
  return <div className={s.content}><section className={s.revenueHero}><div><small>REVENUE BRAIN</small><h2>Precio con criterio, no con ansiedad.</h2><p>La recomendación parte de ocupación y ritmo interno. La comparación de mercado se habilita al conectar fuentes externas.</p></div><div className={s.revenueNumbers}><Metric label="Ocupación" value={`${occupancy}%`} /><Metric label="ADR" value={money(adr)} /><Metric label="RevPAR" value={money(revpar)} /><Metric label="Ingresos" value={money(gross)} /></div></section><div className={s.revenueGrid}><section className={s.ratePanel}><PanelHead eyebrow="PAISAJE DE TARIFAS" title="Inventario y posicionamiento" />{rooms.map(room => <div key={room.id} className={s.rateLine}><span><b>{room.nombre}</b><small>{room.tipo || "Habitación"}</small></span><div><i style={{ width: `${Math.min(94, Math.max(16, Number(room.precio || 0) / 3000))}%` }} /></div><strong>{money(room.precio)}</strong></div>)}</section><section className={s.recommendations}><small>DECISIONES SUGERIDAS</small><article><span>+8%</span><h3>Defender tarifa premium.</h3><p>Aplicá un ajuste general y seguí observando la conversión.</p><button onClick={() => onRates(8, false)}>Aplicar +8%</button></article><article><span>+12%</span><h3>Separar categorías premium.</h3><p>Suites, deluxe y superiores pueden tener su propia curva.</p><button onClick={() => onRates(12, true)}>Ajustar premium</button></article></section></div><section className={s.channelEconomics}><PanelHead eyebrow="CHANNEL ECONOMICS" title="De dónde llega el negocio" /><div>{channelData.map(c => <article key={c.name}><span><b>{c.name}</b><small>{c.bookings} reservas</small></span><strong>{money(c.gross)}</strong><div><i style={{ width: `${Math.min(100, c.gross / Math.max(1, gross) * 100)}%` }} /></div></article>)}</div><footer>Venta directa actual: <b>{directShare}%</b>. Cuando las comisiones estén conectadas, este módulo calcula margen neto por canal.</footer></section></div>
}

function Metric({ label, value }) { return <div><small>{label}</small><b>{value}</b></div> }

function Distribution({ providers, channels, onPrepare }) {
  const map = new Map(channels.map(c => [c.provider, c]))
  return <div className={s.content}><section className={s.distributionHero}><div><small>LLENA DISTRIBUTION HUB</small><h2>Una disponibilidad. Todos los canales.</h2><p>Ninguna integración se muestra como “conectada” si no lo está. Los proveedores externos pasan primero por sandbox y certificación.</p></div><span className={s.syncMedal}><b>{channels.filter(c => c.status === "connected").length}</b><small>conexiones reales</small></span></section><div className={s.providerGrid}>{providers.map(([name, desc]) => { const c = map.get(name); return <article key={name}><div className={s.providerMark}>{initials(name)}</div><div><small>{desc}</small><h3>{name}</h3><p>{c?.status === "connected" ? "Conexión de producción registrada." : c?.status === "sandbox" ? "Sandbox preparado. Falta certificación/credenciales de producción." : "Todavía no configurado."}</p></div><span className={`${s.connectionStatus} ${c?.status === "connected" ? s.connected : c?.status === "sandbox" ? s.sandbox : ""}`}>{c?.status === "connected" ? "CONECTADO" : c?.status === "sandbox" ? "SANDBOX" : "SIN CONECTAR"}</span><button onClick={() => onPrepare(name)}>{c ? "Revisar preparación" : "Preparar conexión"}</button></article> })}</div><section className={s.distributionNote}><span>◎</span><div><b>Diseñado para no vender de más.</b><p>El inventario del PMS es la fuente de verdad. La conexión real con cada OTA se habilita cuando tengamos credenciales y certificación del proveedor.</p></div></section></div>
}

function Automations({ items, draft, setDraft, onCreate, onToggle }) {
  return <div className={s.content}><section className={s.automationHero}><small>AUTOMATION STUDIO</small><h2>Decile al hotel qué debería ocurrir. Una sola vez.</h2><p>Las reglas quedan guardadas por propiedad. La ejecución autónoma completa se habilita flujo por flujo para no automatizar acciones delicadas sin control.</p><form onSubmit={onCreate}><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ej.: cuando un huésped recurrente reserve una suite, avisá a recepción y prepará una nota de bienvenida…" /><button>Crear automatización ✦</button></form></section><section className={s.automationList}>{items.length ? items.map(item => <article key={item.id} className={item.enabled ? s.automationOn : ""}><button className={s.toggle} onClick={() => onToggle(item)}><i /></button><div><small>{item.enabled ? "ACTIVA" : "PAUSADA"}</small><h3>{item.name}</h3><p><b>Cuando:</b> {item.trigger_text}</p><p><b>Entonces:</b> {item.action_text}</p></div><span>{item.runs || 0}<small>ejecuciones</small></span></article>) : <div className={s.softEmpty}>Todavía no creaste automatizaciones para este hotel.</div>}</section></div>
}

function DigitalTwin({ settings, rooms, reservations, onRoom }) {
  const floors = useMemo(() => {
    const groups = new Map()
    rooms.forEach(room => { const match = String(room.nombre || "").match(/^(\d)/); const floor = match ? `Piso ${match[1]}` : "Hotel"; if (!groups.has(floor)) groups.set(floor, []); groups.get(floor).push(room) })
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }))
  }, [rooms])
  return <div className={s.content}><section className={s.editorialIntro}><small>HOTEL DIGITAL TWIN</small><h2>Tu edificio, vivo.</h2><p>Una representación espacial simple para comprender ocupación y estado sin abrir una planilla.</p></section><section className={s.facade}><div className={s.facadeCrown}><Logo settings={settings} /><span>{settings.hotel_name}</span></div>{floors.map(([floor, list]) => <div key={floor} className={s.floor}><div><small>{floor}</small><span>{list.length} habitaciones</span></div><section>{list.map(room => { const current = reservations.find(r => String(r.habitacion_id) === String(room.id)); return <button key={room.id} onClick={() => onRoom(room)} className={`${s.twinRoom} ${current ? s.twinOccupied : ""} ${s[`room_${String(room.estado || "").toLowerCase()}`] || ""}`}><b>{room.nombre}</b><i /><small>{current ? current.nombre_huesped : room.estado || "libre"}</small></button> })}</section></div>)}<div className={s.digitalLobby}><span>LOBBY</span><div className={s.miniDesk}><i /><b>Recepción</b></div><div className={s.lounge}><i /><i /><i /></div></div></section></div>
}

function BrandStudio({ draft, setDraft, onSave, onLogo, logoRef, loadLogo }) {
  return <div className={s.content}><section className={s.brandStudio}><div className={s.brandPreview}><div className={s.materials}><i /><i /><i /></div><Logo settings={draft} large /><small>IDENTIDAD DEL HOTEL</small><h2>{draft.hotel_name || "Tu hotel"}</h2><p>“{draft.motto || "Tu lema"}”</p><button onClick={onLogo}>{draft.logo_data_url ? "Cambiar logo" : "Cargar logo"}</button></div><form onSubmit={onSave} className={s.brandForm}><small>BRAND STUDIO</small><h2>Que el software sea una extensión de tu lobby.</h2><p>Nombre, lema, saludo y atmósfera pasan a formar parte del escritorio de recepción.</p><label>Nombre del hotel<input value={draft.hotel_name || ""} onChange={e => setDraft(x => ({ ...x, hotel_name: e.target.value }))} /></label><label>Ciudad<input value={draft.city || ""} onChange={e => setDraft(x => ({ ...x, city: e.target.value }))} /></label><label>Lema<textarea value={draft.motto || ""} onChange={e => setDraft(x => ({ ...x, motto: e.target.value }))} /></label><label>Saludo de recepción<input value={draft.welcome_message || ""} onChange={e => setDraft(x => ({ ...x, welcome_message: e.target.value }))} /></label><div className={s.themePicker}><small>ATMÓSFERA</small>{Object.entries(THEMES).map(([id, t]) => <button type="button" key={id} className={draft.theme === id ? s.themeActive : ""} onClick={() => setDraft(x => ({ ...x, theme: id }))}><i style={{ background: `linear-gradient(135deg,${t.side},${t.accent})` }} /><span>{id === "olive" ? "Olive House" : id === "cognac" ? "Cognac Club" : "Midnight Suite"}</span></button>)}</div><button className={s.saveBrand}>Guardar identidad</button></form></section></div>
}

function ReservationDrawer({ reservation, room, paid, onClose, onCheckin, onCheckout, onResize }) {
  const balance = Math.max(0, Number(reservation.precio_total || 0) - Number(paid || 0))
  return <div className={s.drawerShade} onMouseDown={e => e.target === e.currentTarget && onClose()}><aside className={s.drawer}><header><div><small>{reservation.numero_reserva || "RESERVA"}</small><h2>{reservation.nombre_huesped}</h2><p>{room?.nombre || reservation.habitacion_id} · {reservation.canal_reserva || "Directa"}</p></div><button onClick={onClose}>×</button></header><div className={s.stayRibbon}><span>{shortDate(reservation.fecha_entrada)}<small>llegada</small></span><i /><strong>{reservation.noches || nightsBetween(reservation.fecha_entrada, reservation.fecha_salida)} noches</strong><i /><span>{shortDate(reservation.fecha_salida)}<small>salida</small></span></div><div className={s.drawerStats}><Metric label="Total" value={money(reservation.precio_total, reservation.moneda)} /><Metric label="Pagado" value={money(paid, reservation.moneda)} /><Metric label="Saldo" value={money(balance, reservation.moneda)} /></div>{reservation.notas && <blockquote>{reservation.notas}</blockquote>}<section className={s.drawerActions}><button disabled={reservation.estado === "alojado" || reservation.estado === "finalizada"} onClick={onCheckin}>Realizar check-in</button><button disabled={reservation.estado === "finalizada" || balance > .01} onClick={onCheckout}>Realizar checkout</button><button onClick={() => onResize(1)}>＋ 1 noche</button><button onClick={() => onResize(-1)}>− 1 noche</button></section>{balance > .01 && <div className={s.balanceNotice}>El checkout permanece bloqueado mientras exista saldo pendiente.</div>}</aside></div>
}

function RoomDrawer({ room, current, onClose, onStatus }) {
  return <div className={s.drawerShade} onMouseDown={e => e.target === e.currentTarget && onClose()}><aside className={s.drawer}><header><div><small>HABITACIÓN</small><h2>{room.nombre}</h2><p>{room.tipo || "Habitación"} · {money(room.precio)} / noche</p></div><button onClick={onClose}>×</button></header><div className={s.roomObject}><span>{room.nombre}</span><i /></div><div className={s.drawerStats}><Metric label="Estado" value={room.estado || "libre"} /><Metric label="Capacidad" value={`${room.capacidad || "—"} pax`} /><Metric label="Ahora" value={current ? "Ocupada" : "Disponible"} /></div>{current && <blockquote>{current.nombre_huesped} · hasta {shortDate(current.fecha_salida)}</blockquote>}<section className={s.drawerActions}><button onClick={() => onStatus("limpia")}>Marcar lista</button><button onClick={() => onStatus("sucia")}>Marcar sucia</button><button onClick={() => onStatus("inspeccion")}>Enviar a inspección</button><button onClick={() => onStatus("mantenimiento")}>Mantenimiento</button></section></aside></div>
}

function ReservationModal({ data, setData, rooms, onSubmit, onClose }) {
  return <div className={s.modalShade} onMouseDown={e => e.target === e.currentTarget && onClose()}><form className={s.modal} onSubmit={onSubmit}><header><div><small>NUEVA ESTADÍA</small><h2>Reservar con calma.</h2></div><button type="button" onClick={onClose}>×</button></header><div className={s.formGrid}><label className={s.wide}>Huésped<input autoFocus value={data.guest} onChange={e => setData(x => ({ ...x, guest: e.target.value }))} placeholder="Nombre y apellido" /></label><label>Email<input type="email" value={data.email} onChange={e => setData(x => ({ ...x, email: e.target.value }))} /></label><label>Teléfono<input value={data.phone} onChange={e => setData(x => ({ ...x, phone: e.target.value }))} /></label><label>Habitación<select value={data.roomId} onChange={e => setData(x => ({ ...x, roomId: e.target.value }))}><option value="">Elegir</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.nombre} · {r.tipo || "Habitación"}</option>)}</select></label><label>Huéspedes<input type="number" min="1" max="20" value={data.pax} onChange={e => setData(x => ({ ...x, pax: e.target.value }))} /></label><label>Llegada<input type="date" value={data.start} onChange={e => setData(x => ({ ...x, start: e.target.value, end: x.end <= e.target.value ? addDays(e.target.value, 1) : x.end }))} /></label><label>Salida<input type="date" min={addDays(data.start, 1)} value={data.end} onChange={e => setData(x => ({ ...x, end: e.target.value }))} /></label><label>Canal<select value={data.channel} onChange={e => setData(x => ({ ...x, channel: e.target.value }))}><option>Directa</option><option>Booking.com</option><option>Expedia</option><option>Airbnb</option><option>Teléfono</option><option>Walk-in</option></select></label><label className={s.wide}>Notas<textarea value={data.notes} onChange={e => setData(x => ({ ...x, notes: e.target.value }))} placeholder="Preferencias, llegada, solicitudes especiales…" /></label></div><footer><span>{nightsBetween(data.start, data.end)} noches</span><button>Crear reserva</button></footer></form></div>
}

function AIPanel({ messages, input, setInput, busy, onSubmit, onClose }) {
  return <aside className={s.aiPanel}><header><div><span>✦</span><div><b>Llena Intelligence</b><small>Copiloto operativo</small></div></div><button onClick={onClose}>×</button></header><div className={s.aiMessages}>{messages.map((m, i) => <div key={i} className={m.role === "user" ? s.aiUser : s.aiAssistant}>{m.content}</div>)}{busy && <div className={s.aiAssistant}>Pensando sobre la operación…</div>}</div><div className={s.aiChips}><button onClick={() => setInput("¿Cuánto saldo pendiente hay?")}>Saldos</button><button onClick={() => setInput("Subí las tarifas 8%")}>Tarifas +8%</button><button onClick={() => setInput("¿Qué debería mirar hoy?")}>Prioridades</button></div><form onSubmit={onSubmit}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Pedime una acción o una lectura…" /><button disabled={busy}>↑</button></form></aside>
}
