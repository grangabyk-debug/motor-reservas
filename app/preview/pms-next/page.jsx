"use client"

import { useEffect, useMemo, useState } from "react"

const TODAY = "2026-08-30"
const STORAGE_KEY = "habitacion-llena-os-preview-v2"

const roomSeed = [
  { id: "101", type: "Doble King", floor: "Piso 1", status: "clean", rate: 118000 },
  { id: "102", type: "Doble Twin", floor: "Piso 1", status: "clean", rate: 112000 },
  { id: "103", type: "Doble King", floor: "Piso 1", status: "dirty", rate: 118000 },
  { id: "104", type: "Doble Twin", floor: "Piso 1", status: "clean", rate: 112000 },
  { id: "201", type: "Triple Deluxe", floor: "Piso 2", status: "clean", rate: 148000 },
  { id: "202", type: "Suite", floor: "Piso 2", status: "inspection", rate: 185000 },
  { id: "203", type: "Suite", floor: "Piso 2", status: "clean", rate: 185000 },
  { id: "204", type: "Triple Deluxe", floor: "Piso 2", status: "dirty", rate: 148000 },
  { id: "301", type: "Junior Suite", floor: "Piso 3", status: "clean", rate: 164000 },
  { id: "302", type: "Junior Suite", floor: "Piso 3", status: "maintenance", rate: 164000 },
  { id: "303", type: "Suite", floor: "Piso 3", status: "clean", rate: 198000 },
  { id: "304", type: "Doble King", floor: "Piso 3", status: "clean", rate: 126000 },
]

const reservationSeed = [
  { id: "R-1842", guestId: "G-01", guest: "Sofía Martínez", roomId: "101", start: "2026-08-30", nights: 3, status: "inhouse", pax: 2, total: 354000, paid: 354000, channel: "Directa", vip: true, notes: "Prefiere piso alto y almohada firme." },
  { id: "R-1843", guestId: "G-02", guest: "Tomás Beltrán", roomId: "102", start: "2026-08-31", nights: 2, status: "confirmed", pax: 2, total: 224000, paid: 112000, channel: "Booking.com", notes: "Llega cerca de las 18:30." },
  { id: "R-1844", guestId: "G-03", guest: "Familia Ricci", roomId: "201", start: "2026-08-30", nights: 4, status: "inhouse", pax: 3, total: 592000, paid: 592000, channel: "Directa", notes: "Viajan con un niño. Solicitaron cuna." },
  { id: "R-1845", guestId: "G-04", guest: "Lucía Pereira", roomId: "202", start: "2026-09-02", nights: 3, status: "pending", pax: 2, total: 555000, paid: 0, channel: "Instagram", notes: "Pendiente garantía." },
  { id: "R-1846", guestId: "G-05", guest: "Martín Ocampo", roomId: "203", start: "2026-09-01", nights: 2, status: "confirmed", pax: 2, total: 370000, paid: 185000, channel: "Expedia", notes: "Necesita cochera." },
  { id: "R-1847", guestId: "G-06", guest: "Carla Moreno", roomId: "301", start: "2026-08-30", nights: 5, status: "inhouse", pax: 3, total: 820000, paid: 820000, channel: "Directa", notes: "Huésped recurrente. Café sin azúcar." },
  { id: "R-1848", guestId: "G-07", guest: "Andrew Lewis", roomId: "303", start: "2026-09-03", nights: 4, status: "confirmed", pax: 2, total: 792000, paid: 396000, channel: "Booking.com", notes: "English speaker. Airport transfer requested." },
  { id: "R-1849", guestId: "G-08", guest: "Micaela Torres", roomId: "104", start: "2026-09-04", nights: 2, status: "confirmed", pax: 1, total: 224000, paid: 224000, channel: "Airbnb", notes: "Check-in tarde." },
]

const guestSeed = [
  { id: "G-01", name: "Sofía Martínez", email: "sofia@demo.hotel", phone: "+54 9 11 5555 0101", stays: 6, nights: 17, lifetime: 1840000, source: "Directa", tags: ["Recurrente", "Piso alto", "Almohada firme"], duplicate: "G-09" },
  { id: "G-02", name: "Tomás Beltrán", email: "tomas@demo.hotel", phone: "+54 9 11 5555 0102", stays: 2, nights: 5, lifetime: 610000, source: "Booking.com", tags: ["Pareja", "Late arrival"] },
  { id: "G-03", name: "Familia Ricci", email: "ricci@demo.hotel", phone: "+54 9 11 5555 0103", stays: 4, nights: 14, lifetime: 2310000, source: "Directa", tags: ["Familia", "Cuna", "Desayuno"] },
  { id: "G-04", name: "Lucía Pereira", email: "lucia@demo.hotel", phone: "+54 9 11 5555 0104", stays: 1, nights: 3, lifetime: 555000, source: "Instagram", tags: ["Primera estadía"] },
  { id: "G-05", name: "Martín Ocampo", email: "martin@demo.hotel", phone: "+54 9 11 5555 0105", stays: 3, nights: 8, lifetime: 1280000, source: "Expedia", tags: ["Cochera", "Factura A"] },
  { id: "G-06", name: "Carla Moreno", email: "carla@demo.hotel", phone: "+54 9 11 5555 0106", stays: 8, nights: 28, lifetime: 4190000, source: "Directa", tags: ["VIP", "Café sin azúcar", "Suite"] },
  { id: "G-07", name: "Andrew Lewis", email: "andrew@demo.hotel", phone: "+1 415 555 0181", stays: 2, nights: 8, lifetime: 1510000, source: "Booking.com", tags: ["English", "Transfer"] },
  { id: "G-08", name: "Micaela Torres", email: "mica@demo.hotel", phone: "+54 9 11 5555 0108", stays: 1, nights: 2, lifetime: 224000, source: "Airbnb", tags: ["Late check-in"] },
  { id: "G-09", name: "Sofia Martinez", email: "sofia.martinez@demo.hotel", phone: "+54 9 11 5555 0101", stays: 1, nights: 2, lifetime: 220000, source: "Booking.com", tags: ["Posible duplicado"], duplicate: "G-01" },
]

const channelSeed = [
  { id: "direct", name: "Motor directo", inventory: 8, status: "healthy", latency: "2 s", gross: 4210000, bookings: 31, commission: 84000, mode: "native" },
  { id: "booking", name: "Booking.com", inventory: 8, status: "healthy", latency: "18 s", gross: 8700000, bookings: 73, commission: 1400000, mode: "sandbox" },
  { id: "expedia", name: "Expedia", inventory: 8, status: "healthy", latency: "26 s", gross: 3560000, bookings: 28, commission: 604000, mode: "sandbox" },
  { id: "airbnb", name: "Airbnb", inventory: 8, status: "healthy", latency: "31 s", gross: 2210000, bookings: 17, commission: 331000, mode: "sandbox" },
  { id: "agoda", name: "Agoda", inventory: 8, status: "standby", latency: "—", gross: 0, bookings: 0, commission: 0, mode: "sandbox" },
]

const automationSeed = [
  { id: "A-1", name: "Garantía de alto valor", trigger: "Reserva > $500.000", action: "Solicitar garantía + avisar recepción", enabled: true, runs: 14 },
  { id: "A-2", name: "Huésped recurrente", trigger: "3+ estadías previas", action: "Sugerir upgrade si hay disponibilidad", enabled: true, runs: 8 },
  { id: "A-3", name: "Habitación prioritaria", trigger: "Llegada < 3 h y habitación no lista", action: "Elevar prioridad de housekeeping", enabled: true, runs: 22 },
  { id: "A-4", name: "Saldo pre check-in", trigger: "24 h antes y saldo > 0", action: "Preparar mensaje de pago", enabled: false, runs: 0 },
]

const nav = [
  ["overview", "Inicio", "⌂"],
  ["calendar", "Command Center", "▦"],
  ["distribution", "Distribution", "⌁"],
  ["revenue", "Revenue", "↗"],
  ["guests", "Huéspedes", "◎"],
  ["housekeeping", "Housekeeping", "◇"],
  ["automations", "Automatizaciones", "✦"],
  ["twin", "Hotel Digital Twin", "▥"],
]

function addDays(dateString, amount) {
  const d = new Date(`${dateString}T12:00:00`)
  d.setDate(d.getDate() + Number(amount))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function diffDays(a, b) {
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000)
}

