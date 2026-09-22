import{supabase}from"../../../../lib/supabase"
import{markCrmOpportunityWon}from"../crm/crmReservationSeed"

export async function finalizeReservationConversions({propertyId,draft,reservation}){
  const quoteId=draft?.quoteId
  if(quoteId){
    const{error}=await supabase.rpc("hl_group_mark_quote_atomic",{p_property_id:propertyId,p_quote_id:quoteId,p_status:"accepted"})
    if(error&&typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{tone:"warning",title:"Reserva creada",message:"La reserva quedó creada, pero el presupuesto no pudo marcarse como aceptado automáticamente."}}))
  }
  if(draft?.crmOpportunityId){
    try{await markCrmOpportunityWon({propertyId,opportunityId:draft.crmOpportunityId,reservation})}
    catch{if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{tone:"warning",title:"Reserva creada",message:"La reserva quedó creada, pero no pudimos cerrar automáticamente la oportunidad CRM."}}))}
  }
}
