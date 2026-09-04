"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "../../../lib/supabase"
import { createHotelRepository } from "../data/hotelRepository"
import { groupForView } from "../core/navigation"
import { expireTentativeReservations } from "../services/tentatives"

const empty = {
  rooms: [],
  floors: [],
  reservations: [],
  payments: [],
  blocks: [],
  charges: [],
  channels: [],
  keyIssues: [],
  packages: [],
  reservationEvents: [],
  automationEvents: [],
  inboxConversations: [],
  housekeepingTasks: [],
  maintenanceTickets: [],
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function withRetry(fn, attempts = 2) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < attempts - 1) await wait(220 * (attempt + 1))
    }
  }
  throw lastError
}

async function loadActiveResources(propertyId) {
  const result = await supabase
    .from("hotel_resources")
    .select("*")
    .eq("property_id", propertyId)
    .eq("active", true)
    .order("category")
    .order("name")

  if (result.error) throw result.error
  return result.data || []
}

export function useHotelData(propertyId, view) {
  const [core, setCore] = useState(empty)
  const [settings, setSettings] = useState(null)
  const [guests, setGuests] = useState([])
  const [operations, setOperations] = useState({ housekeeping: [], maintenance: [], resources: [] })
  const [commercial, setCommercial] = useState({ rates: [], upsells: [], packages: [], partners: [], groups: [] })
  const [finance, setFinance] = useState({ documents: [], sessions: [], movements: [] })
  const [hotel, setHotel] = useState({ members: [], automations: [], events: [], permissions: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const seq = useRef(0)
  const group = groupForView(view).id
  const quoteMode = view === "quote"

  const reload = useCallback(async () => {
    if (!propertyId) return

    const run = ++seq.current
    setLoading(true)
    setError("")

    try {
      await withRetry(() => expireTentativeReservations({ propertyId }), 2).catch(() => [])

      const repo = createHotelRepository(supabase, propertyId)
      const [base, setting] = await Promise.all([
        withRetry(() => repo.frontDeskSnapshot(), 2),
        withRetry(async () => {
          const result = await supabase
            .from("hotel_os_settings")
            .select("*")
            .eq("property_id", propertyId)
            .maybeSingle()
          if (result.error) throw result.error
          return result
        }, 2),
      ])

      if (run !== seq.current) return

      setCore(base)
      setSettings(
        setting.data || {
          property_id: propertyId,
          hotel_name: "Habitación Llena",
          theme: "olive",
          operational_settings: {},
        }
      )

      if (quoteMode) {
        const resources = await withRetry(() => loadActiveResources(propertyId), 3)
        if (run === seq.current) setOperations((current) => ({ ...current, resources }))
      } else if (group === "frontdesk") {
        const [g, p, groups] = await Promise.all([
          withRetry(() => repo.guestCRM(), 2),
          withRetry(() => repo.partners(), 2),
          withRetry(() => repo.groups(), 2),
        ])
        if (run === seq.current) {
          setGuests(g)
          setCommercial((current) => ({ ...current, packages: base.packages || [], partners: p, groups }))
          setOperations((current) => ({
            ...current,
            housekeeping: base.housekeepingTasks || [],
            maintenance: base.maintenanceTickets || [],
          }))
        }
      }

      if (group === "operations") {
        const o = await withRetry(() => repo.operations(), 2)
        if (run === seq.current) setOperations(o)
      }

      if (group === "commercial") {
        const [c, p, groups] = await Promise.all([
          withRetry(() => repo.commercial(), 2),
          withRetry(() => repo.partners(), 2),
          withRetry(() => repo.groups(), 2),
        ])
        if (run === seq.current) setCommercial({ ...c, partners: p, groups })
      }

      if (group === "finance") {
        const [f, p, groups, o] = await Promise.all([
          withRetry(() => repo.finance(), 2),
          withRetry(() => repo.partners(), 2),
          withRetry(() => repo.groups(), 2),
          withRetry(() => repo.operations(), 2),
        ])
        if (run === seq.current) {
          setFinance(f)
          setCommercial((current) => ({ ...current, packages: base.packages || [], partners: p, groups }))
          setOperations(o)
        }
      }

      if (group === "hotel") {
        const [members, automations, events, permissions] = await Promise.all([
          supabase.from("property_members").select("user_id,role,created_at").eq("property_id", propertyId),
          supabase.from("hotel_automations").select("*").eq("property_id", propertyId).order("created_at"),
          supabase
            .from("hotel_automation_events")
            .select("*")
            .eq("property_id", propertyId)
            .order("created_at", { ascending: false })
            .limit(100),
          supabase.from("hotel_role_permissions").select("*").eq("property_id", propertyId),
        ])
        const memberRows = members.data || []
        const ids = memberRows.map((member) => member.user_id)
        const profiles = ids.length
          ? (await supabase.from("profiles").select("id,full_name,role").in("id", ids)).data || []
          : []
        if (run === seq.current) {
          setHotel({
            members: memberRows.map((member) => ({
              ...member,
              profile: profiles.find((profile) => profile.id === member.user_id) || null,
            })),
            automations: automations.data || [],
            events: events.data || [],
            permissions: permissions.data || [],
          })
        }
      }
    } catch (loadError) {
      if (run === seq.current) {
        const raw = String(loadError?.message || "")
        setError(
          /failed to fetch|networkerror|network request failed/i.test(raw)
            ? "No pudimos sincronizar algunos datos. Reintentando conexión…"
            : raw || "No pudimos cargar el hotel."
        )
      }
    } finally {
      if (run === seq.current) setLoading(false)
    }
  }, [propertyId, group, quoteMode])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (!propertyId) return
    const timer = setInterval(() => { expireTentativeReservations({ propertyId }).catch(() => {}) }, 60000)
    return () => clearInterval(timer)
  }, [propertyId])

  useEffect(() => {
    if (!propertyId) return
    const filter = `property_id=eq.${propertyId}`
    const channel = supabase
      .channel(`hl-v2-${propertyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "habitaciones", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "pagos", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "hotel_packages", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "hotel_reservation_events", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "hotel_automation_events", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_conversations", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "hotel_housekeeping_tasks", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "hotel_maintenance_tickets", filter }, reload)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [propertyId, reload])

  return { ...core, settings, guests, operations, commercial, finance, hotel, loading, error, reload }
}
