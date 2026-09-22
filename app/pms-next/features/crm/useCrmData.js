"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"

const OPPORTUNITY_FIELDS="id,property_id,guest_profile_id,stage,priority,name,email,phone,source_channel,desired_check_in,desired_check_out,adults,children,rooms_count,preferred_room_type,alternative_room_types,flexible_dates,flexibility_days,max_budget,currency,waitlist_until,next_follow_up_at,follow_up_channel,last_contacted_at,quote_id,reservation_id,assigned_to,notes,lost_reason,metadata,created_by,created_at,updated_at"
const GUEST_FIELDS="id,full_name,email,phone,last_stay_at"
const editablePayload=draft=>({
  guest_profile_id:draft.guest_profile_id||null,
  stage:draft.stage||"new",
  priority:draft.priority||"normal",
  name:String(draft.name||"").trim(),
  email:String(draft.email||"").trim()||null,
  phone:String(draft.phone||"").trim()||null,
  source_channel:draft.source_channel||"direct",
  desired_check_in:draft.desired_check_in||null,
  desired_check_out:draft.desired_check_out||null,
  adults:Math.max(0,Number(draft.adults)||0),
  children:Math.max(0,Number(draft.children)||0),
  rooms_count:Math.max(1,Number(draft.rooms_count)||1),
  preferred_room_type:String(draft.preferred_room_type||"").trim()||null,
  alternative_room_types:Array.isArray(draft.alternative_room_types)?draft.alternative_room_types:[],
  flexible_dates:Boolean(draft.flexible_dates),
  flexibility_days:Math.max(0,Number(draft.flexibility_days)||0),
  max_budget:draft.max_budget===""||draft.max_budget==null?null:Math.max(0,Number(draft.max_budget)||0),
  currency:draft.currency||"ARS",
  waitlist_until:(draft.stage||"new")==="waitlist"?(draft.waitlist_until||null):null,
  next_follow_up_at:draft.next_follow_up_at?new Date(draft.next_follow_up_at).toISOString():null,
  follow_up_channel:draft.follow_up_channel||null,
  notes:String(draft.notes||"").trim()||null,
  lost_reason:(draft.stage||"new")==="lost"?(String(draft.lost_reason||"").trim()||null):null
})

export default function useCrmData(propertyId){
  const[opportunities,setOpportunities]=useState([]),[guests,setGuests]=useState([]),[roomTypes,setRoomTypes]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("")

  const load=useCallback(async(silent=false)=>{
    if(!propertyId)return
    if(!silent)setLoading(true)
    setError("")
    try{
      const[oppRes,guestRes,roomRes]=await Promise.all([
        supabase.from("hotel_crm_opportunities").select(OPPORTUNITY_FIELDS).eq("property_id",propertyId).order("updated_at",{ascending:false}).limit(250),
        supabase.from("hotel_guest_profiles").select(GUEST_FIELDS).eq("property_id",propertyId).is("merged_into_id",null).order("last_stay_at",{ascending:false,nullsFirst:false}).order("full_name").limit(120),
        supabase.from("habitaciones").select("tipo").eq("property_id",propertyId).eq("activa",true)
      ])
      for(const result of[oppRes,guestRes,roomRes])if(result.error)throw result.error
      setOpportunities(oppRes.data||[])
      setGuests(guestRes.data||[])
      setRoomTypes([...new Set((roomRes.data||[]).map(row=>String(row.tipo||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")))
    }catch(err){setError(err?.message||"No se pudo cargar el CRM.")}
    finally{if(!silent)setLoading(false)}
  },[propertyId])

  useEffect(()=>{load(false)},[load])
  usePmsAutoRefresh(propertyId,load,["hotel_crm_opportunities","hotel_crm_opportunity_activities"])

  const createOpportunity=useCallback(async draft=>{
    const payload={property_id:propertyId,...editablePayload(draft)}
    if(!payload.name)throw new Error("Ingresá el nombre del contacto.")
    if(payload.desired_check_in&&payload.desired_check_out&&payload.desired_check_out<=payload.desired_check_in)throw new Error("La salida deseada debe ser posterior a la entrada.")
    const{data,error:insertError}=await supabase.from("hotel_crm_opportunities").insert(payload).select(OPPORTUNITY_FIELDS).single()
    if(insertError)throw insertError
    await supabase.rpc("hl_crm_log_activity_atomic",{p_opportunity_id:data.id,p_activity_type:"system",p_summary:data.stage==="waitlist"?"Oportunidad creada en Lista de espera.":"Oportunidad creada.",p_channel:null,p_metadata:{stage:data.stage}})
    setOpportunities(list=>[data,...list])
    return data
  },[propertyId])

  const updateOpportunity=useCallback(async(id,patch,activitySummary="")=>{
    const current=opportunities.find(row=>row.id===id)||{},payload=editablePayload({...current,...patch})
    if(!payload.name)throw new Error("Ingresá el nombre del contacto.")
    if(payload.desired_check_in&&payload.desired_check_out&&payload.desired_check_out<=payload.desired_check_in)throw new Error("La salida deseada debe ser posterior a la entrada.")
    const{data,error:updateError}=await supabase.from("hotel_crm_opportunities").update(payload).eq("id",id).eq("property_id",propertyId).select(OPPORTUNITY_FIELDS).single()
    if(updateError)throw updateError
    if(activitySummary)await supabase.rpc("hl_crm_log_activity_atomic",{p_opportunity_id:id,p_activity_type:"stage",p_summary:activitySummary,p_channel:null,p_metadata:{stage:data.stage}})
    setOpportunities(list=>list.map(row=>row.id===id?data:row))
    return data
  },[propertyId,opportunities])

  const logActivity=useCallback(async(id,type,summary,channel=null,metadata={})=>{
    const{data,error:rpcError}=await supabase.rpc("hl_crm_log_activity_atomic",{p_opportunity_id:id,p_activity_type:type,p_summary:summary,p_channel:channel,p_metadata:metadata})
    if(rpcError)throw rpcError
    if(["email","whatsapp","phone"].includes(type))setOpportunities(list=>list.map(row=>row.id===id?{...row,last_contacted_at:data.occurred_at}:row))
    return data
  },[])

  const loadActivities=useCallback(async id=>{
    if(!id)return[]
    const{data,error:activityError}=await supabase.from("hotel_crm_opportunity_activities").select("id,activity_type,channel,summary,metadata,occurred_at,created_by").eq("property_id",propertyId).eq("opportunity_id",id).order("occurred_at",{ascending:false}).limit(80)
    if(activityError)throw activityError
    return data||[]
  },[propertyId])

  const openCount=useMemo(()=>opportunities.filter(row=>!["won","lost"].includes(row.stage)).length,[opportunities])
  const waitlistCount=useMemo(()=>opportunities.filter(row=>row.stage==="waitlist").length,[opportunities])
  const overdueCount=useMemo(()=>{const now=Date.now();return opportunities.filter(row=>!["won","lost"].includes(row.stage)&&row.next_follow_up_at&&new Date(row.next_follow_up_at).getTime()<now).length},[opportunities])

  return{opportunities,guests,roomTypes,loading,error,setError,load,createOpportunity,updateOpportunity,logActivity,loadActivities,openCount,waitlistCount,overdueCount}
}
