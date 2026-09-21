"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../lib/supabase"
import{operationalDateKey}from"../features/reservations/operationalDate"

const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))
const fallbackDay=()=>operationalDateKey({})

export default function useOperationalDate(propertyId){
  const[day,setDay]=useState(()=>fallbackDay())
  useEffect(()=>{
    let cancelled=false,timer=null
    async function refresh(){
      if(!propertyId){if(!cancelled)setDay(fallbackDay());return}
      try{
        const{data,error}=await supabase.rpc("hl_operational_date",{p_property_id:propertyId})
        if(error)throw error
        if(!cancelled)setDay(validDate(data)?String(data):fallbackDay())
      }catch{
        if(!cancelled)setDay(fallbackDay())
      }
    }
    refresh()
    timer=setInterval(refresh,60000)
    return()=>{cancelled=true;if(timer)clearInterval(timer)}
  },[propertyId])
  return day
}
