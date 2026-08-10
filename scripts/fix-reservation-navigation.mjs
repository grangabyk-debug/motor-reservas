import fs from "node:fs"

const path = "app/dashboard/page.jsx"
const text = fs.readFileSync(path, "utf8")

const startMarker = "    const reservaCreadaEsNueva = !modoEdicion"
const endMarker = "    setCargando(false)\n  }"
const start = text.indexOf(startMarker)

if (start < 0) {
  throw new Error("No se encontró el bloque de finalización de guardarReserva")
}

const end = text.indexOf(endMarker, start)
if (end < 0) {
  throw new Error("No se encontró el cierre de guardarReserva")
}

const replacement = `    const reservaCreadaEsNueva = !modoEdicion
    const fechaParaCalendario = fechaEntrada

    setMensaje(modoEdicion ? "Reserva actualizada correctamente." : "Reserva creada correctamente.")
    limpiarFormulario()

    // Al crear una reserva nueva, la pantalla debe cerrarse y volver al calendario.
    // La recarga de datos no puede impedir esta navegación si Supabase tiene un
    // fallo transitorio después de guardar la reserva.
    if (reservaCreadaEsNueva) {
      setFechaCalendario(fechaParaCalendario || fechaLocal(0))
      setVista("calendario")
      setConfirmarCheckinNuevaReserva(null)
    }

    try {
      await cargarDatos()
    } catch (error) {
      console.error("La reserva se creó, pero no se pudieron recargar los datos:", error)
    }

    setCargando(false)
  }`

const updated = text.slice(0, start) + replacement + text.slice(end + endMarker.length)
fs.writeFileSync(path, updated)
