"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "../../lib/supabase"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [tipoMensaje, setTipoMensaje] = useState("")
  const [cargando, setCargando] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const [sesionValida, setSesionValida] = useState(false)

  useEffect(() => {
    let activo = true

    const procesarRecuperacion = async () => {
      const { data } = await supabase.auth.getSession()

      if (data?.session) {
        if (activo) {
          setSesionValida(true)
          setVerificando(false)
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Evento de autenticación:", event)

      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN"
      ) {
        if (session && activo) {
          setSesionValida(true)
          setVerificando(false)
        }
      }
    })

    procesarRecuperacion()

    const timeout = setTimeout(async () => {
      if (!activo) return

      const { data } = await supabase.auth.getSession()

      if (data?.session) {
        setSesionValida(true)
      } else {
        setSesionValida(false)
        setMensaje(
          "El enlace de recuperación no es válido o ya venció. Solicitá un nuevo enlace desde el inicio de sesión."
        )
        setTipoMensaje("error")
      }

      setVerificando(false)
    }, 1500)

    return () => {
      activo = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function cambiarPassword(e) {
    e.preventDefault()

    setMensaje("")
    setTipoMensaje("")

    if (password.length < 6) {
      setMensaje("La contraseña debe tener al menos 6 caracteres.")
      setTipoMensaje("error")
      return
    }

    if (password !== confirmPassword) {
      setMensaje("Las contraseñas no coinciden.")
      setTipoMensaje("error")
      return
    }

    setCargando(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      console.error("Error al cambiar contraseña:", error)

      setMensaje(error.message)
      setTipoMensaje("error")
      setCargando(false)
      return
    }

    setMensaje("Contraseña actualizada correctamente.")
    setTipoMensaje("success")
    setCargando(false)

    await supabase.auth.signOut()
  }

  if (verificando) {
    return (
      <main style={page}>
        <div style={card}>
          <Link href="/" style={brand}>
            Habitación Llena
          </Link>

          <h1 style={title}>Verificando enlace</h1>

          <p style={muted}>
            Estamos verificando tu enlace de recuperación...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={page}>
      <div style={card}>
        <Link href="/" style={brand}>
          Habitación Llena
        </Link>

        <h1 style={title}>Nueva contraseña</h1>

        {sesionValida ? (
          <>
            <p style={muted}>
              Elegí una nueva contraseña para acceder a tu cuenta.
            </p>

            <form
              onSubmit={cambiarPassword}
              style={form}
            >
              <label style={label}>
                Nueva contraseña

                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={input}
                />
              </label>

              <label style={label}>
                Repetir contraseña

                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="Repetí tu contraseña"
                  style={input}
                />
              </label>

              {mensaje && (
                <div
                  style={
                    tipoMensaje === "success"
                      ? success
                      : error
                  }
                >
                  {mensaje}
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                style={{
                  ...button,
                  opacity: cargando ? 0.7 : 1,
                  cursor: cargando
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {cargando
                  ? "Guardando..."
                  : "Cambiar contraseña"}
              </button>
            </form>
          </>
        ) : (
          <>
            {mensaje && (
              <div style={error}>
                {mensaje}
              </div>
            )}

            <Link href="/login" style={buttonLink}>
              Volver a iniciar sesión
            </Link>
          </>
        )}

        <p style={bottom}>
          ¿Recordaste tu contraseña?{" "}
          <Link href="/login" style={link}>
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  )
}

const page = {
  minHeight: "100vh",
  background: "#f5f7fa",
  display: "grid",
  placeItems: "center",
  padding: 20,
  fontFamily: "Inter, system-ui, sans-serif",
}

const card = {
  width: "min(420px, 100%)",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 32,
  boxShadow: "0 20px 50px rgba(0,40,100,.08)",
}

const brand = {
  color: "#003b95",
  fontWeight: 850,
  fontSize: 22,
  textDecoration: "none",
}

const title = {
  fontSize: 30,
  margin: "32px 0 6px",
}

const muted = {
  color: "#6b7280",
  margin: 0,
  lineHeight: 1.6,
}

const form = {
  display: "grid",
  gap: 16,
  marginTop: 26,
}

const label = {
  display: "grid",
  gap: 7,
  fontSize: 13,
  fontWeight: 700,
}

const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  border: "1px solid #dfe4ea",
  borderRadius: 8,
  fontSize: 14,
}

const button = {
  border: "none",
  background: "#006ce4",
  color: "#fff",
  borderRadius: 8,
  padding: 13,
  fontWeight: 800,
  fontSize: 14,
}

const buttonLink = {
  display: "block",
  textAlign: "center",
  background: "#006ce4",
  color: "#fff",
  borderRadius: 8,
  padding: 13,
  fontWeight: 800,
  fontSize: 14,
  textDecoration: "none",
  marginTop: 24,
}

const error = {
  background: "#fff0f0",
  color: "#b42318",
  padding: 12,
  borderRadius: 8,
  fontSize: 13,
  lineHeight: 1.5,
}

const success = {
  background: "#e8f7f0",
  color: "#087443",
  padding: 12,
  borderRadius: 8,
  fontSize: 13,
  lineHeight: 1.5,
}

const bottom = {
  textAlign: "center",
  color: "#6b7280",
  fontSize: 13,
  marginTop: 22,
}

const link = {
  color: "#006ce4",
  fontWeight: 800,
}
