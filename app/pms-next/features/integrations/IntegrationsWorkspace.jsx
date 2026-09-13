"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./integrations.module.css"

const SECTIONS={
  apps:{eyebrow:"INTEGRACIONES",title:"Apps externas",description:"Conectores útiles para ampliar el hotel sin mezclar la operación diaria."},
  api:{eyebrow:"INTEGRACIONES",title:"REST API",description:"Acceso programático seguro para desarrollos propios y partners autorizados."},
  messages:{eyebrow:"INTEGRACIONES",title:"Mensajería",description:"Canales para centralizar conversaciones de huéspedes y automatizaciones."},
  payments:{eyebrow:"INTEGRACIONES",title:"Pagos",description:"Pasarelas de cobro online conectadas al motor y a la caja del hotel."},
}
const APP_CARDS=[
  {id:"analytics",name:"Google Analytics",category:"Analítica",mark:"GA",brand:"analytics",description:"Medí visitas, búsquedas y conversiones del sitio y del motor de reservas.",status:"planned"},
  {id:"locks",name:"Cerraduras inteligentes",category:"Accesos",mark:"⌂",brand:"locks",description:"Preparado para generar accesos por reserva y asociarlos a cada habitación.",status:"planned"},
  {id:"automation",name:"Automatizaciones externas",category:"Automatización",mark:"↗",brand:"automation",description:"Conectores para llevar eventos del PMS a herramientas externas sin duplicar datos.",status:"planned"},
]
const MESSAGE_CARDS=[
  {id:"whatsapp",name:"WhatsApp",category:"Mensajería",mark:"W",brand:"whatsapp",description:"Centralizá consultas y mensajes del huésped dentro de la operación.",status:"planned"},
  {id:"telegram",name:"Telegram",category:"Mensajería",mark:"T",brand:"telegram",description:"Canal alternativo para avisos operativos y conversaciones autorizadas.",status:"planned"},
  {id:"gmail",name:"Gmail",category:"Email",mark:"M",brand:"gmail",description:"Vinculá una casilla del hotel para mantener los correos asociados al huésped.",status:"planned"},
]

export default function IntegrationsWorkspace({propertyId,section="apps",onNavigate}){
  const meta=SECTIONS[section]||SECTIONS.apps,[payment,setPayment]=useState(null),[loading,setLoading]=useState(section==="payments")
  useEffect(()=>{let alive=true;if(section!=="payments"){setLoading(false);return}setLoading(true);supabase.from("hotel_payment_connections").select("provider,status,live_mode,updated_at").eq("property_id",propertyId).maybeSingle().then(({data})=>{if(alive){setPayment(data||null);setLoading(false)}}).catch(()=>alive&&setLoading(false));return()=>{alive=false}},[propertyId,section])
  return <section className={s.catalogPage}>
    <header className={s.catalogHeader}><div><small>{meta.eyebrow}</small><h1>{meta.title}</h1><p>{meta.description}</p></div><span className={s.connectedCount}>{section==="payments"&&payment?.status==="connected"?"1 conectado":"Configuración simple"}</span></header>
    {section==="apps"?<CardGrid cards={APP_CARDS}/>:section==="messages"?<CardGrid cards={MESSAGE_CARDS}/>:section==="api"?<ApiPanel/>:<PaymentsPanel payment={payment} loading={loading} onNavigate={onNavigate}/>} 
  </section>
}

function CardGrid({cards}){return <><div className={s.sectionLabel}>DISPONIBLES PARA LA HOJA DE RUTA</div><div className={s.integrationGrid}>{cards.map(card=><article className={s.integrationCard} key={card.id}><div className={s.cardHead}><span className={s.appMark} data-brand={card.brand}>{card.mark}</span><span className={s.statusChip} data-status={card.status}>Próximamente</span></div><h2>{card.name}</h2><span className={s.category}>{card.category}</span><p>{card.description}</p><button type="button" disabled>Próximamente</button></article>)}</div></>}

function ApiPanel(){return <div className={s.apiLayout}><section className={s.apiHero}><div className={s.apiIcon}>API</div><div><small>ACCESO SEGURO</small><h2>Una API pensada para integraciones reales</h2><p>Las claves no se mostrarán ni almacenarán como texto común. El módulo se habilitará cuando esté conectado al backend de claves, permisos, rate-limit y auditoría.</p></div><button type="button" disabled>Crear clave · Próximamente</button></section><div className={s.apiMetrics}><article><span>Rate limit</span><b>Por definir</b><small>Se publicará junto con la API real.</small></article><article><span>Claves activas</span><b>0</b><small>No generamos credenciales ficticias.</small></article><article><span>Auditoría</span><b>Preparada</b><small>Cada llamada deberá quedar trazada.</small></article></div></div>}

function PaymentsPanel({payment,loading,onNavigate}){const connected=payment?.status==="connected";return <div className={s.paymentGrid}><article className={s.paymentCard} data-connected={connected}><div className={s.cardHead}><span className={s.appMark} data-brand="mercadopago">MP</span><span className={s.statusChip} data-status={connected?"connected":"available"}>{loading?"Consultando":connected?"Conectado":"Pendiente"}</span></div><h2>Mercado Pago</h2><span className={s.category}>Pagos online</span><p>{connected?`La cuenta está conectada${payment?.live_mode?" en modo real":""}. El motor puede usarla según las reglas configuradas.`:"Conectalo desde Sitio web para habilitar seña o pago total online sin salir del flujo de reservas."}</p><button type="button" onClick={()=>onNavigate?.("website")}>{connected?"Administrar en Sitio web":"Configurar en Sitio web"}</button></article></div>}
