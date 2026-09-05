"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../lib/supabase"

const STORAGE_KEY="hl:pms-next:property"

export default function usePmsSession(){
  const[user,setUser]=useState(null),[properties,setProperties]=useState([]),[propertyId,setPropertyId]=useState(null),[status,setStatus]=useState("loading"),[error,setError]=useState("")
  const load=useCallback(async()=>{setStatus("loading");setError("");try{const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const currentUser=userData?.user||null;setUser(currentUser);if(!currentUser){setProperties([]);setPropertyId(null);setStatus("unauthenticated");return}
    const[propertyResult,membershipResult,controlResult]=await Promise.all([supabase.from("properties").select("id,name,city,owner_id,created_at").order("created_at",{ascending:true}),supabase.from("property_members").select("property_id,role").eq("user_id",currentUser.id),supabase.rpc("hl_my_property_controls")]);if(propertyResult.error)throw propertyResult.error;if(membershipResult.error)throw membershipResult.error;if(controlResult.error)throw controlResult.error
    const membershipMap=Object.fromEntries((membershipResult.data||[]).map(item=>[item.property_id,item.role])),controlMap=Object.fromEntries((controlResult.data||[]).map(item=>[item.property_id,item]));const allowed=(Array.isArray(propertyResult.data)?propertyResult.data:[]).filter(item=>controlMap[item.id]?.account_enabled!==false).map(item=>({...item,role:item.owner_id===currentUser.id?"owner":membershipMap[item.id]||"member",maintenance_mode:Boolean(controlMap[item.id]?.maintenance_mode)}));setProperties(allowed);if(!allowed.length){setPropertyId(null);setStatus("no-property");return}const stored=typeof window!=="undefined"?window.localStorage.getItem(STORAGE_KEY):null,selected=allowed.some(item=>item.id===stored)?stored:allowed[0].id;setPropertyId(selected);if(typeof window!=="undefined")window.localStorage.setItem(STORAGE_KEY,selected);setStatus("ready")
  }catch(err){setStatus("error");setError(err?.message||"No se pudo cargar la cuenta del PMS.")}},[])
  useEffect(()=>{load()},[load])
  const selectProperty=useCallback(id=>{if(!properties.some(item=>item.id===id))return;setPropertyId(id);if(typeof window!=="undefined")window.localStorage.setItem(STORAGE_KEY,id)},[properties])
  const property=useMemo(()=>properties.find(item=>item.id===propertyId)||null,[properties,propertyId])
  return{user,properties,property,propertyId,role:property?.role||null,status,error,selectProperty,reload:load}
}
