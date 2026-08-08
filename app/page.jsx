"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {
  const [alojamientos, setAlojamientos] = useState([])
  const [habitaciones, setHabitaciones] = useState([])
  const [alojamientoSeleccionado, setAlojamientoSeleccionado] = useState("")

  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState("")
  const [capacidad, setCapacidad] = useState("")
  const [precio, setPrecio] = useState("")

  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const { data: alojamientosData } = await supabase
      .from("alojamientos")
      .select("*")
      .order("id", { ascending: true })

    const { data: habitacionesData } = await supabase
      .from("habitaciones")
      .select("*")
      .order("id", { ascending: true })

    setAlojamientos(alojamientosData || [])
    setHabitaciones(habitacionesData || [])
  }

  async function crearHabitacion(e) {
    e.preventDefault()
    setMensaje("")

    if (!alojamientoSeleccionado || !nombre || !tipo || !capacidad || !precio) {
      setMensaje("Completá todos los campos.")
      return
    }

    setCargando(true)

    const { error } = await supabase
      .from("habitaciones")
      .insert([
        {
          alojamiento_id: Number(alojamientoSeleccionado),
          nombre,
          tipo,
          capacidad: Number(capacidad),
          precio: Number(precio),
          activa: true,
        },
      ])

    setCargando(false)

    if (error) {
      console.error(error)
      setMensaje("No se pudo crear la habitación.")
      return
    }

    setNombre("")
    setTipo("")
    setCapacidad("")
    setPrecio("")
    setMensaje("Habitación creada correctamente.")

    cargarDatos()
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
        <header style={{ marginBottom: "40px" }}>
          <p
            style={{
              fontSize: "14px",
              fontWeight: "700",
              letterSpacing: "3px",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Plataforma hotelera
          </p>

          <h1
            style={{
              fontSize: "52px",
              lineHeight: "1.05",
              margin: "0 0 10px",
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
        </header>

        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: "16px",
            padding: "30px",
            marginBottom: "30px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Nueva habitación</h2>

          <form
            onSubmit={crearHabitacion}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            <select
              value={alojamientoSeleccionado}
              onChange={(e) => setAlojamientoSeleccionado(e.target.value)}
              style={campo}
            >
              <option value="">Seleccioná un alojamiento</option>

              {alojamientos.map((alojamiento) => (
                <option key={alojamiento.id} value={alojamiento.id}>
                  {alojamiento.nombre}
                </option>
              ))}
            </select>

            <input
              placeholder="Nombre de la habitación *"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={campo}
            />

            <input
              placeholder="Tipo (Doble, Triple, Suite...)"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              style={campo}
            />

            <input
              type="number"
              placeholder="Capacidad"
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              style={campo}
            />

            <input
              type="number"
              placeholder="Precio por noche"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              style={campo}
            />

            <button
              type="submit"
              disabled={cargando}
              style={{
                ...boton,
                opacity: cargando ? 0.6 : 1,
              }}
            >
              {cargando ? "Guardando..." : "Crear habitación"}
            </button>
          </form>

          {mensaje && (
            <p
              style={{
                marginTop: "20px",
                fontWeight: "600",
              }}
            >
              {mensaje}
            </p>
          )}
        </section>

        <section>
          <h2>Habitaciones</h2>

          {habitaciones.length === 0 ? (
            <p style={{ color: "#666" }}>
              Todavía no hay habitaciones cargadas.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "20px",
              }}
            >
              {habitaciones.map((habitacion) => {
                const alojamiento = alojamientos.find(
                  (a) => a.id === habitacion.alojamiento_id
                )

                return (
                  <div
                    key={habitacion.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e5e5",
                      borderRadius: "16px",
                      padding: "24px",
                    }}
                  >
                    <h3 style={{ marginTop: 0 }}>
                      {habitacion.nombre}
                    </h3>

                    <p>
                      <strong>Alojamiento:</strong>{" "}
                      {alojamiento?.nombre || "Sin asignar"}
                    </p>

                    <p>
                      <strong>Tipo:</strong> {habitacion.tipo}
                    </p>

                    <p>
                      <strong>Capacidad:</strong>{" "}
                      {habitacion.capacidad} personas
                    </p>

                    <p>
                      <strong>Precio:</strong> $
                      {habitacion.precio}
                    </p>

                    <p>
                      <strong>Estado:</strong>{" "}
                      {habitacion.activa ? "Activa" : "Inactiva"}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

const campo = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px",
  border: "1px solid #ddd",
  borderRadius: "10px",
  fontSize: "16px",
  background: "#fff",
}

const boton = {
  padding: "14px 20px",
  border: "none",
  borderRadius: "10px",
  background: "#202020",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "700",
  cursor: "pointer",
}
