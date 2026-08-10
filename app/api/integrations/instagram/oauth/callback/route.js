import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const APP_SECRET =
  process.env.META_INSTAGRAM_APP_SECRET ||
  process.env.META_APP_SECRET

const APP_ID = process.env.META_APP_ID

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY

const GRAPH_VERSION = "v26.0"

function adminSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
      "Faltan las variables de Supabase del servidor."
    )
  }

  return createClient(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

function validarState(state) {
  if (!state || !APP_SECRET) {
    return null
  }

  const [body, signature] = String(state).split(".")

  if (!body || !signature) {
    return null
  }

  const esperado = createHmac(
    "sha256",
    APP_SECRET
  )
    .update(body)
    .digest("base64url")

  const left = Buffer.from(signature, "utf8")
  const right = Buffer.from(esperado, "utf8")

  if (
    left.length !== right.length ||
    !timingSafeEqual(left, right)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    )

    if (
      !payload?.user_id ||
      !payload?.property_id
    ) {
      return null
    }

    if (
      !payload?.exp ||
      Number(payload.exp) < Date.now()
    ) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

async function respuestaJson(response) {
  const data = await response
    .json()
    .catch(() => ({}))

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error_message ||
      `Meta respondió ${response.status}.`

    throw new Error(message)
  }

  return data
}

function redirect(request, params = {}) {
  const url = new URL(
    "/dashboard",
    request.url
  )

  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(
        key,
        String(value)
      )
    }
  }

  return NextResponse.redirect(url)
}

