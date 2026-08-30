import{ supabase }from"../../../lib/supabase"
import{ requirePropertyId }from"../data/tenant"

const tenant=id=>requirePropertyId(id)

export async function saveFloor({propertyId,draft}){
  const row={property_id:tenant(propertyId),name:String(draft.name||"").trim(),sort_order:Number(draft.sort_order||0),active:draft.active!==false,updated_at:new Date().toISOString()}
  if(!row.name)throw new Error("El piso necesita un nombre.")
  const query=draft.id?supabase.from("hotel_floors").update(row).eq("id",draft.id).eq("property_id",row.property_id):supabase.from("hotel_floors").insert(row)
  const{error}=await query;if(error)throw error
}

export async function saveRoom({propertyId,draft}){
  const property=tenant(propertyId),row={property_id:property,nombre:String(draft.nombre||"").trim(),tipo:draft.tipo||"Habitación",capacidad:Math.max(1,Number(draft.capacidad||1)),precio:Math.max(0,Number(draft.precio||0)),cochera_precio:Math.max(0,Number(draft.cochera_precio||0)),floor_id:draft.floor_id||null,sort_order:Number(draft.sort_order||0),descripcion:draft.descripcion||null,housekeeping_zone:draft.housekeeping_zone||null,activa:draft.activa!==false,estado:draft.estado||"libre"}
  if(!row.nombre)throw new Error("La habitación necesita un nombre.")
  const query=draft.id?supabase.from("habitaciones").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("habitaciones").insert(row)
  const{error}=await query;if(error)throw error
}

export async function updateRoomStatus({propertyId,roomId,status}){
  const{error}=await supabase.from("habitaciones").update({estado:status}).eq("id",roomId).eq("property_id",tenant(propertyId));if(error)throw error
}

export async function saveBlock({propertyId,userId,draft}){
  if(!draft.roomId||!draft.start||!draft.end||draft.end<=draft.start)throw new Error("Revisá habitación y fechas del bloqueo.")
  const{error}=await supabase.from("bloqueos").insert({property_id:tenant(propertyId),user_id:userId,habitacion_id:Number(draft.roomId),fecha_desde:draft.start,fecha_hasta:draft.end,motivo:draft.reason||"Bloqueo operativo",detalle:draft.detail||null});if(error)throw error
}

export async function saveHousekeepingTask({propertyId,userId,draft}){
  const row={property_id:tenant(propertyId),room_id:Number(draft.room_id),reservation_id:draft.reservation_id?Number(draft.reservation_id):null,task_type:draft.task_type||"cleaning",priority:draft.priority||"normal",status:draft.status||"pending",assigned_to:draft.assigned_to||null,scheduled_for:draft.scheduled_for||new Date().toISOString(),checklist:draft.checklist||[],minibar:draft.minibar||{},linen:draft.linen||{},notes:draft.notes||null,created_by:userId,updated_at:new Date().toISOString()}
  if(!row.room_id)throw new Error("Elegí una habitación.")
  const query=draft.id?supabase.from("hotel_housekeeping_tasks").update(row).eq("id",draft.id).eq("property_id",row.property_id):supabase.from("hotel_housekeeping_tasks").insert(row)
  const{error}=await query;if(error)throw error
}

export async function setHousekeepingStatus({propertyId,id,status}){
  const patch={status,updated_at:new Date().toISOString()};if(status==="in_progress")patch.started_at=new Date().toISOString();if(status==="done")patch.completed_at=new Date().toISOString()
  const{error}=await supabase.from("hotel_housekeeping_tasks").update(patch).eq("id",id).eq("property_id",tenant(propertyId));if(error)throw error
}

export async function saveMaintenanceTicket({propertyId,userId,draft}){
  const row={property_id:tenant(propertyId),room_id:draft.room_id?Number(draft.room_id):null,resource_id:draft.resource_id||null,title:String(draft.title||"").trim(),description:draft.description||null,priority:draft.priority||"normal",status:draft.status||"open",assigned_to:draft.assigned_to||null,reported_by:userId,due_at:draft.due_at||null,cost:Math.max(0,Number(draft.cost||0)),photos:draft.photos||[],notes:draft.notes||null,updated_at:new Date().toISOString()}
  if(!row.title)throw new Error("El mantenimiento necesita un título.")
  const query=draft.id?supabase.from("hotel_maintenance_tickets").update(row).eq("id",draft.id).eq("property_id",row.property_id):supabase.from("hotel_maintenance_tickets").insert(row)
  const{error}=await query;if(error)throw error
}

export async function setMaintenanceStatus({propertyId,id,status}){
  const patch={status,updated_at:new Date().toISOString()};if(status==="in_progress")patch.started_at=new Date().toISOString();if(status==="done")patch.completed_at=new Date().toISOString()
  const{error}=await supabase.from("hotel_maintenance_tickets").update(patch).eq("id",id).eq("property_id",tenant(propertyId));if(error)throw error
}

export async function saveResource({propertyId,draft}){
  const row={property_id:tenant(propertyId),category:draft.category||"service",name:String(draft.name||"").trim(),code:draft.code||null,capacity:Math.max(1,Number(draft.capacity||1)),status:draft.status||"available",price:Math.max(0,Number(draft.price||0)),charge_mode:draft.charge_mode||"per_use",location:draft.location||null,metadata:draft.metadata||{},active:draft.active!==false,updated_at:new Date().toISOString()}
  if(!row.name)throw new Error("El recurso necesita un nombre.")
  const query=draft.id?supabase.from("hotel_resources").update(row).eq("id",draft.id).eq("property_id",row.property_id):supabase.from("hotel_resources").insert(row)
  const{error}=await query;if(error)throw error
}
