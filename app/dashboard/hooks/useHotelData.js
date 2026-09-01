"use client"
import{useCallback,useEffect,useRef,useState}from"react"
import{supabase}from"../../../lib/supabase"
import{createHotelRepository}from"../data/hotelRepository"
import{groupForView}from"../core/navigation"
import{expireTentativeReservations}from"../services/tentatives"

const empty={rooms:[],floors:[],reservations:[],payments:[],blocks:[],charges:[],channels:[],keyIssues:[],packages:[]}

export function useHotelData(propertyId,view){
  const[core,setCore]=useState(empty),[settings,setSettings]=useState(null),[guests,setGuests]=useState([]),[operations,setOperations]=useState({housekeeping:[],maintenance:[],resources:[]}),[commercial,setCommercial]=useState({rates:[],upsells:[],packages:[],partners:[],groups:[]}),[finance,setFinance]=useState({documents:[],sessions:[],movements:[]}),[hotel,setHotel]=useState({members:[],automations:[],events:[],permissions:[]}),[loading,setLoading]=useState(false),[error,setError]=useState(""),seq=useRef(0),group=groupForView(view).id
  const reload=useCallback(async()=>{
    if(!propertyId)return
    const run=++seq.current;setLoading(true);setError("")
    try{
      await expireTentativeReservations({propertyId})
      const repo=createHotelRepository(supabase,propertyId),[base,setting]=await Promise.all([repo.frontDeskSnapshot(),supabase.from("hotel_os_settings").select("*").eq("property_id",propertyId).maybeSingle()])
      if(run!==seq.current)return
      setCore(base);setSettings(setting.data||{property_id:propertyId,hotel_name:"Habitación Llena",theme:"olive",operational_settings:{}})
      if(group==="frontdesk"){
        const[g,p,groups]=await Promise.all([repo.guestCRM(),repo.partners(),repo.groups()]);if(run===seq.current){setGuests(g);setCommercial(x=>({...x,packages:base.packages||[],partners:p,groups}))}
      }
      if(group==="operations"){const o=await repo.operations();if(run===seq.current)setOperations(o)}
      if(group==="commercial"){
        const[c,p,groups]=await Promise.all([repo.commercial(),repo.partners(),repo.groups()]);if(run===seq.current)setCommercial({...c,partners:p,groups})
      }
      if(group==="finance"){
        const[f,p,groups,o]=await Promise.all([repo.finance(),repo.partners(),repo.groups(),repo.operations()]);if(run===seq.current){setFinance(f);setCommercial(x=>({...x,packages:base.packages||[],partners:p,groups}));setOperations(o)}
      }
      if(group==="hotel"){
        const[members,automations,events,permissions]=await Promise.all([supabase.from("property_members").select("user_id,role,created_at").eq("property_id",propertyId),supabase.from("hotel_automations").select("*").eq("property_id",propertyId).order("created_at"),supabase.from("hotel_automation_events").select("*").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),supabase.from("hotel_role_permissions").select("*").eq("property_id",propertyId)])
        const memberRows=members.data||[],ids=memberRows.map(m=>m.user_id),profiles=ids.length?(await supabase.from("profiles").select("id,full_name,role").in("id",ids)).data||[]:[]
        if(run===seq.current)setHotel({members:memberRows.map(m=>({...m,profile:profiles.find(p=>p.id===m.user_id)||null})),automations:automations.data||[],events:events.data||[],permissions:permissions.data||[]})
      }
    }catch(e){if(run===seq.current)setError(e.message||"No pudimos cargar el hotel.")}
    finally{if(run===seq.current)setLoading(false)}
  },[propertyId,group])
  useEffect(()=>{reload()},[reload])
  useEffect(()=>{if(!propertyId)return;const timer=setInterval(()=>{expireTentativeReservations({propertyId}).catch(()=>{})},60000);return()=>clearInterval(timer)},[propertyId])
  useEffect(()=>{if(!propertyId)return;const channel=supabase.channel(`hl-v2-${propertyId}`).on("postgres_changes",{event:"*",schema:"public",table:"reservas",filter:`property_id=eq.${propertyId}`},reload).on("postgres_changes",{event:"*",schema:"public",table:"habitaciones",filter:`property_id=eq.${propertyId}`},reload).on("postgres_changes",{event:"*",schema:"public",table:"pagos",filter:`property_id=eq.${propertyId}`},reload).on("postgres_changes",{event:"*",schema:"public",table:"hotel_packages",filter:`property_id=eq.${propertyId}`},reload).subscribe();return()=>{supabase.removeChannel(channel)}},[propertyId,reload])
  return{...core,settings,guests,operations,commercial,finance,hotel,loading,error,reload}
}
