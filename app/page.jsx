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

  // Próximos 30 días
  const proximos30Dias = Array.from({ length: 30 }, (_, i) => {
    const fecha = new Date()
    fecha.setHours(12, 0, 0, 0)
    fecha.setDate(fecha.getDate() + i)

    const año = fecha.getFullYear()
    const mes = String(fecha.getMonth() + 1).padStart(2, "0")
    const dia = String(fecha.getDate()).padStart(2, "0")

    return `${año}-${mes}-${dia}`
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const { data: alojamientosData, error: alojamientosError } =
      await supabase
        .from("alojamientos")
        .select("*")
        .order("id", { ascending: true })

    const { data: habitacionesData, error: habitacionesError } =
      await supabase
        .from("habitaciones")
        .select("*")
        .order("id", { ascending: true })

    const { data: reservasData, error: reservasError } =
      await supabase
        .from("reservas")
        .select("*")
        .order("id", { ascending: false })

    if (alojamientosError) console.error(alojamientosError)
    if (habitacionesError) console.error(habitacionesError)
    if (reservasError) console.error(reservasError)

    setAlojamientos(alojamientosData || [])
    setHabitaciones(habitacionesData || [])
    setReservas(reservasData || [])
  }

  const habitacionesDisponibles = habitaciones.filter(
    (habitacion) =>
      String(habitacion.alojamiento_id) ===
        String(alojamientoSeleccionado) &&
      habitacion.activa !== false
  )

  const habitacionesActivas = habitaciones.filter(
    (habitacion) => habitacion.activa !== false
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
      setMensaje(
        "La fecha de salida debe ser posterior a la fecha de entrada."
      )
      return
    }

    setCargando(true)

    // Comprobar disponibilidad
    const { data: reservasExistentes, error: errorBusqueda } =
      await supabase
        .from("reservas")
        .select("*")
        .eq("habitacion_id", habitacionSeleccionada)
        .neq("estado", "cancelada")

    if (errorBusqueda) {
      console.error(errorBusqueda)
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
      setMensaje(
        "La habitación no está disponible para esas fechas."
      )
      setCargando(false)
      return
    }

    const { error } = await supabase
      .from("reservas")
      .insert([
        {
          alojamiento_id: Number(alojamientoSeleccionado),
          habitacion_id: Number(habitacionSeleccionada),
          nombre_huesped: nombre.trim(),
          email_huesped: email.trim(),
          telefono_huesped: telefono.trim(),
          fecha_entrada: fechaEntrada,
          fecha_salida: fechaSalida,
          cantidad_huespedes:
            Number(cantidadHuespedes) || 1,
          estado,
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

    return alojamiento
      ? alojamiento.nombre
      : "Sin alojamiento"
  }

  function nombreHabitacion(id) {
    const habitacion = habitaciones.find(
      (item) => String(item.id) === String(id)
    )

    return habitacion
      ? habitacion.nombre
      : "Sin habitación"
  }

  function formatearDia(fecha) {
    const partes = fecha.split("-")
    return partes[2]
  }

  function formatearMes(fecha) {
    const partes = fecha.split("-")
    const mes = Number(partes[1])

    const nombres = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ]

    return nombres[mes - 1]
  }

  function reservaParaFecha(habitacionId, fecha) {
    return reservas.find((reserva) => {
      return (
        String(reserva.habitacion_id) === String(habitacionId) &&
        reserva.estado !== "cancelada" &&
        fecha >= reserva.fecha_entrada &&
        fecha < reserva.fecha_salida
      )
    })
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
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
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

        {/* NUEVA RESERVA */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>Nueva reserva</h2>

          <form onSubmit={crearReserva}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(250px, 1fr))",
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
                <option value="">
                  Seleccionar alojamiento
                </option>

                {alojamientos.map((alojamiento) => (
                  <option
                    key={alojamiento.id}
                    value={alojamiento.id}
                  >
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
                <option value="">
                  Seleccionar habitación
                </option>

                {habitacionesDisponibles.map((habitacion) => (
                  <option
                    key={habitacion.id}
                    value={habitacion.id}
                  >
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
                onChange={(e) =>
                  setCantidadHuespedes(e.target.value)
                }
                style={inputStyle}
              />

              <div>
                <label style={labelStyle}>
                  Fecha de entrada
                </label>

                <input
                  type="date"
                  value={fechaEntrada}
                  onChange={(e) =>
                    setFechaEntrada(e.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Fecha de salida
                </label>

                <input
                  type="date"
                  value={fechaSalida}
                  onChange={(e) =>
                    setFechaSalida(e.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                style={inputStyle}
              >
                <option value="pendiente">
                  Pendiente
                </option>

                <option value="confirmada">
                  Confirmada
                </option>

                <option value="cancelada">
                  Cancelada
                </option>

                <option value="finalizada">
                  Finalizada
                </option>
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
              style={{
                ...buttonStyle,
                opacity: cargando ? 0.6 : 1,
              }}
            >
              {cargando
                ? "Guardando..."
                : "Crear reserva"}
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

        {/* CALENDARIO */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>
            Calendario de ocupación
          </h2>

          <p
            style={{
              color: "#777",
              marginTop: "-8px",
              marginBottom: "20px",
            }}
          >
            Próximos 30 días
          </p>

          {habitacionesActivas.length === 0 ? (
            <p style={{ color: "#777" }}>
              No hay habitaciones cargadas.
            </p>
          ) : (
            <div
              style={{
                overflowX: "auto",
                width: "100%",
              }}
            >
              <div
                style={{
                  minWidth: "1150px",
                  border: "1px solid #e5e5e5",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                {/* CABECERA */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "190px repeat(30, 1fr)",
                    background: "#fafafa",
                  }}
                >
                  <div
                    style={{
                      padding: "12px",
                      fontWeight: "700",
                      fontSize: "13px",
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    Habitación
                  </div>

                  {proximos30Dias.map((fecha) => (
                    <div
                      key={fecha}
                      title={fecha}
                      style={{
                        textAlign: "center",
                        padding: "8px 2px",
                        borderLeft:
                          "1px solid #eee",
                        borderBottom:
                          "1px solid #ddd",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#777",
                        }}
                      >
                        {formatearMes(fecha)}
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "700",
                        }}
                      >
                        {formatearDia(fecha)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* FILAS */}
                {habitacionesActivas.map(
                  (habitacion) => (
                    <div
                      key={habitacion.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "190px repeat(30, 1fr)",
                      }}
                    >
                      <div
                        style={{
                          padding: "12px",
                          borderBottom:
                            "1px solid #eee",
                          background: "#fff",
                          minHeight: "54px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "700",
                            fontSize: "13px",
                          }}
                        >
                          {habitacion.nombre}
                        </div>

                        <div
                          style={{
                            fontSize: "11px",
                            color: "#777",
                            marginTop: "3px",
                          }}
                        >
                          {nombreAlojamiento(
                            habitacion.alojamiento_id
                          )}
                        </div>
                      </div>

                      {proximos30Dias.map(
                        (fecha) => {
                          const reserva =
                            reservaParaFecha(
                              habitacion.id,
                              fecha
                            )

                          let background = "#fff"
                          let color = "#999"

                          if (reserva) {
                            if (
                              reserva.estado ===
                              "confirmada" ||
                              reserva.estado ===
                              "finalizada"
                            ) {
                              background = "#e2f0d9"
                              color = "#385723"
                            } else {
                              background = "#fff2cc"
                              color = "#7f6000"
                            }
                          }

                          return (
                            <div
                              key={`${habitacion.id}-${fecha}`}
                              title={
                                reserva
                                  ? `${reserva.nombre_huesped} — ${reserva.estado}`
                                  : "Disponible"
                              }
                              style={{
                                minHeight: "54px",
                                borderLeft:
                                  "1px solid #eee",
                                borderBottom:
                                  "1px solid #eee",
                                background,
                                color,
                                display: "flex",
                                alignItems: "center",
                                justifyContent:
                                  "center",
                                textAlign: "center",
                                padding: "2px",
                                fontSize: "9px",
                                fontWeight:
                                  reserva
                                    ? "700"
                                    : "400",
                                overflow: "hidden",
                              }}
                            >
                              {reserva
                                ? reserva.nombre_huesped
                                    .split(" ")[0]
                                    .substring(0, 6)
                                : ""}
                            </div>
                          )
                        }
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "20px",
              marginTop: "16px",
              fontSize: "13px",
              color: "#666",
            }}
          >
            <span>
              🟩 Confirmada / finalizada
            </span>

            <span>
              🟨 Pendiente
            </span>

            <span>
              ⬜ Disponible
            </span>
          </div>
        </section>

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
          <h2 style={{ marginTop: 0 }}>Reservas</h2>

          {reservas.length === 0 ? (
            <p style={{ color: "#777" }}>
              Todavía no hay reservas cargadas.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "14px",
              }}
            >
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
