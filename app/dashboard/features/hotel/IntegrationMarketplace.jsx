"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{commerceRegion,regionalProviderLabel,regionalProviderState}from"../../core/regionalCommerce"
import{loadPaymentProviderStatus,startPaymentProviderConnection}from"../../services/paymentProviders"
import ui from"../../v2.module.css"
import s from"./integration-marketplace.module.css"
import OnboardingCenter from"./OnboardingCenter"

const CATALOG=[
  {id:"web-checkin",name:"Web Check-in",group:"Experiencia",region:"Global",kind:"native",desc:"Registro previo, datos del huésped y firma mediante link seguro."},
  {id:"motor",name:"Motor directo",group:"Venta",region:"Global",kind:"native",desc:"Reserva directa sobre el inventario de Habitación Llena."},
  {id:"mercadopago",name:"Mercado Pago",group:"Pagos",region:"Regional",kind:"local",desc:"Cobros online, garantías y links para propiedades donde Mercado Pago opera."},
  {id:"arca",name:"ARCA",group:"Fiscal",region:"Argentina",kind:"local",desc:"Facturación electrónica y circuitos fiscales del hotel argentino."},
  {id:"stripe",name:"Stripe",group:"Pagos",region:"Internacional · según país",kind:"global",desc:"Capa de cobro internacional para propiedades en países compatibles."},
  {id:"booking",name:"Booking.com",group:"Distribución",region:"Global",kind:"roadmap",desc:"Disponibilidad, tarifas y reservas mediante conectividad certificada."},
  {id:"expedia",name:"Expedia",group:"Distribución",region:"Global",kind:"roadmap",desc:"Conectividad OTA bidireccional cuando exista certificación productiva."},
  {id:"airbnb",name:"Airbnb",group:"Distribución",region:"Global",kind:"roadmap",desc:"Inventario y reservas para propiedades compatibles."},
  {id:"google",name:"Google Hotel",group:"Distribución",region:"Global",kind:"roadmap",desc:"Metabúsqueda y venta directa desde Google Hotel Ads."},
  {id:"whatsapp",name:"WhatsApp",group:"Mensajería",region:"Global",kind:"roadmap",desc:"Mensajería operacional y guest journey desde un único inbox."},
  {id:"locks",name:"Cerraduras",group:"Accesos",region:"Global",kind:"hardware",desc:"Encoders, llaves y accesos mediante bridge compatible."},
  {id:"scanner",name:"Escáner DNI",group:"Recepción",region:"Regional",kind:"hardware",desc:"Captura de identidad para acelerar el check-in."},
]
function operational(settings){const v=settings?.operational_settings;return v&&typeof v==="object"?v:{}}
function initials(name){return String(name||"HL").replace(/[^a-z0-9]/gi,"").slice(0,2).toUpperCase()||"HL"}
function stateText(state){return state==="ready"?"CONECTADO":state==="roadmap"?"ROADMAP":state==="setup"?"CONFIGURAR":state==="country"?"SEGÚN PAÍS":state==="region"?"OTRA REGIÓN":"DISPONIBLE"}

