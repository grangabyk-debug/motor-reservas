"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../lib/supabase"

const STORAGE_KEY="hl:pms-next:property"

export default function usePmsSession(){
  const[user,setUser]=useState(null)
  const[properties,setProperties]=useState([])
  const[propertyId,setPropertyId]=useState(null)
  const[status,setStatus]=useState("loading")
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    setStatus("loading");setError("")
    try{
      const{data:userData,error:userError}=await supabase.auth.getUser()
      if(userError)throw userError
      const currentUser=userData?.user||null
      setUser(currentUser)
      if(!currentUser){setProperties([]);setPropertyId(null);setStatus("unauthenticated");return}

      const[propertyResult,membershipResult]=await Promise.all([
        supabase.from("properties").select("id,name,city,owner_id,created_at").order("created_at",{ascending:true}),
        supabase.from("property_members").select("property_id,role").eq("user_id",currentUser.id),
      ])
      if(propertyResult.error)throw propertyResult.error
      if(membershipResult.error)throw membershipResult.error

      const membershipMap=Object.fromEntries((membershipResult.data||[]).map(item=>[item.property_id,item.role]))
      const allowed=(Array.isArray(propertyResult.data)?propertyResult.data:[]).map(item=>({...item,role:item.owner_id===currentUser.id?"owner":membershipMap[item.id]||"member"}))
      setProperties(allowed)
      if(!allowed.length){setPropertyId(null);setStatus("no-property");return}

      const stored=typeof window!=="undefined"?window.localStorage.getItem(STORAGE_KEY):null
      const selected=allowed.some(item=>item.id===stored)?stored:allowed[0].id
      setPropertyId(selected)
      if(typeof window!=="undefined")window.localStorage.setItem(STORAGE_KEY,selected)
      setStatus("ready")
    }catch(err){
      setStatus("error")
      setError(err?.message||"No se pudo cargar la cuenta del PMS.")
    }
  },[])

  useEffect(()=>{load()},[load])

  const selectProperty=useCallback(id=>{
    if(!properties.some(item=>item.id===id))return
    setPropertyId(id)
    if(typeof window!=="undefined")window.localStorage.setItem(STORAGE_KEY,id)
  },[properties])

  const property=useMemo(()=>properties.find(item=>item.id===propertyId)||null,[properties,propertyId])

  return{user,properties,property,propertyId,role:property?.role||null,status,error,selectProperty,reload:load}
}
