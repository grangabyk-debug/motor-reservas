"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "../../lib/supabase"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const [listo, setListo] = useState(false)
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    async function verificarSesion() {
      const { data } = await supabase.auth.getSession()

      if (!data?.session) {
        setError(
          "El enlace de recuperación no es válido o ya venció. Solicitá un nuevo enlace."
        )
      }

      setVerificando(false)
    }

    verificarSesion()
  }, [])

  async function cambiarPassword(e) {
    e.preventDefault()

    setMensaje("")
    setError("")

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setCargando(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      console.error("Error al cambiar contraseña:", error)
      setError(error.message)
      setCargando(false)
      return
    }

    setMensaje("Contraseña actualizada correctamente.")
    setListo(true)
    setCargando(false)

    await supabase.auth.signOut()
  }

  if (verificando) {
    return (
      <main style={page}>
        <div style={card}>
          <div style={brand}>Habitación Llena</div>
          <h1 style={title}>Verificando enlace</h1>
          <p style={muted}>
            Estamos comprobando tu enlace de recuperación...
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

        {!listo ? (
          <>
            <p style={muted}>
              Elegí una nueva contraseña para acceder a tu cuenta.
            </p>

            <form
              onSubmit={cambiarPassword}
              style={{
                display: "grid",
                gap: 16,
                marginTop: 26,
              }}
            >
              <label style={label}>
                Nueva contraseña
                <input
                  type="password"
                  required
                  minLength={6}
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetí tu contraseña"
                  style={input}
                />
              </label>

              {error && <div style={errorBox}>{error}</div>}

              <button
                type="submit"
                disabled={cargando || !!error}
                style={{
                  ...button,
                  opacity: cargando || error ? 0.7 : 1,
                  cursor: cargando || error ? "not-allowed" : "pointer",
                }}
              >
                {cargando ? "Guardando..." : "Cambiar contraseña"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={successBox}>
              {mensaje}
            </div>

            <p style={muted}>
              Ya podés ingresar a tu cuenta con tu nueva contraseña.
            </p>

            <Link href="/login" style={buttonLink}>
              Ir a iniciar sesión
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

const label = {
  display: "grid",
  gap: 7,
  fontSize: 13,
  fontWeight: 700,
}

const input = {
  padding: "12px 13px",
  border: "1px solid #dfe4ea",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
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

const errorBox = {
  background: "#fff0f0",
  color: "#b42318",
  padding: 11,
  borderRadius: 8,
  fontSize: 13,
}

const successBox = {
  background: "#e8f7f0",
  color: "#00875a",
  padding: 14,
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 700,
  marginTop: 24,
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
