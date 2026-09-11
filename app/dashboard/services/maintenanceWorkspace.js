import{ supabase }from"../../../lib/supabase"
import{ requirePropertyId }from"../data/tenant"

const tenant=id=>requirePropertyId(id)
const OPEN_STATUSES=new Set(["open","assigned","in_progress","waiting_parts","waiting_vendor"])

async function currentUserId(){
  const{data,error}=await supabase.auth.getUser();if(error)throw error
  const id=data?.user?.id;if(!id)throw new Error("La sesión venció. Volvé a ingresar.")
  return id
}

function nextDueDate(plan,from=new Date()){
  const value=Math.max(1,Number(plan.frequency_value||1)),unit=plan.frequency_unit||"month",d=new Date(from)
  if(unit==="day")d.setDate(d.getDate()+value)
  else if(unit==="week")d.setDate(d.getDate()+value*7)
  else if(unit==="year")d.setFullYear(d.getFullYear()+value)
  else d.setMonth(d.getMonth()+value)
  return d.toISOString().slice(0,10)
}

export async function loadMaintenanceWorkspace({propertyId}){
  const property=tenant(propertyId)
  const[tickets,assets,vendors,plans,events,members]=await Promise.all([
    supabase.from("hotel_maintenance_tickets").select("*").eq("property_id",property).order("created_at",{ascending:false}).limit(700),
    supabase.from("hotel_maintenance_assets").select("*").eq("property_id",property).order("active",{ascending:false}).order("name"),
    supabase.from("hotel_maintenance_vendors").select("*").eq("property_id",property).order("active",{ascending:false}).order("name"),
    supabase.from("hotel_maintenance_plans").select("*").eq("property_id",property).order("active",{ascending:false}).order("next_due_date"),
    supabase.from("hotel_maintenance_events").select("*").eq("property_id",property).order("created_at",{ascending:false}).limit(1200),
    supabase.from("property_members").select("user_id,role,created_at").eq("property_id",property),
  ])
  const failed=[tickets,assets,vendors,plans,events,members].find(result=>result.error);if(failed?.error)throw failed.error
  const memberRows=members.data||[],ids=memberRows.map(item=>item.user_id).filter(Boolean)
  let profiles=[]
  if(ids.length){const result=await supabase.from("profiles").select("id,full_name,role").in("id",ids);if(result.error)throw result.error;profiles=result.data||[]}
  return{tickets:tickets.data||[],assets:assets.data||[],vendors:vendors.data||[],plans:plans.data||[],events:events.data||[],staff:memberRows.map(member=>({...member,profile:profiles.find(profile=>profile.id===member.user_id)||null}))}
}

export function subscribeMaintenanceWorkspace({propertyId,onChange}){
  const property=tenant(propertyId),tables=["hotel_maintenance_tickets","hotel_maintenance_assets","hotel_maintenance_vendors","hotel_maintenance_plans","hotel_maintenance_events","bloqueos"]
  const channel=supabase.channel(`hl-maintenance-${property}`)
  tables.forEach(table=>channel.on("postgres_changes",{event:"*",schema:"public",table,filter:`property_id=eq.${property}`},onChange))
  channel.subscribe();return()=>supabase.removeChannel(channel)
}

async function syncInventoryBlock({propertyId,ticket}){
  const property=tenant(propertyId),terminal=["resolved","verified","closed","done","cancelled"].includes(String(ticket.status||"").toLowerCase())
  if(!ticket.room_id||!ticket.blocks_inventory||terminal){await supabase.from("bloqueos").delete().eq("property_id",property).eq("maintenance_ticket_id",ticket.id);return}
  const existing=await supabase.from("bloqueos").select("id").eq("property_id",property).eq("maintenance_ticket_id",ticket.id).maybeSingle();if(existing.error)throw existing.error
  if(existing.data?.id)return
  const uid=await currentUserId(),start=new Date().toISOString().slice(0,10)
  const{error}=await supabase.from("bloqueos").insert({property_id:property,user_id:uid,habitacion_id:Number(ticket.room_id),fecha_desde:start,fecha_hasta:"2099-12-31",motivo:"Mantenimiento",detalle:`OT ${ticket.title}`,maintenance_ticket_id:ticket.id});if(error)throw error
}

