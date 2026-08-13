import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

// En previews donde las variables públicas de Supabase no están disponibles,
// evitamos crear el cliente durante el build. El cliente real se mantiene
// exactamente igual cuando las variables sí existen.
export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : new Proxy(
        {},
        {
          get() {
            throw new Error("Supabase no está configurado en este entorno.")
          },
        }
      )

// Protege el endpoint de IA y evita que el polling histórico de la bandeja de
// Instagram martille Vercel/Supabase cuando la respuesta acaba de consultarse.
if (typeof window !== "undefined" && !window.__hlAssistantAuthFetchInstalled) {
  const nativeFetch = window.fetch.bind(window)
  let instagramInboxCache = null

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || ""
    const method = String(init.method || input?.method || "GET").toUpperCase()
    const sourceHeaders = init.headers || input?.headers || {}
    const requestHeaders = new Headers(sourceHeaders)
    const isInstagramInbox = url.includes("/api/integrations/instagram/webhook")

    if (isInstagramInbox && method === "POST") {
      instagramInboxCache = null
    }

    if (isInstagramInbox && method === "GET") {
      const authorization = requestHeaders.get("Authorization") || ""
      const cacheKey = `${url}|${authorization.slice(-32)}`
      const ttl = document.visibilityState === "hidden" ? 60000 : 10000
      if (
        instagramInboxCache &&
        instagramInboxCache.key === cacheKey &&
        Date.now() - instagramInboxCache.at < ttl
      ) {
        return instagramInboxCache.response.clone()
      }
      const response = await nativeFetch(input, init)
      if (response.ok) {
        instagramInboxCache = {
          key: cacheKey,
          at: Date.now(),
          response: response.clone(),
        }
      }
      return response
    }

    if (url.includes("/api/assistant") && !requestHeaders.has("Authorization")) {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.access_token) {
        const headers = new Headers(sourceHeaders)
        headers.set("Authorization", `Bearer ${session.access_token}`)
        return nativeFetch(input, { ...init, headers })
      }
    }

    return nativeFetch(input, init)
  }

  window.__hlAssistantAuthFetchInstalled = true
}