const fmtMoney = value => `$ ${Math.round(Number(value || 0)).toLocaleString("es-AR")}`
const shortDate = value => new Date(`${value}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })

function statusMeta(status) {
  return {
    inhouse: ["Alojado", "emerald"], confirmed: ["Confirmada", "gold"], pending: ["Pendiente", "amber"], checkout: ["Checkout", "terracotta"], cancelled: ["Cancelada", "muted"],
  }[status] || ["Reserva", "gold"]
}

function roomStatusMeta(status) {
  return {
    clean: ["Lista", "emerald"], dirty: ["Sucia", "terracotta"], inspection: ["Inspección", "amber"], maintenance: ["Fuera de servicio", "muted"],
  }[status] || [status, "muted"]
}

function overlap(aStart, aNights, bStart, bNights) {
  const aEnd = addDays(aStart, aNights)
  const bEnd = addDays(bStart, bNights)
  return aStart < bEnd && aEnd > bStart
}

export default function PMSNextPreview() {
  const [view, setView] = useState("overview")
  const [role, setRole] = useState("reception")
  const [rooms, setRooms] = useState(roomSeed)
  const [reservations, setReservations] = useState(reservationSeed)
  const [guests, setGuests] = useState(guestSeed)
  const [channels, setChannels] = useState(channelSeed)
  const [automations, setAutomations] = useState(automationSeed)
  const [calendarStart, setCalendarStart] = useState(TODAY)
  const [selectedReservationId, setSelectedReservationId] = useState(null)
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [selectedGuestId, setSelectedGuestId] = useState(null)
  const [search, setSearch] = useState("")
  const [toast, setToast] = useState("")
  const [newReservationOpen, setNewReservationOpen] = useState(false)
  const [newReservation, setNewReservation] = useState({ guest: "", roomId: "101", start: TODAY, nights: 2, pax: 2, channel: "Directa" })
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState("")
  const [aiLog, setAiLog] = useState([
    { side: "system", text: "Llena Intelligence está lista. Podés pedirme acciones operativas sobre este preview." },
  ])
  const [provider, setProvider] = useState("SiteMinder pmsXchange")
  const [providerCode, setProviderCode] = useState("")
  const [sandboxVerified, setSandboxVerified] = useState(false)
  const [aiDiscovery, setAiDiscovery] = useState({ chatgpt: true, claude: false, gemini: true })
  const [automationDraft, setAutomationDraft] = useState("")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.rooms) setRooms(data.rooms)
        if (data.reservations) setReservations(data.reservations)
        if (data.guests) setGuests(data.guests)
        if (data.channels) setChannels(data.channels)
        if (data.automations) setAutomations(data.automations)
        if (data.aiDiscovery) setAiDiscovery(data.aiDiscovery)
      }
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ rooms, reservations, guests, channels, automations, aiDiscovery }))
  }, [hydrated, rooms, reservations, guests, channels, automations, aiDiscovery])

  const calendarDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(calendarStart, i)), [calendarStart])
  const selectedReservation = reservations.find(r => r.id === selectedReservationId) || null
  const selectedRoom = rooms.find(r => r.id === selectedRoomId) || null
  const selectedGuest = guests.find(g => g.id === selectedGuestId) || null
  const activeToday = reservations.filter(r => r.status !== "cancelled" && r.start <= TODAY && addDays(r.start, r.nights) > TODAY)
  const arrivalsToday = reservations.filter(r => r.status !== "cancelled" && r.start === TODAY)
  const departuresToday = reservations.filter(r => r.status !== "cancelled" && addDays(r.start, r.nights) === TODAY)
  const sellableRooms = rooms.filter(r => r.status !== "maintenance")
  const occupiedRoomIds = new Set(activeToday.map(r => r.roomId))
  const availableNow = Math.max(0, sellableRooms.length - occupiedRoomIds.size)
  const occupancy = sellableRooms.length ? Math.round((occupiedRoomIds.size / sellableRooms.length) * 100) : 0
  const liveReservations = reservations.filter(r => r.status !== "cancelled")
  const gross = liveReservations.reduce((sum, r) => sum + r.total, 0)
  const roomNights = liveReservations.reduce((sum, r) => sum + r.nights, 0)
  const adr = roomNights ? Math.round(gross / roomNights) : 0
  const revpar = Math.round((gross / Math.max(1, rooms.length * 30)))
  const directGross = liveReservations.filter(r => r.channel === "Directa").reduce((s, r) => s + r.total, 0)
  const directShare = gross ? Math.round((directGross / gross) * 100) : 0
  const channelMismatch = channels.some(c => c.status !== "standby" && c.inventory !== availableNow)

  const housekeepingRows = useMemo(() => rooms.map(room => {
    const next = reservations.filter(r => r.roomId === room.id && r.status !== "cancelled" && r.start >= TODAY).sort((a, b) => a.start.localeCompare(b.start))[0]
    const current = reservations.find(r => r.roomId === room.id && r.status === "inhouse" && r.start <= TODAY && addDays(r.start, r.nights) > TODAY)
    const hoursSignal = next ? diffDays(TODAY, next.start) : 99
    const priority = room.status === "dirty" && hoursSignal <= 1 ? 1 : room.status === "inspection" && hoursSignal <= 3 ? 2 : room.status === "dirty" ? 3 : room.status === "maintenance" ? 4 : 5
    return { room, next, current, priority }
  }).sort((a, b) => a.priority - b.priority || a.room.id.localeCompare(b.room.id)), [rooms, reservations])

  const filteredGuests = guests.filter(g => {
    const q = search.trim().toLowerCase()
    return !q || [g.name, g.email, g.phone, g.source, ...(g.tags || [])].some(v => String(v).toLowerCase().includes(q))
  })

  function notify(message) {
    setToast(message)
    window.setTimeout(() => setToast(""), 2600)
  }

  function reservationConflict(id, roomId, start, nights) {
    return reservations.some(r => r.id !== id && r.status !== "cancelled" && r.roomId === roomId && overlap(start, nights, r.start, r.nights))
  }

  function moveReservation(id, roomId, start) {
    const target = reservations.find(r => r.id === id)
    const room = rooms.find(r => r.id === roomId)
    if (!target || !room) return
    if (room.status === "maintenance") return notify("Movimiento bloqueado: la habitación está fuera de servicio.")
    if (reservationConflict(id, roomId, start, target.nights)) return notify("Movimiento bloqueado: se produciría un cruce de reservas.")
    setReservations(list => list.map(r => r.id === id ? { ...r, roomId, start } : r))
    notify(`${id} movida a ${roomId} · ${shortDate(start)}.`)
  }

  function resizeReservation(id, delta) {
    const target = reservations.find(r => r.id === id)
    if (!target) return
    const nextNights = Math.max(1, target.nights + delta)
    if (reservationConflict(id, target.roomId, target.start, nextNights)) return notify("No se puede extender: hay otra reserva ocupando esas fechas.")
    const rate = rooms.find(r => r.id === target.roomId)?.rate || 0
    setReservations(list => list.map(r => r.id === id ? { ...r, nights: nextNights, total: rate * nextNights } : r))
    notify(delta > 0 ? "Estadía extendida una noche." : "Estadía acortada una noche.")
  }

  function splitReservation(id) {
    const target = reservations.find(r => r.id === id)
    if (!target || target.nights < 2) return notify("La estadía necesita al menos dos noches para dividirse.")
    const firstNights = Math.ceil(target.nights / 2)
    const secondNights = target.nights - firstNights
    const secondStart = addDays(target.start, firstNights)
    const candidate = rooms.find(room => room.id !== target.roomId && room.status !== "maintenance" && !reservationConflict("__split__", room.id, secondStart, secondNights))
    if (!candidate) return notify("No encontré otra habitación libre para completar el split.")
    const firstRate = rooms.find(r => r.id === target.roomId)?.rate || 0
    const secondRate = candidate.rate
    const linkedId = `${target.id}-B`
    setReservations(list => [
      ...list.map(r => r.id === id ? { ...r, nights: firstNights, total: firstRate * firstNights, groupId: target.id } : r),
      { ...target, id: linkedId, roomId: candidate.id, start: secondStart, nights: secondNights, total: secondRate * secondNights, paid: 0, groupId: target.id },
    ])
    notify(`Estadía dividida: continúa en habitación ${candidate.id}.`)
  }

  function createReservation(e) {
    e.preventDefault()
    const room = rooms.find(r => r.id === newReservation.roomId)
    const nights = Math.max(1, Number(newReservation.nights))
    if (!newReservation.guest.trim()) return notify("Ingresá el nombre del huésped.")
    if (!room || room.status === "maintenance") return notify("Elegí una habitación operativa.")
    if (reservationConflict("__new__", room.id, newReservation.start, nights)) return notify("La habitación ya está ocupada en esas fechas.")
    const newGuestId = `G-${String(guests.length + 20).padStart(2, "0")}`
    const id = `R-${1900 + reservations.length}`
    const item = { id, guestId: newGuestId, guest: newReservation.guest.trim(), roomId: room.id, start: newReservation.start, nights, status: "confirmed", pax: Number(newReservation.pax), total: room.rate * nights, paid: 0, channel: newReservation.channel, notes: "Reserva creada dentro del preview." }
    const guest = { id: newGuestId, name: item.guest, email: "", phone: "", stays: 1, nights, lifetime: item.total, source: item.channel, tags: ["Nueva reserva"] }
    setReservations(list => [...list, item])
    setGuests(list => [...list, guest])
    setNewReservationOpen(false)
    setSelectedReservationId(id)
    notify("Reserva creada y disponibilidad recalculada.")
  }

  function setReservationStatus(id, status) {
    setReservations(list => list.map(r => r.id === id ? { ...r, status } : r))
    notify(status === "inhouse" ? "Check-in realizado." : status === "checkout" ? "Check-out realizado." : "Estado actualizado.")
  }

  function advanceRoomStatus(roomId) {
    const order = ["dirty", "inspection", "clean", "maintenance"]
    setRooms(list => list.map(room => {
      if (room.id !== roomId) return room
      const index = order.indexOf(room.status)
      return { ...room, status: order[(index + 1) % order.length] }
    }))
    notify(`Estado de habitación ${roomId} actualizado.`)
  }

  function applyRate(type, percent) {
    setRooms(list => list.map(room => room.type.toLowerCase().includes(type.toLowerCase()) ? { ...room, rate: Math.round(room.rate * (1 + percent / 100)) } : room))
    notify(`Tarifas ${type} actualizadas ${percent > 0 ? "+" : ""}${percent}%.`)
  }

  function syncChannels() {
    setChannels(list => list.map(c => c.status === "standby" ? c : { ...c, inventory: availableNow, status: "healthy", latency: c.id === "direct" ? "1 s" : `${12 + Math.floor(Math.random() * 18)} s` }))
    notify("Inventario reconciliado en todos los canales activos del sandbox.")
  }

  function simulateChannelDrift() {
    setChannels(list => list.map(c => c.id === "expedia" ? { ...c, inventory: Math.max(0, availableNow - 1), status: "warning" } : c))
    notify("Incidencia de prueba creada en Expedia. Distribution Health la detectó.")
  }

  function mergeGuest(id) {
    const guest = guests.find(g => g.id === id)
    const duplicate = guest?.duplicate ? guests.find(g => g.id === guest.duplicate) : null
    if (!guest || !duplicate) return notify("Ese perfil no tiene duplicados detectados.")
    const primary = guest.id === "G-09" ? duplicate : guest
    const secondary = guest.id === "G-09" ? guest : duplicate
    setGuests(list => list.filter(g => g.id !== secondary.id).map(g => g.id === primary.id ? {
      ...g,
      stays: primary.stays + secondary.stays,
      nights: primary.nights + secondary.nights,
      lifetime: primary.lifetime + secondary.lifetime,
      tags: Array.from(new Set([...(primary.tags || []), ...(secondary.tags || [])])).filter(t => t !== "Posible duplicado"),
      duplicate: undefined,
    } : g))
    setReservations(list => list.map(r => r.guestId === secondary.id ? { ...r, guestId: primary.id, guest: primary.name } : r))
    setSelectedGuestId(primary.id)
    notify("Perfiles unificados sin perder historial.")
  }

  function toggleAutomation(id) {
    setAutomations(list => list.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a))
  }

  function createAutomationFromText() {
    const text = automationDraft.trim()
    if (!text) return notify("Describí primero la automatización.")
    const id = `A-${automations.length + 1}`
    setAutomations(list => [...list, { id, name: "Flujo creado con lenguaje natural", trigger: text, action: "Llena Intelligence interpretará y ejecutará el flujo", enabled: true, runs: 0 }])
    setAutomationDraft("")
    notify("Automatización creada y activada en el preview.")
  }

  function validateSandbox() {
    if (!providerCode.trim()) return notify("Ingresá un código de propiedad sandbox para validar el mapeo.")
    setSandboxVerified(true)
    notify(`${provider}: configuración sandbox validada.`)
  }

  function resetPreview() {
    setRooms(roomSeed)
    setReservations(reservationSeed)
    setGuests(guestSeed)
    setChannels(channelSeed)
    setAutomations(automationSeed)
    setAiDiscovery({ chatgpt: true, claude: false, gemini: true })
    window.localStorage.removeItem(STORAGE_KEY)
    notify("Preview restaurado a su estado inicial.")
  }

  function runAI(raw) {
    const text = raw.trim()
    if (!text) return
    setAiLog(log => [...log, { side: "user", text }])
    const q = text.toLowerCase()
    let answer = "Entendí el pedido, pero esta acción todavía necesita una regla más específica dentro del preview."
    const pct = Number((q.match(/(-?\d+)\s*%/) || [])[1])
    if ((q.includes("sub") || q.includes("aument") || q.includes("baj") || q.includes("reduc")) && pct) {
      const signed = q.includes("baj") || q.includes("reduc") ? -Math.abs(pct) : Math.abs(pct)
      const type = q.includes("suite") ? "Suite" : q.includes("doble") ? "Doble" : q.includes("triple") ? "Triple" : ""
      if (type) {
        applyRate(type, signed)
        answer = `Listo. Ajusté ${signed > 0 ? "hacia arriba" : "hacia abajo"} ${Math.abs(signed)}% las tarifas ${type}. Revenue y el calendario ya usan los nuevos valores.`
      }
    } else if (q.includes("sincron") || q.includes("reconcili")) {
      syncChannels()
      answer = "Listo. Reconcilié el inventario activo del sandbox con la disponibilidad real del PMS."
    } else if (q.includes("revenue") || q.includes("precio")) {
      setView("revenue")
      answer = "Abrí Revenue Intelligence. Ahí podés aplicar recomendaciones con límites de tarifa controlados."
    } else if (q.includes("calendar") || q.includes("calendario") || q.includes("agenda")) {
      setView("calendar")
      answer = "Abrí el Command Center para operar reservas y habitaciones."
    } else if (q.includes("housekeeping") || q.includes("limpieza")) {
      setView("housekeeping")
      answer = "Abrí Housekeeping priorizado por urgencia de llegada."
    } else if (q.includes("203") && (q.includes("lista") || q.includes("limpia"))) {
      setRooms(list => list.map(r => r.id === "203" ? { ...r, status: "clean" } : r))
      answer = "Habitación 203 marcada como lista. Recepción ya la ve disponible operativamente."
    } else if (q.includes("canal") || q.includes("booking") || q.includes("expedia")) {
      setView("distribution")
      answer = channelMismatch ? "Abrí Distribution. Hay una diferencia de inventario que podés reconciliar con un toque." : "Abrí Distribution. Todos los canales activos del sandbox están alineados."
    } else if (q.includes("huésped") || q.includes("huesped") || q.includes("perfil")) {
      setView("guests")
      answer = "Abrí el Guest Graph. Hay un posible duplicado detectado para Sofía Martínez."
    }
    window.setTimeout(() => setAiLog(log => [...log, { side: "assistant", text: answer }]), 120)
    setAiInput("")
  }

  return (
    <div className="osShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">HL</div>
          <div><b>Habitación Llena</b><small>Hotel Operating System</small></div>
        </div>
        <div className="property">
          <span>PROPIEDAD ACTIVA</span><b>Casa Oliva Hotel</b><small>Buenos Aires · {rooms.length} habitaciones</small>
        </div>
        <nav>
          {nav.map(([id, label, icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><i>{icon}</i><span>{label}</span>{id === "distribution" && channelMismatch && <em />}</button>)}
        </nav>
        <div className="sidebarBottom">
          <div className="roleSwitch"><button className={role === "reception" ? "on" : ""} onClick={() => setRole("reception")}>Recepción</button><button className={role === "owner" ? "on" : ""} onClick={() => setRole("owner")}>Dueño</button></div>
          <button className="reset" onClick={resetPreview}>Restaurar preview</button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="heading"><span>{role === "owner" ? "VISTA PROPIETARIO" : "OPERACIÓN EN VIVO"}</span><h1>{nav.find(n => n[0] === view)?.[1] || "Habitación Llena"}</h1></div>
          <div className="topActions">
            <div className="search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Huésped, reserva, habitación..." /></div>
            <button className="soft" onClick={() => setAiOpen(true)}>✦ Llena Intelligence</button>
            <button className="primary" onClick={() => setNewReservationOpen(true)}>＋ Nueva reserva</button>
          </div>
        </header>

        {view === "overview" && <Overview role={role} occupancy={occupancy} arrivalsToday={arrivalsToday} departuresToday={departuresToday} availableNow={availableNow} rooms={rooms} adr={adr} revpar={revpar} directShare={directShare} reservations={reservations} channelMismatch={channelMismatch} setView={setView} setSelectedReservationId={setSelectedReservationId} />}
        {view === "calendar" && <CalendarView rooms={rooms} reservations={reservations} days={calendarDays} calendarStart={calendarStart} setCalendarStart={setCalendarStart} setSelectedReservationId={setSelectedReservationId} moveReservation={moveReservation} setNewReservation={setNewReservation} setNewReservationOpen={setNewReservationOpen} />}
        {view === "distribution" && <DistributionView channels={channels} availableNow={availableNow} channelMismatch={channelMismatch} syncChannels={syncChannels} simulateChannelDrift={simulateChannelDrift} provider={provider} setProvider={setProvider} providerCode={providerCode} setProviderCode={setProviderCode} sandboxVerified={sandboxVerified} validateSandbox={validateSandbox} aiDiscovery={aiDiscovery} setAiDiscovery={setAiDiscovery} />}
        {view === "revenue" && <RevenueView rooms={rooms} reservations={reservations} adr={adr} revpar={revpar} directShare={directShare} applyRate={applyRate} />}
        {view === "guests" && <GuestsView guests={filteredGuests} setSelectedGuestId={setSelectedGuestId} />}
        {view === "housekeeping" && <HousekeepingView rows={housekeepingRows} advanceRoomStatus={advanceRoomStatus} setSelectedRoomId={setSelectedRoomId} />}
        {view === "automations" && <AutomationsView automations={automations} toggleAutomation={toggleAutomation} automationDraft={automationDraft} setAutomationDraft={setAutomationDraft} createAutomationFromText={createAutomationFromText} />}
        {view === "twin" && <TwinView rooms={rooms} reservations={reservations} setSelectedRoomId={setSelectedRoomId} />}
      </main>

      <button className="aiFloat" onClick={() => setAiOpen(true)}><span>✦</span><div><b>Llena Intelligence</b><small>Pedime una acción</small></div></button>
      {selectedReservation && <ReservationDrawer reservation={selectedReservation} rooms={rooms} guests={guests} onClose={() => setSelectedReservationId(null)} setReservationStatus={setReservationStatus} resizeReservation={resizeReservation} splitReservation={splitReservation} moveReservation={moveReservation} />}
      {selectedGuest && <GuestDrawer guest={selectedGuest} reservations={reservations} onClose={() => setSelectedGuestId(null)} mergeGuest={mergeGuest} />}
      {selectedRoom && <RoomDrawer room={selectedRoom} reservations={reservations} onClose={() => setSelectedRoomId(null)} advanceRoomStatus={advanceRoomStatus} />}
      {newReservationOpen && <NewReservationModal rooms={rooms} reservation={newReservation} setReservation={setNewReservation} onClose={() => setNewReservationOpen(false)} onSubmit={createReservation} />}
      {aiOpen && <AIPanel log={aiLog} input={aiInput} setInput={setAiInput} runAI={runAI} onClose={() => setAiOpen(false)} />}
      {toast && <div className="toast">{toast}</div>}
      <style jsx global>{styles}</style>
    </div>
  )
}

function Overview({ role, occupancy, arrivalsToday, departuresToday, availableNow, rooms, adr, revpar, directShare, reservations, channelMismatch, setView, setSelectedReservationId }) {
  const active = reservations.filter(r => r.status === "inhouse")
  return <div className="content overviewGrid"><section className="heroPanel"><div><span className="eyebrow">{role === "owner" ? "PULSO DEL NEGOCIO" : "PULSO DE RECEPCIÓN"}</span><h2>{role === "owner" ? "Un hotel legible en segundos." : "Todo lo importante, antes de que se vuelva urgente."}</h2><p>{channelMismatch ? "La operación está estable, pero Distribution detectó una diferencia de inventario que conviene reconciliar." : "Reservas, limpieza, precios y distribución están alineados. No hay alertas críticas de inventario."}</p><div className="heroButtons"><button onClick={() => setView("calendar")}>Abrir Command Center</button><button onClick={() => setView(channelMismatch ? "distribution" : "revenue")}>{channelMismatch ? "Resolver distribución" : "Ver revenue"}</button></div></div><div className="orb"><b>{occupancy}%</b><span>ocupación hoy</span><small>{availableNow} disponibles ahora</small></div></section><section className="metricRow">{(role === "owner" ? [["ADR", fmtMoney(adr), "+4,2%"], ["RevPAR", fmtMoney(revpar), "+6,8%"], ["Venta directa", `${directShare}%`, "mejor margen"], ["Distribución", channelMismatch ? "Revisar" : "Saludable", channelMismatch ? "1 diferencia" : "sin diferencias"]] : [["Llegadas", arrivalsToday.length, "hoy"], ["Salidas", departuresToday.length, "hoy"], ["Listas", rooms.filter(r => r.status === "clean").length, "habitaciones"], ["Alertas", channelMismatch ? 1 : 0, channelMismatch ? "distribución" : "sin críticas"]]).map(([label, value, detail]) => <article key={label} className="metric"><span>{label}</span><b>{value}</b><small>{detail}</small></article>)}</section><section className="card operationCard"><Header eyebrow="OPERACIÓN" title="El hotel de hoy" action="Ver calendario" onAction={() => setView("calendar")} /><div className="operationColumns"><OperationColumn title="Llegan" items={arrivalsToday} onSelect={setSelectedReservationId} /><OperationColumn title="Alojados" items={active} onSelect={setSelectedReservationId} /><OperationColumn title="Próximos" items={reservations.filter(r => r.start > TODAY).slice(0, 4)} onSelect={setSelectedReservationId} /></div></section><section className="card intelligenceCard"><Header eyebrow="LLENA INTELLIGENCE" title="Decisiones, no ruido" action="Abrir copiloto" onAction={() => document.querySelector(".aiFloat")?.click()} /><div className="insightList"><Insight number="01" title="Demanda en ascenso" text="El próximo fin de semana admite un aumento controlado en suites." action="Aplicar en Revenue" onClick={() => setView("revenue")} /><Insight number="02" title="Perfil duplicado detectado" text="Sofía Martínez aparece en dos fuentes con el mismo teléfono." action="Resolver perfil" onClick={() => setView("guests")} /><Insight number="03" title="Distribution Health" text={channelMismatch ? "Hay un canal con inventario distinto al PMS." : "Todos los canales activos coinciden con el PMS."} action="Abrir Distribution" onClick={() => setView("distribution")} /></div></section></div>
}

function CalendarView({ rooms, reservations, days, calendarStart, setCalendarStart, setSelectedReservationId, moveReservation, setNewReservation, setNewReservationOpen }) {
  return <div className="content"><section className="calendarIntro"><div><span className="eyebrow">ROOM DIARY</span><h2>El hotel completo, en una sola superficie.</h2><p>Arrastrá reservas para moverlas. Doble toque en un día libre para crear una. Abrí una reserva para extender, acortar, dividir o hacer check-in.</p></div><div className="dateControls"><button onClick={() => setCalendarStart(addDays(calendarStart, -7))}>← 7 días</button><button onClick={() => setCalendarStart(TODAY)}>Hoy</button><button onClick={() => setCalendarStart(addDays(calendarStart, 7))}>7 días →</button></div></section><section className="calendarCard"><div className="calendarScroller"><div className="calendarGrid" style={{ gridTemplateColumns: `180px repeat(${days.length}, minmax(94px, 1fr))` }}><div className="roomHead"><span>HABITACIÓN</span><small>tarifa base</small></div>{days.map(day => <div key={day} className={`dayHead ${day === TODAY ? "today" : ""}`}><b>{new Date(`${day}T12:00:00`).toLocaleDateString("es-AR", { weekday: "short" })}</b><span>{shortDate(day)}</span></div>)}{rooms.map(room => <div className="calendarRow" key={room.id} style={{ gridColumn: `1 / span ${days.length + 1}`, display: "grid", gridTemplateColumns: `180px repeat(${days.length}, minmax(94px, 1fr))` }}><div className="roomLabel"><div><b>{room.id}</b><span>{room.type}</span></div><small>{fmtMoney(room.rate)}</small>{room.status === "maintenance" && <em>OFF</em>}</div>{days.map(day => { const res = reservations.find(r => r.status !== "cancelled" && r.roomId === room.id && day >= r.start && day < addDays(r.start, r.nights)); const isStart = res?.start === day; return <div key={`${room.id}-${day}`} className={`dayCell ${room.status === "maintenance" ? "blocked" : ""}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) moveReservation(id, room.id, day) }} onDoubleClick={() => { if (!res && room.status !== "maintenance") { setNewReservation(v => ({ ...v, roomId: room.id, start: day })); setNewReservationOpen(true) } }}>{res && isStart && <button draggable className={`booking ${statusMeta(res.status)[1]}`} style={{ width: `calc(${Math.min(res.nights, days.length)} * 100% - 8px)` }} onDragStart={e => e.dataTransfer.setData("text/plain", res.id)} onClick={() => setSelectedReservationId(res.id)}><b>{res.guest}</b><span>{res.id} · {res.nights}n</span><small>{res.channel}</small></button>}</div>})}</div>)}</div></div></section></div>
}

