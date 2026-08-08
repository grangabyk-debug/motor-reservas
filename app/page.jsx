"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {
  const [alojamientos, setAlojamientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState("")
  const [ciudad, setCiudad] = useState("")
  const [direccion, setDireccion] = useState("")
  const [telefono, setTelefono] = useState("")
  const [email, setEmail] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState("")

  async function cargarAlojamientos() {
    setCargando(true)

    const { data, error } = await supabase
      .from("alojamientos")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      setMensaje("No se pudieron cargar los alojamientos.")
    } else {
      setAlojamientos(data || [])
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarAlojamientos()
  }, [])

  async function crearAlojamiento(e) {
    e.preventDefault()

    if (!nombre.trim()) {
      setMensaje("El nombre del alojamiento es obligatorio.")
      return
    }

    setGuardando(true)
    setMensaje("")

    const { error } = await supabase
      .from("alojamientos")
      .insert([
        {
          nombre: nombre.trim(),
          tipo: tipo.trim(),
          ciudad: ciudad.trim(),
          direccion: direccion.trim(),
          telefono: telefono.trim(),
          email: email.trim(),
        },
      ])

    if (error) {
      console.error(error)
      setMensaje("No se pudo guardar el alojamiento.")
    } else {
      setNombre("")
      setTipo("")
      setCiudad("")
      setDireccion("")
      setTelefono("")
      setEmail("")
      setMensaje("Alojamiento creado correctamente.")
      await cargarAlojamientos()
    }

    setGuardando(false)
  }

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
            alignItems: "flex-start",
            marginBottom: "40px",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "13px",
                fontWeight: "700",
                letterSpacing: "2px",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}
            >
              Plataforma hotelera
            </p>

            <h1
              style={{
                fontSize: "48px",
                lineHeight: "1.05",
                margin: "0 0 12px",
              }}
            >
              Habitación Llena
            </h1>

            <p
              style={{
                fontSize: "18px",
                color: "#666",
                margin: 0,
              }}
            >
              Gestión y reservas para alojamientos.
            </p>
          </div>

          <div
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#286b3f",
            }}
          >
            ● Supabase conectado
          </div>
        </header>

        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: "16px",
            padding: "28px",
            marginBottom: "30px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            Nuevo alojamiento
          </h2>

          <form onSubmit={crearAlojamiento}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              <input
                placeholder="Nombre del alojamiento *"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Tipo: hotel, cabaña, hostería..."
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Dirección"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={guardando}
              style={buttonStyle}
            >
              {guardando ? "Guardando..." : "Crear alojamiento"}
            </button>
          </form>

          {mensaje && (
            <p
              style={{
                marginBottom: 0,
                marginTop: "18px",
                fontWeight: "600",
              }}
            >
              {mensaje}
            </p>
          )}
        </section>

        <section>
          <h2>Alojamientos</h2>

          {cargando ? (
            <p>Cargando alojamientos...</p>
          ) : alojamientos.length === 0 ? (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e5e5",
                borderRadius: "16px",
                padding: "30px",
              }}
            >
              <p style={{ margin: 0 }}>
                Todavía no hay alojamientos cargados.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "18px",
              }}
            >
              {alojamientos.map((alojamiento) => (
                <div
                  key={alojamiento.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e5e5",
                    borderRadius: "16px",
                    padding: "24px",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    {alojamiento.nombre}
                  </h3>

                  {alojamiento.tipo && (
                    <p>Tipo: {alojamiento.tipo}</p>
                  )}

                  {alojamiento.ciudad && (
                    <p>Ciudad: {alojamiento.ciudad}</p>
                  )}

                  {alojamiento.direccion && (
                    <p>Dirección: {alojamiento.direccion}</p>
                  )}

                  {alojamiento.telefono && (
                    <p>Teléfono: {alojamiento.telefono}</p>
                  )}

                  {alojamiento.email && (
                    <p>Email: {alojamiento.email}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #dcdcdc",
  fontSize: "15px",
  outline: "none",
}

const buttonStyle = {
  marginTop: "20px",
  padding: "14px 22px",
  borderRadius: "10px",
  border: "none",
  background: "#202020",
  color: "#fff",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
}
