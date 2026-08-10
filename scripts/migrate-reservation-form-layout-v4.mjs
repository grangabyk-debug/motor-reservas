import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let t = fs.readFileSync(path, "utf8")
const marker = "HL_RESERVATION_FORM_LAYOUT_V5"

if (t.includes(marker)) process.exit(0)

function replaceRequired(from, to, label) {
  if (!t.includes(from)) throw new Error(`No se encontró el bloque requerido: ${label}`)
  t = t.replace(from, to)
}

if (!t.includes('const [direccion, setDireccion]')) {
  replaceRequired(
    `  const [nombre, setNombre] = useState("")
  const [dni, setDni] = useState("")
  const [pasajerosExtra, setPasajerosExtra] = useState([])`,
    `  const [nombre, setNombre] = useState("")
  const [dni, setDni] = useState("")
  const [direccion, setDireccion] = useState("")
  const [provinciaEstado, setProvinciaEstado] = useState("")
  const [pais, setPais] = useState("")
  const [pasajerosExtra, setPasajerosExtra] = useState([])`,
    "estados de dirección"
  )
}

if (!t.includes('direccion_huesped: direccion.trim()')) {
  replaceRequired(
    `      dni_huesped: dni.trim(),
      es_menor: false,`,
    `      dni_huesped: dni.trim(),
      direccion_huesped: direccion.trim(),
      provincia_estado_huesped: provinciaEstado.trim(),
      pais_huesped: pais.trim(),
      es_menor: false,`,
    "guardado de dirección"
  )
}

if (!t.includes('setDireccion(reserva.direccion_huesped')) {
  replaceRequired(
    `    setDni(reserva.dni_huesped || "")
    setEmail(reserva.email_huesped || "")`,
    `    setDni(reserva.dni_huesped || "")
    setDireccion(reserva.direccion_huesped || "")
    setProvinciaEstado(reserva.provincia_estado_huesped || "")
    setPais(reserva.pais_huesped || "")
    setEmail(reserva.email_huesped || "")`,
    "edición de dirección"
  )
}

if (!t.includes('setDireccion("")')) {
  t = t.replace(
    `    setDni("")
    setPasajerosExtra([])`,
    `    setDni("")
    setDireccion("")
    setProvinciaEstado("")
    setPais("")
    setPasajerosExtra([])`
  )
  t = t.replace(
    `      setNombre("")
      setDni("")
      setEmail("")`,
    `      setNombre("")
      setDni("")
      setDireccion("")
      setProvinciaEstado("")
      setPais("")
      setEmail("")`
  )
}

replaceRequired(
  `<Field label="DNI / documento">`,
  `<Field label="DNI / Pasaporte">`,
  "etiqueta DNI / Pasaporte"
)

replaceRequired(
  `<Field label="Pasajeros adicionales" wide>`,
  `<Field label={<span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span>Pasajeros adicionales</span><button type="button" onClick={agregarPasajeroExtra} aria-label="Agregar pasajero adicional" title="Agregar pasajero" style={{ ...secondaryButton, width: 30, height: 30, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, lineHeight: 1 }}>+</button></span>} wide>`,
  "título de pasajeros adicionales"
)

t = t.replace(
  `                    <button type="button" onClick={agregarPasajeroExtra} style={{ ...secondaryButton, width: "fit-content" }}>+ Agregar pasajero</button>\n`,
  ""
)

const dniStart = t.indexOf(`                <Field label="DNI / Pasaporte">`)
if (dniStart < 0) throw new Error("No se encontró el campo DNI / Pasaporte")
const dniFieldEnd = t.indexOf(`                </Field>`, dniStart)
if (dniFieldEnd < 0) throw new Error("No se encontró el cierre del campo DNI / Pasaporte")
const dniFieldClose = dniFieldEnd + `                </Field>`.length

const addressBlock = `

                <div ${marker} style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12, alignItems: "end" }}>
                  <Field label="Dirección">
                    <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle y número" style={inputStyle} />
                  </Field>
                  <Field label="Provincia / Estado">
                    <input value={provinciaEstado} onChange={(e) => setProvinciaEstado(e.target.value)} placeholder="Provincia o estado" style={inputStyle} />
                  </Field>
                  <Field label="País">
                    <input value={pais} onChange={(e) => setPais(e.target.value)} placeholder="Argentina" style={inputStyle} />
                  </Field>
                </div>`

