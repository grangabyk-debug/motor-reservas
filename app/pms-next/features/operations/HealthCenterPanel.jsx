"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"
import PmsIcon from"../../components/shell/PmsIcons"
import s from"./healthCenter.module.css"

const norm=value=>String(value||"").trim().toLowerCase()
const money=(value,currency="ARS")=>{try{return new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)}catch{return`${currency||"ARS"} ${Math.round(Number(value)||0)}`}}
const ts=value=>{const n=value?new Date(value).getTime():NaN;return Number.isFinite(n)?n:null}
const ageMinutes=value=>{const n=ts(value);return n==null?null:Math.max(0,Math.round((Date.now()-n)/60000))}
const relative=value=>{const min=ageMinutes(value);if(min==null)return"Sin señal reciente";if(min<2)return"Ahora";if(min<60)return`Hace ${min} min`;const h=Math.round(min/60);if(h<24)return`Hace ${h} h`;return`Hace ${Math.round(h/24)} d`}
const compactDate=value=>{if(!value)return"—";try{return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".","")}catch{return"—"}}
const sourceText=row=>`${row?.canal_reserva||""} ${row?.codigo_canal||""}`.toLowerCase()
const isDirect=row=>/web|motor|direct|sitio|habitacion\s*llena|booking.engine/.test(sourceText(row))
const toneRank=tone=>tone==="red"?0:tone==="yellow"?1:tone==="green"?2:3

function observableLatency(notification){
  const meta=notification?.metadata&&typeof notification.metadata==="object"?notification.metadata:{}
  const providerStamp=meta.occurred_at||meta.provider_created_at||meta.provider_updated_at||meta.event_time||meta.timestamp||meta.sent_at||null
  const received=notification?.created_at
  const a=ts(providerStamp),b=ts(received)
  if(a==null||b==null||b<a)return null
  const sec=Math.round((b-a)/1000)
  return sec<=86400?sec:null
}
function latencyLabel(seconds){if(seconds==null)return"Sin muestra";if(seconds<2)return"< 2 s";if(seconds<60)return`${seconds} s`;return`${Math.round(seconds/60)} min`}
function statusLabel(tone){return tone==="red"?"Requiere atención":tone==="yellow"?"Vigilando":tone==="green"?"Operativo":"Sin actividad"}

function FlowNode({node,active,onClick}){
  return <button type="button" className={s.node} data-tone={node.tone} data-active={active?"true":"false"} onClick={onClick}>
    <span className={s.nodeLight}><i/></span>
    <div><small>{node.eyebrow}</small><b>{node.title}</b><em>{node.label}</em></div>
    <span className={s.nodeAge}>{node.age}</span>
  </button>
}

function TraceRow({item}){return <div className={s.traceRow} data-tone={item.tone||"blue"}><span><i/></span><div><b>{item.title}</b><small>{item.detail}</small></div><time>{item.time}</time></div>}

