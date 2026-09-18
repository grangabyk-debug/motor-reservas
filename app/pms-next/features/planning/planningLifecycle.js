const pad=value=>String(value).padStart(2,"0")

export const PLANNING_STAGES=[
  {key:"preventa",label:"Preventa",description:"Nueva / pendiente de confirmación"},
  {key:"venta",label:"Venta",description:"Confirmada / garantizada"},
  {key:"checkin",label:"Check-in",description:"Pendiente de ingreso"},
  {key:"inhouse",label:"In-house",description:"Huésped alojado"},
  {key:"checkout",label:"Check-out",description:"Sale hoy y continúa alojado"},
  {key:"postventa",label:"Postventa",description:"Estadía finalizada"},
  {key:"noshow",label:"No-show",description:"El huésped no se presentó"},
]

export function dateKey(date=new Date()){
  return`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
}

function pendingRoomCheckin(item){
  const group=Array.isArray(item?._reservation_room_ids)&&item._reservation_room_ids.length>1
  if(!group||item?.estado!=="alojado"||!item?._room_segment)return false
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[],hasExplicit=details.some(detail=>Boolean(detail?.checked_in_at))
  if(!hasExplicit)return false
  return !item?._room_detail?.checked_in_at
}

export function planningStage(item,today=dateKey()){
  if(!item)return"venta"
  if(item.no_show)return"noshow"
  if(item.estado==="finalizada")return"postventa"
  if(item.estado==="alojado"){
    if(pendingRoomCheckin(item))return"checkin"
    return item.fecha_salida===today?"checkout":"inhouse"
  }
  if(item.estado==="confirmada")return item.fecha_entrada===today?"checkin":"venta"
  if(item.estado==="pendiente"||item.estado==="tentativa")return"preventa"
  return"venta"
}

export function planningStageMeta(item,today=dateKey()){
  const key=planningStage(item,today)
  return PLANNING_STAGES.find(stage=>stage.key===key)||PLANNING_STAGES[1]
}

export function planningStageLabel(item,today=dateKey()){
  return planningStageMeta(item,today).label
}