export async function saveMaintenanceTicket({propertyId,draft}){
  const property=tenant(propertyId),uid=await currentUserId(),now=new Date().toISOString(),labor=Math.max(0,Number(draft.labor_cost||0)),materials=Math.max(0,Number(draft.material_cost||0)),external=Math.max(0,Number(draft.external_cost||0))
  const row={property_id:property,room_id:draft.room_id?Number(draft.room_id):null,resource_id:draft.resource_id||null,asset_id:draft.asset_id||null,vendor_id:draft.vendor_id||null,reservation_id:draft.reservation_id?Number(draft.reservation_id):null,title:String(draft.title||"").trim(),description:String(draft.description||"").trim()||null,priority:draft.priority||"normal",status:draft.status||"open",assigned_to:draft.assigned_to||null,reported_by:draft.reported_by||uid,due_at:draft.due_at||null,labor_cost:labor,material_cost:materials,external_cost:external,cost:labor+materials+external,parts:Array.isArray(draft.parts)?draft.parts:[],checklist:Array.isArray(draft.checklist)?draft.checklist:[],photos:Array.isArray(draft.photos)?draft.photos:[],notes:String(draft.notes||"").trim()||null,source:draft.source||"manual",waiting_reason:String(draft.waiting_reason||"").trim()||null,resolution_note:String(draft.resolution_note||"").trim()||null,blocks_inventory:!!draft.blocks_inventory,estimated_minutes:draft.estimated_minutes?Math.max(1,Number(draft.estimated_minutes)):null,recurrence_plan_id:draft.recurrence_plan_id||null,updated_at:now}
  if(!row.title)throw new Error("La orden necesita un título.")
  const before=draft.id?await supabase.from("hotel_maintenance_tickets").select("status").eq("id",draft.id).eq("property_id",property).maybeSingle():{data:null,error:null};if(before.error)throw before.error
  const query=draft.id?supabase.from("hotel_maintenance_tickets").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("hotel_maintenance_tickets").insert(row)
  const{data,error}=await query.select("*").single();if(error)throw error
  await supabase.from("hotel_maintenance_events").insert({property_id:property,ticket_id:data.id,event_type:draft.id?"updated":"created",from_status:before.data?.status||null,to_status:data.status,note:draft.id?"Orden actualizada":"Orden creada",labor_cost:labor,material_cost:materials,external_cost:external,parts:row.parts,created_by:uid})
  await syncInventoryBlock({propertyId:property,ticket:data})
  return data
}

export async function setMaintenanceTicketStatus({propertyId,ticket,status,note=""}){
  const property=tenant(propertyId),uid=await currentUserId(),now=new Date().toISOString(),patch={status,updated_at:now}
  if(status==="assigned"&&!ticket.assigned_to)throw new Error("Asigná un responsable antes de pasar la orden a Asignada.")
  if(status==="in_progress"&&!ticket.started_at)patch.started_at=now
  if(status==="resolved")patch.completed_at=now
  if(status==="verified"){patch.verified_at=now;patch.verified_by=uid;if(!ticket.completed_at)patch.completed_at=now}
  if(status==="open"){patch.started_at=null;patch.completed_at=null;patch.verified_at=null;patch.verified_by=null}
  const{data,error}=await supabase.from("hotel_maintenance_tickets").update(patch).eq("id",ticket.id).eq("property_id",property).select("*").single();if(error)throw error
  await supabase.from("hotel_maintenance_events").insert({property_id:property,ticket_id:ticket.id,event_type:"status",from_status:ticket.status,to_status:status,note:String(note||"").trim()||null,created_by:uid})
  await syncInventoryBlock({propertyId:property,ticket:data})
  if(status==="verified"&&data.recurrence_plan_id){const{data:plan,error:planError}=await supabase.from("hotel_maintenance_plans").select("*").eq("id",data.recurrence_plan_id).eq("property_id",property).maybeSingle();if(planError)throw planError;if(plan){const{error:updateError}=await supabase.from("hotel_maintenance_plans").update({last_completed_at:now,next_due_date:nextDueDate(plan,new Date()),updated_at:now}).eq("id",plan.id).eq("property_id",property);if(updateError)throw updateError}}
  return data
}

export async function addMaintenanceEvent({propertyId,ticketId,note,eventType="note"}){
  const uid=await currentUserId(),{data,error}=await supabase.from("hotel_maintenance_events").insert({property_id:tenant(propertyId),ticket_id:ticketId,event_type:eventType,note:String(note||"").trim()||null,created_by:uid}).select("*").single();if(error)throw error;return data
}

