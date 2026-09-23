export const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
export const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".",""):"—"
export const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
export const payerLabels={guest:"Huésped",company:"Empresa",agency:"Agencia",group:"Grupo",other:"Otro"}
export const typeLabels={lodging:"Alojamiento",parking:"Cochera",pet:"Mascotas",service:"Servicio",extra:"Extra",discount:"Descuento",adjustment:"Ajuste",fee:"Cargo"}
