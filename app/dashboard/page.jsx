 "use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

const colors = {
  navy: "#003b95",
  navyDark: "#002b6f",
  blue: "#006ce4",
  blueSoft: "#e8f1ff",
  green: "#00875a",
  greenSoft: "#e8f7f0",
  yellow: "#b78103",
  yellowSoft: "#fff7dc",
  red: "#c62828",
  redSoft: "#fff0f0",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#f5f7fa",
  white: "#ffffff",
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  border: `1px solid ${colors.border}`,
  borderRadius: "8px",
  fontSize: "14px",
  background: colors.white,
  color: colors.text,
  outline: "none",
}

function fechaLocal(offset = 0) {
  const fecha = new Date()
  fecha.setHours(12, 0, 0, 0)
  fecha.setDate(fecha.getDate() + offset)
  const año = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")
  const dia = String(fecha.getDate()).padStart(2, "0")
  return `${año}-${mes}-${dia}`
}

function diasEntre(inicio, fin) {
  const a = new Date(`${inicio}T00:00:00`)
  const b = new Date(`${fin}T00:00:00`)
  return Math.max(1, Math.round((b - a) / 86400000))
}

function formatearFecha(fecha) {
  if (!fecha) return "-"
  const [año, mes, dia] = fecha.split("-")
  return `${dia}/${mes}/${año}`
}

function nombreMes(fecha) {
  const [año, mes] = fecha.split("-")
  return new Date(Number(año), Number(mes) - 1, 1).toLocaleDateString("es-AR", {
    month: "short",
  }).replace(".", "")
}

