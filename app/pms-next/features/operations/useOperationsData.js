"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

export default function useOperationsData(propertyId){
  const[tickets,setTickets]=useState([])
  const[rooms,setRooms]=useState([])
  const[profiles,setProfiles]=useState([])
  const[checklistCatalog,setChecklistCatalog]=useState([])
  const[housekeepingTasks,setHousekeepingTasks]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1)
      const[ticketRes,roomRes,catalogRes,hkRes,membersRes]=await Promise.all([
        supabase.from("hotel_maintenance_tickets").select("id,room_id,resource_id,title,description,priority,status,assigned_to,reported_by,due_at,started_at,completed_at,cost,photos,notes,created_at,updated_at").eq("property_id",propertyId).order("created_at",{ascending:false}),
        supabase.from("habitaciones").select("id,nombre,tipo").eq("property_id",propertyId).eq("activa",true),
        supabase.from("hotel_housekeeping_checklist_catalog").select("id,label,required,transition,sort_order,active,created_at,updated_at").eq("property_id",propertyId).order("sort_order"),
        supabase.from("hotel_housekeeping_tasks").select("id,room_id,task_type,status,assigned_to,scheduled_for,checklist,notes,updated_at").eq("property_id",propertyId).gte("scheduled_for",start.toISOString()).lt("scheduled_for",end.toISOString()).order("scheduled_for"),
        supabase.from("property_members").select("user_id,role").eq("property_id",propertyId),
      ])
      for(const result of[ticketRes,roomRes,catalogRes,hkRes,membersRes])if(result.error)throw result.error
      const ids=(membersRes.data||[]).map(item=>item.user_id);let profileRows=[]
      if(ids.length){const{data,error:profileError}=await supabase.from("profiles").select("id,full_name,role").in("id",ids);if(profileError)throw profileError;profileRows=data||[]}
      setTickets(ticketRes.data||[]);setRooms(roomRes.data||[]);setChecklistCatalog(catalogRes.data||[]);setHousekeepingTasks(hkRes.data||[]);setProfiles(profileRows)
    }catch(err){setError(err?.message||"No se pudo cargar Operaciones.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])

  const roomById=useMemo(()=>new Map(rooms.map(room=>[Number(room.id),room])),[rooms])
  const profileById=useMemo(()=>new Map(profiles.map(profile=>[profile.id,profile])),[profiles])

  const createTicket=useCallback(async draft=>{
    const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
    const payload={property_id:propertyId,room_id:draft.room_id?Number(draft.room_id):null,title:draft.title.trim(),description:draft.description?.trim()||null,priority:draft.priority||"normal",status:"open",assigned_to:draft.assigned_to||null,reported_by:userData?.user?.id||null,due_at:draft.due_at||null,cost:0,photos:[],notes:null}
    const{data,error:insertError}=await supabase.from("hotel_maintenance_tickets").insert(payload).select().single();if(insertError)throw insertError
    setTickets(list=>[data,...list]);return data
  },[propertyId])

  const updateTicket=useCallback(async(id,patch)=>{
    const now=new Date().toISOString(),extra={updated_at:now}
    if(patch.status==="in_progress")extra.started_at=now
    if(patch.status==="resolved")extra.completed_at=now
    const{data,error:updateError}=await supabase.from("hotel_maintenance_tickets").update({...patch,...extra}).eq("id",id).eq("property_id",propertyId).select().single();if(updateError)throw updateError
    setTickets(list=>list.map(item=>item.id===data.id?data:item));return data
  },[propertyId])

  const createChecklistItem=useCallback(async label=>{
    const nextOrder=checklistCatalog.reduce((max,item)=>Math.max(max,item.sort_order||0),0)+1
    const{data,error:insertError}=await supabase.from("hotel_housekeeping_checklist_catalog").insert({property_id:propertyId,label:label.trim(),required:true,transition:"clean_to_inspected",sort_order:nextOrder,active:true}).select().single();if(insertError)throw insertError
    setChecklistCatalog(list=>[...list,data]);return data
  },[propertyId,checklistCatalog])

  const toggleChecklistItem=useCallback(async item=>{
    const{data,error:updateError}=await supabase.from("hotel_housekeeping_checklist_catalog").update({active:!item.active,updated_at:new Date().toISOString()}).eq("id",item.id).eq("property_id",propertyId).select().single();if(updateError)throw updateError
    setChecklistCatalog(list=>list.map(row=>row.id===data.id?data:row));return data
  },[propertyId])

  return{tickets,rooms,profiles,checklistCatalog,housekeepingTasks,roomById,profileById,loading,error,setError,load,createTicket,updateTicket,createChecklistItem,toggleChecklistItem}
}
