import{ supabase }from"../../../lib/supabase"
import{ requirePropertyId }from"../data/tenant"

const tenant=id=>requirePropertyId(id)
const TABLES=["hotel_housekeeping_schedules","hotel_housekeeping_history","hotel_housekeeping_checklist_catalog","hotel_housekeeping_room_reports","hotel_housekeeping_assignment_rules","hotel_housekeeping_tasks","hotel_maintenance_tickets"]

export async function loadHousekeepingWorkspace({propertyId}){
  const property=tenant(propertyId)
  const[schedules,history,checklist,reports,rules,tasks,maintenance,members]=await Promise.all([
    supabase.from("hotel_housekeeping_schedules").select("*").eq("property_id",property).order("next_cleaning_date"),
    supabase.from("hotel_housekeeping_history").select("*").eq("property_id",property).order("created_at",{ascending:false}).limit(600),
    supabase.from("hotel_housekeeping_checklist_catalog").select("*").eq("property_id",property).eq("active",true).order("sort_order").order("label"),
    supabase.from("hotel_housekeeping_room_reports").select("*").eq("property_id",property).order("created_at",{ascending:false}).limit(300),
    supabase.from("hotel_housekeeping_assignment_rules").select("*").eq("property_id",property).order("priority").order("created_at"),
    supabase.from("hotel_housekeeping_tasks").select("*").eq("property_id",property).order("scheduled_for",{ascending:false}).limit(400),
    supabase.from("hotel_maintenance_tickets").select("*").eq("property_id",property).order("created_at",{ascending:false}).limit(300),
    supabase.from("property_members").select("user_id,role,created_at").eq("property_id",property),
  ])
  const failed=[schedules,history,checklist,reports,rules,tasks,maintenance,members].find(result=>result.error)
  if(failed?.error)throw failed.error
  const memberRows=members.data||[],ids=memberRows.map(item=>item.user_id).filter(Boolean)
  let profiles=[]
  if(ids.length){const result=await supabase.from("profiles").select("id,full_name,role").in("id",ids);if(result.error)throw result.error;profiles=result.data||[]}
  return{
    schedules:schedules.data||[],history:history.data||[],checklist:checklist.data||[],reports:reports.data||[],rules:rules.data||[],tasks:tasks.data||[],maintenance:maintenance.data||[],
    staff:memberRows.map(member=>({...member,profile:profiles.find(profile=>profile.id===member.user_id)||null})),
  }
}

export function subscribeHousekeepingWorkspace({propertyId,onChange}){
  const property=tenant(propertyId),channel=supabase.channel(`hl-housekeeping-workspace-${property}`)
  for(const table of TABLES)channel.on("postgres_changes",{event:"*",schema:"public",table,filter:`property_id=eq.${property}`},onChange)
  channel.subscribe()
  return()=>supabase.removeChannel(channel)
}

export async function setHousekeepingRoomState({roomId,status,checklist=[],source="manual",note=null}){
  const{error}=await supabase.rpc("hl_housekeeping_set_room_state",{p_room_id:Number(roomId),p_status:status,p_checklist:checklist,p_source:source,p_note:note})
  if(error)throw error
}

export async function saveHousekeepingSchedule({reservationId,draft}){
  const{error}=await supabase.rpc("hl_housekeeping_save_schedule",{p_reservation_id:Number(reservationId),p_mode:draft.mode,p_every_n_nights:Math.max(1,Number(draft.every||2)),p_weekdays:(draft.weekdays||[]).map(Number),p_active:draft.active!==false,p_notes:draft.notes||null})
  if(error)throw error
}
