"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "../../lib/supabase"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    let activo = true

    async function comprobarSesion() {
      const { data } = await supabase.auth.getUser()

      if (activo && data?.user) {
        window.location.href = "/dashboard"
      }
    }

    comprobarSesion()

    return () => {
      activo = false
    }
  }, [])

  async function ingresar(e) {
    e.preventDefault()
    setMensaje("")
    setCargando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      console.error("Error de inicio de sesión:", error)

      setMensaje(
        error.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos."
          : error.message
      )
      setCargando(false)
      return
    }

    window.location.href = "/dashboard"
  }

  return (
    <main style={page}>
      <div style={card}>
        <Link href="/" style={brand}>
          Habitación Llena
        </Link>

        <h1 style={title}>Ingresar</h1>
        <p style={muted}>Entrá a tu panel de gestión.</p>

        <form onSubmit={ingresar} style={form}>
          <label style={label}>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              style={input}
            />
          </label>

          <label style={label}>
            Contraseña
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              style={input}
            />
          </label>

          {mensaje && <div style={error}>{mensaje}</div>}

          <button
            type="submit"
            disabled={cargando}
            style={{
              ...button,
              opacity: cargando ? 0.7 : 1,
              cursor: cargando ? "not-allowed" : "pointer",
            }}
          >
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p style={bottom}>
          ¿Todavía no tenés cuenta?{" "}
          <Link href="/registro" style={link}>
            Crear cuenta
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
}

const form = {
  display: "grid",
  gap: 14,
  marginTop: 24,
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
}

const error = {
  background: "#fff0f0",
  color: "#b42318",
  padding: 11,
  borderRadius: 8,
  fontSize: 13,
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
