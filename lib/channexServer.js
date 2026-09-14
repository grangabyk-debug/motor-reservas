import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

export const CHANNEX_CHANNELS = ["BDC", "ABB", "EXP", "DDC", "AGO"]

export function channexBaseUrl() {
  const explicit = String(process.env.CHANNEX_BASE_URL || "").trim().replace(/\/$/, "")
  if (explicit) return explicit
  return String(process.env.CHANNEX_ENV || "staging").toLowerCase() === "production"
    ? "https://app.channex.io"
    : "https://staging.channex.io"
}

export function channexMode() {
  return channexBaseUrl().includes("staging.channex.io") ? "staging" : "live"
}

export function adminSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Faltan las variables de Supabase del servidor.")
  }
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function requirePropertyRole(request, propertyId, roles = ["owner", "manager"]) {
  const authorization = request.headers.get("authorization") || ""
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!accessToken) {
    const error = new Error("Sesión no autorizada.")
    error.status = 401
    throw error
  }

  const db = adminSupabase()
  const { data: { user }, error: userError } = await db.auth.getUser(accessToken)
  if (userError || !user) {
    const error = new Error("Sesión inválida.")
    error.status = 401
    throw error
  }

  const { data: property, error: propertyError } = await db
    .from("properties")
    .select("id,owner_id,name,city")
    .eq("id", propertyId)
    .maybeSingle()
  if (propertyError) throw propertyError
  if (!property) {
    const error = new Error("Propiedad inexistente.")
    error.status = 404
    throw error
  }

  let role = property.owner_id === user.id ? "owner" : null
  if (!role) {
    const { data: member, error: memberError } = await db
      .from("property_members")
      .select("role")
      .eq("property_id", propertyId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (memberError) throw memberError
    role = member?.role || null
  }

  if (!role || (roles.length && !roles.includes(role))) {
    const error = new Error("No tenés permisos para administrar el Channel Hub de esta propiedad.")
    error.status = 403
    throw error
  }

  return { db, user, role, property }
}

export async function channexRequest(path, options = {}) {
  const apiKey = String(process.env.CHANNEX_API_KEY || "").trim()
  if (!apiKey) {
    const error = new Error("Falta configurar CHANNEX_API_KEY en Vercel para activar el Channel Hub.")
    error.status = 503
    error.code = "channex_not_configured"
    throw error
  }

  const response = await fetch(`${channexBaseUrl()}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "user-api-key": apiKey,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.errors) {
    const title = payload?.errors?.title || payload?.errors?.code || `Channex respondió ${response.status}`
    const details = payload?.errors?.details
    const detailText = details ? ` · ${typeof details === "string" ? details : JSON.stringify(details)}` : ""
    const error = new Error(`${title}${detailText}`)
    error.status = response.status || 502
    throw error
  }
  return payload
}
