import { createHmac, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const APP_SECRET =
  process.env.META_INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET
const APP_ID = process.env.META_APP_ID
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

function adminSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Faltan las variables de Supabase del servidor.")
  }

  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function firmarState(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = createHmac("sha256", APP_SECRET)
    .update(body)
    .digest("base64url")

  return `${body}.${signature}`
}

export async function POST(request) {
  try {
    if (!APP_ID || !APP_SECRET) {
      return NextResponse.json(
        { error: "Faltan META_APP_ID o META_APP_SECRET en Vercel." },
        { status: 500 }
      )
    }

    const authorization = request.headers.get("authorization") || ""
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : ""

    if (!accessToken) {
      return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 })
    }

    const db = adminSupabase()
    const {
      data: { user },
      error: userError,
    } = await db.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json({ error: "Sesión inválida." }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const propertyId = body?.property_id

    if (!propertyId) {
      return NextResponse.json(
        { error: "Falta property_id." },
        { status: 400 }
      )
    }

    const state = firmarState({
      user_id: String(user.id),
      property_id: String(propertyId),
      exp: Date.now() + 10 * 60 * 1000,
      nonce: randomUUID(),
    })

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin

    const redirectUri =
      `${origin.replace(/\/$/, "")}/api/integrations/instagram/oauth/callback`

    const params = new URLSearchParams({
      enable_fb_login: "0",
      force_authentication: "1",
      client_id: APP_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "instagram_business_basic,instagram_business_manage_messages",
      state,
    })

    return NextResponse.json({
      authorization_url: `https://www.instagram.com/oauth/authorize?${params.toString()}`,
      redirect_uri: redirectUri,
    })
  } catch (error) {
    console.error("Instagram OAuth start error:", error)

    return NextResponse.json(
      { error: error?.message || "No se pudo iniciar Instagram." },
      { status: 500 }
    )
  }
}