export default function Home() {
  const [alojamientos, setAlojamientos] = useState([])
  const [habitaciones, setHabitaciones] = useState([])
  const [reservas, setReservas] = useState([])

  const [vista, setVista] = useState("dashboard")
  const [menuAbierto, setMenuAbierto] = useState(false)

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

  const [reservaSeleccionada, setReservaSeleccionada] = useState(null)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(false)

  const [mostrarAlojamiento, setMostrarAlojamiento] = useState(false)
  const [nuevoAlojamiento, setNuevoAlojamiento] = useState("")
  const [mostrarHabitacion, setMostrarHabitacion] = useState(false)
  const [nuevaHabitacion, setNuevaHabitacion] = useState("")
  const [nuevoTipo, setNuevoTipo] = useState("")
  const [nuevoAlojamientoHabitacion, setNuevoAlojamientoHabitacion] = useState("")

  const proximos30Dias = useMemo(
    () => Array.from({ length: 30 }, (_, i) => fechaLocal(i)),
    []
  )

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const [
      { data: alojamientosData, error: alojamientosError },
      { data: habitacionesData, error: habitacionesError },
      { data: reservasData, error: reservasError },
    ] = await Promise.all([
      supabase.from("alojamientos").select("*").order("id", { ascending: true }),
      supabase.from("habitaciones").select("*").order("id", { ascending: true }),
      supabase.from("reservas").select("*").order("id", { ascending: false }),
    ])

    if (alojamientosError) console.error(alojamientosError)
    if (habitacionesError) console.error(habitacionesError)
    if (reservasError) console.error(reservasError)

    setAlojamientos(alojamientosData || [])
    setHabitaciones(habitacionesData || [])
    setReservas(reservasData || [])
  }

  const habitacionesActivas = habitaciones.filter((h) => h.activa !== false)

  const habitacionesDisponibles = habitaciones.filter(
    (h) =>
      String(h.alojamiento_id) === String(alojamientoSeleccionado) &&
      h.activa !== false
  )

  const reservasActivas = reservas.filter((r) => r.estado !== "cancelada")

  const reservasHoy = reservasActivas.filter(
    (r) => r.fecha_entrada <= fechaLocal(0) && r.fecha_salida > fechaLocal(0)
  )

  const entradasProximas = reservasActivas.filter(
    (r) => r.fecha_entrada >= fechaLocal(0) && r.fecha_entrada <= fechaLocal(7)
  )

  const nombreAlojamiento = (id) => {
    const item = alojamientos.find((a) => String(a.id) === String(id))
    return item ? item.nombre : "Sin alojamiento"
  }

  const nombreHabitacion = (id) => {
    const item = habitaciones.find((h) => String(h.id) === String(id))
    return item ? item.nombre : "Sin habitación"
  }

  function limpiarFormulario() {
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
    setReservaSeleccionada(null)
    setModoEdicion(false)
  }

  function editarReserva(reserva) {
    setReservaSeleccionada(reserva)
    setModoEdicion(true)
    setAlojamientoSeleccionado(String(reserva.alojamiento_id))
    setHabitacionSeleccionada(String(reserva.habitacion_id))
    setNombre(reserva.nombre_huesped || "")
    setEmail(reserva.email_huesped || "")
    setTelefono(reserva.telefono_huesped || "")
    setFechaEntrada(reserva.fecha_entrada || "")
    setFechaSalida(reserva.fecha_salida || "")
    setCantidadHuespedes(String(reserva.cantidad_huespedes || 1))
    setEstado(reserva.estado || "pendiente")
    setNotas(reserva.notas || "")
    setVista("reservas")
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50)
  }

  async function guardarReserva(e) {
    e.preventDefault()
    setMensaje("")

    if (!alojamientoSeleccionado || !habitacionSeleccionada || !nombre.trim()) {
      setMensaje("Completá alojamiento, habitación y nombre del huésped.")
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

    const { data: existentes, error: errorBusqueda } = await supabase
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

    const hayCruce = (existentes || []).some(
      (r) => fechaEntrada < r.fecha_salida && fechaSalida > r.fecha_entrada
    )

    if (hayCruce) {
      setMensaje("La habitación no está disponible para esas fechas.")
      setCargando(false)
      return
    }

    const datos = {
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

    let error

    if (modoEdicion && reservaSeleccionada) {
      const resultado = await supabase
        .from("reservas")
        .update(datos)
        .eq("id", reservaSeleccionada.id)
      error = resultado.error
    } else {
      const resultado = await supabase.from("reservas").insert([datos])
      error = resultado.error
    }

    if (error) {
      console.error(error)
      setMensaje("No se pudo guardar la reserva.")
      setCargando(false)
      return
    }

    setMensaje(modoEdicion ? "Reserva actualizada correctamente." : "Reserva creada correctamente.")
    limpiarFormulario()
    await cargarDatos()
    setCargando(false)
  }

  async function cancelarReserva(reserva) {
    if (!confirm(`¿Cancelar la reserva de ${reserva.nombre_huesped}?`)) return

    const { error } = await supabase
      .from("reservas")
      .update({ estado: "cancelada" })
      .eq("id", reserva.id)

    if (error) {
      console.error(error)
      alert("No se pudo cancelar la reserva.")
      return
    }

    setReservaSeleccionada(null)
    await cargarDatos()
  }

  async function crearAlojamiento(e) {
    e.preventDefault()
    if (!nuevoAlojamiento.trim()) return

    const { error } = await supabase
      .from("alojamientos")
      .insert([{ nombre: nuevoAlojamiento.trim() }])

    if (error) {
      console.error(error)
      alert("No se pudo crear el alojamiento.")
      return
    }

    setNuevoAlojamiento("")
    setMostrarAlojamiento(false)
    await cargarDatos()
  }

  async function crearHabitacion(e) {
    e.preventDefault()
    if (!nuevaHabitacion.trim() || !nuevoAlojamientoHabitacion) return

    const datos = {
      nombre: nuevaHabitacion.trim(),
      tipo: nuevoTipo.trim(),
      alojamiento_id: Number(nuevoAlojamientoHabitacion),
      activa: true,
    }

    const { error } = await supabase.from("habitaciones").insert([datos])

    if (error) {
      console.error(error)
      alert("No se pudo crear la habitación.")
      return
    }

    setNuevaHabitacion("")
    setNuevoTipo("")
    setNuevoAlojamientoHabitacion("")
    setMostrarHabitacion(false)
    await cargarDatos()
  }

  function estadoBadge(estadoActual) {
    const map = {
      confirmada: { bg: colors.greenSoft, color: colors.green, label: "Confirmada" },
      finalizada: { bg: "#eef2f7", color: "#475569", label: "Finalizada" },
      pendiente: { bg: colors.yellowSoft, color: colors.yellow, label: "Pendiente" },
      cancelada: { bg: colors.redSoft, color: colors.red, label: "Cancelada" },
    }
    return map[estadoActual] || map.pendiente
  }

  function ReservaCard({ reserva }) {
    const badge = estadoBadge(reserva.estado)
    return (
      <div
        onClick={() => setReservaSeleccionada(reserva)}
        style={{
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: 18,
          cursor: "pointer",
          transition: "box-shadow .15s",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{reserva.nombre_huesped}</div>
            <div style={{ color: colors.muted, fontSize: 13, marginTop: 5 }}>
              {nombreAlojamiento(reserva.alojamiento_id)} · {nombreHabitacion(reserva.habitacion_id)}
            </div>
          </div>
          <span style={{
            background: badge.bg,
            color: badge.color,
            borderRadius: 999,
            padding: "5px 10px",
            height: "fit-content",
            fontSize: 12,
            fontWeight: 700,
          }}>
            {badge.label}
          </span>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginTop: 18,
          paddingTop: 15,
          borderTop: `1px solid ${colors.border}`,
          fontSize: 13,
        }}>
          <div><div style={{ color: colors.muted }}>Entrada</div><strong>{formatearFecha(reserva.fecha_entrada)}</strong></div>
          <div><div style={{ color: colors.muted }}>Salida</div><strong>{formatearFecha(reserva.fecha_salida)}</strong></div>
          <div><div style={{ color: colors.muted }}>Huéspedes</div><strong>{reserva.cantidad_huespedes || 1}</strong></div>
        </div>
      </div>
    )
  }

  function Calendario() {
    return (
      <div style={{ overflowX: "auto" }}>
        <div style={{
          minWidth: 1220,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "210px repeat(30, 1fr)",
            background: "#f8fafc",
          }}>
            <div style={{ padding: 12, fontWeight: 700, fontSize: 12, borderBottom: `1px solid ${colors.border}` }}>
              Habitación
            </div>

            {proximos30Dias.map((fecha) => (
              <div key={fecha} style={{
                textAlign: "center",
                padding: "7px 2px",
                borderLeft: `1px solid ${colors.border}`,
                borderBottom: `1px solid ${colors.border}`,
                fontSize: 10,
              }}>
                <div style={{ color: colors.muted }}>{nombreMes(fecha)}</div>
                <strong>{fecha.slice(8)}</strong>
              </div>
            ))}
          </div>

          {habitacionesActivas.map((habitacion) => {
            const reservasHabitacion = reservasActivas.filter(
              (r) =>
                String(r.habitacion_id) === String(habitacion.id) &&
                r.fecha_salida > proximos30Dias[0] &&
                r.fecha_entrada <= proximos30Dias[29]
            )

            return (
              <div key={habitacion.id} style={{
                display: "grid",
                gridTemplateColumns: "210px 1fr",
                minHeight: 64,
              }}>
                <div style={{
                  padding: 12,
                  borderBottom: `1px solid ${colors.border}`,
                  background: colors.white,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{habitacion.nombre}</div>
                  <div style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                    {nombreAlojamiento(habitacion.alojamiento_id)}
                  </div>
                </div>

                <div style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "repeat(30, 1fr)",
                  minHeight: 64,
                  borderBottom: `1px solid ${colors.border}`,
                }}>
                  {proximos30Dias.map((fecha) => (
                    <div key={fecha} style={{
                      borderLeft: `1px solid ${colors.border}`,
                      background: "#fff",
                    }} />
                  ))}

                  {reservasHabitacion.map((reserva) => {
                    let inicio = proximos30Dias.findIndex((f) => f >= reserva.fecha_entrada)
                    let fin = proximos30Dias.findIndex((f) => f >= reserva.fecha_salida)
                    if (inicio < 0) inicio = 0
                    if (fin < 0) fin = 30
                    if (fin <= inicio) return null

                    const confirmada =
                      reserva.estado === "confirmada" ||
                      reserva.estado === "finalizada"

                    return (
                      <div
                        key={reserva.id}
                        onClick={() => setReservaSeleccionada(reserva)}
                        title={`${reserva.nombre_huesped} · ${formatearFecha(reserva.fecha_entrada)} - ${formatearFecha(reserva.fecha_salida)}`}
                        style={{
                          position: "absolute",
                          left: `calc(${inicio} * (100% / 30) + 3px)`,
                          width: `calc(${fin - inicio} * (100% / 30) - 6px)`,
                          top: 10,
                          height: 42,
                          borderRadius: 7,
                          background: confirmada ? colors.blue : "#f5c542",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 9px",
                          boxSizing: "border-box",
                          fontSize: 11,
                          fontWeight: 700,
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          cursor: "pointer",
                          zIndex: 2,
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
      </div>
    )
  }

  function Sidebar() {
    const items = [
      ["dashboard", "▦", "Inicio"],
      ["reservas", "▣", "Reservas"],
      ["calendario", "▤", "Calendario"],
      ["alojamientos", "⌂", "Alojamientos"],
      ["habitaciones", "▥", "Habitaciones"],
    ]

    return (
      <aside style={{
        width: 235,
        background: colors.navyDark,
        color: "#fff",
        minHeight: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 20,
        padding: "22px 14px",
        boxSizing: "border-box",
      }}>
        <div style={{ padding: "6px 12px 30px" }}>
          <div style={{ fontSize: 10, letterSpacing: 2.5, opacity: .75 }}>PLATAFORMA HOTELERA</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>Habitación Llena</div>
        </div>

        <div style={{ fontSize: 11, opacity: .55, padding: "0 12px 8px" }}>GESTIÓN</div>

        {items.map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => {
              setVista(id)
              setMenuAbierto(false)
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "none",
              background: vista === id ? "rgba(255,255,255,.12)" : "transparent",
              color: "#fff",
              padding: "11px 12px",
              borderRadius: 8,
              marginBottom: 4,
              cursor: "pointer",
              textAlign: "left",
              fontSize: 14,
              fontWeight: vista === id ? 700 : 500,
            }}
          >
            <span style={{ width: 20, textAlign: "center", opacity: .9 }}>{icon}</span>
            {label}
          </button>
        ))}

        <div style={{
          position: "absolute",
          bottom: 22,
          left: 26,
          right: 26,
          fontSize: 11,
          opacity: .5,
        }}>
          Habitación Llena · MVP
        </div>
      </aside>
    )
  }

  function Header({ titulo, subtitulo }) {
    return (
      <header style={{
        height: 68,
        background: colors.white,
        borderBottom: `1px solid ${colors.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 30px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{titulo}</div>
          {subtitulo && <div style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{subtitulo}</div>}
        </div>

        <button
          onClick={() => {
            limpiarFormulario()
            setVista("reservas")
          }}
          style={{
            border: "none",
            background: colors.blue,
            color: "#fff",
            borderRadius: 7,
            padding: "10px 15px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Nueva reserva
        </button>
      </header>
    )
  }

  function Dashboard() {
    const recientes = reservas.filter((r) => r.estado !== "cancelada").slice(0, 5)

    return (
      <>
        <Header titulo="Inicio" subtitulo="Resumen de tu operación hotelera" />

        <div style={{ padding: 30 }}>
          <div style={{
            background: `linear-gradient(115deg, ${colors.navyDark}, ${colors.navy})`,
            color: "#fff",
            borderRadius: 14,
            padding: 28,
            marginBottom: 22,
          }}>
            <div style={{ fontSize: 12, opacity: .75, letterSpacing: 1 }}>HABITACIÓN LLENA</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>Buen día 👋</div>
            <div style={{ opacity: .8, marginTop: 7 }}>
              Gestioná reservas y ocupación desde un solo lugar.
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 22,
          }}>
            {[
              ["Alojamientos", alojamientos.length, "Propiedades cargadas"],
              ["Habitaciones", habitacionesActivas.length, "Habitaciones activas"],
              ["Ocupadas hoy", reservasHoy.length, "Reservas actualmente activas"],
              ["Próximas entradas", entradasProximas.length, "En los próximos 7 días"],
            ].map(([label, value, detail]) => (
              <div key={label} style={{
                background: colors.white,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: 20,
              }}>
                <div style={{ color: colors.muted, fontSize: 12 }}>{label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, marginTop: 7 }}>{value}</div>
                <div style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{detail}</div>
              </div>
            ))}
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "1.4fr .8fr",
            gap: 18,
          }}>
            <section style={{
              background: colors.white,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 22,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Próximas reservas</h2>
                  <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Actividad más reciente</div>
                </div>
                <button onClick={() => setVista("reservas")} style={linkButton}>Ver todas</button>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                {recientes.length === 0 ? (
                  <div style={{ color: colors.muted, padding: 25, textAlign: "center" }}>
                    Todavía no hay reservas.
                  </div>
                ) : recientes.map((r) => <ReservaCard key={r.id} reserva={r} />)}
              </div>
            </section>

            <section style={{
              background: colors.white,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 22,
              height: "fit-content",
            }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Ocupación</h2>
              <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                Estado actual de las habitaciones
              </div>

              <div style={{ marginTop: 22 }}>
                {habitacionesActivas.map((h) => {
                  const ocupada = reservasHoy.some(
                    (r) => String(r.habitacion_id) === String(h.id)
                  )
                  return (
                    <div key={h.id} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 0",
                      borderBottom: `1px solid ${colors.border}`,
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{h.nombre}</div>
                        <div style={{ color: colors.muted, fontSize: 11 }}>{nombreAlojamiento(h.alojamiento_id)}</div>
                      </div>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: ocupada ? colors.blue : colors.green,
                      }}>
                        {ocupada ? "Ocupada" : "Disponible"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </>
    )
  }

  function Reservas() {
    return (
      <>
        <Header
          titulo={modoEdicion ? "Editar reserva" : "Reservas"}
          subtitulo={modoEdicion ? "Modificá los datos y guardá los cambios" : "Crear y administrar reservas"}
        />

        <div style={{ padding: 30 }}>
          <section style={cardStyle}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  {modoEdicion ? "Editar reserva" : "Nueva reserva"}
                </h2>
                <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  Los datos se guardan directamente en el sistema.
                </div>
              </div>

              {modoEdicion && (
                <button onClick={limpiarFormulario} style={secondaryButton}>
                  Cancelar edición
                </button>
              )}
            </div>

            <form onSubmit={guardarReserva}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 14,
              }}>
                <Field label="Alojamiento">
                  <select
                    value={alojamientoSeleccionado}
                    onChange={(e) => {
                      setAlojamientoSeleccionado(e.target.value)
                      setHabitacionSeleccionada("")
                    }}
                    style={inputStyle}
                  >
                    <option value="">Seleccionar alojamiento</option>
                    {alojamientos.map((a) => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Habitación">
                  <select
                    value={habitacionSeleccionada}
                    onChange={(e) => setHabitacionSeleccionada(e.target.value)}
                    style={inputStyle}
                    disabled={!alojamientoSeleccionado}
                  >
                    <option value="">Seleccionar habitación</option>
                    {habitacionesDisponibles.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.nombre}{h.tipo ? ` · ${h.tipo}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Nombre del huésped">
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Juan Pérez" style={inputStyle} />
                </Field>

                <Field label="Email">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="huésped@email.com" style={inputStyle} />
                </Field>

                <Field label="Teléfono">
                  <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 9..." style={inputStyle} />
                </Field>

                <Field label="Huéspedes">
                  <input type="number" min="1" value={cantidadHuespedes} onChange={(e) => setCantidadHuespedes(e.target.value)} style={inputStyle} />
                </Field>

                <Field label="Fecha de entrada">
                  <input type="date" value={fechaEntrada} onChange={(e) => setFechaEntrada(e.target.value)} style={inputStyle} />
                </Field>

                <Field label="Fecha de salida">
                  <input type="date" value={fechaSalida} onChange={(e) => setFechaSalida(e.target.value)} style={inputStyle} />
                </Field>

                <Field label="Estado">
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} style={inputStyle}>
                    <option value="pendiente">Pendiente</option>
                    <option value="confirmada">Confirmada</option>
                    <option value="cancelada">Cancelada</option>
                    <option value="finalizada">Finalizada</option>
                  </select>
                </Field>

                <Field label="Notas" wide>
                  <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Información adicional..." style={inputStyle} />
                </Field>
              </div>

              {mensaje && (
                <div style={{
                  marginTop: 15,
                  padding: "11px 13px",
                  borderRadius: 8,
                  background: mensaje.includes("correctamente") ? colors.greenSoft : colors.redSoft,
                  color: mensaje.includes("correctamente") ? colors.green : colors.red,
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                  {mensaje}
                </div>
              )}

              <button type="submit" disabled={cargando} style={{
                ...primaryButton,
                marginTop: 18,
                opacity: cargando ? .65 : 1,
              }}>
                {cargando ? "Guardando..." : modoEdicion ? "Guardar cambios" : "Crear reserva"}
              </button>
            </form>
          </section>

          <section style={{ marginTop: 20 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Reservas cargadas</h2>
                <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  Hacé click en una reserva para ver sus acciones.
                </div>
              </div>
              <div style={{ color: colors.muted, fontSize: 13 }}>{reservas.length} reservas</div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {reservas.length === 0 ? (
                <div style={emptyStyle}>Todavía no hay reservas cargadas.</div>
              ) : reservas.map((r) => <ReservaCard key={r.id} reserva={r} />)}
            </div>
          </section>
        </div>
      </>
    )
  }

  function CalendarioVista() {
    return (
      <>
        <Header titulo="Calendario" subtitulo="Vista de ocupación de los próximos 30 días" />
        <div style={{ padding: 30 }}>
          <section style={cardStyle}>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Calendario de ocupación</h2>
              <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                Hacé click sobre una reserva para editarla.
              </div>
            </div>
            {habitacionesActivas.length === 0 ? (
              <div style={emptyStyle}>No hay habitaciones activas cargadas.</div>
            ) : <Calendario />}
          </section>
        </div>
      </>
    )
  }

  function Alojamientos() {
    return (
      <>
        <Header titulo="Alojamientos" subtitulo="Administrá tus propiedades" />
        <div style={{ padding: 30 }}>
          <section style={cardStyle}>
            <div style={sectionHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Mis alojamientos</h2>
                <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{alojamientos.length} propiedades</div>
              </div>
              <button onClick={() => setMostrarAlojamiento(!mostrarAlojamiento)} style={primaryButton}>
                + Agregar alojamiento
              </button>
            </div>

            {mostrarAlojamiento && (
              <form onSubmit={crearAlojamiento} style={{
                background: "#f8fafc",
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: 16,
                marginBottom: 18,
                display: "flex",
                gap: 10,
              }}>
                <input
                  autoFocus
                  value={nuevoAlojamiento}
                  onChange={(e) => setNuevoAlojamiento(e.target.value)}
                  placeholder="Nombre del alojamiento"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button type="submit" style={primaryButton}>Guardar</button>
                <button type="button" onClick={() => setMostrarAlojamiento(false)} style={secondaryButton}>Cancelar</button>
              </form>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              {alojamientos.map((a) => {
                const cantidad = habitacionesActivas.filter(
                  (h) => String(h.alojamiento_id) === String(a.id)
                ).length
                return (
                  <div key={a.id} style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 17,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{a.nombre}</div>
                      <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                        {cantidad} habitación{cantidad === 1 ? "" : "es"} activa{cantidad === 1 ? "" : "s"}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setNuevoAlojamientoHabitacion(String(a.id))
                        setVista("habitaciones")
                        setMostrarHabitacion(true)
                      }}
                      style={secondaryButton}
                    >
                      + Habitación
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </>
    )
  }

  function Habitaciones() {
    return (
      <>
        <Header titulo="Habitaciones" subtitulo="Administrá las unidades de cada alojamiento" />
        <div style={{ padding: 30 }}>
          <section style={cardStyle}>
            <div style={sectionHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Habitaciones</h2>
                <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{habitacionesActivas.length} activas</div>
              </div>
              <button onClick={() => setMostrarHabitacion(!mostrarHabitacion)} style={primaryButton}>
                + Agregar habitación
              </button>
            </div>

            {mostrarHabitacion && (
              <form onSubmit={crearHabitacion} style={{
                background: "#f8fafc",
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: 16,
                marginBottom: 18,
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1.2fr auto auto",
                gap: 10,
              }}>
                <input value={nuevaHabitacion} onChange={(e) => setNuevaHabitacion(e.target.value)} placeholder="Nombre" style={inputStyle} />
                <input value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} placeholder="Tipo (opcional)" style={inputStyle} />
                <select value={nuevoAlojamientoHabitacion} onChange={(e) => setNuevoAlojamientoHabitacion(e.target.value)} style={inputStyle}>
                  <option value="">Alojamiento</option>
                  {alojamientos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
                <button type="submit" style={primaryButton}>Guardar</button>
                <button type="button" onClick={() => setMostrarHabitacion(false)} style={secondaryButton}>Cancelar</button>
              </form>
            )}

            <div style={{ display: "grid", gap: 9 }}>
              {habitaciones.map((h) => (
                <div key={h.id} style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: 16,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 120px",
                  alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{h.nombre}</div>
                    <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                      {nombreAlojamiento(h.alojamiento_id)}
                    </div>
                  </div>
                  <div style={{ color: colors.muted, fontSize: 13 }}>{h.tipo || "Sin tipo definido"}</div>
                  <span style={{
                    textAlign: "center",
                    padding: "5px 8px",
                    borderRadius: 999,
                    background: h.activa === false ? colors.redSoft : colors.greenSoft,
                    color: h.activa === false ? colors.red : colors.green,
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {h.activa === false ? "Inactiva" : "Activa"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </>
    )
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: colors.bg,
      color: colors.text,
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div className="desktop-sidebar">
        <Sidebar />
      </div>

      <div className="mobile-topbar">
        <button onClick={() => setMenuAbierto(!menuAbierto)} style={{
          border: "none",
          background: "transparent",
          fontSize: 23,
        }}>☰</button>
        <strong>Habitación Llena</strong>
        <button onClick={() => { limpiarFormulario(); setVista("reservas") }} style={{
          border: "none",
          background: colors.blue,
          color: "#fff",
          borderRadius: 7,
          padding: "8px 10px",
          fontWeight: 700,
        }}>+</button>
      </div>

      {menuAbierto && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.35)",
          zIndex: 30,
        }} onClick={() => setMenuAbierto(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 250,
            background: colors.navyDark,
            height: "100%",
            color: "#fff",
            padding: 15,
            boxSizing: "border-box",
          }}>
            <div style={{ fontWeight: 800, fontSize: 20, padding: 12, marginBottom: 20 }}>
              Habitación Llena
            </div>
            {["dashboard", "reservas", "calendario", "alojamientos", "habitaciones"].map((id) => (
              <button key={id} onClick={() => { setVista(id); setMenuAbierto(false) }} style={{
                width: "100%",
                padding: 13,
                border: "none",
                borderRadius: 8,
                marginBottom: 5,
                textAlign: "left",
                color: "#fff",
                background: vista === id ? "rgba(255,255,255,.12)" : "transparent",
              }}>
                {id === "dashboard" ? "▦  Inicio" :
                 id === "reservas" ? "▣  Reservas" :
                 id === "calendario" ? "▤  Calendario" :
                 id === "alojamientos" ? "⌂  Alojamientos" : "▥  Habitaciones"}
              </button>
            ))}
          </div>
        </div>
      )}

      <main style={{ marginLeft: 235, minHeight: "100vh" }}>
        {vista === "dashboard" && <Dashboard />}
        {vista === "reservas" && <Reservas />}
        {vista === "calendario" && <CalendarioVista />}
        {vista === "alojamientos" && <Alojamientos />}
        {vista === "habitaciones" && <Habitaciones />}
      </main>

      {reservaSeleccionada && (
        <div
          onClick={() => setReservaSeleccionada(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.45)",
            zIndex: 100,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(430px, 100%)",
              background: colors.white,
              height: "100%",
              padding: 28,
              boxSizing: "border-box",
              overflowY: "auto",
              boxShadow: "-8px 0 30px rgba(0,0,0,.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Reserva</div>
                <h2 style={{ margin: "5px 0 0", fontSize: 24 }}>{reservaSeleccionada.nombre_huesped}</h2>
              </div>
              <button onClick={() => setReservaSeleccionada(null)} style={{
                border: "none",
                background: "#f3f4f6",
                borderRadius: 50,
                width: 36,
                height: 36,
                fontSize: 20,
                cursor: "pointer",
              }}>×</button>
            </div>

            <div style={{
              marginTop: 25,
              padding: 16,
              borderRadius: 10,
              background: colors.bg,
            }}>
              <Info label="Alojamiento" value={nombreAlojamiento(reservaSeleccionada.alojamiento_id)} />
              <Info label="Habitación" value={nombreHabitacion(reservaSeleccionada.habitacion_id)} />
              <Info label="Entrada" value={formatearFecha(reservaSeleccionada.fecha_entrada)} />
              <Info label="Salida" value={formatearFecha(reservaSeleccionada.fecha_salida)} />
              <Info label="Noches" value={diasEntre(reservaSeleccionada.fecha_entrada, reservaSeleccionada.fecha_salida)} />
              <Info label="Huéspedes" value={reservaSeleccionada.cantidad_huespedes || 1} />
              <Info label="Estado" value={estadoBadge(reservaSeleccionada.estado).label} />
              {reservaSeleccionada.email_huesped && <Info label="Email" value={reservaSeleccionada.email_huesped} />}
              {reservaSeleccionada.telefono_huesped && <Info label="Teléfono" value={reservaSeleccionada.telefono_huesped} />}
            </div>

            {reservaSeleccionada.notas && (
              <div style={{ marginTop: 20 }}>
                <div style={{ color: colors.muted, fontSize: 12, marginBottom: 5 }}>Notas</div>
                <div style={{ padding: 13, background: "#f8fafc", borderRadius: 8, fontSize: 14 }}>
                  {reservaSeleccionada.notas}
                </div>
              </div>
            )}

            <div style={{ display: "grid", gap: 9, marginTop: 28 }}>
              <button onClick={() => editarReserva(reservaSeleccionada)} style={primaryButton}>
                Editar reserva
              </button>
              {reservaSeleccionada.estado !== "cancelada" && (
                <button onClick={() => cancelarReserva(reservaSeleccionada)} style={{
                  ...secondaryButton,
                  color: colors.red,
                  borderColor: "#f2caca",
                }}>
                  Cancelar reserva
                </button>
              )}
              <button onClick={() => setReservaSeleccionada(null)} style={secondaryButton}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        * { box-sizing: border-box; }
        button, input, select { font-family: inherit; }
        button { transition: opacity .15s, transform .15s; }
        button:hover { opacity: .92; }
        @media (max-width: 900px) {
          .desktop-sidebar { display: none; }
          .mobile-topbar { display: flex !important; }
          main { margin-left: 0 !important; padding-top: 58px; }
        }
        @media (min-width: 901px) {
          .mobile-topbar { display: none !important; }
        }
        @media (max-width: 760px) {
          form > div { grid-template-columns: 1fr !important; }
          section { max-width: 100%; }
        }
      `}</style>
    </div>
  )
}

function Field({ label, children, wide }) {
  return (
    <div style={{ gridColumn: wide ? "span 2" : "span 1" }}>
      <label style={{
        display: "block",
        fontSize: 12,
        fontWeight: 700,
        color: colors.muted,
        marginBottom: 6,
      }}>{label}</label>
      {children}
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      gap: 15,
      padding: "10px 0",
      borderBottom: `1px solid ${colors.border}`,
      fontSize: 13,
    }}>
      <span style={{ color: colors.muted }}>{label}</span>
      <strong style={{ textAlign: "right" }}>{value}</strong>
    </div>
  )
}

const cardStyle = {
  background: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  padding: 22,
}

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
  gap: 15,
}

const primaryButton = {
  border: "none",
  background: colors.blue,
  color: "#fff",
  borderRadius: 7,
  padding: "10px 15px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
}

const secondaryButton = {
  border: `1px solid ${colors.border}`,
  background: colors.white,
  color: colors.text,
  borderRadius: 7,
  padding: "9px 14px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
}

const linkButton = {
  border: "none",
  background: "transparent",
  color: colors.blue,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 12,
}

const emptyStyle = {
  background: "#f8fafc",
  border: `1px dashed ${colors.border}`,
  borderRadius: 10,
  padding: 30,
  textAlign: "center",
  color: colors.muted,
  fontSize: 13,
}
