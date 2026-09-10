"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./channelHub.module.css"

const CHANNELS=[
  {code:"BDC",name:"Booking.com",mark:"B",color:"#003580",logo:"https://cdn.simpleicons.org/bookingdotcom/003580",detail:"Reservas, disponibilidad, tarifas y restricciones."},
  {code:"ABB",name:"Airbnb",mark:"A",color:"#ff385c",logo:"https://cdn.simpleicons.org/airbnb/FF385C",detail:"Disponibilidad, precios y reservas del alojamiento."},
  {code:"EXP",name:"Expedia",mark:"E",color:"#191e3b",logo:"https://cdn.simpleicons.org/expedia/191E3B",detail:"Inventario, tarifas, restricciones y reservas."},
  {code:"DDC",name:"Despegar",mark:"D",color:"#6a42d8",logo:"https://upload.wikimedia.org/wikipedia/commons/d/db/Despegar.com_logo.svg",detail:"Canal regional para disponibilidad, tarifas y reservas."},
  {code:"AGO",name:"Agoda",mark:"Ag",color:"#5392f9",logo:"https://upload.wikimedia.org/wikipedia/commons/c/ca/Agoda_logo.svg",detail:"Distribución internacional de inventario y tarifas."},
]
const STATUS={not_configured:"Sin preparar",staging:"Listo para conectar",active:"Activo",paused:"Pausado",error:"Revisar"}

async function authPost(path,propertyId){
  const{data:{session}}=await supabase.auth.getSession()
  if(!session?.access_token)throw new Error("La sesión venció. Volvé a ingresar.")
  const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({property_id:propertyId})})
  const payload=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(payload?.error||"No se pudo completar la operación.")
  return payload
}

function BrandLogo({channel}){
  const[failed,setFailed]=useState(false)
  return <span className={s.logoBox} style={{"--brand":channel.color}}>
    {!failed?<img src={channel.logo} alt={`Logo de ${channel.name}`} onError={()=>setFailed(true)} referrerPolicy="no-referrer"/>:<b>{channel.mark}</b>}
  </span>
}

