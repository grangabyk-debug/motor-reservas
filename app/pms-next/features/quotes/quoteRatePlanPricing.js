import{activeRatePlans,configuredAmountToFinal,defaultRatePlan,ratePlanBasis,ratePlanByCode,ratePlanSignedAdjustment}from"../../core/ratePlans"

const DAY=86400000
const nights=(start,end)=>Math.max(1,Math.round((new Date(`${end}T12:00:00`)-new Date(`${start}T12:00:00`))/DAY))

export function resolveQuoteRatePlan(ratePlans,code){
  const planOptions=activeRatePlans(ratePlans),fallbackPlan=defaultRatePlan(ratePlans),requestedPlan=ratePlanByCode(ratePlans,code||fallbackPlan.code),selectedPlan=requestedPlan?.active?requestedPlan:fallbackPlan
  return{planOptions,selectedPlan}
}

export function estimateQuoteWithPlan({availability,selection,start,end,pax,selectedPlan,taxes}){
  const stayNights=nights(start,end),roomCount=Object.values(selection||{}).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0)
  const base=(availability?.types||[]).reduce((sum,type)=>{const qty=Number(selection?.[type.name])||0,rates=(type.finalRateCandidates||[]).slice(0,qty);return sum+rates.reduce((subtotal,rate)=>subtotal+(Number(rate)||0)*stayNights,0)},0)
  const units=ratePlanBasis(selectedPlan)==="per_room"?roomCount:Math.max(1,Number(pax)||1),adjustment=configuredAmountToFinal(ratePlanSignedAdjustment(selectedPlan),taxes)*units*stayNights
  return Math.max(0,base+adjustment)
}

export function buildQuoteLinesWithPlan({latest,selection,start,end,pax,selectedPlan,taxes}){
  const stayNights=nights(start,end),basis=ratePlanBasis(selectedPlan),roomCount=Object.values(selection||{}).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0)
  const roomLines=(latest?.types||[]).flatMap(type=>{
    const qty=Number(selection?.[type.name])||0
    if(!qty)return[]
    const rates=(type.rateCandidates||[]).slice(0,qty),finalRates=(type.finalRateCandidates||[]).slice(0,qty),configuredRates=(type.configuredRateCandidates||[]).slice(0,qty)
    if(rates.length<qty||finalRates.length<qty||configuredRates.length<qty)throw new Error(`Cambió la disponibilidad tarifaria de ${type.name}. Actualizá el presupuesto.`)
    const netStayTotal=rates.reduce((sum,rate)=>sum+(Number(rate)||0)*stayNights,0),finalStayTotal=finalRates.reduce((sum,rate)=>sum+(Number(rate)||0)*stayNights,0),configuredStayTotal=configuredRates.reduce((sum,rate)=>sum+(Number(rate)||0)*stayNights,0),avgNightlyNet=netStayTotal/(qty*stayNights),avgNightlyCommercial=configuredStayTotal/(qty*stayNights),avgNightlyFinal=finalStayTotal/(qty*stayNights)
    return[{category:"room",description:type.name,quantity:qty,unit_price:finalStayTotal/qty,sort_order:0,metadata:{room_type:type.name,nights:stayNights,nightly_rate:avgNightlyNet,nightly_rate_commercial:avgNightlyCommercial,nightly_rate_final:avgNightlyFinal,vat_rate:taxes.enabled?taxes.vat_rate:0,price_tax_mode:taxes.price_tax_mode,tax_included:Boolean(taxes.enabled&&taxes.price_tax_mode==="tax_included"),quoted_available:type.available,pricing_version:2,rate_plan_code:selectedPlan.code,rate_plan_name:selectedPlan.name,meal_plan:selectedPlan.meal_plan,rate_plan_adjustment_basis:basis,rate_plan_adjustment_value:ratePlanSignedAdjustment(selectedPlan)}}]
  })
  const quoteLines=[...roomLines],planUnitFinal=configuredAmountToFinal(Number(selectedPlan.adjustment_per_person)||0,taxes),planUnits=(basis==="per_room"?roomCount:Math.max(1,Number(pax)||1))*stayNights
  if(Math.abs(planUnitFinal)>0.000001)quoteLines.push({category:planUnitFinal>0?"food":"discount",description:(planUnitFinal>0?"Régimen · ":"Ajuste régimen · ")+selectedPlan.name,quantity:planUnits,unit_price:Math.abs(planUnitFinal),sort_order:roomLines.length,metadata:{rate_plan_code:selectedPlan.code,rate_plan_name:selectedPlan.name,meal_plan:selectedPlan.meal_plan,adjustment_basis:basis,per_person_per_night:basis==="per_person",per_room_per_night:basis==="per_room",price_tax_mode:taxes.enabled?taxes.price_tax_mode:"disabled",vat_rate:taxes.enabled?taxes.vat_rate:0}})
  const quoteTotal=quoteLines.reduce((sum,line)=>sum+(line.category==="discount"?-1:1)*(Number(line.quantity)||0)*(Number(line.unit_price)||0),0)
  return{quoteLines,quoteTotal}
}
