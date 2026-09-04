"use client"

import{useCallback,useEffect,useState}from"react"
import{supabase}from"../../../lib/supabase"
import{FEATURE_DEFAULTS,resolveFeatureFlags}from"./featureFlags"

export default function usePropertyFeatureFlags(propertyId){
  const[flags,setFlags]=useState({...FEATURE_DEFAULTS})
  const[settings,setSettings]=useState({})
  const[status,setStatus]=useState("loading")

  const apply=useCallback(value=>{const next=value||{};setSettings(next);setFlags(resolveFeatureFlags(next));setStatus("ready")},[])

  useEffect(()=>{
    let cancelled=false
    async function load(){
      if(!propertyId){setFlags({...FEATURE_DEFAULTS});setSettings({});setStatus("idle");return}
      setStatus("loading")
      const{data,error}=await supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle()
      if(cancelled)return
      if(error){setFlags({...FEATURE_DEFAULTS});setSettings({});setStatus("error");return}
      apply(data?.settings||{})
    }
    const onUpdated=event=>{if(event.detail?.propertyId===propertyId&&event.detail?.settings)apply(event.detail.settings)}
    load();window.addEventListener("hl:property-settings-updated",onUpdated)
    return()=>{cancelled=true;window.removeEventListener("hl:property-settings-updated",onUpdated)}
  },[propertyId,apply])

  return{flags,settings,status,enabled:key=>Boolean(flags[key])}
}
