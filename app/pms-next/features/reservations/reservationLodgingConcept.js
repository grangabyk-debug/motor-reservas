// La reserva puede resumirse como "Mixto", pero el concepto del cargo es por habitación.
// Este módulo es de presentación y facturación: no modifica importes ni filas fiscales emitidas.
const clean=value=>String(value??"").trim()
const day=value=>clean(value).slice(0,10)

export function lodgingPlanForDetail(detail,reservation=null){
  const names=[detail?.rate_plan_name,detail?.rate_plan_snapshot?.name,detail?.rate_plan_regimen]
  const own=names.map(clean).find(name=>name&&!/^mixto$/i.test(name))
  if(own)return own
  const overall=clean(reservation?.regimen)
  return overall&&!/^mixto$/i.test(overall)?overall:""
}

export function lodgingDetailForRoom(reservation,roomId,serviceDate=""){
  const details=Array.isArray(reservation?.habitaciones_detalle)?reservation.habitaciones_detalle:[]
  const id=Number(roomId)
  const candidates=Number.isFinite(id)&&id>0?details.filter(detail=>Number(detail?.habitacion_id)===id):details.length===1?details:[]
  if(!candidates.length)return null
  const date=day(serviceDate)
  if(date){
    const dated=candidates.find(detail=>day(detail?.fecha_entrada)<=date&&date<day(detail?.fecha_salida))
    if(dated)return dated
  }
  return candidates.find(detail=>String(detail?.segment_role||"")!=="transient_room")||candidates[0]
}

function lodgingRoomId(row){
  const id=Number(row?.room_id??row?.habitacion_id)
  if(Number.isFinite(id)&&id>0)return id
  const source=clean(row?.source_key),match=/^lodging:(\d+)(?::|$)/.exec(source)
  return match?Number(match[1]):null
}

export function lodgingFolioItemPresentation(row,reservation){
  if(clean(row?.source_type).toLowerCase()!=="lodging")return row
  const detail=lodgingDetailForRoom(reservation,lodgingRoomId(row),row?.service_date)
  const plan=lodgingPlanForDetail(detail,reservation)
  if(!detail||!plan)return row
  const roomName=clean(detail.nombre)||clean(lodgingRoomId(row))
  if(!roomName)return row
  const detailText=clean(row.detail)
  return{
    ...row,
    description:`Alojamiento · Habitación ${roomName} · ${plan}`,
    detail:/^mixto(?:\s*·|$)/i.test(detailText)?detailText.replace(/^mixto/i,plan):detailText||null,
  }
}
