import{supabase}from"../../../../lib/supabase"
import{picksFromSelection,roomingDetails,selectionFromLines}from"./quoteUtils"

function splitName(value){
  const parts=String(value||"").trim().split(/\s+/).filter(Boolean)
  return{firstName:parts[0]||"",lastName:parts.slice(1).join(" ")}
}

export default async function prepareReservationFromQuote({propertyId,quote,group,quoteLines,checkAvailability,currency,onNavigate}){
  if(!group?.arrival_date||!group?.departure_date||!(quoteLines||[]).some(line=>line.category==="room"))throw new Error("Este presupuesto no tiene estadía o habitaciones convertibles.")
  const{data:existing,error:existingError}=await supabase.from("reservas").select("id,numero_reserva,estado").eq("property_id",propertyId).eq("group_id",group.id).neq("estado","cancelada").limit(1)
  if(existingError)throw existingError
  if(existing?.length)throw new Error(`Este presupuesto ya fue convertido en la reserva ${existing[0].numero_reserva||existing[0].id}.`)
  const current=await checkAvailability(group.arrival_date,group.departure_date,{excludeGroupId:group.id}),picks=picksFromSelection(selectionFromLines(quoteLines),current.types)
  if(!picks.length)throw new Error("No hay habitaciones disponibles para preparar la reserva.")
  const details=roomingDetails(picks,group.estimated_pax),roomIds=details.map(detail=>Number(detail.habitacion_id)),roomAssignments={}
  details.forEach(detail=>{roomAssignments[String(detail.habitacion_id)]={soldAs:detail.categoria_vendida,guests:detail.huespedes,matrimonial:detail.rooming?.matrimonial||0,individual:detail.rooming?.individual||0,rate:Number(detail.tarifa_noche)||0}})
  const{name:firstName,lastName}=(()=>{const split=splitName(group.contact_name||group.name);return{name:split.firstName,lastName:split.lastName}})()
  const seed={quoteId:quote.id,groupId:group.id,quoteNumber:quote.quote_number,firstName,lastName,email:group.contact_email||"",phone:group.contact_phone||"",country:"",start:group.arrival_date,end:group.departure_date,guests:Math.max(1,Number(group.estimated_pax)||1),currency:quote.currency||currency||"ARS",channel:"Directa · Presupuesto",voucher:quote.quote_number||"",notes:`Desde presupuesto ${quote.quote_number}${group.notes?` · ${group.notes}`:""}`,roomIds,roomId:roomIds[0],roomSelectionManual:true,roomAssignments,rate:details.reduce((sum,detail)=>sum+(Number(detail.tarifa_noche)||0),0),status:"confirmada",discountType:"none",discountValue:0}
  if(typeof window==="undefined")throw new Error("No se pudo abrir el formulario de reserva.")
  window.localStorage.setItem(`hl:pms-next:quote-reservation-seed:${propertyId}`,JSON.stringify(seed))
  onNavigate?.("planning",{restoreScroll:false})
  window.setTimeout(()=>window.dispatchEvent(new CustomEvent("hl:pms-start-reservation-from-quote")),60)
  return seed
}