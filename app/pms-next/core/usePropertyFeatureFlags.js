"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../lib/supabase"
import{FEATURE_DEFAULTS,resolveFeatureFlags}from"./featureFlags"

export default function usePropertyFeatureFlags(propertyId){
  const[flags,setFlags]=useState({...FEATURE_DEFAULTS})
  const[status,setStatus]=useState("loading")

  useEffect(()=>{
    let cancelled=false
    async function load(){
      if(!propertyId){setFlags({...FEATURE_DEFAULTS});setStatus("idle");return}
      setStatus("loading")
      const{data,error}=await supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle()
      if(cancelled)return
      if(error){setFlags({...FEATURE_DEFAULTS});setStatus("error");return}
      setFlags(resolveFeatureFlags(data?.settings||{}));setStatus("ready")
    }
    load()
    return()=>{cancelled=true}
  },[propertyId])

  return{flags,status,enabled:key=>Boolean(flags[key])}
}
