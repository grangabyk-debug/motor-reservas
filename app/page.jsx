"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {
  const [alojamientos, setAlojamientos] = useState([])
  const [habitaciones, setHabitaciones] = useState([])
  const [reservas, setReservas] = useState([])

  const [alojamientoSeleccionado, setAlojamientoSeleccionado] = useState("")
  const [habitacionSeleccionada, setHabitacionSeleccionada] = useState("")

  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [fechaEntrada, setFechaEntrada] = useState("")
  const [fechaSalida, setFechaSalida] = useState("")
  const [cantidadHuespedes, setCantidadHuespedes] = useState("1")
  const [estado, setEstado] = useState("pendiente")
  const [notas, setNotas] = useState("")

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

    const { data: reservasData } = await supabase
      .from("reservas")
      .select("*")
      .order("id", { ascending: false })

    setAlojamientos(alojamientosData || [])
    setHabitaciones(habitacionesData || [])
    setReservas(reservasData || [])
  }

  const habitacionesDisponibles = habitaciones.filter(
    (habitacion) =>
      String(habitacion.alojamiento_id) === String(alojamientoSeleccionado) &&
      habitacion.activa !== false
  )

  async function crearReserva(e) {
    e.preventDefault()
    setMensaje("")

    if (!alojamientoSeleccionado) {
      setMensaje("Seleccioná un alojamiento.")
      return
    }

    if (!habitacionSeleccionada) {
      setMensaje("Seleccioná una habitación.")
      return
    }

    if (!nombre.trim()) {
      setMensaje("Ingresá el nombre del huésped.")
      return
    }

    if (!fechaEntrada || !fechaSalida) {
      setMensaje("Ingresá las fechas de entrada y salida.")
      return
    }

    if (fechaSalida <= fechaEntrada) {
      setMensaje("La fecha de salida debe ser posterior a la fecha de entrada.")
      return
    }

    setCargando(true)

    // Verificamos que no exista otra reserva que se cruce con las fechas.
    const { data: reservasExistentes, error: errorBusqueda } = await supabase
      .from("reservas")
      .select("*")
      .eq("habitacion_id", habitacionSeleccionada)
      .neq("estado", "cancelada")

    if (errorBusqueda) {
      setMensaje("No se pudo verificar la disponibilidad.")
      setCargando(false)
      return
    }

    const hayCruce = (reservasExistentes || []).some((reserva) => {
      return (
        fechaEntrada < reserva.fecha_salida &&
        fechaSalida > reserva.fecha_entrada
      )
    })

    if (hayCruce) {
      setMensaje("La habitación no está disponible para esas fechas.")
      setCargando(false)
      return
    }

    const { error } = await supabase.from("reservas").insert([
      {
        alojamiento_id: Number(alojamientoSeleccionado),
        habitacion_id: Number(habitacionSeleccionada),
        nombre_huesped: nombre.trim(),
        email_huesped: email.trim(),
        telefono_huesped: telefono.trim(),
        fecha_entrada: fechaEntrada,
        fecha_salida: fechaSalida,
        cantidad_huespedes: Number(cantidadHuespedes) || 1,
        estado: estado,
        notas: notas.trim(),
      },
    ])

    if (error) {
      console.error(error)
      setMensaje("No se pudo guardar la reserva.")
      setCargando(false)
      return
    }

    setMensaje("Reserva creada correctamente.")

    setAlojamientoSeleccionado("")
    setHabitacionSeleccionada("")
    setNombre("")
    setEmail("")
    setTelefono("")
    setFechaEntrada("")
    setFechaSalida("")
    setCantidadHuespedes("1")
    setEstado("pendiente")
    setNotas("")

    await cargarDatos()

    setCargando(false)
  }

  function nombreAlojamiento(id) {
    const alojamiento = alojamientos.find(
      (item) => String(item.id) === String(id)
    )

    return alojamiento ? alojamiento.nombre : "Sin alojamiento"
  }

  function nombreHabitacion(id) {
    const habitacion = habitaciones.find(
      (item) => String(item.id) === String(id)
    )

    return habitacion ? habitacion.nombre : "Sin habitación"
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
          <div
            style={{
              fontSize: "14px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Plataforma hotelera
          </div>

          <h1
            style={{
              fontSize: "52px",
              margin: "0 0 10px",
              lineHeight: "1.05",
            }}
          >
            Habitación Llena
          </h1>

          <p style={{ fontSize: "18px", color: "#666" }}>
            Gestión y reservas para alojamientos.
          </p>
        </header>

        {/* RESERVAS */}
        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: "16px",
            padding: "28px",
            marginBottom: "30px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Nueva reserva</h2>

          <form onSubmit={crearReserva}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
              }}
            >
              <select
                value={alojamientoSeleccionado}
                onChange={(e) => {
                  setAlojamientoSeleccionado(e.target.value)
                  setHabitacionSeleccionada("")
                }}
                style={inputStyle}
              >
                <option value="">Seleccionar alojamiento</option>

                {alojamientos.map((alojamiento) => (
                  <option key={alojamiento.id} value={alojamiento.id}>
                    {alojamiento.nombre}
                  </option>
                ))}
              </select>

              <select
                value={habitacionSeleccionada}
                onChange={(e) =>
                  setHabitacionSeleccionada(e.target.value)
                }
                style={inputStyle}
                disabled={!alojamientoSeleccionado}
              >
                <option value="">Seleccionar habitación</option>

                {habitacionesDisponibles.map((habitacion) => (
                  <option key={habitacion.id} value={habitacion.id}>
                    {habitacion.nombre} - {habitacion.tipo}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Nombre del huésped"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                style={inputStyle}
              />

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                style={inputStyle}
              />

              <input
                type="number"
                min="1"
                placeholder="Cantidad de huéspedes"
                value={cantidadHuespedes}
                onChange={(e) => setCantidadHuespedes(e.target.value)}
                style={inputStyle}
              />

              <div>
                <label style={labelStyle}>Fecha de entrada</label>
                <input
                  type="date"
                  value={fechaEntrada}
                  onChange={(e) => setFechaEntrada(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Fecha de salida</label>
                <input
                  type="date"
                  value={fechaSalida}
                  onChange={(e) => setFechaSalida(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                style={inputStyle}
              >
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
                <option value="cancelada">Cancelada</option>
                <option value="finalizada">Finalizada</option>
              </select>

              <input
                type="text"
                placeholder="Notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              style={buttonStyle}
            >
              {cargando ? "Guardando..." : "Crear reserva"}
            </button>
          </form>

          {mensaje && (
            <p
              style={{
                marginTop: "18px",
                fontWeight: "600",
              }}
            >
              {mensaje}
            </p>
          )}
        </section>

        {/* LISTADO DE RESERVAS */}
        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: "16px",
            padding: "28px",
            marginBottom: "30px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Reservas</h2>

          {reservas.length === 0 ? (
            <p style={{ color: "#777" }}>
              Todavía no hay reservas cargadas.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {reservas.map((reserva) => (
                <div
                  key={reserva.id}
                  style={{
                    border: "1px solid #e5e5e5",
                    borderRadius: "12px",
                    padding: "20px",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    {reserva.nombre_huesped}
                  </h3>

                  <p>
                    <strong>Alojamiento:</strong>{" "}
                    {nombreAlojamiento(reserva.alojamiento_id)}
                  </p>

                  <p>
                    <strong>Habitación:</strong>{" "}
                    {nombreHabitacion(reserva.habitacion_id)}
                  </p>

                  <p>
                    <strong>Entrada:</strong>{" "}
                    {reserva.fecha_entrada}
                  </p>

                  <p>
                    <strong>Salida:</strong>{" "}
                    {reserva.fecha_salida}
                  </p>

                  <p>
                    <strong>Huéspedes:</strong>{" "}
                    {reserva.cantidad_huespedes}
                  </p>

                  <p>
                    <strong>Estado:</strong>{" "}
                    {reserva.estado}
                  </p>

                  {reserva.email_huesped && (
                    <p>
                      <strong>Email:</strong>{" "}
                      {reserva.email_huesped}
                    </p>
                  )}

                  {reserva.telefono_huesped && (
                    <p>
                      <strong>Teléfono:</strong>{" "}
                      {reserva.telefono_huesped}
                    </p>
                  )}

                  {reserva.notas && (
                    <p>
                      <strong>Notas:</strong>{" "}
                      {reserva.notas}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ALOJAMIENTOS */}
        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: "16px",
            padding: "28px",
            marginBottom: "30px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Alojamientos</h2>

          {alojamientos.length === 0 ? (
            <p style={{ color: "#777" }}>
              Todavía no hay alojamientos cargados.
            </p>
          ) : (
            alojamientos.map((alojamiento) => (
              <div
                key={alojamiento.id}
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "18px 0",
                }}
              >
                <h3>{alojamiento.nombre}</h3>
                <p>Tipo: {alojamiento.tipo}</p>
                <p>Ciudad: {alojamiento.ciudad}</p>
                <p>Dirección: {alojamiento.direccion}</p>
                <p>Teléfono: {alojamiento.telefono}</p>
                <p>Email: {alojamiento.email}</p>
              </div>
            ))
          )}
        </section>

        {/* HABITACIONES */}
        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: "16px",
            padding: "28px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Habitaciones</h2>

          {habitaciones.length === 0 ? (
            <p style={{ color: "#777" }}>
              Todavía no hay habitaciones cargadas.
            </p>
          ) : (
            habitaciones.map((habitacion) => (
              <div
                key={habitacion.id}
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "18px 0",
                }}
              >
                <h3>{habitacion.nombre}</h3>

                <p>
                  <strong>Alojamiento:</strong>{" "}
                  {nombreAlojamiento(habitacion.alojamiento_id)}
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
            ))
          )}
        </section>
      </div>
    </main>
  )
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px",
  border: "1px solid #ddd",
  borderRadius: "8px",
  fontSize: "15px",
  background: "#fff",
}

const labelStyle = {
  display: "block",
  fontSize: "13px",
  marginBottom: "6px",
  color: "#666",
}

const buttonStyle = {
  marginTop: "20px",
  padding: "14px 22px",
  border: "none",
  borderRadius: "8px",
  background: "#202020",
  color: "#fff",
  fontSize: "15px",
  fontWeight: "600",
  cursor: "pointer",
}
