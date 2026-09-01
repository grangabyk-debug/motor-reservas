import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"
import{addDays,isoDate}from"../core/formatters"

const property=id=>requirePropertyId(id)
const invoke=async(propertyId,action,extra={})=>{const{data,error}=await supabase.functions.invoke("hotel-channel-hub",{body:{property_id:property(propertyId),action,...extra}});if(error)throw error;if(data?.ok===false)throw new Error(data.error||"No se pudo completar la operación de conectividad.");return data}

export async function loadChannelHub({propertyId,start=isoDate(),end=addDays(isoDate(),13)}){
  const pid=property(propertyId)
  const[{data:snapshot,error:snapshotError},{data:calendar,error:calendarError},{data:overrides,error:overrideError},remote]=await Promise.all([
    supabase.rpc("hl_channel_inventory_snapshot",{p_property_id:pid,p_start:start,p_end:end}),
    supabase.from("hotel_distribution_calendar").select("*").eq("property_id",pid).gte("stay_date",start).lte("stay_date",end),
    supabase.from("hotel_channel_rate_overrides").select("*").eq("property_id",pid).gte("stay_date",start).lte("stay_date",end),
    invoke(pid,"status")
  ])
  if(snapshotError)throw snapshotError;if(calendarError)throw calendarError;if(overrideError)throw overrideError
  return{snapshot:snapshot||[],calendar:calendar||[],overrides:overrides||[],connection:remote.connection||null,mappings:remote.mappings||[],queue:remote.queue||{rows:[],counts:{}},inbox:remote.inbox||[]}
}

export const prepareConnectivityHub=propertyId=>invoke(propertyId,"prepare")
export const queueChannelFullSync=({propertyId,start=isoDate(),end=addDays(isoDate(),365)})=>invoke(propertyId,"queue_full_sync",{date_from:start,date_to:end})
export const dispatchChannelQueue=propertyId=>invoke(propertyId,"dispatch")
export const testChannelAdapter=propertyId=>invoke(propertyId,"test")

export async function saveDistributionCell({propertyId,userId,draft}){
  const row={property_id:property(propertyId),room_type:String(draft.room_type||"").trim(),stay_date:draft.stay_date,base_price:draft.base_price===""||draft.base_price==null?null:Math.max(0,Number(draft.base_price)),min_stay:Math.max(1,Number(draft.min_stay||1)),max_stay:Math.max(0,Number(draft.max_stay||0)),stop_sell:!!draft.stop_sell,closed_to_arrival:!!draft.closed_to_arrival,closed_to_departure:!!draft.closed_to_departure,notes:draft.notes||null,updated_by:userId||null,updated_at:new Date().toISOString()}
  if(!row.room_type||!row.stay_date)throw new Error("Falta tipología o fecha.")
  const{error}=await supabase.from("hotel_distribution_calendar").upsert(row,{onConflict:"property_id,room_type,stay_date"});if(error)throw error
}

export async function saveChannelMapping({propertyId,connectionId,roomType,externalRoomTypeId,externalRatePlanId}){
  const pid=property(propertyId),type=String(roomType||"").trim(),rows=[]
  if(!connectionId||!type)throw new Error("Falta preparar la capa de conectividad.")
  if(String(externalRoomTypeId||"").trim())rows.push({property_id:pid,connection_id:connectionId,mapping_type:"room_type",local_key:type,channel_code:"",external_id:String(externalRoomTypeId).trim(),metadata:{label:type},updated_at:new Date().toISOString()})
  if(String(externalRatePlanId||"").trim())rows.push({property_id:pid,connection_id:connectionId,mapping_type:"rate_plan",local_key:`${type}::standard`,channel_code:"",external_id:String(externalRatePlanId).trim(),metadata:{label:`${type} · estándar`},updated_at:new Date().toISOString()})
  if(!rows.length)throw new Error("Ingresá al menos un ID externo.")
  const{error}=await supabase.from("hotel_channel_mappings").upsert(rows,{onConflict:"connection_id,mapping_type,local_key,channel_code"});if(error)throw error
}

export async function saveChannelOverride({propertyId,connectionId,draft}){
  const row={property_id:property(propertyId),connection_id:connectionId,channel_code:String(draft.channel_code||"").trim().toLowerCase(),room_type:String(draft.room_type||"").trim(),stay_date:draft.stay_date,price_mode:draft.price_mode||"inherit",price_value:draft.price_value===""||draft.price_value==null?null:Number(draft.price_value),min_stay:draft.min_stay===""||draft.min_stay==null?null:Math.max(1,Number(draft.min_stay)),max_stay:draft.max_stay===""||draft.max_stay==null?null:Math.max(0,Number(draft.max_stay)),stop_sell:draft.stop_sell===null?null:!!draft.stop_sell,closed_to_arrival:draft.closed_to_arrival===null?null:!!draft.closed_to_arrival,closed_to_departure:draft.closed_to_departure===null?null:!!draft.closed_to_departure,notes:draft.notes||null,updated_at:new Date().toISOString()}
  if(!connectionId||!row.channel_code||!row.room_type||!row.stay_date)throw new Error("Completá canal, tipología y fecha.")
  const{error}=await supabase.from("hotel_channel_rate_overrides").upsert(row,{onConflict:"connection_id,channel_code,room_type,stay_date"});if(error)throw error
}

export function mappingState(mappings=[],roomType){const room=mappings.find(x=>x.mapping_type==="room_type"&&x.local_key===roomType),rate=mappings.find(x=>x.mapping_type==="rate_plan"&&x.local_key===`${roomType}::standard`);return{room:room?.external_id||"",rate:rate?.external_id||"",ready:!!room?.external_id&&!!rate?.external_id}}
