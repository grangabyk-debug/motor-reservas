import fs from "node:fs"
const path="app/dashboard/page.jsx"
let t=fs.readFileSync(path,"utf8")
const marker="HL_RESERVATION_FORM_LAYOUT_V4"
if(t.includes(marker))process.exit(0)

const states=`  const [nombre, setNombre] = useState("")\n  const [dni, setDni] = useState("")\n  const [pasajerosExtra, setPasajerosExtra] = useState([])`
t=t.replace(states,`  const [nombre, setNombre] = useState("")\n  const [dni, setDni] = useState("")\n  const [direccion, setDireccion] = useState("")\n  const [provinciaEstado, setProvinciaEstado] = useState("")\n  const [pais, setPais] = useState("")\n  const [pasajerosExtra, setPasajerosExtra] = useState([])`)
t=t.replace(`    setDni("")\n    setPasajerosExtra([])`,`    setDni("")\n    setDireccion("")\n    setProvinciaEstado("")\n    setPais("")\n    setPasajerosExtra([])`)
t=t.replace(`    setDni(reserva.dni_huesped || "")\n    setEmail(reserva.email_huesped || "")`,`    setDni(reserva.dni_huesped || "")\n    setDireccion(reserva.direccion_huesped || "")\n    setProvinciaEstado(reserva.provincia_estado_huesped || "")\n    setPais(reserva.pais_huesped || "")\n    setEmail(reserva.email_huesped || "")`)
t=t.replace(`      dni_huesped: dni.trim(),\n      es_menor: false,`,`      dni_huesped: dni.trim(),\n      direccion_huesped: direccion.trim(),\n      provincia_estado_huesped: provinciaEstado.trim(),\n      pais_huesped: pais.trim(),\n      es_menor: false,`)
t=t.replace(`      setNombre("")\n      setDni("")\n      setEmail("")`,`      setNombre("")\n      setDni("")\n      setDireccion("")\n      setProvinciaEstado("")\n      setPais("")\n      setEmail("")`)

const a=t.indexOf(`                <Field label="Nombre del huésped principal">`)
const b=t.indexOf(`                <Field label="Pasajeros adicionales"`,a)
if(a>=0&&b>0){
 const newBlock=`                <div ${marker} style={{gridColumn:"1 / -1",display:"grid",gap:12}}>
                  <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr 1.4fr",gap:12}}>
                    <Field label="Nombre del huésped principal"><input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej. Juan Pérez" style={inputStyle}/></Field>
                    <Field label="DNI / Pasaporte"><input value={dni} onChange={e=>setDni(e.target.value)} placeholder="Ej. 35.123.456" style={inputStyle}/></Field>
                    <Field label="Dirección"><input value={direccion} onChange={e=>setDireccion(e.target.value)} placeholder="Calle y número" style={inputStyle}/></Field>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr",gap:12}}>
                    <Field label="Provincia / Estado"><input value={provinciaEstado} onChange={e=>setProvinciaEstado(e.target.value)} placeholder="Provincia o estado" style={inputStyle}/></Field>
                    <Field label="País"><input value={pais} onChange={e=>setPais(e.target.value)} placeholder="Argentina" style={inputStyle}/></Field>
                  </div>
                </div>

`
 t=t.slice(0,a)+newBlock+t.slice(b)
}

// El bloque de pasajeros queda debajo de los datos personales, con el único + junto al título.
t=t.replace(`<Field label="Pasajeros adicionales" wide>`,`<Field label={<span style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}><span>Pasajeros adicionales</span><button type="button" onClick={agregarPasajeroExtra} aria-label="Agregar pasajero adicional" style={{...secondaryButton,width:30,height:30,padding:0,fontSize:18,lineHeight:1}}>+</button></span>} wide>`)
t=t.replace(`                    <button type="button" onClick={agregarPasajeroExtra} style={{ ...secondaryButton, width: "fit-content" }}>+ Agregar pasajero</button>\n`,"")
t=t.replace(`<input value={pasajero.dni} onChange={(e) => actualizarPasajeroExtra(indice, "dni", e.target.value)} placeholder="DNI"`, `<input value={pasajero.dni} onChange={(e) => actualizarPasajeroExtra(indice, "dni", e.target.value)} placeholder="DNI / Pasaporte"`)

// La parte inferior mantiene Extra, Descuento, Moneda y Tipo de cambio, y libera espacio para Documento/Garantía en una línea ordenada.
t=t.replace(`<Field label="Documento del huésped" wide>`,`<Field label="Documento del huésped">`)
t=t.replace(`<Field label="Garantía de reserva" wide>`,`<Field label="Garantía de reserva">`)

fs.writeFileSync(path,t)
console.log("Reservation form layout v4 migration applied")
