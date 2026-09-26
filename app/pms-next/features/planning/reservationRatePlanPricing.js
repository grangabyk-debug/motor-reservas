import{supabase}from"../../../../lib/supabase"
import{normalizeTaxSettings,roundInternalPrice}from"../../core/priceTax"
import{pricingRoomsById,resolvePricingQuote}from"../../core/pricingContract"
import{defaultRatePlan,legacyRegimenForPlan,netAmountToFinal,normalizeRatePlans,ratePlanAmounts,ratePlanByCode}from"../../core/ratePlans"

const DAY=86400000
const nightsBetween=(start,end)=>Math.max(1,Math.round((new Date(`${end}T12:00:00`)-new Date(`${start}T12:00:00`))/DAY))

export default async function resolveReservationRatePlanPricing({propertyId,draft,roomIds,selectedRooms,maintenanceByRoom}){
  const roomAssignments=draft.roomAssignments||{},nights=nightsBetween(draft.start,draft.end)
  const[resolvedPricing,settingsRes]=await Promise.all([
    resolvePricingQuote({propertyId,start:draft.start,end:draft.end,roomIds,reservationCurrency:draft.currency||null}),
    supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
  ])
  if(settingsRes.error)throw settingsRes.error
  const resolvedByRoom=pricingRoomsById(resolvedPricing)
  const groupTaxes=normalizeTaxSettings({enabled:resolvedPricing.taxes_enabled,vat_rate:resolvedPricing.vat_rate,price_tax_mode:resolvedPricing.tax_mode})
  const ratePlanConfig=normalizeRatePlans(settingsRes.data?.settings||{}),fallbackPlan=defaultRatePlan(ratePlanConfig),pricing=new Map()
  for(const room of selectedRooms){
    const assignment=roomAssignments[String(room.id)]||{},soldAs=String(assignment.soldAs||room.tipo||"Habitación").trim(),manual=assignment.manualRate===true,guestCount=Math.max(0,Number(assignment.guests)||0),requestedPlanCode=String(assignment.ratePlanCode||draft.ratePlanCode||fallbackPlan.code).toUpperCase(),plan=ratePlanByCode(ratePlanConfig,requestedPlanCode)
    if(!plan?.active)throw new Error("El plan tarifario "+requestedPlanCode+" ya no está activo. Elegí otro antes de crear la reserva.")
    let baseRate=0,baseTotal=0,source="central_pricing",pricingVersion=2
    if(manual){baseRate=Math.max(0,Number(assignment.rate)||0);baseTotal=roundInternalPrice(baseRate*nights);source="manual";pricingVersion=null}
    else{
      if(soldAs!==String(room.tipo||"Habitación").trim())throw new Error(`La categoría vendida ${soldAs} no coincide con la habitación ${room.nombre}. Revalidá la tarifa antes de crear la reserva.`)
      const quote=resolvedByRoom.get(Number(room.id))
      if(!quote?.is_complete)throw new Error(`Falta configurar una tarifa de calendario para ${room.nombre} en alguna noche del rango. Revisá Tarifas y disponibilidad.`)
      baseRate=Number(quote.average_net)||0;baseTotal=Number(quote.total_net)||0;source=quote.rate_source||"central_pricing"
    }
    const amounts=ratePlanAmounts(plan,guestCount,groupTaxes,1),requestedPlanNightly=amounts.netPerNight,effectiveRate=Math.max(0,baseRate+requestedPlanNightly),actualPlanNightly=effectiveRate-baseRate,bookedPerNight=actualPlanNightly,finalPerNight=netAmountToFinal(bookedPerNight,groupTaxes),bookedPerPerson=amounts.basis==="per_person"&&guestCount?bookedPerNight/guestCount:0,finalPerPerson=amounts.basis==="per_person"&&guestCount?finalPerNight/guestCount:0,effectiveTotal=Math.max(0,baseTotal+actualPlanNightly*nights)
    pricing.set(Number(room.id),{rate:roundInternalPrice(effectiveRate),total:roundInternalPrice(effectiveTotal),baseRate:roundInternalPrice(baseRate),source,category:soldAs,pricingVersion,plan,adjustmentBasis:amounts.basis,configuredValue:amounts.configuredValue,bookedPerNight,finalPerNight,bookedPerPerson,finalPerPerson})
  }
  const requestedGuests=Math.max(1,Number(draft.guests)||1)
  const details=selectedRooms.map(room=>{const assignment=roomAssignments[String(room.id)]||{},resolved=pricing.get(Number(room.id)),soldAs=String(assignment.soldAs||room.tipo||"Habitación").trim(),maintenanceBlock=maintenanceByRoom.get(String(room.id)),guestCount=Math.max(0,Number(assignment.guests)||0);return{habitacion_id:Number(room.id),nombre:room.nombre,categoria_asignada:room.tipo||"Habitación",categoria_vendida:soldAs,huespedes:guestCount,tarifa_noche:resolved.rate,tarifa_base_noche:resolved.baseRate,tarifa_fuente:resolved.source,tarifa_categoria:resolved.category,tarifa_manual:resolved.source==="manual",fecha_entrada:draft.start,fecha_salida:draft.end,rooming:{matrimonial:Math.max(0,Number(assignment.matrimonial)||0),individual:Math.max(0,Number(assignment.individual)||0)},rate_plan_code:resolved.plan.code,rate_plan_name:resolved.plan.name,rate_plan_meal:resolved.plan.meal_plan,rate_plan_regimen:legacyRegimenForPlan(resolved.plan),rate_plan_adjustment_basis:resolved.adjustmentBasis,rate_plan_adjustment_configured_value:resolved.configuredValue,rate_plan_adjustment_booked_per_night:resolved.bookedPerNight,rate_plan_adjustment_final_per_night:resolved.finalPerNight,rate_plan_adjustment_configured_per_person:resolved.adjustmentBasis==="per_person"?resolved.configuredValue:0,rate_plan_adjustment_booked_per_person:resolved.bookedPerPerson,rate_plan_adjustment_final_per_person:resolved.finalPerPerson,rate_plan_booked_guests:guestCount,rate_plan_snapshot:{code:resolved.plan.code,name:resolved.plan.name,meal_plan:resolved.plan.meal_plan,description:resolved.plan.description||"",adjustment_basis:resolved.adjustmentBasis,adjustment_value:resolved.configuredValue,adjustment_per_person:resolved.adjustmentBasis==="per_person"?resolved.configuredValue:0,booked_guests:guestCount,captured_at:new Date().toISOString()},...(maintenanceBlock?{maintenance_checkout_ack:true,maintenance_checkout_block_id:Number(maintenanceBlock.id),maintenance_checkout_date:draft.end,maintenance_checkout_ack_at:new Date().toISOString()}: {})}})
  const assignedGuests=details.reduce((sum,item)=>sum+item.huespedes,0)
  if(assignedGuests!==requestedGuests)throw new Error(`Distribuí los ${requestedGuests} huésped${requestedGuests===1?"":"es"} entre las habitaciones seleccionadas antes de crear la reserva.`)
  const regimenLabels=[...new Set(details.map(detail=>detail.rate_plan_regimen).filter(Boolean))]
  return{resolvedPricing,groupTaxes,pricing,details,requestedGuests,regimen:regimenLabels.length===1?regimenLabels[0]:"Mixto"}
}
