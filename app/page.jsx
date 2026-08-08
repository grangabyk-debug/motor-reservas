"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    async function checkConnection() {
      const { error } = await supabase.auth.getSession()
      setConnected(!error)
    }

    checkConnection()
  }, [])

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f7f5",
        fontFamily: "Arial, sans-serif",
        color: "#202020",
        padding: "40px",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "60px",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "13px",
                fontWeight: "700",
                letterSpacing: "2px",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              Plataforma hotelera
            </p>

            <h1
              style={{
                fontSize: "48px",
                margin: "10px 0",
              }}
            >
              Habitación Llena
            </h1>

            <p style={{ color: "#666", fontSize: "18px" }}>
              Gestión y reservas para alojamientos.
            </p>
          </div>

          <div
            style={{
              padding: "10px 16px",
              borderRadius: "20px",
              background: connected ? "#e4f7e8" : "#eee",
              color: connected ? "#187333" : "#666",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            {connected ? "● Supabase conectado" : "● Conectando..."}
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "30px",
              borderRadius: "16px",
              border: "1px solid #e5e5e5",
            }}
          >
            <h2>Reservas</h2>
            <p style={{ color: "#777" }}>
              Gestioná todas las reservas de tu alojamiento.
            </p>
          </div>

          <div
            style={{
              background: "#fff",
              padding: "30px",
              borderRadius: "16px",
              border: "1px solid #e5e5e5",
            }}
          >
            <h2>Alojamientos</h2>
            <p style={{ color: "#777" }}>
              Administrá habitaciones, cabañas y disponibilidad.
            </p>
          </div>

          <div
            style={{
              background: "#fff",
              padding: "30px",
              borderRadius: "16px",
              border: "1px solid #e5e5e5",
            }}
          >
            <h2>Panel de gestión</h2>
            <p style={{ color: "#777" }}>
              Toda la información de tu alojamiento en un solo lugar.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
