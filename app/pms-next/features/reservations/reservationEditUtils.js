const DAY=86400000
const pad=value=>String(value).padStart(2,"0")
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const dateKey=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`

export const addDays=(value,amount)=>dateKey(new Date(fromKey(value).getTime()+amount*DAY))
export const diffDays=(a,b)=>Math.max(1,Math.round((fromKey(b)-fromKey(a))/DAY))
export const unique=values=>[...new Set((values||[]).filter(Boolean).map(value=>String(value)))]
export const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
export const capacity=room=>Math.max(1,Number(room?.capacidad)||1)
export const roundMoney=value=>Math.round((Number(value)||0)*100)/100

export function initialReservationEditDraft(item,assigned){
  const ids=unique([item.habitacion_id,...(item.habitaciones_ids||[])]),details=Array.isArray(item.habitaciones_detalle)?item.habitaciones_detalle:[],roomAssignments={}
  for(const id of ids){const room=assigned.find(value=>String(value.id)===id),detail=details.find(value=>String(value?.habitacion_id)===id)||{},beds=detail.rooming||{};roomAssignments[id]={soldAs:detail.categoria_vendida||room?.tipo||"Habitación",guests:Math.max(0,Number(detail.huespedes)||0),matrimonial:Math.max(0,Number(beds.matrimonial)||0),individual:Math.max(0,Number(beds.individual)||0),rate:Number(detail.tarifa_noche)||Number(room?.precio)||Number(item.tarifa_noche)||0}}
  const earlyAmount=Math.max(0,Number(item.early_checkin_importe)||0),lateAmount=Math.max(0,Number(item.late_checkout_importe)||0)
  return{start:item.fecha_entrada,end:item.fecha_salida,guests:Math.max(1,Number(item.cantidad_huespedes)||1),phone:item.telefono_huesped||"",regimen:item.regimen||"Alojamiento",roomId:ids[0]||"",roomIds:ids,roomAssignments,rate:Number(item.tarifa_noche)||0,currency:item.moneda||"ARS",earlyCheckin:Boolean(item.early_checkin)||earlyAmount>0,lateCheckout:Boolean(item.late_checkout)||lateAmount>0,originalEarlyAmount:earlyAmount,originalLateAmount:lateAmount}
}

export function originalNightlyRate(item,currentIds){
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
  return(currentIds||[]).reduce((sum,id)=>{const detail=details.find(value=>String(value?.habitacion_id)===String(id));return sum+Math.max(0,Number(detail?.tarifa_noche)||0)},0)||Number(item?.tarifa_noche)||0
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
  return{habitacion_id:Number(ids[0]),habitaciones_ids:ids.map(Number),telefono_huesped:draft.phone.trim()||null,regimen:draft.regimen.trim()||null,cantidad_huespedes:Math.max(1,Number(draft.guests)||1),habitaciones_detalle:details,tarifa_noche:effectiveNightly,noches:newNights,early_checkin:Boolean(draft.earlyCheckin),early_checkin_importe:nextEarly,late_checkout:Boolean(draft.lateCheckout),late_checkout_importe:nextLate,subtotal:nextNet,precio_sin_impuestos_nacionales:nextNet,iva_importe:nextVat,precio_total:nextTotal}
}