export async function GET(request) {
  const { searchParams } =
    new URL(request.url)

  const code = searchParams.get("code")
  const state = searchParams.get("state")

  const metaError =
    searchParams.get("error")

  const metaErrorDescription =
    searchParams.get("error_description")

  if (metaError) {
    return redirect(request, {
      instagram: "error",
      message:
        metaErrorDescription ||
        metaError,
    })
  }

  if (!code || !state) {
    return redirect(request, {
      instagram: "error",
      message:
        "Instagram no devolvió el código de autorización.",
    })
  }

  const stateData =
    validarState(state)

  if (!stateData) {
    return redirect(request, {
      instagram: "error",
      message:
        "La autorización de Instagram expiró o no es válida.",
    })
  }

  try {
    if (!APP_ID || !APP_SECRET) {
      throw new Error(
        "Faltan META_APP_ID o META_APP_SECRET en Vercel."
      )
    }

    /*
     * =========================================================
     * 1. URL DE CALLBACK
     * =========================================================
     */

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin

    const redirectUri =
      `${origin.replace(/\/$/, "")}/api/integrations/instagram/oauth/callback`

    /*
     * =========================================================
     * 2. INTERCAMBIAR CODE POR ACCESS TOKEN
     * =========================================================
     */

    const tokenForm =
      new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      })

    const shortTokenResponse =
      await fetch(
        "https://api.instagram.com/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body: tokenForm.toString(),
          cache: "no-store",
        }
      )

    const shortToken =
      await respuestaJson(
        shortTokenResponse
      )

    if (
      !shortToken?.access_token ||
      !shortToken?.user_id
    ) {
      throw new Error(
        "Instagram no devolvió un access token válido."
      )
    }

    /*
     * =========================================================
     * 3. OBTENER TOKEN DE LARGA DURACIÓN
     * =========================================================
     */

    const longTokenUrl =
      new URL(
        "https://graph.instagram.com/access_token"
      )

    longTokenUrl.searchParams.set(
      "grant_type",
      "ig_exchange_token"
    )

    longTokenUrl.searchParams.set(
      "client_secret",
      APP_SECRET
    )

    longTokenUrl.searchParams.set(
      "access_token",
      shortToken.access_token
    )

    const longTokenResponse =
      await fetch(
        longTokenUrl.toString(),
        {
          method: "GET",
          cache: "no-store",
        }
      )

    const longToken =
      await respuestaJson(
        longTokenResponse
      )

    const instagramAccessToken =
      longToken?.access_token ||
      shortToken.access_token

    const expiresIn = Number(
      longToken?.expires_in ||
      shortToken?.expires_in ||
      0
    )

    /*
     * =========================================================
     * 4. OBTENER LA CUENTA DE INSTAGRAM
     *
     * IMPORTANTE:
     * Usamos /me.
     * NO usamos /{user_id}.
     * =========================================================
     */

    const accountUrl =
      new URL(
        `https://graph.instagram.com/${GRAPH_VERSION}/me`
      )

    accountUrl.searchParams.set(
      "fields",
      [
        "id",
        "username",
        "name",
        "profile_picture_url",
        "account_type",
      ].join(",")
    )

    accountUrl.searchParams.set(
      "access_token",
      instagramAccessToken
    )

    const accountResponse =
      await fetch(
        accountUrl.toString(),
        {
          method: "GET",
          cache: "no-store",
        }
      )

    const account =
      await respuestaJson(
        accountResponse
      )

    if (!account?.id) {
      throw new Error(
        "Instagram no devolvió el ID de la cuenta."
      )
    }

    /*
     * =========================================================
     * 5. SUSCRIBIR LA CUENTA A LOS WEBHOOKS
     * =========================================================
     */

    const subscribeUrl =
      new URL(
        `https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(
          account.id
        )}/subscribed_apps`
      )

    subscribeUrl.searchParams.set(
      "subscribed_fields",
      "messages,messaging_postbacks"
    )

    subscribeUrl.searchParams.set(
      "access_token",
      instagramAccessToken
    )

    const subscribeResponse =
      await fetch(
        subscribeUrl.toString(),
        {
          method: "POST",
          cache: "no-store",
        }
      )

    const subscription =
      await subscribeResponse
        .json()
        .catch(() => ({}))

    if (!subscribeResponse.ok) {
      console.warn(
        "Instagram token guardado, pero no se pudo suscribir el webhook:",
        subscription
      )
    }

    /*
     * =========================================================
     * 6. GUARDAR CONEXIÓN EN SUPABASE
     * =========================================================
     */

    const db = adminSupabase()

    const expiresAt = expiresIn
      ? new Date(
          Date.now() +
            expiresIn * 1000
        ).toISOString()
      : null

    const metadata = {
      account_type:
        account?.account_type || null,

      name:
        account?.name || null,

      profile_picture_url:
        account?.profile_picture_url ||
        null,

      permissions:
        shortToken?.permissions ||
        null,

      webhook_subscription:
        subscription,
    }

    const {
      data: existing,
      error: existingError,
    } = await db
      .from("integration_connections")
      .select("id")
      .eq(
        "property_id",
        stateData.property_id
      )
      .eq(
        "provider",
        "instagram"
      )
      .eq(
        "external_account_id",
        String(account.id)
      )
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    const row = {
      property_id:
        stateData.property_id,

      provider:
        "instagram",

      external_account_id:
        String(account.id),

      external_username:
        account?.username || null,

      access_token:
        instagramAccessToken,

      token_expires_at:
        expiresAt,

      status:
        "connected",

      metadata,

      updated_at:
        new Date().toISOString(),
    }

    /*
     * =========================================================
     * 7. ACTUALIZAR O CREAR CONEXIÓN
     * =========================================================
     */

    if (existing?.id) {
      const { error } =
        await db
          .from(
            "integration_connections"
          )
          .update(row)
          .eq(
            "id",
            existing.id
          )

      if (error) {
        throw error
      }
    } else {
      const { error } =
        await db
          .from(
            "integration_connections"
          )
          .insert({
            ...row,
            created_at:
              new Date().toISOString(),
          })

      if (error) {
        throw error
      }
    }

    /*
     * =========================================================
     * 8. VOLVER AL DASHBOARD
     * =========================================================
     */

    return redirect(request, {
      instagram: "connected",
      username:
        account?.username || "",
    })

  } catch (error) {
    console.error(
      "Instagram OAuth callback error:",
      error
    )

    return redirect(request, {
      instagram: "error",
      message:
        error?.message ||
        "No se pudo completar la conexión con Instagram.",
    })
  }
}
