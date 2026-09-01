import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"

const clean=value=>String(value??"").trim()
const slug=value=>clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")
const num=value=>Math.max(0,Number(value||0))
const safeArray=value=>Array.isArray(value)?value:[]
const isParkingLine=item=>item?.resource_category==="parking"||item?.kind==="parking"
const lineTotal=item=>Number(item?.total??item?.amount??0)||0

export function packagePriceLabel(item){
  const value=Number(item?.price||0)
  if(item?.pricing_mode==="discount_percent")return`${value}% de descuento`
  if(item?.pricing_mode==="discount_amount")return`$ ${value.toLocaleString("es-AR")} de descuento`
  if(item?.pricing_mode==="nightly_rate")return`$ ${value.toLocaleString("es-AR")} / noche`
  return`$ ${value.toLocaleString("es-AR")} total`
}

export async function savePackage({propertyId,userId,draft}){
  const property=requirePropertyId(propertyId),name=clean(draft.name),code=slug(draft.code||name)||null,items=safeArray(draft.included_items).map(item=>typeof item==="string"?clean(item):clean(item?.name)).filter(Boolean)
  if(!name)throw new Error("El pack necesita un nombre.")
  if(draft.valid_from&&draft.valid_to&&draft.valid_to<draft.valid_from)throw new Error("La vigencia del pack no es válida.")
  const row={property_id:property,name,code,description:clean(draft.description)||null,room_type:clean(draft.room_type)||null,meal_plan:clean(draft.meal_plan)||null,min_nights:Math.max(1,Number(draft.min_nights||1)),valid_from:draft.valid_from||null,valid_to:draft.valid_to||null,pricing_mode:draft.pricing_mode||"fixed_total",price:num(draft.price),currency:draft.currency||"ARS",included_items:items,active:draft.active!==false,sort_order:Number(draft.sort_order||0),updated_at:new Date().toISOString()}
  if(!draft.id)row.created_by=userId||null
  const query=draft.id?supabase.from("hotel_packages").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("hotel_packages").insert(row)
  const{error}=await query;if(error)throw error
}

export async function setPackageActive({propertyId,id,active}){
  const{error}=await supabase.from("hotel_packages").update({active:!!active,updated_at:new Date().toISOString()}).eq("id",id).eq("property_id",requirePropertyId(propertyId));if(error)throw error
}

