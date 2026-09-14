"use client"

import{useCallback,useEffect,useState}from"react"
import{supabase}from"../../../lib/supabase"
import{FEATURE_DEFAULTS,resolveFeatureFlags}from"./featureFlags"

export default function usePropertyFeatureFlags(propertyId){
  const[flags,setFlags]=useState({...FEATURE_DEFAULTS})
  const[settings,setSettings]=useState({})
  const[commercial,setCommercial]=useState(null)
  const[status,setStatus]=useState("loading")

  const apply=useCallback((value,snapshot)=>{
    const next=value||{}
    const modules=snapshot?.resolved_modules&&typeof snapshot.resolved_modules==="object"?snapshot.resolved_modules:null
    setSettings(next)
    setCommercial(snapshot||null)
    setFlags({...resolveFeatureFlags(next),__modules:modules,__subscription:snapshot?.subscription||null})
    setStatus("ready")
  },[])

  useEffect(()=>{
    let cancelled=false
    async function load(){
      if(!propertyId){setFlags({...FEATURE_DEFAULTS});setSettings({});setCommercial(null);setStatus("idle");return}
      setStatus("loading")
      const[settingsResult,commercialResult]=await Promise.all([
        supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
        supabase.rpc("hl_property_subscription_snapshot",{p_property_id:propertyId})
      ])
      if(cancelled)return
      if(settingsResult.error){setFlags({...FEATURE_DEFAULTS});setSettings({});setCommercial(null);setStatus("error");return}
      const snapshot=commercialResult.error||commercialResult.data?.error?null:commercialResult.data
      apply(settingsResult.data?.settings||{},snapshot)
    }
    const refresh=()=>load()
    const onVisibility=()=>{if(document.visibilityState==="visible")load()}
    load()
    window.addEventListener("hl:property-settings-updated",refresh)
    window.addEventListener("hl:subscription-updated",refresh)
    window.addEventListener("focus",refresh)
    document.addEventListener("visibilitychange",onVisibility)
    return()=>{cancelled=true;window.removeEventListener("hl:property-settings-updated",refresh);window.removeEventListener("hl:subscription-updated",refresh);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",onVisibility)}
  },[propertyId,apply])

  return{flags,settings,commercial,status,enabled:key=>Boolean(flags[key]),hasModule:key=>commercial?.resolved_modules?.[key]!==false}
}
