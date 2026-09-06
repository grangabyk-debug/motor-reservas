"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"

export default function useOperationsData(propertyId){
  const[tickets,setTickets]=useState([]),[guestRequests,setGuestRequests]=useState([]),[reservations,setReservations]=useState([])
  const[rooms,setRooms]=useState([]),[profiles,setProfiles]=useState([]),[checklistCatalog,setChecklistCatalog]=useState([]),[housekeepingTasks,setHousekeepingTasks]=useState([])
  const[loading,setLoading]=useState(true),[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1)
      const[ticketRes,requestRes,reservationRes,roomRes,catalogRes,hkRes,membersRes]=await Promise.all([
        supabase.from("hotel_maintenance_tickets").select("id,room_id,resource_id,title,description,priority,status,assigned_to,reported_by,due_at,started_at,completed_at,cost,photos,notes,created_at,updated_at").eq("property_id",propertyId).order("created_at",{ascending:false}),
        supabase.from("hotel_guest_requests").select("id,reservation_id,room_id,title,detail,status,priority,assigned_to,requested_by,due_at,created_by,resolved_at,created_at,updated_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(300),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,habitacion_id,habitaciones_ids,estado,fecha_entrada,fecha_salida").eq("property_id",propertyId).not("estado","eq","cancelada").order("fecha_entrada",{ascending:false}).limit(300),
        supabase.from("habitaciones").select("id,nombre,tipo").eq("property_id",propertyId).eq("activa",true),
        supabase.from("hotel_housekeeping_checklist_catalog").select("id,label,required,transition,sort_order,active,created_at,updated_at").eq("property_id",propertyId).order("sort_order"),
        supabase.from("hotel_housekeeping_tasks").select("id,room_id,task_type,status,assigned_to,scheduled_for,checklist,notes,updated_at").eq("property_id",propertyId).gte("scheduled_for",start.toISOString()).lt("scheduled_for",end.toISOString()).order("scheduled_for"),
        supabase.from("property_members").select("user_id,role").eq("property_id",propertyId),
      ])
      for(const result of[ticketRes,requestRes,reservationRes,roomRes,catalogRes,hkRes,membersRes])if(result.error)throw result.error
      const ids=(membersRes.data||[]).map(item=>item.user_id);let profileRows=[]
      if(ids.length){const{data,error:profileError}=await supabase.from("profiles").select("id,full_name,role").in("id",ids);if(profileError)throw profileError;profileRows=data||[]}
      setTickets(ticketRes.data||[]);setGuestRequests(requestRes.data||[]);setReservations(reservationRes.data||[]);setRooms(roomRes.data||[]);setChecklistCatalog(catalogRes.data||[]);setHousekeepingTasks(hkRes.data||[]);setProfiles(profileRows)
    }catch(err){setError(err?.message||"No se pudo cargar Operaciones.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])
  usePmsAutoRefresh(propertyId,load,["reservas","habitaciones","hotel_housekeeping_tasks","hotel_maintenance_tickets","hotel_guest_requests"])

  const roomById=useMemo(()=>new Map(rooms.map(room=>[Number(room.id),room])),[rooms]),profileById=useMemo(()=>new Map(profiles.map(profile=>[profile.id,profile])),[profiles]),reservationById=useMemo(()=>new Map(reservations.map(item=>[Number(item.id),item])),[reservations])

  const createTicket=useCallback(async draft=>{const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const payload={property_id:propertyId,room_id:draft.room_id?Number(draft.room_id):null,title:draft.title.trim(),description:draft.description?.trim()||null,priority:draft.priority||"normal",status:"open",assigned_to:draft.assigned_to||null,reported_by:userData?.user?.id||null,due_at:draft.due_at||null,cost:0,photos:[],notes:null};const{data,error:insertError}=await supabase.from("hotel_maintenance_tickets").insert(payload).select().single();if(insertError)throw insertError;setTickets(list=>[data,...list]);return data},[propertyId])
  const updateTicket=useCallback(async(id,patch)=>{const now=new Date().toISOString(),extra={updated_at:now};if(patch.status==="in_progress")extra.started_at=now;if(patch.status==="resolved")extra.completed_at=now;const{data,error:updateError}=await supabase.from("hotel_maintenance_tickets").update({...patch,...extra}).eq("id",id).eq("property_id",propertyId).select().single();if(updateError)throw updateError;setTickets(list=>list.map(item=>item.id===data.id?data:item));return data},[propertyId])

  const createGuestRequest=useCallback(async draft=>{const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const reservation=draft.reservation_id?reservations.find(item=>Number(item.id)===Number(draft.reservation_id)):null;const roomId=draft.room_id?Number(draft.room_id):reservation?.habitacion_id?Number(reservation.habitacion_id):null;const payload={property_id:propertyId,reservation_id:draft.reservation_id?Number(draft.reservation_id):null,room_id:roomId,title:draft.title.trim(),detail:draft.detail?.trim()||null,status:"open",priority:draft.priority||"normal",assigned_to:draft.assigned_to||null,requested_by:draft.requested_by||"guest",due_at:draft.due_at||null,created_by:userData?.user?.id||null};const{data,error:insertError}=await supabase.from("hotel_guest_requests").insert(payload).select().single();if(insertError)throw insertError;setGuestRequests(list=>[data,...list]);return data},[propertyId,reservations])
  const updateGuestRequest=useCallback(async(id,patch)=>{const now=new Date().toISOString(),extra={updated_at:now};if(patch.status==="resolved")extra.resolved_at=now;else if(patch.status&&patch.status!=="resolved")extra.resolved_at=null;const{data,error:updateError}=await supabase.from("hotel_guest_requests").update({...patch,...extra}).eq("id",id).eq("property_id",propertyId).select().single();if(updateError)throw updateError;setGuestRequests(list=>list.map(item=>item.id===data.id?data:item));return data},[propertyId])

  const createChecklistItem=useCallback(async label=>{const nextOrder=checklistCatalog.reduce((max,item)=>Math.max(max,item.sort_order||0),0)+1;const{data,error:insertError}=await supabase.from("hotel_housekeeping_checklist_catalog").insert({property_id:propertyId,label:label.trim(),required:true,transition:"clean_to_inspected",sort_order:nextOrder,active:true}).select().single();if(insertError)throw insertError;setChecklistCatalog(list=>[...list,data]);return data},[propertyId,checklistCatalog])
  const toggleChecklistItem=useCallback(async item=>{const{data,error:updateError}=await supabase.from("hotel_housekeeping_checklist_catalog").update({active:!item.active,updated_at:new Date().toISOString()}).eq("id",item.id).eq("property_id",propertyId).select().single();if(updateError)throw updateError;setChecklistCatalog(list=>list.map(row=>row.id===data.id?data:row));return data},[propertyId])

  return{tickets,guestRequests,reservations,rooms,profiles,checklistCatalog,housekeepingTasks,roomById,profileById,reservationById,loading,error,setError,load,createTicket,updateTicket,createGuestRequest,updateGuestRequest,createChecklistItem,toggleChecklistItem}
}
