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
const [reservaSeleccionada, setReservaSeleccionada] = useState(null)
  
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
    .neq("id", reservaSeleccionada?.id || 0)
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

   let error = null

const datosReserva = {
  alojamiento_id: Number(alojamientoSeleccionado),
  habitacion_id: Number(habitacionSeleccionada),
  nombre_huesped: nombre.trim(),
  email_huesped: email.trim(),
  telefono_huesped: telefono.trim(),
  fecha_entrada: fechaEntrada,
  fecha_salida: fechaSalida,
  cantidad_huespedes: Number(cantidadHuespedes) || 1,
  estado,
  notas: notas.trim(),
}

if (reservaSeleccionada) {
  const resultado = await supabase
    .from("reservas")
    .update(datosReserva)
    .eq("id", reservaSeleccionada.id)

  error = resultado.error
} else {
  const resultado = await supabase
    .from("reservas")
    .insert([datosReserva])

  error = resultado.error
} else {
  const resultado = await supabase
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
        cantidad_huespedes: Number(cantidadHuespedes) || 1,
        estado,
        notas: notas.trim(),
      },
    ])
    }

  error = resultado.error
}
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

    setMensaje(
  reservaSeleccionada
    ? "Reserva actualizada correctamente."
    : "Reserva creada correctamente."
)
setReservaSeleccionada(null)
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

