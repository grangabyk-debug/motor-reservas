import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")

const start = text.indexOf("  async function cargarDatos() {")
const end = text.indexOf("\n  const habitacionesActivas =", start)

if (start < 0 || end < 0) {
  throw new Error("No se encontró el bloque cargarDatos del dashboard")
}

const loader = `  async function cargarDatos() {
    if (!user?.id) return

    const [
      { data: membershipsData, error: membershipsError },
      { data: ownedProperties, error: ownedPropertiesError },
    ] = await Promise.all([
      supabase.from("property_members").select("property_id, role").eq("user_id", user.id),
      supabase.from("properties").select("id, name, owner_id, created_at").eq("owner_id", user.id),
    ])

    if (membershipsError) console.error("No se pudieron cargar los accesos del usuario:", membershipsError)
    if (ownedPropertiesError) console.error("No se pudieron cargar las propiedades propias:", ownedPropertiesError)

    const membershipIds = (membershipsData || []).map((m) => m.property_id).filter(Boolean)
    const ownerIds = (ownedProperties || []).map((p) => p.id).filter(Boolean)
    const propertyIds = Array.from(new Set([...membershipIds, ...ownerIds]))
    const roles = (membershipsData || []).map((m) => m.role).filter(Boolean)
    setRolReal(roles[0] || (ownerIds.length ? "owner" : "reception"))

    if (!propertyIds.length) {
      setAlojamientos([])
      setHabitaciones([])
      setReservas([])
      setBloqueos([])
      setPagos([])
      return
    }

    const [
      { data: propertiesData, error: propertiesError },
      { data: alojamientosData, error: alojamientosError },
      { data: habitacionesData, error: habitacionesError },
      { data: reservasData, error: reservasError },
      { data: bloqueosData, error: bloqueosError },
      { data: pagosData, error: pagosError },
    ] = await Promise.all([
      supabase.from("properties").select("*").in("id", propertyIds).order("created_at", { ascending: true }),
      supabase.from("alojamientos").select("*").in("property_id", propertyIds).order("id", { ascending: true }),
      supabase.from("habitaciones").select("*").in("property_id", propertyIds).order("id", { ascending: true }),
      supabase.from("reservas").select("*").in("property_id", propertyIds).order("id", { ascending: false }),
      supabase.from("bloqueos").select("*").in("property_id", propertyIds).order("fecha_desde", { ascending: true }),
      supabase.from("pagos").select("*").in("property_id", propertyIds).order("created_at", { ascending: false }),
    ])

    if (propertiesError) console.error("No se pudieron cargar las propiedades:", propertiesError)
    if (alojamientosError) console.error("No se pudieron cargar los alojamientos:", alojamientosError)
    if (habitacionesError) console.error("No se pudieron cargar las habitaciones:", habitacionesError)
    if (reservasError) console.error("No se pudieron cargar las reservas:", reservasError)
    if (bloqueosError) console.warn("No se pudieron cargar los bloqueos:", bloqueosError)
    if (pagosError) console.warn("No se pudieron cargar los pagos:", pagosError)

    const propertiesById = new Map((propertiesData || []).map((p) => [String(p.id), p]))
    const alojamientosFinal = (alojamientosData || []).map((a) => ({ ...a, property_id: a.property_id }))

    for (const propertyId of propertyIds) {
      if (!alojamientosFinal.some((a) => String(a.property_id) === String(propertyId))) {
        const property = propertiesById.get(String(propertyId))
        if (property) {
          alojamientosFinal.push({
            id: property.id,
            nombre: property.name,
            user_id: property.owner_id,
            property_id: property.id,
          })
        }
      }
    }

    const alojamientoIds = new Set(alojamientosFinal.map((a) => String(a.id)))
    const habitacionesFinal = (habitacionesData || []).filter((h) =>
      alojamientoIds.has(String(h.alojamiento_id)) || propertyIds.some((p) => String(p) === String(h.property_id))
    )
    const reservasFinal = (reservasData || []).filter((r) =>
      alojamientoIds.has(String(r.alojamiento_id)) || propertyIds.some((p) => String(p) === String(r.property_id))
    )

    setAlojamientos(alojamientosFinal)
    setHabitaciones(habitacionesFinal)
    setReservas(reservasFinal)
    setHabitacionEstados(habitacionesFinal.map((h) => ({ habitacion_id: h.id, estado: h.estado || "libre" })))
    setEstadosHousekeepingPendientes(Object.fromEntries(habitacionesFinal.map((h) => [String(h.id), h.estado || "libre"])))
    setBloqueos(bloqueosData || [])
    setPagos(pagosData || [])

    if (!alojamientoSeleccionado && alojamientosFinal.length) {
      setAlojamientoSeleccionado(String(alojamientosFinal[0].id))
    }
  }
`

text = text.slice(0, start) + loader + text.slice(end)

