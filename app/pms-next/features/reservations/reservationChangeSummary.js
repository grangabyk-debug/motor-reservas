import{supabase}from"../../../../lib/supabase"
import{buildReservationMetadataPatch,roundMoney}from"./reservationEditUtils"
import{editRegimenSummary,editStayTotal}from"./reservationRoomPricingEdit"

const blocked=new Set(["anulado","anulada","cancelado","cancelada","cancelled","void","rechazado","rechazada","rejected"])
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)

export async function prepareReservationChangeSummary({item,draft,details,existingDetails,ids,isGroup,newNights,earlyPercent,latePercent,originalEarly,originalLate,effectiveNightly}){
  const delta=roundMoney(editStayTotal(details,item,ids)-editStayTotal(existingDetails,item,ids)),nextDraft={...draft,regimen:editRegimenSummary(details)}
  const patch=buildReservationMetadataPatch({baseItem:item,draft:nextDraft,details,ids,effectiveNightly,addedStayAmount:delta,earlyPercent,latePercent,newNights})
  if(isGroup){delete patch.early_checkin;delete patch.early_checkin_importe;delete patch.late_checkout;delete patch.late_checkout_importe}
  const factor=draft.impuestosDesglosados===false?1:1+Math.max(0,Number(draft.ivaPorcentaje)||0)/100,display=v=>roundMoney((Number(v)||0)*factor),lines=[]
  if(item.fecha_entrada!==draft.start||item.fecha_salida!==draft.end)lines.push({label:"Estadía",before:`${item.fecha_entrada} → ${item.fecha_salida}`,after:`${draft.start} → ${draft.end}`})
  if(Number(item.cantidad_huespedes)!==Number(patch.cantidad_huespedes))lines.push({label:"Huéspedes",before:String(item.cantidad_huespedes||0),after:String(patch.cantidad_huespedes||0)})
  for(const detail of details){
    const prev=existingDetails.find(row=>String(row?.habitacion_id)===String(detail?.habitacion_id))||{},roomName=detail?.nombre||detail?.habitacion_id,prevPlan=prev?.rate_plan_name||prev?.rate_plan_regimen||"",nextPlan=detail?.rate_plan_name||detail?.rate_plan_regimen||""
    if(prevPlan!==nextPlan)lines.push({label:`Hab. ${roomName} · Régimen`,before:prevPlan||"—",after:nextPlan||"—"})
    if(Number(prev?.huespedes||0)!==Number(detail?.huespedes||0))lines.push({label:`Hab. ${roomName} · Huéspedes`,before:String(prev?.huespedes||0),after:String(detail?.huespedes||0)})
    const beforeRoom=display(editStayTotal([prev],item,[detail?.habitacion_id])),afterRoom=display(editStayTotal([detail],item,[detail?.habitacion_id]))
    if(Math.abs(afterRoom-beforeRoom)>.01)lines.push({label:`Hab. ${roomName} · Alojamiento`,before:money(beforeRoom,item.moneda),after:money(afterRoom,item.moneda),delta:afterRoom-beforeRoom})
  }
  if(draft.earlyCheckin!==originalEarly)lines.push({label:"Early check-in",before:originalEarly?"Activo":"Sin servicio",after:draft.earlyCheckin?"Activo":"Sin servicio"})
  if(draft.lateCheckout!==originalLate)lines.push({label:"Late check-out",before:originalLate?"Activo":"Sin servicio",after:draft.lateCheckout?"Activo":"Sin servicio"})
  const payRes=await supabase.from("pagos").select("monto,refunded_amount,estado").eq("reserva_id",Number(item.id))
  if(payRes.error)throw payRes.error
  const paid=(payRes.data||[]).filter(row=>!blocked.has(String(row?.estado||"").toLowerCase())).reduce((sum,row)=>sum+Math.max(0,Number(row?.monto||0)-Number(row?.refunded_amount||0)),0),newTotal=Number(patch.precio_total)||0
  return{lines,currency:item.moneda||"ARS",oldTotal:Number(item.precio_total)||0,newTotal,paid,newBalance:Math.max(0,newTotal-paid)}
}


export async function validateReservationEdit({draft,selectedRooms,totalCapacity,assignedGuests,currentIds,datesChanged,roomChanged,item,onPreviewMove,isGroup,originalEarly,originalLate,specialAvailability}){
  if(draft.end<=draft.start)throw new Error("La salida debe ser posterior a la entrada.")
  if(!selectedRooms.length)throw new Error("Elegí una habitación activa.")
  if(Number(draft.guests)>totalCapacity)throw new Error(`La capacidad seleccionada es de ${totalCapacity} huésped${totalCapacity===1?"":"es"}.`)
  if(assignedGuests!==Number(draft.guests))throw new Error(`Distribuí los ${draft.guests} huésped${Number(draft.guests)===1?"":"es"} en el Rooming antes de guardar.`)
  if(currentIds.length>1&&datesChanged)throw new Error("Las fechas de una reserva grupal se editan por habitación para validar todo el conjunto.")
  if(datesChanged||roomChanged){const preview=await onPreviewMove({reservationId:item.id,roomId:Number(draft.roomId),start:draft.start,end:draft.end});if(!preview?.ok)throw new Error(preview?.message||"La habitación no está disponible para ese cambio.")}
  if(!isGroup&&(draft.earlyCheckin!==originalEarly||draft.lateCheckout!==originalLate)){const special=await specialAvailability(draft.earlyCheckin,draft.lateCheckout);if(!special.ok)throw new Error(`No se pueden guardar los horarios especiales: ${special.message}`)}
}