t = t.slice(0, dniFieldClose) + addressBlock + t.slice(dniFieldClose)

// Último ajuste solicitado: el bloque de pasajeros adicionales queda inmediatamente
// debajo de Nombre del huésped principal + DNI/Pasaporte y antes de Dirección/Provincia/País.
const passengerTextIndex = t.indexOf("Pasajeros adicionales")
const passengerStart = passengerTextIndex >= 0 ? t.lastIndexOf("<Field", passengerTextIndex) : -1
const addressMarkerStart = t.indexOf(`<div ${marker} style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr"`)
if (passengerStart < 0 || addressMarkerStart < 0) throw new Error("No se encontró el bloque de pasajeros o dirección para reordenarlo")
if (passengerStart > addressMarkerStart) {
  const passengerEnd = t.indexOf(`</Field>`, passengerStart)
  if (passengerEnd < 0) throw new Error("No se pudo cerrar el bloque de pasajeros adicionales")
  const passengerBlock = t.slice(passengerStart, passengerEnd + `</Field>`.length) + "\n\n"
  t = t.slice(0, passengerStart) + t.slice(passengerEnd + `</Field>`.length)
  const newAddressMarkerStart = t.indexOf(`<div ${marker} style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr"`)
  t = t.slice(0, newAddressMarkerStart) + passengerBlock + t.slice(newAddressMarkerStart)
}

const contactStart = t.indexOf(`                <Field label="Email">`)
const extraStart = t.indexOf(`                <Field label="Extra de la reserva">`, contactStart)
if (contactStart < 0 || extraStart < 0) throw new Error("No se encontró el bloque Email/Teléfono/Vehículos")

const contactBlock = `                <div ${marker} style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1.25fr 1fr .75fr .9fr 1fr", gap: 12, alignItems: "end" }}>
                  <Field label="Email">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="huésped@email.com" style={inputStyle} />
                  </Field>
                  <Field label="Teléfono">
                    <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 9..." style={inputStyle} />
                  </Field>
                  <Field label="Vehículos">
                    <input type="number" min="0" max="9" value={vehiculos} onChange={(e) => setVehiculos(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Tipo">
                    <select value={tipoVehiculo} onChange={(e) => setTipoVehiculo(e.target.value)} style={inputStyle}>
                      <option value="">Seleccionar</option>
                      <option value="auto">Auto</option>
                      <option value="camioneta">Camioneta</option>
                    </select>
                  </Field>
                  <Field label="Dominio">
                    <input value={dominioVehiculo} onChange={(e) => setDominioVehiculo(e.target.value.toUpperCase())} placeholder="AB 123 CD" style={inputStyle} maxLength={10} />
                  </Field>
                </div>

`

t = t.slice(0, contactStart) + contactBlock + t.slice(extraStart)

const financialStart = t.indexOf(`                <Field label="Extra de la reserva">`)
const documentStart = t.indexOf(`                <Field label="Documento del huésped" wide>`, financialStart)
if (financialStart < 0 || documentStart < 0) throw new Error("No se encontró el bloque Extra/Descuento/Moneda")

const financialBlock = `                <div ${marker} style={{
                  gridColumn: "1 / -1",
                  display: "grid",
                  gridTemplateColumns: monedaReserva === "USD" ? "1fr 1fr 1fr" : "1fr 1fr",
                  gap: 12,
                  alignItems: "end",
                }}>
                  <Field label="Descuento">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <select value={descuentoTipo} onChange={(e) => setDescuentoTipo(e.target.value)} style={inputStyle}>
                        <option value="monto">Monto</option>
                        <option value="porcentaje">Porcentaje</option>
                      </select>
                      <input type="number" min="0" step="0.01" value={descuentoValor} onChange={(e) => setDescuentoValor(e.target.value)} placeholder="0" style={inputStyle} />
                    </div>
                  </Field>
                  <Field label="Moneda de cobro">
                    <select value={monedaReserva} onChange={(e) => setMonedaReserva(e.target.value)} style={inputStyle}>
                      <option value="ARS">Pesos argentinos (ARS)</option>
                      <option value="USD">Dólares estadounidenses (USD)</option>
                    </select>
                  </Field>
                  {monedaReserva === "USD" && (
                    <Field label="Tipo de cambio de esta reserva">
                      <input type="number" min="0.01" step="0.01" value={tipoCambioReserva || config.tipoCambioUSD || 1} onChange={(e) => setTipoCambioReserva(e.target.value)} style={inputStyle} />
                    </Field>
                  )}
                </div>

`