const replacements = [
  [
    `const filas = seleccionadas.map((id) => ({\n      user_id: user.id,\n      habitacion_id: Number(id),`,
    `const filas = seleccionadas.map((id) => {\n      const habitacion = habitaciones.find((h) => String(h.id) === String(id))\n      return {\n      property_id: habitacion?.property_id || null,\n      user_id: user.id,\n      habitacion_id: Number(id),`,
  ],
  [`      detalle: bloqueoDetalle.trim(),\n    }))`, `      detalle: bloqueoDetalle.trim(),\n      }\n    })`],
  [
    `      user_id: user.id,\n      reserva_id: reserva.id,\n      monto,`,
    `      property_id: reserva.property_id || alojamientos.find((a) => String(a.id) === String(reserva.alojamiento_id))?.property_id || null,\n      user_id: user.id,\n      reserva_id: reserva.id,\n      monto,`,
  ],
]

for (const [oldValue, newValue] of replacements) {
  text = text.replace(oldValue, newValue)
}

text = text.replaceAll(`.eq("habitacion_id", reserva.habitacion_id)\n      .eq("user_id", user.id)`, `.eq("habitacion_id", reserva.habitacion_id)`)
text = text.replaceAll(`.eq("id", reserva.id)\n      .eq("user_id", user.id)`, `.eq("id", reserva.id)`)
text = text.replaceAll(`.eq("id", Number(reserva.habitacion_id))\n      .eq("user_id", user.id)`, `.eq("id", Number(reserva.habitacion_id))`)

const reservationMarker = `    const calculo = calcularImporteReserva()\n\n    const datos = {`
const reservationReplacement = `    const calculo = calcularImporteReserva()\n    const alojamientoActivo = alojamientos.find((a) => String(a.id) === String(alojamientoSeleccionado))\n    const propertyIdActivo = alojamientoActivo?.property_id || (String(alojamientoSeleccionado).includes("-") ? alojamientoSeleccionado : null)\n\n    const datos = {`
if (text.includes(reservationMarker)) text = text.replace(reservationMarker, reservationReplacement)
text = text.replace(
  `    const datos = {\n      alojamiento_id: Number(alojamientoSeleccionado),`,
  `    const datos = {\n      property_id: propertyIdActivo,\n      alojamiento_id: Number.isFinite(Number(alojamientoSeleccionado)) ? Number(alojamientoSeleccionado) : null,`,
)

const oldCreateAccommodation = `  async function crearAlojamiento(e) {\n    e.preventDefault()\n    if (!nuevoAlojamiento.trim()) return\n\n    const { error } = await supabase\n      .from("alojamientos")\n      .insert([{ nombre: nuevoAlojamiento.trim(), user_id: user.id }])\n\n    if (error) {\n      console.error(error)\n      alert("No se pudo crear el alojamiento.")\n      return\n    }\n\n    setNuevoAlojamiento("")\n    setMostrarAlojamiento(false)\n    await cargarDatos()\n  }`
const newCreateAccommodation = `  async function crearAlojamiento(e) {\n    e.preventDefault()\n    const nombreNuevo = nuevoAlojamiento.trim()\n    if (!nombreNuevo) return\n\n    const { data: property, error: propertyError } = await supabase\n      .from("properties")\n      .insert([{ name: nombreNuevo, owner_id: user.id }])\n      .select("id, name, owner_id")\n      .single()\n\n    if (propertyError || !property) {\n      console.error(propertyError)\n      alert("No se pudo crear la propiedad.")\n      return\n    }\n\n    const { error: alojamientoError } = await supabase\n      .from("alojamientos")\n      .insert([{ nombre: nombreNuevo, user_id: user.id, property_id: property.id }])\n\n    if (alojamientoError) {\n      console.error(alojamientoError)\n      await supabase.from("properties").delete().eq("id", property.id)\n      alert("No se pudo crear el alojamiento.")\n      return\n    }\n\n    setNuevoAlojamiento("")\n    setMostrarAlojamiento(false)\n    await cargarDatos()\n  }`
if (text.includes(oldCreateAccommodation)) text = text.replace(oldCreateAccommodation, newCreateAccommodation)

const oldRoom = `    const datos = {\n      nombre: nuevaHabitacion.trim(),\n      tipo: tipoFinal,\n      alojamiento_id: Number(nuevoAlojamientoHabitacion),\n      activa: true,\n      user_id: user.id,\n    }`
const newRoom = `    const alojamientoHabitacion = alojamientos.find((a) => String(a.id) === String(nuevoAlojamientoHabitacion))\n    const datos = {\n      nombre: nuevaHabitacion.trim(),\n      tipo: tipoFinal,\n      alojamiento_id: Number.isFinite(Number(nuevoAlojamientoHabitacion)) ? Number(nuevoAlojamientoHabitacion) : null,\n      property_id: alojamientoHabitacion?.property_id || (String(nuevoAlojamientoHabitacion).includes("-") ? nuevoAlojamientoHabitacion : null),\n      activa: true,\n      user_id: user.id,\n    }`
if (text.includes(oldRoom)) text = text.replace(oldRoom, newRoom)

fs.writeFileSync(path, text)
console.log("Dashboard tenant-scope migration applied")