export default function ChannelHubPanel({propertyId,property}){
  const[hub,setHub]=useState(null),[mappings,setMappings]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[frame,setFrame]=useState(""),[selectedChannel,setSelectedChannel]=useState(null)
  const canManage=["owner","manager"].includes(property?.role)

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[hubRes,mapRes]=await Promise.all([
        supabase.from("hotel_channel_hubs").select("id,provider,status,mode,external_property_id,allowed_channels,diagnostics,last_sync_at,last_error,updated_at").eq("property_id",propertyId).eq("provider","channex").maybeSingle(),
        supabase.from("hotel_channel_hub_mappings").select("id,hub_id,entity_type,local_key,external_id,metadata").eq("property_id",propertyId),
      ])
      if(hubRes.error)throw hubRes.error
      if(mapRes.error)throw mapRes.error
      setHub(hubRes.data||null);setMappings(mapRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar el Channel Manager.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])

  const roomTypes=useMemo(()=>mappings.filter(item=>item.entity_type==="room_type").length,[mappings])
  const ratePlans=useMemo(()=>mappings.filter(item=>item.entity_type==="rate_plan").length,[mappings])
  const prepared=Boolean(hub?.external_property_id)
  const hubStatus=loading?"Cargando…":STATUS[hub?.status||"not_configured"]

  async function prepare(){
    if(!canManage)return
    setBusy(true);setError("");setNotice("")
    try{
      await authPost("/api/integrations/channex/provision",propertyId)
      await load()
      setNotice("El Channel Manager quedó preparado para este hotel. Ya podés conectar sus canales.")
    }catch(err){setError(err?.message||"No se pudo preparar el Channel Manager.")}
    finally{setBusy(false)}
  }

  async function openChannel(channel=null){
    if(!canManage)return
    setBusy(true);setError("");setNotice("");setSelectedChannel(channel)
    try{
      if(!prepared)await authPost("/api/integrations/channex/provision",propertyId)
      const data=await authPost("/api/integrations/channex/session",propertyId)
      setFrame(data.iframe_url)
      if(!prepared)await load()
    }catch(err){setError(err?.message||"No se pudo abrir la conexión de canales.");setSelectedChannel(null)}
    finally{setBusy(false)}
  }

  return <div className={s.shell}>
    <header className={s.hero}>
      <div className={s.heroGlow}/>
      <div className={s.heroCopy}>
        <small>INTEGRACIONES · CHANNEL MANAGER</small>
        <h2>Canales de venta</h2>
        <p>Conectá las cuentas de cada hotel con sus OTAs y administrá disponibilidad, tarifas y reservas desde un único inventario.</p>
        <div className={s.heroChips}><span>Multitenant</span><span>Sin compartir credenciales</span><span>Motor Channex</span></div>
      </div>
      <div className={s.heroAction}>
        <span className={s.hubState} data-state={hub?.status||"not_configured"}><i/>{hubStatus}</span>
        {canManage?<button className={s.primary} onClick={prepared?()=>openChannel():prepare} disabled={busy||loading}>{busy?"Preparando…":prepared?"Administrar canales":"Preparar Channel Manager"}</button>:null}
      </div>
    </header>

    {error?<div className={s.alert}><span>!</span><div><b>No se pudo completar la acción</b><small>{error}</small></div><button onClick={()=>setError("")} aria-label="Cerrar error">×</button></div>:null}
    {notice?<div className={s.notice}><span>✓</span><div><b>Listo</b><small>{notice}</small></div><button onClick={()=>setNotice("")} aria-label="Cerrar aviso">×</button></div>:null}

    <section className={s.summary}>
      <article><span>Estado del hub</span><b>{hubStatus}</b><small>{prepared?"Propiedad aislada y preparada":"Todavía no vinculado"}</small></article>
      <article><span>Tipos mapeados</span><b>{roomTypes}</b><small>Categorías del hotel</small></article>
      <article><span>Planes tarifarios</span><b>{ratePlans}</b><small>Sincronizables</small></article>
      <article><span>Canales iniciales</span><b>{CHANNELS.length}</b><small>Podemos sumar más después</small></article>
    </section>

    <section className={s.channelSection}>
      <header className={s.sectionHead}><div><small>DISTRIBUCIÓN</small><h3>Integraciones disponibles</h3><p>Empezamos con las OTAs más usadas. Cada conexión queda vinculada solamente a esta propiedad.</p></div>{prepared?<button className={s.secondary} onClick={()=>openChannel()} disabled={busy}>Abrir administrador</button>:null}</header>
      <div className={s.channelGrid}>{CHANNELS.map(channel=><article className={s.channelCard} key={channel.code} style={{"--brand":channel.color}}>
        <div className={s.cardTop}><BrandLogo channel={channel}/><span className={s.channelState} data-ready={prepared?"true":"false"}>{prepared?"Disponible":"Por preparar"}</span></div>
        <div className={s.cardCopy}><small>{channel.code}</small><h4>{channel.name}</h4><p>{channel.detail}</p></div>
        <div className={s.cardFoot}><span><i/>Aislado por hotel</span>{canManage?<button onClick={()=>openChannel(channel)} disabled={busy}>{prepared?"Conectar":"Preparar y conectar"}<b>→</b></button>:null}</div>
      </article>)}</div>
    </section>

    <section className={s.security}>
      <span className={s.securityIcon}>✓</span>
      <div><b>Aislamiento multitenant real</b><p>Habitación Llena usa una credencial de infraestructura solamente en servidor. Cada hotel obtiene su propio Property ID y una sesión temporal limitada a esa propiedad, por lo que conectar Booking o Airbnb de un alojamiento no toca las cuentas de otro.</p></div>
      <span className={s.securityBadge}>PROPERTY SCOPED</span>
    </section>

    {frame?<div className={s.backdrop} onMouseDown={event=>event.target===event.currentTarget&&setFrame("")}><aside className={s.drawer} onMouseDown={event=>event.stopPropagation()}>
      <header className={s.drawerHead}><div><small>CHANNEL MANAGER</small><h2>{selectedChannel?`Conectar ${selectedChannel.name}`:"Administrar canales"}</h2><p>Esta sesión está limitada al hotel seleccionado. Las credenciales del canal no quedan expuestas en Habitación Llena.</p></div><button className={s.close} onClick={()=>setFrame("")} aria-label="Cerrar">×</button></header>
      <iframe title={selectedChannel?`Conectar ${selectedChannel.name}`:"Channel Manager"} src={frame} className={s.frame} allow="clipboard-read; clipboard-write"/>
      <footer className={s.drawerFooter}><span>Los cambios quedan asociados únicamente a esta propiedad.</span><button onClick={()=>{setFrame("");setSelectedChannel(null);load()}}>Cerrar</button></footer>
    </aside></div>:null}
  </div>
}
