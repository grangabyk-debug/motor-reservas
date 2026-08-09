"use client"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

const colors = {
  navy: "var(--hl-navy)",
  navyDark: "var(--hl-navy-dark)",
  blue: "var(--hl-blue)",
  blueSoft: "var(--hl-blue-soft)",
  green: "var(--hl-green)",
  greenSoft: "var(--hl-green-soft)",
  yellow: "var(--hl-yellow)",
  yellowSoft: "var(--hl-yellow-soft)",
  red: "var(--hl-red)",
  redSoft: "var(--hl-red-soft)",
  text: "var(--hl-text)",
  muted: "var(--hl-muted)",
  border: "var(--hl-border)",
  bg: "var(--hl-bg)",
  white: "var(--hl-white)",
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
  const [rolReal, setRolReal] = useState("owner")

  const [alojamientos, setAlojamientos] = useState([])
  const [habitaciones, setHabitaciones] = useState([])
  const [reservas, setReservas] = useState([])

  const [vista, setVista] = useState("dashboard")
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [modoOscuro, setModoOscuro] = useState(false)

  const [config, setConfig] = useState({
    logo: "",
    nombreMarca: "Habitación Llena",
    whatsapp: "",
    bookingUrl: "",
    expediaUrl: "",
    airbnbUrl: "",
    despegarUrl: "",
    webUrl: "",
    // Los precios ya no se cargan por tipo en la configuración general.
    // Se mantienen estos valores únicamente como compatibilidad con reservas/configuraciones antiguas.
    tarifas: {
      simple: 0,
      doble: 0,
      triple: 0,
      cuadruple: 0,
      otro: 0,
      cochera: 0,
    },
    tiposHabitacion: ["Simple", "Doble", "Triple", "Cuádruple", "Otro"],
    habitacionesTarifas: {},
    earlyCheckin: { tipo: "monto", valor: 0 },
    lateCheckout: { tipo: "monto", valor: 0 },
    tipoCambioUSD: 1,
    vehiculosTarifas: { auto: 0, camioneta: 0 },
    pisos: [],
  })

  const logoHabitacionLlena = "/logo-habitacion-llena.png"

  useEffect(() => {
    const guardado = localStorage.getItem("habitacion_llena_modo_oscuro")
    if (guardado === "true") setModoOscuro(true)
  }, [])

  useEffect(() => {
    localStorage.setItem("habitacion_llena_modo_oscuro", String(modoOscuro))
    document.documentElement.dataset.hlTheme = modoOscuro ? "dark" : "light"
    document.body.dataset.hlTheme = modoOscuro ? "dark" : "light"
  }, [modoOscuro])

  function alternarModoOscuro() {
    setModoOscuro((actual) => !actual)
  }

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
  const [vehiculosConfig, setVehiculosConfig] = useState({ auto: 0, camioneta: 0 })
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
  const [pasajerosExtra, setPasajerosExtra] = useState([])
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [fechaEntrada, setFechaEntrada] = useState("")
  const [fechaSalida, setFechaSalida] = useState("")
  const [cantidadHuespedes, setCantidadHuespedes] = useState("1")
  const [estado, setEstado] = useState("pendiente")
  const [notas, setNotas] = useState("")
  const [vehiculos, setVehiculos] = useState("0")
  const [tipoVehiculo, setTipoVehiculo] = useState("")
  const [dominioVehiculo, setDominioVehiculo] = useState("")
  const [extraDescripcion, setExtraDescripcion] = useState("")
  const [extraReserva, setExtraReserva] = useState("0")
  const [descuentoTipo, setDescuentoTipo] = useState("monto")
  const [descuentoValor, setDescuentoValor] = useState("0")
  const [monedaReserva, setMonedaReserva] = useState("ARS")
  const [tipoCambioReserva, setTipoCambioReserva] = useState("")
  const [documentoArchivo, setDocumentoArchivo] = useState(null)
  const [garantiaTipo, setGarantiaTipo] = useState("")
  const [garantiaMarca, setGarantiaMarca] = useState("")
  const [garantiaUltimos4, setGarantiaUltimos4] = useState("")
  const [garantiaNumeroTarjeta, setGarantiaNumeroTarjeta] = useState("")
  const [garantiaCCV, setGarantiaCCV] = useState("")
  const [garantiaVencimiento, setGarantiaVencimiento] = useState("")
  const [garantiaReferencia, setGarantiaReferencia] = useState("")

  const [reservaSeleccionada, setReservaSeleccionada] = useState(null)
  const [confirmarCheckoutReserva, setConfirmarCheckoutReserva] = useState(null)
  const [recepcionSeccion, setRecepcionSeccion] = useState("panel")
  const [cajaDiaria, setCajaDiaria] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hl_caja_diaria") || "null") || { abierta:false, apertura:null, movimientos:[], cierres:[] } }
    catch { return { abierta:false, apertura:null, movimientos:[], cierres:[] } }
  })
  const [cajaMontoInicial, setCajaMontoInicial] = useState("")
  const [cajaMovimiento, setCajaMovimiento] = useState({ tipo:"ingreso", medio:"efectivo", concepto:"", monto:"", referencia:"" })
  const [cajaEfectivoContado, setCajaEfectivoContado] = useState("")
  const [cajaModal, setCajaModal] = useState(null)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(false)
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [habitacionEstados, setHabitacionEstados] = useState([])
  const [estadosHousekeepingPendientes, setEstadosHousekeepingPendientes] = useState({})
  const [bloqueos, setBloqueos] = useState([])
  const [pagos, setPagos] = useState([])
  const [pagoMonto, setPagoMonto] = useState("")
  const [pagoMetodo, setPagoMetodo] = useState("Efectivo")
  const [pagoNota, setPagoNota] = useState("")
  const [busquedaHuesped, setBusquedaHuesped] = useState("")
  const [bloqueoHabitacion, setBloqueoHabitacion] = useState("")
  const [bloqueoHabitaciones, setBloqueoHabitaciones] = useState([])
  const [bloqueoInicio, setBloqueoInicio] = useState(fechaLocal(0))
  const [bloqueoFin, setBloqueoFin] = useState(fechaLocal(1))
  const [bloqueoMotivo, setBloqueoMotivo] = useState("Mantenimiento")
  const [bloqueoDetalle, setBloqueoDetalle] = useState("")
  const [checklistHousekeeping, setChecklistHousekeeping] = useState({})
  const [filtroTipoCalendario, setFiltroTipoCalendario] = useState("General")
  const [mostrarAumentoPrecios, setMostrarAumentoPrecios] = useState(false)
  const [porcentajeAumento, setPorcentajeAumento] = useState("")
  const [menuOperativoAbierto, setMenuOperativoAbierto] = useState(false)
  const [menuAdministracionAbierto, setMenuAdministracionAbierto] = useState(false)
  const [bandejaConversacionActiva, setBandejaConversacionActiva] = useState(null)
  const [bandejaRespuesta, setBandejaRespuesta] = useState("")
  const [bandejaFiltro, setBandejaFiltro] = useState("Todos")
  const [bandejaConversaciones, setBandejaConversaciones] = useState([])
  const [webIntegracion, setWebIntegracion] = useState("propia")

  const [mostrarAlojamiento, setMostrarAlojamiento] = useState(false)
  const [nuevoAlojamiento, setNuevoAlojamiento] = useState("")
  const [mostrarHabitacion, setMostrarHabitacion] = useState(false)
  const [nuevaHabitacion, setNuevaHabitacion] = useState("")
  const [nuevoTipo, setNuevoTipo] = useState("")
  const [nuevoAlojamientoHabitacion, setNuevoAlojamientoHabitacion] = useState("")
  const [habitacionEditando, setHabitacionEditando] = useState(null)
  const [habitacionForm, setHabitacionForm] = useState({
    nombre: "",
    tipo: "",
    alojamiento_id: "",
    precio: 0,
  })
  const [nuevoTipoConfiguracion, setNuevoTipoConfiguracion] = useState("")
  const [nuevoPiso, setNuevoPiso] = useState("")

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
          const bandejaGuardada = localStorage.getItem(`habitacion_llena_bandeja_${session.user.id}`)
          if (bandejaGuardada) {
            try { setBandejaConversaciones(JSON.parse(bandejaGuardada) || []) } catch {}
          }

          if (guardada) {
            setConfig((actual) => {
              const parsed = JSON.parse(guardada)
              if (parsed.webIntegracion) setWebIntegracion(parsed.webIntegracion)
              return { ...actual, ...parsed }
            })
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

    // El acceso al alojamiento ya no depende de que el usuario
    // sea el dueño. Ahora se determina mediante property_members.
    const { data: membershipsData, error: membershipsError } = await supabase
      .from("property_members")
      .select("property_id, role")
      .eq("user_id", user.id)

    if (membershipsError) {
      console.error("No se pudieron cargar los accesos del usuario:", membershipsError)
    }

    const propertyIds = (membershipsData || []).map((m) => m.property_id).filter(Boolean)

    const rolDetectado = membershipsData?.[0]?.role || "owner"
    setRolReal(rolDetectado)

    const [
      { data: propertiesData, error: propertiesError },
      { data: alojamientosLegacy, error: alojamientosError },
      { data: habitacionesLegacy, error: habitacionesError },
      { data: reservasLegacy, error: reservasError },
      { data: bloqueosData, error: bloqueosError },
      { data: pagosData, error: pagosError },
    ] = await Promise.all([
      propertyIds.length
        ? supabase.from("properties").select("*").in("id", propertyIds).order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase.from("alojamientos").select("*").order("id", { ascending: true }),
      supabase.from("habitaciones").select("*").order("id", { ascending: true }),
      supabase.from("reservas").select("*").order("id", { ascending: false }),
      supabase.from("bloqueos").select("*").eq("user_id", user.id).order("fecha_desde", { ascending: true }),
      supabase.from("pagos").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ])

    if (propertiesError) console.error("No se pudieron cargar las propiedades:", propertiesError)
    if (alojamientosError) console.error("No se pudieron cargar los alojamientos:", alojamientosError)
    if (habitacionesError) console.error("No se pudieron cargar las habitaciones:", habitacionesError)
    if (reservasError) console.error("No se pudieron cargar las reservas:", reservasError)
    if (bloqueosError) console.warn("No se pudieron cargar los bloqueos. Ejecutá la migración PMS.", bloqueosError)
    if (pagosError) console.warn("No se pudieron cargar los pagos. Ejecutá la migración PMS.", pagosError)

    // La interfaz actual todavía trabaja con las tablas antiguas
    // alojamientos/habitaciones/reservas. Para que owner y reception
    // puedan usar la misma interfaz, filtramos esas tablas según los
    // alojamientos a los que el usuario tiene acceso.
    const propiedadesAccesibles = propertiesData || []
    const nombresAccesibles = new Set(
      propiedadesAccesibles
        .map((p) => String(p.name || "").trim().toLowerCase())
        .filter(Boolean)
    )

    const alojamientosData = (alojamientosLegacy || []).filter((a) => {
      const nombre = String(a.nombre || "").trim().toLowerCase()
      return nombresAccesibles.has(nombre) || String(a.user_id) === String(user.id)
    })

    const alojamientoIds = new Set(alojamientosData.map((a) => String(a.id)))

    const habitacionesData = (habitacionesLegacy || []).filter((h) =>
      alojamientoIds.has(String(h.alojamiento_id))
    )

    const reservasData = (reservasLegacy || []).filter((r) =>
      alojamientoIds.has(String(r.alojamiento_id))
    )

    // Si todavía no existe la fila legacy correspondiente, usamos
    // properties/units/reservations como respaldo para que el acceso
    // nuevo siga funcionando.
    let alojamientosFinal = alojamientosData
    let habitacionesFinal = habitacionesData
    let reservasFinal = reservasData

    if (!alojamientosFinal.length && propiedadesAccesibles.length) {
      alojamientosFinal = propiedadesAccesibles.map((p) => ({
        id: p.id,
        nombre: p.name,
        user_id: p.owner_id,
      }))
    }

    if (!habitacionesFinal.length && propertyIds.length) {
      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("*")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: true })

      if (unitsError) {
        console.error("No se pudieron cargar las unidades:", unitsError)
      } else {
        habitacionesFinal = (unitsData || []).map((u) => ({
          id: u.id,
          nombre: u.name,
          tipo: "",
          capacidad: u.capacity,
          precio: u.price,
          activa: u.active !== false,
          alojamiento_id: u.property_id,
          user_id: user.id,
          estado: "libre",
        }))
      }
    }

    if (!reservasFinal.length && propertyIds.length) {
      const { data: reservationsData, error: reservationsError } = await supabase
        .from("reservations")
        .select("*")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false })

      if (reservationsError) {
        console.error("No se pudieron cargar las reservas nuevas:", reservationsError)
      } else {
        reservasFinal = (reservationsData || []).map((r) => ({
          id: r.id,
          alojamiento_id: r.property_id,
          habitacion_id: r.unit_id,
          nombre_huesped: r.guest_name,
          email_huesped: r.guest_email,
          telefono_huesped: r.guest_phone,
          fecha_entrada: r.check_in,
          fecha_salida: r.check_out,
          cantidad_huespedes: r.guests || 1,
          precio_total: Number(r.total || 0),
          estado:
            r.status === "confirmed" ? "confirmada" :
            r.status === "cancelled" ? "cancelada" :
            r.status === "completed" ? "finalizada" :
            r.status || "pendiente",
          no_show: false,
        }))
      }
    }

    setAlojamientos(alojamientosFinal)
    setHabitaciones(habitacionesFinal)
    setReservas(reservasFinal)
    setHabitacionEstados(
      habitacionesFinal.map((h) => ({
        habitacion_id: h.id,
        estado: h.estado || "libre",
      }))
    )
    setEstadosHousekeepingPendientes(
      Object.fromEntries(
        habitacionesFinal.map((h) => [String(h.id), h.estado || "libre"])
      )
    )
    setBloqueos(bloqueosData || [])
    setPagos(pagosData || [])

    if (!alojamientoSeleccionado && alojamientosFinal.length) {
      setAlojamientoSeleccionado(String(alojamientosFinal[0].id))
    }
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
    const pendiente = estadosHousekeepingPendientes[String(id)]
    if (pendiente) return pendiente
    return habitaciones.find((h) => String(h.id) === String(id))?.estado || "libre"
  }

  function estadoHabitacionVisual(habitacion) {
    const manual = estadoHabitacionManual(habitacion.id)
    if (manual === "fuera_servicio") return "fuera_servicio"
    if (manual === "sucia") return "sucia"
    if (manual === "en_limpieza") return "en_limpieza"
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

  function seleccionarEstadoHousekeeping(habitacionId, estado) {
    setEstadosHousekeepingPendientes((actuales) => ({
      ...actuales,
      [String(habitacionId)]: estado,
    }))
  }

  async function cambiarEstadoHabitacion(habitacionId, estado = null) {
    const id = String(habitacionId)
    const estadoAGuardar = estado || estadosHousekeepingPendientes[id] || "libre"

    const { data, error } = await supabase
      .from("habitaciones")
      .update({ estado: estadoAGuardar })
      .eq("id", Number(habitacionId))
      .select("id, estado")
      .maybeSingle()

    if (error) {
      console.error(error)
      alert("No se pudo guardar el estado de la habitación. Verificá los permisos de la tabla habitaciones.")
      return false
    }

    if (!data) {
      alert("No se pudo guardar el estado. La habitación no está disponible para este usuario.")
      return false
    }

    setHabitaciones((actuales) =>
      actuales.map((h) =>
        String(h.id) === id ? { ...h, estado: estadoAGuardar } : h
      )
    )
    setHabitacionEstados((actuales) =>
      actuales.map((h) =>
        String(h.habitacion_id) === id ? { ...h, estado: estadoAGuardar } : h
      )
    )
    setEstadosHousekeepingPendientes((actuales) => ({
      ...actuales,
      [id]: estadoAGuardar,
    }))
    await cargarDatos()
    return true
  }

  function bloquesSeCruzan(inicioA, finA, inicioB, finB) {
    return inicioA < finB && finA > inicioB
  }

  function bloqueoParaHabitacion(habitacionId, inicio, fin) {
    return bloqueos.find((b) => String(b.habitacion_id) === String(habitacionId) && bloquesSeCruzan(inicio, fin, b.fecha_desde, b.fecha_hasta))
  }

  async function crearBloqueo(e) {
    e.preventDefault()
    const seleccionadas = bloqueoHabitaciones.length ? bloqueoHabitaciones : (bloqueoHabitacion ? [bloqueoHabitacion] : [])
    if (!seleccionadas.length || !bloqueoInicio || !bloqueoFin || bloqueoFin <= bloqueoInicio) {
      alert("Seleccioná al menos una habitación y fechas válidas.")
      return
    }
    const filas = seleccionadas.map((id) => ({
      user_id: user.id,
      habitacion_id: Number(id),
      fecha_desde: bloqueoInicio,
      fecha_hasta: bloqueoFin,
      motivo: bloqueoMotivo,
      detalle: bloqueoDetalle.trim(),
    }))
    const { error } = await supabase.from("bloqueos").insert(filas)
    if (error) {
      console.error(error)
      alert("No se pudo crear el bloqueo. Verificá la migración PMS.")
      return
    }
    setBloqueoHabitaciones([])
    setBloqueoHabitacion("")
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

  function totalPagado(reservaId, moneda = "ARS") {
    return pagos
      .filter((p) => String(p.reserva_id) === String(reservaId) && String(p.moneda || "ARS") === String(moneda))
      .reduce((s, p) => s + Number(p.monto || 0), 0)
  }

  function saldoReserva(reserva) {
    const moneda = reserva?.moneda || "ARS"
    const total = moneda === "USD"
      ? Number(reserva?.precio_total_usd || 0)
      : Number(reserva?.precio_total || 0)
    return Math.max(0, total - totalPagado(reserva?.id, moneda))
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
      moneda: reserva.moneda || "ARS",
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
    setPasajerosExtra([])
    setEmail("")
    setTelefono("")
    setFechaEntrada("")
    setFechaSalida("")
    setCantidadHuespedes("1")
    setEstado("pendiente")
    setNotas("")
    setVehiculos("0")
    setTipoVehiculo("")
    setDominioVehiculo("")
    setExtraDescripcion("")
    setExtraReserva("0")
    setDescuentoTipo("monto")
    setDescuentoValor("0")
    setMonedaReserva("ARS")
    setTipoCambioReserva("")
    setEarlyCheckin(false)
    setLateCheckout(false)
    setNoShow(false)
    setDocumentoArchivo(null)
    setGarantiaTipo("")
    setGarantiaMarca("")
    setGarantiaUltimos4("")
    setGarantiaNumeroTarjeta("")
    setGarantiaCCV("")
    setGarantiaVencimiento("")
    setGarantiaReferencia("")
    setReservaSeleccionada(null)
    setModoEdicion(false)
  }

  function editarReserva(reserva) {
    // Cerramos el panel lateral inmediatamente al pasar a edición.
    setReservaSeleccionada(null)
    setModoEdicion(true)
    setAlojamientoSeleccionado(String(reserva.alojamiento_id))
    setHabitacionSeleccionada(String(reserva.habitacion_id))
    setNombre(reserva.nombre_huesped || "")
    setDni(reserva.dni_huesped || "")
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
    setTipoVehiculo(reserva.tipo_vehiculo || "")
    setDominioVehiculo(reserva.dominio_vehiculo || "")
    setExtraDescripcion(reserva.extra_descripcion || "")
    setExtraReserva(String(reserva.extra ?? reserva.extras ?? 0))
    setDescuentoTipo(reserva.descuento_tipo || "monto")
    setDescuentoValor(String(reserva.descuento_valor ?? 0))
    setMonedaReserva(reserva.moneda || "ARS")
    setTipoCambioReserva(String(reserva.tipo_cambio || ""))
    setGarantiaTipo(reserva.garantia_tipo || "")
    setGarantiaMarca(reserva.garantia_marca || "")
    setGarantiaUltimos4(reserva.garantia_ultimos4 || "")
    setGarantiaNumeroTarjeta("")
    setGarantiaCCV("")
    setGarantiaVencimiento(reserva.garantia_vencimiento || "")
    setGarantiaReferencia(reserva.garantia_referencia || "")
    setDocumentoArchivo(null)
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

  const tiposHabitacionDisponibles = useMemo(() => {
    const base = Array.isArray(config.tiposHabitacion) && config.tiposHabitacion.length
      ? config.tiposHabitacion
      : ["Simple", "Doble", "Triple", "Cuádruple", "Otro"]
    return Array.from(new Set(base.map((tipo) => String(tipo || "").trim()).filter(Boolean)))
  }, [config.tiposHabitacion])

  function datosTarifaHabitacion(habitacionId) {
    const habitacion = habitaciones.find((h) => String(h.id) === String(habitacionId))
    const guardada = config.habitacionesTarifas?.[String(habitacionId)] || {}
    const clave = claveTipoHabitacion(habitacion?.tipo)
    const precioAnterior = Number(config.tarifas?.[clave] || 0)

    return {
      precio: Number(guardada.precio ?? habitacion?.precio ?? precioAnterior ?? 0),
      cochera: Number(guardada.cochera ?? config.tarifas?.cochera ?? 0),
      earlyTipo: guardada.earlyTipo || "monto",
      earlyValor: Number(guardada.earlyValor ?? config.earlyCheckin?.valor ?? 0),
      lateTipo: guardada.lateTipo || "monto",
      lateValor: Number(guardada.lateValor ?? config.lateCheckout?.valor ?? 0),
    }
  }

  function tarifaDeHabitacion(habitacionId) {
    return datosTarifaHabitacion(habitacionId).precio
  }

  function calcularRecargoServicio(base, configuracion) {
    const valor = Number(configuracion?.valor || 0)
    if (!valor) return 0
    return configuracion?.tipo === "porcentaje" ? base * valor / 100 : valor
  }

  function calcularImporteReserva() {
    if (!habitacionSeleccionada || !fechaEntrada || !fechaSalida) {
      const extra = Number(extraReserva) || 0
      return { noches: 0, tarifaNoche: 0, alojamiento: 0, cochera: 0, early: 0, late: 0, extra, descuento: 0, subtotal: extra, total: extra, totalUSD: 0, tipoCambio: Number(tipoCambioReserva || config.tipoCambioUSD || 1) || 1 }
    }

    const noches = diasEntre(fechaEntrada, fechaSalida)
    const tarifaHabitacion = datosTarifaHabitacion(habitacionSeleccionada)
    const tarifaNoche = tarifaHabitacion.precio
    const alojamiento = tarifaNoche * noches
    const cochera = (Number(vehiculos) || 0) * tarifaHabitacion.cochera * noches
    const early = earlyCheckin
      ? calcularRecargoServicio(tarifaNoche, { tipo: tarifaHabitacion.earlyTipo, valor: tarifaHabitacion.earlyValor })
      : 0
    const late = lateCheckout
      ? calcularRecargoServicio(tarifaNoche, { tipo: tarifaHabitacion.lateTipo, valor: tarifaHabitacion.lateValor })
      : 0
    const extra = Number(extraReserva) || 0
    const subtotal = alojamiento + cochera + early + late + extra
    const descuento = descuentoTipo === "porcentaje"
      ? subtotal * (Number(descuentoValor) || 0) / 100
      : Number(descuentoValor) || 0
    const total = Math.max(0, subtotal - descuento)
    const tipoCambio = Number(tipoCambioReserva || config.tipoCambioUSD || 1) || 1

    return { noches, tarifaNoche, alojamiento, cochera, early, late, extra, descuento, subtotal, total, totalUSD: total / tipoCambio, tipoCambio }
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
      menor: false,
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
      menor: false,
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
      `Extra${reserva.extra_descripcion ? ` (${reserva.extra_descripcion})` : ""}: $${extra.toLocaleString("es-AR")}`,
      reserva.descuento_valor ? `Descuento: ${reserva.descuento_tipo === "porcentaje" ? `${reserva.descuento_valor}%` : `$${Number(reserva.descuento_valor).toLocaleString("es-AR")}`}` : "",
      `TOTAL: ${reserva.moneda === "USD" ? `US$ ${Number(reserva.precio_total_usd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${total.toLocaleString("es-AR")}`}`,
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
    const early = Number(reserva.early_checkin_importe || 0)
    const late = Number(reserva.late_checkout_importe || 0)
    const subtotal = tarifaNoche * noches + cocheraPorNoche * vehiculosReserva * noches + early + late + extra
    const descuento = reserva.descuento_tipo === "porcentaje"
      ? subtotal * Number(reserva.descuento_valor || 0) / 100
      : Number(reserva.descuento_valor || 0)
    const precioTotal = Math.max(0, subtotal - descuento)
    const tipoCambio = Number(reserva.tipo_cambio || config.tipoCambioUSD || 1) || 1
    const precioTotalUSD = precioTotal / tipoCambio

    const { error } = await supabase
      .from("reservas")
      .update({
        fecha_salida: nuevaSalida,
        noches,
        precio_total: precioTotal,
        precio_total_usd: precioTotalUSD,
        cochera_total: cocheraPorNoche * vehiculosReserva * noches,
        subtotal,
        descuento_importe: descuento,
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

  async function realizarCheckIn(reserva) {
    if (!reserva?.id || reserva.estado === "cancelada" || reserva.no_show) return
    const { data, error } = await supabase
      .from("reservas")
      .update({ estado: "alojado" })
      .eq("id", reserva.id)
      .eq("user_id", user.id)
      .select("*")
      .single()
    if (error) {
      console.error(error)
      alert("No se pudo realizar el check-in.")
      return
    }
    setReservas((actuales) => actuales.map((r) => String(r.id) === String(reserva.id) ? data : r))
    setReservaSeleccionada(data)
  }

  async function confirmarYRealizarCheckOut(reserva) {
    if (!reserva?.id || reserva.estado === "cancelada" || reserva.no_show) return
    const saldo = saldoReserva(reserva)
    if (saldo > 0.01) {
      alert(`No se puede realizar el check-out. La cuenta tiene un saldo pendiente de ${reserva.moneda === "USD" ? "US$ " : "$"}${saldo.toLocaleString("es-AR", { minimumFractionDigits: reserva.moneda === "USD" ? 2 : 0 })}. Registrá el pago pendiente antes de continuar.`)
      return
    }
    setConfirmarCheckoutReserva(reserva)
  }

  async function realizarCheckOutConfirmado(reserva) {
    if (!reserva?.id || reserva.estado === "cancelada" || reserva.no_show) return

    const { error } = await supabase
      .from("reservas")
      .update({ estado: "finalizada" })
      .eq("id", reserva.id)
      .eq("user_id", user.id)

    if (error) {
      console.error("Error al finalizar reserva:", error)
      alert(`No se pudo realizar el check-out. ${error.message || "Revisá los permisos de la reserva."}`)
      return
    }

    // Después del check-out la habitación pasa automáticamente a SUCIA.
    const { error: errorLimpieza } = await supabase
      .from("habitaciones")
      .update({ estado: "sucia" })
      .eq("id", Number(reserva.habitacion_id))
      .eq("user_id", user.id)

    if (errorLimpieza) {
      console.error("La reserva finalizó, pero no se pudo marcar la habitación como sucia:", errorLimpieza)
      alert("El check-out se realizó, pero no se pudo marcar la habitación como sucia. Revisá los permisos de habitaciones.")
    }

    const reservaFinalizada = { ...reserva, estado: "finalizada" }
    setReservas((actuales) => actuales.map((r) => String(r.id) === String(reserva.id) ? reservaFinalizada : r))
    setHabitaciones((actuales) => actuales.map((h) =>
      String(h.id) === String(reserva.habitacion_id) ? { ...h, estado: "sucia" } : h
    ))
    setEstadosHousekeepingPendientes((actuales) => ({
      ...actuales,
      [String(reserva.habitacion_id)]: "sucia",
    }))
    setConfirmarCheckoutReserva(null)
    setReservaSeleccionada(null)
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

  function nochesEntre(fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) return 0
    return Math.max(0, Math.round((new Date(`${fechaFin}T12:00:00`) - new Date(`${fechaInicio}T12:00:00`)) / 86400000))
  }

  function calcularPresupuestoInicial() {
    const habitacion = habitacionesDisponibles.find(h => String(h.id) === String(habitacionSeleccionada))
    const noches = nochesEntre(fechaEntrada, fechaSalida)
    const precio = Number(habitacion?.precio_noche ?? habitacion?.tarifa ?? habitacion?.precio ?? habitacion?.valor_noche ?? 0)
    if (!habitacion || noches <= 0 || precio <= 0) return null
    return { habitacion, noches, precio, total: precio * noches }
  }

  function guardarCajaLocal(caja) {
    setCajaDiaria(caja)
    try { localStorage.setItem("hl_caja_diaria", JSON.stringify(caja)) } catch {}
  }

  function abrirCajaDiaria() {
    const monto = Number(cajaMontoInicial)
    if (!Number.isFinite(monto) || monto < 0) return alert("Ingresá un efectivo inicial válido.")
    guardarCajaLocal({
      ...cajaDiaria, abierta:true,
      apertura:{ id: String(Date.now()), fecha:new Date().toISOString(), usuario:user?.email || user?.id || "usuario", montoInicial:monto },
      movimientos:[]
    })
    setCajaMontoInicial("")
    setCajaModal(null)
  }

  function totalesCaja() {
    const movimientos = cajaDiaria.movimientos || []
    const ingresos = movimientos.filter(m => m.tipo === "ingreso").reduce((s,m) => s + Number(m.monto || 0), 0)
    const egresos = movimientos.filter(m => m.tipo === "egreso").reduce((s,m) => s + Number(m.monto || 0), 0)
    const inicial = Number(cajaDiaria.apertura?.montoInicial || 0)
    return { inicial, ingresos, egresos, esperado: inicial + ingresos - egresos }
  }

  function agregarMovimientoCaja(e) {
    e?.preventDefault?.()
    const monto = Number(cajaMovimiento.monto)
    if (!cajaDiaria.abierta) return alert("Primero tenés que abrir la caja.")
    if (!Number.isFinite(monto) || monto <= 0) return alert("Ingresá un importe válido.")
    if (!cajaMovimiento.concepto.trim()) return alert("Ingresá un concepto.")
    const movimiento = { id:String(Date.now()), fecha:new Date().toISOString(), usuario:user?.email || user?.id || "usuario", ...cajaMovimiento, monto }
    guardarCajaLocal({ ...cajaDiaria, movimientos:[movimiento, ...(cajaDiaria.movimientos || [])] })
    setCajaMovimiento({ tipo:"ingreso", medio:"efectivo", concepto:"", monto:"", referencia:"" })
  }

  function cerrarCajaDiaria() {
    const contado = Number(cajaEfectivoContado)
    if (!cajaDiaria.abierta) return
    if (!Number.isFinite(contado) || contado < 0) return alert("Ingresá el efectivo contado.")
    const t = totalesCaja()
    const cierre = { id:String(Date.now()), fechaApertura:cajaDiaria.apertura?.fecha, fechaCierre:new Date().toISOString(), usuarioApertura:cajaDiaria.apertura?.usuario, usuarioCierre:user?.email || user?.id || "usuario", ...t, contado, diferencia:contado-t.esperado, movimientos:cajaDiaria.movimientos || [] }
    guardarCajaLocal({ abierta:false, apertura:null, movimientos:[], cierres:[cierre, ...(cajaDiaria.cierres || [])] })
    setCajaEfectivoContado(""); setCajaModal(null)
  }

  function imprimirCierreCaja(cierre) {
    const filas = (cierre.movimientos || []).map(m => `<tr><td>${new Date(m.fecha).toLocaleString("es-AR")}</td><td>${m.concepto}</td><td>${m.medio}</td><td>${m.tipo}</td><td>$${Number(m.monto).toLocaleString("es-AR")}</td><td>${m.usuario}</td></tr>`).join("")
    const win = window.open("", "_blank", "width=900,height=700")
    if (!win) return
    win.document.write(`<html><head><title>Cierre de caja</title><style>body{font-family:Arial;padding:28px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:7px;font-size:12px}</style></head><body><h1>Habitación Llena · Caja diaria</h1><p>Cierre: ${new Date(cierre.fechaCierre).toLocaleString("es-AR")}</p><p>Inicial: $${cierre.inicial.toLocaleString("es-AR")} · Ingresos: $${cierre.ingresos.toLocaleString("es-AR")} · Egresos: $${cierre.egresos.toLocaleString("es-AR")} · Esperado: $${cierre.esperado.toLocaleString("es-AR")} · Contado: $${cierre.contado.toLocaleString("es-AR")} · Diferencia: $${cierre.diferencia.toLocaleString("es-AR")}</p><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Medio</th><th>Tipo</th><th>Monto</th><th>Usuario</th></tr></thead><tbody>${filas}</tbody></table><script>window.print()</script></body></html>`)
    win.document.close()
  }

  async function guardarReserva(e) {
    e.preventDefault()
    if (!alojamientoSeleccionado || !habitacionSeleccionada || !fechaEntrada || !fechaSalida) {
      alert("Completá alojamiento, habitación, fecha de entrada y fecha de salida para continuar.")
      return
    }
    if (fechaSalida <= fechaEntrada) {
      alert("La fecha de salida debe ser posterior a la fecha de entrada.")
      return
    }
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
      .neq("id", reservaSeleccionada?.id ?? -1)

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
      es_menor: false,
      pasajeros: obtenerPasajerosReserva(),
      email_huesped: email.trim(),
      telefono_huesped: telefono.trim(),
      fecha_entrada: fechaEntrada,
      fecha_salida: fechaSalida,
      cantidad_huespedes: obtenerPasajerosReserva().length,
      estado: (!modoEdicion && fechaEntrada === fechaLocal(0) && fechaSalida > fechaLocal(0)) ? "alojado" : estado,
      no_show: Boolean(noShow),
      early_checkin: Boolean(earlyCheckin),
      late_checkout: Boolean(lateCheckout),
      numero_reserva: modoEdicion && reservaSeleccionada?.numero_reserva ? reservaSeleccionada.numero_reserva : generarNumeroReserva(),
      notas: notas.trim(),
      user_id: user.id,
      extra_descripcion: extraDescripcion.trim(),
      moneda: monedaReserva,
      tipo_cambio: calculo.tipoCambio,
      descuento_tipo: descuentoTipo,
      descuento_valor: Number(descuentoValor) || 0,
      garantia_tipo: garantiaTipo || null,
      garantia_marca: garantiaMarca || null,
      garantia_ultimos4: (garantiaNumeroTarjeta ? garantiaNumeroTarjeta.slice(-4) : garantiaUltimos4) || null,
      garantia_vencimiento: garantiaVencimiento || null,
      garantia_referencia: garantiaTipo === "Tarjeta" ? null : (garantiaReferencia || null),
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
          early_checkin_importe: calculo.early,
          late_checkout_importe: calculo.late,
          extra_descripcion: extraDescripcion.trim(),
          extra: calculo.extra,
          descuento_tipo: descuentoTipo,
          descuento_valor: Number(descuentoValor) || 0,
          descuento_importe: calculo.descuento,
          subtotal: calculo.subtotal,
          precio_total: calculo.total,
          moneda: monedaReserva,
          tipo_cambio: calculo.tipoCambio,
          precio_total_usd: calculo.totalUSD,
        })
        .eq("id", reservaId)
        .eq("user_id", user.id)

      if (resultadoPrecios.error) {
        console.warn("No se pudieron guardar los importes. Ejecutá la migración SQL indicada para las nuevas columnas.", resultadoPrecios.error)
      }
    }

    if (reservaId && documentoArchivo) {
      const extension = documentoArchivo.name.split(".").pop()?.toLowerCase() || "bin"
      const path = `${user.id}/${reservaId}/${Date.now()}-documento.${extension}`
      const subida = await supabase.storage
        .from("reservation-documents")
        .upload(path, documentoArchivo, { upsert: true })

      if (subida.error) {
        console.warn("La reserva se guardó, pero no se pudo subir el documento.", subida.error)
        alert("La reserva se guardó, pero no se pudo subir el documento. Verificá el bucket privado de documentos.")
      } else {
        const { error: errorDocumento } = await supabase
          .from("reservas")
          .update({
            documento_path: path,
            documento_nombre: documentoArchivo.name,
          })
          .eq("id", reservaId)
          .eq("user_id", user.id)

        if (errorDocumento) {
          console.warn("No se pudo guardar la referencia del documento.", errorDocumento)
        }
      }
    }

    const reservaCreadaEsNueva = !modoEdicion
    const fechaParaCalendario = fechaEntrada
    setMensaje(modoEdicion ? "Reserva actualizada correctamente." : "Reserva creada correctamente.")
    limpiarFormulario()
    await cargarDatos()
    if (reservaCreadaEsNueva) {
      setFechaCalendario(fechaParaCalendario || fechaLocal(0))
      setVista("calendario")
    }
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
    const tipoFinal = nuevoTipo || tiposHabitacionDisponibles[0] || "Otro"

    if (!nuevaHabitacion.trim() || !nuevoAlojamientoHabitacion) {
      alert("Completá nombre y alojamiento.")
      return
    }

    const datos = {
      nombre: nuevaHabitacion.trim(),
      tipo: tipoFinal,
      alojamiento_id: Number(nuevoAlojamientoHabitacion),
      activa: true,
      user_id: user.id,
    }

    const { data, error } = await supabase
      .from("habitaciones")
      .insert([datos])
      .select("id")
      .single()

    if (error) {
      console.error(error)
      alert("No se pudo crear la habitación.")
      return
    }

    if (data?.id) {
      const configuracionActualizada = {
        ...config,
        habitacionesTarifas: {
          ...(config.habitacionesTarifas || {}),
          [String(data.id)]: {
            precio: 0,
            cochera: 0,
            earlyTipo: "monto",
            earlyValor: 0,
            lateTipo: "monto",
            lateValor: 0,
          },
        },
      }
      setConfig(configuracionActualizada)
      guardarConfiguracion(configuracionActualizada)
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
      alojado: { bg: colors.greenSoft, color: colors.green, label: "Alojado" },
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
    const [diasVista, setDiasVista] = useState(14)
    const [dragReservaId, setDragReservaId] = useState(null)
    const [dropTarget, setDropTarget] = useState(null)
    const [guardandoMovimiento, setGuardandoMovimiento] = useState(false)

    // Horarios operativos del alojamiento.
    // El calendario visualiza cada día como 24 h:
    // CHECK-OUT 10:00 → ventana de limpieza/rotación → CHECK-IN 14:00.
    const HORA_CHECKOUT = 10
    const HORA_CHECKIN = 14
    const FRACCION_CHECKIN = HORA_CHECKIN / 24
    const FRACCION_CHECKOUT = HORA_CHECKOUT / 24

    const calendarioDias = useMemo(() => {
      const base = new Date(`${fechaCalendario}T12:00:00`)
      return Array.from({ length: diasVista }, (_, i) => {
        const fecha = new Date(base)
        fecha.setDate(fecha.getDate() + i)
        const año = fecha.getFullYear()
        const mes = String(fecha.getMonth() + 1).padStart(2, "0")
        const dia = String(fecha.getDate()).padStart(2, "0")
        return `${año}-${mes}-${dia}`
      })
    }, [fechaCalendario, diasVista])

    function moverFechaCalendario(cantidad) {
      const d = new Date(`${fechaCalendario}T12:00:00`)
      d.setDate(d.getDate() + cantidad)
      setFechaCalendario(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
    }

    function prepararNuevaReserva(fecha, habitacion) {
      const salida = new Date(`${fecha}T12:00:00`)
      salida.setDate(salida.getDate() + 1)
      const salidaTexto = `${salida.getFullYear()}-${String(salida.getMonth() + 1).padStart(2, "0")}-${String(salida.getDate()).padStart(2, "0")}`
      setReservaSeleccionada(null)
      setModoEdicion(false)
      setMensaje("")
      setAlojamientoSeleccionado(String(habitacion.alojamiento_id))
      setHabitacionSeleccionada(String(habitacion.id))
      setFechaEntrada(fecha)
      setFechaSalida(salidaTexto)
      setNombre("")
      setDni("")
      setEmail("")
      setTelefono("")
      setPasajerosExtra([])
      setVista("reservas")
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50)
    }

    function arrastrarReserva(e, reserva) {
      setDragReservaId(String(reserva.id))
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", String(reserva.id))
      e.currentTarget.style.opacity = "0.45"
    }

    function terminarArrastre(e) {
      e.currentTarget.style.opacity = "1"
      setDragReservaId(null)
      setDropTarget(null)
    }

    async function moverReserva(reserva, nuevaHabitacionId, nuevaEntrada) {
      if (guardandoMovimiento) return

      const noches = Math.max(1, diasEntre(reserva.fecha_entrada, reserva.fecha_salida))
      const salidaDate = new Date(`${nuevaEntrada}T12:00:00`)
      salidaDate.setDate(salidaDate.getDate() + noches)
      const nuevaSalida = `${salidaDate.getFullYear()}-${String(salidaDate.getMonth() + 1).padStart(2, "0")}-${String(salidaDate.getDate()).padStart(2, "0")}`

      const mismoDestino =
        String(reserva.habitacion_id) === String(nuevaHabitacionId) &&
        reserva.fecha_entrada === nuevaEntrada

      if (mismoDestino) return

      const conflictoLocal = reservas.some((otra) => (
        String(otra.id) !== String(reserva.id) &&
        otra.estado !== "cancelada" &&
        !otra.no_show &&
        String(otra.habitacion_id) === String(nuevaHabitacionId) &&
        bloquesSeCruzan(nuevaEntrada, nuevaSalida, otra.fecha_entrada, otra.fecha_salida)
      ))

      if (conflictoLocal) {
        alert("No se puede mover la reserva: la habitación ya está ocupada en esas fechas.")
        return
      }

      const bloqueo = bloqueoParaHabitacion(nuevaHabitacionId, nuevaEntrada, nuevaSalida)
      if (bloqueo) {
        alert(`No se puede mover la reserva: la habitación está bloqueada del ${formatearFecha(bloqueo.fecha_desde)} al ${formatearFecha(bloqueo.fecha_hasta)}.`)
        return
      }

      setGuardandoMovimiento(true)
      const anterior = reserva

      setReservas((actuales) => actuales.map((r) => (
        String(r.id) === String(reserva.id)
          ? {
              ...r,
              habitacion_id: nuevaHabitacionId,
              fecha_entrada: nuevaEntrada,
              fecha_salida: nuevaSalida,
              noches,
            }
          : r
      )))

      const { error } = await supabase
        .from("reservas")
        .update({
          habitacion_id: nuevaHabitacionId,
          fecha_entrada: nuevaEntrada,
          fecha_salida: nuevaSalida,
        })
        .eq("id", reserva.id)

      if (error) {
        console.error(error)
        setReservas((actuales) => actuales.map((r) => (
          String(r.id) === String(anterior.id) ? anterior : r
        )))
        alert("No se pudo mover la reserva. Verificá los permisos de Supabase para esa operación.")
      }

      setGuardandoMovimiento(false)
      setDragReservaId(null)
      setDropTarget(null)
    }

    function soltarEnCelda(e, habitacion, fecha) {
      e.preventDefault()
      const id = e.dataTransfer.getData("text/plain") || dragReservaId
      if (!id) return

      const reserva = reservas.find((r) => String(r.id) === String(id))
      if (!reserva) return

      moverReserva(reserva, habitacion.id, fecha)
    }

    const hoy = fechaLocal(0)
    const anchoDia = diasVista === 30 ? 82 : diasVista === 14 ? 116 : 148
    const anchoHabitaciones = 220
    const gridTemplate = `${anchoHabitaciones}px repeat(${diasVista}, ${anchoDia}px)`
    const totalNoches = reservasActivas.reduce((s, r) => s + diasEntre(r.fecha_entrada, r.fecha_salida), 0)
    const habitacionesCalendario = habitacionesActivas.filter((h) => filtroTipoCalendario === "General" || String(h.tipo || "").toLowerCase() === String(filtroTipoCalendario || "").toLowerCase())

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 16,
          alignItems: "center",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 20, letterSpacing: -.3 }}>Plano de ocupación</h2>

              {guardandoMovimiento && (
                <span style={{
                  background: colors.blueSoft,
                  color: colors.blue,
                  padding: "5px 9px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                }}>
                  Guardando movimiento…
                </span>
              )}
            </div>
            <div style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>
              Las reservas se muestran desde el check-in de las 14:00 hasta el check-out de las 10:00.
            </div>
          </div>

          <div style={{
            display: "flex",
            gap: 7,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}>
            <button type="button" onClick={() => setFechaCalendario(hoy)} style={secondaryButton}>Hoy</button>
            <button type="button" onClick={() => moverFechaCalendario(-diasVista)} style={secondaryButton}>←</button>
            <input
              type="date"
              value={fechaCalendario}
              onChange={(e) => setFechaCalendario(e.target.value)}
              style={{ ...inputStyle, width: 145 }}
            />
            <button type="button" onClick={() => moverFechaCalendario(diasVista)} style={secondaryButton}>→</button>
            {[7, 14, 30].map((cantidad) => (
              <button
                key={cantidad}
                type="button"
                onClick={() => setDiasVista(cantidad)}
                style={diasVista === cantidad ? primaryButton : secondaryButton}
              >
                {cantidad} días
              </button>
            ))}
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}>
          {[
            ["Habitaciones", habitacionesActivas.length, "unidades activas", colors.navy],
            ["Ocupadas hoy", reservasHoy.length, `${habitacionesActivas.length ? Math.round(reservasHoy.length / habitacionesActivas.length * 100) : 0}% ocupación`, colors.blue],
            ["Entradas", entradasHoy.length, "check-in hoy · 14:00", colors.green],
            ["Noches en agenda", totalNoches, "estadías activas", "#7c3aed"],
          ].map(([label, value, detail, color]) => (
            <div key={label} style={{
              background: colors.white,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: "13px 15px",
              boxShadow: "0 5px 18px rgba(15,23,42,.035)",
            }}>
              <div style={{
                color: colors.muted,
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: .5,
              }}>
                {label}
              </div>
              <div style={{ fontSize: 23, fontWeight: 850, color, marginTop: 4 }}>{value}</div>
              <div style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>{detail}</div>
            </div>
          ))}
        </div>

        <div style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "center",
          fontSize: 11,
          fontWeight: 700,
        }}>
          <span>
            <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: colors.green, marginRight: 5 }} />
            Alojado
          </span>
          <span>
            <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: "#7c3aed", marginRight: 5 }} />
            Confirmada / futura
          </span>
          <span>
            <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: colors.yellow, marginRight: 5 }} />
            Pendiente
          </span>
          <span>
            <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: colors.red, marginRight: 5 }} />
            Salida hoy
          </span>
          <span style={{ color: colors.muted }}>↔ Arrastrá para mover</span>
          <span style={{ color: colors.muted }}>＋ Click en una celda para reservar</span>
        </div>

        <div style={{
          overflowX: "auto",
          border: `1px solid ${colors.border}`,
          borderRadius: 14,
          background: colors.white,
          boxShadow: "0 10px 35px rgba(15,23,42,.055)",
        }}>
          <div style={{ minWidth: anchoHabitaciones + diasVista * anchoDia }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: gridTemplate,
              position: "sticky",
              top: 0,
              zIndex: 8,
              background: "rgba(248,250,252,.98)",
              backdropFilter: "blur(12px)",
              borderBottom: `1px solid ${colors.border}`,
            }}>
              <div style={{
                position: "sticky",
                left: 0,
                zIndex: 10,
                padding: "13px 15px",
                background: "#f8fafc",
                borderRight: `1px solid ${colors.border}`,
              }}>
                <select
                  value={filtroTipoCalendario}
                  onChange={(e) => setFiltroTipoCalendario(e.target.value)}
                  style={{ ...inputStyle, width: "100%", padding: "7px 9px", fontSize: 12, fontWeight: 850 }}
                  aria-label="Filtrar habitaciones por tipo"
                >
                  <option value="General">Habitaciones · General</option>
                  {tiposHabitacionDisponibles.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
                <div style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>Disponibilidad en tiempo real</div>
              </div>

              {calendarioDias.map((fecha) => {
                const date = new Date(`${fecha}T12:00:00`)
                const diaSemana = date.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")
                const esHoy = fecha === hoy
                const finDeSemana = [0, 6].includes(date.getDay())

                return (
                  <div
                    key={fecha}
                    style={{
                      textAlign: "center",
                      padding: "8px 3px 6px",
                      borderLeft: `1px solid ${colors.border}`,
                      background: esHoy ? colors.blueSoft : colors.white,
                    }}
                  >
                    <div style={{
                      fontSize: 9,
                      textTransform: "uppercase",
                      color: esHoy ? colors.blue : colors.muted,
                      fontWeight: 800,
                    }}>
                      {diaSemana}
                    </div>
                    <div style={{
                      fontSize: 18,
                      lineHeight: 1.1,
                      fontWeight: 850,
                      color: esHoy ? colors.blue : colors.text,
                      marginTop: 2,
                    }}>
                      {fecha.slice(8)}
                    </div>
                    <div style={{ fontSize: 9, color: colors.muted }}>{nombreMes(fecha)}</div>

                  </div>
                )
              })}
            </div>

            {habitacionesCalendario.map((habitacion) => {
              const reservasHabitacion = reservasActivas.filter((r) =>
                String(r.habitacion_id) === String(habitacion.id) &&
                r.fecha_salida > calendarioDias[0] &&
                r.fecha_entrada <= calendarioDias[calendarioDias.length - 1]
              )

              const estado = estadoHabitacionVisual(habitacion)
              const info = infoEstadoHabitacion(estado)
              const ocupada = reservasHoy.some((r) => String(r.habitacion_id) === String(habitacion.id))

              return (
                <div
                  key={habitacion.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                    minHeight: 88,
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <div
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 5,
                      background: colors.white,
                      borderRight: `1px solid ${colors.border}`,
                      padding: "11px 13px",
                      cursor: "pointer",
                    }}
                    onDoubleClick={() => {
                      setVista("reservas")
                      setHabitacionSeleccionada(String(habitacion.id))
                      setAlojamientoSeleccionado(String(habitacion.alojamiento_id))
                    }}
                  >
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 6,
                      alignItems: "center",
                    }}>
                      <strong style={{ fontSize: 12 }}>{habitacion.nombre}</strong>
                      <span style={{
                        width: 7,
                        height: 7,
                        borderRadius: 99,
                        background: ocupada ? colors.blue : info.color,
                        flexShrink: 0,
                      }} />
                    </div>
                    <div style={{
                      color: colors.muted,
                      fontSize: 9,
                      marginTop: 4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {nombreAlojamiento(habitacion.alojamiento_id)}
                    </div>
                    <div style={{ color: info.color, fontSize: 9, fontWeight: 800, marginTop: 6 }}>
                      {info.label}
                    </div>
                  </div>

                  <div style={{
                    position: "relative",
                    minHeight: 88,
                    display: "grid",
                    gridTemplateColumns: `repeat(${diasVista}, ${anchoDia}px)`,
                    background: "#fff",
                  }}>
                    {calendarioDias.map((fecha) => {
                      const esHoy = fecha === hoy
                      const esFinDeSemana = [0, 6].includes(new Date(`${fecha}T12:00:00`).getDay())
                      const isDrop = dropTarget === `${habitacion.id}-${fecha}`

                      return (
                        <div
                          key={fecha}
                          onClick={() => prepararNuevaReserva(fecha, habitacion)}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = "move"
                            setDropTarget(`${habitacion.id}-${fecha}`)
                          }}
                          onDragLeave={() => setDropTarget(null)}
                          onDrop={(e) => {
                            setDropTarget(null)
                            soltarEnCelda(e, habitacion, fecha)
                          }}
                          style={{
                            position: "relative",
                            borderLeft: `1px solid ${colors.border}`,
                            background: isDrop
                              ? "#dbeafe"
                              : esHoy
                                ? "rgba(22,119,232,.045)"
                                : esFinDeSemana
                                  ? "#fcfcfe"
                                  : "#fff",
                            minHeight: 88,
                            cursor: "crosshair",
                            transition: "background .12s",
                            overflow: "hidden",
                          }}
                        >
                        </div>
                      )
                    })}

                    {bloqueos
                      .filter((b) =>
                        String(b.habitacion_id) === String(habitacion.id) &&
                        b.fecha_hasta > calendarioDias[0] &&
                        b.fecha_desde <= calendarioDias[calendarioDias.length - 1]
                      )
                      .map((bloqueo) => {
                        let inicio = calendarioDias.findIndex((f) => f >= bloqueo.fecha_desde)
                        let fin = calendarioDias.findIndex((f) => f >= bloqueo.fecha_hasta)
                        if (inicio < 0) inicio = 0
                        if (fin < 0) fin = calendarioDias.length
                        if (fin <= inicio) return null

                        const left = inicio * anchoDia + 4
                        const width = Math.max(20, (fin - inicio) * anchoDia - 8)

                        return (
                          <div
                            key={`bloqueo-${bloqueo.id}`}
                            title={`Bloqueo: ${bloqueo.motivo || "Sin motivo"}`}
                            style={{
                              position: "absolute",
                              left,
                              width,
                              top: 14,
                              height: 60,
                              borderRadius: 10,
                              background: "repeating-linear-gradient(135deg,#334155 0,#334155 8px,#1e293b 8px,#1e293b 16px)",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              padding: "0 9px",
                              boxSizing: "border-box",
                              fontSize: 10,
                              fontWeight: 800,
                              overflow: "hidden",
                              zIndex: 3,
                              boxShadow: "0 3px 8px rgba(15,23,42,.12)",
                            }}
                          >
                            🔒 {bloqueo.motivo || "Bloqueada"}
                          </div>
                        )
                      })}

                    {reservasHabitacion.map((reserva) => {
                      let inicio = calendarioDias.findIndex((f) => f >= reserva.fecha_entrada)
                      let fin = calendarioDias.findIndex((f) => f >= reserva.fecha_salida)

                      if (inicio < 0) inicio = 0
                      if (fin < 0) fin = calendarioDias.length
                      if (fin <= inicio) return null

                      const noches = Math.max(1, diasEntre(reserva.fecha_entrada, reserva.fecha_salida))
                      const estadoVisual =
                        hoy < reserva.fecha_entrada
                          ? "futura"
                          : hoy >= reserva.fecha_salida
                            ? "out"
                            : "in"

                      const pendiente = reserva.estado === "pendiente"
                      const colorReserva =
                        reserva.estado === "finalizada"
                          ? colors.red
                          : estadoVisual === "in"
                            ? colors.green
                            : estadoVisual === "out"
                              ? colors.red
                              : pendiente
                                ? colors.yellow
                                : "#7c3aed"

                      /*
                       * CLAVE DEL PLANO:
                       * La reserva NO ocupa el día completo.
                       * Empieza a las 14:00 del IN y termina a las 10:00 del OUT.
                       *
                       * Ejemplo 09 → 11:
                       * 09 14:00 ───────────── 10  ───────────── 11 10:00
                       *
                       * Visualmente:
                       * inicio = 58.33% del día de entrada
                       * fin    = 41.67% del día de salida
                       */
                      const recorteInicio = reserva.fecha_entrada < calendarioDias[0] ? 0 : FRACCION_CHECKIN
                      const inicioVisible = inicio * anchoDia + (reserva.fecha_entrada < calendarioDias[0] ? 0 : recorteInicio * anchoDia)

                      const finVisible =
                        reserva.fecha_salida > calendarioDias[calendarioDias.length - 1]
                          ? diasVista * anchoDia
                          : fin * anchoDia + FRACCION_CHECKOUT * anchoDia

                      const anchoReserva = Math.max(52, finVisible - inicioVisible - 6)
                      const salidaVisibleEnVista = reserva.fecha_salida <= calendarioDias[calendarioDias.length - 1]

                      return (
                        <div
                          key={reserva.id}
                          draggable
                          onDragStart={(e) => arrastrarReserva(e, reserva)}
                          onDragEnd={terminarArrastre}
                          onClick={(e) => {
                            e.stopPropagation()
                            setReservaSeleccionada(reserva)
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            editarReserva(reserva)
                          }}
                          title={`${reserva.nombre_huesped} · ${formatearFecha(reserva.fecha_entrada)} 14:00 → ${formatearFecha(reserva.fecha_salida)} 10:00 · ${reserva.cantidad_huespedes || 1} pax\nArrastrá para mover`}
                          style={{
                            position: "absolute",
                            left: inicioVisible + 3,
                            width: anchoReserva,
                            top: 14,
                            height: 60,
                            borderRadius: 10,
                            background: colorReserva,
                            color: "#fff",
                            padding: "8px 10px",
                            boxSizing: "border-box",
                            fontSize: 10,
                            fontWeight: 700,
                            overflow: "hidden",
                            cursor: dragReservaId === String(reserva.id) ? "grabbing" : "grab",
                            zIndex: 4,
                            boxShadow: "0 5px 14px rgba(15,23,42,.18)",
                            border: pendiente
                              ? "1px dashed rgba(255,255,255,.85)"
                              : "1px solid rgba(255,255,255,.2)",
                            userSelect: "none",
                          }}
                        >
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            minWidth: 0,
                          }}>
                            <span style={{ opacity: .8, fontSize: 9 }}>⋮⋮</span>
                            <strong style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                              {reserva.nombre_huesped || "Sin nombre"}
                            </strong>
                          </div>

                          {anchoReserva > 95 && (
                            <div style={{
                              opacity: .86,
                              marginTop: 4,
                              fontSize: 9,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}>
                              {reserva.numero_reserva || "Reserva"} · {reserva.cantidad_huespedes || 1} pax
                            </div>
                          )}

                          {anchoReserva > 125 && (
                            <div style={{
                              position: "absolute",
                              left: 10,
                              bottom: 7,
                              display: "flex",
                              gap: 8,
                              fontSize: 8,
                              opacity: .88,
                              whiteSpace: "nowrap",
                            }}>
                              <span>IN 14:00</span>
                              {salidaVisibleEnVista && <span>OUT 10:00</span>}
                            </div>
                          )}

                          <div style={{
                            position: "absolute",
                            right: 8,
                            bottom: 7,
                            fontSize: 8,
                            opacity: .78,
                          }}>
                            {noches}n
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          color: colors.muted,
          fontSize: 11,
        }}>
          <span>
            💡 <strong>10:00</strong> salida · <strong>10:00–14:00</strong> recambio · <strong>14:00</strong> entrada.
          </span>
          <span>
            Arrastrá una reserva para cambiar fecha o habitación · Click libre = nueva reserva · Doble click = editar
          </span>
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
    const seleccionadas = bloqueoHabitaciones
    const toggleHabitacionBloqueo = (id) => {
      setBloqueoHabitaciones((actuales) => actuales.includes(String(id))
        ? actuales.filter((x) => x !== String(id))
        : [...actuales, String(id)]
      )
    }
    return (<><Header titulo="Bloqueos" subtitulo="Evitá vender habitaciones por mantenimiento, uso propietario o grupos" /><div style={{ padding: 30, display: "grid", gridTemplateColumns: ".9fr 1.1fr", gap: 18 }}>
      <section style={cardStyle}><h2 style={{ margin: 0, fontSize: 18 }}>Nuevo bloqueo</h2>
        <form onSubmit={crearBloqueo} style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <Field label="Habitaciones">
            <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: 10, maxHeight: 280, overflowY: "auto", overscrollBehavior: "contain", scrollbarWidth: "thin", background: colors.white }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: colors.muted }}>{seleccionadas.length} seleccionada{seleccionadas.length === 1 ? "" : "s"}</span>
                <button type="button" onClick={() => setBloqueoHabitaciones(seleccionadas.length === habitacionesActivas.length ? [] : habitacionesActivas.map(h => String(h.id)))} style={{ ...secondaryButton, padding: "6px 9px", fontSize: 11 }}>
                  {seleccionadas.length === habitacionesActivas.length ? "Quitar todas" : "Seleccionar todas"}
                </button>
              </div>
              {habitacionesActivas.map((h) => (
                <label key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: `1px solid ${colors.border}`, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={seleccionadas.includes(String(h.id))} onChange={() => toggleHabitacionBloqueo(h.id)} />
                  <span><strong>{h.nombre}</strong> · {h.tipo || "Sin tipo"} · {nombreAlojamiento(h.alojamiento_id)}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Desde"><input type="date" value={bloqueoInicio} onChange={e => setBloqueoInicio(e.target.value)} style={inputStyle}/></Field>
          <Field label="Hasta"><input type="date" value={bloqueoFin} onChange={e => setBloqueoFin(e.target.value)} style={inputStyle}/></Field>
          <Field label="Motivo"><select value={bloqueoMotivo} onChange={e => setBloqueoMotivo(e.target.value)} style={inputStyle}><option>Mantenimiento</option><option>Uso propietario</option><option>Grupo</option><option>Otro</option></select></Field>
          <Field label="Detalle"><textarea value={bloqueoDetalle} onChange={e => setBloqueoDetalle(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} /></Field>
          <button type="submit" style={primaryButton}>Bloquear {seleccionadas.length > 1 ? `${seleccionadas.length} habitaciones` : "habitación"}</button>
        </form>
      </section>
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

  const rolActivo = rolReal

  const permisosPorRol = {
    owner: [
      "dashboard", "reservas", "calendario", "housekeeping",
      "bloqueos", "huespedes", "caja", "ventas", "comunicaciones",
      "integraciones", "asistente", "asistencia", "bandeja", "configuracion",
    ],
    manager: [
      "dashboard", "reservas", "calendario", "housekeeping",
      "bloqueos", "huespedes", "caja", "ventas", "comunicaciones",
      "asistente", "asistencia", "bandeja",
    ],
    reception: [
      "dashboard", "reservas", "calendario", "housekeeping",
      "huespedes", "comunicaciones", "asistente", "asistencia", "bandeja",
    ],
    housekeeping: [
      "dashboard", "reservas", "recepcion", "calendario", "housekeeping", "asistencia",
    ],
    admin: [
      "dashboard", "reservas", "recepcion", "calendario", "huespedes",
      "caja", "ventas", "comunicaciones", "asistente", "asistencia", "bandeja",
    ],
  }

  const etiquetasRol = {
    owner: "Propietario",
    manager: "Gerente",
    reception: "Recepción",
    housekeeping: "Housekeeping",
    admin: "Administración",
  }

  function puedeVer(id) {
    return (permisosPorRol[rolActivo] || permisosPorRol.reception).includes(id)
  }

  useEffect(() => {
    if (vista !== "dashboard" && !puedeVer(vista)) {
      setVista("dashboard")
    }
  }, [rolActivo, vista])

  function Sidebar() {
    const navButton = (id, icon, label) => {
      if (!puedeVer(id)) return null
      return (
        <button
          key={id}
          onClick={() => { setVista(id); setMenuAbierto(false) }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: "none",
            background: vista === id ? "rgba(255,255,255,.14)" : "transparent",
            boxShadow: vista === id ? "inset 3px 0 0 #fff" : "none",
            color: "#fff",
            padding: "10px 12px",
            borderRadius: 9,
            marginBottom: 3,
            cursor: "pointer",
            textAlign: "left",
            fontSize: 14,
            fontWeight: vista === id ? 700 : 500,
          }}
        >
          <span style={{ width: 20, textAlign: "center", opacity: .9 }}>{icon}</span>
          {label}{id === "bandeja" && bandejaConversaciones.filter(c => c.noLeida).length > 0 && <span style={{ marginLeft: "auto", minWidth: 18, height: 18, borderRadius: 999, background: colors.red, color: "#fff", fontSize: 10, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{bandejaConversaciones.filter(c => c.noLeida).length}</span>}
        </button>
      )
    }

    const grupoOperacion = [
      ["housekeeping", "🧹", "Housekeeping"],
      ["bloqueos", "🚫", "Bloqueos"],
      ["huespedes", "👤", "Huéspedes"],
    ]
    const grupoAdministracion = [
      ["caja", "💰", "Caja y pagos"],
      ["ventas", "◫", "Ventas"],
    ]
    const grupoComunicacion = [
      ["bandeja", "📥", "Bandeja de entrada"],
      ["comunicaciones", "✉", "Comunicaciones"],
      ["integraciones", "↔", "Integraciones"],
      ["asistente", "✦", "Asistente IA"],
      ["asistencia", "🆘", "Asistencia humana"],
    ]

    const grupoActivo = (grupo) => grupo.some(([id]) => id === vista)

    return (
      <aside style={{
        width: 220,
        background: `linear-gradient(180deg, ${colors.navyDark} 0%, #06275b 100%)`,
        color: "#fff",
        height: "100vh",
        maxHeight: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 20,
        padding: "20px 11px",
        boxShadow: "8px 0 28px rgba(3,32,77,.08)",
        boxSizing: "border-box",
        overflowY: "auto",
      }}>
        <div style={{ padding: "6px 10px 22px" }}>
          <div style={{ fontSize: 9, letterSpacing: 2.2, opacity: .7 }}>PLATAFORMA HOTELERA</div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <img src={config.logo || logoHabitacionLlena} alt="Habitación Llena" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 7, background: "#fff" }} />
            <div style={{ fontSize: 19, fontWeight: 850, letterSpacing: -.4, lineHeight: 1.05 }}>{config.nombreMarca || "Habitación Llena"}</div>
          </div>
        </div>

        <div style={{ fontSize: 10, opacity: .5, padding: "0 10px 7px" }}>GESTIÓN</div>
        {navButton("dashboard", "▦", "Inicio")}
        {navButton("reservas", "▣", "Reservas")}
        {navButton("recepcion", "▣", "Recepción")}
        {navButton("calendario", "▤", "Calendario")}

        {grupoOperacion.some(([id]) => puedeVer(id)) && <>
          <button type="button" onClick={() => setMenuOperativoAbierto(!menuOperativoAbierto)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", background: grupoActivo(grupoOperacion) ? "rgba(255,255,255,.09)" : "transparent", color: "#fff", padding: "10px 12px", borderRadius: 9, margin: "3px 0", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: 700 }}>
            <span>🧹 Operación</span><span style={{ opacity: .7 }}>{menuOperativoAbierto || grupoActivo(grupoOperacion) ? "⌃" : "⌄"}</span>
          </button>
          {(menuOperativoAbierto || grupoActivo(grupoOperacion)) && <div style={{ paddingLeft: 8 }}>{grupoOperacion.map(([id, icon, label]) => navButton(id, icon, label))}</div>}
        </>}

        {grupoAdministracion.some(([id]) => puedeVer(id)) && <>
          <button type="button" onClick={() => setMenuAdministracionAbierto(!menuAdministracionAbierto)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", background: grupoActivo(grupoAdministracion) ? "rgba(255,255,255,.09)" : "transparent", color: "#fff", padding: "10px 12px", borderRadius: 9, margin: "3px 0", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: 700 }}>
            <span>💼 Administración</span><span style={{ opacity: .7 }}>{menuAdministracionAbierto || grupoActivo(grupoAdministracion) ? "⌃" : "⌄"}</span>
          </button>
          {(menuAdministracionAbierto || grupoActivo(grupoAdministracion)) && <div style={{ paddingLeft: 8 }}>{grupoAdministracion.map(([id, icon, label]) => navButton(id, icon, label))}</div>}
        </>}

        {grupoComunicacion.some(([id]) => puedeVer(id)) && <>
          <div style={{ fontSize: 10, opacity: .5, padding: "12px 10px 5px" }}>HERRAMIENTAS</div>
          {grupoComunicacion.map(([id, icon, label]) => navButton(id, icon, label))}
        </>}

        <div style={{ position: "absolute", bottom: 14, left: 20, right: 20, fontSize: 9, opacity: .45, textAlign: "center" }}>Habitación Llena · MVP</div>
      </aside>
    )
  }

  function Header({ titulo, subtitulo }) {
    const nombreUsuario = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario"
    const inicial = nombreUsuario.charAt(0).toUpperCase()
    const mostrarUsuarios = rolActivo === "owner"

    return (
      <header className="app-header" style={{
        height: 72,
        background: "rgba(255,255,255,.94)",
        borderBottom: `1px solid ${colors.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 30px",
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(14px)",
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: -.35 }}>{titulo}</div>
          {subtitulo && <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{subtitulo}</div>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {mostrarUsuarios && (
            <button
              onClick={() => { window.location.href = "/dashboard/usuarios" }}
              style={{ ...topActionButton, display: "flex", alignItems: "center", gap: 7 }}
            >
              <span>♙</span> Usuarios
            </button>
          )}
          {puedeVer("configuracion") && (
            <button
              onClick={() => { setConfigSubvista("general"); setVista("configuracion") }}
              style={{ ...topActionButton, display: "flex", alignItems: "center", gap: 7 }}
            >
              <span>⚙</span> Config
            </button>
          )}
          <button
            type="button"
            onClick={alternarModoOscuro}
            title={modoOscuro ? "Cambiar a modo día" : "Cambiar a modo noche"}
            aria-label={modoOscuro ? "Cambiar a modo día" : "Cambiar a modo noche"}
            style={{ ...topActionButton, display: "flex", alignItems: "center", gap: 7 }}
          >
            <span>{modoOscuro ? "☀" : "☾"}</span> {modoOscuro ? "Modo día" : "Modo noche"}
          </button>
          <div className="user-chip" style={{ display: "flex", alignItems: "center", gap: 9, marginLeft: 5, padding: "5px 9px 5px 5px", border: `1px solid ${colors.border}`, borderRadius: 999, background: "#fff" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: colors.blueSoft, color: colors.navy, fontWeight: 800, fontSize: 12 }}>{inicial}</div>
            <div style={{ lineHeight: 1.05 }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{nombreUsuario}</div>
              <div style={{ fontSize: 10, color: colors.muted, marginTop: 3 }}>{etiquetasRol[rolActivo] || "Usuario"}</div>
            </div>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = "/"
            }}
            style={{ ...topActionButton, padding: "9px 12px" }}
          >
            Salir
          </button>
          {["owner", "manager", "reception"].includes(rolActivo) && (
            <button
              onClick={() => {
                limpiarFormulario()
                setVista("reservas")
              }}
              style={{
                ...primaryButton,
                borderRadius: 9,
                padding: "10px 15px",
                boxShadow: "0 6px 16px rgba(22,119,232,.20)",
              }}
            >
              + Nueva reserva
            </button>
          )}
        </div>
      </header>
    )
  }

  function guardarBandeja(conversaciones) {
    setBandejaConversaciones(conversaciones)
    if (user?.id) localStorage.setItem(`habitacion_llena_bandeja_${user.id}`, JSON.stringify(conversaciones))
  }

  function abrirAsistenciaHumana() {
    const numero = String(process.env.NEXT_PUBLIC_HL_SUPPORT_WHATSAPP || "").replace(/\D/g, "")
    if (!numero) {
      alert("Todavía no está configurado el WhatsApp de asistencia. Definí NEXT_PUBLIC_HL_SUPPORT_WHATSAPP en el entorno de la aplicación.")
      return
    }
    const mensaje = encodeURIComponent(`Hola, necesito asistencia con Habitación Llena. Alojamiento: ${nombreAlojamientoActivo}. Usuario: ${user?.email || user?.id || "sin identificar"}. Necesito ayuda con:`)
    window.open(`https://wa.me/${numero}?text=${mensaje}`, "_blank", "noopener,noreferrer")
  }

  function guardarConfiguracion(valorConfig = config) {
    try {
      if (!user?.id) {
        alert("No hay una sesión activa.")
        return
      }

      const claveConfig = `habitacion_llena_config_${user.id}`
      localStorage.setItem(claveConfig, JSON.stringify(valorConfig))
      setConfigGuardada(true)
      setTimeout(() => setConfigGuardada(false), 2500)
    } catch (error) {
      console.error(error)
      alert("No se pudo guardar la configuración.")
    }
  }

  function handleDocumentoUpload(e) {
    const file = e.target.files?.[0] || null
    if (!file) {
      setDocumentoArchivo(null)
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      alert("El documento debe pesar menos de 8 MB.")
      e.target.value = ""
      setDocumentoArchivo(null)
      return
    }

    setDocumentoArchivo(file)
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
        body: JSON.stringify({ question: pregunta, context: { ...contexto, plataforma: "Habitación Llena PMS", instruccionesAyuda: "Respondé también preguntas sobre cómo usar la plataforma. Explicá paso a paso dónde debe tocar el usuario para crear habitaciones, configurar tarifas, hacer reservas, bloquear habitaciones, usar housekeeping, check-in/check-out, configurar integraciones, bandeja de entrada y asistencia humana. No inventes funciones que no existan. Si la consulta requiere una conexión externa todavía no implementada, indicá que debe configurarse en la etapa de integración correspondiente." } }),
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
        descripcion: "Canal de consultas del alojamiento. La conexión API real se completará en una etapa posterior.",
        estado: config.whatsapp ? "Configurado" : "Pendiente",
        color: "#25D366",
        url: whatsappLink(),
      },
      {
        nombre: "Instagram",
        descripcion: "Preparado para recibir consultas de Instagram en la bandeja omnicanal.",
        estado: config.instagram ? "Configurado" : "Pendiente",
        color: "#E1306C",
        url: config.instagram || "",
      },
      {
        nombre: "Email",
        descripcion: "Preparado para centralizar consultas recibidas por email.",
        estado: config.emailSoporte ? "Configurado" : "Pendiente",
        color: "#475569",
        url: config.emailSoporte || "",
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
          <section style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={sectionHeader}><div><h2 style={{ margin: 0, fontSize: 18 }}>🌐 Página web + motor de reservas</h2><div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Primer paso de la integración: definí de dónde viene la web del alojamiento.</div></div><span style={{ padding: "5px 9px", borderRadius: 999, background: colors.blueSoft, color: colors.blue, fontSize: 11, fontWeight: 800 }}>PREPARADO PARA CONECTAR</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
            <label style={{ border: `1px solid ${webIntegracion === "propia" ? colors.blue : colors.border}`, borderRadius: 10, padding: 15, cursor: "pointer", background: webIntegracion === "propia" ? colors.blueSoft : colors.white }}><input type="radio" checked={webIntegracion === "propia"} onChange={()=>setWebIntegracion("propia")} /> <strong>Ya tengo una página web</strong><div style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>La web existente se conectará al motor de reservas de Habitación Llena.</div></label>
            <label style={{ border: `1px solid ${webIntegracion === "habitacion_llena" ? colors.blue : colors.border}`, borderRadius: 10, padding: 15, cursor: "pointer", background: webIntegracion === "habitacion_llena" ? colors.blueSoft : colors.white }}><input type="radio" checked={webIntegracion === "habitacion_llena"} onChange={()=>setWebIntegracion("habitacion_llena")} /> <strong>Quiero una web de Habitación Llena</strong><div style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>La página y el motor de reservas quedarán preparados para trabajar con el PMS.</div></label>
          </div>
          <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: colors.bg, border: `1px solid ${colors.border}` }}><strong>Cómo funcionará</strong><div style={{ color: colors.muted, fontSize: 12, lineHeight: 1.6, marginTop: 5 }}>Página web → Motor de reservas → disponibilidad del calendario → reserva confirmada → PMS. En esta primera etapa dejamos configurado el origen de la web; la conexión real con disponibilidad y reservas la hacemos en el siguiente paso.</div></div>
          <button type="button" onClick={()=>{ const actualizado={...config, webIntegracion}; setConfig(actualizado); guardarConfiguracion(actualizado) }} style={{ ...primaryButton, marginTop: 14 }}>Guardar integración web</button>
        </section>
        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={sectionHeader}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>🔗 Centro de conexiones</h2>
              <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Conectá cada canal desde un único lugar. Las autorizaciones oficiales de Meta y otros proveedores se completarán paso a paso.</div>
            </div>
            <span style={{ padding: "5px 9px", borderRadius: 999, background: colors.blueSoft, color: colors.blue, fontSize: 11, fontWeight: 800 }}>FÁCIL DE CONFIGURAR</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12, marginTop: 16 }}>
            {[
              ["Instagram", "📸", "Conectar cuenta"],
              ["WhatsApp", "🟢", "Conectar canal"],
              ["Página web", "🌐", "Configurar motor"],
              ["Email", "✉️", "Conectar correo"],
            ].map(([nombre, icono, accion]) => (
              <div key={nombre} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 15, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: colors.bg, display: "grid", placeItems: "center", fontSize: 20 }}>{icono}</div>
                <div style={{ flex: 1 }}>
                  <strong>{nombre}</strong>
                  <div style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>Configuración sencilla, sin tokens técnicos visibles.</div>
                </div>
                <button type="button" onClick={() => {
                  if (nombre === "Página web") return setWebIntegracion("propia")
                  alert(`${nombre}: conexión real disponible en la próxima etapa de integración. Por ahora dejamos el flujo preparado.`)
                }} style={secondaryButton}>{accion}</button>
              </div>
            ))}
          </div>
        </section>
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
                Reservas, ocupación, huéspedes, habitaciones y rendimiento. También podés preguntarme cómo usar cualquier parte de la plataforma.
              </div>
              <button type="button" onClick={() => setVista("asistencia")} style={{ marginTop: 12, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.1)", color: "#fff", borderRadius: 8, padding: "8px 11px", fontWeight: 700, cursor: "pointer" }}>
                🆘 Necesito asistencia humana
              </button>
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

  function agregarTipoHabitacionConfiguracion() {
    const nombre = nuevoTipoConfiguracion.trim()
    if (!nombre) return

    const existe = tiposHabitacionDisponibles.some(
      (tipo) => tipo.toLowerCase() === nombre.toLowerCase()
    )
    if (existe) {
      alert("Ese tipo de habitación ya existe.")
      return
    }

    setConfig((actual) => ({
      ...actual,
      tiposHabitacion: [...tiposHabitacionDisponibles, nombre],
    }))
    setNuevoTipoConfiguracion("")
  }

  function eliminarTipoHabitacionConfiguracion(tipo) {
    const usado = habitaciones.some(
      (h) => String(h.tipo || "").trim().toLowerCase() === String(tipo).trim().toLowerCase()
    )

    if (usado) {
      alert("No podés eliminar este tipo porque hay habitaciones que lo están usando.")
      return
    }

    const esPredeterminado = ["simple", "doble", "triple", "cuádruple", "otro"].includes(
      String(tipo).trim().toLowerCase()
    )
    if (esPredeterminado) {
      alert("Los tipos predeterminados no se eliminan. Podés dejarlos sin usar.")
      return
    }

    setConfig((actual) => ({
      ...actual,
      tiposHabitacion: tiposHabitacionDisponibles.filter(
        (item) => item.toLowerCase() !== String(tipo).toLowerCase()
      ),
    }))
  }

  const pisosConfigurados = Array.isArray(config.pisos) ? config.pisos : []

  function agregarPisoConfiguracion() {
    const nombre = nuevoPiso.trim()
    if (!nombre) return
    if (pisosConfigurados.some((p) => String(p).toLowerCase() === nombre.toLowerCase())) {
      alert("Ese piso ya existe.")
      return
    }
    const actualizado = { ...config, pisos: [...pisosConfigurados, nombre] }
    setConfig(actualizado)
    guardarConfiguracion(actualizado)
    setNuevoPiso("")
  }

  function eliminarPisoConfiguracion(piso) {
    const asignadas = habitaciones.filter((h) => String(config.habitacionesPisos?.[String(h.id)] || "") === String(piso))
    if (asignadas.length) {
      alert(`No podés eliminar ${piso} porque tiene ${asignadas.length} habitación(es) asignada(s). Reasignalas primero.`)
      return
    }
    const actualizado = { ...config, pisos: pisosConfigurados.filter((p) => String(p) !== String(piso)) }
    setConfig(actualizado)
    guardarConfiguracion(actualizado)
  }

  function asignarPisoHabitacion(habitacionId, piso) {
    const mapa = { ...(config.habitacionesPisos || {}) }
    if (piso) mapa[String(habitacionId)] = piso
    else delete mapa[String(habitacionId)]
    const actualizado = { ...config, habitacionesPisos: mapa }
    setConfig(actualizado)
    guardarConfiguracion(actualizado)
  }

  function iniciarEdicionHabitacion(habitacion) {
    const tarifa = datosTarifaHabitacion(habitacion.id)

    setHabitacionEditando(habitacion.id)
    setHabitacionForm({
      nombre: habitacion.nombre || "",
      tipo: habitacion.tipo || tiposHabitacionDisponibles[0] || "",
      alojamiento_id: String(habitacion.alojamiento_id || ""),
      precio: tarifa.precio,
    })
    setMostrarHabitacion(false)
  }

  function cancelarEdicionHabitacion() {
    setHabitacionEditando(null)
    setHabitacionForm({
      nombre: "",
      tipo: "",
      alojamiento_id: "",
      precio: 0,
    })
  }

  async function guardarEdicionHabitacion(e) {
    e.preventDefault()
    if (!habitacionEditando || !habitacionForm.nombre.trim() || !habitacionForm.tipo || !habitacionForm.alojamiento_id) {
      alert("Completá nombre, tipo y alojamiento.")
      return
    }

    const { error } = await supabase
      .from("habitaciones")
      .update({
        nombre: habitacionForm.nombre.trim(),
        tipo: habitacionForm.tipo,
        alojamiento_id: Number(habitacionForm.alojamiento_id),
      })
      .eq("id", habitacionEditando)
      .eq("user_id", user.id)

    if (error) {
      console.error(error)
      alert("No se pudo actualizar la habitación.")
      return
    }

    const configuracionActualizada = {
      ...config,
      habitacionesTarifas: {
        ...(config.habitacionesTarifas || {}),
        [String(habitacionEditando)]: {
          ...(config.habitacionesTarifas?.[String(habitacionEditando)] || {}),
          precio: Number(habitacionForm.precio) || 0,
        },
      },
    }

    setConfig(configuracionActualizada)
    guardarConfiguracion(configuracionActualizada)
    cancelarEdicionHabitacion()
    await cargarDatos()
  }

  async function eliminarHabitacion(habitacion) {
    const tieneReservas = reservas.some(
      (r) => String(r.habitacion_id) === String(habitacion.id)
    )

    if (tieneReservas) {
      alert("Esta habitación tiene reservas asociadas. No se puede eliminar sin perder el historial. Podés desactivarla.")
      return
    }

    if (!confirm(`¿Eliminar la habitación "${habitacion.nombre}"?`)) return

    const { error } = await supabase
      .from("habitaciones")
      .delete()
      .eq("id", habitacion.id)
      .eq("user_id", user.id)

    if (error) {
      console.error(error)
      alert("No se pudo eliminar la habitación.")
      return
    }

    const tarifas = { ...(config.habitacionesTarifas || {}) }
    delete tarifas[String(habitacion.id)]
    const configuracionActualizada = { ...config, habitacionesTarifas: tarifas }
    setConfig(configuracionActualizada)
    guardarConfiguracion(configuracionActualizada)

    cancelarEdicionHabitacion()
    await cargarDatos()
  }

  async function alternarHabitacion(habitacion) {
    const nuevaActiva = habitacion.activa === false

    const { error } = await supabase
      .from("habitaciones")
      .update({ activa: nuevaActiva })
      .eq("id", habitacion.id)
      .eq("user_id", user.id)

    if (error) {
      console.error(error)
      alert("No se pudo cambiar el estado de la habitación.")
      return
    }

    await cargarDatos()
  }

  function AsistenciaHumana() {
    return (<>
      <Header titulo="Asistencia humana" subtitulo="Contactá directamente al equipo de soporte" />
      <div style={{ padding: 30 }}>
        <section style={{ ...cardStyle, maxWidth: 760, margin: "0 auto", textAlign: "center", padding: 36 }}>
          <div style={{ width: 64, height: 64, margin: "0 auto 16px", borderRadius: 18, display: "grid", placeItems: "center", background: "#dff7ea", color: "#168a4a", fontSize: 30 }}>🆘</div>
          <h2 style={{ margin: 0, fontSize: 22 }}>¿Necesitás hablar con una persona?</h2>
          <p style={{ color: colors.muted, lineHeight: 1.6, maxWidth: 560, margin: "10px auto 22px" }}>Para consultas que no pueda resolver el Asistente IA o para asistencia sobre tu cuenta, escribinos directamente por WhatsApp.</p>
          <button onClick={abrirAsistenciaHumana} style={{ ...primaryButton, background: "#1fa855", padding: "13px 20px", borderRadius: 10 }}>💬 Abrir WhatsApp de asistencia</button>
        </section>
      </div>
    </>)
  }

  function BandejaEntrada() {
    const canales = ["Todos", "WhatsApp", "Instagram", "Web", "Email"]
    const filtradas = bandejaConversaciones.filter((c) => bandejaFiltro === "Todos" || c.canal === bandejaFiltro)
    const activa = filtradas.find((c) => c.id === bandejaConversacionActiva) || filtradas[0]

    function seleccionarConversacion(c) {
      setBandejaConversacionActiva(c.id)
      if (c.noLeida) {
        const actualizadas = bandejaConversaciones.map((x) => x.id === c.id ? { ...x, noLeida: false } : x)
        guardarBandeja(actualizadas)
      }
    }

    function responder(e) {
      e.preventDefault()
      const texto = bandejaRespuesta.trim()
      if (!texto || !activa) return
      const actualizadas = bandejaConversaciones.map((c) => c.id === activa.id ? { ...c, mensajes: [...(c.mensajes || []), { autor: "hotel", texto, fecha: new Date().toISOString() }] } : c)
      guardarBandeja(actualizadas)
      setBandejaRespuesta("")
    }

    return (<><Header titulo="Bandeja de entrada" subtitulo="Consultas de WhatsApp, Instagram, web y email en un solo lugar" />
      <div style={{ padding: 30 }}>
        <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8, padding: 14, borderBottom: `1px solid ${colors.border}`, flexWrap: "wrap" }}>
            {canales.map((canal) => <button key={canal} onClick={() => setBandejaFiltro(canal)} style={bandejaFiltro === canal ? primaryButton : secondaryButton}>{canal}</button>)}
            <span style={{ marginLeft: "auto", color: colors.muted, fontSize: 12, alignSelf: "center" }}>La IA está preparada, pero desactivada.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", minHeight: 520 }}>
            <div style={{ borderRight: `1px solid ${colors.border}`, overflowY: "auto" }}>
              {filtradas.length ? filtradas.map((c) => <button key={c.id} onClick={() => seleccionarConversacion(c)} style={{ width: "100%", border: "none", borderBottom: `1px solid ${colors.border}`, background: activa?.id === c.id ? colors.blueSoft : colors.white, padding: 14, textAlign: "left", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{c.nombre || "Consulta"}</strong><span style={{ fontSize: 10, color: colors.muted }}>{c.canal}</span></div>
                <div style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>{c.mensajes?.[c.mensajes.length - 1]?.texto || "Sin mensajes"}</div>
                {c.noLeida && <span style={{ display: "inline-block", marginTop: 7, padding: "3px 7px", borderRadius: 999, background: colors.red, color: "#fff", fontSize: 10, fontWeight: 800 }}>NUEVO</span>}
              </button>) : <div style={{ padding: 30, color: colors.muted, textAlign: "center" }}>No hay conversaciones conectadas todavía.<div style={{ marginTop: 8, fontSize: 12 }}>Cuando conectemos WhatsApp, Instagram, web o email, van a aparecer acá.</div></div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              {activa ? <><div style={{ padding: 16, borderBottom: `1px solid ${colors.border}` }}><strong>{activa.nombre}</strong><div style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{activa.canal} · {activa.email || activa.telefono || "Sin contacto"}</div></div><div style={{ flex: 1, padding: 18, overflowY: "auto", background: colors.bg }}>{(activa.mensajes || []).map((m,i)=><div key={i} style={{ display: "flex", justifyContent: m.autor === "hotel" ? "flex-end" : "flex-start", marginBottom: 10 }}><div style={{ maxWidth: "75%", padding: "10px 12px", borderRadius: 12, background: m.autor === "hotel" ? colors.blue : colors.white, color: m.autor === "hotel" ? "#fff" : colors.text, border: m.autor === "hotel" ? "none" : `1px solid ${colors.border}`, fontSize: 13 }}>{m.texto}</div></div>)}</div><form onSubmit={responder} style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${colors.border}` }}><input value={bandejaRespuesta} onChange={(e)=>setBandejaRespuesta(e.target.value)} placeholder="Escribí una respuesta..." style={{ ...inputStyle, flex: 1 }} /><button type="submit" style={primaryButton}>Responder</button></form></> : <div style={{ flex: 1, display: "grid", placeItems: "center", color: colors.muted }}>Seleccioná una conversación</div>}
            </div>
          </div>
        </section>
      </div>
    </>)
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
    if (configSubvista === "vehiculos") return (
      <>
        <Header titulo="Configuración · Vehículos" subtitulo="Tipos de vehículos y valores de cochera" />
        <div style={{ padding: 30 }}>
          <div style={{ ...cardStyle, marginBottom: 18 }}>
            <button onClick={() => setConfigSubvista("general")} style={secondaryButton}>← Volver a configuración</button>
          </div>
          <section style={{ ...cardStyle, maxWidth: 900 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Vehículos</h2>
            <div style={{ color: colors.muted, fontSize: 12, marginTop: 5, marginBottom: 20 }}>
              Configurá el valor por noche de cochera según el tipo de vehículo.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Auto · valor por noche">
                <input
                  type="number"
                  min="0"
                  value={vehiculosConfig.auto}
                  onChange={(e) => setVehiculosConfig((v) => ({ ...v, auto: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Camioneta · valor por noche">
                <input
                  type="number"
                  min="0"
                  value={vehiculosConfig.camioneta}
                  onChange={(e) => setVehiculosConfig((v) => ({ ...v, camioneta: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => {
                  const actualizado = {
                    ...config,
                    vehiculosTarifas: {
                      auto: Number(vehiculosConfig.auto) || 0,
                      camioneta: Number(vehiculosConfig.camioneta) || 0,
                    },
                  }
                  setConfig(actualizado)
                  guardarConfiguracion(actualizado)
                }}
                style={primaryButton}
              >
                Guardar vehículos
              </button>
            </div>
          </section>
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
              <button onClick={() => setConfigSubvista("vehiculos")} style={secondaryButton}>Vehículos</button>
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
    const recientes = reservas
      .filter((r) => r.estado !== "cancelada" && r.estado !== "finalizada" && r.fecha_entrada >= fechaLocal(0))
      .sort((a, b) => String(a.fecha_entrada).localeCompare(String(b.fecha_entrada)))
      .slice(0, 5)

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

          {(habitacionesActivas.length === 0 || !config.nombreMarca || alojamientos.length === 0) && (
            <section style={{ ...cardStyle, marginBottom: 18, border: `1px solid ${colors.blue}` }}>
              <div style={sectionHeader}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>🚀 Configuración inicial</h2>
                  <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Cada alojamiento nuevo comienza con su propio espacio y puede completar estos pasos.</div>
                </div>
                <button onClick={() => setVista("configuracion")} style={primaryButton}>Completar configuración</button>
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                {[
                  ["Datos del alojamiento", Boolean(config.nombreMarca && alojamientos.length)],
                  ["Habitaciones", habitacionesActivas.length > 0],
                  ["Canales e integraciones", Boolean(config.whatsapp || config.webUrl)],
                  ["Bandeja de entrada", true],
                ].map(([label, ok]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12 }}>
                    <span style={{ color: ok ? colors.green : colors.muted, fontWeight: 900 }}>{ok ? "✓" : "○"}</span>
                    <span style={{ fontWeight: ok ? 700 : 500 }}>{label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

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

          <section style={{ ...cardStyle, marginBottom: 18 }}>
            <div style={sectionHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>📥 Bandeja de entrada</h2>
                <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Consultas que todavía requieren atención</div>
              </div>
              <button onClick={() => setVista("bandeja")} style={linkButton}>Ver bandeja →</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 15 }}>
              {["WhatsApp","Instagram","Web","Email"].map((canal) => {
                const pendientes = bandejaConversaciones.filter((c) => c.noLeida && c.canal === canal).length
                return (
                  <button key={canal} onClick={() => setVista("bandeja")} style={{
                    border: `1px solid ${pendientes ? colors.red : colors.border}`,
                    background: pendientes ? colors.redSoft : colors.bg,
                    borderRadius: 10,
                    padding: 12,
                    textAlign: "left",
                    cursor: "pointer",
                  }}>
                    <div style={{ color: colors.muted, fontSize: 11 }}>{canal}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
                      <strong style={{ fontSize: 20, color: pendientes ? colors.red : colors.text }}>{pendientes}</strong>
                      <span style={{ color: colors.muted, fontSize: 11 }}>{pendientes === 1 ? "pendiente" : "pendientes"}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            {bandejaConversaciones.filter(c => c.noLeida).length === 0 && (
              <div style={{ marginTop: 12, color: colors.green, fontSize: 12, fontWeight: 700 }}>✓ Todo al día. No hay mensajes pendientes.</div>
            )}
          </section>

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
                  <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Solo reservas futuras</div>
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

  function Recepcion() {
    const q = calcularPresupuestoInicial()
    return (
      <>
        <Header titulo="Recepción" subtitulo="Operación diaria del alojamiento" />
        <div style={{ padding: 30 }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
            {[
              ["panel","🏠 Panel"],
              ["presupuesto","🧮 Presupuestar"],
              ["caja","💵 Caja diaria"],
            ].map(([key,label]) => (
              <button key={key} onClick={() => setRecepcionSeccion(key)} style={recepcionSeccion===key ? primaryButton : secondaryButton}>{label}</button>
            ))}
          </div>

          {recepcionSeccion === "panel" && (
            <section style={cardStyle}>
              <h2 style={{marginTop:0}}>Recepción</h2>
              <p style={{color:colors.muted}}>Accesos rápidos para la operación diaria.</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12}}>
                <button onClick={() => setVista("reservas")} style={secondaryButton}>➕ Cargar reserva</button>
                <button onClick={() => setRecepcionSeccion("presupuesto")} style={secondaryButton}>🧮 Presupuestar</button>
                <button onClick={() => setRecepcionSeccion("caja")} style={secondaryButton}>💵 Caja diaria</button>
              </div>
            </section>
          )}

          {recepcionSeccion === "presupuesto" && (
            <section style={cardStyle}>
              <h2 style={{marginTop:0}}>Presupuesto rápido</h2>
              <p style={{color:colors.muted}}>Completá los cuatro datos para calcular cuánto costaría la estadía.</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10}}>
                <select required value={alojamientoSeleccionado} onChange={e=>{setAlojamientoSeleccionado(e.target.value);setHabitacionSeleccionada("")}} style={inputStyle}><option value="">Alojamiento</option>{alojamientos.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}</select>
                <select required value={habitacionSeleccionada} onChange={e=>setHabitacionSeleccionada(e.target.value)} style={inputStyle}><option value="">Habitación</option>{habitacionesDisponibles.map(h=><option key={h.id} value={h.id}>{h.nombre}{h.tipo?` · ${h.tipo}`:""}</option>)}</select>
                <input required type="date" value={fechaEntrada} onChange={e=>setFechaEntrada(e.target.value)} style={inputStyle}/>
                <input required type="date" value={fechaSalida} onChange={e=>setFechaSalida(e.target.value)} style={inputStyle}/>
              </div>
              {q ? (
                <div style={{marginTop:16,padding:"15px 18px",borderRadius:12,border:`1px solid ${colors.blue}`,background:colors.blueSoft,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:11,fontWeight:900,color:colors.blue}}>PRESUPUESTO DE ESTADÍA</div><div style={{fontSize:13,fontWeight:700,marginTop:4}}>{q.habitacion.nombre} · {q.noches} {q.noches===1?"noche":"noches"}</div><div style={{fontSize:11,color:colors.muted}}>${q.precio.toLocaleString("es-AR")} por noche</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:11,color:colors.muted}}>Total estimado</div><div style={{fontSize:27,fontWeight:900,color:colors.blue}}>${q.total.toLocaleString("es-AR")}</div></div>
                </div>
              ) : <div style={{marginTop:12,fontSize:12,color:colors.muted}}>Completá alojamiento, habitación, entrada y salida.</div>}
            </section>
          )}

          {recepcionSeccion === "caja" && (
            <section style={cardStyle}>
              <div style={sectionHeader}>
                <div><h2 style={{margin:0}}>💵 Caja diaria</h2><div style={{fontSize:12,color:colors.muted,marginTop:4}}>Apertura, movimientos y cierre de turno.</div></div>
                {cajaDiaria.abierta ? <button onClick={()=>setCajaModal("cerrar")} style={{...primaryButton,background:colors.red}}>🔒 Cerrar turno</button> : <button onClick={()=>setCajaModal("abrir")} style={primaryButton}>Abrir caja</button>}
              </div>
              {cajaDiaria.abierta && <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:16}}>
                  {Object.entries(totalesCaja()).map(([k,v])=><div key={k} style={{border:`1px solid ${colors.border}`,borderRadius:10,padding:13}}><div style={{fontSize:11,color:colors.muted}}>{({inicial:"Inicial",ingresos:"Ingresos",egresos:"Egresos",esperado:"Esperado"})[k]}</div><strong style={{fontSize:20}}>${Number(v).toLocaleString("es-AR")}</strong></div>)}
                </div>
                <form onSubmit={agregarMovimientoCaja} style={{display:"grid",gridTemplateColumns:"130px 150px 1fr 140px 140px auto",gap:8,marginTop:16}}>
                  <select value={cajaMovimiento.tipo} onChange={e=>setCajaMovimiento({...cajaMovimiento,tipo:e.target.value})} style={inputStyle}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select>
                  <select value={cajaMovimiento.medio} onChange={e=>setCajaMovimiento({...cajaMovimiento,medio:e.target.value})} style={inputStyle}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option><option value="mercadopago">Mercado Pago</option><option value="otro">Otro</option></select>
                  <input value={cajaMovimiento.concepto} onChange={e=>setCajaMovimiento({...cajaMovimiento,concepto:e.target.value})} placeholder="Concepto" style={inputStyle}/>
                  <input type="number" min="0" step="0.01" value={cajaMovimiento.monto} onChange={e=>setCajaMovimiento({...cajaMovimiento,monto:e.target.value})} placeholder="Monto" style={inputStyle}/>
                  <input value={cajaMovimiento.referencia} onChange={e=>setCajaMovimiento({...cajaMovimiento,referencia:e.target.value})} placeholder="Referencia" style={inputStyle}/>
                  <button style={primaryButton}>Agregar</button>
                </form>
                <div style={{marginTop:18,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Hora","Concepto","Medio","Tipo","Monto","Usuario"].map(h=><th key={h} style={{textAlign:"left",padding:9,borderBottom:`1px solid ${colors.border}`}}>{h}</th>)}</tr></thead><tbody>{(cajaDiaria.movimientos||[]).map(m=><tr key={m.id}>{[new Date(m.fecha).toLocaleString("es-AR"),m.concepto,m.medio,m.tipo,`$${Number(m.monto).toLocaleString("es-AR")}`,m.usuario].map((v,i)=><td key={i} style={{padding:9,borderBottom:`1px solid ${colors.border}`}}>{v}</td>)}</tr>)}</tbody></table></div>
              </>}
              <div style={{marginTop:22}}><h3>Historial de cierres</h3>{(cajaDiaria.cierres||[]).map(c=><div key={c.id} style={{border:`1px solid ${colors.border}`,borderRadius:10,padding:12,marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><strong>{new Date(c.fechaCierre).toLocaleString("es-AR")}</strong><div style={{fontSize:11,color:colors.muted}}>Esperado ${Number(c.esperado).toLocaleString("es-AR")} · Contado ${Number(c.contado).toLocaleString("es-AR")} · Diferencia ${Number(c.diferencia).toLocaleString("es-AR")}</div></div><button onClick={()=>imprimirCierreCaja(c)} style={secondaryButton}>🖨️ Imprimir</button></div>)}</div>
            </section>
          )}

          {cajaModal === "abrir" && <div style={modalOverlay}><div style={modalCard}><h3>Abrir caja</h3><p style={{fontSize:12,color:colors.muted}}>Efectivo inicial del turno</p><input type="number" min="0" step="0.01" value={cajaMontoInicial} onChange={e=>setCajaMontoInicial(e.target.value)} style={inputStyle}/><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}><button onClick={()=>setCajaModal(null)} style={secondaryButton}>Cancelar</button><button onClick={abrirCajaDiaria} style={primaryButton}>Abrir caja</button></div></div></div>}
          {cajaModal === "cerrar" && <div style={modalOverlay}><div style={modalCard}><h3>🔒 Cerrar turno</h3><p style={{fontSize:12,color:colors.muted}}>Efectivo esperado: ${totalesCaja().esperado.toLocaleString("es-AR")}</p><input type="number" min="0" step="0.01" value={cajaEfectivoContado} onChange={e=>setCajaEfectivoContado(e.target.value)} placeholder="Efectivo contado" style={inputStyle}/><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}><button onClick={()=>setCajaModal(null)} style={secondaryButton}>Cancelar</button><button onClick={cerrarCajaDiaria} style={{...primaryButton,background:colors.red}}>Confirmar cierre</button></div></div></div>}
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

        <div className="hl-reserva-form"><div style={{ padding: 30 }}>
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
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="submit" form="form-reserva-principal" disabled={cargando} style={{ ...primaryButton, opacity: cargando ? .65 : 1 }}>
                    {cargando ? "Guardando..." : "Guardar cambios"}
                  </button>
<button onClick={() => setVista("recepcion")} style={linkButton}>Ver todas</button>
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

        <div className="hl-reserva-form"><div style={{ padding: 30 }}>
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
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="submit" form="form-reserva-principal" disabled={cargando} style={{ ...primaryButton, opacity: cargando ? .65 : 1 }}>
                    {cargando ? "Guardando..." : "Guardar cambios"}
                  </button>
                  <button type="button" onClick={limpiarFormulario} style={{ ...secondaryButton, color: colors.red, borderColor: "#f2caca" }}>
                    Cancelar edición
                  </button>
                  <button type="button" onClick={() => imprimirReserva(reservaSeleccionada)} style={secondaryButton}>🖨 Imprimir reserva</button>
                </div>
              )}
            </div>

            <form id="form-reserva-principal" onSubmit={guardarReserva}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 14,
              }}>
                <Field label="Alojamiento *">
                  <select
                    required
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

                <Field label="Habitación *">
                  <select
                    required
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

                <Field label="Fecha de entrada *">
                  <input required type="date" value={fechaEntrada} onChange={(e) => setFechaEntrada(e.target.value)} style={inputStyle} />
                </Field>

                <Field label="Fecha de salida *">
                  <input required type="date" value={fechaSalida} onChange={(e) => setFechaSalida(e.target.value)} style={inputStyle} />
                </Field>

                <Field label="Nombre del huésped principal">
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Juan Pérez" style={inputStyle} />
                </Field>

                <Field label="DNI / documento">
                  <input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="Ej. 35.123.456" style={inputStyle} />
                </Field>

                <Field label="Pasajeros adicionales" wide>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: colors.blueSoft, color: colors.blue, fontSize: 11, fontWeight: 700 }}>
                      Huéspedes: {1 + pasajerosExtra.length}
                    </div>
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

                <Field label="Email">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="huésped@email.com" style={inputStyle} />
                </Field>

                <Field label="Teléfono">
                  <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 9..." style={inputStyle} />
                </Field>

                <div style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr 1fr",
              gap: 10,
              alignItems: "end",
              marginTop: 14,
            }}>
              <Field label="Vehículos">
                <input
                  type="number"
                  min="0"
                  max="9"
                  value={vehiculos}
                  onChange={(e) => setVehiculos(e.target.value)}
                  style={{ ...inputStyle, width: "90px", boxSizing: "border-box" }}
                />
              </Field>

              <Field label="Tipo">
                <select
                  value={tipoVehiculo}
                  onChange={(e) => setTipoVehiculo(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Seleccionar</option>
                  <option value="auto">Auto</option>
                  <option value="camioneta">Camioneta</option>
                </select>
              </Field>

              <Field label="Dominio">
                <input
                  value={dominioVehiculo}
                  onChange={(e) => setDominioVehiculo(e.target.value.toUpperCase())}
                  placeholder="AB 123 CD"
                  style={inputStyle}
                  maxLength={10}
                />
              </Field>
            </div>

                <Field label="Extra de la reserva">
                  <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 8 }}>
                    <input value={extraDescripcion} onChange={(e) => setExtraDescripcion(e.target.value)} placeholder="Ej. Desayuno, mascota, traslado..." style={inputStyle} />
                    <input type="number" min="0" step="0.01" value={extraReserva} onChange={(e) => setExtraReserva(e.target.value)} placeholder="Valor" style={inputStyle} />
                  </div>
                </Field>

                <Field label="Descuento">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <select value={descuentoTipo} onChange={e => setDescuentoTipo(e.target.value)} style={inputStyle}>
                      <option value="monto">Monto</option>
                      <option value="porcentaje">Porcentaje</option>
                    </select>
                    <input type="number" min="0" step="0.01" value={descuentoValor} onChange={e => setDescuentoValor(e.target.value)} placeholder="0" style={inputStyle} />
                  </div>
                </Field>

                <Field label="Moneda de cobro">
                  <select value={monedaReserva} onChange={e => setMonedaReserva(e.target.value)} style={inputStyle}>
                    <option value="ARS">Pesos argentinos (ARS)</option>
                    <option value="USD">Dólares estadounidenses (USD)</option>
                  </select>
                </Field>

                {monedaReserva === "USD" && (
                  <Field label="Tipo de cambio de esta reserva">
                    <input type="number" min="0.01" step="0.01" value={tipoCambioReserva || config.tipoCambioUSD || 1} onChange={e => setTipoCambioReserva(e.target.value)} style={inputStyle} />
                  </Field>
                )}

                <Field label="Documento del huésped" wide>
                  <div style={{ display: "grid", gap: 7 }}>
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleDocumentoUpload}
                      style={{ ...inputStyle, padding: 9 }} />
                    <div style={{ color: colors.muted, fontSize: 11 }}>
                      Foto o PDF del documento. Se guarda en un almacenamiento privado.
                      {reservaSeleccionada?.documento_nombre ? ` Documento actual: ${reservaSeleccionada.documento_nombre}` : ""}
                    </div>
                  </div>
                </Field>

                <Field label="Garantía de reserva" wide>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    <select value={garantiaTipo} onChange={e => setGarantiaTipo(e.target.value)} style={inputStyle}>
                      <option value="">Sin garantía</option>
                      <option value="Tarjeta">Tarjeta de crédito</option>
                      <option value="Mercado Pago">Mercado Pago</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Otra">Otra</option>
                    </select>
                    {garantiaTipo === "Tarjeta" && <>
                      <input value={garantiaMarca} onChange={e => setGarantiaMarca(e.target.value)} placeholder="Marca (Visa, Mastercard...)" style={inputStyle} />
                      <input
                        value={garantiaNumeroTarjeta}
                        onChange={e => setGarantiaNumeroTarjeta(e.target.value.replace(/\D/g, "").slice(0, 16))}
                        placeholder="Número de tarjeta (16 dígitos)"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        maxLength={16}
                        style={inputStyle}
                      />
                      <input type="month" value={garantiaVencimiento} onChange={e => setGarantiaVencimiento(e.target.value)} style={inputStyle} />
                      <input
                        value={garantiaCCV}
                        onChange={e => setGarantiaCCV(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="CCV"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        maxLength={4}
                        style={inputStyle}
                      />
                    </>}
                    {garantiaTipo && garantiaTipo !== "Tarjeta" && (
                      <input value={garantiaReferencia} onChange={e => setGarantiaReferencia(e.target.value)} placeholder="Referencia / comprobante" style={inputStyle} />
                    )}
                  </div>
                  {garantiaTipo === "Tarjeta" && (
                    <div style={{ marginTop: 8, padding: 9, borderRadius: 8, background: "#fff8e8", color: "#72520a", fontSize: 11 }}>
                      El número completo y el CCV se usan solo en este formulario y no se guardan en Supabase. Para producción, estos datos deben procesarse mediante un proveedor de pagos/tokenización.
                    </div>
                  )}
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
                    <div>Early check-in: <strong>${calcularImporteReserva().early.toLocaleString("es-AR")}</strong></div>
                    <div>Late check-out: <strong>${calcularImporteReserva().late.toLocaleString("es-AR")}</strong></div>
                    <div>Extra {extraDescripcion ? `(${extraDescripcion})` : ""}: <strong>${calcularImporteReserva().extra.toLocaleString("es-AR")}</strong></div>
                    <div>Descuento: <strong style={{ color: colors.green }}>-${calcularImporteReserva().descuento.toLocaleString("es-AR")}</strong></div>
                    <div>Subtotal: <strong>${calcularImporteReserva().subtotal.toLocaleString("es-AR")}</strong></div>
                    <div>Total: <strong style={{ color: colors.navy, fontSize: 16 }}>${calcularImporteReserva().total.toLocaleString("es-AR")} ARS</strong></div>
                    {monedaReserva === "USD" && <div>Total en dólares: <strong style={{ color: colors.navy, fontSize: 16 }}>US$ {calcularImporteReserva().totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>}
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

              {!modoEdicion && (
                <button type="submit" disabled={cargando} style={{ ...primaryButton, marginTop: 18, opacity: cargando ? .65 : 1 }}>
                  {cargando ? "Guardando..." : "Crear reserva"}
                </button>
              )}
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
      </div>
      </>
    )
  }

  function CalendarioVista() {
    return (
      <>
        <Header titulo="Calendario" subtitulo={`Planificación visual · ${formatearFecha(fechaCalendario)}`} />
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

  function aumentarPreciosMasivamente() {
    const porcentaje = Number(porcentajeAumento)
    if (!Number.isFinite(porcentaje) || porcentaje === 0) {
      alert("Ingresá un porcentaje válido distinto de 0.")
      return
    }
    if (!confirm(`¿Aplicar un aumento del ${porcentaje}% a ${habitaciones.length} habitaciones?`)) return

    const tarifas = { ...(config.habitacionesTarifas || {}) }
    habitaciones.forEach((h) => {
      const actual = datosTarifaHabitacion(h.id).precio
      tarifas[String(h.id)] = {
        ...(tarifas[String(h.id)] || {}),
        precio: Math.round(actual * (1 + porcentaje / 100) * 100) / 100,
      }
    })
    const configuracionActualizada = { ...config, habitacionesTarifas: tarifas }
    setConfig(configuracionActualizada)
    if (user?.id) localStorage.setItem(`habitacion_llena_config_${user.id}`, JSON.stringify(configuracionActualizada))
    setMostrarAumentoPrecios(false)
    setPorcentajeAumento("")
  }

  function Habitaciones({ embedded = false } = {}) {
    return (
      <>
        {!embedded && <Header titulo="Habitaciones" subtitulo="Administrá las unidades y sus tarifas" />}
        <div style={{ padding: 30 }}>
          <section style={cardStyle}>
            <div style={sectionHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Habitaciones y unidades</h2>
                <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  {habitacionesActivas.length} activas · {habitaciones.length} totales
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setMostrarAumentoPrecios(true)} style={secondaryButton}>↑ Aumentar precios</button>
                <button
                  onClick={() => {
                    cancelarEdicionHabitacion()
                    setMostrarHabitacion(!mostrarHabitacion)
                  }}
                  style={primaryButton}
                >
                  + Agregar habitación
                </button>
              </div>
            </div>

            {mostrarAumentoPrecios && (
              <div style={{ marginTop: 16, marginBottom: 18, padding: 16, border: `1px solid ${colors.border}`, borderRadius: 12, background: colors.blueSoft }}>
                <div style={{ fontWeight: 850, fontSize: 14 }}>Aumentar precios</div>
                <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Aplicá un porcentaje a la tarifa por noche de todas las habitaciones. Las reservas existentes no se modifican.</div>
                <div style={{ display: "flex", gap: 9, alignItems: "end", marginTop: 12, flexWrap: "wrap" }}>
                  <Field label="Porcentaje">
                    <input type="number" step="0.1" value={porcentajeAumento} onChange={(e) => setPorcentajeAumento(e.target.value)} placeholder="10" style={{ ...inputStyle, width: 120 }} />
                  </Field>
                  <button type="button" onClick={aumentarPreciosMasivamente} style={primaryButton}>Aplicar aumento</button>
                  <button type="button" onClick={() => { setMostrarAumentoPrecios(false); setPorcentajeAumento("") }} style={secondaryButton}>Cancelar</button>
                </div>
              </div>
            )}

            <section style={{ marginTop: 24, padding: 16, border: `1px solid ${colors.border}`, borderRadius: 12, background: colors.bg }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div><h2 style={{ margin: 0, fontSize: 16 }}>Pisos</h2><div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Organizá las habitaciones por piso. Esto no modifica el calendario.</div></div>
                <div style={{ display: "flex", gap: 8, maxWidth: 360, width: "100%" }}>
                  <input value={nuevoPiso} onChange={(e) => setNuevoPiso(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarPisoConfiguracion() } }} placeholder="Ej. Piso 1" style={inputStyle} />
                  <button type="button" onClick={agregarPisoConfiguracion} style={secondaryButton}>+ Agregar piso</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {pisosConfigurados.length ? pisosConfigurados.map((piso) => <div key={piso} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 999, border: `1px solid ${colors.border}`, background: colors.white, fontSize: 12, fontWeight: 700 }}><span>{piso}</span><button type="button" onClick={() => eliminarPisoConfiguracion(piso)} style={{ border: "none", background: "transparent", color: colors.red, cursor: "pointer", fontWeight: 900, padding: 0 }}>×</button></div>) : <span style={{ color: colors.muted, fontSize: 12 }}>Todavía no hay pisos configurados.</span>}
              </div>
            </section>

            <h2 style={{ margin: "30px 0 18px", fontSize: 18 }}>Tipos de habitación</h2>
            <div style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>
              Definí los tipos de habitación que vas a usar. Después aparecerán como opciones en el menú desplegable al crear o editar una habitación.
            </div>

            <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
              {tiposHabitacionDisponibles.map((tipo) => {
                const esPredeterminado = ["simple", "doble", "triple", "cuádruple", "otro"].includes(tipo.toLowerCase())
                return (
                  <div key={tipo} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    border: `1px solid ${colors.border}`,
                    borderRadius: 999,
                    background: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    <span>{tipo}</span>
                    {!esPredeterminado && (
                      <button
                        type="button"
                        onClick={() => eliminarTipoHabitacionConfiguracion(tipo)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: colors.red,
                          cursor: "pointer",
                          fontWeight: 900,
                          padding: 0,
                        }}
                        title="Eliminar tipo"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: "flex", gap: 9, maxWidth: 520 }}>
              <input
                value={nuevoTipoConfiguracion}
                onChange={(e) => setNuevoTipoConfiguracion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    agregarTipoHabitacionConfiguracion()
                  }
                }}
                placeholder="Ej. Suite, Cabaña, Monoambiente..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" onClick={agregarTipoHabitacionConfiguracion} style={secondaryButton}>
                + Agregar tipo
              </button>
            </div>

            {mostrarHabitacion && (
              <form onSubmit={crearHabitacion} style={{
                background: colors.blueSoft,
                border: "1px solid #cfe0ff",
                borderRadius: 12,
                padding: 16,
                marginBottom: 18,
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1.2fr auto auto",
                gap: 10,
                alignItems: "end",
              }}>
                <Field label="Nombre">
                  <input
                    value={nuevaHabitacion}
                    onChange={(e) => setNuevaHabitacion(e.target.value)}
                    placeholder="Ej. 301"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Tipo">
                  <select
                    value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Seleccionar tipo</option>
                    {tiposHabitacionDisponibles.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Alojamiento">
                  <select
                    value={nuevoAlojamientoHabitacion}
                    onChange={(e) => setNuevoAlojamientoHabitacion(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Seleccionar alojamiento</option>
                    {alojamientos.map((a) => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </select>
                </Field>

                <button type="submit" style={primaryButton}>Guardar</button>
                <button
                  type="button"
                  onClick={() => setMostrarHabitacion(false)}
                  style={secondaryButton}
                >
                  Cancelar
                </button>
              </form>
            )}

            {habitaciones.length === 0 ? (
              <div style={emptyStyle}>Todavía no hay habitaciones cargadas.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {habitaciones.map((h) => {
                  const tarifa = datosTarifaHabitacion(h.id)
                  const editando = String(habitacionEditando) === String(h.id)

                  return (
                    <div key={h.id} style={{
                      border: `1px solid ${editando ? "#b8d4ff" : colors.border}`,
                      borderRadius: 12,
                      padding: 16,
                      background: editando ? "#f7fbff" : colors.white,
                    }}>
                      {editando ? (
                        <form onSubmit={guardarEdicionHabitacion}>
                          <div style={{
                            fontWeight: 800,
                            fontSize: 14,
                            marginBottom: 14,
                            color: colors.navyDark,
                          }}>
                            Editar habitación
                          </div>

                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1.2fr",
                            gap: 10,
                          }}>
                            <Field label="Nombre">
                              <input
                                value={habitacionForm.nombre}
                                onChange={(e) => setHabitacionForm((v) => ({ ...v, nombre: e.target.value }))}
                                style={inputStyle}
                              />
                            </Field>

                            <Field label="Tipo">
                              <select
                                value={habitacionForm.tipo}
                                onChange={(e) => setHabitacionForm((v) => ({ ...v, tipo: e.target.value }))}
                                style={inputStyle}
                              >
                                <option value="">Seleccionar tipo</option>
                                {tiposHabitacionDisponibles.map((tipo) => (
                                  <option key={tipo} value={tipo}>{tipo}</option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Alojamiento">
                              <select
                                value={habitacionForm.alojamiento_id}
                                onChange={(e) => setHabitacionForm((v) => ({ ...v, alojamiento_id: e.target.value }))}
                                style={inputStyle}
                              >
                                <option value="">Seleccionar alojamiento</option>
                                {alojamientos.map((a) => (
                                  <option key={a.id} value={a.id}>{a.nombre}</option>
                                ))}
                              </select>
                            </Field>
                          </div>

                          <div style={{
                            marginTop: 16,
                            paddingTop: 16,
                            borderTop: `1px solid ${colors.border}`,
                          }}>
                            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>
                              Tarifa de esta habitación
                            </div>
                            <Field label="Precio por noche">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={habitacionForm.precio}
                                onChange={(e) => setHabitacionForm((v) => ({ ...v, precio: e.target.value }))}
                                style={inputStyle}
                              />
                            </Field>
                          </div>

                          <div style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 9,
                            marginTop: 16,
                            flexWrap: "wrap",
                          }}>
                            <button type="submit" style={primaryButton}>Guardar cambios</button>
                            <button type="button" onClick={cancelarEdicionHabitacion} style={secondaryButton}>Cancelar</button>
                          </div>
                        </form>
                      ) : (
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "1.2fr .8fr .8fr auto",
                          alignItems: "center",
                          gap: 14,
                        }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15 }}>{h.nombre}</div>
                            <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                              {nombreAlojamiento(h.alojamiento_id)}
                            </div>
                          </div>

                          <div>
                            <div style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 }}>
                              Tipo
                            </div>
                            <div style={{ fontWeight: 700, marginTop: 3 }}>
                              {h.tipo || "Sin tipo definido"}
                            </div>
                          </div>

                          <div>
                            <div style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 }}>
                              Piso
                            </div>
                            <select
                              value={config.habitacionesPisos?.[String(h.id)] || ""}
                              onChange={(e) => asignarPisoHabitacion(h.id, e.target.value)}
                              style={{ ...inputStyle, padding: "7px 9px", marginTop: 3, fontSize: 12 }}
                            >
                              <option value="">Sin asignar</option>
                              {pisosConfigurados.map((piso) => <option key={piso} value={piso}>{piso}</option>)}
                            </select>
                          </div>

                          <div>
                            <div style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 }}>
                              Precio / noche
                            </div>
                            <div style={{ fontWeight: 800, marginTop: 3 }}>
                              ${tarifa.precio.toLocaleString("es-AR")}
                            </div>
                          </div>

                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 7,
                            flexWrap: "wrap",
                          }}>
                            <span style={{
                              padding: "5px 9px",
                              borderRadius: 999,
                              background: h.activa === false ? colors.redSoft : colors.greenSoft,
                              color: h.activa === false ? colors.red : colors.green,
                              fontSize: 11,
                              fontWeight: 800,
                            }}>
                              {h.activa === false ? "Inactiva" : "Activa"}
                            </span>

                            <button
                              type="button"
                              onClick={() => iniciarEdicionHabitacion(h)}
                              style={secondaryButton}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => alternarHabitacion(h)}
                              style={{
                                ...secondaryButton,
                                color: h.activa === false ? colors.green : colors.yellow,
                              }}
                            >
                              {h.activa === false ? "Activar" : "Desactivar"}
                            </button>

                            <button
                              type="button"
                              onClick={() => eliminarHabitacion(h)}
                              style={{
                                ...secondaryButton,
                                color: colors.red,
                                borderColor: "#f5c2c2",
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
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
    <div className={modoOscuro ? "hl-app hl-dark" : "hl-app"} style={{
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
          fontSize: 22,
          color: colors.navyDark,
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 30 }} onClick={() => setMenuAbierto(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 250, background: colors.navyDark, height: "100%", color: "#fff", padding: 15, boxSizing: "border-box", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 20, padding: 12, marginBottom: 16 }}>
              <img src={config.logo || logoHabitacionLlena} alt="Habitación Llena" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 7, background: "#fff" }} />
              Habitación Llena
            </div>
            {[
              ["dashboard", "▦", "Inicio"], ["reservas", "▣", "Reservas"], ["calendario", "▤", "Calendario"]
            ].map(([id, icon, label]) => puedeVer(id) && <button key={id} onClick={() => { setVista(id); setMenuAbierto(false) }} style={{ width: "100%", padding: 11, border: "none", borderRadius: 8, marginBottom: 4, textAlign: "left", color: "#fff", background: vista === id ? "rgba(255,255,255,.14)" : "transparent", fontWeight: vista === id ? 700 : 500 }}>{icon} {label}</button>)}

            {[["housekeeping","🧹","Housekeeping"],["bloqueos","🚫","Bloqueos"],["huespedes","👤","Huéspedes"]].some(([id]) => puedeVer(id)) && <div style={{ marginTop: 8 }}>
              <div style={{ padding: "8px 11px", fontSize: 12, fontWeight: 800, opacity: .8 }}>🧹 Operación</div>
              {[['housekeeping','🧹','Housekeeping'],['bloqueos','🚫','Bloqueos'],['huespedes','👤','Huéspedes']].filter(([id]) => puedeVer(id)).map(([id,icon,label]) => <button key={id} onClick={() => { setVista(id); setMenuAbierto(false) }} style={{ width: "100%", padding: 10, border: "none", borderRadius: 8, marginBottom: 3, textAlign: "left", color: "#fff", background: vista === id ? "rgba(255,255,255,.14)" : "transparent" }}>{icon} {label}</button>)}
            </div>}
            {[["caja","💰","Caja y pagos"],["ventas","◫","Ventas"]].some(([id]) => puedeVer(id)) && <div style={{ marginTop: 8 }}>
              <div style={{ padding: "8px 11px", fontSize: 12, fontWeight: 800, opacity: .8 }}>💼 Administración</div>
              {[['caja','💰','Caja y pagos'],['ventas','◫','Ventas']].filter(([id]) => puedeVer(id)).map(([id,icon,label]) => <button key={id} onClick={() => { setVista(id); setMenuAbierto(false) }} style={{ width: "100%", padding: 10, border: "none", borderRadius: 8, marginBottom: 3, textAlign: "left", color: "#fff", background: vista === id ? "rgba(255,255,255,.14)" : "transparent" }}>{icon} {label}</button>)}
            </div>}
            {[["bandeja","📥","Bandeja de entrada"],["comunicaciones","✉","Comunicaciones"],["integraciones","↔","Integraciones"],["asistente","✦","Asistente IA"],["asistencia","🆘","Asistencia humana"]].filter(([id]) => puedeVer(id)).map(([id,icon,label]) => <button key={id} onClick={() => { setVista(id); setMenuAbierto(false) }} style={{ width: "100%", padding: 11, border: "none", borderRadius: 8, marginTop: 4, textAlign: "left", color: "#fff", background: vista === id ? "rgba(255,255,255,.14)" : "transparent" }}>{icon} {label}</button>)}
          </div>
        </div>
      )}

      <main style={{ marginLeft: 220, minHeight: "100vh" }}>
        {vista === "dashboard" && Dashboard()}
        {vista === "reservas" && Reservas()}
        {vista === "recepcion" && Recepcion()}
        {vista === "calendario" && CalendarioVista()}
        {vista === "housekeeping" && Housekeeping()}
        {vista === "bloqueos" && Bloqueos()}
        {vista === "huespedes" && Huespedes()}
        {vista === "caja" && Caja()}
        {vista === "ventas" && Ventas()}
        {vista === "comunicaciones" && Comunicaciones()}
        {vista === "integraciones" && Integraciones()}
        {vista === "asistente" && Asistente()}
        {vista === "asistencia" && AsistenciaHumana()}
        {vista === "bandeja" && BandejaEntrada()}
        {vista === "configuracion" && Configuracion()}
      </main>

      {confirmarCheckoutReserva && (
        <div
          onClick={() => setConfirmarCheckoutReserva(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.52)",
            zIndex: 150,
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(430px, 100%)",
              background: colors.white,
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 24px 70px rgba(0,0,0,.25)",
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 8 }}>⚠️</div>
            <h3 style={{ margin: 0, fontSize: 20 }}>¿Estás seguro de realizar el check-out?</h3>
            <p style={{ color: colors.muted, lineHeight: 1.5, fontSize: 13, margin: "10px 0 20px" }}>
              La reserva de <strong>{confirmarCheckoutReserva.nombre_huesped}</strong> pasará a finalizada
              y la habitación <strong>{nombreHabitacion(confirmarCheckoutReserva.habitacion_id)}</strong> quedará marcada como sucia.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
              <button onClick={() => setConfirmarCheckoutReserva(null)} style={secondaryButton}>No, cancelar</button>
              <button onClick={() => realizarCheckOutConfirmado(confirmarCheckoutReserva)} style={{ ...primaryButton, background: colors.red }}>
                Sí, realizar check-out
              </button>
            </div>
          </div>
        </div>
      )}

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

            {reservaSeleccionada.estado !== "cancelada" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 18 }}>
                <button
                  onClick={() => realizarCheckIn(reservaSeleccionada)}
                  disabled={reservaSeleccionada.estado === "alojado" || reservaSeleccionada.estado === "finalizada"}
                  style={{ ...primaryButton, background: colors.green, opacity: reservaSeleccionada.estado === "alojado" || reservaSeleccionada.estado === "finalizada" ? .55 : 1 }}
                >
                  ✓ Check-in
                </button>
                <button
                  onClick={() => confirmarYRealizarCheckOut(reservaSeleccionada)}
                  disabled={reservaSeleccionada.estado === "finalizada"}
                  style={{ ...primaryButton, background: colors.red, opacity: reservaSeleccionada.estado === "finalizada" ? .55 : 1 }}
                >
                  ✓ Check-out
                </button>
              </div>
            )}

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
              {reservaSeleccionada.moneda && <Info label="Moneda" value={reservaSeleccionada.moneda === "USD" ? "Dólares (USD)" : "Pesos (ARS)"} />}
              {reservaSeleccionada.descuento_valor > 0 && <Info label="Descuento" value={reservaSeleccionada.descuento_tipo === "porcentaje" ? `${reservaSeleccionada.descuento_valor}%` : `$${Number(reservaSeleccionada.descuento_valor).toLocaleString("es-AR")}`} />}
              {reservaSeleccionada.garantia_tipo && <Info label="Garantía" value={`${reservaSeleccionada.garantia_tipo}${reservaSeleccionada.garantia_ultimos4 ? ` · **** ${reservaSeleccionada.garantia_ultimos4}` : ""}`} />}
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

            {reservaSeleccionada.extra_descripcion && (
              <div style={{ marginTop: 20 }}>
                <div style={{ color: colors.muted, fontSize: 12, marginBottom: 5 }}>Extra</div>
                <div style={{ padding: 13, background: "#f8fafc", borderRadius: 8, fontSize: 14 }}>
                  {reservaSeleccionada.extra_descripcion} · ${Number(reservaSeleccionada.extra || 0).toLocaleString("es-AR")}
                </div>
              </div>
            )}

            {reservaSeleccionada.notas && (
              <div style={{ marginTop: 20 }}>
                <div style={{ color: colors.muted, fontSize: 12, marginBottom: 5 }}>Notas</div>
                <div style={{ padding: 13, background: "#f8fafc", borderRadius: 8, fontSize: 14 }}>
                  {reservaSeleccionada.notas}
                </div>
              </div>
            )}

            <section style={{ marginTop: 22, padding: 16, border: `1px solid ${colors.border}`, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><strong>Cuenta del huésped</strong><div style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>Señas, cobros y saldo</div></div><strong style={{ color: saldoReserva(reservaSeleccionada) > 0 ? colors.red : colors.green }}>{reservaSeleccionada.moneda === "USD" ? "US$ " : "$"}{saldoReserva(reservaSeleccionada).toLocaleString("es-AR", { minimumFractionDigits: reservaSeleccionada.moneda === "USD" ? 2 : 0 })} pendiente</strong></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><div style={{ padding: 10, background: colors.greenSoft, borderRadius: 8 }}><div style={{ color: colors.muted, fontSize: 11 }}>Total</div><strong>{reservaSeleccionada.moneda === "USD" ? "US$ " : "$"}{Number(reservaSeleccionada.moneda === "USD" ? (reservaSeleccionada.precio_total_usd || 0) : (reservaSeleccionada.precio_total || 0)).toLocaleString("es-AR", { minimumFractionDigits: reservaSeleccionada.moneda === "USD" ? 2 : 0 })}</strong></div><div style={{ padding: 10, background: colors.blueSoft, borderRadius: 8 }}><div style={{ color: colors.muted, fontSize: 11 }}>Pagado</div><strong>{reservaSeleccionada.moneda === "USD" ? "US$ " : "$"}{totalPagado(reservaSeleccionada.id, reservaSeleccionada.moneda || "ARS").toLocaleString("es-AR", { minimumFractionDigits: reservaSeleccionada.moneda === "USD" ? 2 : 0 })}</strong></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}><input type="number" min="0" step="0.01" value={pagoMonto} onChange={e=>setPagoMonto(e.target.value)} placeholder="Importe" style={inputStyle}/><select value={pagoMetodo} onChange={e=>setPagoMetodo(e.target.value)} style={inputStyle}><option>Efectivo</option><option>Transferencia</option><option>Mercado Pago</option><option>Tarjeta</option><option>Otro</option></select></div><input value={pagoNota} onChange={e=>setPagoNota(e.target.value)} placeholder="Nota del pago (opcional)" style={{ ...inputStyle, marginTop: 8 }}/><button onClick={()=>registrarPago(reservaSeleccionada)} style={{ ...primaryButton, width:"100%", marginTop:8 }} disabled={saldoReserva(reservaSeleccionada)<=0}>＋ Registrar pago</button>
              {pagos.filter(p=>String(p.reserva_id)===String(reservaSeleccionada.id)).length>0 && <div style={{ marginTop: 12, display:"grid",gap:6 }}>{pagos.filter(p=>String(p.reserva_id)===String(reservaSeleccionada.id)).map(p=><div key={p.id} style={{fontSize:11,padding:8,background:"#f8fafc",borderRadius:7}}>{p.moneda === "USD" ? "US$ " : "$"}{Number(p.monto||0).toLocaleString("es-AR")} · {p.metodo} · {p.created_at ? new Date(p.created_at).toLocaleDateString("es-AR") : ""}</div>)}</div>}
            </section>

            {saldoReserva(reservaSeleccionada) > 0.01 && reservaSeleccionada.estado !== "cancelada" && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 9, background: colors.redSoft, color: colors.red, fontSize: 12, fontWeight: 700 }}>
                ⚠️ Deuda pendiente: {reservaSeleccionada.moneda === "USD" ? "US$ " : "$"}{saldoReserva(reservaSeleccionada).toLocaleString("es-AR", { minimumFractionDigits: reservaSeleccionada.moneda === "USD" ? 2 : 0 })}. Registrá el pago antes del check-out.
              </div>
            )}

            <div style={{ display: "grid", gap: 9, marginTop: 28 }}>
              {reservaSeleccionada.email_huesped && (
                <button onClick={() => enviarResumenPorEmail(reservaSeleccionada)} style={primaryButton}>
                  ✉ Enviar resumen por email
                </button>
              )}
              {reservaSeleccionada.documento_path && (
                <button
                  onClick={async () => {
                    const { data, error } = await supabase.storage.from("reservation-documents").createSignedUrl(reservaSeleccionada.documento_path, 300)
                    if (error || !data?.signedUrl) {
                      alert("No se pudo abrir el documento.")
                      return
                    }
                    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
                  }}
                  style={secondaryButton}
                >
                  📄 Ver documento
                </button>
              )}
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
    .hl-reserva-form label {
      font-weight: 700 !important;
      color: var(--hl-form-label, inherit) !important;
    }
    .hl-reserva-form h2 {
      font-weight: 850 !important;
      letter-spacing: -0.2px;
    }
    .hl-reserva-form input,
    .hl-reserva-form select,
    .hl-reserva-form textarea {
      font-size: 14px !important;
    }

        :root {
          --hl-navy: #0b4aa2;
          --hl-navy-dark: #082f6b;
          --hl-blue: #1677e8;
          --hl-blue-soft: #e8f1ff;
          --hl-green: #00875a;
          --hl-green-soft: #e8f7f0;
          --hl-yellow: #b78103;
          --hl-yellow-soft: #fff7dc;
          --hl-red: #c62828;
          --hl-red-soft: #fff0f0;
          --hl-text: #1f2937;
          --hl-muted: #6b7280;
          --hl-border: #e5e7eb;
          --hl-bg: #f3f6fb;
          --hl-white: #ffffff;
          --hl-panel: #ffffff;
          --hl-input: #ffffff;
        }
        :root[data-hl-theme="dark"], body[data-hl-theme="dark"] {
          --hl-navy: #5fa4ff;
          --hl-navy-dark: #d9e9ff;
          --hl-blue: #4d9cff;
          --hl-blue-soft: #172b45;
          --hl-green: #39d39a;
          --hl-green-soft: #12382d;
          --hl-yellow: #f0b83f;
          --hl-yellow-soft: #3b2e12;
          --hl-red: #ff6b6b;
          --hl-red-soft: #3b1818;
          --hl-text: #f3f4f6;
          --hl-muted: #a7b0bf;
          --hl-border: #303846;
          --hl-bg: #090d13;
          --hl-white: #111722;
          --hl-panel: #111722;
          --hl-input: #0d131d;
        }
        * { box-sizing: border-box; }
        html { background: var(--hl-bg); }
        body { margin: 0; background: var(--hl-bg); color: var(--hl-text); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
        .hl-app { min-height: 100vh; }
        .hl-app, .hl-app * { color-scheme: light; }
        .hl-dark, .hl-dark * { color-scheme: dark; }
        .hl-dark img { border-color: #303846 !important; }
        .hl-dark .app-header { background: rgba(17,23,34,.94) !important; }
        .hl-dark .desktop-sidebar { background: #07111f !important; }
        .hl-dark input, .hl-dark select, .hl-dark textarea { background: var(--hl-input) !important; color: var(--hl-text) !important; }
        button, input, select, textarea { font-family: inherit; }
        button { transition: opacity .15s, transform .15s, box-shadow .15s, background .15s; }
        button:hover { opacity: .96; transform: translateY(-1px); }
        input:focus, select:focus, textarea:focus { border-color: ${colors.blue} !important; box-shadow: 0 0 0 3px rgba(22,119,232,.10); }
        .hl-dark [style*="background: #fff"], .hl-dark [style*="background:#fff"], .hl-dark [style*="background: rgb(255, 255, 255)"] { background: var(--hl-white) !important; }
        .hl-dark [style*="background: #f8fafc"], .hl-dark [style*="background:#f8fafc"] { background: #0d131d !important; }
        .hl-dark [style*="background: #fafbfe"], .hl-dark [style*="background:#fafbfe"],
        .hl-dark [style*="background: #fcfcfe"], .hl-dark [style*="background:#fcfcfe"] { background: var(--hl-white) !important; }

        .hl-dark [style*="border-color: #f5c2c2"], .hl-dark [style*="border-color: #f2caca"] { border-color: #6b2a2a !important; }
        .app-header { box-shadow: 0 1px 0 rgba(15,23,42,.02), 0 8px 24px rgba(15,23,42,.025); }
        .user-chip { white-space: nowrap; }
        @media (max-width: 900px) {
          .desktop-sidebar { display: none; }
          .mobile-topbar { display: flex !important; }
          main { margin-left: 0 !important; padding-top: 58px; }
          .app-header { padding: 0 16px !important; }
          .user-chip { display: none !important; }
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
  borderRadius: 16,
  padding: 22,
  boxShadow: "0 8px 28px rgba(15,23,42,.055)",
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
  borderRadius: 9,
  padding: "10px 15px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(22,119,232,.16)",
}

const topActionButton = {
  border: `1px solid ${colors.border}`,
  background: colors.white,
  color: colors.text,
  borderRadius: 9,
  padding: "9px 12px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
}

const secondaryButton = {
  border: `1px solid ${colors.border}`,
  background: colors.white,
  color: colors.text,
  borderRadius: 9,
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
