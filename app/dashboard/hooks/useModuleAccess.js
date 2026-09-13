"use client"

import{useCallback,useEffect,useState}from"react"
import{buildModuleAccess}from"../core/modules"
import{loadModuleAccess,subscribeModuleAccess}from"../services/subscriptions"

export function useModuleAccess(propertyId){
  const[access,setAccess]=useState(()=>buildModuleAccess())
  const[loading,setLoading]=useState(false)
  const refresh=useCallback(async()=>{
    if(!propertyId){setAccess(buildModuleAccess());return}
    setLoading(true)
    try{setAccess(await loadModuleAccess(propertyId))}
    catch(error){console.error("module access",error);setAccess(buildModuleAccess())}
    finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{refresh();return subscribeModuleAccess({propertyId,onChange:refresh})},[propertyId,refresh])
  return{...access,loading,refresh}
}
