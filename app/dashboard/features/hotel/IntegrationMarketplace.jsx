"use client"

import{useEffect,useMemo,useState}from"react"
import ui from"../../v2.module.css"
import s from"./integration-marketplace.module.css"

const CATALOG=[
  {id:"web-checkin",name:"Web Check-in",group:"Experiencia",region:"Global",kind:"native",desc:"Registro previo, datos del huésped y firma mediante link seguro."},
  {id:"motor",name:"Motor directo",group:"Venta",region:"Global",kind:"native",desc:"Reserva directa sobre el inventario de Habitación Llena."},
  {id:"mercadopago",name:"Mercado Pago",group:"Pagos",region:"Argentina / LatAm",kind:"local",desc:"Cobros online, garantías y links para la operación regional."},
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

const STEPS=[
  {id:"config",week:"Semana 1",title:"Construimos tu hotel",detail:"Habitaciones, categorías, tarifas, impuestos, usuarios, caja, extras, housekeeping y reglas."},
  {id:"data",week:"Semana 2",title:"Traemos tus datos",detail:"Reservas futuras, huéspedes, empresas, agencias y saldos con conciliación."},
  {id:"training",week:"Semana 3",title:"Entrenamos en paralelo",detail:"Recepción, reservas, administración y pisos trabajan en shadow mode sin cortar ventas."},
  {id:"golive",week:"Semana 4",title:"Go-live controlado",detail:"Delta final, pruebas y cambio de conexiones recién cuando todo está conciliado."},
]

function operational(settings){const v=settings?.operational_settings;return v&&typeof v==="object"?v:{}}
function initials(name){return String(name||"HL").replace(/[^a-z0-9]/gi,"").slice(0,2).toUpperCase()||"HL"}

export default function IntegrationMarketplace({settings,channels=[]}){
  const ops=operational(settings),propertyId=settings?.property_id||"hotel",storageKey=`hl-onboarding-${propertyId}`,[group,setGroup]=useState("Todos"),[done,setDone]=useState([])
  useEffect(()=>{try{setDone(JSON.parse(localStorage.getItem(storageKey)||"[]"))}catch{}},[storageKey])
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(done))}catch{}},[storageKey,done])
  const groups=["Todos",...new Set(CATALOG.map(x=>x.group))],motorConnected=channels.some(c=>String(c.provider).toLowerCase().includes("motor")&&c.status==="connected"),encoder=ops.key_encoder||{},email=ops.email||{}
  const cards=useMemo(()=>CATALOG.filter(item=>group==="Todos"||item.group===group).map(item=>{let state="available";if(item.id==="web-checkin")state="ready";if(item.id==="motor")state=motorConnected?"ready":"available";if(item.id==="locks")state=encoder.enabled&&encoder.bridge_url?"ready":"setup";if(item.kind==="roadmap")state="roadmap";if(item.id==="mercadopago")state="available";if(item.id==="arca")state="available";if(item.id==="stripe")state="country";return{...item,state}}),[group,motorConnected,encoder.enabled,encoder.bridge_url])
  const completed=STEPS.filter(step=>done.includes(step.id)).length,progress=Math.round(completed/STEPS.length*100)
  function toggle(id){setDone(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id])}
  return <div className={ui.content}>
    <section className={s.hero}><div><small>HOTEL APP MARKETPLACE</small><h2>Conectar sin convertirlo en un proyecto técnico.</h2><p>Un único lugar para ver qué está conectado, qué está disponible, qué requiere hardware y qué sigue en roadmap.</p></div><div className={s.heroStats}><span><b>{cards.filter(x=>x.state==="ready").length}</b>Listas</span><span><b>{CATALOG.length}</b>Catálogo</span><span><b>AR</b>Prioridad local</span></div></section>

    <div className={s.filters}>{groups.map(item=><button key={item} className={group===item?s.active:""} onClick={()=>setGroup(item)}>{item}</button>)}</div>
    <section className={s.grid}>{cards.map(card=><article key={card.id} className={s.card}><header><span>{initials(card.name)}</span><div><small>{card.group}</small><h3>{card.name}</h3></div><em className={s[card.state]}>{card.state==="ready"?"CONECTADO":card.state==="roadmap"?"ROADMAP":card.state==="setup"?"CONFIGURAR":card.state==="country"?"SEGÚN PAÍS":"DISPONIBLE"}</em></header><p>{card.desc}</p><footer><span>{card.region}</span><b>{card.kind==="native"?"Nativo":card.kind==="local"?"Regional":card.kind==="hardware"?"Hardware":"Integración"}</b></footer></article>)}</section>

    <section className={s.localFirst}><div><small>ARGENTINA PRIMERO</small><h3>Mercado Pago + ARCA forman la base local.</h3><p>El producto prioriza cobros y facturación que un hotel argentino necesita hoy. La capa internacional se habilita sin comprometer esa realidad regional.</p></div><div><small>GLOBAL READY</small><h3>Stripe se ofrece sólo donde corresponde.</h3><p>La disponibilidad depende del país de la propiedad. No mostramos un proveedor como conectado cuando no puede abrir cuenta localmente.</p></div></section>

    <section className={s.launch}><header><div><small>CENTRO DE PUESTA EN MARCHA</small><h2>Migración Llena · sin cerrar el hotel</h2><p>El hotel anterior sigue productivo mientras configuramos, importamos, entrenamos y conciliamos.</p></div><div className={s.progress}><strong>{progress}%</strong><span><i style={{width:`${progress}%`}}/></span><small>{completed} de {STEPS.length} etapas confirmadas</small></div></header><div className={s.steps}>{STEPS.map(step=><button key={step.id} className={done.includes(step.id)?s.stepDone:""} onClick={()=>toggle(step.id)}><i>{done.includes(step.id)?"✓":step.week.replace("Semana ","")}</i><span><small>{step.week}</small><b>{step.title}</b><p>{step.detail}</p></span><em>{done.includes(step.id)?"Completado":"Marcar listo"}</em></button>)}</div><div className={s.noDowntime}><span>●</span><div><b>Cero interrupción operativa</b><p>No significa conectar dos channel managers a la vez. Significa preparar todo antes del corte y cambiar las conexiones sólo en el go-live.</p></div></div></section>

    <section className={s.runtime}><div><small>CONFIGURACIÓN ACTUAL</small><h3>Lo que este hotel ya tiene preparado</h3></div><span className={email.mode==="api"?s.ok:s.pending}>Email {email.mode==="api"?"servidor":"por configurar"}</span><span className={encoder.enabled&&encoder.bridge_url?s.ok:s.pending}>Llaves {encoder.enabled&&encoder.bridge_url?"con bridge":"por configurar"}</span><span className={motorConnected?s.ok:s.pending}>Motor {motorConnected?"conectado":"disponible"}</span></section>
  </div>
}
