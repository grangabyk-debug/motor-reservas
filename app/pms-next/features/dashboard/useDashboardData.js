"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "../../../../lib/supabase"
import usePmsAutoRefresh from "../../core/usePmsAutoRefresh"

const dateKey = (offset) => {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return date.toLocaleDateString("en-CA")
}
const localDayStartISO = (offset) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}
const localDateKey = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-CA")
}
const validPayment = (payment) => !["void", "cancelado", "anulado", "cancelled"].includes(String(payment.estado || "").toLowerCase())
const validReservation = (reservation) => !reservation.no_show && !["cancelada", "cancelado", "cancelled"].includes(String(reservation.estado || "").toLowerCase())
const roomIds = (item) => [...new Set([item.habitacion_id, ...(item.habitaciones_ids || [])].filter(Boolean).map(Number))]

export default function useDashboardData(propertyId) {
  const [rooms, setRooms] = useState([])
  const [reservations, setReservations] = useState([])
  const [bookingActivity, setBookingActivity] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [housekeeping, setHousekeeping] = useState([])
  const [paymentsToday, setPaymentsToday] = useState([])
  const [reservationPayments, setReservationPayments] = useState([])
  const [guestProfiles, setGuestProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    setError("")
    const yesterday = dateKey(-1)
    const today = dateKey(0)
    const tomorrow = dateKey(1)
    const dayAfter = dateKey(2)
    const pickupStart = localDayStartISO(-6)
    const pickupEnd = localDayStartISO(1)
    try {
      const [roomRes, resRes, pickupRes, maintRes, hkRes, payTodayRes] = await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,estado,activa").eq("property_id", propertyId).eq("activa", true),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show,precio_total,moneda,cantidad_huespedes,canal_reserva,hora_llegada_estimada,hora_salida_estimada,notas,guest_profile_id").eq("property_id", propertyId).lte("fecha_entrada", dayAfter).gte("fecha_salida", yesterday).neq("estado", "cancelada"),
        supabase.from("reservas").select("id,created_at,estado,no_show,canal_reserva").eq("property_id", propertyId).gte("created_at", pickupStart).lt("created_at", pickupEnd),
        supabase.from("hotel_maintenance_tickets").select("id,status,priority,due_at").eq("property_id", propertyId).not("status", "in", "(resolved,cancelled)"),
        supabase.from("hotel_housekeeping_tasks").select("id,status,checklist,scheduled_for").eq("property_id", propertyId).gte("scheduled_for", `${today}T00:00:00`).lt("scheduled_for", `${tomorrow}T00:00:00`),
        supabase.from("pagos").select("id,reserva_id,monto,refunded_amount,estado,moneda,created_at").eq("property_id", propertyId).gte("created_at", `${today}T00:00:00`).lt("created_at", `${tomorrow}T00:00:00`),
      ])
      for (const result of [roomRes, resRes, pickupRes, maintRes, hkRes, payTodayRes]) if (result.error) throw result.error

      const reservationRows = resRes.data || []
      const ids = reservationRows.map((row) => row.id)
      const profileIds = [...new Set(reservationRows.map((row) => row.guest_profile_id).filter(Boolean))]
      let allPayments = []
      let profiles = []
      if (ids.length) {
        const payRes = await supabase.from("pagos").select("id,reserva_id,monto,refunded_amount,estado,moneda").eq("property_id", propertyId).in("reserva_id", ids)
        if (payRes.error) throw payRes.error
        allPayments = payRes.data || []
      }
      if (profileIds.length) {
        const profileRes = await supabase.from("hotel_guest_profiles").select("id,vip_level,tags,language,preferences,notes").eq("property_id", propertyId).in("id", profileIds)
        if (profileRes.error) throw profileRes.error
        profiles = profileRes.data || []
      }

      setRooms(roomRes.data || [])
      setReservations(reservationRows)
      setBookingActivity((pickupRes.data || []).filter(validReservation))
      setMaintenance(maintRes.data || [])
      setHousekeeping(hkRes.data || [])
      setPaymentsToday(payTodayRes.data || [])
      setReservationPayments(allPayments)
      setGuestProfiles(profiles)
    } catch (err) {
      setError(err?.message || "No se pudo cargar la operación de recepción.")
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => { load() }, [load])
  usePmsAutoRefresh(propertyId, load, ["reservas", "pagos", "habitaciones", "hotel_housekeeping_tasks", "hotel_maintenance_tickets", "hotel_guest_profiles"])

  const paymentByReservation = useMemo(() => {
    const map = new Map()
    for (const payment of reservationPayments) {
      if (!validPayment(payment)) continue
      const id = Number(payment.reserva_id)
      const net = Math.max(0, Number(payment.monto || 0) - Number(payment.refunded_amount || 0))
      map.set(id, (map.get(id) || 0) + net)
    }
    return map
  }, [reservationPayments])

  const roomById = useMemo(() => new Map(rooms.map((room) => [Number(room.id), room])), [rooms])
  const profileById = useMemo(() => new Map(guestProfiles.map((profile) => [String(profile.id), profile])), [guestProfiles])
  const enrich = useCallback((item) => {
    const ids = roomIds(item)
    const assigned = ids.map((id) => roomById.get(id)).filter(Boolean)
    const paid = paymentByReservation.get(Number(item.id)) || 0
    const total = Number(item.precio_total) || 0
    const profile = item.guest_profile_id ? profileById.get(String(item.guest_profile_id)) : null
    return {
      ...item,
      rooms: assigned,
      roomNames: assigned.map((room) => room.nombre),
      roomDirty: assigned.some((room) => room.estado === "sucia"),
      roomMaintenance: assigned.some((room) => room.estado === "mantenimiento"),
      paid,
      balance: Math.max(0, total - paid),
      vipLevel: profile?.vip_level || "",
      guestTags: Array.isArray(profile?.tags) ? profile.tags : [],
      guestLanguage: profile?.language || "",
      guestPreferences: profile?.preferences || {},
      guestProfileNotes: profile?.notes || "",
    }
  }, [roomById, paymentByReservation, profileById])

  const operationsByOffset = useMemo(() => {
    const result = {}
    for (const offset of [-1, 0, 1]) {
      const day = dateKey(offset)
      const valid = reservations.filter(validReservation)
      const arrivals = valid.filter((r) => r.fecha_entrada === day).map(enrich)
      const departures = valid.filter((r) => r.fecha_salida === day).map(enrich)
      const inhouse = valid.filter((r) => r.fecha_entrada <= day && r.fecha_salida > day && r.estado !== "finalizada").map(enrich)
      result[offset] = { day, arrivals, inhouse, departures }
    }
    return result
  }, [reservations, enrich])

  const bookingInsights = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const offset = index - 6
      const key = dateKey(offset)
      const date = new Date(`${key}T12:00:00`)
      return {
        key,
        label: offset === 0 ? "Hoy" : new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(date).replace(".", ""),
        value: 0,
      }
    })
    const dayMap = new Map(days.map((day) => [day.key, day]))
    const channelMap = new Map()
    for (const reservation of bookingActivity) {
      const key = localDateKey(reservation.created_at)
      const day = dayMap.get(key)
      if (day) day.value += 1
      const channel = String(reservation.canal_reserva || "Directa").trim() || "Directa"
      channelMap.set(channel, (channelMap.get(channel) || 0) + 1)
    }
    const channels = [...channelMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    const total = bookingActivity.length
    return {
      days,
      channels: channels.map((item) => ({ ...item, pct: total ? Math.round((item.value / total) * 100) : 0 })),
      total,
      today: days[days.length - 1]?.value || 0,
      previousSix: days.slice(0, 6).reduce((sum, day) => sum + day.value, 0),
    }
  }, [bookingActivity])

  const metrics = useMemo(() => {
    const today = dateKey(0)
    const valid = reservations.filter(validReservation)
    const arrivals = valid.filter((r) => r.fecha_entrada === today).length
    const departures = valid.filter((r) => r.fecha_salida === today).length
    const occupiedIds = new Set()
    for (const reservation of valid.filter((r) => r.fecha_entrada <= today && r.fecha_salida > today && r.estado !== "finalizada")) roomIds(reservation).forEach((id) => occupiedIds.add(id))
    const inhouse = occupiedIds.size
    const occupancy = rooms.length ? Math.min(100, (inhouse / rooms.length) * 100) : 0
    let checkDone = 0
    let checkTotal = 0
    for (const task of housekeeping) {
      const list = Array.isArray(task.checklist) ? task.checklist : []
      if (list.length) {
        checkTotal += list.length
        checkDone += list.filter((item) => item?.done === true).length
      } else {
        checkTotal += 1
        if (task.status === "done") checkDone += 1
      }
    }
    const collected = paymentsToday.filter(validPayment).reduce((sum, payment) => sum + Math.max(0, Number(payment.monto || 0) - Number(payment.refunded_amount || 0)), 0)
    return {
      arrivals,
      departures,
      inhouse,
      occupancy,
      maintenance: maintenance.length,
      urgent: maintenance.filter((ticket) => ticket.priority === "urgent").length,
      checkDone,
      checkTotal,
      checkPct: checkTotal ? Math.round((checkDone / checkTotal) * 100) : 0,
      collected,
      dirty: rooms.filter((room) => room.estado === "sucia").length,
      ready: rooms.filter((room) => ["libre", "limpia", "inspeccionada"].includes(room.estado)).length,
      totalRooms: rooms.length,
    }
  }, [rooms, reservations, maintenance, housekeeping, paymentsToday])

  return { metrics, operationsByOffset, bookingInsights, loading, error, load }
}