t = t.slice(0, financialStart) + financialBlock + t.slice(documentStart)

const documentStart2 = t.indexOf(`                <Field label="Documento del huésped" wide>`)
const conditionsStart = t.indexOf(`                <Field label="Condiciones especiales" wide>`, documentStart2)
if (documentStart2 < 0 || conditionsStart < 0) throw new Error("No se encontró el bloque Documento/Garantía")

const documentGuaranteeBlock = `                <div ${marker} style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr 1.35fr", gap: 14, alignItems: "start" }}>
                  <Field label="Documento del huésped">
                    <div style={{ display: "grid", gap: 7 }}>
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleDocumentoUpload} style={{ ...inputStyle, padding: 9 }} />
                      <div style={{ color: colors.muted, fontSize: 11 }}>
                        Foto o PDF del documento. Se guarda en un almacenamiento privado.
                        {reservaSeleccionada?.documento_nombre ? " Documento actual: " + reservaSeleccionada.documento_nombre : ""}
                      </div>
                    </div>
                  </Field>

                  <Field label="Extra de la reserva">
                    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 8 }}>
                      <input value={extraDescripcion} onChange={(e) => setExtraDescripcion(e.target.value)} placeholder="Ej. Desayuno, mascota, traslado..." style={inputStyle} />
                      <input type="number" min="0" step="0.01" value={extraReserva} onChange={(e) => setExtraReserva(e.target.value)} placeholder="Valor" style={inputStyle} />
                    </div>
                  </Field>

                  <Field label="Garantía de reserva">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <select value={garantiaTipo} onChange={(e) => setGarantiaTipo(e.target.value)} style={inputStyle}>
                        <option value="">Sin garantía</option>
                        <option value="Tarjeta">Tarjeta de crédito</option>
                        <option value="Mercado Pago">Mercado Pago</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Otra">Otra</option>
                      </select>
                      {garantiaTipo === "Tarjeta" && (
                        <>
                          <input value={garantiaMarca} onChange={(e) => setGarantiaMarca(e.target.value)} placeholder="Marca (Visa, Mastercard...)" style={inputStyle} />
                          <input value={garantiaNumeroTarjeta} onChange={(e) => setGarantiaNumeroTarjeta(e.target.value.replace(/\\D/g, "").slice(0, 16))} placeholder="Número de tarjeta (16 dígitos)" inputMode="numeric" autoComplete="cc-number" maxLength={16} style={inputStyle} />
                          <input type="month" value={garantiaVencimiento} onChange={(e) => setGarantiaVencimiento(e.target.value)} style={inputStyle} />
                          <input value={garantiaCCV} onChange={(e) => setGarantiaCCV(e.target.value.replace(/\\D/g, "").slice(0, 4))} placeholder="CCV" inputMode="numeric" autoComplete="cc-csc" maxLength={4} style={inputStyle} />
                        </>
                      )}
                      {garantiaTipo && garantiaTipo !== "Tarjeta" && (
                        <input value={garantiaReferencia} onChange={(e) => setGarantiaReferencia(e.target.value)} placeholder="Referencia / comprobante" style={inputStyle} />
                      )}
                    </div>
                    {garantiaTipo === "Tarjeta" && (
                      <div style={{ marginTop: 8, padding: 9, borderRadius: 8, background: "#fff8e8", color: "#72520a", fontSize: 11 }}>
                        El número completo y el CCV se usan solo en este formulario y no se guardan en Supabase. Para producción, estos datos deben procesarse mediante un proveedor de pagos/tokenización.
                      </div>
                    )}
                  </Field>
                </div>

`

t = t.slice(0, documentStart2) + documentGuaranteeBlock + t.slice(conditionsStart)

fs.writeFileSync(path, t)
console.log("Reservation form layout v5 migration applied")
