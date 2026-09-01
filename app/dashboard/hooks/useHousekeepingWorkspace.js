"use client"

import{useCallback,useEffect,useState}from"react"
import{loadHousekeepingWorkspace,subscribeHousekeepingWorkspace}from"../services/housekeepingWorkspace"

const EMPTY={schedules:[],history:[],checklist:[],reports:[],rules:[],tasks:[],maintenance:[],staff:[]}

export function useHousekeepingWorkspace(propertyId,seedTasks=[]){
  const[data,setData]=useState({...EMPTY,tasks:seedTasks})
  const[error,setError]=useState("")

  const refresh=useCallback(async()=>{
    if(!propertyId){setData({...EMPTY,tasks:seedTasks});return}
    const next=await loadHousekeepingWorkspace({propertyId})
    setData(next)
    setError("")
  },[propertyId,seedTasks])

  useEffect(()=>{setData(current=>({...current,tasks:seedTasks}))},[seedTasks])
  useEffect(()=>{
    if(!propertyId)return
    let alive=true
    refresh().catch(e=>alive&&setError(e.message||"No pudimos cargar la operación de pisos."))
    const unsubscribe=subscribeHousekeepingWorkspace({propertyId,onChange:()=>refresh().catch(()=>{})})
    return()=>{alive=false;unsubscribe()}
  },[propertyId,refresh])

  return{...data,error,refresh}
}
