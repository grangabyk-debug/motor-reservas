import{picksFromSelection,roomingDetails}from"../quotes/quoteUtils"
import{supabase}from"../../../../lib/supabase"

function splitName(value){const parts=String(value||"").trim().split(/\s+/).filter(Boolean);return{firstName:parts[0]||"",lastName:parts.slice(1).join(" ")}}
function buildSelection(opportunity,types){
  let remaining=Math.max(1,Number(opportunity.rooms_count)||1),selection={}
  const wanted=[opportunity.preferred_room_type,...(opportunity.alternative_room_types||[])].filter(Boolean)
  const ordered=wanted.length
    ?wanted.map(name=>types.find(type=>String(type.name).toLowerCase()===String(name).toLowerCase())).filter(Boolean)
    :types
  for(const type of ordered){if(remaining<=0)break;const qty=Math.min(remaining,Math.max(0,Number(type.available)||0));if(qty>0){selection[type.name]=(selection[type.name]||0)+qty;remaining-=qty}}
  if(remaining>0)throw new Error("Todavía no hay disponibilidad suficiente para convertir esta oportunidad en reserva.")
  return selection
}

export async function prepareReservationFromCrm({propertyId,opportunity,checkAvailability,onNavigate}){
  if(!opportunity?.desired_check_in||!opportunity?.desired_check_out)throw new Error("La oportunidad necesita fechas antes de crear la reserva.")
  const current=await checkAvailability(opportunity.desired_check_in,opportunity.desired_check_out),selection=buildSelection(opportunity,current.types),picks=picksFromSelection(selection,current.types)
  if(!picks.length)throw new Error("No encontramos habitaciones libres compatibles.")
  const pax=Math.max(1,Number(opportunity.adults||0)+Number(opportunity.children||0)),details=roomingDetails(picks,pax),roomIds=details.map(detail=>Number(detail.habitacion_id)),roomAssignments={}
  details.forEach(detail=>{roomAssignments[String(detail.habitacion_id)]={soldAs:detail.categoria_vendida,guests:detail.huespedes,matrimonial:detail.rooming?.matrimonial||0,individual:detail.rooming?.individual||0,rate:Number(detail.tarifa_noche)||0}})
  const{firstName,lastName}=splitName(opportunity.name)
  const seed={crmOpportunityId:opportunity.id,firstName,lastName,email:opportunity.email||"",phone:opportunity.phone||"",country:"",start:opportunity.desired_check_in,end:opportunity.desired_check_out,guests:pax,currency:opportunity.currency||"ARS",channel:"Directa · CRM",voucher:"",notes:`Desde oportunidad CRM ${opportunity.id}${opportunity.notes?` · ${opportunity.notes}`:""}`,roomIds,roomId:roomIds[0],roomSelectionManual:true,roomAssignments,rate:details.reduce((sum,detail)=>sum+(Number(detail.tarifa_noche)||0),0),status:"confirmada",discountType:"none",discountValue:0}
  if(typeof window==="undefined")throw new Error("No se pudo abrir el formulario de reserva.")
  localStorage.setItem(`hl:pms-next:quote-reservation-seed:${propertyId}`,JSON.stringify(seed))
  onNavigate?.("planning",{restoreScroll:false})
  setTimeout(()=>window.dispatchEvent(new CustomEvent("hl:pms-start-reservation-from-quote")),60)
  return seed
}

export async function markCrmOpportunityWon({propertyId,opportunityId,reservation}){
  if(!opportunityId||!reservation?.id)return
  const{error}=await supabase.from("hotel_crm_opportunities").update({stage:"won",reservation_id:Number(reservation.id),next_follow_up_at:null}).eq("id",opportunityId).eq("property_id",propertyId)
  if(error)throw error
  await supabase.rpc("hl_crm_log_activity_atomic",{p_opportunity_id:opportunityId,p_activity_type:"reservation",p_summary:`Convertida en reserva ${reservation.numero_reserva||reservation.id}.`,p_channel:null,p_metadata:{reservation_id:reservation.id,reservation_number:reservation.numero_reserva||null}})
}