export async function applyPackageToReservation({propertyId,reservationId,packageId}){
  const property=requirePropertyId(propertyId),rid=Number(reservationId)
  if(!rid||!packageId)throw new Error("Elegí una reserva y un pack.")
  const[{data:reservation,error:reservationError},{data:pack,error:packageError}]=await Promise.all([
    supabase.from("reservas").select("*").eq("id",rid).eq("property_id",property).single(),
    supabase.from("hotel_packages").select("*").eq("id",packageId).eq("property_id",property).eq("active",true).single()
  ])
  if(reservationError)throw reservationError
  if(packageError)throw packageError
  if(reservation.estado==="cancelada"||reservation.estado==="finalizada")throw new Error("Ese pack no se puede aplicar a una reserva cancelada o finalizada.")
  if(pack.currency&&reservation.moneda&&pack.currency!==reservation.moneda)throw new Error(`El pack está en ${pack.currency} y la reserva en ${reservation.moneda}. Unificá la moneda antes de aplicarlo.`)
  if(pack.valid_from&&reservation.fecha_entrada<pack.valid_from)throw new Error(`El pack entra en vigencia el ${pack.valid_from}.`)
  if(pack.valid_to&&reservation.fecha_entrada>pack.valid_to)throw new Error(`El pack venció el ${pack.valid_to}.`)
  const nights=Math.max(1,Number(reservation.noches||1))
  if(nights<Number(pack.min_nights||1))throw new Error(`Este pack requiere al menos ${pack.min_nights} noche(s).`)
  let room=null
  if(reservation.habitacion_id){const{data,error}=await supabase.from("habitaciones").select("id,nombre,tipo").eq("id",reservation.habitacion_id).eq("property_id",property).single();if(error)throw error;room=data}
  if(pack.room_type&&clean(room?.tipo).toLowerCase()!==clean(pack.room_type).toLowerCase())throw new Error(`El pack está configurado para ${pack.room_type}. La reserva está en ${room?.tipo||room?.nombre||"otra categoría"}. Cambiá la habitación y volvé a aplicarlo.`)

  const priorSnapshot=reservation.package_snapshot&&typeof reservation.package_snapshot==="object"?reservation.package_snapshot:{},currentRate=Number(priorSnapshot.original_rate??reservation.tarifa_noche??0),currentStay=currentRate*nights,price=Number(pack.price||0)
  let stayTotal=currentStay,effectiveRate=currentRate,discountAmount=0
  if(pack.pricing_mode==="fixed_total"){stayTotal=price;effectiveRate=nights?stayTotal/nights:stayTotal}
  else if(pack.pricing_mode==="nightly_rate"){effectiveRate=price;stayTotal=effectiveRate*nights}
  else if(pack.pricing_mode==="discount_percent"){discountAmount=currentStay*Math.min(100,price)/100;stayTotal=Math.max(0,currentStay-discountAmount);effectiveRate=nights?stayTotal/nights:stayTotal}
  else if(pack.pricing_mode==="discount_amount"){discountAmount=Math.min(currentStay,price);stayTotal=Math.max(0,currentStay-discountAmount);effectiveRate=nights?stayTotal/nights:stayTotal}

  const existing=safeArray(reservation.servicios).filter(item=>item?.source!=="package"),manualExtras=existing.filter(item=>!isParkingLine(item)).reduce((sum,item)=>sum+lineTotal(item),0),packageLines=safeArray(pack.included_items).map(name=>({name:clean(typeof name==="string"?name:name?.name)||"Incluido en pack",source:"package",package_id:pack.id,included:true,charge_mode:"included",quantity:1,unit_price:0,total:0})),services=[...existing,...packageLines],parking=Number(reservation.cochera_total||0),pets=Number(reservation.mascotas_total||0),total=Math.max(0,stayTotal+manualExtras+parking+pets),snapshot={id:pack.id,name:pack.name,code:pack.code||null,description:pack.description||null,room_type:pack.room_type||null,meal_plan:pack.meal_plan||null,min_nights:Number(pack.min_nights||1),valid_from:pack.valid_from||null,valid_to:pack.valid_to||null,pricing_mode:pack.pricing_mode,price:Number(pack.price||0),currency:pack.currency||reservation.moneda||"ARS",included_items:safeArray(pack.included_items),applied_at:new Date().toISOString(),applied_room_id:room?.id||reservation.habitacion_id||null,applied_arrival:reservation.fecha_entrada,applied_departure:reservation.fecha_salida,original_rate:currentRate,original_stay_total:currentStay}
  const patch={package_id:pack.id,package_snapshot:snapshot,regimen:pack.meal_plan||null,tarifa_noche:effectiveRate,servicios:services,subtotal:total,precio_total:total,descuento_tipo:pack.pricing_mode==="discount_percent"?"porcentaje":"monto",descuento_valor:pack.pricing_mode==="discount_percent"?price:pack.pricing_mode==="discount_amount"?price:0,descuento_importe:discountAmount}
  const{data,error}=await supabase.from("reservas").update(patch).eq("id",rid).eq("property_id",property).select("*").single();if(error)throw error;return data
}

export async function removePackageFromReservation({propertyId,reservationId}){
  const property=requirePropertyId(propertyId),rid=Number(reservationId),{data:reservation,error:readError}=await supabase.from("reservas").select("*").eq("id",rid).eq("property_id",property).single();if(readError)throw readError
  const snapshot=reservation.package_snapshot&&typeof reservation.package_snapshot==="object"?reservation.package_snapshot:{},nights=Math.max(1,Number(reservation.noches||1)),originalRate=Number(snapshot.original_rate??reservation.tarifa_noche??0),services=safeArray(reservation.servicios).filter(item=>item?.source!=="package"),manualExtras=services.filter(item=>!isParkingLine(item)).reduce((sum,item)=>sum+lineTotal(item),0),total=Math.max(0,originalRate*nights+manualExtras+Number(reservation.cochera_total||0)+Number(reservation.mascotas_total||0))
  const{data,error}=await supabase.from("reservas").update({package_id:null,package_snapshot:{},regimen:null,tarifa_noche:originalRate,servicios:services,subtotal:total,precio_total:total,descuento_valor:0,descuento_importe:0}).eq("id",rid).eq("property_id",property).select("*").single();if(error)throw error;return data
}