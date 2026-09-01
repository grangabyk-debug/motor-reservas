"use client"

import{useCallback,useEffect,useState}from"react"
import{loadGroupsWorkspace}from"../services/groupsWorkspace"

const EMPTY={groups:[],quotes:[],lines:[],rooming:[],inventory:[]}

export function useGroupsWorkspace(propertyId){
  const[data,setData]=useState(EMPTY)
  const[loading,setLoading]=useState(false)
  const[error,setError]=useState("")

  const refresh=useCallback(async()=>{
    if(!propertyId){setData(EMPTY);return EMPTY}
    setLoading(true)
    try{
      const next=await loadGroupsWorkspace({propertyId})
      setData(next);setError("");return next
    }catch(e){setError(e.message||"No pudimos cargar grupos.");throw e}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{refresh().catch(()=>{})},[refresh])
  return{...data,loading,error,refresh}
}
