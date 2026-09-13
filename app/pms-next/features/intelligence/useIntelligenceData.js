"use client"

import{useCallback,useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const empty={rooms:[],reservations:[],payments:[],blocks:[],snapshots:[],channelCosts:[]}
const tables=["habitaciones","reservas","pagos","bloqueos","hotel_channel_costs"]

export default function useIntelligenceData(propertyId){
  const[data,setData]=useState(empty),[loading,setLoading]=useState(true),[error,setError]=useState("")
  const timer=useRef(null)
  const load=useCallback(async({capture=false}={})=>{
    if(!propertyId){setData(empty);setLoading(false);return}
    setError("")
    try{
      if(capture){const snap=await supabase.rpc("capture_hotel_analytics_snapshot",{p_property_id:propertyId});if(snap.error)throw snap.error}
      const from=new Date();from.setUTCDate(from.getUTCDate()-35)
      const queries=[
        supabase.from("habitaciones").select("*").eq("property_id",propertyId).order("sort_order").order("id"),
        supabase.from("reservas").select("*").eq("property_id",propertyId).order("fecha_entrada"),
        supabase.from("pagos").select("*").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(5000),
        supabase.from("bloqueos").select("*").eq("property_id",propertyId).order("fecha_desde"),
        supabase.from("hotel_analytics_daily_snapshots").select("*").eq("property_id",propertyId).gte("captured_on",from.toISOString().slice(0,10)).order("captured_on",{ascending:false}).order("stay_date").limit(5000),
        supabase.from("hotel_channel_costs").select("*").eq("property_id",propertyId).eq("active",true).order("channel_name"),
      ]
      const results=await Promise.all(queries),failed=results.find(result=>result.error)
      if(failed?.error)throw failed.error
      const[rooms,reservations,payments,blocks,snapshots,channelCosts]=results.map(result=>result.data||[])
      setData({rooms,reservations,payments,blocks,snapshots,channelCosts})
    }catch(err){setError(err?.message||"No se pudo cargar Inteligencia.")}finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{setLoading(true);load({capture:true})},[load])
  useEffect(()=>{if(!propertyId)return;const channel=supabase.channel(`pms-next-intelligence-${propertyId}`);tables.forEach(table=>channel.on("postgres_changes",{event:"*",schema:"public",table,filter:`property_id=eq.${propertyId}`},()=>{window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>load(),240)}));channel.subscribe();return()=>{window.clearTimeout(timer.current);supabase.removeChannel(channel)}},[propertyId,load])
  useEffect(()=>{const handler=()=>load();window.addEventListener("hl:pms-data-updated",handler);return()=>window.removeEventListener("hl:pms-data-updated",handler)},[load])
  const saveChannelCost=useCallback(async draft=>{if(!propertyId)throw new Error("Falta la propiedad activa.");const row={property_id:propertyId,channel_name:String(draft.channel_name||"").trim(),currency:String(draft.currency||"ARS").toUpperCase(),commission_percent:Math.max(0,Number(draft.commission_percent||0)),fixed_fee_per_reservation:Math.max(0,Number(draft.fixed_fee_per_reservation||0)),active:draft.active!==false,updated_at:new Date().toISOString()};if(!row.channel_name)throw new Error("Falta el canal.");const{data:result,error:e}=await supabase.from("hotel_channel_costs").upsert(row,{onConflict:"property_id,channel_name,currency"}).select("*").single();if(e)throw e;await load();return result},[propertyId,load])
  return useMemo(()=>({...data,loading,error,refresh:()=>load({capture:true}),saveChannelCost}),[data,loading,error,load,saveChannelCost])
}
