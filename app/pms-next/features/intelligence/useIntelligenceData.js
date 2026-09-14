"use client"

import{useCallback,useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const empty={rooms:[],reservations:[],payments:[],blocks:[],snapshots:[],channelCosts:[],conversations:[],messages:[],webEvents:[],quotes:[],groups:[]}
const tables=["habitaciones","reservas","pagos","bloqueos","hotel_channel_costs","hotel_web_events","hotel_group_quotes","hotel_groups","inbox_conversations"]

export default function useIntelligenceData(propertyId){
  const[data,setData]=useState(empty),[loading,setLoading]=useState(true),[error,setError]=useState("")
  const timer=useRef(null)
  const load=useCallback(async({capture=false}={})=>{
    if(!propertyId){setData(empty);setLoading(false);return}
    setError("")
    try{
      if(capture){const snap=await supabase.rpc("capture_hotel_analytics_snapshot",{p_property_id:propertyId});if(snap.error)throw snap.error}
      const from=new Date();from.setUTCDate(from.getUTCDate()-35)
      const commercialFrom=new Date();commercialFrom.setUTCFullYear(commercialFrom.getUTCFullYear()-1)
      const commercialIso=commercialFrom.toISOString()
      const queries=[
        supabase.from("habitaciones").select("*").eq("property_id",propertyId).order("sort_order").order("id"),
        supabase.from("reservas").select("*").eq("property_id",propertyId).order("fecha_entrada"),
        supabase.from("pagos").select("*").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(5000),
        supabase.from("bloqueos").select("*").eq("property_id",propertyId).order("fecha_desde"),
        supabase.from("hotel_analytics_daily_snapshots").select("*").eq("property_id",propertyId).gte("captured_on",from.toISOString().slice(0,10)).order("captured_on",{ascending:false}).order("stay_date").limit(5000),
        supabase.from("hotel_channel_costs").select("*").eq("property_id",propertyId).eq("active",true).order("channel_name"),
        supabase.from("inbox_conversations").select("id,channel,contact_name,contact_email,contact_phone,last_message_at,last_message_text,unread_count,status,reservation_id,guest_profile_id,created_at,updated_at").eq("property_id",propertyId).gte("created_at",commercialIso).order("last_message_at",{ascending:false,nullsFirst:false}).limit(3000),
        supabase.from("hotel_web_events").select("id,event_name,source,session_id,metadata,created_at").eq("property_id",propertyId).gte("created_at",commercialIso).order("created_at",{ascending:false}).limit(10000),
        supabase.from("hotel_group_quotes").select("id,group_id,quote_number,status,currency,total,sent_at,accepted_at,created_at,updated_at").eq("property_id",propertyId).gte("created_at",commercialIso).order("created_at",{ascending:false}).limit(3000),
        supabase.from("hotel_groups").select("id,name,status,contact_name,contact_email,contact_phone,sales_stage,budget_currency,budget_total,created_at,updated_at").eq("property_id",propertyId).gte("created_at",commercialIso).order("created_at",{ascending:false}).limit(3000),
      ]
      const results=await Promise.all(queries),failed=results.find(result=>result.error)
      if(failed?.error)throw failed.error
      const[rooms,reservations,payments,blocks,snapshots,channelCosts,conversations,webEvents,quotes,groups]=results.map(result=>result.data||[])
      const conversationIds=conversations.map(item=>item.id)
      let messages=[]
      if(conversationIds.length){
        for(let i=0;i<conversationIds.length;i+=250){const ids=conversationIds.slice(i,i+250),messageResult=await supabase.from("inbox_messages").select("id,conversation_id,direction,text,payload,occurred_at,created_at").in("conversation_id",ids).gte("occurred_at",commercialIso).order("occurred_at",{ascending:true}).limit(10000);if(messageResult.error)throw messageResult.error;messages.push(...(messageResult.data||[]))}
      }
      setData({rooms,reservations,payments,blocks,snapshots,channelCosts,conversations,messages,webEvents,quotes,groups})
    }catch(err){setError(err?.message||"No se pudo cargar Inteligencia.")}finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{setLoading(true);load({capture:true})},[load])
  useEffect(()=>{if(!propertyId)return;const channel=supabase.channel(`pms-next-intelligence-${propertyId}`);tables.forEach(table=>channel.on("postgres_changes",{event:"*",schema:"public",table,filter:`property_id=eq.${propertyId}`},()=>{window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>load(),240)}));channel.subscribe();return()=>{window.clearTimeout(timer.current);supabase.removeChannel(channel)}},[propertyId,load])
  useEffect(()=>{const handler=()=>load();window.addEventListener("hl:pms-data-updated",handler);return()=>window.removeEventListener("hl:pms-data-updated",handler)},[load])
  const saveChannelCost=useCallback(async draft=>{if(!propertyId)throw new Error("Falta la propiedad activa.");const row={property_id:propertyId,channel_name:String(draft.channel_name||"").trim(),currency:String(draft.currency||"ARS").toUpperCase(),commission_percent:Math.max(0,Number(draft.commission_percent||0)),fixed_fee_per_reservation:Math.max(0,Number(draft.fixed_fee_per_reservation||0)),active:draft.active!==false,updated_at:new Date().toISOString()};if(!row.channel_name)throw new Error("Falta el canal.");const{data:result,error:e}=await supabase.from("hotel_channel_costs").upsert(row,{onConflict:"property_id,channel_name,currency"}).select("*").single();if(e)throw e;await load();return result},[propertyId,load])
  return useMemo(()=>({...data,loading,error,refresh:()=>load({capture:true}),saveChannelCost}),[data,loading,error,load,saveChannelCost])
}
