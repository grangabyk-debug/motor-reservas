import{defaultRatePlan,legacyRegimenForPlan,normalizeRatePlans,ratePlanAmounts,ratePlanBasis,ratePlanByCode,ratePlanSignedAdjustment}from"../../core/ratePlans"
import{normalizeTaxSettings}from"../../core/priceTax"

const num=value=>Number.isFinite(Number(value))?Number(value):0
const round=value=>Math.round(num(value)*100)/100
const day=value=>String(value||"").slice(0,10)
const nights=(detail,item)=>{const explicit=Number(detail?.noches);if(Number.isFinite(explicit)&&explicit>0)return explicit;const start=day(detail?.fecha_entrada||item?.fecha_entrada),end=day(detail?.fecha_salida||item?.fecha_salida);if(!start||!end)return 1;return Math.max(1,Math.round((new Date(end+"T12:00:00")-new Date(start+"T12:00:00"))/86400000))}

export function editRoomBaseRate(detail,room,item){
  const explicit=Number(detail?.tarifa_base_noche)
  if(Number.isFinite(explicit)&&explicit>=0)return explicit
  const effective=Math.max(0,num(detail?.tarifa_noche??room?.pricing_net??room?.precio??item?.tarifa_noche))
  const booked=num(detail?.rate_plan_adjustment_booked_per_night)
  return Math.max(0,round(effective-booked))
}

export function editPricingContext(settings,item){
  const ratePlans=normalizeRatePlans(settings?.rate_plans||{})
  const taxes=normalizeTaxSettings(settings?.taxes||{enabled:item?.impuestos_desglosados!==false,vat_rate:num(item?.iva_porcentaje),price_tax_mode:"tax_included"})
  return{ratePlans,taxes,defaultCode:defaultRatePlan(ratePlans).code}
}

export function effectiveEditRoomRate({assignment,room,ratePlans,taxes,defaultCode}){
  const code=assignment?.ratePlanCode||defaultCode
  const selected=ratePlanByCode(ratePlans,code)
  const plan=selected?.active?selected:defaultRatePlan(ratePlans)
  const guests=Math.max(1,num(assignment?.guests)||1)
  const base=Math.max(0,num(assignment?.rate??room?.pricing_net??room?.precio))
  return round(Math.max(0,base+ratePlanAmounts(plan,guests,taxes,1).netPerNight))
}

export function pricedEditDetail({previous={},room,assignment,ratePlans,taxes,defaultCode,item}){
  const selected=ratePlanByCode(ratePlans,assignment?.ratePlanCode||previous?.rate_plan_code||defaultCode)
  const plan=selected?.active?selected:defaultRatePlan(ratePlans),guests=Math.max(1,num(assignment?.guests)||1)
  const base=Math.max(0,num(assignment?.rate??editRoomBaseRate(previous,room,item)))
  const amounts=ratePlanAmounts(plan,guests,taxes,1),effective=round(Math.max(0,base+amounts.netPerNight)),basis=ratePlanBasis(plan),signed=ratePlanSignedAdjustment(plan)
  const extensionNights=Math.max(0,num(previous?.extension_nights))
  return{
    ...previous,
    habitacion_id:Number(room.id),
    nombre:room.nombre,
    categoria_asignada:room.tipo||"Habitación",
    categoria_vendida:assignment?.soldAs||room.tipo||"Habitación",
    huespedes:guests,
    tarifa_noche:effective,
    tarifa_base_noche:round(base),
    rooming:{matrimonial:Math.max(0,num(assignment?.matrimonial)),individual:Math.max(0,num(assignment?.individual))},
    rate_plan_code:plan.code,
    rate_plan_name:plan.name,
    rate_plan_meal:plan.meal_plan,
    rate_plan_regimen:legacyRegimenForPlan(plan),
    rate_plan_booked_guests:guests,
    rate_plan_adjustment_basis:basis,
    rate_plan_adjustment_configured_value:signed,
    rate_plan_adjustment_configured_per_person:basis==="per_person"?signed:0,
    rate_plan_adjustment_booked_per_person:basis==="per_person"?round(amounts.netValue):0,
    rate_plan_adjustment_final_per_person:basis==="per_person"?round(amounts.finalValue):0,
    rate_plan_adjustment_booked_per_night:round(amounts.netPerNight),
    rate_plan_adjustment_final_per_night:round(amounts.finalPerNight),
    rate_plan_snapshot:{code:plan.code,name:plan.name,meal_plan:plan.meal_plan,description:plan.description||"",booked_guests:guests,adjustment_basis:basis,adjustment_value:signed,adjustment_per_person:basis==="per_person"?signed:0,captured_at:new Date().toISOString()},
    ...(extensionNights>0?{extension_net_total:round(effective*extensionNights),rate_plan_extension_net_total:round(amounts.netPerNight*extensionNights)}:{}),
    tarifa_snapshot_at:new Date().toISOString()
  }
}

export function editStayTotal(details,item,roomIds){
  const wanted=new Set((roomIds||[]).map(String))
  return round((details||[]).filter(detail=>wanted.has(String(detail?.habitacion_id))).reduce((sum,detail)=>sum+Math.max(0,num(detail?.tarifa_noche))*nights(detail,item),0))
}

export function editRegimenSummary(details){
  const active=(details||[]).filter(detail=>!["previous_room","transient_room","cancelled_room","no_show_room"].includes(String(detail?.segment_role||"").toLowerCase()))
  const names=[...new Set(active.map(detail=>String(detail?.rate_plan_name||"").trim()).filter(Boolean))]
  if(names.length>1)return"Mixto"
  return active[0]?.rate_plan_regimen||names[0]||"Alojamiento"
}

export function editStayDelta({existingDetails,selectedRooms,assignments,ratePlans,taxes,defaultCode,item,ids}){
  const preview=(selectedRooms||[]).map(room=>{const id=String(room.id),previous=(existingDetails||[]).find(value=>String(value?.habitacion_id)===id)||{},assignment=assignments?.[id]||{};return pricedEditDetail({previous,room,assignment,ratePlans,taxes,defaultCode,item})})
  return round(editStayTotal(preview,item,ids)-editStayTotal(existingDetails,item,ids))
}
