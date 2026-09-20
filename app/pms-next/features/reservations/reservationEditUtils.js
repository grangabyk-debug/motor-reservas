const DAY=86400000
const pad=value=>String(value).padStart(2,"0")
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const dateKey=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))

export const addDays=(value,amount)=>dateKey(new Date(fromKey(value).getTime()+amount*DAY))
export const diffDays=(a,b)=>Math.max(1,Math.round((fromKey(b)-fromKey(a))/DAY))
export const unique=values=>[...new Set((values||[]).filter(Boolean).map(value=>String(value)))]
export const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
export const capacity=room=>Math.max(1,Number(room?.capacidad)||1)
export const roundMoney=value=>Math.round((Number(value)||0)*100)/100

const releasedRoomIds=item=>new Set(Object.entries(item?.room_checkout_dates||{}).filter(([,value])=>validDate(value)).map(([id])=>String(id)))
export const activeReservationRoomIds=item=>{
  const all=unique([item?.habitacion_id,...(item?.habitaciones_ids||[])])
  const released=releasedRoomIds(item)
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
  const historical=new Set(details.filter(detail=>["previous_room","transient_room"].includes(String(detail?.segment_role||"").toLowerCase())).map(detail=>String(detail?.habitacion_id||"")).filter(Boolean))
  const active=all.filter(id=>!released.has(id)&&!historical.has(id))
  if(active.length)return active
  const marked=details.filter(detail=>["active_room","scheduled_room",""].includes(String(detail?.segment_role||"").toLowerCase())).map(detail=>String(detail?.habitacion_id||"")).filter(id=>id&&!released.has(id)&&!historical.has(id))
  if(marked.length)return unique(marked)
  return item?.habitacion_id?[String(item.habitacion_id)]:all
}

export function initialReservationEditDraft(item,assigned){
  const ids=activeReservationRoomIds(item),details=Array.isArray(item.habitaciones_detalle)?item.habitaciones_detalle:[],roomAssignments={}
  for(const id of ids){const room=assigned.find(value=>String(value.id)===id),detail=details.find(value=>String(value?.habitacion_id)===id)||{},beds=detail.rooming||{};roomAssignments[id]={soldAs:detail.categoria_vendida||room?.tipo||"Habitación",guests:Math.max(0,Number(detail.huespedes)||0),matrimonial:Math.max(0,Number(beds.matrimonial)||0),individual:Math.max(0,Number(beds.individual)||0),rate:Number(detail.tarifa_noche)||Number(room?.precio)||Number(item.tarifa_noche)||0}}
  const earlyAmount=Math.max(0,Number(item.early_checkin_importe)||0),lateAmount=Math.max(0,Number(item.late_checkout_importe)||0)
  const taxEnabled=Boolean(item.impuestos_desglosados),storedNet=Math.max(0,Number(item.precio_sin_impuestos_nacionales)||Number(item.subtotal)||0),storedVat=Math.max(0,Number(item.iva_importe)||0),vatRate=taxEnabled?Math.max(0,Number(item.iva_porcentaje)||(storedNet>0?roundMoney(storedVat/storedNet*100):0)):0
  return{start:item.fecha_entrada,end:item.fecha_salida,guests:Math.max(1,Number(item.cantidad_huespedes)||1),phone:item.telefono_huesped||"",regimen:item.regimen||"Alojamiento",roomId:ids[0]||"",roomIds:ids,roomAssignments,rate:Number(item.tarifa_noche)||0,currency:item.moneda||"ARS",impuestosDesglosados:taxEnabled,ivaPorcentaje:vatRate,earlyCheckin:Boolean(item.early_checkin)||earlyAmount>0,lateCheckout:Boolean(item.late_checkout)||lateAmount>0,originalEarlyAmount:earlyAmount,originalLateAmount:lateAmount}
}

export function originalNightlyRate(item,currentIds){
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[],released=releasedRoomIds(item)
  const active=(currentIds||[]).filter(id=>!released.has(String(id)))
  return active.reduce((sum,id)=>{const detail=details.find(value=>String(value?.habitacion_id)===String(id));return sum+Math.max(0,Number(detail?.tarifa_noche)||0)},0)||Number(item?.tarifa_noche)||0
}