function DistributionView({ channels, availableNow, channelMismatch, syncChannels, simulateChannelDrift, provider, setProvider, providerCode, setProviderCode, sandboxVerified, validateSandbox, aiDiscovery, setAiDiscovery }) {
  return <div className="content splitLayout"><section className="card wide"><Header eyebrow="LLENA DISTRIBUTION HUB" title="Inventario sincronizado, visible y reconciliable" action="Sincronizar ahora" onAction={syncChannels} /><div className={`healthBanner ${channelMismatch ? "warn" : "ok"}`}><div><b>{channelMismatch ? "Diferencia detectada" : "Distribución saludable"}</b><span>{channelMismatch ? "Un canal no coincide con el inventario del PMS." : `Todos los canales activos muestran ${availableNow} habitaciones disponibles.`}</span></div><strong>{channelMismatch ? "REVISAR" : "ALINEADO"}</strong></div><div className="channelTable"><div className="channelTableHead"><span>Canal</span><span>Inventario</span><span>Latencia</span><span>Estado</span><span>Modo</span></div>{channels.map(c => <div className="channelRow" key={c.id}><b>{c.name}</b><span>{c.inventory}</span><span>{c.latency}</span><span><i className={`healthDot ${c.status}`} />{c.status === "healthy" ? "Sincronizado" : c.status === "warning" ? "Diferencia" : "Standby"}</span><span className="modeTag">{c.mode === "native" ? "NATIVO" : "SANDBOX"}</span></div>)}</div><div className="testBar"><span>Herramienta de QA del preview: genera una diferencia controlada para probar la reconciliación.</span><button onClick={simulateChannelDrift}>Simular incidencia</button></div></section><section className="card"><Header eyebrow="CONECTOR" title="Arquitectura Channel Manager" /><label className="field"><span>Proveedor inicial</span><select value={provider} onChange={e => { setProvider(e.target.value); setSandboxVerified(false) }}><option>SiteMinder pmsXchange</option><option>Conexiones OTA directas</option><option>Cloudbeds Marketplace bridge</option></select></label><label className="field"><span>Código de propiedad sandbox</span><input value={providerCode} onChange={e => { setProviderCode(e.target.value); setSandboxVerified(false) }} placeholder="Ej. CASA-OLIVA-DEMO" /></label><button className="primary full" onClick={validateSandbox}>{sandboxVerified ? "✓ Sandbox validado" : "Validar mapeo sandbox"}</button><p className="fineprint">El preview valida nuestra capa de integración y mapeo. No afirma una conexión productiva sin credenciales y certificación del proveedor.</p></section><section className="card channelEconomics"><Header eyebrow="CHANNEL ECONOMICS" title="Rentabilidad real por canal" /><div className="profitRows">{channels.filter(c => c.bookings > 0).map(c => { const net = c.gross - c.commission; return <article key={c.id}><div><b>{c.name}</b><span>{c.bookings} reservas</span></div><div><strong>{fmtMoney(net)}</strong><small>neto · {c.gross ? Math.round((c.commission / c.gross) * 100) : 0}% costo</small></div></article> })}</div></section><section className="card"><Header eyebrow="AI DISTRIBUTION" title="Preparado para nuevos canales" /><p className="bodyCopy">Esta capa modela exposición de inventario para futuros agentes de viaje con IA. En preview controla el estado de publicación del catálogo, sin fingir acuerdos externos.</p><div className="toggleList">{[["chatgpt", "ChatGPT travel discovery"], ["claude", "Claude discovery"], ["gemini", "Gemini travel discovery"]].map(([id, label]) => <button key={id} className={aiDiscovery[id] ? "toggle on" : "toggle"} onClick={() => setAiDiscovery(v => ({ ...v, [id]: !v[id] }))}><span>{label}</span><i>{aiDiscovery[id] ? "Preparado" : "Oculto"}</i></button>)}</div></section></div>
}

