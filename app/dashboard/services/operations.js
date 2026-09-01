import{ supabase }from"../../../lib/supabase"
import{ requirePropertyId }from"../data/tenant"

const tenant=id=>requirePropertyId(id)
async function currentUserId(){const{data,error}=await supabase.auth.getUser();if(error)throw error;const id=data?.user?.id;if(!id)throw new Error("La sesión venció. Volvé a ingresar.");return id}

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

export async function assignHousekeepingTask({taskId,assigneeId=null}){
  const{data,error}=await supabase.rpc("hl_housekeeping_assign_task",{p_task_id:taskId,p_assignee:assigneeId||null});if(error)throw error;return Array.isArray(data)?data[0]:data
}

export async function autoAssignHousekeeping({propertyId,date}){
  const{data,error}=await supabase.rpc("hl_housekeeping_auto_assign",{p_property_id:tenant(propertyId),p_for_date:date});if(error)throw error;return data||{created:0,assigned:0}
}

export async function saveHousekeepingReport({propertyId,roomId,reservationId=null,kind,title,detail="",priority="normal"}){
  const pid=tenant(propertyId),uid=await currentUserId(),cleanKind=String(kind||"").toLowerCase(),cleanTitle=String(title||"").trim()
  if(!["lost_found","room_note"].includes(cleanKind))throw new Error("Tipo de reporte de Housekeeping no válido.")
  if(!cleanTitle)throw new Error(cleanKind==="lost_found"?"Indicá qué objeto se encontró.":"Escribí un título para la nota.")
  const{data,error}=await supabase.from("hotel_housekeeping_room_reports").insert({property_id:pid,room_id:Number(roomId),reservation_id:reservationId?Number(reservationId):null,kind:cleanKind,title:cleanTitle,detail:String(detail||"").trim()||null,priority,status:"open",created_by:uid}).select("*").single();if(error)throw error;return data
}

export async function resolveHousekeepingReport({propertyId,id}){
  const uid=await currentUserId(),{data,error}=await supabase.from("hotel_housekeeping_room_reports").update({status:"resolved",resolved_by:uid,resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("property_id",tenant(propertyId)).select("*").single();if(error)throw error;return data
}

export async function saveHousekeepingAssignmentRule({propertyId,draft}){
  const pid=tenant(propertyId),uid=await currentUserId(),scope=String(draft.scope_type||"all"),assignee=String(draft.assignee_id||"").trim()
  if(!["all","floor","zone","room_type"].includes(scope))throw new Error("El criterio de autoasignación no es válido.")
  if(!assignee)throw new Error("Elegí una persona para la regla.")
  if(scope!=="all"&&!String(draft.scope_value||"").trim())throw new Error("Elegí el piso, zona o tipología que corresponde.")
  const row={property_id:pid,scope_type:scope,scope_value:scope==="all"?null:String(draft.scope_value).trim(),assignee_id:assignee,label:String(draft.label||"").trim()||null,priority:Number(draft.priority||100),active:draft.active!==false,created_by:draft.created_by||uid,updated_at:new Date().toISOString()}
  const query=draft.id?supabase.from("hotel_housekeeping_assignment_rules").update(row).eq("id",draft.id).eq("property_id",pid):supabase.from("hotel_housekeeping_assignment_rules").insert(row)
  const{data,error}=await query.select("*").single();if(error)throw error;return data
}

export async function deleteHousekeepingAssignmentRule({propertyId,id}){
  const{error}=await supabase.from("hotel_housekeeping_assignment_rules").delete().eq("id",id).eq("property_id",tenant(propertyId));if(error)throw error
}

export async function reportHousekeepingMaintenance({propertyId,roomId,title,description="",priority="normal"}){
  const uid=await currentUserId(),row={property_id:tenant(propertyId),room_id:Number(roomId),resource_id:null,title:String(title||"").trim(),description:String(description||"").trim()||null,priority,status:"open",assigned_to:null,reported_by:uid,due_at:null,cost:0,photos:[],notes:"Reportado desde Housekeeping",updated_at:new Date().toISOString()}
  if(!row.title)throw new Error("Describí la avería.")
  const{data,error}=await supabase.from("hotel_maintenance_tickets").insert(row).select("*").single();if(error)throw error;return data
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
