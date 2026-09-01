import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"

export async function loadAvailabilityGroupBlocks(propertyId){
  const property=requirePropertyId(propertyId)
  const{data,error}=await supabase.from("hotel_group_inventory_blocks").select("id,group_id,room_type,quantity,arrival_date,departure_date,status").eq("property_id",property).neq("status","released")
  if(error)throw error
  return data||[]
}

export async function loadPlanningContext(propertyId){
  const property=requirePropertyId(propertyId)
  const[blocksResult,groupsResult]=await Promise.all([
    supabase.from("hotel_group_inventory_blocks").select("*").eq("property_id",property).neq("status","released").order("arrival_date"),
    supabase.from("hotel_groups").select("id,name,code,sales_stage,arrival_date,departure_date").eq("property_id",property),
  ])
  if(blocksResult.error)throw blocksResult.error
  if(groupsResult.error)throw groupsResult.error
  return{groupBlocks:blocksResult.data||[],groups:groupsResult.data||[]}
}

export async function loadPlanningRestrictions(propertyId){
  const property=requirePropertyId(propertyId)
  const{data,error}=await supabase.from("hotel_planning_restrictions").select("*").eq("property_id",property).eq("active",true).order("created_at",{ascending:false}).limit(100)
  if(error)throw error
  return data||[]
}

export async function applyPlanningRestriction({propertyId,draft}){
  const property=requirePropertyId(propertyId)
  const{error}=await supabase.rpc("hl_apply_planning_restriction_atomic",{p_property_id:property,p_date_from:draft.dateFrom,p_date_to:draft.dateTo,p_action:draft.action,p_nights:draft.nights,p_room_type:draft.roomType,p_room_ids:draft.roomIds,p_channels:draft.channels,p_weekdays:draft.weekdays,p_note:draft.note})
  if(error)throw error
  try{return await loadPlanningRestrictions(property)}catch{return[]}
}

export async function splitPlanningReservation({reservationId,draft}){
  const{data,error}=await supabase.rpc("hl_split_reservation_atomic",{p_reserva_id:Number(reservationId),p_split_date:draft.splitDate,p_next_room_id:Number(draft.roomId),p_reprice:!!draft.reprice})
  if(error)throw error
  return data
}

export async function clonePlanningReservation({reservationId,draft}){
  const{data,error}=await supabase.rpc("hl_clone_reservation_atomic",{p_reserva_id:Number(reservationId),p_room_id:Number(draft.roomId),p_start:draft.start,p_reprice:!!draft.reprice,p_copy_extras:!!draft.copyExtras,p_copy_notes:!!draft.copyNotes})
  if(error)throw error
  return Array.isArray(data)?data[0]:data
}

export async function loadPlanningHistory(propertyId){
  const property=requirePropertyId(propertyId)
  const{data,error}=await supabase.from("hotel_planning_operation_log").select("operation_group,action,reservation_id,before_state,after_state,meta,created_at,undone_at").eq("property_id",property).order("created_at",{ascending:false}).limit(80)
  if(error)throw error
  return data||[]
}

export async function undoPlanningHistory(operationGroup){
  const{data,error}=await supabase.rpc("hl_undo_planning_operation_atomic",{p_operation_group:operationGroup})
  if(error)throw error
  return data
}