function diasEntre(fechaInicio, fechaFin) {
  const inicio = new Date(`${fechaInicio}T00:00:00`)
  const fin = new Date(`${fechaFin}T00:00:00`)

  return Math.max(
    1,
    Math.round((fin - inicio) / (1000 * 60 * 60 * 24))
  )
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
{/* CALENDARIO DE OCUPACIÓN */}
<section
  style={{
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: "16px",
    padding: "28px",
    marginBottom: "30px",
  }}
>
  <h2 style={{ marginTop: 0, marginBottom: "6px" }}>
    Calendario de ocupación
  </h2>

  <p style={{ color: "#777", marginTop: 0, marginBottom: "20px" }}>
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
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          minWidth: "1200px",
          border: "1px solid #eee",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* ENCABEZADO DE FECHAS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px repeat(30, 1fr)",
            background: "#f9f9f9",
          }}
        >
          <div
            style={{
              padding: "10px",
              fontWeight: "600",
              fontSize: "12px",
              borderBottom: "1px solid #ddd",
            }}
          >
            Habitación
          </div>

          {proximos30Dias.map((fecha) => {
            const partes = fecha.split("-")
            const mes = partes[1]
            const dia = partes[2]

            return (
              <div
                key={fecha}
                title={fecha}
                style={{
                  textAlign: "center",
                  padding: "6px 2px",
                  borderLeft: "1px solid #eee",
                  borderBottom: "1px solid #ddd",
                  fontSize: "10px",
                }}
              >
                <div style={{ color: "#777" }}>
                  {mes === "01"
                    ? "Ene"
                    : mes === "02"
                    ? "Feb"
                    : mes === "03"
                    ? "Mar"
                    : mes === "04"
                    ? "Abr"
                    : mes === "05"
                    ? "May"
                    : mes === "06"
                    ? "Jun"
                    : mes === "07"
                    ? "Jul"
                    : mes === "08"
                    ? "Ago"
                    : mes === "09"
                    ? "Sep"
                    : mes === "10"
                    ? "Oct"
                    : mes === "11"
                    ? "Nov"
                    : "Dic"}
                </div>

                <strong>{dia}</strong>
              </div>
            )
          })}
        </div>

        {/* HABITACIONES */}
        {habitacionesActivas.map((habitacion) => {
          const reservasHabitacion = reservas.filter(
            (reserva) =>
              String(reserva.habitacion_id) === String(habitacion.id) &&
              reserva.estado !== "cancelada" &&
              reserva.fecha_salida > proximos30Dias[0] &&
              reserva.fecha_entrada <=
                proximos30Dias[proximos30Dias.length - 1]
          )

          return (
            <div
              key={habitacion.id}
              style={{
                display: "grid",
                gridTemplateColumns: "200px 1fr",
                minHeight: "58px",
              }}
            >
              {/* NOMBRE DE HABITACIÓN */}
              <div
                style={{
                  padding: "10px",
                  borderBottom: "1px solid #eee",
                  background: "#fff",
                  fontSize: "12px",
                }}
              >
                <strong>{habitacion.nombre}</strong>

                <div
                  style={{
                    color: "#888",
                    fontSize: "10px",
                    marginTop: "3px",
                  }}
                >
                  {nombreAlojamiento(habitacion.alojamiento_id)}
                </div>
              </div>

              {/* CALENDARIO DE ESA HABITACIÓN */}
              <div
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "repeat(30, 1fr)",
                  minHeight: "58px",
                  borderBottom: "1px solid #eee",
                }}
              >
                {/* CELDAS VACÍAS */}
                {proximos30Dias.map((fecha) => (
                  <div
                    key={fecha}
                    style={{
                      borderLeft: "1px solid #eee",
                      minHeight: "58px",
                      background: "#fff",
                    }}
                  />
                ))}

                {/* BARRAS DE RESERVAS */}
                {reservasHabitacion.map((reserva) => {
                  let inicio = proximos30Dias.findIndex(
                    (fecha) => fecha >= reserva.fecha_entrada
                  )

                  let fin = proximos30Dias.findIndex(
                    (fecha) => fecha >= reserva.fecha_salida
                  )

                  if (inicio === -1) {
                    inicio = 0
                  }

                  if (fin === -1) {
                    fin = proximos30Dias.length
                  }

                  if (fin <= inicio) {
                    return null
                  }

                  const confirmada =
                    reserva.estado === "confirmada" ||
                    reserva.estado === "finalizada"

                 const background = confirmada
  ? "#22c55e"
  : "#facc15"

const color = confirmada
  ? "#ffffff"
  : "#713f12"

                  return (
                    <div
                      key={reserva.id}
                      onClick={() => setReservaSeleccionada(reserva)}
                      title={`${reserva.nombre_huesped} - ${reserva.estado} - Entrada: ${reserva.fecha_entrada} - Salida: ${reserva.fecha_salida}`}
                      style={{
                        position: "absolute",
                        left: `calc(${inicio} * (100% / 30) + 3px)`,
                        width: `calc(${fin - inicio} * (100% / 30) - 6px)`,
                        top: "9px",
                        height: "40px",
                        background,
                        color,
                        borderRadius: "7px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 8px",
                        boxSizing: "border-box",
                        fontSize: "11px",
                        fontWeight: "600",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        zIndex: 2,
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      {reserva.nombre_huesped}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
{reservaSeleccionada && (
  <div
    style={{
      marginTop: "20px",
      padding: "20px",
      border: "1px solid #ddd",
      borderRadius: "12px",
      background: "#fff",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <h3 style={{ margin: 0 }}>
        Reserva de {reservaSeleccionada.nombre_huesped}
      </h3>

      <button
        onClick={() => setReservaSeleccionada(null)}
        style={{
          border: "none",
          background: "transparent",
          fontSize: "20px",
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>

    <p><strong>Alojamiento:</strong> {nombreAlojamiento(reservaSeleccionada.alojamiento_id)}</p>
    <p><strong>Habitación:</strong> {nombreHabitacion(reservaSeleccionada.habitacion_id)}</p>
    <p><strong>Entrada:</strong> {reservaSeleccionada.fecha_entrada}</p>
    <p><strong>Salida:</strong> {reservaSeleccionada.fecha_salida}</p>
    <p><strong>Estado:</strong> {reservaSeleccionada.estado}</p>
    <p><strong>Email:</strong> {reservaSeleccionada.email}</p>
    <p><strong>Teléfono:</strong> {reservaSeleccionada.telefono}</p>

    {reservaSeleccionada.notas && (
      <p>
        <strong>Notas:</strong> {reservaSeleccionada.notas}
      </p>
    )}
    <div
  style={{
    display: "flex",
    gap: "10px",
    marginTop: "20px",
  }}
>
  <button
    onClick={() => {
      setAlojamientoSeleccionado(reservaSeleccionada.alojamiento_id)
      setHabitacionSeleccionada(reservaSeleccionada.habitacion_id)
      setNombre(reservaSeleccionada.nombre_huesped)
      setEmail(reservaSeleccionada.email || "")
      setTelefono(reservaSeleccionada.telefono || "")
      setFechaEntrada(reservaSeleccionada.fecha_entrada)
      setFechaSalida(reservaSeleccionada.fecha_salida)
      setCantidadHuespedes(reservaSeleccionada.cantidad_huespedes || "1")
      setEstado(reservaSeleccionada.estado)
      setNotas(reservaSeleccionada.notas || "")
      setReservaSeleccionada(null)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }}
    style={{
      background: "#222",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      padding: "10px 16px",
      cursor: "pointer",
    }}
  >
    ✏️ Editar reserva
  </button>
</div>
  </div>
)}
      {/* REFERENCIAS */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          marginTop: "16px",
          fontSize: "13px",
          color: "#666",
          flexWrap: "wrap",
        }}
      >
        <span>🟩 Confirmada / finalizada</span>
        <span>🟨 Pendiente</span>
        <span>⬜ Disponible</span>
      </div>
    </div>
  )}
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
const sectionStyle = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: "16px",
  padding: "28px",
  marginBottom: "30px",
}

const titleStyle = {
  marginTop: 0,
  marginBottom: "20px",
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
