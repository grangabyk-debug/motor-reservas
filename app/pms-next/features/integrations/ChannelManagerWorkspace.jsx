"use client"

import{useCallback,useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import ChannelManagerPanel from"./ChannelManagerPanel"
import s from"./channelWorkspace.module.css"

export default function ChannelManagerWorkspace({propertyId,property}){
  const[connections,setConnections]=useState([]),[mappings,setMappings]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("")
  const load=useCallback(async()=>{if(!propertyId)return;setLoading(true);setError("");try{const[connRes,mapRes]=await Promise.all([supabase.from("hotel_channel_connections").select("id,provider,status,mode,account_ref,external_property_id,diagnostics,last_sync_at,last_error,updated_at").eq("property_id",propertyId).order("updated_at",{ascending:false}),supabase.from("hotel_channel_mappings").select("id,connection_id,mapping_type,local_key,channel_code,external_id,metadata,updated_at").eq("property_id",propertyId).order("mapping_type")]);if(connRes.error)throw connRes.error;if(mapRes.error)throw mapRes.error;setConnections(connRes.data||[]);setMappings(mapRes.data||[])}catch(err){setError(err?.message||"No se pudo cargar Channel Manager.")}finally{setLoading(false)}},[propertyId])
  useEffect(()=>{load()},[load])
  return <section className={s.page}>
    {error?<div className={s.alert}><span>{error}</span><button onClick={()=>setError("")}>×</button></div>:null}
    {notice?<div className={s.notice}><span>✓</span><b>{notice}</b><button onClick={()=>setNotice("")}>×</button></div>:null}
    {loading?<div className={s.loading}>Cargando canales…</div>:<ChannelManagerPanel propertyId={propertyId} property={property} connections={connections} mappings={mappings} onReload={load} onMessage={setNotice}/>} 
  </section>
}
