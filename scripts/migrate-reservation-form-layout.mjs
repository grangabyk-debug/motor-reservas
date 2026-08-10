import fs from "node:fs"

const path = "app/dashboard/page.jsx"
let text = fs.readFileSync(path, "utf8")
const marker = "/* HL_RESERVATION_FORM_LAYOUT_V2 */"

if (text.includes(marker)) {
  console.log("Reservation form layout migration already applied")
  process.exit(0)
}

const passengerField = `                <Field label={<span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span>Pasajeros adicionales</span><button type="button" onClick={agregarPasajeroExtra} aria-label="Agregar pasajero adicional" style={{ ...secondaryButton, width: 30, height: 30, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, lineHeight: 1 }}>+</button></span>} wide>`
const oldPassengerLabel = `                <Field label="Pasajeros adicionales" wide>`
if (!text.includes(oldPassengerLabel)) throw new Error("No se encontró el campo Pasajeros adicionales")
text = text.replace(oldPassengerLabel, passengerField)

const oldPassengerButton = `                    <button type="button" onClick={agregarPasajeroExtra} style={{ ...secondaryButton, width: "fit-content" }}>+ Agregar pasajero</button>\n`
if (!text.includes(oldPassengerButton)) throw new Error("No se encontró el botón Agregar pasajero")
text = text.replace(oldPassengerButton, "")

const contactStart = text.indexOf(`                <Field label="Email">`)
const extraStart = text.indexOf(`                <Field label="Extra de la reserva">`, contactStart)
if (contactStart < 0 || extraStart < 0) throw new Error("No se encontró el bloque Email/Teléfono/Vehículos")

const contactVehicleBlock = `                <div ${marker} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1.25fr) 90px minmax(0, 1fr) minmax(0, 1fr)", gap: 10, alignItems: "end", marginTop: 2 }}>
                  <Field label="Email">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="huésped@email.com" style={inputStyle} />
                  </Field>

                  <Field label="Teléfono">
                    <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 9..." style={inputStyle} />
                  </Field>

                  <Field label="Vehículos">
                    <input
                      type="number"
                      min="0"
                      max="9"
                      value={vehiculos}
                      onChange={(e) => setVehiculos(e.target.value)}
                      style={inputStyle}
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

`
text = text.slice(0, contactStart) + contactVehicleBlock + text.slice(extraStart)

const extraFieldStart = text.indexOf(`                <Field label="Extra de la reserva">`)
const conditionsStart = text.indexOf(`                <Field label="Condiciones especiales" wide>`, extraFieldStart)
if (extraFieldStart < 0 || conditionsStart < 0) throw new Error("No se encontró el bloque Extra/Garantía")

const extraGuaranteeBlock = `                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12, alignItems: "start" }}>
                  <Field label="Extra de la reserva">
                    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 8 }}>
                      <input value={extraDescripcion} onChange={(e) => setExtraDescripcion(e.target.value)} placeholder="Ej. Desayuno, mascota, traslado..." style={inputStyle} />
                      <input type="number" min="0" step="0.01" value={extraReserva} onChange={(e) => setExtraReserva(e.target.value)} placeholder="Valor" style={inputStyle} />
                    </div>
                  </Field>

                  <Field label="Garantía de reserva">
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
                          onChange={e => setGarantiaNumeroTarjeta(e.target.value.replace(/\\D/g, "").slice(0, 16))}
                          placeholder="Número de tarjeta (16 dígitos)"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          maxLength={16}
                          style={inputStyle}
                        />
                        <input type="month" value={garantiaVencimiento} onChange={e => setGarantiaVencimiento(e.target.value)} style={inputStyle} />
                        <input
                          value={garantiaCCV}
                          onChange={e => setGarantiaCCV(e.target.value.replace(/\\D/g, "").slice(0, 4))}
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
                </div>

`
text = text.slice(0, extraFieldStart) + extraGuaranteeBlock + text.slice(conditionsStart)

fs.writeFileSync(path, text)
console.log("Reservation form layout migration applied")
