import{defaultRatePlan,legacyRegimenForPlan,normalizeRatePlans,ratePlanAmounts,ratePlanBasis,ratePlanByCode,ratePlanSignedAdjustment}from"../../core/ratePlans"
import{finalPriceFromNet,normalizeTaxSettings}from"../../core/priceTax"

const num=value=>Number.isFinite(Number(value))?Number(value):0
const round=value=>Math.round(num(value)*100)/100
const precise=value=>Math.round(num(value)*1e6)/1e6
const day=value=>String(value||"").slice(0,10)
const nextDay=value=>{const d=new Date(day(value)+"T12:00:00");d.setDate(d.getDate()+1);return d.toISOString().slice(0,10)}
const nights=(detail,item)=>{const explicit=Number(detail?.noches);if(Number.isFinite(explicit)&&explicit>0)return explicit;const start=day(detail?.fecha_entrada||item?.fecha_entrada),end=day(detail?.fecha_salida||item?.fecha_salida);if(!start||!end)return 1;return Math.max(1,Math.round((new Date(end+"T12:00:00")-new Date(start+"T12:00:00"))/86400000))}

export function editStayDateKeys(detail={},item={}){
  const start=day(detail?.fecha_entrada||item?.fecha_entrada),end=day(detail?.fecha_salida||item?.fecha_salida),out=[]
  if(!start||!end||end<=start)return out
  for(let cursor=start;cursor<end;cursor=nextDay(cursor))out.push(cursor)
  return out
}

export function editRoomBaseRate(detail,room,item){
  const explicit=Number(detail?.tarifa_base_noche)
  if(Number.isFinite(explicit)&&explicit>=0)return explicit
  const effective=Math.max(0,num(detail?.tarifa_noche??room?.pricing_net??room?.precio??item?.tarifa_noche))
  const booked=num(detail?.rate_plan_adjustment_booked_per_night)
  return Math.max(0,round(effective-booked))
}

export function editRoomBaseRateForDate(detail,date,fallback=0){
  const key=day(date),rates=Array.isArray(detail?.tarifas_por_noche)?detail.tarifas_por_noche:[],scheduled=rates.find(entry=>day(entry?.fecha||entry?.stay_date)===key)
  const scheduledNet=Number(scheduled?.tarifa_neta??scheduled?.price??scheduled?.tarifa)
  if(Number.isFinite(scheduledNet)&&scheduledNet>=0)return precise(scheduledNet)
  const occupancy=Array.isArray(detail?.occupancy_nights)?detail.occupancy_nights:[],stored=occupancy.find(entry=>day(entry?.date)===key)
  const storedNet=Number(stored?.net_rate),storedAdjustment=Number(stored?.adjustment_net)
  if(Number.isFinite(storedNet)&&Number.isFinite(storedAdjustment))return precise(Math.max(0,storedNet-storedAdjustment))
  return precise(Math.max(0,num(fallback)))
}

export function editPricingContext(settings,item){
  const ratePlans=normalizeRatePlans(settings?.rate_plans||{})
  const taxes=normalizeTaxSettings(settings?.taxes||{enabled:item?.impuestos_desglosados!==false,vat_rate:num(item?.iva_porcentaje),price_tax_mode:"tax_included"})
  return{ratePlans,taxes,defaultCode:defaultRatePlan(ratePlans).code}
}

export function effectiveEditRoomRate({assignment,room,ratePlans,taxes,defaultCode,detail=null,date=""}){
  const code=assignment?.ratePlanCode||defaultCode
  const selected=ratePlanByCode(ratePlans,code)
  const plan=selected?.active?selected:defaultRatePlan(ratePlans)
  const guests=Math.max(1,num(assignment?.guests)||1)
  const fallback=Math.max(0,num(assignment?.rate??room?.pricing_net??room?.precio))
  const base=detail&&date?editRoomBaseRateForDate(detail,date,fallback):fallback
  return precise(Math.max(0,base+ratePlanAmounts(plan,guests,taxes,1).netPerNight))
}

