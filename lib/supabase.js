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

// The assistant API is protected server-side. The browser Supabase client
// stores the session locally, so attach the current access token only to
// calls made to that protected endpoint.
if (typeof window !== "undefined" && !window.__hlAssistantAuthFetchInstalled) {
  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || ""

    if (url.includes("/api/assistant") && !init.headers?.Authorization) {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.access_token) {
        const headers = new Headers(init.headers || {})
        headers.set("Authorization", `Bearer ${session.access_token}`)
        return nativeFetch(input, { ...init, headers })
      }
    }

    return nativeFetch(input, init)
  }

  window.__hlAssistantAuthFetchInstalled = true
}
