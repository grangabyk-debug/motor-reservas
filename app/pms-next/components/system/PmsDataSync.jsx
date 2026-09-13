"use client"

import{useEffect,useRef}from"react"
import{supabase}from"../../../../lib/supabase"

const TABLES=["reservas","pagos","habitaciones","bloqueos","hotel_housekeeping_tasks","hotel_maintenance_tickets","hotel_guest_requests","hotel_guest_profiles","hotel_no_show_history","hotel_cancellation_policies","hotel_guarantees","hotel_reservation_events"]

function dispatch(name,detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent(name,{detail}))}

export default function PmsDataSync({propertyId}){
  const timerRef=useRef(null),pendingRef=useRef(new Set())
  useEffect(()=>{
    if(!propertyId)return
    const flush=()=>{timerRef.current=null;const tables=[...pendingRef.current];pendingRef.current.clear();dispatch("hl:pms-data-updated",{propertyId,tables,at:Date.now()})}
    const queue=table=>{if(table)pendingRef.current.add(table);if(timerRef.current)clearTimeout(timerRef.current);timerRef.current=setTimeout(flush,85)}
    const onChange=(table,payload)=>{
      queue(table)
      const detail={propertyId,table,eventType:payload?.eventType||"*",new:payload?.new||null,old:payload?.old||null}
      if(table==="reservas")dispatch("hl:pms-reservation-updated",detail)
      if(table==="pagos")dispatch("hl:pms-payment-updated",detail)
      if(table==="hotel_cancellation_policies")dispatch("hl:pms-cancellation-policies-updated",detail)
    }
    let channel=supabase.channel(`hl-pms-live-${propertyId}`)
    for(const table of TABLES)channel=channel.on("postgres_changes",{event:"*",schema:"public",table,filter:`property_id=eq.${propertyId}`},payload=>onChange(table,payload))
    channel.subscribe(status=>{if(status==="SUBSCRIBED")queue("reconnected")})
    const resume=()=>queue("resume")
    const visibility=()=>{if(document.visibilityState==="visible")resume()}
    window.addEventListener("focus",resume);document.addEventListener("visibilitychange",visibility)
    return()=>{if(timerRef.current)clearTimeout(timerRef.current);pendingRef.current.clear();window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",visibility);supabase.removeChannel(channel)}
  },[propertyId])
  return null
}
