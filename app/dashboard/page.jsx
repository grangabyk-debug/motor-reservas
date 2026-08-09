"use client"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

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
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [alojamientos, setAlojamientos] = useState([])
  const [habitaciones, setHabitaciones] = useState([])
  const [reservas, setReservas] = useState([])

  const [vista, setVista] = useState("dashboard")
  const [menuAbierto, setMenuAbierto] = useState(false)

  const [config, setConfig] = useState({
    logo: "",
    nombreMarca: "Habitación Llena",
    whatsapp: "",
    bookingUrl: "",
    expediaUrl: "",
    airbnbUrl: "",
    despegarUrl: "",
    webUrl: "",
    tarifas: {
      simple: 0,
      doble: 0,
      triple: 0,
      cuadruple: 0,
      otro: 0,
      cochera: 0,
      extra: 0,
    },
  })

  const logoHabitacionLlena = "/logo-habitacion-llena.png"

  function saludoSegunHorario() {
    const hora = new Date().getHours()
    if (hora >= 6 && hora < 13) return "Buenos días"
    if (hora >= 13 && hora < 20) return "Buenas tardes"
    return "Buenas noches"
  }

  const [assistantMessages, setAssistantMessages] = useState([
    {
      role: "assistant",
      content: "Hola. Soy el asistente de Habitación Llena. Puedo ayudarte a interpretar reservas, ocupación y rendimiento de tu alojamiento.",
    },
  ])
  const [assistantInput, setAssistantInput] = useState("")
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [configGuardada, setConfigGuardada] = useState(false)
  const [configSubvista, setConfigSubvista] = useState("general")
  const [fechaCalendario, setFechaCalendario] = useState(fechaLocal(0))
  const [busquedaReserva, setBusquedaReserva] = useState("")
  const [earlyCheckin, setEarlyCheckin] = useState(false)
  const [lateCheckout, setLateCheckout] = useState(false)
  const [noShow, setNoShow] = useState(false)

  const [alojamientoSeleccionado, setAlojamientoSeleccionado] = useState("")

  const nombreAlojamientoActivo = alojamientos.find(
    (a) => String(a.id) === String(alojamientoSeleccionado)
  )?.nombre || alojamientos[0]?.nombre || "tu alojamiento"
  const [habitacionSeleccionada, setHabitacionSeleccionada] = useState("")
  const [nombre, setNombre] = useState("")
  const [dni, setDni] = useState("")
  const [esMenor, setEsMenor] = useState(false)
  const [pasajerosExtra, setPasajerosExtra] = useState([])
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [fechaEntrada, setFechaEntrada] = useState("")
  const [fechaSalida, setFechaSalida] = useState("")
  const [cantidadHuespedes, setCantidadHuespedes] = useState("1")
  const [estado, setEstado] = useState("pendiente")
  const [notas, setNotas] = useState("")
  const [vehiculos, setVehiculos] = useState("0")
  const [extraReserva, setExtraReserva] = useState("0")

  const [reservaSeleccionada, setReservaSeleccionada] = useState(null)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(false)
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [habitacionEstados, setHabitacionEstados] = useState([])
  const [bloqueos, setBloqueos] = useState([])
  const [pagos, setPagos] = useState([])
  const [pagoMonto, setPagoMonto] = useState("")
  const [pagoMetodo, setPagoMetodo] = useState("Efectivo")
  const [pagoNota, setPagoNota] = useState("")
  const [busquedaHuesped, setBusquedaHuesped] = useState("")
  const [bloqueoHabitacion, setBloqueoHabitacion] = useState("")
  const [bloqueoInicio, setBloqueoInicio] = useState(fechaLocal(0))
  const [bloqueoFin, setBloqueoFin] = useState(fechaLocal(1))
  const [bloqueoMotivo, setBloqueoMotivo] = useState("Mantenimiento")
  const [bloqueoDetalle, setBloqueoDetalle] = useState("")
  const [checklistHousekeeping, setChecklistHousekeeping] = useState({})

  const [mostrarAlojamiento, setMostrarAlojamiento] = useState(false)
  const [nuevoAlojamiento, setNuevoAlojamiento] = useState("")
  const [mostrarHabitacion, setMostrarHabitacion] = useState(false)
  const [nuevaHabitacion, setNuevaHabitacion] = useState("")
  const [nuevoTipo, setNuevoTipo] = useState("")
  const [nuevoAlojamientoHabitacion, setNuevoAlojamientoHabitacion] = useState("")

  const diasCalendario = useMemo(
    () => Array.from({ length: 38 }, (_, i) => {
      const base = new Date(`${fechaCalendario}T12:00:00`)
      base.setDate(base.getDate() + i - 7)
      const año = base.getFullYear()
      const mes = String(base.getMonth() + 1).padStart(2, "0")
      const dia = String(base.getDate()).padStart(2, "0")
      return `${año}-${mes}-${dia}`
    }),
    [fechaCalendario]
  )

  useEffect(() => {
    let mounted = true

    async function iniciarSesion() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!mounted) return

        if (!session?.user) {
          setAuthLoading(false)
          window.location.href = "/login"
          return
        }

        setUser(session.user)
        setAuthLoading(false)

        try {
          const claveConfig = `habitacion_llena_config_${session.user.id}`
          const guardada = localStorage.getItem(claveConfig)

          if (guardada) {
            setConfig((actual) => ({
              ...actual,
              ...JSON.parse(guardada),
            }))
          }
        } catch (error) {
          console.error("No se pudo cargar la configuración local:", error)
        }
      } catch (error) {
        console.error("No se pudo comprobar la sesión:", error)
        if (mounted) {
          setAuthLoading(false)
        }
      }
    }

    iniciarSesion()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (user?.id) {
      cargarDatos()
    }
  }, [user])

  async function cargarDatos() {
    if (!user?.id) return

    const [
      { data: alojamientosData, error: alojamientosError },
      { data: habitacionesData, error: habitacionesError },
      { data: reservasData, error: reservasError },
      { data: bloqueosData, error: bloqueosError },
      { data: pagosData, error: pagosError },
    ] = await Promise.all([
      supabase.from("alojamientos").select("*").eq("user_id", user.id).order("id", { ascending: true }),
      supabase.from("habitaciones").select("*").eq("user_id", user.id).order("id", { ascending: true }),
      supabase.from("reservas").select("*").eq("user_id", user.id).order("id", { ascending: false }),
      supabase.from("bloqueos").select("*").eq("user_id", user.id).order("fecha_desde", { ascending: true }),
      supabase.from("pagos").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ])

    if (alojamientosError) console.error(alojamientosError)
    if (habitacionesError) console.error(habitacionesError)
    if (reservasError) console.error(reservasError)
    if (bloqueosError) console.warn("No se pudieron cargar los bloqueos. Ejecutá la migración PMS.", bloqueosError)
    if (pagosError) console.warn("No se pudieron cargar los pagos. Ejecutá la migración PMS.", pagosError)

    setAlojamientos(alojamientosData || [])
    setHabitaciones(habitacionesData || [])
    setReservas(reservasData || [])
    setHabitacionEstados((habitacionesData || []).map((h) => ({ habitacion_id: h.id, estado: h.estado || "libre" })))
    setBloqueos(bloqueosData || [])
    setPagos(pagosData || [])
  }

  const habitacionesActivas = habitaciones.filter((h) => h.activa !== false)

  const habitacionesDisponibles = habitaciones.filter(
    (h) =>
      String(h.alojamiento_id) === String(alojamientoSeleccionado) &&
      h.activa !== false
  )

  const reservasActivas = reservas.filter((r) => r.estado !== "cancelada" && !r.no_show)

  const reservasHoy = reservasActivas.filter(
    (r) => r.fecha_entrada <= fechaLocal(0) && r.fecha_salida > fechaLocal(0)
  )

  const entradasProximas = reservasActivas.filter(
    (r) => r.fecha_entrada >= fechaLocal(0) && r.fecha_entrada <= fechaLocal(7)
  )

  const salidasHoy = reservas.filter(
    (r) => r.estado !== "cancelada" && !r.no_show && r.fecha_salida === fechaLocal(0)
  )

  const entradasHoy = reservas.filter(
    (r) => r.estado !== "cancelada" && !r.no_show && r.fecha_entrada === fechaLocal(0)
  )

  const reservasFiltradas = reservas.filter((r) => {
    const q = busquedaReserva.trim().toLowerCase()
    if (!q) return true
    return [
      r.numero_reserva,
      r.nombre_huesped,
      r.dni_huesped,
      r.email_huesped,
    ].some((valor) => String(valor || "").toLowerCase().includes(q))
  })

  const nombreAlojamiento = (id) => {
    const item = alojamientos.find((a) => String(a.id) === String(id))
    return item ? item.nombre : "Sin alojamiento"
  }

  const nombreHabitacion = (id) => {
    const item = habitaciones.find((h) => String(h.id) === String(id))
    return item ? item.nombre : "Sin habitación"
  }

  const estadosHabitacion = [
    { key: "libre", label: "Libre / limpia", color: colors.green, bg: colors.greenSoft },
    { key: "ocupada", label: "Ocupada", color: colors.blue, bg: colors.blueSoft },
    { key: "sucia", label: "Sucia", color: "#9a6700", bg: colors.yellowSoft },
    { key: "en_limpieza", label: "En limpieza", color: "#c2410c", bg: "#fff1e8" },
    { key: "fuera_servicio", label: "Fuera de servicio", color: colors.red, bg: colors.redSoft },
    { key: "reservada", label: "Reservada", color: "#6d28d9", bg: "#f1e9ff" },
  ]

  function estadoHabitacionManual(id) {
    return habitaciones.find((h) => String(h.id) === String(id))?.estado || "libre"
  }

  function estadoHabitacionVisual(habitacion) {
    const manual = estadoHabitacionManual(habitacion.id)
    if (manual === "fuera_servicio") return "fuera_servicio"
    const hoy = fechaLocal(0)
    const ocupada = reservas.some((r) => String(r.habitacion_id) === String(habitacion.id) && r.estado !== "cancelada" && !r.no_show && r.fecha_entrada <= hoy && r.fecha_salida > hoy)
    if (ocupada) return "ocupada"
    const futura = reservas.some((r) => String(r.habitacion_id) === String(habitacion.id) && r.estado !== "cancelada" && !r.no_show && r.fecha_entrada > hoy && r.fecha_entrada <= fechaLocal(30))
    if (manual === "libre" && futura) return "reservada"
    return manual
  }

  function infoEstadoHabitacion(estado) {
    return estadosHabitacion.find((e) => e.key === estado) || estadosHabitacion[0]
  }

  async function cambiarEstadoHabitacion(habitacionId, estado) {
    const { error } = await supabase.from("habitaciones").update({ estado }).eq("id", Number(habitacionId)).eq("user_id", user.id)
    if (error) {
      console.error(error)
      alert("No se pudo actualizar el estado. Verificá la migración PMS.")
      return
    }
    await cargarDatos()
  }

  function bloquesSeCruzan(inicioA, finA, inicioB, finB) {
    return inicioA < finB && finA > inicioB
  }

  function bloqueoParaHabitacion(habitacionId, inicio, fin) {
    return bloqueos.find((b) => String(b.habitacion_id) === String(habitacionId) && bloquesSeCruzan(inicio, fin, b.fecha_desde, b.fecha_hasta))
  }

  async function crearBloqueo(e) {
    e.preventDefault()
    if (!bloqueoHabitacion || !bloqueoInicio || !bloqueoFin || bloqueoFin <= bloqueoInicio) {
      alert("Completá habitación y fechas válidas.")
      return
    }
    const { error } = await supabase.from("bloqueos").insert([{
      user_id: user.id,
      habitacion_id: Number(bloqueoHabitacion),
      fecha_desde: bloqueoInicio,
      fecha_hasta: bloqueoFin,
      motivo: bloqueoMotivo,
      detalle: bloqueoDetalle.trim(),
    }])
    if (error) {
      console.error(error)
      alert("No se pudo crear el bloqueo. Verificá la migración PMS.")
      return
    }
    setBloqueoDetalle("")
    await cargarDatos()
  }

  async function eliminarBloqueo(id) {
    if (!confirm("¿Eliminar este bloqueo?")) return
    const { error } = await supabase.from("bloqueos").delete().eq("id", id).eq("user_id", user.id)
    if (error) {
      console.error(error)
      alert("No se pudo eliminar el bloqueo.")
      return
    }
    await cargarDatos()
  }

  function totalPagado(reservaId) {
    return pagos.filter((p) => String(p.reserva_id) === String(reservaId)).reduce((s, p) => s + Number(p.monto || 0), 0)
  }

  function saldoReserva(reserva) {
    return Math.max(0, Number(reserva?.precio_total || 0) - totalPagado(reserva?.id))
  }

  async function registrarPago(reserva) {
    const monto = Number(pagoMonto)
    if (!monto || monto <= 0) {
      alert("Ingresá un importe válido.")
      return
    }
    if (monto > saldoReserva(reserva) + 0.01) {
      alert("El pago supera el saldo pendiente.")
      return
    }
    const { error } = await supabase.from("pagos").insert([{
      user_id: user.id,
      reserva_id: reserva.id,
      monto,
      metodo: pagoMetodo,
      nota: pagoNota.trim(),
      created_at: new Date().toISOString(),
    }])
    if (error) {
      console.error(error)
      alert("No se pudo registrar el pago. Verificá la migración PMS.")
      return
    }
    setPagoMonto("")
    setPagoNota("")
    await cargarDatos()
    const actualizada = reservas.find((r) => String(r.id) === String(reserva.id))
    if (actualizada) setReservaSeleccionada(actualizada)
  }

  const huespedesCRM = useMemo(() => {
    const mapa = new Map()
    reservas.filter((r) => r.estado !== "cancelada").forEach((r) => {
      const key = `${String(r.dni_huesped || "").toLowerCase()}|${String(r.nombre_huesped || "").toLowerCase()}`
      if (!mapa.has(key)) mapa.set(key, { nombre: r.nombre_huesped || "Sin nombre", dni: r.dni_huesped || "", email: r.email_huesped || "", telefono: r.telefono_huesped || "", estadias: 0, gasto: 0, ultima: r.fecha_salida || "" })
      const item = mapa.get(key)
      item.estadias += 1
      item.gasto += Number(r.precio_total || 0)
      if (r.fecha_salida > item.ultima) item.ultima = r.fecha_salida
      if (!item.email && r.email_huesped) item.email = r.email_huesped
      if (!item.telefono && r.telefono_huesped) item.telefono = r.telefono_huesped
    })
    return Array.from(mapa.values()).sort((a, b) => b.estadias - a.estadias)
  }, [reservas])

  function checklistKey(habitacionId) {
    return `${user?.id || ""}_${fechaLocal(0)}_${habitacionId}`
  }

  function checklistEstado(habitacionId) {
    const key = checklistKey(habitacionId)
    return checklistHousekeeping[key] || { cama: false, bano: false, toallas: false, amenities: false, piso: false, residuos: false, controles: false, minibar: false }
  }

  function cambiarChecklist(habitacionId, item, valor) {
    const key = checklistKey(habitacionId)
    setChecklistHousekeeping((actual) => ({ ...actual, [key]: { ...checklistEstado(habitacionId), [item]: valor } }))
  }

  async function finalizarLimpieza(habitacionId) {
    await cambiarEstadoHabitacion(habitacionId, "libre")
  }

  function textoPlantillaComunicacion(tipo, reserva) {
    const nombre = reserva?.nombre_huesped || "huésped"
    const alojamiento = nombreAlojamiento(reserva?.alojamiento_id)
    if (tipo === "confirmacion") return `Hola ${nombre}, te confirmamos tu reserva ${reserva?.numero_reserva || ""} en ${alojamiento}. Entrada: ${formatearFecha(reserva?.fecha_entrada)}. Salida: ${formatearFecha(reserva?.fecha_salida)}. ¡Te esperamos!`
    if (tipo === "checkin") return `Hola ${nombre}, te esperamos hoy en ${alojamiento}. Tu reserva es ${reserva?.numero_reserva || ""}. Si necesitás indicaciones para el ingreso, estamos para ayudarte.`
    if (tipo === "checkout") return `Hola ${nombre}, te recordamos que tu salida de ${alojamiento} es el ${formatearFecha(reserva?.fecha_salida)}. ¡Gracias por tu estadía!`
    return `Hola ${nombre}, gracias por haberte hospedado en ${alojamiento}. Esperamos verte nuevamente.`
  }

  function limpiarFormulario() {
    setAlojamientoSeleccionado("")
    setHabitacionSeleccionada("")
    setNombre("")
    setDni("")
    setEsMenor(false)
    setPasajerosExtra([])
    setEmail("")
    setTelefono("")
    setFechaEntrada("")
    setFechaSalida("")
    setCantidadHuespedes("1")
    setEstado("pendiente")
    setNotas("")
    setVehiculos("0")
    setExtraReserva(String(config.tarifas?.extra ?? 0))
    setEarlyCheckin(false)
    setLateCheckout(false)
    setNoShow(false)
    setReservaSeleccionada(null)
    setModoEdicion(false)
  }

  function editarReserva(reserva) {
    setReservaSeleccionada(reserva)
    setModoEdicion(true)
    setAlojamientoSeleccionado(String(reserva.alojamiento_id))
    setHabitacionSeleccionada(String(reserva.habitacion_id))
    setNombre(reserva.nombre_huesped || "")
    setDni(reserva.dni_huesped || "")
    setEsMenor(Boolean(reserva.es_menor))
    setEmail(reserva.email_huesped || "")
    setTelefono(reserva.telefono_huesped || "")

    let extras = []
    try {
      const lista = Array.isArray(reserva.pasajeros)
        ? reserva.pasajeros
        : typeof reserva.pasajeros === "string"
          ? JSON.parse(reserva.pasajeros)
          : []
      extras = Array.isArray(lista)
        ? lista.filter((p) => p && p.principal !== true).map((p) => ({
            nombre: p.nombre || "",
            dni: p.dni || "",
            menor: Boolean(p.menor),
          }))
        : []
    } catch (error) {
      console.warn("No se pudieron leer los pasajeros adicionales", error)
    }
    setPasajerosExtra(extras)
    setFechaEntrada(reserva.fecha_entrada || "")
    setFechaSalida(reserva.fecha_salida || "")
    setCantidadHuespedes(String(reserva.cantidad_huespedes || 1))
    setEstado(reserva.estado || "pendiente")
    setNoShow(Boolean(reserva.no_show))
    setEarlyCheckin(Boolean(reserva.early_checkin))
    setLateCheckout(Boolean(reserva.late_checkout))
    setNotas(reserva.notas || "")
    setVehiculos(String(reserva.vehiculos ?? reserva.cochera_cantidad ?? 0))
    setExtraReserva(String(reserva.extra ?? reserva.extras ?? 0))
    setVista("reservas")
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50)
  }

  function claveTipoHabitacion(tipo) {
    const valor = String(tipo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (valor.includes("simple") || valor.includes("single") || valor.includes("individual")) return "simple"
    if (valor.includes("doble") || valor.includes("double")) return "doble"
    if (valor.includes("triple")) return "triple"
    if (valor.includes("cuadruple") || valor.includes("cuadruple")) return "cuadruple"
    return "otro"
  }

  function tarifaDeHabitacion(habitacionId) {
    const habitacion = habitaciones.find((h) => String(h.id) === String(habitacionId))
    const clave = claveTipoHabitacion(habitacion?.tipo)
    return Number(config.tarifas?.[clave] || 0)
  }

  function calcularImporteReserva() {
    if (!habitacionSeleccionada || !fechaEntrada || !fechaSalida) {
      return { noches: 0, tarifaNoche: 0, alojamiento: 0, cochera: 0, extra: Number(extraReserva) || 0, total: Number(extraReserva) || 0 }
    }

    const noches = diasEntre(fechaEntrada, fechaSalida)
    const tarifaNoche = tarifaDeHabitacion(habitacionSeleccionada)
    const alojamiento = tarifaNoche * noches
    const cochera = (Number(vehiculos) || 0) * (Number(config.tarifas?.cochera) || 0) * noches
    const extra = Number(extraReserva) || 0

    return {
      noches,
      tarifaNoche,
      alojamiento,
      cochera,
      extra,
      total: alojamiento + cochera + extra,
    }
  }

  function agregarPasajeroExtra() {
    setPasajerosExtra((actuales) => [
      ...actuales,
      { nombre: "", dni: "", menor: false },
    ])
  }

  function actualizarPasajeroExtra(indice, campo, valor) {
    setPasajerosExtra((actuales) => actuales.map((pasajero, i) => (
      i === indice ? { ...pasajero, [campo]: valor } : pasajero
    )))
  }

  function eliminarPasajeroExtra(indice) {
    setPasajerosExtra((actuales) => actuales.filter((_, i) => i !== indice))
  }

  function obtenerPasajerosReserva() {
    const principal = {
      principal: true,
      nombre: nombre.trim(),
      dni: dni.trim(),
      menor: Boolean(esMenor),
    }

    const extras = pasajerosExtra
      .filter((p) => p.nombre.trim())
      .map((p) => ({
        principal: false,
        nombre: p.nombre.trim(),
        dni: String(p.dni || "").trim(),
        menor: Boolean(p.menor),
      }))

    return [principal, ...extras]
  }

  function obtenerListaPasajeros(reserva) {
    try {
      const lista = Array.isArray(reserva?.pasajeros)
        ? reserva.pasajeros
        : typeof reserva?.pasajeros === "string"
          ? JSON.parse(reserva.pasajeros)
          : []

      if (Array.isArray(lista) && lista.length) return lista
    } catch (error) {
      console.warn("No se pudo leer la lista de pasajeros", error)
    }

    return [{
      principal: true,
      nombre: reserva?.nombre_huesped || "",
      dni: reserva?.dni_huesped || "",
      menor: Boolean(reserva?.es_menor),
    }]
  }

  function textoResumenReserva(reserva) {
    const pasajeros = obtenerListaPasajeros(reserva)
    const noches = Number(reserva?.noches) || diasEntre(reserva.fecha_entrada, reserva.fecha_salida)
    const tarifaNoche = Number(reserva?.tarifa_noche) || 0
    const cocheraTotal = Number(reserva?.cochera_total) || 0
    const extra = Number(reserva?.extra) || 0
    const total = Number(reserva?.precio_total) || 0

    const detallePasajeros = pasajeros.map((p, i) =>
      `${i + 1}. ${p.nombre || "Sin nombre"}${p.dni ? ` · DNI ${p.dni}` : ""}${p.menor ? " · Menor" : ""}`
    ).join("\n")

    return [
      `Reserva ${reserva.numero_reserva || ""} · ${nombreAlojamiento(reserva.alojamiento_id)}`,
      "",
      `Huésped principal: ${reserva.nombre_huesped || "-"}`,
      reserva.dni_huesped ? `DNI: ${reserva.dni_huesped}` : "",
      "",
      "Pasajeros:",
      detallePasajeros,
      "",
      `Habitación: ${nombreHabitacion(reserva.habitacion_id)}`,
      `Entrada: ${formatearFecha(reserva.fecha_entrada)}`,
      `Salida: ${formatearFecha(reserva.fecha_salida)}`,
      `Noches: ${noches}`,
      `Tarifa por noche: $${tarifaNoche.toLocaleString("es-AR")}`,
      `Cochera: $${cocheraTotal.toLocaleString("es-AR")}`,
      `Extra: $${extra.toLocaleString("es-AR")}`,
      `TOTAL: $${total.toLocaleString("es-AR")}`,
      "",
      `Estado: ${estadoBadge(reserva.estado).label}`,
      reserva.telefono_huesped ? `Teléfono: ${reserva.telefono_huesped}` : "",
      reserva.notas ? `Notas: ${reserva.notas}` : "",
      "",
      "Gracias por reservar con nosotros.",
    ].filter(Boolean).join("\n")
  }

  function enviarResumenPorEmail(reserva) {
    const destinatario = String(reserva?.email_huesped || "").trim()
    if (!destinatario) {
      alert("Esta reserva no tiene un email cargado.")
      return
    }

    const asunto = `Resumen de reserva · ${nombreAlojamiento(reserva.alojamiento_id)}`
    const cuerpo = textoResumenReserva(reserva)
    window.location.href = `mailto:${encodeURIComponent(destinatario)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
  }

  function generarNumeroReserva() {
    const fecha = fechaLocal(0).replace(/-/g, "")
    let numero = ""
    do {
      numero = `HL-${fecha}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    } while (reservas.some((r) => r.numero_reserva === numero))
    return numero
  }

  async function agregarNoches(reserva, cantidad = 1) {
    const salidaActual = new Date(`${reserva.fecha_salida}T12:00:00`)
    salidaActual.setDate(salidaActual.getDate() + cantidad)
    const nuevaSalida = `${salidaActual.getFullYear()}-${String(salidaActual.getMonth()+1).padStart(2,"0")}-${String(salidaActual.getDate()).padStart(2,"0")}`

    const { data: existentes, error: errorBusqueda } = await supabase
      .from("reservas")
      .select("id,fecha_entrada,fecha_salida")
      .eq("habitacion_id", reserva.habitacion_id)
      .eq("user_id", user.id)
      .neq("id", reserva.id)
      .neq("estado", "cancelada")
      .eq("no_show", false)

    if (errorBusqueda) {
      alert("No se pudo verificar la disponibilidad.")
      return
    }

    const hayCruce = (existentes || []).some((r) => reserva.fecha_salida < r.fecha_salida && nuevaSalida > r.fecha_entrada)
    if (hayCruce) {
      alert("No se puede agregar la noche porque la habitación ya tiene otra reserva.")
      return
    }

    const noches = diasEntre(reserva.fecha_entrada, nuevaSalida)
    const tarifaNoche = Number(reserva.tarifa_noche || 0)
    const cocheraPorNoche = Number(config.tarifas?.cochera || 0)
    const vehiculosReserva = Number(reserva.vehiculos || 0)
    const extra = Number(reserva.extra || 0)
    const precioTotal = tarifaNoche * noches + cocheraPorNoche * vehiculosReserva * noches + extra

    const { error } = await supabase
      .from("reservas")
      .update({
        fecha_salida: nuevaSalida,
        noches,
        precio_total: precioTotal,
        cochera_total: cocheraPorNoche * vehiculosReserva * noches,
      })
      .eq("id", reserva.id)
      .eq("user_id", user.id)

    if (error) {
      console.error(error)
      alert("No se pudo agregar la noche.")
      return
    }

    setReservaSeleccionada(null)
    await cargarDatos()
  }

  function imprimirHTML(titulo, contenido) {
    const ventana = window.open("", "_blank", "width=1000,height=800")
    if (!ventana) {
      alert("El navegador bloqueó la ventana de impresión. Permití ventanas emergentes para este sitio.")
      return
    }
    ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title><style>body{font-family:Arial,sans-serif;color:#222;padding:28px}h1{margin:0 0 6px}h2{margin-top:26px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#f2f4f7}.muted{color:#666;font-size:12px}.total{font-size:18px;font-weight:700}.badge{display:inline-block;padding:4px 8px;border-radius:12px;background:#eee}</style></head><body>${contenido}</body></html>`)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 250)
  }

  function imprimirReserva(reserva) {
    const pasajeros = obtenerListaPasajeros(reserva)
    imprimirHTML(`Reserva ${reserva.numero_reserva || ""}`, `
      <h1>${config.nombreMarca || "Habitación Llena"}</h1>
      <div class="muted">Resumen de reserva</div>
      <h2>${reserva.numero_reserva || "Reserva"} · ${reserva.nombre_huesped || ""}</h2>
      <table><tr><th>Alojamiento</th><td>${nombreAlojamiento(reserva.alojamiento_id)}</td></tr><tr><th>Habitación</th><td>${nombreHabitacion(reserva.habitacion_id)}</td></tr><tr><th>Entrada</th><td>${formatearFecha(reserva.fecha_entrada)}</td></tr><tr><th>Salida</th><td>${formatearFecha(reserva.fecha_salida)}</td></tr><tr><th>Noches</th><td>${reserva.noches || diasEntre(reserva.fecha_entrada,reserva.fecha_salida)}</td></tr><tr><th>Estado</th><td>${estadoBadge(reserva.estado).label}${reserva.no_show ? " · NO SHOW" : ""}</td></tr></table>
      <h2>Pasajeros</h2><table><tr><th>#</th><th>Nombre</th><th>DNI</th><th>Menor</th></tr>${pasajeros.map((p,i)=>`<tr><td>${i+1}</td><td>${p.nombre || ""}</td><td>${p.dni || ""}</td><td>${p.menor ? "Sí" : "No"}</td></tr>`).join("")}</table>
      <h2>Importes</h2><table><tr><th>Habitación</th><td>$${Number(reserva.tarifa_noche||0).toLocaleString("es-AR")} / noche</td></tr><tr><th>Cochera</th><td>$${Number(reserva.cochera_total||0).toLocaleString("es-AR")}</td></tr><tr><th>Extra</th><td>$${Number(reserva.extra||0).toLocaleString("es-AR")}</td></tr><tr><th>Total</th><td class="total">$${Number(reserva.precio_total||0).toLocaleString("es-AR")}</td></tr></table>
      ${reserva.notas ? `<h2>Notas</h2><p>${reserva.notas}</p>` : ""}`)
  }

  function imprimirReservas() {
    const lista = reservasFiltradas
    imprimirHTML("Listado de reservas", `<h1>${config.nombreMarca || "Habitación Llena"}</h1><div class="muted">Listado generado el ${formatearFecha(fechaLocal(0))}</div><table><tr><th>Nº reserva</th><th>Huésped</th><th>Habitación</th><th>Entrada</th><th>Salida</th><th>Huéspedes</th><th>Estado</th><th>Total</th></tr>${lista.map(r=>`<tr><td>${r.numero_reserva||"—"}</td><td>${r.nombre_huesped||""}</td><td>${nombreHabitacion(r.habitacion_id)}</td><td>${formatearFecha(r.fecha_entrada)}</td><td>${formatearFecha(r.fecha_salida)}</td><td>${r.cantidad_huespedes||1}</td><td>${r.no_show?"No show":estadoBadge(r.estado).label}</td><td>$${Number(r.precio_total||0).toLocaleString("es-AR")}</td></tr>`).join("")}</table>`)
  }

  function imprimirPlanillaIn(fecha = fechaLocal(0)) {
    const lista = reservas.filter(r => r.estado !== "cancelada" && !r.no_show && r.fecha_entrada === fecha)
    imprimirHTML(`IN ${formatearFecha(fecha)}`, `<h1>${config.nombreMarca || "Habitación Llena"}</h1><h2>Planilla de IN · ${formatearFecha(fecha)}</h2><table><tr><th>Habitación</th><th>Nº reserva</th><th>Huésped principal</th><th>Pasajeros</th><th>DNI</th><th>Teléfono</th><th>Early</th><th>Notas</th></tr>${lista.map(r=>`<tr><td>${nombreHabitacion(r.habitacion_id)}</td><td>${r.numero_reserva||"—"}</td><td>${r.nombre_huesped||""}</td><td>${r.cantidad_huespedes||1}</td><td>${r.dni_huesped||""}</td><td>${r.telefono_huesped||""}</td><td>${r.early_checkin?"Sí":"No"}</td><td>${r.notas||""}</td></tr>`).join("")}</table>`)
  }

  function imprimirHousekeeping(fecha = fechaLocal(0)) {
    const outs = reservas.filter(r => r.estado !== "cancelada" && r.fecha_salida === fecha)
    const ins = reservas.filter(r => r.estado !== "cancelada" && !r.no_show && r.fecha_entrada === fecha)
    imprimirHTML(`Housekeeping ${formatearFecha(fecha)}`, `<h1>${config.nombreMarca || "Habitación Llena"}</h1><h2>Housekeeping · ${formatearFecha(fecha)}</h2><h3>OUT del día (${outs.length})</h3><table><tr><th>Habitación</th><th>Huésped</th><th>Nº reserva</th><th>Pasajeros</th><th>Late check-out</th><th>Notas</th></tr>${outs.map(r=>`<tr><td>${nombreHabitacion(r.habitacion_id)}</td><td>${r.nombre_huesped||""}</td><td>${r.numero_reserva||"—"}</td><td>${r.cantidad_huespedes||1}</td><td>${r.late_checkout?"Sí":"No"}</td><td>${r.notas||""}</td></tr>`).join("")}</table><h3>IN del día (${ins.length})</h3><table><tr><th>Habitación</th><th>Huésped</th><th>Nº reserva</th><th>Pasajeros</th><th>Early check-in</th></tr>${ins.map(r=>`<tr><td>${nombreHabitacion(r.habitacion_id)}</td><td>${r.nombre_huesped||""}</td><td>${r.numero_reserva||"—"}</td><td>${r.cantidad_huespedes||1}</td><td>${r.early_checkin?"Sí":"No"}</td></tr>`).join("")}</table>`)
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

    const bloqueo = bloqueoParaHabitacion(habitacionSeleccionada, fechaEntrada, fechaSalida)
    if (bloqueo) {
      setMensaje(`La habitación está bloqueada del ${formatearFecha(bloqueo.fecha_desde)} al ${formatearFecha(bloqueo.fecha_hasta)} (${bloqueo.motivo}).`)
      setCargando(false)
      return
    }

    const calculo = calcularImporteReserva()

    const datos = {
      alojamiento_id: Number(alojamientoSeleccionado),
      habitacion_id: Number(habitacionSeleccionada),
      nombre_huesped: nombre.trim(),
      dni_huesped: dni.trim(),
      es_menor: Boolean(esMenor),
      pasajeros: obtenerPasajerosReserva(),
      email_huesped: email.trim(),
      telefono_huesped: telefono.trim(),
      fecha_entrada: fechaEntrada,
      fecha_salida: fechaSalida,
      cantidad_huespedes: obtenerPasajerosReserva().length,
      estado,
      no_show: Boolean(noShow),
      early_checkin: Boolean(earlyCheckin),
      late_checkout: Boolean(lateCheckout),
      numero_reserva: modoEdicion && reservaSeleccionada?.numero_reserva ? reservaSeleccionada.numero_reserva : generarNumeroReserva(),
      notas: notas.trim(),
      user_id: user.id,
    }

    let error
    let reservaId = reservaSeleccionada?.id || null

    if (modoEdicion && reservaSeleccionada) {
      const resultado = await supabase
        .from("reservas")
        .update(datos)
        .eq("id", reservaSeleccionada.id)
        .eq("user_id", user.id)
      error = resultado.error
    } else {
      const resultado = await supabase
        .from("reservas")
        .insert([datos])
        .select("id")
        .single()
      error = resultado.error
      reservaId = resultado.data?.id || null
    }

    if (error) {
      console.error(error)
      setMensaje("No se pudo guardar la reserva.")
      setCargando(false)
      return
    }

    // Las columnas de tarifas se guardan si ya fueron creadas en Supabase.
    // Si todavía no existen, la reserva base igualmente queda guardada.
    if (reservaId) {
      const resultadoPrecios = await supabase
        .from("reservas")
        .update({
          tarifa_noche: calculo.tarifaNoche,
          noches: calculo.noches,
          vehiculos: Number(vehiculos) || 0,
          cochera_total: calculo.cochera,
          extra: calculo.extra,
          precio_total: calculo.total,
        })
        .eq("id", reservaId)
        .eq("user_id", user.id)

      if (resultadoPrecios.error) {
        console.warn("No se pudieron guardar los importes. Ejecutá la migración SQL indicada para las nuevas columnas.", resultadoPrecios.error)
      }
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
      .insert([{ nombre: nuevoAlojamiento.trim(), user_id: user.id }])

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
      user_id: user.id,
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
            <div style={{ color: colors.blue, fontSize: 11, fontWeight: 800, marginTop: 3 }}>{reserva.numero_reserva || "Sin número"}</div>
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
          <div><div style={{ color: colors.muted }}>DNI</div><strong>{reserva.dni_huesped || "—"}</strong></div>
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
            gridTemplateColumns: "210px repeat(38, 1fr)",
            background: "#f8fafc",
          }}>
            <div style={{ padding: 12, fontWeight: 700, fontSize: 12, borderBottom: `1px solid ${colors.border}` }}>
              Habitación
            </div>

            {diasCalendario.map((fecha) => (
              <div key={fecha} style={{
                textAlign: "center",
                background: fecha === fechaLocal(0) ? colors.blueSoft : "#f8fafc",
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
                r.fecha_salida > diasCalendario[0] &&
                r.fecha_entrada <= diasCalendario[diasCalendario.length - 1]
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
                  gridTemplateColumns: "repeat(38, 1fr)",
                  minHeight: 64,
                  borderBottom: `1px solid ${colors.border}`,
                }}>
                  {diasCalendario.map((fecha) => (
                    <div key={fecha} style={{
                      borderLeft: `1px solid ${colors.border}`,
                      background: "#fff",
                    }} />
                  ))}

                  {bloqueos.filter((b) => String(b.habitacion_id) === String(habitacion.id) && b.fecha_hasta > diasCalendario[0] && b.fecha_desde <= diasCalendario[diasCalendario.length - 1]).map((bloqueo) => {
                    let inicio = diasCalendario.findIndex((f) => f >= bloqueo.fecha_desde)
                    let fin = diasCalendario.findIndex((f) => f >= bloqueo.fecha_hasta)
                    if (inicio < 0) inicio = 0
                    if (fin < 0) fin = diasCalendario.length
                    if (fin <= inicio) return null
                    return (
                      <div key={`bloqueo-${bloqueo.id}`} title={`Bloqueo: ${bloqueo.motivo || "Sin motivo"}`} style={{ position: "absolute", left: `calc(${inicio} * (100% / 38) + 3px)`, width: `calc(${fin-inicio} * (100% / 38) - 6px)`, top: 6, height: 50, borderRadius: 7, background: "#111827", color: "#fff", opacity: .82, display: "flex", alignItems: "center", padding: "0 8px", fontSize: 10, fontWeight: 800, overflow: "hidden", zIndex: 1 }}>
                        🚫 {bloqueo.motivo || "Bloqueada"}
                      </div>
                    )
                  })}

                  {reservasHabitacion.map((reserva) => {
                    let inicio = diasCalendario.findIndex((f) => f >= reserva.fecha_entrada)
                    let fin = diasCalendario.findIndex((f) => f >= reserva.fecha_salida)
                    if (inicio < 0) inicio = 0
                    if (fin < 0) fin = diasCalendario.length
                    if (fin <= inicio) return null

                    const hoy = fechaLocal(0)
                    const estadoVisual = hoy < reserva.fecha_entrada
                      ? "futura"
                      : hoy >= reserva.fecha_salida
                        ? "out"
                        : "in"

                    const colorReserva = estadoVisual === "in"
                      ? colors.green
                      : estadoVisual === "out"
                        ? colors.red
                        : "#7c3aed"

                    return (
                      <div
                        key={reserva.id}
                        onClick={() => setReservaSeleccionada(reserva)}
                        title={`${reserva.nombre_huesped} · ${formatearFecha(reserva.fecha_entrada)} - ${formatearFecha(reserva.fecha_salida)}`}
                        style={{
                          position: "absolute",
                          left: `calc(${inicio} * (100% / 38) + 3px)`,
                          width: `calc(${fin - inicio} * (100% / 38) - 6px)`,
                          top: 10,
                          height: 42,
                          borderRadius: 7,
                          background: colorReserva,
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

  function Housekeeping() {
    const hoyOut = reservas.filter((r) => r.estado !== "cancelada" && r.fecha_salida === fechaLocal(0))
    return (<><Header titulo="Housekeeping" subtitulo="Limpieza y estado operativo de las habitaciones" /><div style={{ padding: 30 }}>
      <section style={cardStyle}><div style={sectionHeader}><div><h2 style={{ margin: 0, fontSize: 18 }}>Estado de habitaciones</h2><div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{hoyOut.length} OUT programados hoy</div></div><button onClick={() => imprimirHousekeeping()} style={secondaryButton}>🖨 Imprimir planilla</button></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginTop: 18 }}>
        {habitacionesActivas.map((h) => { const estado = estadoHabitacionVisual(h); const info = infoEstadoHabitacion(estado); const reservaOut = hoyOut.find(r => String(r.habitacion_id) === String(h.id)); const checklist = checklistEstado(h.id); return <div key={h.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><strong>{h.nombre}</strong><div style={{ color: colors.muted, fontSize: 11 }}>{nombreAlojamiento(h.alojamiento_id)}</div></div><span style={{ background: info.bg, color: info.color, padding: "5px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{info.label}</span></div>
          {reservaOut && <div style={{ marginTop: 12, padding: 10, background: colors.redSoft, borderRadius: 8, fontSize: 12 }}><strong>OUT:</strong> {reservaOut.nombre_huesped} · {reservaOut.numero_reserva || "—"}{reservaOut.late_checkout ? " · Late check-out" : ""}</div>}
          <select value={estado} onChange={(e) => cambiarEstadoHabitacion(h.id, e.target.value)} style={{ ...inputStyle, marginTop: 12 }}><option value="libre">Libre / limpia</option><option value="sucia">Sucia</option><option value="en_limpieza">En limpieza</option><option value="fuera_servicio">Fuera de servicio</option></select>
          {(estado === "sucia" || estado === "en_limpieza") && <div style={{ marginTop: 12, display: "grid", gap: 6 }}>{[["cama","Cama y sábanas"],["bano","Baño"],["toallas","Toallas"],["amenities","Amenities"],["piso","Piso"],["residuos","Residuos"],["controles","Controles"],["minibar","Minibar"]].map(([k,l]) => <label key={k} style={{ fontSize: 12, display: "flex", gap: 7 }}><input type="checkbox" checked={Boolean(checklist[k])} onChange={e => cambiarChecklist(h.id,k,e.target.checked)} />{l}</label>)}</div>}
          {estado === "en_limpieza" && <button onClick={() => finalizarLimpieza(h.id)} style={{ ...primaryButton, marginTop: 12, width: "100%" }}>✓ Marcar como limpia</button>}
        </div> })}
      </div></section>
    </div></>)
  }

  function Bloqueos() {
    return (<><Header titulo="Bloqueos" subtitulo="Evitá vender habitaciones por mantenimiento, uso propietario o grupos" /><div style={{ padding: 30, display: "grid", gridTemplateColumns: ".8fr 1.2fr", gap: 18 }}>
      <section style={cardStyle}><h2 style={{ margin: 0, fontSize: 18 }}>Nuevo bloqueo</h2><form onSubmit={crearBloqueo} style={{ display: "grid", gap: 12, marginTop: 18 }}><Field label="Habitación"><select value={bloqueoHabitacion} onChange={e => setBloqueoHabitacion(e.target.value)} style={inputStyle}><option value="">Seleccionar</option>{habitacionesActivas.map(h => <option key={h.id} value={h.id}>{h.nombre} · {nombreAlojamiento(h.alojamiento_id)}</option>)}</select></Field><Field label="Desde"><input type="date" value={bloqueoInicio} onChange={e => setBloqueoInicio(e.target.value)} style={inputStyle}/></Field><Field label="Hasta"><input type="date" value={bloqueoFin} onChange={e => setBloqueoFin(e.target.value)} style={inputStyle}/></Field><Field label="Motivo"><select value={bloqueoMotivo} onChange={e => setBloqueoMotivo(e.target.value)} style={inputStyle}><option>Mantenimiento</option><option>Uso propietario</option><option>Grupo</option><option>Otro</option></select></Field><Field label="Detalle"><textarea value={bloqueoDetalle} onChange={e => setBloqueoDetalle(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} /></Field><button type="submit" style={primaryButton}>Bloquear habitación</button></form></section>
      <section style={cardStyle}><div style={sectionHeader}><h2 style={{ margin: 0, fontSize: 18 }}>Bloqueos activos</h2><span style={{ color: colors.muted, fontSize: 12 }}>{bloqueos.length}</span></div><div style={{ display: "grid", gap: 10, marginTop: 16 }}>{bloqueos.length ? bloqueos.map(b => <div key={b.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", gap: 10 }}><div><strong>{nombreHabitacion(b.habitacion_id)}</strong><div style={{ color: colors.muted, fontSize: 12 }}>{formatearFecha(b.fecha_desde)} → {formatearFecha(b.fecha_hasta)} · {b.motivo}</div>{b.detalle && <div style={{ fontSize: 12, marginTop: 5 }}>{b.detalle}</div>}</div><button onClick={() => eliminarBloqueo(b.id)} style={{ ...secondaryButton, color: colors.red }}>Eliminar</button></div>) : <div style={{ color: colors.muted, padding: 20, textAlign: "center" }}>No hay bloqueos.</div>}</div></section>
    </div></>)
  }

  function Huespedes() {
    const lista = huespedesCRM.filter(h => { const q = busquedaHuesped.trim().toLowerCase(); return !q || [h.nombre,h.dni,h.email,h.telefono].some(v => String(v || "").toLowerCase().includes(q)) })
    return (<><Header titulo="Huéspedes" subtitulo="CRM e historial de estadías" /><div style={{ padding: 30 }}><section style={cardStyle}><div style={sectionHeader}><div><h2 style={{ margin: 0, fontSize: 18 }}>Base de huéspedes</h2><div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{huespedesCRM.length} perfiles detectados</div></div><input value={busquedaHuesped} onChange={e => setBusquedaHuesped(e.target.value)} placeholder="Buscar nombre, DNI, email o teléfono" style={{ ...inputStyle, width: 330 }} /></div><div style={{ overflowX: "auto", marginTop: 18 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{["Huésped","DNI","Contacto","Estadías","Gasto acumulado","Última salida"].map(x => <th key={x} style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${colors.border}`, color: colors.muted }}>{x}</th>)}</tr></thead><tbody>{lista.map((h,i)=><tr key={i}><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}><strong>{h.nombre}</strong></td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>{h.dni || "—"}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>{h.email || h.telefono || "—"}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>{h.estadias}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>${h.gasto.toLocaleString("es-AR")}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>{formatearFecha(h.ultima)}</td></tr>)}</tbody></table></div></section></div></>)
  }

  function Caja() {
    const totalCobrado = pagos.reduce((s,p)=>s+Number(p.monto||0),0)
    const pendientes = reservas.filter(r => r.estado !== "cancelada" && !r.no_show).reduce((s,r)=>s+saldoReserva(r),0)
    return (<><Header titulo="Caja y pagos" subtitulo="Señas, cobros y saldos pendientes" /><div style={{ padding: 30 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 18 }}><div style={cardStyle}><div style={{color:colors.muted,fontSize:12}}>Cobrado registrado</div><div style={{fontSize:28,fontWeight:800,marginTop:7}}>${totalCobrado.toLocaleString("es-AR")}</div></div><div style={cardStyle}><div style={{color:colors.muted,fontSize:12}}>Saldo pendiente</div><div style={{fontSize:28,fontWeight:800,marginTop:7,color:colors.red}}>${pendientes.toLocaleString("es-AR")}</div></div><div style={cardStyle}><div style={{color:colors.muted,fontSize:12}}>Movimientos</div><div style={{fontSize:28,fontWeight:800,marginTop:7}}>{pagos.length}</div></div></div><section style={cardStyle}><h2 style={{margin:0,fontSize:18}}>Últimos pagos</h2><div style={{overflowX:"auto",marginTop:15}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Fecha","Reserva","Huésped","Método","Importe","Nota"].map(x=><th key={x} style={{textAlign:"left",padding:10,borderBottom:`1px solid ${colors.border}`,color:colors.muted}}>{x}</th>)}</tr></thead><tbody>{pagos.map(p=>{const r=reservas.find(x=>String(x.id)===String(p.reserva_id));return <tr key={p.id}><td style={{padding:10,borderBottom:`1px solid ${colors.border}`}}>{p.created_at ? new Date(p.created_at).toLocaleDateString("es-AR") : "—"}</td><td style={{padding:10,borderBottom:`1px solid ${colors.border}`}}>{r?.numero_reserva||"—"}</td><td style={{padding:10,borderBottom:`1px solid ${colors.border}`}}>{r?.nombre_huesped||"—"}</td><td style={{padding:10,borderBottom:`1px solid ${colors.border}`}}>{p.metodo}</td><td style={{padding:10,borderBottom:`1px solid ${colors.border}`,fontWeight:800}}>${Number(p.monto||0).toLocaleString("es-AR")}</td><td style={{padding:10,borderBottom:`1px solid ${colors.border}`}}>{p.nota||""}</td></tr>})}</tbody></table></div></section></div></>)
  }

  function Comunicaciones() {
    const proxima = reservasActivas.find(r => r.fecha_entrada >= fechaLocal(0))
    const tipos = [["confirmacion","Confirmación de reserva"],["checkin","Recordatorio de check-in"],["checkout","Recordatorio de check-out"],["gracias","Gracias por la estadía"]]
    return (<><Header titulo="Comunicaciones" subtitulo="Plantillas para acompañar al huésped antes, durante y después de la estadía" /><div style={{ padding: 30, display:"grid", gap:18 }}><section style={cardStyle}><div style={sectionHeader}><div><h2 style={{margin:0,fontSize:18}}>Automatizaciones preparadas</h2><div style={{color:colors.muted,fontSize:12,marginTop:4}}>La plataforma ya tiene las plantillas; el envío automático por email/WhatsApp se conecta en la próxima integración.</div></div><button onClick={()=>setVista("asistente")} style={secondaryButton}>✦ Ver asistente IA</button></div><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,marginTop:18}}>{tipos.map(([key,label])=>{const texto=textoPlantillaComunicacion(key,proxima);return <div key={key} style={{border:`1px solid ${colors.border}`,borderRadius:10,padding:16}}><strong>{label}</strong><div style={{marginTop:10,padding:12,background:"#f8fafc",borderRadius:8,fontSize:12,lineHeight:1.5}}>{texto}</div><div style={{display:"flex",gap:8,marginTop:10}}><button onClick={()=>navigator.clipboard?.writeText(texto)} style={secondaryButton}>Copiar</button>{proxima?.email_huesped&&<button onClick={()=>enviarResumenPorEmail(proxima)} style={primaryButton}>Email</button>}</div></div>})}</div></section></div></>)
  }

  function Sidebar() {
    const items = [
      ["dashboard", "▦", "Inicio"],
      ["reservas", "▣", "Reservas"],
      ["calendario", "▤", "Calendario"],
      ["housekeeping", "🧹", "Housekeeping"],
      ["bloqueos", "🚫", "Bloqueos"],
      ["huespedes", "👤", "Huéspedes"],
      ["caja", "💰", "Caja y pagos"],
      ["ventas", "◫", "Ventas"],
      ["comunicaciones", "✉", "Comunicaciones"],
      ["integraciones", "↔", "Integraciones"],
      ["asistente", "✦", "Asistente IA"],
      ["configuracion", "⚙", "Configuración"],
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
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 9 }}>
            <img
              src={config.logo || logoHabitacionLlena}
              alt="Habitación Llena"
              style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "#fff" }}
            />
            <div style={{ fontSize: 22, fontWeight: 800 }}>{config.nombreMarca || "Habitación Llena"}</div>
          </div>
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

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = "/"
            }}
            style={{
              border: `1px solid ${colors.border}`,
              background: colors.white,
              color: colors.text,
              borderRadius: 7,
              padding: "9px 12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Salir
          </button>
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
        </div>
      </header>
    )
  }

  function guardarConfiguracion() {
    try {
      if (!user?.id) {
        alert("No hay una sesión activa.")
        return
      }

      const claveConfig = `habitacion_llena_config_${user.id}`
      localStorage.setItem(claveConfig, JSON.stringify(config))
      setConfigGuardada(true)
      setTimeout(() => setConfigGuardada(false), 2500)
    } catch (error) {
      console.error(error)
      alert("No se pudo guardar la configuración.")
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert("El logo debe pesar menos de 2 MB.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setConfig((actual) => ({ ...actual, logo: String(reader.result) }))
    }
    reader.readAsDataURL(file)
  }

  function whatsappLink() {
    const phone = (config.whatsapp || "").replace(/\D/g, "")
    if (!phone) return ""
    return `https://wa.me/${phone}`
  }

  function volumenVentas() {
    const hoy = fechaLocal(0)
    const ultimos30 = reservas.filter(
      (r) =>
        r.estado !== "cancelada" &&
        r.fecha_entrada >= fechaLocal(-29) &&
        r.fecha_entrada <= hoy
    )

    const noches = ultimos30.reduce(
      (total, r) => total + diasEntre(r.fecha_entrada, r.fecha_salida),
      0
    )

    const ingresos = ultimos30.reduce((total, r) => {
      const valor =
        Number(
          r.precio_total ??
          r.total ??
          r.importe_total ??
          r.monto_total ??
          r.ingreso_total ??
          0
        ) || 0
      return total + valor
    }, 0)

    return {
      reservas: ultimos30.length,
      noches,
      ingresos,
    }
  }

  async function enviarPreguntaIA(e) {
    e?.preventDefault()
    const pregunta = assistantInput.trim()
    if (!pregunta || assistantLoading) return

    setAssistantInput("")
    setAssistantMessages((actual) => [
      ...actual,
      { role: "user", content: pregunta },
    ])
    setAssistantLoading(true)

    const metricas = volumenVentas()
    const contexto = {
      alojamientos: alojamientos.map((a) => ({ id: a.id, nombre: a.nombre })),
      habitaciones: habitaciones.map((h) => ({
        id: h.id,
        nombre: h.nombre,
        tipo: h.tipo,
        activa: h.activa !== false,
        alojamiento: nombreAlojamiento(h.alojamiento_id),
      })),
      reservas: reservas.slice(0, 100).map((r) => ({
        id: r.id,
        huesped: r.nombre_huesped,
        alojamiento: nombreAlojamiento(r.alojamiento_id),
        habitacion: nombreHabitacion(r.habitacion_id),
        entrada: r.fecha_entrada,
        salida: r.fecha_salida,
        estado: r.estado,
        huespedes: r.cantidad_huespedes,
      })),
      metricas,
      hoy: fechaLocal(0),
    }

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: pregunta, context: contexto }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "No se pudo consultar al asistente.")
      }

      setAssistantMessages((actual) => [
        ...actual,
        {
          role: "assistant",
          content:
            data.answer ||
            "No pude generar una respuesta en este momento.",
        },
      ])
    } catch (error) {
      console.error(error)
      setAssistantMessages((actual) => [
        ...actual,
        {
          role: "assistant",
          content:
            "No pude conectar con el asistente. La plataforma sigue funcionando; revisá la configuración de IA del proyecto.",
        },
      ])
    } finally {
      setAssistantLoading(false)
    }
  }

  function Ventas() {
    const metricas = volumenVentas()
    const ocupacion = habitacionesActivas.length
      ? Math.round((reservasHoy.length / habitacionesActivas.length) * 100)
      : 0
    const ingresos = reservas.reduce((s,r)=>s+Number(r.precio_total||0),0)
    const nochesVendidas = reservas.reduce((s,r)=>s+(Number(r.noches)||diasEntre(r.fecha_entrada,r.fecha_salida)),0)
    const habitacionesDisponiblesPeriodo = Math.max(1, habitacionesActivas.length * 30)
    const adr = nochesVendidas ? ingresos / nochesVendidas : 0
    const revpar = habitacionesDisponiblesPeriodo ? ingresos / habitacionesDisponiblesPeriodo : 0
    const saldoPendiente = reservas.filter(r=>r.estado!=="cancelada"&&!r.no_show).reduce((s,r)=>s+saldoReserva(r),0)

    const porEstado = reservas.reduce((acc, r) => {
      acc[r.estado] = (acc[r.estado] || 0) + 1
      return acc
    }, {})

    const canales = [
      { nombre: "Directas / PMS", valor: reservas.length, color: colors.blue },
      { nombre: "Booking.com", valor: 0, color: "#003b95" },
      { nombre: "Expedia", valor: 0, color: "#f5a623" },
      { nombre: "Airbnb", valor: 0, color: "#ff385c" },
      { nombre: "Despegar", valor: 0, color: "#ff6b00" },
    ]

    return (
      <>
        <Header titulo="Ventas y rendimiento" subtitulo="Volumen comercial y ocupación" />
        <div style={{ padding: 30 }}>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:16,marginBottom:18 }}><div style={cardStyle}><div style={{color:colors.muted,fontSize:12}}>ADR</div><div style={{fontSize:27,fontWeight:800,marginTop:6}}>${Math.round(adr).toLocaleString("es-AR")}</div><div style={{color:colors.muted,fontSize:11}}>Ingreso promedio por noche vendida</div></div><div style={cardStyle}><div style={{color:colors.muted,fontSize:12}}>RevPAR</div><div style={{fontSize:27,fontWeight:800,marginTop:6}}>${Math.round(revpar).toLocaleString("es-AR")}</div><div style={{color:colors.muted,fontSize:11}}>Ingreso por habitación disponible</div></div><div style={cardStyle}><div style={{color:colors.muted,fontSize:12}}>Saldo pendiente</div><div style={{fontSize:27,fontWeight:800,marginTop:6,color:colors.red}}>${Math.round(saldoPendiente).toLocaleString("es-AR")}</div><div style={{color:colors.muted,fontSize:11}}>Reservas activas</div></div><div style={cardStyle}><div style={{color:colors.muted,fontSize:12}}>Ocupación hoy</div><div style={{fontSize:27,fontWeight:800,marginTop:6}}>{ocupacion}%</div><div style={{color:colors.muted,fontSize:11}}>{reservasHoy.length} habitaciones ocupadas</div></div></div>
          <section style={{ ...cardStyle, marginBottom: 22 }}>
            <div style={sectionHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Operación de hoy</h2>
                <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{formatearFecha(fechaLocal(0))}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => imprimirPlanillaIn()} style={secondaryButton}>🖨 Planilla IN</button>
                <button onClick={() => imprimirHousekeeping()} style={secondaryButton}>🧹 Housekeeping</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ padding: 14, background: "#eefaf4", borderRadius: 10 }}>
                <div style={{ color: colors.green, fontWeight: 800, fontSize: 12 }}>IN DEL DÍA · {entradasHoy.length}</div>
                <div style={{ marginTop: 9, display: "grid", gap: 7 }}>{entradasHoy.length ? entradasHoy.map(r => <div key={r.id} style={{ fontSize: 13 }}><strong>{nombreHabitacion(r.habitacion_id)}</strong> · {r.nombre_huesped} · {r.cantidad_huespedes || 1} pax</div>) : <span style={{ color: colors.muted, fontSize: 12 }}>Sin entradas hoy.</span>}</div>
              </div>
              <div style={{ padding: 14, background: "#fff0f0", borderRadius: 10 }}>
                <div style={{ color: colors.red, fontWeight: 800, fontSize: 12 }}>OUT DEL DÍA · {salidasHoy.length}</div>
                <div style={{ marginTop: 9, display: "grid", gap: 7 }}>{salidasHoy.length ? salidasHoy.map(r => <div key={r.id} style={{ fontSize: 13 }}><strong>{nombreHabitacion(r.habitacion_id)}</strong> · {r.nombre_huesped} · {r.cantidad_huespedes || 1} pax{r.late_checkout ? " · Late check-out" : ""}</div>) : <span style={{ color: colors.muted, fontSize: 12 }}>Sin salidas hoy.</span>}</div>
              </div>
            </div>
          </section>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 20,
          }}>
            {[
              ["Reservas últimos 30 días", metricas.reservas, "reservas"],
              ["Noches vendidas", metricas.noches, "noches"],
              ["Ocupación hoy", `${ocupacion}%`, "de habitaciones activas"],
              ["Ingresos registrados", metricas.ingresos ? `$${metricas.ingresos.toLocaleString("es-AR")}` : "—", metricas.ingresos ? "según datos cargados" : "requiere importe en reservas"],
            ].map(([titulo, valor, detalle]) => (
              <div key={titulo} style={cardStyle}>
                <div style={{ color: colors.muted, fontSize: 12 }}>{titulo}</div>
                <div style={{ fontSize: 29, fontWeight: 800, marginTop: 8 }}>{valor}</div>
                <div style={{ color: colors.muted, fontSize: 11, marginTop: 5 }}>{detalle}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 18 }}>
            <section style={cardStyle}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Volumen por canal</h2>
              <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                Preparado para recibir datos del channel manager.
              </div>

              <div style={{ marginTop: 22, display: "grid", gap: 15 }}>
                {canales.map((canal) => {
                  const max = Math.max(reservas.length, 1)
                  const porcentaje = Math.min(100, (canal.valor / max) * 100)
                  return (
                    <div key={canal.nombre}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700 }}>{canal.nombre}</span>
                        <span style={{ color: colors.muted }}>{canal.valor}</span>
                      </div>
                      <div style={{ height: 8, background: "#edf0f4", borderRadius: 99 }}>
                        <div style={{
                          width: `${porcentaje}%`,
                          height: "100%",
                          background: canal.color,
                          borderRadius: 99,
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Estado de reservas</h2>
              <div style={{ marginTop: 18, display: "grid", gap: 11 }}>
                {[
                  ["Confirmadas", porEstado.confirmada || 0, colors.green],
                  ["Pendientes", porEstado.pendiente || 0, colors.yellow],
                  ["Finalizadas", porEstado.finalizada || 0, "#64748b"],
                  ["Canceladas", porEstado.cancelada || 0, colors.red],
                ].map(([label, value, color]) => (
                  <div key={label} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: `1px solid ${colors.border}`,
                  }}>
                    <span style={{ fontSize: 13 }}>{label}</span>
                    <strong style={{ color }}>{value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </>
    )
  }

  function Integraciones() {
    const conexiones = [
      {
        nombre: "WhatsApp",
        descripcion: "Botón directo para que el huésped contacte al alojamiento.",
        estado: config.whatsapp ? "Configurado" : "Pendiente",
        color: "#25D366",
        url: whatsappLink(),
      },
      {
        nombre: "Booking.com",
        descripcion: "Preparado para conectar extranet o futura integración de Channel Manager.",
        estado: config.bookingUrl ? "Configurado" : "Pendiente",
        color: "#003b95",
        url: config.bookingUrl,
      },
      {
        nombre: "Expedia",
        descripcion: "Canal OTA preparado para futura sincronización.",
        estado: config.expediaUrl ? "Configurado" : "Pendiente",
        color: "#f5a623",
        url: config.expediaUrl,
      },
      {
        nombre: "Airbnb",
        descripcion: "Canal OTA preparado para futura sincronización.",
        estado: config.airbnbUrl ? "Configurado" : "Pendiente",
        color: "#ff385c",
        url: config.airbnbUrl,
      },
      {
        nombre: "Despegar",
        descripcion: "Canal OTA preparado para futura sincronización.",
        estado: config.despegarUrl ? "Configurado" : "Pendiente",
        color: "#ff6b00",
        url: config.despegarUrl,
      },
    ]

    return (
      <>
        <Header titulo="Integraciones" subtitulo="Canales, WhatsApp y distribución" />
        <div style={{ padding: 30 }}>
          <section style={cardStyle}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Canales de venta</h2>
              <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                Centralizá los accesos y prepará la distribución multicanal.
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {conexiones.map((conexion) => (
                <div key={conexion.nombre} style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: 17,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    background: conexion.color,
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: 12,
                  }}>
                    {conexion.nombre.slice(0, 2).toUpperCase()}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{conexion.nombre}</div>
                    <div style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{conexion.descripcion}</div>
                  </div>

                  <span style={{
                    color: conexion.estado === "Configurado" ? colors.green : colors.muted,
                    background: conexion.estado === "Configurado" ? colors.greenSoft : "#f3f4f6",
                    borderRadius: 99,
                    padding: "5px 9px",
                    fontSize: 10,
                    fontWeight: 800,
                  }}>
                    {conexion.estado}
                  </span>

                  {conexion.url && (
                    <a href={conexion.url} target="_blank" rel="noreferrer" style={{
                      ...secondaryButton,
                      textDecoration: "none",
                    }}>
                      Abrir
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 20,
              padding: 15,
              background: colors.blueSoft,
              color: colors.navyDark,
              borderRadius: 9,
              fontSize: 12,
              lineHeight: 1.55,
            }}>
              <strong>Importante:</strong> esto deja preparada la interfaz, pero una sincronización real de Booking.com, Expedia, Airbnb u otras OTAs requiere las APIs/credenciales y acuerdos de conectividad de cada canal. Un Channel Manager real sincroniza tarifas, disponibilidad y reservas en ambos sentidos y evita overbookings.
            </div>
          </section>
        </div>
      </>
    )
  }

  function Asistente() {
    return (
      <>
        <Header titulo="Asistente IA" subtitulo="Consultá tu operación en lenguaje natural" />
        <div style={{ padding: 30 }}>
          <section style={{
            ...cardStyle,
            maxWidth: 850,
            margin: "0 auto",
            padding: 0,
            overflow: "hidden",
          }}>
            <div style={{
              padding: 20,
              background: `linear-gradient(120deg, ${colors.navyDark}, ${colors.navy})`,
              color: "#fff",
            }}>
              <div style={{ fontSize: 11, opacity: .7, letterSpacing: 1 }}>ASISTENTE HOTELERO</div>
              <h2 style={{ margin: "5px 0", fontSize: 20 }}>Preguntale a Habitación Llena</h2>
              <div style={{ fontSize: 12, opacity: .78 }}>
                Reservas, ocupación, huéspedes, habitaciones y rendimiento.
              </div>
            </div>

            <div style={{
              minHeight: 430,
              maxHeight: 520,
              overflowY: "auto",
              padding: 20,
              background: "#f8fafc",
            }}>
              {assistantMessages.map((message, index) => (
                <div key={index} style={{
                  display: "flex",
                  justifyContent: message.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 12,
                }}>
                  <div style={{
                    maxWidth: "82%",
                    padding: "11px 14px",
                    borderRadius: 12,
                    background: message.role === "user" ? colors.blue : colors.white,
                    color: message.role === "user" ? "#fff" : colors.text,
                    border: message.role === "user" ? "none" : `1px solid ${colors.border}`,
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}>
                    {message.content}
                  </div>
                </div>
              ))}

              {assistantLoading && (
                <div style={{ color: colors.muted, fontSize: 12 }}>
                  Analizando tu operación...
                </div>
              )}
            </div>

            <form onSubmit={enviarPreguntaIA} style={{
              display: "flex",
              gap: 9,
              padding: 14,
              borderTop: `1px solid ${colors.border}`,
              background: colors.white,
            }}>
              <input
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                placeholder="Ej. ¿Cuántas habitaciones tengo ocupadas hoy?"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="submit" disabled={assistantLoading} style={primaryButton}>
                Enviar
              </button>
            </form>
          </section>
        </div>
      </>
    )
  }

  function Configuracion() {
    if (configSubvista === "alojamientos") return (
      <>
        <Header titulo="Configuración · Alojamientos" subtitulo="Propiedades de tu cuenta" />
        <div style={{ padding: 30 }}>
          <div style={{ ...cardStyle, marginBottom: 18 }}>
            <button onClick={() => setConfigSubvista("general")} style={secondaryButton}>← Volver a configuración</button>
          </div>
          {Alojamientos({ embedded: true })}
        </div>
      </>
    )
    if (configSubvista === "habitaciones") return (
      <>
        <Header titulo="Configuración · Habitaciones" subtitulo="Unidades de tus alojamientos" />
        <div style={{ padding: 30 }}>
          <div style={{ ...cardStyle, marginBottom: 18 }}>
            <button onClick={() => setConfigSubvista("general")} style={secondaryButton}>← Volver a configuración</button>
          </div>
          {Habitaciones({ embedded: true })}
        </div>
      </>
    )

    return (
      <>
        <Header titulo="Configuración" subtitulo="Identidad y datos comerciales del alojamiento" />
        <div style={{ padding: 30 }}>
          <section style={{ ...cardStyle, maxWidth: 1000 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, borderBottom: `1px solid ${colors.border}`, paddingBottom: 14 }}>
              <button onClick={() => setConfigSubvista("general")} style={configSubvista === "general" ? primaryButton : secondaryButton}>General</button>
              <button onClick={() => setConfigSubvista("alojamientos")} style={secondaryButton}>Alojamientos</button>
              <button onClick={() => setConfigSubvista("habitaciones")} style={secondaryButton}>Habitaciones</button>
            </div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Marca</h2>
            <div style={{ color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: 20 }}>
              Esta configuración se guarda en este navegador por ahora.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <Field label="Nombre de marca">
                <input value={config.nombreMarca} onChange={(e) => setConfig({ ...config, nombreMarca: e.target.value })} style={inputStyle} />
              </Field>

              <Field label="WhatsApp con código de país">
                <input value={config.whatsapp} onChange={(e) => setConfig({ ...config, whatsapp: e.target.value })} placeholder="549..." style={inputStyle} />
              </Field>

              <Field label="Logo">
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} style={{ ...inputStyle, padding: 9 }} />
              </Field>

              <Field label="URL de tu web">
                <input value={config.webUrl} onChange={(e) => setConfig({ ...config, webUrl: e.target.value })} placeholder="https://..." style={inputStyle} />
              </Field>
            </div>

            {config.logo && (
              <div style={{
                marginTop: 18,
                padding: 16,
                background: "#f8fafc",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 15,
              }}>
                <img src={config.logo} alt="Logo" style={{ maxWidth: 180, maxHeight: 70, objectFit: "contain" }} />
                <span style={{ color: colors.muted, fontSize: 12 }}>Vista previa del logo</span>
              </div>
            )}

            <h2 style={{ margin: "30px 0 18px", fontSize: 18 }}>Tarifas</h2>
            <div style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>Configurá el precio por noche según el tipo de habitación. La cochera se calcula por vehículo y por noche.</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[["simple", "Simple"], ["doble", "Doble"], ["triple", "Triple"], ["cuadruple", "Cuádruple"], ["otro", "Otro"], ["cochera", "Cochera / vehículo"], ["extra", "Extra por reserva"]].map(([clave, label]) => (
                <Field key={clave} label={label}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={config.tarifas?.[clave] ?? 0}
                    onChange={(e) => setConfig({ ...config, tarifas: { ...config.tarifas, [clave]: e.target.value } })}
                    placeholder="0"
                    style={inputStyle}
                  />
                </Field>
              ))}
            </div>

            <h2 style={{ margin: "30px 0 18px", fontSize: 18 }}>Accesos a canales</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Booking.com">
                <input value={config.bookingUrl} onChange={(e) => setConfig({ ...config, bookingUrl: e.target.value })} placeholder="URL de la extranet o página" style={inputStyle} />
              </Field>

              <Field label="Expedia">
                <input value={config.expediaUrl} onChange={(e) => setConfig({ ...config, expediaUrl: e.target.value })} placeholder="URL de acceso" style={inputStyle} />
              </Field>

              <Field label="Airbnb">
                <input value={config.airbnbUrl} onChange={(e) => setConfig({ ...config, airbnbUrl: e.target.value })} placeholder="URL del anuncio" style={inputStyle} />
              </Field>

              <Field label="Despegar">
                <input value={config.despegarUrl} onChange={(e) => setConfig({ ...config, despegarUrl: e.target.value })} placeholder="URL de acceso" style={inputStyle} />
              </Field>
            </div>

            <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={guardarConfiguracion} style={primaryButton}>
                Guardar configuración
              </button>
              {configGuardada && <span style={{ color: colors.green, fontSize: 12, fontWeight: 700 }}>Configuración guardada ✓</span>}
            </div>

            <div style={{
              marginTop: 25,
              padding: 14,
              background: "#fff8e8",
              border: "1px solid #f3dfad",
              borderRadius: 9,
              color: "#72520a",
              fontSize: 12,
              lineHeight: 1.5,
            }}>
              Para un SaaS real multi-hotel, estos datos deberían pasar de localStorage a una tabla de configuración por alojamiento/usuario en Supabase. Así cada cliente tendría su logo, WhatsApp y conexiones separados.
            </div>
          </section>
        </div>
      </>
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
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img
                src={config.logo || logoHabitacionLlena}
                alt="Habitación Llena"
                style={{
                  width: 64,
                  height: 64,
                  objectFit: "contain",
                  borderRadius: 12,
                  background: "#fff",
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 11, opacity: .75, letterSpacing: 2 }}>HABITACIÓN LLENA</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
                  {saludoSegunHorario()}, {nombreAlojamientoActivo} 👋
                </div>
                <div style={{ opacity: .8, marginTop: 7 }}>
                  Gestioná reservas y ocupación desde un solo lugar.
                </div>
              </div>
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

          <section style={{ ...cardStyle, marginBottom: 18 }}><div style={sectionHeader}><div><h2 style={{ margin: 0, fontSize: 18 }}>Operación de hoy</h2><div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{formatearFecha(fechaLocal(0))}</div></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button onClick={() => imprimirPlanillaIn()} style={secondaryButton}>🖨 Planilla IN</button><button onClick={() => imprimirHousekeeping()} style={secondaryButton}>🧹 Housekeeping</button></div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 15 }}><div style={{ padding: 14, background: colors.greenSoft, borderRadius: 10 }}><div style={{ color: colors.green, fontWeight: 800, fontSize: 12 }}>IN DEL DÍA · {entradasHoy.length}</div>{entradasHoy.length ? entradasHoy.map(r => <div key={r.id} style={{ marginTop: 7, fontSize: 13 }}><strong>{nombreHabitacion(r.habitacion_id)}</strong> · {r.nombre_huesped} · {r.cantidad_huespedes || 1} pax</div>) : <div style={{ color: colors.muted, marginTop: 7, fontSize: 12 }}>Sin entradas hoy.</div>}</div><div style={{ padding: 14, background: colors.redSoft, borderRadius: 10 }}><div style={{ color: colors.red, fontWeight: 800, fontSize: 12 }}>OUT DEL DÍA · {salidasHoy.length}</div>{salidasHoy.length ? salidasHoy.map(r => <div key={r.id} style={{ marginTop: 7, fontSize: 13 }}><strong>{nombreHabitacion(r.habitacion_id)}</strong> · {r.nombre_huesped} · {r.cantidad_huespedes || 1} pax{r.late_checkout ? " · Late check-out" : ""}</div>) : <div style={{ color: colors.muted, marginTop: 7, fontSize: 12 }}>Sin salidas hoy.</div>}</div></div></section>

          <section style={{ ...cardStyle, marginBottom: 18 }}><div style={sectionHeader}><div><h2 style={{ margin: 0, fontSize: 18 }}>Estado de habitaciones</h2><div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Vista rápida de housekeeping</div></div><button onClick={() => setVista("housekeeping")} style={secondaryButton}>Abrir housekeeping</button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginTop: 15 }}>{habitacionesActivas.slice(0,8).map(h=>{const st=estadoHabitacionVisual(h);const inf=infoEstadoHabitacion(st);return <button key={h.id} onClick={()=>setVista("housekeeping")} style={{border:`1px solid ${colors.border}`,background:inf.bg,borderRadius:10,padding:12,textAlign:"left",cursor:"pointer"}}><strong style={{fontSize:13}}>{h.nombre}</strong><div style={{color:inf.color,fontWeight:800,fontSize:11,marginTop:5}}>{inf.label}</div></button>})}</div></section>

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
                ) : recientes.map((r) => ReservaCard({ reserva: r }))}
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

                <Field label="Nombre del huésped principal">
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Juan Pérez" style={inputStyle} />
                </Field>

                <Field label="DNI / documento">
                  <input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="Ej. 35.123.456" style={inputStyle} />
                </Field>

                <Field label="Email">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="huésped@email.com" style={inputStyle} />
                </Field>

                <Field label="Teléfono">
                  <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 9..." style={inputStyle} />
                </Field>

                <Field label="Huésped principal">
                  <label style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 44, fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={esMenor} onChange={(e) => setEsMenor(e.target.checked)} />
                    Es menor de edad
                  </label>
                </Field>

                <Field label="Cantidad de huéspedes">
                  <input type="number" min="1" value={1 + pasajerosExtra.length} readOnly style={{ ...inputStyle, background: "#f8fafc" }} />
                </Field>

                <Field label="Pasajeros adicionales" wide>
                  <div style={{ display: "grid", gap: 10 }}>
                    {pasajerosExtra.map((pasajero, indice) => (
                      <div key={indice} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr auto auto", gap: 8, alignItems: "center", padding: 10, background: "#f8fafc", borderRadius: 9, border: `1px solid ${colors.border}` }}>
                        <input value={pasajero.nombre} onChange={(e) => actualizarPasajeroExtra(indice, "nombre", e.target.value)} placeholder="Nombre y apellido" style={inputStyle} />
                        <input value={pasajero.dni} onChange={(e) => actualizarPasajeroExtra(indice, "dni", e.target.value)} placeholder="DNI" style={inputStyle} />
                        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                          <input type="checkbox" checked={Boolean(pasajero.menor)} onChange={(e) => actualizarPasajeroExtra(indice, "menor", e.target.checked)} />
                          Menor
                        </label>
                        <button type="button" onClick={() => eliminarPasajeroExtra(indice)} style={{ ...secondaryButton, padding: "8px 10px", color: colors.red }}>×</button>
                      </div>
                    ))}
                    <button type="button" onClick={agregarPasajeroExtra} style={{ ...secondaryButton, width: "fit-content" }}>+ Agregar pasajero</button>
                  </div>
                </Field>

                <Field label="Vehículos con cochera">
                  <input type="number" min="0" value={vehiculos} onChange={(e) => setVehiculos(e.target.value)} style={inputStyle} />
                </Field>

                <Field label="Extra de la reserva">
                  <input type="number" min="0" step="0.01" value={extraReserva} onChange={(e) => setExtraReserva(e.target.value)} style={inputStyle} />
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

                <Field label="Condiciones especiales" wide>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", minHeight: 44 }}>
                    <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12, fontWeight: 700 }}><input type="checkbox" checked={earlyCheckin} onChange={(e) => setEarlyCheckin(e.target.checked)} /> Early check-in</label>
                    <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12, fontWeight: 700 }}><input type="checkbox" checked={lateCheckout} onChange={(e) => setLateCheckout(e.target.checked)} /> Late check-out</label>
                    <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12, fontWeight: 700, color: colors.red }}><input type="checkbox" checked={noShow} onChange={(e) => setNoShow(e.target.checked)} /> No show</label>
                  </div>
                </Field>

                <Field label="Notas" wide>
                  <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Información adicional..." style={inputStyle} />
                </Field>
              </div>

              {habitacionSeleccionada && fechaEntrada && fechaSalida && (
                <div style={{
                  marginTop: 18,
                  padding: 16,
                  borderRadius: 10,
                  background: colors.blueSoft,
                  border: `1px solid #cfe0ff`,
                }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Resumen de tarifa</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontSize: 13 }}>
                    <div>Noches: <strong>{calcularImporteReserva().noches}</strong></div>
                    <div>Habitación / noche: <strong>${calcularImporteReserva().tarifaNoche.toLocaleString("es-AR")}</strong></div>
                    <div>Alojamiento: <strong>${calcularImporteReserva().alojamiento.toLocaleString("es-AR")}</strong></div>
                    <div>Cochera: <strong>${calcularImporteReserva().cochera.toLocaleString("es-AR")}</strong></div>
                    <div>Extra: <strong>${calcularImporteReserva().extra.toLocaleString("es-AR")}</strong></div>
                    <div>Total: <strong style={{ color: colors.navy, fontSize: 16 }}>${calcularImporteReserva().total.toLocaleString("es-AR")}</strong></div>
                  </div>
                </div>
              )}

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
              <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ color: colors.muted, fontSize: 13 }}>{reservasFiltradas.length} de {reservas.length} reservas</div>
                <button onClick={imprimirReservas} type="button" style={secondaryButton}>🖨 Imprimir reservas</button>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <input value={busquedaReserva} onChange={(e) => setBusquedaReserva(e.target.value)} placeholder="Buscar por nombre, Nº de reserva, DNI o email..." style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button type="button" onClick={() => imprimirPlanillaIn()} style={secondaryButton}>🖨 Planilla IN de hoy</button>
              <button type="button" onClick={() => imprimirHousekeeping()} style={secondaryButton}>🧹 Housekeeping de hoy</button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {reservas.length === 0 ? (
                <div style={emptyStyle}>Todavía no hay reservas cargadas.</div>
              ) : reservasFiltradas.map((r) => ReservaCard({ reserva: r }))}
            </div>
          </section>
        </div>
      </>
    )
  }

  function CalendarioVista() {
    return (
      <>
        <Header titulo="Calendario" subtitulo={`Semana alrededor de ${formatearFecha(fechaCalendario)}`} />
        <div style={{ padding: 30 }}>
          <section style={cardStyle}>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Calendario de ocupación</h2>
              <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                Hacé click sobre una reserva para editarla.
              </div>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
                <button type="button" onClick={() => setFechaCalendario(fechaLocal(0))} style={secondaryButton}>Hoy</button>
                <button type="button" onClick={() => { const d = new Date(`${fechaCalendario}T12:00:00`); d.setDate(d.getDate() - 7); setFechaCalendario(d.toISOString().slice(0,10)) }} style={secondaryButton}>← 7 días</button>
                <input type="date" value={fechaCalendario} onChange={(e) => setFechaCalendario(e.target.value)} style={{ ...inputStyle, width: 160 }} />
                <button type="button" onClick={() => { const d = new Date(`${fechaCalendario}T12:00:00`); d.setDate(d.getDate() + 7); setFechaCalendario(d.toISOString().slice(0,10)) }} style={secondaryButton}>7 días →</button>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, fontSize: 11, fontWeight: 700 }}>
                <span style={{ color: colors.green }}>● IN · Alojado</span>
                <span style={{ color: colors.red }}>● OUT · Ya salió</span>
                <span style={{ color: "#7c3aed" }}>● FUTURA · Aún no llegó</span>
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

  function Alojamientos({ embedded = false } = {}) {
    return (
      <>
        {!embedded && <Header titulo="Alojamientos" subtitulo="Administrá tus propiedades" />}
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

  function Habitaciones({ embedded = false } = {}) {
    return (
      <>
        {!embedded && <Header titulo="Habitaciones" subtitulo="Administrá las unidades de cada alojamiento" />}
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

  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: colors.bg,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        color: colors.text,
      }}>
        Cargando Habitación Llena...
      </div>
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
        {Sidebar()}
      </div>

      <div className="mobile-topbar">
        <button onClick={() => setMenuAbierto(!menuAbierto)} style={{
          border: "none",
          background: "transparent",
          fontSize: 23,
        }}>☰</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src={config.logo || logoHabitacionLlena}
            alt="Habitación Llena"
            style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 6, background: "#fff" }}
          />
          <strong>{config.nombreMarca || "Habitación Llena"}</strong>
        </div>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 20, padding: 12, marginBottom: 20 }}>
              <img
                src={config.logo || logoHabitacionLlena}
                alt="Habitación Llena"
                style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 7, background: "#fff" }}
              />
              Habitación Llena
            </div>
            {["dashboard", "reservas", "calendario", "housekeeping", "bloqueos", "huespedes", "caja", "ventas", "comunicaciones", "integraciones", "asistente", "configuracion"].map((id) => (
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
                 id === "housekeeping" ? "🧹  Housekeeping" :
                 id === "bloqueos" ? "🚫  Bloqueos" :
                 id === "huespedes" ? "👤  Huéspedes" :
                 id === "caja" ? "💰  Caja y pagos" :
                 id === "alojamientos" ? "⌂  Alojamientos" :
                 id === "habitaciones" ? "▥  Habitaciones" :
                 id === "ventas" ? "◫  Ventas" :
                 id === "comunicaciones" ? "✉  Comunicaciones" :
                 id === "integraciones" ? "↔  Integraciones" :
                 id === "asistente" ? "✦  Asistente IA" : "⚙  Configuración"}
              </button>
            ))}
          </div>
        </div>
      )}

      <main style={{ marginLeft: 235, minHeight: "100vh" }}>
        {vista === "dashboard" && Dashboard()}
        {vista === "reservas" && Reservas()}
        {vista === "calendario" && CalendarioVista()}
        {vista === "housekeeping" && Housekeeping()}
        {vista === "bloqueos" && Bloqueos()}
        {vista === "huespedes" && Huespedes()}
        {vista === "caja" && Caja()}
        {vista === "ventas" && Ventas()}
        {vista === "comunicaciones" && Comunicaciones()}
        {vista === "integraciones" && Integraciones()}
        {vista === "asistente" && Asistente()}
        {vista === "configuracion" && Configuracion()}
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
                <div style={{ color: colors.blue, fontWeight: 800, fontSize: 12, marginTop: 4 }}>{reservaSeleccionada.numero_reserva || "Sin número"}</div>
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
              {reservaSeleccionada.precio_total != null && <Info label="Total" value={`$${Number(reservaSeleccionada.precio_total || 0).toLocaleString("es-AR")}`} />}
              {reservaSeleccionada.vehiculos != null && <Info label="Vehículos" value={reservaSeleccionada.vehiculos} />}
              <Info label="Estado" value={reservaSeleccionada.no_show ? "No show" : estadoBadge(reservaSeleccionada.estado).label} />
              <Info label="Early check-in" value={reservaSeleccionada.early_checkin ? "Sí" : "No"} />
              <Info label="Late check-out" value={reservaSeleccionada.late_checkout ? "Sí" : "No"} />
              {reservaSeleccionada.email_huesped && <Info label="Email" value={reservaSeleccionada.email_huesped} />}
              {reservaSeleccionada.telefono_huesped && <Info label="Teléfono" value={reservaSeleccionada.telefono_huesped} />}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>Pasajeros</div>
              <div style={{ display: "grid", gap: 7 }}>
                {obtenerListaPasajeros(reservaSeleccionada).map((pasajero, indice) => (
                  <div key={indice} style={{ padding: "9px 11px", background: "#f8fafc", borderRadius: 8, fontSize: 13 }}>
                    <strong>{indice + 1}. {pasajero.nombre}</strong>
                    {pasajero.dni ? ` · DNI ${pasajero.dni}` : ""}
                    {pasajero.menor ? " · Menor" : ""}
                  </div>
                ))}
              </div>
            </div>

            {reservaSeleccionada.notas && (
              <div style={{ marginTop: 20 }}>
                <div style={{ color: colors.muted, fontSize: 12, marginBottom: 5 }}>Notas</div>
                <div style={{ padding: 13, background: "#f8fafc", borderRadius: 8, fontSize: 14 }}>
                  {reservaSeleccionada.notas}
                </div>
              </div>
            )}

            <section style={{ marginTop: 22, padding: 16, border: `1px solid ${colors.border}`, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><strong>Cuenta del huésped</strong><div style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>Señas, pagos y saldo</div></div><strong style={{ color: saldoReserva(reservaSeleccionada) > 0 ? colors.red : colors.green }}>${saldoReserva(reservaSeleccionada).toLocaleString("es-AR")} pendiente</strong></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><div style={{ padding: 10, background: colors.greenSoft, borderRadius: 8 }}><div style={{ color: colors.muted, fontSize: 11 }}>Total</div><strong>${Number(reservaSeleccionada.precio_total||0).toLocaleString("es-AR")}</strong></div><div style={{ padding: 10, background: colors.blueSoft, borderRadius: 8 }}><div style={{ color: colors.muted, fontSize: 11 }}>Pagado</div><strong>${totalPagado(reservaSeleccionada.id).toLocaleString("es-AR")}</strong></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}><input type="number" min="0" step="0.01" value={pagoMonto} onChange={e=>setPagoMonto(e.target.value)} placeholder="Importe" style={inputStyle}/><select value={pagoMetodo} onChange={e=>setPagoMetodo(e.target.value)} style={inputStyle}><option>Efectivo</option><option>Transferencia</option><option>Mercado Pago</option><option>Tarjeta</option><option>Otro</option></select></div><input value={pagoNota} onChange={e=>setPagoNota(e.target.value)} placeholder="Nota del pago (opcional)" style={{ ...inputStyle, marginTop: 8 }}/><button onClick={()=>registrarPago(reservaSeleccionada)} style={{ ...primaryButton, width:"100%", marginTop:8 }} disabled={saldoReserva(reservaSeleccionada)<=0}>＋ Registrar pago</button>
              {pagos.filter(p=>String(p.reserva_id)===String(reservaSeleccionada.id)).length>0 && <div style={{ marginTop: 12, display:"grid",gap:6 }}>{pagos.filter(p=>String(p.reserva_id)===String(reservaSeleccionada.id)).map(p=><div key={p.id} style={{fontSize:11,padding:8,background:"#f8fafc",borderRadius:7}}>${Number(p.monto||0).toLocaleString("es-AR")} · {p.metodo} · {p.created_at ? new Date(p.created_at).toLocaleDateString("es-AR") : ""}</div>)}</div>}
            </section>

            <div style={{ display: "grid", gap: 9, marginTop: 28 }}>
              {reservaSeleccionada.email_huesped && (
                <button onClick={() => enviarResumenPorEmail(reservaSeleccionada)} style={primaryButton}>
                  ✉ Enviar resumen por email
                </button>
              )}
              <button onClick={() => imprimirReserva(reservaSeleccionada)} style={secondaryButton}>🖨 Imprimir reserva</button>
              <button onClick={() => agregarNoches(reservaSeleccionada, 1)} style={secondaryButton}>＋ Agregar 1 noche</button>
              <button onClick={() => editarReserva(reservaSeleccionada)} style={secondaryButton}>
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
