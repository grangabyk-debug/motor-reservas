import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"

export const DEFAULT_ONBOARDING_CHECKLIST={
  config:{identity:false,rooms:false,rates:false,taxes:false,users:false,payments:false},
  data:{mapping:false,future_reservations:false,guests:false,partners:false,balances:false,reconciliation:false},
  training:{reception:false,housekeeping:false,management:false,shadow_mode:false},
  golive:{delta_import:false,final_reconciliation:false,team_signoff:false,channel_cutover:false},
}
export const DEFAULT_ONBOARDING_SCOPE={reservations:true,guests:true,companies:true,agencies:true,balances:true,rates:true,inventory:true,notes:true}
const STATUS=new Set(["planning","configuring","importing","parallel","ready","live","paused"]),MODE=new Set(["parallel","staged"])
const text=value=>String(value||"").trim()
function mergeChecklist(value={}){return Object.fromEntries(Object.entries(DEFAULT_ONBOARDING_CHECKLIST).map(([section,tasks])=>[section,{...tasks,...(value?.[section]&&typeof value[section]==="object"?value[section]:{})}]))}
function normalizeBlockers(value){if(!Array.isArray(value))return[];return value.slice(0,50).map((item,index)=>typeof item==="string"?{id:`legacy-${index}`,text:item,resolved:false}:{id:text(item?.id)||`blocker-${index}`,text:text(item?.text).slice(0,240),resolved:!!item?.resolved}).filter(item=>item.text)}
export function onboardingDefaults(propertyId){return{property_id:requirePropertyId(propertyId),source_system:"",source_system_version:"",target_go_live:"",status:"planning",migration_mode:"parallel",responsibles:{project:"",data:"",training:""},data_scope:{...DEFAULT_ONBOARDING_SCOPE},checklist:mergeChecklist(),blockers:[],notes:"",started_at:null,went_live_at:null,created_by:null,updated_by:null,created_at:null,updated_at:null}}
export function normalizeOnboardingProject(row,propertyId){const base=onboardingDefaults(propertyId);if(!row)return base;return{...base,...row,source_system:row.source_system||"",source_system_version:row.source_system_version||"",target_go_live:row.target_go_live||"",responsibles:{...base.responsibles,...(row.responsibles||{})},data_scope:{...base.data_scope,...(row.data_scope||{})},checklist:mergeChecklist(row.checklist),blockers:normalizeBlockers(row.blockers)}}

export async function loadOnboardingProject(propertyId){const property=requirePropertyId(propertyId),{data,error}=await supabase.from("hotel_onboarding_projects").select("*").eq("property_id",property).maybeSingle();if(error)throw error;return normalizeOnboardingProject(data,property)}

export async function saveOnboardingProject({propertyId,userId,draft}){
  const property=requirePropertyId(propertyId),base=normalizeOnboardingProject(draft,property),metadata={source_system:text(base.source_system).slice(0,120)||null,source_system_version:text(base.source_system_version).slice(0,80)||null,target_go_live:base.target_go_live||null,status:STATUS.has(base.status)?base.status:"planning",migration_mode:MODE.has(base.migration_mode)?base.migration_mode:"parallel",responsibles:{project:text(base.responsibles?.project).slice(0,120),data:text(base.responsibles?.data).slice(0,120),training:text(base.responsibles?.training).slice(0,120)},data_scope:{...DEFAULT_ONBOARDING_SCOPE,...base.data_scope},blockers:normalizeBlockers(base.blockers),notes:text(base.notes).slice(0,3000)||null,went_live_at:base.went_live_at||null,updated_by:userId||null,updated_at:new Date().toISOString()}
  let query
  if(base.created_at)query=supabase.from("hotel_onboarding_projects").update(metadata).eq("property_id",property).select("*").single()
  else query=supabase.from("hotel_onboarding_projects").upsert({property_id:property,...metadata,checklist:mergeChecklist(base.checklist),started_at:base.started_at||new Date().toISOString(),created_by:base.created_by||userId||null},{onConflict:"property_id"}).select("*").single()
  const{data,error}=await query;if(error)throw error;return normalizeOnboardingProject(data,property)
}

export async function setOnboardingTask({propertyId,section,task,done}){const property=requirePropertyId(propertyId),{data,error}=await supabase.rpc("hl_onboarding_set_task",{p_property_id:property,p_section:section,p_task:task,p_done:!!done});if(error)throw error;return normalizeOnboardingProject(data,property)}
