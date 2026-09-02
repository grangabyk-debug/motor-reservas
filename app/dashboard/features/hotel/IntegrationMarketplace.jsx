"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{commerceRegion,regionalProviderState}from"../../core/regionalCommerce"
import{loadPaymentProviderStatus,startPaymentProviderConnection}from"../../services/paymentProviders"
import ui from"../../v2.module.css"
import s from"./integration-marketplace.module.css"

const CATALOG=[
  {id:"motor",name:"Motor directo",group:"Venta",region:"Global",desc:"Recibí reservas directas usando el inventario del hotel."},
  {id:"booking",name:"Booking.com",group:"Canales",region:"Global",desc:"Centralizá disponibilidad y reservas desde Booking.com."},
  {id:"expedia",name:"Expedia",group:"Canales",region:"Global",desc:"Gestioná Expedia desde el mismo espacio de trabajo."},
  {id:"airbnb",name:"Airbnb",group:"Canales",region:"Global",desc:"Sincronización de inventario y reservas para propiedades compatibles."},
  {id:"google",name:"Google Hotel",group:"Canales",region:"Global",desc:"Venta directa desde Google Hotel cuando el conector esté habilitado."},
  {id:"mercadopago",name:"Mercado Pago",group:"Pagos",region:"Regional",desc:"Cobros online y garantías para propiedades compatibles."},
  {id:"stripe",name:"Stripe",group:"Pagos",region:"Internacional",desc:"Cobros con tarjeta para países donde Stripe está disponible."},
  {id:"arca",name:"ARCA",group:"Fiscal",region:"Argentina",desc:"Facturación electrónica para propiedades en Argentina."},
  {id:"whatsapp",name:"WhatsApp",group:"Mensajería",region:"Global",desc:"Mensajería del huésped desde un único lugar."},
  {id:"locks",name:"Cerraduras",group:"Accesos",region:"Global",desc:"Conectá accesos y llaves compatibles."},
  {id:"scanner",name:"Escáner de documentos",group:"Recepción",region:"Regional",desc:"Acelerá el check-in leyendo documentos compatibles."},
  {id:"web-checkin",name:"Web Check-in",group:"Experiencia",region:"Global",desc:"Enviá un link seguro para que el huésped complete sus datos antes de llegar."},
]
function operational(settings){const value=settings?.operational_settings;return value&&typeof value==="object"?value:{}}
function initials(name){return String(name||"HL").replace(/[^a-z0-9]/gi,"").slice(0,2).toUpperCase()||"HL"}
function stateText(state){return state==="ready"?"Conectado":state==="available"?"Conectar":state==="setup"?"Requiere acción":state==="region"?"No disponible":state==="soon"?"Próximamente":"Próximamente"}

export default function IntegrationMarketplace({settings,channels=[]}){
  const ops=operational(settings),region=commerceRegion(ops),propertyId=settings?.property_id||"",[group,setGroup]=useState("Todos"),[mpStatus,setMpStatus]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("")
  const groups=["Todos",...new Set(CATALOG.map(item=>item.group))],motorConnected=channels.some(c=>String(c.provider).toLowerCase().includes("motor")&&c.status==="connected"),encoder=ops.key_encoder||{},mpRegion=regionalProviderState("mercadopago",ops)
  const refreshMercadoPago=useCallback(async()=>{if(!propertyId||mpRegion!=="available"){setMpStatus(null);return}setMessage("");try{setMpStatus(await loadPaymentProviderStatus({providerId:"mercadopago",propertyId}))}catch(error){setMpStatus(null);setMessage(error.message||"No pudimos revisar Mercado Pago.")}},[propertyId,mpRegion])
  useEffect(()=>{refreshMercadoPago();const handler=()=>refreshMercadoPago();window.addEventListener("hl:mercadopago-connected",handler);return()=>window.removeEventListener("hl:mercadopago-connected",handler)},[refreshMercadoPago])
  async function connectMercadoPago(){setBusy(true);setMessage("");try{const data=await startPaymentProviderConnection({providerId:"mercadopago",propertyId});window.location.href=data.url}catch(error){setMessage(error.message||"No se pudo iniciar la conexión con Mercado Pago.");setBusy(false)}}
  const cards=useMemo(()=>CATALOG.filter(item=>group==="Todos"||item.group===group).map(item=>{let state="soon",detail=item.desc,regionLabel=item.region
    if(item.id==="web-checkin")state="ready"
    if(item.id==="motor")state=motorConnected?"ready":"available"
    if(item.id==="locks")state=encoder.enabled&&encoder.bridge_url?"ready":"available"
    if(item.id==="mercadopago"){
      if(mpRegion!=="available")state="region"
      else if(mpStatus?.connected)state="ready"
      else if(mpStatus?.platformReady===false)state="setup"
      else state="available"
      regionLabel=region.name
      if(state==="ready")detail="Mercado Pago está conectado para esta propiedad."
      if(state==="setup")detail="Falta completar una habilitación antes de conectarlo."
    }
    if(item.id==="arca"){state=region.country==="AR"?"available":"region";regionLabel=region.name}
    if(item.id==="stripe"){state=regionalProviderState("stripe",ops)==="available"?"soon":"region";regionLabel=region.name}
    return{...item,state,desc:detail,region:regionLabel}
  }),[group,motorConnected,encoder.enabled,encoder.bridge_url,region.country,region.name,mpRegion,mpStatus?.connected,mpStatus?.platformReady])
  const ready=cards.filter(item=>item.state==="ready").length,available=cards.filter(item=>item.state==="available").length
  return <div className={ui.content}>
    <section className={s.hero}><div><small>CHANNEL</small><h2>Conectá lo que usás. Nada más.</h2><p>Canales, pagos y servicios del hotel en un solo lugar. Elegís una conexión, la activás y seguís trabajando.</p></div><div className={s.heroStats}><span><b>{ready}</b>Conectados</span><span><b>{available}</b>Disponibles</span><span><b>{region.country==="OTHER"?"GL":region.country}</b>{region.name}</span></div></section>
    <div className={s.filters}>{groups.map(item=><button key={item} className={group===item?s.active:""} onClick={()=>setGroup(item)}>{item}</button>)}</div>
    {message&&<div className={s.providerMessage}>{message}</div>}
    <section className={s.grid}>{cards.map(card=><article key={card.id} className={s.card}><header><span>{initials(card.name)}</span><div><small>{card.group}</small><h3>{card.name}</h3></div><em className={card.state==="soon"?s.roadmap:s[card.state]}>{stateText(card.state)}</em></header><p>{card.desc}</p>{card.id==="mercadopago"&&card.state==="available"&&<div className={s.cardAction}>{mpStatus?.canManage?<button type="button" disabled={busy} onClick={connectMercadoPago}>{busy?"Abriendo…":"Conectar"}</button>:<span>El propietario o administrador puede conectarlo.</span>}</div>}<footer><span>{card.region}</span><b>{stateText(card.state)}</b></footer></article>)}</section>
  </div>
}
