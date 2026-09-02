function occupancyStart(r){return String(r?.ocupacion_desde_local||`${r?.fecha_entrada||""}T${r?.hora_llegada_estimada||"14:00"}:00`).replace(" ","T")}
function occupancyEnd(r){return String(r?.ocupacion_hasta_local||`${r?.fecha_salida||""}T${r?.hora_salida_estimada||"10:00"}:00`).replace(" ","T")}
function activeReservation(r){return r&&r.estado!=="cancelada"&&!r.no_show}

export function roomStateKey(value){
  const v=String(value||"").toLowerCase()
  if(v==="sucia")return"dirty"
  if(v==="limpieza"||v==="en_limpieza")return"cleaning"
  if(v==="limpia"||v==="inspeccion"||v==="inspeccionada")return"ready"
  if(v==="mantenimiento")return"maintenance"
  if(v==="fuera_servicio")return"out"
  return"available"
}

export function roomStateLabel(value){
  const key=roomStateKey(value)
  return{dirty:"Sucia",cleaning:"En limpieza",ready:"Lista",maintenance:"Mantenimiento",out:"Fuera de servicio",available:"Disponible"}[key]
}

export function stayNights(reservation){
  if(reservation?.tipo_estadia==="day_use")return 1
  const start=new Date(`${reservation?.fecha_entrada||""}T12:00:00`),end=new Date(`${reservation?.fecha_salida||""}T12:00:00`)
  const nights=Math.round((end-start)/86400000)
  return Number.isFinite(nights)?Math.max(1,nights):1
}

export function attentionRoomIds({rooms=[],reservations=[],today,now}){
  const result=new Set(),active=reservations.filter(activeReservation)
  for(const room of rooms){
    const id=String(room.id),state=roomStateKey(room.estado),list=active.filter(r=>String(r.habitacion_id)===id)
    if(["dirty","cleaning","maintenance","out"].includes(state))result.add(id)
    const outgoing=list.find(r=>r.fecha_salida===today),incoming=list.find(r=>r.fecha_entrada===today)
    if(outgoing&&incoming&&!['ready','available'].includes(state))result.add(id)
    const lateArrival=list.some(r=>r.fecha_entrada===today&&!["alojado","finalizada"].includes(String(r.estado||"").toLowerCase())&&occupancyStart(r)<=now)
    const overdueOut=list.some(r=>r.fecha_salida===today&&String(r.estado||"").toLowerCase()==="alojado"&&occupancyEnd(r)<now)
    if(lateArrival||overdueOut)result.add(id)
  }
  return result
}

export function ghostHasConflict({reservationId,roomId,date,nights,reservations=[],blocks=[]}){
  if(!roomId||!date)return false
  const endDate=addDate(date,Math.max(1,nights||1)),start=`${date}T00:00:00`,end=`${endDate}T00:00:00`
  const reservationConflict=reservations.some(r=>String(r.id)!==String(reservationId)&&activeReservation(r)&&String(r.habitacion_id)===String(roomId)&&occupancyStart(r)<end&&occupancyEnd(r)>start)
  const blockConflict=blocks.some(b=>String(b.habitacion_id)===String(roomId)&&date<b.fecha_hasta&&endDate>b.fecha_desde)
  return reservationConflict||blockConflict
}

function addDate(date,days){
  const d=new Date(`${date}T12:00:00`)
  d.setDate(d.getDate()+days)
  return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}