function RevenueView({ rooms, reservations, adr, revpar, directShare, applyRate }) { const gross = reservations.filter(r => r.status !== "cancelled").reduce((s, r) => s + r.total, 0); return <div className="content"><section className="revenueHero"><div><span className="eyebrow">LLENA REVENUE BRAIN</span><h2>Precio con contexto, límites y explicación.</h2><p>Las recomendaciones operan sobre las tarifas del preview y se reflejan inmediatamente en nuevas reservas y en el Command Center.</p></div><div className="guardrail"><span>GUARDRAILS</span><b>Nunca vender por debajo del piso definido</b><small>Las automatizaciones de tarifa deben respetar mínimos y máximos por tipo.</small></div></section><section className="metricRow"><MetricCard label="ADR" value={fmtMoney(adr)} detail="tarifa media" /><MetricCard label="RevPAR" value={fmtMoney(revpar)} detail="por habitación disponible" /><MetricCard label="Venta directa" value={`${directShare}%`} detail="mix actual" /><MetricCard label="Ingresos agenda" value={fmtMoney(gross)} detail="reservas activas" /></section><section className="card"><Header eyebrow="RECOMENDACIONES" title="Decisiones explicables" /><div className="recommendations"><Recommendation title="Suites · próximo fin de semana" signal="Demanda alta · ocupación proyectada 82%" delta="+12%" reason="Ritmo de reservas por encima del promedio y menor disponibilidad relativa." onApply={() => applyRate("Suite", 12)} /><Recommendation title="Dobles · noches valle" signal="Demanda media · ventana de oportunidad" delta="-5%" reason="Conviene proteger ocupación entre semana sin comprometer el piso tarifario." onApply={() => applyRate("Doble", -5)} /><Recommendation title="Triples · evento cercano" signal="Demanda creciente · familias" delta="+8%" reason="Mayor intención para ocupación triple en las próximas fechas." onApply={() => applyRate("Triple", 8)} /></div></section><section className="card"><Header eyebrow="TARIFAS VIVAS" title="Base actual por habitación" /><div className="rateGrid">{rooms.map(room => <article key={room.id}><div><b>{room.id}</b><span>{room.type}</span></div><strong>{fmtMoney(room.rate)}</strong></article>)}</div></section></div> }
function GuestsView({ guests, setSelectedGuestId }) { return <div className="content"><section className="sectionIntro"><div><span className="eyebrow">GUEST GRAPH</span><h2>Una persona, una historia.</h2><p>El sistema consolida estadías, valor, preferencias y procedencia para que la hospitalidad no empiece de cero cada vez.</p></div><div className="privacyPill">Datos del preview · demo</div></section><section className="guestGrid">{guests.map(g => <button className={`guestCard ${g.duplicate ? "duplicate" : ""}`} key={g.id} onClick={() => setSelectedGuestId(g.id)}><div className="guestTop"><div className="avatar">{g.name.split(" ").slice(0, 2).map(x => x[0]).join("")}</div><div><b>{g.name}</b><span>{g.source}</span></div>{g.duplicate && <em>POSIBLE DUPLICADO</em>}</div><div className="guestStats"><span><b>{g.stays}</b><small>estadías</small></span><span><b>{g.nights}</b><small>noches</small></span><span><b>{fmtMoney(g.lifetime)}</b><small>lifetime</small></span></div><div className="tagRow">{(g.tags || []).slice(0, 3).map(t => <i key={t}>{t}</i>)}</div></button>)}</section></div> }
function HousekeepingView({ rows, advanceRoomStatus, setSelectedRoomId }) { return <div className="content"><section className="sectionIntro"><div><span className="eyebrow">HOUSEKEEPING INTELLIGENCE</span><h2>Limpiar por prioridad, no por intuición.</h2><p>Las habitaciones se ordenan por estado y cercanía de la próxima llegada.</p></div><div className="privacyPill">Prioridad recalculada en vivo</div></section><section className="card"><div className="hkList">{rows.map(({ room, next, current, priority }) => { const [label, tone] = roomStatusMeta(room.status); return <article key={room.id} className={`hkRow p${priority}`}><div className="priority"><span>{priority <= 2 ? "URGENTE" : priority === 3 ? "ALTA" : priority === 4 ? "TÉCNICA" : "NORMAL"}</span><b>{room.id}</b></div><div className="hkRoom"><b>{room.type}</b><span>{current ? `${current.guest} alojado` : "Sin huésped alojado"}</span></div><div className="hkNext"><small>PRÓXIMA LLEGADA</small><b>{next ? `${shortDate(next.start)} · ${next.guest}` : "Sin llegada próxima"}</b></div><div className={`statusChip ${tone}`}>{label}</div><div className="rowActions"><button onClick={() => setSelectedRoomId(room.id)}>Detalle</button><button className="dark" onClick={() => advanceRoomStatus(room.id)}>Avanzar estado</button></div></article> })}</div></section></div> }
function AutomationsView({ automations, toggleAutomation, automationDraft, setAutomationDraft, createAutomationFromText }) { return <div className="content splitLayout"><section className="card wide"><Header eyebrow="WORKFLOWS" title="Automatizaciones que entienden el hotel" /><div className="automationList">{automations.map(a => <article key={a.id}><button className={a.enabled ? "switch on" : "switch"} onClick={() => toggleAutomation(a.id)}><i /></button><div className="autoText"><b>{a.name}</b><span>CUANDO · {a.trigger}</span><p>ENTONCES · {a.action}</p></div><div className="runCount"><b>{a.runs}</b><small>ejecuciones</small></div></article>)}</div></section><section className="card"><Header eyebrow="NATURAL LANGUAGE" title="Describilo como se lo dirías a una persona" /><textarea value={automationDraft} onChange={e => setAutomationDraft(e.target.value)} placeholder="Ej.: Cada vez que vuelva un huésped que ya estuvo 3 veces, avisame y sugerí upgrade si hay una suite libre." rows={7} /><button className="primary full" onClick={createAutomationFromText}>✦ Crear automatización</button><p className="fineprint">En este preview el flujo queda persistido y administrable. La ejecución externa real requerirá conectar los eventos productivos correspondientes.</p></section></div> }
function TwinView({ rooms, reservations, setSelectedRoomId }) { const floors = Array.from(new Set(rooms.map(r => r.floor))); return <div className="content"><section className="sectionIntro"><div><span className="eyebrow">HOTEL DIGITAL TWIN</span><h2>El edificio convertido en una interfaz viva.</h2><p>Tocá cualquier habitación para ver quién está, qué viene y cuál es su estado operativo.</p></div><div className="legend"><span><i className="emerald" /> lista</span><span><i className="terracotta" /> sucia</span><span><i className="amber" /> inspección</span><span><i className="muted" /> mantenimiento</span></div></section><section className="twinBuilding">{floors.map(floor => <div className="floor" key={floor}><div className="floorName"><span>{floor}</span><small>{rooms.filter(r => r.floor === floor).length} unidades</small></div><div className="floorRooms">{rooms.filter(r => r.floor === floor).map(room => { const current = reservations.find(r => r.roomId === room.id && r.status === "inhouse" && r.start <= TODAY && addDays(r.start, r.nights) > TODAY); const next = reservations.filter(r => r.roomId === room.id && r.start > TODAY && r.status !== "cancelled").sort((a, b) => a.start.localeCompare(b.start))[0]; const [, tone] = roomStatusMeta(room.status); return <button key={room.id} className={`twinRoom ${tone}`} onClick={() => setSelectedRoomId(room.id)}><div><b>{room.id}</b><span>{room.type}</span></div><strong>{current ? current.guest : room.status === "maintenance" ? "Mantenimiento" : "Disponible"}</strong><small>{next ? `Próx. ${shortDate(next.start)} · ${next.guest}` : "Sin llegada próxima"}</small></button> })}</div></div>)}</section></div> }