export default function HealthCenterPanel({propertyId,onNavigate,allowedViews=[]}){
  const[open,setOpen]=useState(false),[selected,setSelected]=useState("pms"),[loading,setLoading]=useState(false),[slow,setSlow]=useState(false),[error,setError]=useState("")
  const[hub,setHub]=useState(null),[notices,setNotices]=useState([]),[channelStates,setChannelStates]=useState([]),[engine,setEngine]=useState(null),[website,setWebsite]=useState(null),[paymentConnection,setPaymentConnection]=useState(null),[payments,setPayments]=useState([]),[reservations,setReservations]=useState([]),[lastReadAt,setLastReadAt]=useState(null)
  const allowed=useMemo(()=>new Set(allowedViews),[allowedViews]),can=id=>!allowed.size||allowed.has(id)

  const load=useCallback(async(silent=false)=>{
    if(!propertyId)return
    if(!silent)setLoading(true)
    setError("")
    try{
      const since=new Date(Date.now()-72*3600000).toISOString()
      const[hubRes,noticeRes,stateRes,engineRes,websiteRes,paymentConnectionRes,paymentRes,reservationRes]=await Promise.all([
        supabase.from("hotel_channel_hubs").select("id,provider,status,mode,diagnostics,last_sync_at,last_error,updated_at").eq("property_id",propertyId).eq("provider","channex").maybeSingle(),
        supabase.from("hotel_operational_notifications").select("id,reservation_id,event_type,title,detail,provider_name,metadata,created_at").eq("property_id",propertyId).gte("created_at",since).order("created_at",{ascending:false}).limit(60),
        supabase.from("hotel_channel_booking_state").select("id,reservation_id,ota_reservation_code,channel_code,ota_name,assignment_status,overbooked,conflict_state,last_revision_status,updated_at").eq("property_id",propertyId).order("updated_at",{ascending:false}).limit(80),
        supabase.from("hotel_booking_engines").select("id,slug,enabled,payment_mode,updated_at").eq("property_id",propertyId).maybeSingle(),
        supabase.from("hotel_websites").select("property_id,mode,enabled,domain_status,published_at,published_version,updated_at").eq("property_id",propertyId).maybeSingle(),
        supabase.from("hotel_payment_connections").select("id,status,provider,live_mode,updated_at").eq("property_id",propertyId).eq("provider","mercadopago").maybeSingle(),
        supabase.from("pagos").select("id,reserva_id,monto,moneda,metodo,estado,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(24),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,estado,canal_reserva,codigo_canal,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(60),
      ])
      const required=[hubRes,noticeRes,stateRes,engineRes,websiteRes,paymentConnectionRes,paymentRes,reservationRes]
      const hard=required.find(result=>result?.error&&!["PGRST116"].includes(result.error.code))
      if(hard?.error)throw hard.error
      setHub(hubRes.data||null);setNotices(noticeRes.data||[]);setChannelStates(stateRes.data||[]);setEngine(engineRes.data||null);setWebsite(websiteRes.data||null);setPaymentConnection(paymentConnectionRes.data||null);setPayments(paymentRes.data||[]);setReservations(reservationRes.data||[]);setLastReadAt(new Date().toISOString())
    }catch(err){setError(err?.message||"No pudimos leer todas las señales técnicas.")}
    finally{if(!silent)setLoading(false)}
  },[propertyId])

  useEffect(()=>{if(open)load()},[open,load])
  usePmsAutoRefresh(propertyId,()=>open?load(true):Promise.resolve(),["hotel_channel_hubs","hotel_operational_notifications","hotel_channel_booking_state","hotel_booking_engines","hotel_websites","hotel_payment_connections","pagos","reservas"])
  useEffect(()=>{if(!loading){setSlow(false);return}const timer=window.setTimeout(()=>setSlow(true),1400);return()=>window.clearTimeout(timer)},[loading])

  const latestNotice=notices[0]||null
  const latestChannelState=channelStates[0]||null
  const latestPayment=payments.find(row=>!["anulado","cancelado","reembolsado","refunded","void"].includes(norm(row.estado)))||payments[0]||null
  const latestDirect=reservations.find(isDirect)||null
  const channelProblems=channelStates.filter(row=>row.overbooked===true||["overbooked","partial","unassigned"].includes(norm(row.assignment_status))||norm(row.conflict_state)==="mapping_required")
  const latencySamples=notices.map(observableLatency).filter(value=>value!=null)
  const latestLatency=latencySamples[0]??null
  const hubAge=ageMinutes(hub?.last_sync_at||hub?.updated_at)
  const online=typeof navigator==="undefined"?true:navigator.onLine
  const hubStatus=norm(hub?.status)
  const diagnostics=hub?.diagnostics&&typeof hub.diagnostics==="object"?hub.diagnostics:{}
  const retryValue=diagnostics.pending_retries??diagnostics.retry_count??diagnostics.retries??diagnostics.retry_attempts??null
  const requiresOnlinePayment=engine&&norm(engine.payment_mode)!=="at_property"
  const paymentConnected=norm(paymentConnection?.status)==="connected"

  const nodes=useMemo(()=>{
    const pmsTone=!online||error?"red":"green"
    const channelTone=!hub?"gray":hub.last_error||hubStatus==="error"?"red":hubStatus==="paused"||hubStatus==="staging"||(hubAge!=null&&hubAge>15)?"yellow":"green"
    const otaCritical=channelProblems.some(row=>row.overbooked===true||norm(row.assignment_status)==="overbooked")
    const otaWarning=channelProblems.some(row=>norm(row.conflict_state)==="mapping_required"||["partial","unassigned"].includes(norm(row.assignment_status)))
    const otaTone=otaCritical?"red":otaWarning?"yellow":latestNotice?"green":hub?"blue":"gray"
    const engineTone=!engine?"gray":engine.enabled?"green":"yellow"
    const payTone=requiresOnlinePayment&&!paymentConnected?"red":paymentConnected?"green":requiresOnlinePayment?"yellow":"blue"
    return[
      {id:"pms",eyebrow:"NÚCLEO",title:"PMS",tone:pmsTone,label:online&&!error?"Datos accesibles":"Sin conexión",age:lastReadAt?relative(lastReadAt):"Sin lectura",target:"dashboard"},
      {id:"channel",eyebrow:"DISTRIBUCIÓN",title:"Channel Manager",tone:channelTone,label:!hub?"Sin configurar":hub.last_error?"Con error":hubStatus==="active"?"Sincronizando":hubStatus==="paused"?"Pausado":"Preparado",age:relative(hub?.last_sync_at||hub?.updated_at),target:"channelmanager"},
      {id:"ota",eyebrow:"CANALES",title:"OTAs",tone:otaTone,label:otaCritical?"Overbooking":otaWarning?"Con pendientes":latestNotice?"Recibiendo eventos":"Sin tráfico reciente",age:relative(latestNotice?.created_at||latestChannelState?.updated_at),target:"channelmanager"},
      {id:"engine",eyebrow:"VENTA DIRECTA",title:"Motor",tone:engineTone,label:!engine?"No creado":engine.enabled?"Disponible":"Desactivado",age:relative(latestDirect?.created_at||engine?.updated_at||website?.published_at),target:"website"},
      {id:"payments",eyebrow:"COBROS",title:"Pagos",tone:payTone,label:paymentConnected?"Conectado":requiresOnlinePayment?"Falta conexión":"Cobro en hotel",age:relative(latestPayment?.created_at||paymentConnection?.updated_at),target:"integrationpayments"},
    ]
  },[online,error,lastReadAt,hub,hubStatus,hubAge,channelProblems,latestNotice,latestChannelState,engine,website,latestDirect,paymentConnection,paymentConnected,requiresOnlinePayment,latestPayment])

  const overall=useMemo(()=>{const red=nodes.filter(node=>node.tone==="red").length,yellow=nodes.filter(node=>node.tone==="yellow").length,green=nodes.filter(node=>node.tone==="green").length;if(red)return{tone:"red",title:`${red} señal${red===1?"":"es"} requiere${red===1?"":"n"} atención`,note:"Hay una interrupción o dependencia crítica que conviene revisar."};if(yellow)return{tone:"yellow",title:`${green} de ${nodes.length} señales estables`,note:`${yellow} componente${yellow===1?"":"s"} está${yellow===1?"":"n"} en observación.`};return{tone:"green",title:"Cadena operativa estable",note:"No vemos fallas críticas en las señales disponibles."}},[nodes])

  const traces=useMemo(()=>{
    const list=[]
    if(hub?.last_sync_at)list.push({id:"hub-sync",tone:hub.last_error?"red":"green",title:"Channel Manager sincronizó",detail:hub.last_error||`Proveedor ${hub.provider||"Channex"}`,at:hub.last_sync_at})
    notices.slice(0,7).forEach(row=>list.push({id:`notice-${row.id}`,tone:row.metadata?.severity==="critical"?"red":"blue",title:row.title||"Evento OTA",detail:[row.provider_name,row.detail].filter(Boolean).join(" · ")||"Actualización recibida",at:row.created_at}))
    if(latestDirect)list.push({id:`direct-${latestDirect.id}`,tone:"green",title:"Reserva directa registrada",detail:`${latestDirect.nombre_huesped||latestDirect.numero_reserva||"Reserva"} · ${latestDirect.canal_reserva||latestDirect.codigo_canal||"Motor"}`,at:latestDirect.created_at})
    if(website?.published_at)list.push({id:"web-published",tone:"green",title:"Sitio publicado",detail:`Versión ${website.published_version||"actual"} · ${website.mode==="external"?"web externa":"sitio administrado"}`,at:website.published_at})
    if(latestPayment)list.push({id:`pay-${latestPayment.id}`,tone:norm(latestPayment.estado)==="confirmado"?"green":"yellow",title:norm(latestPayment.estado)==="confirmado"?"Pago confirmado":"Movimiento de pago",detail:`${money(latestPayment.monto,latestPayment.moneda)}${latestPayment.metodo?` · ${latestPayment.metodo}`:""}`,at:latestPayment.created_at})
    return list.filter(item=>item.at).sort((a,b)=>ts(b.at)-ts(a.at)).slice(0,10).map(item=>({...item,time:relative(item.at)}))
  },[hub,notices,latestDirect,website,latestPayment])

  const selectedNode=nodes.find(node=>node.id===selected)||nodes[0]
  const detail=useMemo(()=>{
    if(selectedNode.id==="pms")return{latency:"En vivo",retries:"No aplica",last:lastReadAt?relative(lastReadAt):"Sin lectura",explain:error||"La lectura de las fuentes principales respondió correctamente desde esta sesión."}
    if(selectedNode.id==="channel")return{latency:hubAge==null?"Sin muestra":hubAge<2?"< 2 min":`${hubAge} min desde sync`,retries:retryValue==null?(hub?.last_error?"Revisar error":"Sin reintentos reportados"):String(retryValue),last:relative(hub?.last_sync_at||hub?.updated_at),explain:hub?.last_error||(!hub?"Todavía no hay un Channel Manager configurado.":"Mostramos la última marca de sincronización que reporta el proveedor.")}
    if(selectedNode.id==="ota")return{latency:latencyLabel(latestLatency),retries:channelProblems.length?`${channelProblems.length} pendiente${channelProblems.length===1?"":"s"}`:"Sin conflictos abiertos",last:relative(latestNotice?.created_at||latestChannelState?.updated_at),explain:latestLatency==null?"La OTA no entregó una marca temporal comparable en los eventos recientes; por eso no inventamos una latencia.":"La latencia observable compara la hora informada por el evento con la hora en que quedó registrado en el PMS."}
    if(selectedNode.id==="engine")return{latency:"Interno",retries:"Sin cola visible",last:relative(latestDirect?.created_at||engine?.updated_at||website?.published_at),explain:!engine?"El motor directo todavía no fue creado para esta propiedad.":engine.enabled?`Motor ${engine.slug||"directo"} habilitado${website?.domain_status?` · dominio ${website.domain_status}`:""}.`:"El motor existe pero está desactivado."}
    return{latency:paymentConnected?"Conexión activa":"Sin conexión online",retries:"Sin cola visible",last:relative(latestPayment?.created_at||paymentConnection?.updated_at),explain:paymentConnected?`Proveedor ${paymentConnection.provider||"Mercado Pago"} conectado${paymentConnection.live_mode?" en vivo":""}.`:requiresOnlinePayment?"El motor pide cobro online pero no vemos una conexión de pagos activa.":"El motor está configurado para cobrar en el alojamiento; una pasarela online no es obligatoria."}
  },[selectedNode,lastReadAt,error,hubAge,retryValue,hub,latestLatency,channelProblems,latestNotice,latestChannelState,latestDirect,engine,website,paymentConnected,paymentConnection,latestPayment,requiresOnlinePayment])

  function openTarget(node=selectedNode){if(node?.target&&can(node.target)){setOpen(false);onNavigate?.(node.target)}}

  return <>
    <button type="button" className={s.launcher} data-tone={overall.tone} onClick={()=>setOpen(true)} aria-label="Abrir Health Center"><span><i/></span><div><small>SALUD DEL SISTEMA</small><b>{overall.tone==="green"?"Todo estable":overall.tone==="yellow"?"En observación":"Revisar ahora"}</b></div></button>
    {open?<div className={s.shade} onMouseDown={event=>event.target===event.currentTarget&&setOpen(false)}>
      <section className={s.panel} aria-label="Health Center de Habitación Llena">
        <header className={s.header}><div><small>HEALTH CENTER</small><h2>Confiabilidad y sincronización</h2><p>PMS ↔ Channel Manager ↔ OTAs ↔ motor ↔ pagos, explicado con señales reales.</p></div><div className={s.headerActions}><button type="button" onClick={()=>load()} disabled={loading}><PmsIcon name="refresh" size={15}/>{loading?"Actualizando…":"Actualizar"}</button><button type="button" className={s.close} onClick={()=>setOpen(false)} aria-label="Cerrar Health Center">×</button></div></header>
        {loading?<div className={s.loading}><i/><div><b>Comprobando la cadena operativa…</b><span>{slow?"Ya falta poco. Estamos cruzando canales, motor y cobros.":"Leyendo las últimas señales y eventos."}</span></div></div>:null}
        {error?<div className={s.error}><span>!</span><div><b>No pudimos completar la lectura</b><small>{error}</small></div><button type="button" onClick={()=>load()}>Reintentar</button></div>:null}
        <div className={s.summary} data-tone={overall.tone}><span className={s.summaryOrb}><i/><i/><i/></span><div><small>PULSO TÉCNICO</small><b>{overall.title}</b><p>{overall.note}</p></div><em>{lastReadAt?`Actualizado ${relative(lastReadAt).toLowerCase()}`:"Esperando lectura"}</em></div>
        <div className={s.flow}>{nodes.map((node,index)=><div key={node.id} className={s.flowCell}>{index>0?<span className={s.connector} data-tone={node.tone}/>:null}<FlowNode node={node} active={selected===node.id} onClick={()=>setSelected(node.id)}/></div>)}</div>
        <div className={s.detailGrid}>
          <article className={s.detailCard} data-tone={selectedNode.tone}><header><div><small>{selectedNode.eyebrow}</small><h3>{selectedNode.title}</h3></div><span><i/>{statusLabel(selectedNode.tone)}</span></header><div className={s.readouts}><div><small>ESTADO</small><b>{selectedNode.label}</b></div><div><small>ÚLTIMA SEÑAL</small><b>{detail.last}</b></div><div><small>LATENCIA / FRESCURA</small><b>{detail.latency}</b></div><div><small>REINTENTOS / COLA</small><b>{detail.retries}</b></div></div><p>{detail.explain}</p>{can(selectedNode.target)?<button type="button" onClick={()=>openTarget(selectedNode)}>Abrir {selectedNode.title}</button>:null}</article>
          <article className={s.traceCard}><header><div><small>TRAZABILIDAD</small><h3>Qué pasó realmente</h3></div><span>{traces.length} eventos</span></header><div className={s.trace}>{traces.length?traces.map(item=><TraceRow key={item.id} item={item}/>):<div className={s.traceEmpty}><span>◎</span><div><b>Todavía no hay eventos recientes</b><small>Cuando haya sincronizaciones, reservas o cobros aparecerán acá.</small></div></div>}</div></article>
        </div>
        <footer className={s.footer}><span><i data-tone="green"/> Operativo</span><span><i data-tone="yellow"/> En observación</span><span><i data-tone="red"/> Requiere atención</span><p>No mostramos un porcentaje de “salud” inventado: cada estado depende de una señal observable.</p></footer>
      </section>
    </div>:null}
  </>
}
