import{ supabase }from"../../../lib/supabase"
import{ requirePropertyId }from"../data/tenant"

const tenant=id=>requirePropertyId(id)
const n=value=>Math.max(0,Number(value||0))
const GROUP_STATUS={inquiry:"prospect",quoted:"tentative",tentative:"tentative",confirmed:"confirmed",in_house:"in_house",completed:"completed",lost:"cancelled"}

export async function loadGroupsWorkspace({propertyId}){
  const property=tenant(propertyId)
  const[groups,quotes,lines,rooming,inventory]=await Promise.all([
    supabase.from("hotel_groups").select("*").eq("property_id",property).order("arrival_date",{ascending:true}),
    supabase.from("hotel_group_quotes").select("*").eq("property_id",property).order("created_at",{ascending:false}),
    supabase.from("hotel_group_quote_lines").select("*").eq("property_id",property).order("sort_order"),
    supabase.from("hotel_group_rooming").select("*").eq("property_id",property).order("guest_name"),
    supabase.from("hotel_group_inventory_blocks").select("*").eq("property_id",property).order("arrival_date"),
  ])
  const failed=[groups,quotes,lines,rooming,inventory].find(result=>result.error)
  if(failed?.error)throw failed.error
  return{groups:groups.data||[],quotes:quotes.data||[],lines:lines.data||[],rooming:rooming.data||[],inventory:inventory.data||[]}
}

export async function saveGroupDeskGroup({propertyId,draft}){
  const property=tenant(propertyId)
  if(!draft?.name?.trim())throw new Error("El grupo necesita un nombre.")
  if(draft.arrival_date&&draft.departure_date&&draft.departure_date<=draft.arrival_date)throw new Error("La salida debe ser posterior a la llegada.")
  const row={
    property_id:property,partner_id:draft.partner_id||null,name:draft.name.trim(),code:draft.code||null,kind:draft.kind||"group",
    status:GROUP_STATUS[draft.sales_stage]||"tentative",arrival_date:draft.arrival_date||null,departure_date:draft.departure_date||null,
    contact_name:draft.contact_name||draft.coordinator_name||null,contact_email:draft.contact_email||draft.coordinator_email||null,
    contact_phone:draft.contact_phone||draft.coordinator_phone||null,room_block:n(draft.room_block),billing_mode:draft.billing_mode||"master",
    notes:draft.notes||null,event_type:draft.event_type||"other",estimated_pax:n(draft.estimated_pax),coordinator_name:draft.coordinator_name||null,
    coordinator_email:draft.coordinator_email||null,coordinator_phone:draft.coordinator_phone||null,meal_plan:draft.meal_plan||null,
    release_date:draft.release_date||null,sales_stage:draft.sales_stage||"inquiry",priority:draft.priority||"normal",
    department_notes:draft.department_notes||{},budget_currency:draft.budget_currency||"ARS",budget_total:n(draft.budget_total),updated_at:new Date().toISOString(),
  }
  const query=draft.id
    ?supabase.from("hotel_groups").update(row).eq("id",draft.id).eq("property_id",property).select().single()
    :supabase.from("hotel_groups").insert(row).select().single()
  const{data,error}=await query
  if(error)throw error
  return data
}

export async function createGroupQuoteAtomic({propertyId,group,draft}){
  const property=tenant(propertyId)
  if(!group?.id||!draft?.group_id||String(group.id)!==String(draft.group_id))throw new Error("El presupuesto no está asociado al grupo correcto.")
  const quoteNumber=`GR-${String(group.code||group.name||"GRUPO").replace(/[^a-z0-9]/gi,"").slice(0,10).toUpperCase()}-${String(draft.version).padStart(2,"0")}`
  const lines=(draft.lines||[]).filter(line=>line.description?.trim()).map((line,index)=>({
    category:line.category||"extra",description:line.description.trim(),quantity:Number(line.quantity||0),unit_price:Number(line.unit_price||0),sort_order:index,
    metadata:line.category==="room"?{room_type:line.room_type||"Habitación"}:{},
  }))
  const{data,error}=await supabase.rpc("hl_group_create_quote_atomic",{
    p_property_id:property,p_group_id:group.id,p_version:Number(draft.version||1),p_quote_number:quoteNumber,p_status:draft.status||"draft",
    p_currency:draft.currency||"ARS",p_valid_until:draft.valid_until||null,p_deposit_percent:n(draft.deposit_percent),
    p_deposit_due_date:draft.deposit_due_date||null,p_terms:draft.terms||null,p_internal_notes:draft.internal_notes||null,p_lines:lines,
  })
  if(error)throw error
  return{quote:data,quoteNumber}
}

export async function markGroupQuoteAtomic({propertyId,quoteId,status}){
  const property=tenant(propertyId)
  if(!["sent","accepted","rejected"].includes(status))throw new Error("Estado de presupuesto no válido.")
  const{data,error}=await supabase.rpc("hl_group_mark_quote_atomic",{p_property_id:property,p_quote_id:quoteId,p_status:status})
  if(error)throw error
  return data
}

export async function saveGroupRoomingGuest({propertyId,draft}){
  const property=tenant(propertyId)
  if(!draft?.guest_name?.trim())throw new Error("Falta el nombre del pasajero.")
  const row={property_id:property,group_id:draft.group_id,reservation_id:draft.reservation_id||null,room_id:draft.room_id?Number(draft.room_id):null,
    guest_name:draft.guest_name.trim(),document:draft.document||null,email:draft.email||null,phone:draft.phone||null,role_label:draft.role_label||null,
    arrival_date:draft.arrival_date||null,departure_date:draft.departure_date||null,status:draft.room_id&&draft.status==="pending"?"assigned":draft.status||"pending",
    notes:draft.notes||null,updated_at:new Date().toISOString()}
  const query=draft.id
    ?supabase.from("hotel_group_rooming").update(row).eq("id",draft.id).eq("property_id",property)
    :supabase.from("hotel_group_rooming").insert(row)
  const{error}=await query
  if(error)throw error
}