export function buildReservationMetadataPatch({baseItem,draft,details,ids,effectiveNightly,addedStayAmount=0,earlyPercent,latePercent,newNights}){
  const oldEarly=Math.max(0,Number(baseItem.early_checkin_importe)||0),oldLate=Math.max(0,Number(baseItem.late_checkout_importe)||0)
  const nextEarly=draft.earlyCheckin?(draft.originalEarlyAmount>0?draft.originalEarlyAmount:roundMoney(effectiveNightly*earlyPercent/100)):0
  const nextLate=draft.lateCheckout?(draft.originalLateAmount>0?draft.originalLateAmount:roundMoney(effectiveNightly*latePercent/100)):0
  const taxEnabled=Boolean(baseItem.impuestos_desglosados),vatRate=taxEnabled?Math.max(0,Number(baseItem.iva_porcentaje)||0):0
  const totalNow=Math.max(0,Number(baseItem.precio_total)||0),vatNow=Math.max(0,Number(baseItem.iva_importe)||0)
  const storedNet=Math.max(0,Number(baseItem.precio_sin_impuestos_nacionales)||Number(baseItem.subtotal)||0)
  const currentNet=storedNet>0?storedNet:taxEnabled?Math.max(0,totalNow-vatNow):totalNow
  const baseNet=Math.max(0,currentNet-oldEarly-oldLate),nextNet=roundMoney(baseNet+Math.max(0,Number(addedStayAmount)||0)+nextEarly+nextLate),nextVat=taxEnabled?roundMoney(nextNet*vatRate/100):0,nextTotal=roundMoney(nextNet+nextVat)
  const released=releasedRoomIds(baseItem),activeIds=unique(ids),activeSet=new Set(activeIds),baseDetails=Array.isArray(baseItem?.habitaciones_detalle)?baseItem.habitaciones_detalle:[]
  const historyDetails=baseDetails.filter(detail=>{const id=String(detail?.habitacion_id||"");return id&&released.has(id)&&!activeSet.has(id)})
  const persistedDetails=[...(details||[]),...historyDetails],persistedIds=unique([...activeIds,...historyDetails.map(detail=>detail?.habitacion_id)])
  return{habitacion_id:Number(activeIds[0]),habitaciones_ids:persistedIds.map(Number),telefono_huesped:draft.phone.trim()||null,regimen:draft.regimen.trim()||null,cantidad_huespedes:Math.max(1,Number(draft.guests)||1),habitaciones_detalle:persistedDetails,tarifa_noche:effectiveNightly,noches:newNights,early_checkin:Boolean(draft.earlyCheckin),early_checkin_importe:nextEarly,late_checkout:Boolean(draft.lateCheckout),late_checkout_importe:nextLate,subtotal:nextNet,precio_sin_impuestos_nacionales:nextNet,iva_importe:nextVat,precio_total:nextTotal}
}


export function reservationCheckinProgress(item){
  const roomIds=activeReservationRoomIds(item).map(Number).filter(Number.isFinite)
  const activeSet=new Set(roomIds.map(String)),details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[],today=dateKey(new Date())
  const detailFor=id=>details.find(detail=>String(detail?.habitacion_id||"")===String(id))||{}
  const roomStart=id=>String(detailFor(id)?.fecha_entrada||item?.fecha_entrada||"").slice(0,10)
  const roomEnd=id=>String(detailFor(id)?.fecha_salida||item?.fecha_salida||"").slice(0,10)
  const checkedExplicit=unique(details.filter(detail=>{
    const id=String(detail?.habitacion_id||""),role=String(detail?.segment_role||"active_room").toLowerCase()
    return activeSet.has(id)&&role!=="previous_room"&&role!=="transient_room"&&Boolean(detail?.checked_in_at)
  }).map(detail=>detail.habitacion_id)).map(Number)
  const legacyComplete=item?.estado==="alojado"&&checkedExplicit.length===0&&roomIds.every(id=>{const start=roomStart(id);return!validDate(start)||start<=today})
  const checkedRoomIds=legacyComplete?[...roomIds]:checkedExplicit
  const checkedSet=new Set(checkedRoomIds.map(Number)),pendingRoomIds=roomIds.filter(id=>!checkedSet.has(Number(id)))
  const eligiblePendingRoomIds=pendingRoomIds.filter(id=>{const start=roomStart(id),end=roomEnd(id);return(!validDate(start)||start<=today)&&(!validDate(end)||end>today)})
  const futurePendingRoomIds=pendingRoomIds.filter(id=>{const start=roomStart(id);return validDate(start)&&start>today})
  const expiredPendingRoomIds=pendingRoomIds.filter(id=>{const end=roomEnd(id);return validDate(end)&&end<=today})
  const nextPendingDate=futurePendingRoomIds.map(roomStart).filter(validDate).sort()[0]||null
  return{roomIds,checkedRoomIds,pendingRoomIds,eligiblePendingRoomIds,futurePendingRoomIds,expiredPendingRoomIds,nextPendingDate,total:roomIds.length,checked:checkedRoomIds.length,pending:pendingRoomIds.length,eligiblePending:eligiblePendingRoomIds.length,partial:item?.estado==="alojado"&&checkedRoomIds.length>0&&pendingRoomIds.length>0,complete:item?.estado==="alojado"&&roomIds.length>0&&pendingRoomIds.length===0,started:item?.estado==="alojado"||checkedRoomIds.length>0,legacyComplete}
}
