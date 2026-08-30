import{ supabase }from"../../../lib/supabase"
import{ requirePropertyId }from"../data/tenant"
import{ addDays,isoDate }from"../core/formatters"

const tenant=id=>requirePropertyId(id)

export async function saveRateCell({propertyId,draft}){
  const row={property_id:tenant(propertyId),habitacion_id:Number(draft.habitacion_id),stay_date:draft.stay_date,price:Math.max(0,Number(draft.price||0)),min_stay:Math.max(1,Number(draft.min_stay||1)),stop_sell:!!draft.stop_sell,closed_to_arrival:!!draft.closed_to_arrival,closed_to_departure:!!draft.closed_to_departure,notes:draft.notes||null,updated_at:new Date().toISOString()}
  if(!row.habitacion_id||!row.stay_date)throw new Error("Falta habitación o fecha tarifaria.")
  const{error}=await supabase.from("hotel_rate_calendar").upsert(row,{onConflict:"property_id,habitacion_id,stay_date"});if(error)throw error
}

export async function saveRateRange({propertyId,roomId,start,end,price,minStay=1,stopSell=false,cta=false,ctd=false,existingRates=[],fallbackPrice=0}){
  const property=tenant(propertyId);if(!roomId||!start||!end||end<start)throw new Error("Revisá habitación y rango de fechas.")
  const map=new Map(existingRates.map(r=>[`${r.habitacion_id}:${r.stay_date}`,r])),rows=[];let day=start,guard=0
  while(day<=end&&guard<366){const current=map.get(`${roomId}:${day}`);rows.push({property_id:property,habitacion_id:Number(roomId),stay_date:day,price:price===""||price==null?Number(current?.price??fallbackPrice):Math.max(0,Number(price)),min_stay:Math.max(1,Number(minStay||1)),stop_sell:!!stopSell,closed_to_arrival:!!cta,closed_to_departure:!!ctd,notes:current?.notes||null,updated_at:new Date().toISOString()});day=addDays(day,1);guard++}
  if(!rows.length)throw new Error("No hay días para actualizar.")
  const{error}=await supabase.from("hotel_rate_calendar").upsert(rows,{onConflict:"property_id,habitacion_id,stay_date"});if(error)throw error;return rows.length
}

export async function savePartner({propertyId,draft}){
  const property=tenant(propertyId),row={property_id:property,kind:draft.kind||"company",name:String(draft.name||"").trim(),tax_id:draft.tax_id||null,contact_name:draft.contact_name||null,email:draft.email||null,phone:draft.phone||null,commission_percent:Math.max(0,Number(draft.commission_percent||0)),credit_limit:Math.max(0,Number(draft.credit_limit||0)),billing_terms:draft.billing_terms||null,negotiated_rate_label:draft.negotiated_rate_label||null,notes:draft.notes||null,active:draft.active!==false,updated_at:new Date().toISOString()}
  if(!row.name)throw new Error("La empresa o agencia necesita un nombre.")
  const query=draft.id?supabase.from("hotel_partners").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("hotel_partners").insert(row);const{error}=await query;if(error)throw error
}

export async function saveGroup({propertyId,draft}){
  const property=tenant(propertyId),row={property_id:property,partner_id:draft.partner_id||null,name:String(draft.name||"").trim(),code:draft.code||null,kind:draft.kind||"group",status:draft.status||"tentative",arrival_date:draft.arrival_date||null,departure_date:draft.departure_date||null,contact_name:draft.contact_name||null,contact_email:draft.contact_email||null,contact_phone:draft.contact_phone||null,room_block:Math.max(0,Number(draft.room_block||0)),billing_mode:draft.billing_mode||"individual",notes:draft.notes||null,updated_at:new Date().toISOString()}
  if(!row.name)throw new Error("El grupo necesita un nombre.");if(row.arrival_date&&row.departure_date&&row.departure_date<=row.arrival_date)throw new Error("La salida del grupo debe ser posterior a la llegada.")
  const query=draft.id?supabase.from("hotel_groups").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("hotel_groups").insert(row);const{error}=await query;if(error)throw error
}

export async function saveUpsell({propertyId,draft}){
  const property=tenant(propertyId),row={property_id:property,category:draft.category||"extra",name:String(draft.name||"").trim(),description:draft.description||null,price:Math.max(0,Number(draft.price||0)),charge_mode:draft.charge_mode||"per_stay",active:draft.active!==false,available_from:draft.available_from||null,available_to:draft.available_to||null,inventory_limit:draft.inventory_limit===""||draft.inventory_limit==null?null:Math.max(0,Number(draft.inventory_limit)),audience:draft.audience||{},sort_order:Number(draft.sort_order||0),updated_at:new Date().toISOString()}
  if(!row.name)throw new Error("El upsell necesita un nombre.")
  const query=draft.id?supabase.from("hotel_upsell_catalog").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("hotel_upsell_catalog").insert(row);const{error}=await query;if(error)throw error
}

export async function prepareChannel({propertyId,provider}){
  const property=tenant(propertyId),native=provider==="Motor directo",row={property_id:property,provider,status:native?"connected":"sandbox",mode:native?"production":"sandbox",account_ref:native?"native":"credentials-required",mapping:{},last_error:null,updated_at:new Date().toISOString()}
  const{error}=await supabase.from("hotel_channel_connections").upsert(row,{onConflict:"property_id,provider"});if(error)throw error;return row
}

export function revenueSnapshot({rooms=[],reservations=[],days=30,start=isoDate()}){
  const active=rooms.filter(r=>r.activa!==false&&!['mantenimiento','fuera_servicio'].includes(String(r.estado||'').toLowerCase())),end=addDays(start,days),live=reservations.filter(r=>r.estado!=="cancelada"&&!r.no_show&&r.fecha_salida>start&&r.fecha_entrada<end),availableNights=active.length*days
  let soldNights=0,revenue=0
  for(const r of live){const from=r.fecha_entrada<start?start:r.fecha_entrada,to=r.fecha_salida>end?end:r.fecha_salida;const nights=Math.max(0,Math.round((new Date(`${to}T12:00:00`)-new Date(`${from}T12:00:00`))/86400000));soldNights+=nights;const full=Math.max(1,Number(r.noches||Math.round((new Date(`${r.fecha_salida}T12:00:00`)-new Date(`${r.fecha_entrada}T12:00:00`))/86400000)));revenue+=Number(r.precio_total||0)*(nights/full)}
  const occupancy=availableNights?Math.round(soldNights/availableNights*100):0,adr=soldNights?revenue/soldNights:0,revpar=availableNights?revenue/availableNights:0,created7=reservations.filter(r=>r.created_at&&new Date(r.created_at)>=new Date(Date.now()-7*86400000)&&r.estado!=="cancelada").length
  return{occupancy,adr,revpar,revenue,soldNights,availableNights,pickup7:created7}
}