function nightConfig(value,guests,planCode){
  if(value&&typeof value==="object")return{guests:Math.max(1,num(value.guests)||guests),ratePlanCode:String(value.ratePlanCode||value.rate_plan_code||planCode||"")}
  return{guests:Math.max(1,num(value)||guests),ratePlanCode:String(planCode||"")}
}
function occupancySegments(nightly=[]){
  const segments=[]
  for(const night of nightly){
    const last=segments[segments.length-1]
    if(last&&last.guests===night.guests&&last.rate_plan_code===night.rate_plan_code&&last.to===night.date){last.to=nextDay(night.date);last.nights+=1;last.net_total=round(last.net_total+night.net_rate);last.final_total=round(last.final_total+night.final_rate);continue}
    segments.push({from:night.date,to:nextDay(night.date),guests:night.guests,rate_plan_code:night.rate_plan_code,rate_plan_name:night.rate_plan_name,nights:1,net_total:night.net_rate,final_total:night.final_rate})
  }
  return segments
}

export function pricedEditDetail({previous={},room,assignment,ratePlans,taxes,defaultCode,item,occupancyByDate=null}){
  const selected=ratePlanByCode(ratePlans,assignment?.ratePlanCode||previous?.rate_plan_code||defaultCode)
  const plan=selected?.active?selected:defaultRatePlan(ratePlans),baseGuests=Math.max(1,num(assignment?.guests)||1)
  const otaContractual=previous?.pricing_origin==="ota_contractual"||previous?.ota_contractual_price===true
  if(otaContractual){
    const dates=editStayDateKeys(previous,item),current=Math.max(0,num(previous?.ota_contractual_net_night??previous?.tarifa_noche??assignment?.rate)),existing=Array.isArray(previous?.occupancy_nights)?previous.occupancy_nights:[],nightly=dates.map(date=>{const old=existing.find(n=>day(n?.date)===date)||{},net=Number.isFinite(Number(old?.net_rate))?Math.max(0,Number(old.net_rate)):current;return{...old,date,guests:Math.max(1,num(occupancyByDate?.[date]?.guests)||baseGuests),base_net:net,base_final:finalPriceFromNet(net,taxes),net_rate:net,final_rate:finalPriceFromNet(net,taxes),adjustment_net:0,adjustment_final:0,rate_plan_code:plan.code,rate_plan_name:plan.name,rate_plan_meal:plan.meal_plan,rate_plan_regimen:legacyRegimenForPlan(plan),rate_plan_basis:ratePlanBasis(plan),rate_plan_adjustment_value:0,pricing_origin:"ota_contractual"}}),stayNet=round(nightly.reduce((sum,n)=>sum+n.net_rate,0)),effective=nightly.length?round(stayNet/nightly.length):current
    return{...previous,habitacion_id:Number(room.id),nombre:room.nombre,categoria_asignada:room.tipo||"Habitación",categoria_vendida:assignment?.soldAs||room.tipo||"Habitación",huespedes:baseGuests,tarifa_noche:effective,tarifa_base_noche:effective,rooming:{matrimonial:Math.max(0,num(assignment?.matrimonial)),individual:Math.max(0,num(assignment?.individual))},pricing_origin:"ota_contractual",ota_contractual_price:true,ota_contractual_net_night:current,rate_plan_code:plan.code,rate_plan_name:plan.name,rate_plan_meal:plan.meal_plan,rate_plan_regimen:legacyRegimenForPlan(plan),rate_plan_variable:false,rate_plan_booked_guests:baseGuests,rate_plan_adjustment_basis:ratePlanBasis(plan),rate_plan_adjustment_configured_value:ratePlanSignedAdjustment(plan),rate_plan_adjustment_configured_per_person:ratePlanBasis(plan)==="per_person"?ratePlanSignedAdjustment(plan):0,rate_plan_adjustment_booked_per_person:0,rate_plan_adjustment_final_per_person:0,rate_plan_adjustment_booked_per_night:0,rate_plan_adjustment_final_per_night:0,rate_plan_snapshot:{code:plan.code,name:plan.name,meal_plan:plan.meal_plan,description:plan.description||"",booked_guests:baseGuests,pricing_policy:"ota_contractual",captured_at:new Date().toISOString()},occupancy_nights:nightly.length?nightly:null,occupancy_segments:nightly.length?occupancySegments(nightly):null,variable_occupancy:false,stay_net_total:nightly.length?stayNet:round(effective*nights(previous,item)),tarifa_snapshot_at:new Date().toISOString()}
  }
  const base=Math.max(0,num(assignment?.rate??editRoomBaseRate(previous,room,item))),basis=ratePlanBasis(plan),signed=ratePlanSignedAdjustment(plan)
  const dates=editStayDateKeys(previous,item),hasCustom=occupancyByDate&&dates.length>0
  const nightly=hasCustom?dates.map(date=>{
    const config=nightConfig(occupancyByDate?.[date],baseGuests,plan.code),nightSelected=ratePlanByCode(ratePlans,config.ratePlanCode),nightPlan=nightSelected?.active?nightSelected:plan,amounts=ratePlanAmounts(nightPlan,config.guests,taxes,1),dateBase=editRoomBaseRateForDate(previous,date,base),netRate=precise(Math.max(0,dateBase+amounts.netPerNight))
    return{date,guests:config.guests,base_net:dateBase,base_final:finalPriceFromNet(dateBase,taxes),net_rate:netRate,final_rate:finalPriceFromNet(netRate,taxes),adjustment_net:precise(amounts.netPerNight),adjustment_final:round(amounts.finalPerNight),rate_plan_code:nightPlan.code,rate_plan_name:nightPlan.name,rate_plan_meal:nightPlan.meal_plan,rate_plan_regimen:legacyRegimenForPlan(nightPlan),rate_plan_basis:ratePlanBasis(nightPlan),rate_plan_adjustment_value:ratePlanSignedAdjustment(nightPlan)}
  }):[]
  const maxGuests=nightly.length?Math.max(...nightly.map(n=>n.guests)):baseGuests
  const amounts=ratePlanAmounts(plan,maxGuests,taxes,1),stayNet=nightly.length?round(nightly.reduce((sum,n)=>sum+n.net_rate,0)):null
  const effective=nightly.length?round(stayNet/nightly.length):round(Math.max(0,base+amounts.netPerNight))
  const avgAdjNet=nightly.length?round(nightly.reduce((sum,n)=>sum+n.adjustment_net,0)/nightly.length):round(amounts.netPerNight)
  const avgAdjFinal=nightly.length?round(nightly.reduce((sum,n)=>sum+n.adjustment_final,0)/nightly.length):round(amounts.finalPerNight)
  const segments=nightly.length?occupancySegments(nightly):null,variable=Boolean(segments&&new Set(nightly.map(n=>n.guests)).size>1),variablePlan=Boolean(nightly.length&&new Set(nightly.map(n=>n.rate_plan_code)).size>1),displayPlanName=variablePlan?"Régimen variable":plan.name,displayRegimen=variablePlan?"Mixto":legacyRegimenForPlan(plan)
  const extensionFrom=day(previous?.extension_from),extensionNights=Math.max(0,num(previous?.extension_nights))
  const extensionNightly=nightly.length&&extensionFrom?nightly.filter(n=>n.date>=extensionFrom):[]
  return{
    ...previous,
    habitacion_id:Number(room.id),nombre:room.nombre,categoria_asignada:room.tipo||"Habitación",categoria_vendida:assignment?.soldAs||room.tipo||"Habitación",
    huespedes:maxGuests,tarifa_noche:effective,tarifa_base_noche:round(base),
    rooming:{matrimonial:Math.max(0,num(assignment?.matrimonial)),individual:Math.max(0,num(assignment?.individual))},
    rate_plan_code:plan.code,rate_plan_name:displayPlanName,rate_plan_meal:variablePlan?"variable":plan.meal_plan,rate_plan_regimen:displayRegimen,rate_plan_variable:variablePlan,
    rate_plan_booked_guests:maxGuests,rate_plan_adjustment_basis:basis,rate_plan_adjustment_configured_value:signed,
    rate_plan_adjustment_configured_per_person:basis==="per_person"?signed:0,
    rate_plan_adjustment_booked_per_person:basis==="per_person"?precise(amounts.netValue):0,
    rate_plan_adjustment_final_per_person:basis==="per_person"?round(amounts.finalValue):0,
    rate_plan_adjustment_booked_per_night:nightly.length?precise(nightly.reduce((sum,n)=>sum+n.adjustment_net,0)/nightly.length):precise(amounts.netPerNight),rate_plan_adjustment_final_per_night:avgAdjFinal,
    rate_plan_snapshot:{code:plan.code,name:displayPlanName,meal_plan:variablePlan?"variable":plan.meal_plan,description:variablePlan?"El régimen cambia según la noche.":plan.description||"",booked_guests:maxGuests,adjustment_basis:variablePlan?"variable":basis,adjustment_value:variablePlan?0:signed,adjustment_per_person:variablePlan?0:basis==="per_person"?signed:0,variable_by_night:variablePlan,captured_at:new Date().toISOString()},
    occupancy_nights:nightly.length?nightly:null,occupancy_segments:segments,variable_occupancy:variable,stay_net_total:nightly.length?stayNet:null,
    ...(extensionNights>0?{extension_net_total:nightly.length&&extensionNightly.length?round(extensionNightly.reduce((sum,n)=>sum+n.net_rate,0)):round(effective*extensionNights),rate_plan_extension_net_total:nightly.length&&extensionNightly.length?round(extensionNightly.reduce((sum,n)=>sum+n.adjustment_net,0)):round(avgAdjNet*extensionNights)}:{}),
    tarifa_snapshot_at:new Date().toISOString()
  }
}

