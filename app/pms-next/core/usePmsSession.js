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

      const{data,error:propertiesError}=await supabase
        .from("properties")
        .select("id,name,city,owner_id,created_at")
        .order("created_at",{ascending:true})
      if(propertiesError)throw propertiesError

      const allowed=Array.isArray(data)?data:[]
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

  return{user,properties,property,propertyId,status,error,selectProperty,reload:load}
}
