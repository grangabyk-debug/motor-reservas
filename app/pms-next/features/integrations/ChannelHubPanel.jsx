"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./channelManager.module.css"

const CHANNELS=[
  {code:"BDC",name:"Booking.com",mark:"B",color:"#1769d2"},
  {code:"ABB",name:"Airbnb",mark:"A",color:"#e75b67"},
  {code:"EXP",name:"Expedia",mark:"E",color:"#d29a21"},
  {code:"DDC",name:"Despegar",mark:"D",color:"#6858d9"},
  {code:"AGO",name:"Agoda",mark:"Ag",color:"#8b5bc9"},
]
const STATUS={not_configured:"Sin preparar",staging:"Prueba",active:"Activo",paused:"Pausado",error:"Revisar"}

async function authPost(path,propertyId){
  const{data:{session}}=await supabase.auth.getSession()
  if(!session?.access_token)throw new Error("La sesión venció. Volvé a ingresar.")
  const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({property_id:propertyId})})
  const payload=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(payload?.error||"No se pudo completar la operación.")
  return payload
}

export default function ChannelHubPanel({propertyId,property}){
  const[hub,setHub]=useState(null),[mappings,setMappings]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[frame,setFrame]=useState("")
  const canManage=["owner","manager"].includes(property?.role)
  const load=useCallback(async()=>{if(!propertyId)return;setLoading(true);setError("");try{const[hubRes,mapRes]=await Promise.all([supabase.from("hotel_channel_hubs").select("id,provider,status,mode,external_property_id,allowed_channels,diagnostics,last_sync_at,last_error,updated_at").eq("property_id",propertyId).eq("provider","channex").maybeSingle(),supabase.from("hotel_channel_hub_mappings").select("id,hub_id,entity_type,local_key,external_id,metadata").eq("property_id",propertyId)]);if(hubRes.error)throw hubRes.error;if(mapRes.error)throw mapRes.error;setHub(hubRes.data||null);setMappings(mapRes.data||[])}catch(err){setError(err?.message||"No se pudo cargar el Channel Hub.")}finally{setLoading(false)}},[propertyId])
  useEffect(()=>{load()},[load])
  const roomTypes=useMemo(()=>mappings.filter(item=>item.entity_type==="room_type").length,[mappings]),ratePlans=useMemo(()=>mappings.filter(item=>item.entity_type==="rate_plan").length,[mappings])

  async function prepare(){if(!canManage)return;setBusy(true);setError("");try{await authPost("/api/integrations/channex/provision",propertyId);await load()}catch(err){setError(err?.message||"No se pudo preparar Channex.")}finally{setBusy(false)}}
  async function open(){if(!canManage)return;setBusy(true);setError("");try{if(!hub?.external_property_id){await authPost("/api/integrations/channex/provision",propertyId);await load()}const data=await authPost("/api/integrations/channex/session",propertyId);setFrame(data.iframe_url)}catch(err){setError(err?.message||"No se pudo abrir el Channel Hub.")}finally{setBusy(false)}}

  return <div className={s.wrap} style={{marginBottom:14}}>
    <header className={s.hero}><div><small>CHANNEL HUB · CHANNEX</small><h2>Conectividad multicanal</h2><p>Una propiedad aislada por hotel. Booking, Airbnb y demás canales se autorizan sin compartir credenciales entre tenants.</p></div>{canManage?<button className={s.primary} onClick={hub?.external_property_id?open:prepare} disabled={busy||loading}>{busy?"Preparando…":hub?.external_property_id?"Abrir Channel Hub":"Preparar Channel Hub"}</button>:null}</header>
    <div className={s.metrics}><article className={s.metric} data-tone={hub?.external_property_id?"green":undefined}><span>Hub</span><b>{loading?"…":STATUS[hub?.status||"not_configured"]}</b></article><article className={s.metric}><span>Tipos mapeados</span><b>{roomTypes}</b></article><article className={s.metric}><span>Planes tarifarios</span><b>{ratePlans}</b></article><article className={s.metric}><span>Canales iniciales</span><b>{CHANNELS.length}</b></article></div>
    {error?<div className={s.alert}><span>{error}</span><button onClick={()=>setError("")}>×</button></div>:null}
    {hub?.last_error&&!error?<div className={s.alert}><span>{hub.last_error}</span><button onClick={()=>setError(hub.last_error)}>Ver</button></div>:null}
    <div className={s.cards} style={{gridTemplateColumns:"repeat(5,minmax(0,1fr))"}}>{CHANNELS.map(channel=><article className={s.card} key={channel.code} style={{minWidth:0,padding:12,gap:8}}><div className={s.brand}><span className={s.mark} style={{color:channel.color,width:34,height:34,borderRadius:10}}>{channel.mark}</span><div style={{minWidth:0}}><small>{channel.code}</small><h3 style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{channel.name}</h3></div></div><small style={{color:"var(--muted)",fontSize:10,lineHeight:1.4}}>Se conecta dentro del hub de esta propiedad.</small></article>)}</div>
    <div className={s.security}><span>✓</span><div><b>Aislamiento multitenant</b><small>Habitación Llena conserva un único API key de infraestructura sólo en servidor. Cada hotel obtiene su propio Property ID en Channex y el acceso embebido se genera con un token temporal limitado a esa propiedad.</small></div></div>
    {frame?<div className={s.backdrop} onMouseDown={event=>event.target===event.currentTarget&&setFrame("")}><aside className={s.drawer} style={{width:"min(980px,100%)"}} onMouseDown={event=>event.stopPropagation()}><header className={s.drawerHead}><div><small>CHANNEL HUB</small><h2>Conectar y mapear canales</h2><p>Vista segura de Channex limitada a esta propiedad y a los canales iniciales habilitados.</p></div><button className={s.close} onClick={()=>setFrame("")} aria-label="Cerrar">×</button></header><iframe title="Channel Hub Channex" src={frame} style={{width:"100%",height:"100%",border:0,background:"#fff"}} allow="clipboard-read; clipboard-write"/><footer className={s.drawerFooter}><span>Los cambios de canales quedan asociados únicamente a esta propiedad.</span><div><button onClick={()=>{setFrame("");load()}}>Cerrar</button></div></footer></aside></div>:null}
  </div>
}