export function editStayTotal(details,item,roomIds){
  const wanted=new Set((roomIds||[]).map(String))
  return round((details||[]).filter(detail=>wanted.has(String(detail?.habitacion_id))).reduce((sum,detail)=>{
    const explicit=Number(detail?.stay_net_total),expected=nights(detail,item),covered=Array.isArray(detail?.occupancy_nights)?detail.occupancy_nights.length:0
    return sum+(Number.isFinite(explicit)&&covered===expected?Math.max(0,explicit):Math.max(0,num(detail?.tarifa_noche))*expected)
  },0))
}

export function editRegimenSummary(details){
  const active=(details||[]).filter(detail=>!["previous_room","transient_room","cancelled_room","no_show_room"].includes(String(detail?.segment_role||"").toLowerCase()))
  if(active.some(detail=>detail?.rate_plan_variable))return"Mixto"
  const names=[...new Set(active.map(detail=>String(detail?.rate_plan_name||"").trim()).filter(Boolean))]
  if(names.length>1)return"Mixto"
  return active[0]?.rate_plan_regimen||names[0]||"Alojamiento"
}

export function editStayDelta({existingDetails,selectedRooms,assignments,occupancyByRoom,ratePlans,taxes,defaultCode,item,ids}){
  const preview=(selectedRooms||[]).map(room=>{const id=String(room.id),previous=(existingDetails||[]).find(value=>String(value?.habitacion_id)===id)||{},assignment=assignments?.[id]||{};return pricedEditDetail({previous,room,assignment,ratePlans,taxes,defaultCode,item,occupancyByDate:occupancyByRoom?.[id]||null})})
  return round(editStayTotal(preview,item,ids)-editStayTotal(existingDetails,item,ids))
}

export function editPlanSummary(details,fallback="Alojamiento"){
  const active=(details||[]).filter(detail=>detail?.rate_plan_code&&String(detail?.segment_role||"active_room").toLowerCase()!=="previous_room")
  const names=[...new Set(active.map(detail=>detail.rate_plan_name||detail.rate_plan_regimen).filter(Boolean))]
  return{hasRatePlanSnapshot:names.length>0,planSummary:active.some(detail=>detail?.rate_plan_variable)||names.length>1?"Mixto":names[0]||fallback}
}
