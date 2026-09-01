"use client"

import{useCallback,useEffect,useState}from"react"
import{loadAccessWorkspace,subscribeAccessWorkspace}from"../services/access"

const EMPTY={points:[],links:[],policy:null,grants:[],events:[],permissions:[],member:null,user:null}

export function useAccessWorkspace(propertyId){
  const[workspace,setWorkspace]=useState(EMPTY)
  const[error,setError]=useState("")
  const refresh=useCallback(async()=>{
    if(!propertyId){setWorkspace(EMPTY);return EMPTY}
    const next=await loadAccessWorkspace(propertyId)
    setWorkspace(next);setError("");return next
  },[propertyId])
  useEffect(()=>{
    if(!propertyId){setWorkspace(EMPTY);return}
    let alive=true
    refresh().catch(e=>alive&&setError(e.message||"No pudimos cargar los accesos."))
    const unsubscribe=subscribeAccessWorkspace(propertyId,()=>refresh().catch(()=>{}))
    return()=>{alive=false;unsubscribe()}
  },[propertyId,refresh])
  return{workspace,error,refresh}
}