export default function IntegrationMarketplace({settings,channels=[]}){
  const ops=operational(settings),region=commerceRegion(ops),propertyId=settings?.property_id||"",[group,setGroup]=useState("Todos"),[mpStatus,setMpStatus]=useState(null),[providerBusy,setProviderBusy]=useState(false),[providerMessage,setProviderMessage]=useState("")
  const groups=["Todos",...new Set(CATALOG.map(x=>x.group))],motorConnected=channels.some(c=>String(c.provider).toLowerCase().includes("motor")&&c.status==="connected"),encoder=ops.key_encoder||{},email=ops.email||{},mpRegionalState=regionalProviderState("mercadopago",ops)
  const refreshMercadoPago=useCallback(async()=>{if(!propertyId||mpRegionalState!=="available"){setMpStatus(null);return}setProviderMessage("");try{setMpStatus(await loadPaymentProviderStatus({providerId:"mercadopago",propertyId}))}catch(error){setMpStatus(null);setProviderMessage(error.message||"No pudimos revisar Mercado Pago.")}},[propertyId,mpRegionalState])
  useEffect(()=>{refreshMercadoPago();const handler=()=>refreshMercadoPago();window.addEventListener("hl:mercadopago-connected",handler);return()=>window.removeEventListener("hl:mercadopago-connected",handler)},[refreshMercadoPago])
  async function connectMercadoPago(){setProviderBusy(true);setProviderMessage("");try{const data=await startPaymentProviderConnection({providerId:"mercadopago",propertyId});window.location.href=data.url}catch(error){setProviderMessage(error.message||"No se pudo iniciar la conexión con Mercado Pago.");setProviderBusy(false)}}
  const cards=useMemo(()=>CATALOG.filter(item=>group==="Todos"||item.group===group).map(item=>{let state="available",detail=item.desc,regionLabel=item.region;if(item.id==="web-checkin")state="ready";if(item.id==="motor")state=motorConnected?"ready":"available";if(item.id==="locks")state=encoder.enabled&&encoder.bridge_url?"ready":"setup";if(item.kind==="roadmap")state="roadmap";if(["mercadopago","arca","stripe"].includes(item.id)){state=regionalProviderState(item.id,ops);detail=regionalProviderLabel(item.id,ops);regionLabel=region.name}if(item.id==="mercadopago"&&state==="available"){if(mpStatus?.connected){state="ready";detail="La cuenta Mercado Pago de esta propiedad está conectada."}else if(mpStatus&&mpStatus.platformReady===false){state="setup";detail="El conector está instalado, pero faltan credenciales de plataforma en el servidor."}}return{...item,state,desc:detail,region:regionLabel}}),[group,motorConnected,encoder.enabled,encoder.bridge_url,region.country,region.currency,region.locale,region.timezone,mpStatus?.connected,mpStatus?.platformReady])
  const paymentBase=region.payments.includes("mercadopago")?"Mercado Pago":region.payments.includes("stripe")?"Stripe":"Proveedor según país",fiscalBase=region.country==="AR"?"ARCA":"Proveedor fiscal local"
  return <div className={ui.content}>
    <section className={s.hero}><div><small>HOTEL APP MARKETPLACE</small><h2>Conectar sin convertirlo en un proyecto técnico.</h2><p>Un único lugar para ver qué está conectado, qué está disponible, qué depende del país, qué requiere hardware y qué sigue en roadmap.</p></div><div className={s.heroStats}><span><b>{cards.filter(x=>x.state==="ready").length}</b>Listas</span><span><b>{CATALOG.length}</b>Catálogo</span><span><b>{region.country==="OTHER"?"GL":region.country}</b>{region.name}</span></div></section>
    <div className={s.filters}>{groups.map(item=><button key={item} className={group===item?s.active:""} onClick={()=>setGroup(item)}>{item}</button>)}</div>
    {providerMessage&&<div className={s.providerMessage}>{providerMessage}</div>}
    <section className={s.grid}>{cards.map(card=><article key={card.id} className={s.card}><header><span>{initials(card.name)}</span><div><small>{card.group}</small><h3>{card.name}</h3></div><em className={s[card.state]}>{stateText(card.state)}</em></header><p>{card.desc}</p>{card.id==="mercadopago"&&mpRegionalState==="available"&&<div className={s.cardAction}>{mpStatus?.connected?<span>✓ Conexión activa para esta propiedad</span>:mpStatus?.platformReady===false?<span>Activación de plataforma pendiente</span>:mpStatus?.canManage?<button type="button" disabled={providerBusy} onClick={connectMercadoPago}>{providerBusy?"Abriendo…":"Conectar Mercado Pago"}</button>:mpStatus?<span>Debe conectarlo propietario o administrador</span>:<span>Revisando estado…</span>}</div>}{card.id==="stripe"&&card.state==="available"&&<div className={s.cardAction}><span>Conector productivo: siguiente etapa</span></div>}<footer><span>{card.region}</span><b>{card.kind==="native"?"Nativo":card.kind==="local"?"Regional":card.kind==="hardware"?"Hardware":"Integración"}</b></footer></article>)}</section>
    <section className={s.localFirst}><div><small>{region.country==="AR"?"ARGENTINA PRIMERO":"BASE REGIONAL"}</small><h3>{paymentBase} + {fiscalBase}.</h3><p>La capa local se deriva del país configurado para esta propiedad. Moneda, fiscalidad y cobros no se mezclan con integraciones de otra jurisdicción.</p></div><div><small>GLOBAL READY</small><h3>Stripe sólo donde corresponda.</h3><p>La disponibilidad se evalúa según país y modalidad. Configurar una región no conecta cuentas ni guarda credenciales.</p></div></section>
    {propertyId&&<OnboardingCenter propertyId={propertyId} currency={region.currency}/>} 
    <section className={s.runtime}><div><small>CONFIGURACIÓN ACTUAL · {region.name.toUpperCase()}</small><h3>{region.currency} · {region.locale} · {region.timezone}</h3></div><span className={email.mode==="api"?s.ok:s.pending}>Email {email.mode==="api"?"servidor":"por configurar"}</span><span className={encoder.enabled&&encoder.bridge_url?s.ok:s.pending}>Llaves {encoder.enabled&&encoder.bridge_url?"con bridge":"por configurar"}</span><span className={motorConnected?s.ok:s.pending}>Motor {motorConnected?"conectado":"disponible"}</span><span className={mpStatus?.connected?s.ok:s.pending}>Mercado Pago {mpStatus?.connected?"conectado":mpRegionalState==="available"?"disponible":"otra región"}</span></section>
  </div>
}