function ReservationDrawer({ reservation, rooms, guests, onClose, setReservationStatus, resizeReservation, splitReservation, moveReservation }) { const guest = guests.find(g => g.id === reservation.guestId); const balance = Math.max(0, reservation.total - (reservation.paid || 0)); return <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><aside className="drawer"><button className="close" onClick={onClose}>×</button><span className="eyebrow">{reservation.id} · {reservation.channel}</span><h2>{reservation.guest}</h2><div className="drawerStay"><div><small>ESTADÍA</small><b>{shortDate(reservation.start)} → {shortDate(addDays(reservation.start, reservation.nights))}</b><span>{reservation.nights} noches · habitación {reservation.roomId}</span></div><div className={`statusChip ${statusMeta(reservation.status)[1]}`}>{statusMeta(reservation.status)[0]}</div></div><div className="drawerMetrics"><span><small>Total</small><b>{fmtMoney(reservation.total)}</b></span><span><small>Pagado</small><b>{fmtMoney(reservation.paid)}</b></span><span><small>Saldo</small><b>{fmtMoney(balance)}</b></span></div><div className="noteBox"><span>CONTEXTO DE HUÉSPED</span><p>{reservation.notes || "Sin notas."}</p>{guest && <small>{guest.stays} estadías previas · {fmtMoney(guest.lifetime)} lifetime</small>}</div><label className="field"><span>Cambiar habitación</span><select value={reservation.roomId} onChange={e => moveReservation(reservation.id, e.target.value, reservation.start)}>{rooms.map(r => <option key={r.id} value={r.id}>{r.id} · {r.type}{r.status === "maintenance" ? " · OFF" : ""}</option>)}</select></label><div className="drawerActions"><button onClick={() => resizeReservation(reservation.id, -1)}>− 1 noche</button><button onClick={() => resizeReservation(reservation.id, 1)}>＋ 1 noche</button><button onClick={() => splitReservation(reservation.id)}>Dividir estadía</button></div><div className="drawerActions strong">{reservation.status !== "inhouse" && <button onClick={() => setReservationStatus(reservation.id, "inhouse")}>Hacer check-in</button>}{reservation.status === "inhouse" && <button onClick={() => setReservationStatus(reservation.id, "checkout")}>Hacer check-out</button>}<button onClick={() => setReservationStatus(reservation.id, "cancelled")}>Cancelar reserva</button></div></aside></div> }
function GuestDrawer({ guest, reservations, onClose, mergeGuest }) { const history = reservations.filter(r => r.guestId === guest.id); return <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><aside className="drawer"><button className="close" onClick={onClose}>×</button><span className="eyebrow">GUEST GRAPH · {guest.id}</span><h2>{guest.name}</h2><p className="contact">{guest.email || "Sin email"}<br />{guest.phone || "Sin teléfono"}</p><div className="drawerMetrics"><span><small>Estadías</small><b>{guest.stays}</b></span><span><small>Noches</small><b>{guest.nights}</b></span><span><small>Lifetime</small><b>{fmtMoney(guest.lifetime)}</b></span></div><div className="tagRow large">{(guest.tags || []).map(t => <i key={t}>{t}</i>)}</div>{guest.duplicate && <div className="duplicateBox"><b>Posible identidad duplicada</b><p>Coinciden datos fuertes entre dos perfiles. Unificarlos conserva historial y evita atención fragmentada.</p><button className="primary full" onClick={() => mergeGuest(guest.id)}>Unificar perfil</button></div>}<div className="history"><span className="eyebrow">RESERVAS VINCULADAS</span>{history.length ? history.map(r => <article key={r.id}><b>{r.id} · Hab. {r.roomId}</b><span>{shortDate(r.start)} · {r.nights} noches · {r.channel}</span></article>) : <p>No hay reservas activas vinculadas en esta demo.</p>}</div></aside></div> }
function RoomDrawer({ room, reservations, onClose, advanceRoomStatus }) { const current = reservations.find(r => r.roomId === room.id && r.status === "inhouse" && r.start <= TODAY && addDays(r.start, r.nights) > TODAY); const upcoming = reservations.filter(r => r.roomId === room.id && r.start > TODAY && r.status !== "cancelled").sort((a, b) => a.start.localeCompare(b.start))[0]; return <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><aside className="drawer"><button className="close" onClick={onClose}>×</button><span className="eyebrow">DIGITAL TWIN · {room.floor}</span><h2>Habitación {room.id}</h2><div className={`bigRoomStatus ${roomStatusMeta(room.status)[1]}`}><b>{roomStatusMeta(room.status)[0]}</b><span>{room.type}</span></div><div className="noteBox"><span>AHORA</span><p>{current ? `${current.guest} · ${addDays(current.start, current.nights) === TODAY ? "sale hoy" : "alojado"}` : "Sin huésped alojado."}</p></div><div className="noteBox"><span>PRÓXIMA LLEGADA</span><p>{upcoming ? `${shortDate(upcoming.start)} · ${upcoming.guest}` : "Sin llegada próxima."}</p></div><button className="primary full" onClick={() => advanceRoomStatus(room.id)}>Avanzar estado operativo</button></aside></div> }
function NewReservationModal({ rooms, reservation, setReservation, onClose, onSubmit }) { const room = rooms.find(r => r.id === reservation.roomId); return <div className="overlay modalOverlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={onSubmit}><button type="button" className="close" onClick={onClose}>×</button><span className="eyebrow">NUEVA RESERVA</span><h2>Crear estadía</h2><div className="formGrid"><label className="field span2"><span>Huésped</span><input autoFocus value={reservation.guest} onChange={e => setReservation(v => ({ ...v, guest: e.target.value }))} placeholder="Nombre y apellido" /></label><label className="field"><span>Habitación</span><select value={reservation.roomId} onChange={e => setReservation(v => ({ ...v, roomId: e.target.value }))}>{rooms.map(r => <option key={r.id} value={r.id}>{r.id} · {r.type}{r.status === "maintenance" ? " · OFF" : ""}</option>)}</select></label><label className="field"><span>Entrada</span><input type="date" value={reservation.start} onChange={e => setReservation(v => ({ ...v, start: e.target.value }))} /></label><label className="field"><span>Noches</span><input type="number" min="1" max="30" value={reservation.nights} onChange={e => setReservation(v => ({ ...v, nights: e.target.value }))} /></label><label className="field"><span>Huéspedes</span><input type="number" min="1" max="8" value={reservation.pax} onChange={e => setReservation(v => ({ ...v, pax: e.target.value }))} /></label><label className="field span2"><span>Canal</span><select value={reservation.channel} onChange={e => setReservation(v => ({ ...v, channel: e.target.value }))}><option>Directa</option><option>Booking.com</option><option>Expedia</option><option>Airbnb</option><option>Instagram</option><option>WhatsApp</option></select></label></div><div className="estimate"><span>Estimado</span><b>{fmtMoney((room?.rate || 0) * Number(reservation.nights || 0))}</b></div><button className="primary full" type="submit">Crear reserva y recalcular disponibilidad</button></form></div> }
function AIPanel({ log, input, setInput, runAI, onClose }) { const examples = ["Subí 12% las suites", "Sincronizá los canales", "Mostrame revenue", "Abrí housekeeping"]; return <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><aside className="aiPanel"><button className="close" onClick={onClose}>×</button><div className="aiTitle"><div className="aiGlyph">✦</div><div><span>LLENA INTELLIGENCE</span><h2>Copiloto operativo</h2></div></div><div className="aiChat">{log.map((m, i) => <div key={i} className={`bubble ${m.side}`}>{m.text}</div>)}</div><div className="promptExamples">{examples.map(x => <button key={x} onClick={() => runAI(x)}>{x}</button>)}</div><form className="aiComposer" onSubmit={e => { e.preventDefault(); runAI(input) }}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Pedime una acción sobre el hotel..." /><button>↑</button></form><p className="fineprint">Este copiloto ejecuta acciones controladas dentro del estado del preview. Operaciones productivas requerirán permisos y auditoría.</p></aside></div> }

function Header({ eyebrow, title, action, onAction }) { return <div className="sectionHead"><div><span>{eyebrow}</span><h3>{title}</h3></div>{action && <button onClick={onAction}>{action} →</button>}</div> }
function MetricCard({ label, value, detail }) { return <article className="metric"><span>{label}</span><b>{value}</b><small>{detail}</small></article> }
function Insight({ number, title, text, action, onClick }) { return <article className="insight"><i>{number}</i><div><b>{title}</b><p>{text}</p></div><button onClick={onClick}>{action}</button></article> }
function Recommendation({ title, signal, delta, reason, onApply }) { return <article className="recommend"><div><span>{signal}</span><b>{title}</b><p>{reason}</p></div><strong>{delta}</strong><button onClick={onApply}>Aplicar</button></article> }
function OperationColumn({ title, items, onSelect }) { return <div className="opColumn"><div className="opTitle"><b>{title}</b><span>{items.length}</span></div>{items.length ? items.map(r => <button key={r.id} onClick={() => onSelect(r.id)}><div><b>{r.guest}</b><span>{r.id} · Hab. {r.roomId}</span></div><small>{shortDate(r.start)}</small></button>) : <p>Sin movimientos.</p>}</div> }

const styles = `
:root{--ink:#18251f;--forest:#17342a;--paper:#f4f0e7;--gold:#b38a4f;--emerald:#5c8b73;--amber:#c69a52;--terracotta:#b86d55;--muted:#8d938f;--line:rgba(24,37,31,.11);--shadow:0 24px 70px rgba(33,37,31,.10)}*{box-sizing:border-box}html,body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.osShell{min-height:100vh;background:radial-gradient(circle at 78% 10%,rgba(196,157,101,.12),transparent 34%),linear-gradient(135deg,#f6f2e9,#eee8dc)}button,input,select,textarea{font:inherit}button{cursor:pointer}.sidebar{position:fixed;inset:0 auto 0 0;width:252px;background:linear-gradient(180deg,#142f26,#19392e 58%,#102820);color:#f8f3e8;padding:28px 20px;display:flex;flex-direction:column;z-index:20;box-shadow:15px 0 50px rgba(20,47,38,.12)}.brand{display:flex;align-items:center;gap:12px;padding:0 6px 23px}.brandMark{width:40px;height:40px;border:1px solid rgba(238,215,176,.45);border-radius:13px;display:grid;place-items:center;font:600 13px Georgia,serif;letter-spacing:.11em;background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.03));box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}.brand b{display:block;font-family:Georgia,serif;font-size:16px;font-weight:500}.brand small{display:block;color:#aebdb5;font-size:10px;margin-top:4px;letter-spacing:.05em}.property{padding:15px 16px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);border-radius:17px;margin-bottom:22px;backdrop-filter:blur(12px)}.property span,.eyebrow{font-size:9px;letter-spacing:.16em;font-weight:800;color:#9b7c4f}.property b{display:block;margin:7px 0 4px;font-size:13px}.property small{color:#aebdb5;font-size:10px}.sidebar nav{display:flex;flex-direction:column;gap:4px;overflow:auto;padding-right:2px}.sidebar nav button{position:relative;border:0;background:transparent;color:#b8c3bd;text-align:left;padding:11px 12px;border-radius:12px;display:flex;align-items:center;gap:12px;font-size:12px}.sidebar nav button i{font-style:normal;width:18px;text-align:center;color:#d7c19c}.sidebar nav button.active{background:rgba(255,255,255,.09);color:#fff}.sidebar nav button:hover{background:rgba(255,255,255,.06);color:#fff}.sidebar nav button em{position:absolute;right:10px;width:7px;height:7px;border-radius:50%;background:#e19a6d;box-shadow:0 0 12px #e19a6d}.sidebarBottom{margin-top:auto;padding-top:18px}.roleSwitch{display:grid;grid-template-columns:1fr 1fr;background:rgba(0,0,0,.17);padding:3px;border-radius:11px}.roleSwitch button{border:0;background:transparent;color:#9eb0a6;padding:8px;border-radius:8px;font-size:10px}.roleSwitch .on{background:rgba(255,255,255,.11);color:#fff}.reset{width:100%;margin-top:10px;border:0;background:transparent;color:#81968b;font-size:10px;padding:8px}.workspace{margin-left:252px;min-height:100vh}.topbar{height:106px;padding:25px 38px 20px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line);background:rgba(247,243,235,.66);backdrop-filter:blur(18px);position:sticky;top:0;z-index:15}.heading span{font-size:9px;letter-spacing:.16em;font-weight:800;color:#9b7c4f}.heading h1{font-family:Georgia,"Times New Roman",serif;font-weight:500;font-size:27px;margin:5px 0 0}.topActions{display:flex;align-items:center;gap:8px}.search{width:270px;height:40px;display:flex;align-items:center;background:rgba(255,255,255,.58);border:1px solid var(--line);border-radius:13px;padding:0 12px;gap:7px}.search input{width:100%;border:0;outline:0;background:transparent;font-size:11px}.primary,.soft{border-radius:12px;padding:11px 14px;border:1px solid var(--line);font-size:11px;font-weight:700}.soft{background:rgba(255,255,255,.58);color:var(--forest)}.primary{background:var(--forest);color:white;border-color:var(--forest);box-shadow:0 8px 22px rgba(23,52,42,.16)}.full{width:100%}.content{padding:32px 38px 80px;max-width:1700px;margin:0 auto}.overviewGrid{display:grid;grid-template-columns:1.35fr .9fr;gap:18px}.heroPanel{grid-column:1/-1;min-height:248px;border-radius:26px;padding:34px 38px;background:linear-gradient(118deg,rgba(24,58,45,.98),rgba(33,72,58,.94));color:#fff;display:flex;justify-content:space-between;align-items:center;box-shadow:var(--shadow);overflow:hidden;position:relative}.heroPanel>div:first-child{max-width:720px;position:relative;z-index:1}.heroPanel .eyebrow{color:#d8bd91}.heroPanel h2,.revenueHero h2,.sectionIntro h2,.calendarIntro h2{font:500 37px/1.08 Georgia,serif;margin:10px 0 13px;letter-spacing:-.02em}.heroPanel p,.calendarIntro p,.sectionIntro p,.revenueHero p,.bodyCopy{color:#c7d0cb;font-size:13px;line-height:1.7;max-width:700px}.heroButtons{display:flex;gap:9px;margin-top:23px}.heroButtons button{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.09);color:#fff;border-radius:12px;padding:10px 14px}.heroButtons button:first-child{background:#f6f0e4;color:var(--forest)}.orb{width:168px;height:168px;border-radius:50%;border:1px solid rgba(228,207,170,.34);display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(255,255,255,.10),rgba(255,255,255,.02));position:relative;z-index:1}.orb b{font:500 41px Georgia,serif}.orb span{font-size:10px;color:#d9ddd9}.orb small{font-size:9px;color:#b8c5be;margin-top:7px}.metricRow{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{min-height:118px;border:1px solid var(--line);background:rgba(255,255,255,.54);border-radius:18px;padding:19px;display:flex;flex-direction:column;justify-content:center;box-shadow:0 10px 30px rgba(36,38,33,.04)}.metric span{font-size:10px;color:#6e746f}.metric b{font:500 25px Georgia,serif;margin:7px 0 4px}.metric small{font-size:9px;color:#929891}.card{background:rgba(255,255,255,.57);border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:0 13px 40px rgba(36,38,33,.045);backdrop-filter:blur(14px)}.sectionHead{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}.sectionHead span{font-size:9px;font-weight:800;letter-spacing:.14em;color:#a07948}.sectionHead h3{font:500 20px Georgia,serif;margin:5px 0 0}.sectionHead>button{border:0;background:transparent;color:#54665c;font-size:10px}.operationColumns{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.opColumn{background:#f5f1e8;border:1px solid rgba(24,37,31,.07);border-radius:15px;padding:12px;min-height:190px}.opTitle{display:flex;justify-content:space-between;padding:2px 3px 9px}.opTitle b{font-size:10px;text-transform:uppercase;letter-spacing:.08em}.opTitle span{font-size:9px;background:#e7e0d2;border-radius:999px;padding:2px 7px}.opColumn>button{width:100%;border:0;background:white;border-radius:11px;padding:10px;margin:4px 0;text-align:left;display:flex;justify-content:space-between;gap:8px;color:var(--ink)}.opColumn>button b{font-size:10px;display:block}.opColumn>button span,.opColumn>button small,.opColumn p{font-size:8px;color:#858c87}.opColumn p{padding:20px 4px}.insightList{display:flex;flex-direction:column}.insight{display:grid;grid-template-columns:30px 1fr auto;gap:12px;padding:15px 0;border-top:1px solid var(--line);align-items:center}.insight:first-child{border-top:0}.insight i{font:italic 13px Georgia,serif;color:#b18a57}.insight b{font-size:11px}.insight p{font-size:10px;color:#777f79;margin:4px 0;line-height:1.45}.insight button{border:0;background:#ece5d8;color:#43564b;border-radius:9px;padding:8px 10px;font-size:9px}.calendarIntro,.sectionIntro,.revenueHero{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}.calendarIntro h2,.sectionIntro h2,.revenueHero h2{color:var(--forest);font-size:32px}.calendarIntro p,.sectionIntro p,.revenueHero p{color:#69736d;margin:0}.dateControls{display:flex;gap:5px}.dateControls button{border:1px solid var(--line);background:rgba(255,255,255,.58);padding:9px 11px;border-radius:9px;font-size:9px}.calendarCard{background:#f8f5ef;border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:var(--shadow)}.calendarScroller{overflow:auto;max-height:calc(100vh - 230px)}.calendarGrid{min-width:1490px;display:grid}.roomHead,.dayHead{height:58px;position:sticky;top:0;background:#f2ede4;z-index:6;border-bottom:1px solid var(--line);border-right:1px solid var(--line);display:flex;flex-direction:column;justify-content:center;padding:0 12px}.roomHead{left:0;z-index:8}.roomHead span{font-size:8px;letter-spacing:.12em}.roomHead small,.dayHead span{font-size:8px;color:#7f867f;margin-top:3px}.dayHead{text-align:center;align-items:center}.dayHead b{font-size:9px;text-transform:uppercase}.dayHead.today{background:#e7eee8;color:#26503e}.calendarRow{min-height:70px}.roomLabel{position:sticky;left:0;z-index:5;background:#f5f1e9;border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:6px}.roomLabel b{font:500 16px Georgia,serif;display:block}.roomLabel span{font-size:8px;color:#737a75;display:block}.roomLabel small{font-size:8px;color:#987449}.roomLabel em{font-style:normal;font-size:7px;background:#ddd8cf;padding:3px 5px;border-radius:4px}.dayCell{position:relative;min-height:70px;border-right:1px solid rgba(24,37,31,.07);border-bottom:1px solid rgba(24,37,31,.07);background:rgba(255,255,255,.43)}.dayCell:hover{background:rgba(218,207,185,.2)}.dayCell.blocked{background:repeating-linear-gradient(135deg,#ece8e1,#ece8e1 7px,#e3ded5 7px,#e3ded5 14px)}.booking{position:absolute;left:4px;top:9px;height:51px;z-index:4;border:0;border-radius:10px;text-align:left;padding:8px 10px;overflow:hidden;box-shadow:0 5px 13px rgba(40,45,39,.12);color:#fff}.booking b,.booking span,.booking small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.booking b{font-size:9px}.booking span{font-size:8px;opacity:.86;margin-top:2px}.booking small{font-size:7px;opacity:.7;margin-top:2px}.booking.emerald{background:linear-gradient(135deg,#3f735b,#5a8d73)}.booking.gold{background:linear-gradient(135deg,#927342,#b28a4f)}.booking.amber{background:linear-gradient(135deg,#a96f40,#c38f52)}.booking.terracotta{background:#a96350}.booking.muted{background:#8e928f}.splitLayout{display:grid;grid-template-columns:1.5fr .8fr;gap:18px}.wide{grid-row:span 2}.healthBanner{display:flex;align-items:center;justify-content:space-between;border-radius:15px;padding:16px 18px;margin-bottom:18px}.healthBanner.ok{background:#e7efe9;color:#28523e}.healthBanner.warn{background:#f5e7dd;color:#874e39}.healthBanner b{display:block;font-size:12px}.healthBanner span{display:block;font-size:9px;margin-top:4px}.healthBanner strong{font-size:9px;letter-spacing:.12em}.channelTable{border:1px solid var(--line);border-radius:14px;overflow:hidden}.channelTableHead,.channelRow{display:grid;grid-template-columns:1.4fr .7fr .7fr 1fr .7fr;align-items:center;padding:11px 13px;border-bottom:1px solid var(--line);font-size:9px}.channelTableHead{background:#eee8dd;color:#737c76;font-size:8px}.channelRow:last-child{border-bottom:0}.channelRow b{font-size:10px}.channelRow span{display:flex;align-items:center;gap:5px}.healthDot{width:7px;height:7px;border-radius:50%;display:inline-block;background:#969c98}.healthDot.healthy{background:#62a17f}.healthDot.warning{background:#d4865d}.modeTag{font-size:7px!important;background:#eee8dd;width:max-content;padding:3px 6px;border-radius:5px}.testBar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;padding:12px 14px;border:1px dashed rgba(24,37,31,.16);border-radius:12px}.testBar span{font-size:9px;color:#777f79}.testBar button{border:0;background:#ece5d8;color:#44564b;border-radius:9px;padding:8px 10px;font-size:8px}.field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}.field span{font-size:8px;letter-spacing:.08em;color:#727b75;font-weight:700}.field input,.field select,textarea{width:100%;border:1px solid var(--line);background:#fbf8f2;border-radius:11px;padding:11px 12px;outline:0;color:var(--ink);font-size:10px}textarea{resize:vertical;line-height:1.5}.fineprint{font-size:8px!important;line-height:1.5;color:#8a918b!important;margin:12px 0 0}.profitRows article{display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-top:1px solid var(--line)}.profitRows article:first-child{border-top:0}.profitRows b,.profitRows strong{display:block;font-size:10px}.profitRows span,.profitRows small{display:block;font-size:8px;color:#7d857f;margin-top:3px}.profitRows strong{text-align:right;font:500 15px Georgia,serif}.toggleList{display:flex;flex-direction:column;gap:7px;margin-top:15px}.toggle{border:1px solid var(--line);background:#f2ede4;color:#59635d;border-radius:11px;padding:10px 11px;display:flex;justify-content:space-between;text-align:left;font-size:9px}.toggle i{font-style:normal;font-size:8px}.toggle.on{background:#e4eee7;color:#28523e}.guardrail{min-width:300px;background:#e8eee8;border:1px solid rgba(40,82,62,.10);padding:18px;border-radius:17px}.guardrail span{font-size:8px;letter-spacing:.12em;color:#47705b}.guardrail b{display:block;font-size:11px;margin:7px 0}.guardrail small{font-size:8px;color:#6e7d73}.recommendations{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.recommend{background:#f4efe6;border:1px solid var(--line);border-radius:16px;padding:17px;display:grid;grid-template-columns:1fr auto;gap:8px}.recommend div{grid-row:span 2}.recommend span{font-size:8px;color:#7b837d}.recommend b{display:block;font:500 15px Georgia,serif;margin:7px 0}.recommend p{font-size:9px;color:#747c76;line-height:1.5;margin:0}.recommend strong{font:500 20px Georgia,serif;color:#587763}.recommend button{border:0;background:var(--forest);color:#fff;border-radius:8px;padding:7px 9px;font-size:8px}.rateGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.rateGrid article{background:#f4efe6;border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;justify-content:space-between;align-items:center}.rateGrid b{display:block;font-size:10px}.rateGrid span{font-size:7px;color:#7c837e}.rateGrid strong{font:500 12px Georgia,serif}.privacyPill{background:#e9e3d8;border:1px solid var(--line);padding:9px 12px;border-radius:999px;font-size:8px;color:#68716b}.guestGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}.guestCard{border:1px solid var(--line);background:rgba(255,255,255,.57);border-radius:19px;padding:17px;text-align:left;color:var(--ink)}.guestCard.duplicate{border-color:rgba(184,109,85,.35)}.guestTop{display:flex;align-items:center;gap:10px}.avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#e5ded0;color:#5b695f;font:500 11px Georgia,serif}.guestTop b{display:block;font-size:11px}.guestTop span{display:block;font-size:8px;color:#828982;margin-top:3px}.guestTop em{margin-left:auto;font-style:normal;font-size:6px;color:#995a45;background:#f5e6df;padding:5px 6px;border-radius:6px}.guestStats{display:grid;grid-template-columns:1fr 1fr 1.4fr;margin:15px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:12px 0}.guestStats span{border-right:1px solid var(--line);padding-left:8px}.guestStats span:first-child{padding-left:0}.guestStats span:last-child{border-right:0}.guestStats b{display:block;font:500 14px Georgia,serif}.guestStats small{font-size:7px;color:#858c87}.tagRow{display:flex;gap:5px;flex-wrap:wrap}.tagRow i{font-style:normal;font-size:7px;padding:4px 7px;background:#eee8dd;border-radius:999px;color:#657068}.tagRow.large i{font-size:8px;padding:6px 9px}.hkList{display:flex;flex-direction:column}.hkRow{display:grid;grid-template-columns:100px 1fr 1.25fr 130px 190px;align-items:center;gap:12px;padding:13px 0;border-top:1px solid var(--line)}.hkRow:first-child{border-top:0}.priority span{display:block;font-size:6px;letter-spacing:.1em;color:#a06b50}.priority b{font:500 19px Georgia,serif}.hkRoom b,.hkNext b{display:block;font-size:9px}.hkRoom span,.hkNext small{font-size:7px;color:#838a84}.statusChip{width:max-content;border-radius:999px;padding:6px 9px;font-size:7px;font-weight:700}.statusChip.emerald,.bigRoomStatus.emerald{background:#e1eee6;color:#3d7058}.statusChip.terracotta,.bigRoomStatus.terracotta{background:#f3e1da;color:#935743}.statusChip.amber,.bigRoomStatus.amber{background:#f4ead8;color:#956c36}.statusChip.muted,.bigRoomStatus.muted{background:#e7e5e1;color:#6e7470}.statusChip.gold{background:#eee4d1;color:#8b6a39}.rowActions{display:flex;gap:6px}.rowActions button{border:1px solid var(--line);background:#f3eee5;border-radius:8px;padding:7px 8px;font-size:7px}.rowActions .dark{background:var(--forest);color:#fff}.automationList article{display:grid;grid-template-columns:42px 1fr 80px;gap:12px;align-items:center;padding:15px 0;border-top:1px solid var(--line)}.automationList article:first-child{border-top:0}.switch{width:34px;height:19px;border:0;border-radius:999px;background:#d8d5cf;padding:2px;display:flex}.switch i{width:15px;height:15px;background:white;border-radius:50%}.switch.on{background:#5f8b74;justify-content:flex-end}.autoText b{font-size:10px}.autoText span{display:block;font-size:7px;letter-spacing:.05em;color:#987449;margin-top:4px}.autoText p{font-size:8px;color:#767e78;margin:3px 0}.runCount{text-align:right}.runCount b{font:500 16px Georgia,serif;display:block}.runCount small{font-size:7px;color:#858c87}.legend{display:flex;gap:10px;flex-wrap:wrap}.legend span{font-size:8px;display:flex;align-items:center;gap:4px}.legend i{width:7px;height:7px;border-radius:50%;display:inline-block}.legend i.emerald{background:#5c8b73}.legend i.terracotta{background:#b86d55}.legend i.amber{background:#c69a52}.legend i.muted{background:#8d938f}.twinBuilding{display:flex;flex-direction:column;gap:14px}.floor{display:grid;grid-template-columns:130px 1fr;background:rgba(255,255,255,.5);border:1px solid var(--line);border-radius:20px;overflow:hidden}.floorName{background:#e9e3d8;padding:20px;display:flex;flex-direction:column;justify-content:center}.floorName span{font:500 17px Georgia,serif}.floorName small{font-size:7px;color:#7e857f;margin-top:5px}.floorRooms{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px}.twinRoom{min-height:125px;border:1px solid var(--line);background:#f6f2eb;border-radius:14px;padding:13px;text-align:left;color:var(--ink);display:flex;flex-direction:column;justify-content:space-between}.twinRoom.emerald{box-shadow:inset 0 3px 0 #6e9b82}.twinRoom.terracotta{box-shadow:inset 0 3px 0 #bd745d}.twinRoom.amber{box-shadow:inset 0 3px 0 #c9a264}.twinRoom.muted{box-shadow:inset 0 3px 0 #999d9a;background:#efede8}.twinRoom b{font:500 17px Georgia,serif}.twinRoom span{font-size:7px;color:#7b837d;margin-left:5px}.twinRoom strong{font-size:9px}.twinRoom small{font-size:7px;color:#868c87}.overlay{position:fixed;inset:0;background:rgba(16,31,25,.34);backdrop-filter:blur(5px);z-index:80}.drawer,.aiPanel{position:absolute;right:0;top:0;height:100%;width:min(460px,94vw);background:#f8f4ec;padding:34px;overflow:auto;box-shadow:-25px 0 70px rgba(20,37,30,.16)}.close{position:absolute;right:18px;top:16px;border:0;background:#ece7dd;width:30px;height:30px;border-radius:50%;font-size:19px;color:#5f6962}.drawer h2,.modal h2,.aiPanel h2{font:500 28px Georgia,serif;margin:7px 0 23px}.drawerStay{background:#e9eee8;border:1px solid rgba(40,82,62,.09);padding:16px;border-radius:15px;display:flex;justify-content:space-between;gap:10px}.drawerStay small,.noteBox span{font-size:7px;letter-spacing:.1em;color:#6e806f}.drawerStay b{display:block;font-size:11px;margin:5px 0}.drawerStay span{font-size:8px;color:#778079}.drawerMetrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.drawerMetrics span{background:#eee8dd;border-radius:12px;padding:12px}.drawerMetrics small{display:block;font-size:7px;color:#7e857f}.drawerMetrics b{display:block;font:500 13px Georgia,serif;margin-top:5px}.noteBox{border:1px solid var(--line);background:#f3eee6;padding:14px;border-radius:13px;margin:12px 0}.noteBox p{font-size:9px;line-height:1.5;margin:6px 0}.noteBox small{font-size:8px;color:#7d857f}.drawerActions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:10px 0}.drawerActions button{border:1px solid var(--line);background:#eee8dd;border-radius:9px;padding:9px;font-size:8px;color:#46554c}.drawerActions.strong button{background:var(--forest);color:white}.contact{font-size:10px;color:#758079;line-height:1.6}.duplicateBox{margin:18px 0;background:#f4e7df;border:1px solid rgba(184,109,85,.19);padding:16px;border-radius:14px}.duplicateBox b{font-size:10px}.duplicateBox p{font-size:9px;color:#7d665c;line-height:1.5}.history{margin-top:20px}.history article{padding:10px 0;border-top:1px solid var(--line)}.history article b{display:block;font-size:9px}.history article span{font-size:8px;color:#7f8781}.bigRoomStatus{padding:18px;border-radius:15px;margin-bottom:16px}.bigRoomStatus b{font:500 19px Georgia,serif;display:block}.bigRoomStatus span{font-size:9px}.modalOverlay{display:grid;place-items:center}.modal{position:relative;width:min(620px,92vw);background:#f8f4ec;border-radius:24px;padding:30px;box-shadow:var(--shadow)}.formGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.span2{grid-column:1/-1}.estimate{display:flex;justify-content:space-between;align-items:center;padding:14px 0 16px}.estimate span{font-size:9px;color:#7b837d}.estimate b{font:500 20px Georgia,serif}.aiFloat{position:fixed;right:22px;bottom:20px;z-index:30;border:1px solid rgba(255,255,255,.16);background:linear-gradient(135deg,#17342a,#274d3f);color:white;border-radius:17px;padding:11px 14px;display:flex;gap:9px;align-items:center;box-shadow:0 15px 40px rgba(20,52,41,.24)}.aiFloat>span{width:28px;height:28px;border-radius:9px;background:rgba(255,255,255,.09);display:grid;place-items:center;color:#dbc39a}.aiFloat b{display:block;font-size:9px}.aiFloat small{display:block;font-size:7px;color:#aebdb5;margin-top:2px}.aiPanel{width:min(510px,96vw);background:linear-gradient(180deg,#f8f4ec,#f2ede4)}.aiTitle{display:flex;gap:12px;align-items:center;margin-bottom:17px}.aiGlyph{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--forest);color:#d9bd8f}.aiTitle span{font-size:7px;letter-spacing:.15em;color:#9a7547}.aiTitle h2{margin:3px 0;font-size:23px}.aiChat{min-height:330px;max-height:55vh;overflow:auto;padding:8px 2px;display:flex;flex-direction:column;gap:8px}.bubble{max-width:86%;padding:11px 13px;border-radius:14px;font-size:9px;line-height:1.55}.bubble.system,.bubble.assistant{align-self:flex-start;background:#e8e2d7;color:#445149;border-bottom-left-radius:4px}.bubble.user{align-self:flex-end;background:var(--forest);color:#fff;border-bottom-right-radius:4px}.promptExamples{display:flex;gap:5px;flex-wrap:wrap;margin:11px 0}.promptExamples button{border:1px solid var(--line);background:#ebe5da;border-radius:999px;padding:6px 9px;font-size:7px}.aiComposer{display:grid;grid-template-columns:1fr 38px;gap:7px}.aiComposer input{border:1px solid var(--line);background:white;border-radius:12px;padding:12px;outline:0;font-size:10px}.aiComposer button{border:0;background:var(--forest);color:white;border-radius:11px}.toast{position:fixed;left:50%;bottom:25px;transform:translateX(-50%);z-index:120;background:#162f26;color:white;border-radius:999px;padding:10px 16px;font-size:9px}@media(max-width:1180px){.sidebar{width:210px}.workspace{margin-left:210px}.topbar{padding-left:25px;padding-right:25px}.content{padding-left:25px;padding-right:25px}.search{display:none}.overviewGrid,.splitLayout{grid-template-columns:1fr}.wide{grid-row:auto}.guestGrid{grid-template-columns:repeat(2,1fr)}.hkRow{grid-template-columns:80px 1fr 1fr 110px}.rowActions{grid-column:2/-1}.floorRooms{grid-template-columns:repeat(2,1fr)}}@media(max-width:820px){.sidebar{position:fixed;inset:auto 8px 8px 8px;width:auto;height:66px;border-radius:18px;padding:7px;flex-direction:row;align-items:center;z-index:50}.brand,.property,.sidebarBottom{display:none}.sidebar nav{flex:1;flex-direction:row;justify-content:space-around;overflow-x:auto;gap:2px}.sidebar nav button{min-width:48px;justify-content:center;padding:8px}.sidebar nav button i{font-size:15px}.sidebar nav button span{display:none}.workspace{margin-left:0;padding-bottom:74px}.topbar{height:auto;min-height:92px;padding:18px;align-items:flex-start}.content{padding:20px 14px 95px}.heroPanel{padding:25px}.heroPanel h2{font-size:29px}.orb{width:125px;height:125px;min-width:125px}.metricRow{grid-template-columns:1fr 1fr}.operationColumns{grid-template-columns:1fr}.overviewGrid{display:block}.overviewGrid>*{margin-bottom:14px}.calendarIntro,.sectionIntro,.revenueHero{align-items:flex-start;flex-direction:column}.recommendations{grid-template-columns:1fr}.rateGrid{grid-template-columns:1fr 1fr}.guestGrid{grid-template-columns:1fr}.hkRow{grid-template-columns:70px 1fr}.rowActions{grid-column:1/-1}.floor{grid-template-columns:1fr}.floorRooms{grid-template-columns:repeat(2,1fr)}.aiFloat{bottom:83px;right:14px}.toast{bottom:90px;max-width:90vw}.drawer,.aiPanel{padding:28px 20px}.formGrid{grid-template-columns:1fr}.span2{grid-column:auto}}@media(max-width:560px){.heading h1{font-size:19px}.primary{padding:10px;font-size:9px}.heroPanel{display:block}.orb{margin-top:22px}.metric{min-height:98px;padding:14px}.calendarIntro h2,.sectionIntro h2,.revenueHero h2{font-size:27px}.dateControls{width:100%}.dateControls button{flex:1}.drawerActions{grid-template-columns:1fr}.aiFloat div{display:none}.aiFloat{padding:10px;border-radius:50%}.aiFloat>span{background:transparent}.card{padding:18px}}
`