export async function saveMaintenanceAsset({propertyId,draft}){
  const property=tenant(propertyId),row={property_id:property,room_id:draft.room_id?Number(draft.room_id):null,name:String(draft.name||"").trim(),category:draft.category||"equipment",brand:String(draft.brand||"").trim()||null,model:String(draft.model||"").trim()||null,serial_number:String(draft.serial_number||"").trim()||null,location:String(draft.location||"").trim()||null,status:draft.status||"active",purchase_date:draft.purchase_date||null,warranty_until:draft.warranty_until||null,expected_life_months:draft.expected_life_months?Math.max(1,Number(draft.expected_life_months)):null,notes:String(draft.notes||"").trim()||null,metadata:draft.metadata||{},active:draft.active!==false,updated_at:new Date().toISOString()}
  if(!row.name)throw new Error("El activo necesita un nombre.")
  const query=draft.id?supabase.from("hotel_maintenance_assets").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("hotel_maintenance_assets").insert(row)
  const{data,error}=await query.select("*").single();if(error)throw error;return data
}

export async function saveMaintenanceVendor({propertyId,draft}){
  const property=tenant(propertyId),row={property_id:property,name:String(draft.name||"").trim(),service_type:String(draft.service_type||"").trim()||null,contact_name:String(draft.contact_name||"").trim()||null,phone:String(draft.phone||"").trim()||null,email:String(draft.email||"").trim()||null,notes:String(draft.notes||"").trim()||null,active:draft.active!==false,updated_at:new Date().toISOString()}
  if(!row.name)throw new Error("El proveedor necesita un nombre.")
  const query=draft.id?supabase.from("hotel_maintenance_vendors").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("hotel_maintenance_vendors").insert(row)
  const{data,error}=await query.select("*").single();if(error)throw error;return data
}

export async function saveMaintenancePlan({propertyId,draft}){
  const property=tenant(propertyId),uid=await currentUserId(),row={property_id:property,asset_id:draft.asset_id||null,room_id:draft.room_id?Number(draft.room_id):null,title:String(draft.title||"").trim(),description:String(draft.description||"").trim()||null,frequency_unit:draft.frequency_unit||"month",frequency_value:Math.max(1,Number(draft.frequency_value||1)),next_due_date:draft.next_due_date||new Date().toISOString().slice(0,10),priority:draft.priority||"normal",assigned_to:draft.assigned_to||null,vendor_id:draft.vendor_id||null,estimated_minutes:draft.estimated_minutes?Math.max(1,Number(draft.estimated_minutes)):null,checklist:Array.isArray(draft.checklist)?draft.checklist:[],active:draft.active!==false,created_by:draft.created_by||uid,updated_at:new Date().toISOString()}
  if(!row.title)throw new Error("El preventivo necesita un título.")
  const query=draft.id?supabase.from("hotel_maintenance_plans").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("hotel_maintenance_plans").insert(row)
  const{data,error}=await query.select("*").single();if(error)throw error;return data
}

export async function createTicketFromPlan({propertyId,plan}){
  return saveMaintenanceTicket({propertyId,draft:{title:plan.title,description:plan.description,priority:plan.priority,status:plan.assigned_to?"assigned":"open",assigned_to:plan.assigned_to,room_id:plan.room_id,asset_id:plan.asset_id,vendor_id:plan.vendor_id,estimated_minutes:plan.estimated_minutes,checklist:plan.checklist||[],recurrence_plan_id:plan.id,source:"preventive"}})
}

export async function uploadMaintenanceAttachment({propertyId,ticketId,file,stage="before"}){
  const property=tenant(propertyId),uid=await currentUserId(),safe=String(file.name||"archivo").replace(/[^a-zA-Z0-9._-]/g,"-")
  const path=`${property}/${ticketId}/${Date.now()}-${uid.slice(0,8)}-${safe}`
  const{error}=await supabase.storage.from("maintenance-attachments").upload(path,file,{upsert:false,contentType:file.type||undefined});if(error)throw error
  const{data}=supabase.storage.from("maintenance-attachments").getPublicUrl(path)
  return{path,url:data.publicUrl,name:file.name,stage,uploaded_at:new Date().toISOString()}
}
