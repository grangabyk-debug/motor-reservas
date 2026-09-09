"use client"

import{useCallback,useEffect,useRef,useState}from"react"
import{supabase}from"../../../lib/supabase"

const KEY_PREFIX="hl:ops-notifications:"
const tableTitle={hotel_maintenance_tickets:"Mantenimiento",hotel_guest_requests:"Peticiones",hotel_housekeeping_tasks:"Housekeeping"}

function playAlert(){
  if(typeof window==="undefined")return
  try{
    const AudioContext=window.AudioContext||window.webkitAudioContext
    if(!AudioContext)return
    const ctx=new AudioContext(),gain=ctx.createGain(),osc=ctx.createOscillator()
    osc.type="sine";osc.frequency.setValueAtTime(740,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(980,ctx.currentTime+.13)
    gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.015);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.24)
    osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.25);osc.onended=()=>ctx.close().catch(()=>{})
  }catch{}
}

function notificationText(table,row={}){
  if(table==="hotel_maintenance_tickets")return row.title||"Nueva tarea de mantenimiento"
  if(table==="hotel_guest_requests")return row.title||"Nueva petición de huésped"
  if(table==="hotel_housekeeping_tasks")return`${String(row.task_type||"Tarea").replaceAll("_"," ")} · Hab. ${row.room_id||"—"}`
  return"Nueva novedad operativa"
}

export default function useOperationalNotifications({propertyId,area,tables=[],onRefresh}){
  const storageKey=`${KEY_PREFIX}${area}`,[enabled,setEnabled]=useState(false),enabledRef=useRef(false),refreshRef=useRef(onRefresh)
  refreshRef.current=onRefresh
  useEffect(()=>{if(typeof window==="undefined")return;const next=window.localStorage.getItem(storageKey)==="1";enabledRef.current=next;setEnabled(next)},[storageKey])

  const alert=useCallback((table,row)=>{
    refreshRef.current?.()
    if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:[table]}}))
    if(!enabledRef.current)return
    playAlert()
    if(typeof window!=="undefined"&&"Notification"in window&&Notification.permission==="granted"){
      try{new Notification(`${tableTitle[table]||"Habitación Llena"} · nueva alerta`,{body:notificationText(table,row),tag:`hl-${table}-${row?.id||Date.now()}`,renotify:true})}catch{}
    }
  },[propertyId])

  useEffect(()=>{
    if(!propertyId||!tables.length)return
    const channel=supabase.channel(`hl-${area}-${propertyId}-${Math.random().toString(36).slice(2)}`)
    tables.forEach(table=>channel.on("postgres_changes",{event:"*",schema:"public",table,filter:`property_id=eq.${propertyId}`},payload=>{
      if(payload.eventType==="INSERT")alert(table,payload.new||{})
      else refreshRef.current?.()
    }))
    channel.subscribe()
    return()=>{supabase.removeChannel(channel)}
  },[propertyId,area,tables.join("|"),alert])

  const toggle=useCallback(async()=>{
    const next=!enabledRef.current
    if(next&&typeof window!=="undefined"&&"Notification"in window&&Notification.permission==="default"){
      try{await Notification.requestPermission()}catch{}
    }
    enabledRef.current=next;setEnabled(next)
    if(typeof window!=="undefined")window.localStorage.setItem(storageKey,next?"1":"0")
    if(next)playAlert()
  },[storageKey])

  return{enabled,toggle}
}
