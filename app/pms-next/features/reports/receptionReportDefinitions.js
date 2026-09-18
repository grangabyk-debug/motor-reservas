const normalize=value=>String(value||"").trim().toLowerCase()

export const confirmedPayment=row=>["confirmado","confirmed","approved","aprobado","paid","completed","completado"].includes(normalize(row?.estado))

export const money=(value,currency="ARS")=>{
  const amount=Number(value)||0,code=String(currency||"ARS").toUpperCase()
  try{return new Intl.NumberFormat("es-AR",{style:"currency",currency:code,minimumFractionDigits:2,maximumFractionDigits:2}).format(amount)}
  catch{return`${code} ${amount.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`}
}

export const ARRIVAL_COLUMNS=[
  {key:"guest",label:"Huésped",required:true},{key:"room",label:"Habitación",required:true},{key:"pax",label:"Pax",required:true},{key:"balance",label:"Saldo",required:true},{key:"note",label:"Notas",required:true},
  {key:"reservation",label:"Reserva"},{key:"time",label:"Hora"},{key:"total",label:"Total estadía"},{key:"paid",label:"Abonado"},{key:"phone",label:"Teléfono",defaultVisible:false},{key:"status",label:"Estado",defaultVisible:false},{key:"regime",label:"Régimen",defaultVisible:false},{key:"arrival",label:"Llegada",defaultVisible:false},{key:"departure",label:"Salida",defaultVisible:false},
]

export const DEPARTURE_COLUMNS=[
  {key:"guest",label:"Huésped",required:true},{key:"room",label:"Habitación",required:true},{key:"pax",label:"Pax",required:true},{key:"balance",label:"Saldo",required:true},{key:"note",label:"Notas",required:true},
  {key:"reservation",label:"Reserva"},{key:"time",label:"Hora"},{key:"total",label:"Total estadía"},{key:"paid",label:"Abonado"},{key:"channel",label:"Canal"},{key:"currency",label:"Moneda"},{key:"phone",label:"Teléfono",defaultVisible:false},{key:"status",label:"Estado",defaultVisible:false},{key:"regime",label:"Régimen",defaultVisible:false},{key:"arrival",label:"Llegada",defaultVisible:false},{key:"departure",label:"Salida",defaultVisible:false},
]

export const BREAKFAST_COLUMNS=[
  {key:"guest",label:"Huésped",required:true},{key:"room",label:"Habitación",required:true},{key:"pax",label:"Pax",required:true},{key:"composition",label:"Composición"},{key:"note",label:"Notas",required:true},
  {key:"situation",label:"Situación"},{key:"reservation",label:"Reserva",defaultVisible:false},{key:"regime",label:"Régimen"},{key:"departure",label:"Salida",defaultVisible:false},{key:"phone",label:"Teléfono",defaultVisible:false},{key:"status",label:"Estado",defaultVisible:false},
]

export const HOUSEKEEPING_COLUMNS=[
  {key:"room",label:"Habitación",required:true},{key:"reservation",label:"Reserva"},{key:"guest",label:"Titular"},
  {key:"type",label:"Tipo",required:true},{key:"bedSetup",label:"Camas",required:true,editable:true},{key:"operation",label:"Operación",required:true},{key:"roomStatus",label:"Estado",required:true},{key:"note",label:"Notas",required:true},
  {key:"task",label:"Tarea"},{key:"taskStatus",label:"Estado tarea",defaultVisible:false},{key:"responsible",label:"Responsable",defaultVisible:false},
]

export const RESERVATION_TOTALS=[
  {key:"pax",label:"Pasajeros",value:rows=>rows.reduce((sum,row)=>sum+(Number(row.pax)||0),0)},
  {key:"rooms",label:"Habitaciones",value:rows=>rows.reduce((sum,row)=>sum+(Number(row.roomCount)||0),0)},
  {key:"rows",label:"Reservas",value:rows=>rows.length},
]

export const HOUSEKEEPING_TOTALS=[
  {key:"rooms",label:"Habitaciones",value:rows=>rows.length},
  {key:"tasks",label:"Tareas",value:rows=>rows.filter(row=>row.task&&row.task!=="—").length},
]
