import{supabase}from"../../../../lib/supabase"
import{addDays,freshForm}from"./quoteUtils"

export const crmQuoteSeedKey=propertyId=>propertyId?`hl:pms-next:crm-quote-seed:${propertyId}`:""

export function consumeCrmQuoteSeed({propertyId,currency}){
  if(typeof window==="undefined")return null
  const key=crmQuoteSeedKey(propertyId);if(!key)return null
  let seed=null
  try{const raw=localStorage.getItem(key);if(!raw)return null;seed=JSON.parse(raw);localStorage.removeItem(key)}catch{return null}
  const base=freshForm(seed.currency||currency),start=seed.start||base.start,end=seed.end&&seed.end>start?seed.end:addDays(start,1)
  return{...base,name:seed.name||"",email:seed.email||"",phone:seed.phone||"",start,end,pax:Math.max(1,Number(seed.pax)||1),currency:seed.currency||currency,notes:seed.notes||"",crmOpportunityId:seed.opportunityId||"",selection:{}}
}

export async function createCrmWaitlistFromQuote({propertyId,form,currency}){
  const payload={property_id:propertyId,stage:"waitlist",priority:"normal",name:form.name.trim(),email:form.email.trim()||null,phone:form.phone.trim()||null,source_channel:"direct",desired_check_in:form.start,desired_check_out:form.end,adults:Math.max(1,Number(form.pax)||1),children:0,rooms_count:1,preferred_room_type:null,alternative_room_types:[],flexible_dates:false,flexibility_days:0,max_budget:null,currency:form.currency||currency,waitlist_until:form.validUntil||null,notes:form.notes.trim()||"Consulta sin disponibilidad creada desde Presupuestos."}
  const{data,error}=await supabase.from("hotel_crm_opportunities").insert(payload).select("id").single();if(error)throw error
  await supabase.rpc("hl_crm_log_activity_atomic",{p_opportunity_id:data.id,p_activity_type:"system",p_summary:"Agregada a Lista de espera desde Presupuestos por falta de disponibilidad.",p_channel:null,p_metadata:{source:"quotes"}})
  return data.id
}

export async function linkQuoteToCrm({propertyId,opportunityId,quote}){
  if(!opportunityId)return
  const{error}=await supabase.from("hotel_crm_opportunities").update({stage:"quote_sent",quote_id:quote.id}).eq("id",opportunityId).eq("property_id",propertyId)
  if(error)return
  await supabase.rpc("hl_crm_log_activity_atomic",{p_opportunity_id:opportunityId,p_activity_type:"quote",p_summary:`Presupuesto ${quote.quote_number} creado desde CRM.`,p_channel:null,p_metadata:{quote_id:quote.id,quote_number:quote.quote_number}})
}

export async function closeCrmFromRejectedQuote({propertyId,quoteId}){
  const{data}=await supabase.from("hotel_crm_opportunities").update({stage:"lost",lost_reason:"Presupuesto cancelado",next_follow_up_at:null}).eq("property_id",propertyId).eq("quote_id",quoteId).not("stage","eq","won").select("id")
  for(const row of data||[])await supabase.rpc("hl_crm_log_activity_atomic",{p_opportunity_id:row.id,p_activity_type:"stage",p_summary:"Oportunidad perdida: presupuesto cancelado.",p_channel:null,p_metadata:{quote_id:quoteId}})
}
