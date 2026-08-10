import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let t = fs.readFileSync(path, "utf8")
const marker = "HL_RESERVATION_FORM_LAYOUT_V5"

if (t.includes(marker)) {
  process.exit(0)
}

if (!t.includes('const [direccion, setDireccion]')) {
  const states = `  const [nombre, setNombre] = useState("")
  const [dni, setDni] = useState("")
  const [pasajerosExtra, setPasajerosExtra] = useState([])`
  t = t.replace(
    states,
    `  const [nombre, setNombre] = useState("")
  const [dni, setDni] = useState("")
  const [direccion, setDireccion] = useState("")
  const [provinciaEstado, setProvinciaEstado] = useState("")
  const [pais, setPais] = useState("")
  const [pasajerosExtra, setPasajerosExtra] = useState([])`
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
}

if (!t.includes('setDireccion(reserva.direccion_huesped')) {
  t = t.replace(
    `    setDni(reserva.dni_huesped || "")
    setEmail(reserva.email_huesped || "")`,
    `    setDni(reserva.dni_huesped || "")
    setDireccion(reserva.direccion_huesped || "")
    setProvinciaEstado(reserva.provincia_estado_huesped || "")
    setPais(reserva.pais_huesped || "")
    setEmail(reserva.email_huesped || "")`
  )
}

if (!t.includes('direccion_huesped: direccion.trim()')) {
  t = t.replace(
    `      dni_huesped: dni.trim(),
      es_menor: false,`,
    `      dni_huesped: dni.trim(),
      direccion_huesped: direccion.trim(),
      provincia_estado_huesped: provinciaEstado.trim(),
      pais_huesped: pais.trim(),
      es_menor: false,`
  )
}

if (!t.includes('setDireccion("")\n      setProvinciaEstado')) {
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

const start = t.indexOf(`                <Field label="Nombre del huésped principal">`)
const end = t.indexOf(`              {habitacionSeleccionada && fechaEntrada && fechaSalida && (`, start)

if (start < 0 || end < 0) {
  throw new Error("No se encontró el bloque completo del formulario de reserva.")
}

const newBlock = `                <div ${marker} style={{ gridColumn: "1 / -1", display: "grid", gap: 14 }}>

                  <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 14 }}>
                    <Field label="Nombre del huésped principal">
                      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Juan Pérez" style={inputStyle} />
                    </Field>
                    <Field label="DNI / Pasaporte">
                      <input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="Ej. 35.123.456 o pasaporte" style={inputStyle} />
                    </Field>
                  </div>

                  <Field label="Pasajeros adicionales" wide>
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "9px 10px",
                        borderRadius: 9,
                        background: colors.blueSoft,
                        color: colors.blue,
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        <span>Huéspedes: {1 + pasajerosExtra.length}</span>
                        <button
                          type="button"
                          onClick={agregarPasajeroExtra}
                          aria-label="Agregar pasajero adicional"
                          title="Agregar pasajero"
                          style={{ ...secondaryButton, width: 32, height: 32, padding: 0, fontSize: 20, lineHeight: 1 }}
                        >
                          +
                        </button>
                      </div>
                      {pasajerosExtra.map((pasajero, indice) => (
                        <div key={indice} style={{
                          display: "grid",
                          gridTemplateColumns: "1.5fr 1fr auto auto",
                          gap: 8,
                          alignItems: "center",
                          padding: 10,
                          background: colors.bg,
                          borderRadius: 9,
                          border: "1px solid " + colors.border,
                        }}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <span style={{ fontSize: 10, color: colors.muted, fontWeight: 800 }}>Pasajero {indice + 1}</span>
                            <input value={pasajero.nombre} onChange={(e) => actualizarPasajeroExtra(indice, "nombre", e.target.value)} placeholder="Nombre y apellido" style={inputStyle} />
                          </div>
                          <input value={pasajero.dni} onChange={(e) => actualizarPasajeroExtra(indice, "dni", e.target.value)} placeholder="DNI / Pasaporte" style={inputStyle} />
                          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                            <input type="checkbox" checked={Boolean(pasajero.menor)} onChange={(e) => actualizarPasajeroExtra(indice, "menor", e.target.checked)} />
                            Menor
                          </label>
                          <button type="button" onClick={() => eliminarPasajeroExtra(indice)} style={{ ...secondaryButton, padding: "8px 10px", color: colors.red }}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </Field>

                  <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr .75fr .9fr 1fr", gap: 12, alignItems: "end" }}>
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

                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
                    <Field label="Dirección">
                      <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle y número" style={inputStyle} />
                    </Field>
                    <Field label="Provincia / Estado">
                      <input value={provinciaEstado} onChange={(e) => setProvinciaEstado(e.target.value)} placeholder="Provincia o estado" style={inputStyle} />
                    </Field>
                    <Field label="País">
                      <input value={pais} onChange={(e) => setPais(e.target.value)} placeholder="Argentina" style={inputStyle} />
                    </Field>
                  </div>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: monedaReserva === "USD" ? "1.35fr 1fr 1fr 1fr" : "1.35fr 1fr 1fr",
                    gap: 12,
                    alignItems: "end",
                  }}>
                    <Field label="Extra de la reserva">
                      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 8 }}>
                        <input value={extraDescripcion} onChange={(e) => setExtraDescripcion(e.target.value)} placeholder="Ej. Desayuno, mascota, traslado..." style={inputStyle} />
                        <input type="number" min="0" step="0.01" value={extraReserva} onChange={(e) => setExtraReserva(e.target.value)} placeholder="Valor" style={inputStyle} />
                      </div>
                    </Field>

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

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
                    <Field label="Documento del huésped">
                      <div style={{ display: "grid", gap: 7 }}>
                        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleDocumentoUpload} style={{ ...inputStyle, padding: 9 }} />
                        <div style={{ color: colors.muted, fontSize: 11 }}>
                          Foto o PDF del documento. Se guarda en un almacenamiento privado.
                          {reservaSeleccionada?.documento_nombre ? " Documento actual: " + reservaSeleccionada.documento_nombre : ""}
                        </div>
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
                            <input value={garantiaNumeroTarjeta} onChange={(e) => setGarantiaNumeroTarjeta(e.target.value.replace(/\D/g, "").slice(0, 16))} placeholder="Número de tarjeta (16 dígitos)" inputMode="numeric" autoComplete="cc-number" maxLength={16} style={inputStyle} />
                            <input type="month" value={garantiaVencimiento} onChange={(e) => setGarantiaVencimiento(e.target.value)} style={inputStyle} />
                            <input value={garantiaCCV} onChange={(e) => setGarantiaCCV(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="CCV" inputMode="numeric" autoComplete="cc-csc" maxLength={4} style={inputStyle} />
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

`
t = t.slice(0, start) + newBlock + t.slice(end)

fs.writeFileSync(path, t)
console.log("Reservation form layout v5 migration applied")
