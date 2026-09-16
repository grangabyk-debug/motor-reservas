"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../lib/supabase"

const STORAGE_KEY="hl:pms-next:property"
function isMissingSession(error){const name=String(error?.name||"").toLowerCase(),message=String(error?.message||"").toLowerCase();return name.includes("authsessionmissing")||message.includes("auth session missing")||message.includes("session missing")}

export default function usePmsSession(){
  const[user,setUser]=useState(null),[properties,setProperties]=useState([]),[propertyId,setPropertyId]=useState(null),[status,setStatus]=useState("loading"),[error,setError]=useState("")
  const load=useCallback(async()=>{setStatus("loading");setError("");const unauthenticated=()=>{setUser(null);setProperties([]);setPropertyId(null);setStatus("unauthenticated");if(typeof window!=="undefined"&&window.location.pathname.startsWith("/pms-next"))window.location.replace("/login")};try{const{data:userData,error:userError}=await supabase.auth.getUser();if(userError){if(isMissingSession(userError)){unauthenticated();return}throw userError}const currentUser=userData?.user||null;setUser(currentUser);if(!currentUser){unauthenticated();return}
    const[propertyResult,membershipResult,controlResult]=await Promise.all([supabase.from("properties").select("id,name,city,owner_id,created_at").order("created_at",{ascending:true}),supabase.from("property_members").select("property_id,role").eq("user_id",currentUser.id),supabase.rpc("hl_my_property_controls")]);if(propertyResult.error)throw propertyResult.error;if(membershipResult.error)throw membershipResult.error;if(controlResult.error)throw controlResult.error
    const membershipMap=Object.fromEntries((membershipResult.data||[]).map(item=>[item.property_id,item.role])),controlMap=Object.fromEntries((controlResult.data||[]).map(item=>[item.property_id,item]));const allowed=(Array.isArray(propertyResult.data)?propertyResult.data:[]).filter(item=>controlMap[item.id]?.account_enabled!==false&&controlMap[item.id]?.maintenance_mode!==true).map(item=>({...item,role:item.owner_id===currentUser.id?"owner":membershipMap[item.id]||"member"}));setProperties(allowed);if(!allowed.length){setPropertyId(null);setStatus("no-property");return}const stored=typeof window!=="undefined"?window.localStorage.getItem(STORAGE_KEY):null,selected=allowed.some(item=>item.id===stored)?stored:allowed[0].id;setPropertyId(selected);if(typeof window!=="undefined")window.localStorage.setItem(STORAGE_KEY,selected);setStatus("ready")
  }catch(err){setStatus("error");setError(err?.message||"No se pudo cargar la cuenta del PMS.")}},[])
  useEffect(()=>{load()},[load])
  useEffect(()=>{
    if(status!=="ready"||!propertyId||typeof window==="undefined")return
    let cancelled=false,busy=false
    const verify=async()=>{if(busy||cancelled)return;busy=true;try{const{data,error:controlError}=await supabase.rpc("hl_my_property_controls");if(cancelled||controlError)return;const current=(data||[]).find(row=>String(row.property_id)===String(propertyId));if(!current||current.account_enabled===false||current.maintenance_mode===true)await load()}finally{busy=false}}
    const onFocus=()=>verify(),onVisibility=()=>{if(document.visibilityState==="visible")verify()},onCommercialChange=()=>verify()
    const timer=window.setInterval(verify,60000)
    window.addEventListener("focus",onFocus);window.addEventListener("hl:subscription-updated",onCommercialChange);document.addEventListener("visibilitychange",onVisibility)
    return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener("focus",onFocus);window.removeEventListener("hl:subscription-updated",onCommercialChange);document.removeEventListener("visibilitychange",onVisibility)}
  },[status,propertyId,load])
  const selectProperty=useCallback(id=>{if(!properties.some(item=>item.id===id))return;setPropertyId(id);if(typeof window!=="undefined")window.localStorage.setItem(STORAGE_KEY,id)},[properties])
  const property=useMemo(()=>properties.find(item=>item.id===propertyId)||null,[properties,propertyId])
  return{user,properties,property,propertyId,role:property?.role||null,status,error,selectProperty,reload:load}
}
