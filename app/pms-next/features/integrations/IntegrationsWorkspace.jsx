"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./integrations.module.css"

const OTAS=[
  {id:"booking",name:"Booking.com",mark:"B",aliases:["booking","booking.com"]},
  {id:"expedia",name:"Expedia",mark:"E",aliases:["expedia"]},
  {id:"airbnb",name:"Airbnb",mark:"A",aliases:["airbnb"]},
  {id:"despegar",name:"Despegar",mark:"D",aliases:["despegar","decolar"]},
  {id:"agoda",name:"Agoda",mark:"Ag",aliases:["agoda"]},
  {id:"hotelbeds",name:"Hotelbeds",mark:"H",aliases:["hotelbeds"]},
]
const STATUS_LABELS={not_connected:"Disponible",sandbox:"En prueba",connected:"Conectado",error:"Revisar",paused:"Pausado"}
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"Todavía sin sincronizar"
const norm=value=>String(value||"").trim().toLowerCase()
const otaFromText=value=>OTAS.find(ota=>ota.aliases.some(alias=>norm(value).includes(alias)))

export default function IntegrationsWorkspace({propertyId}){
  const[tab,setTab]=useState("channels")
  const[connections,setConnections]=useState([])
  const[mappings,setMappings]=useState([])
  const[runs,setRuns]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[connRes,mapRes,runRes]=await Promise.all([
        supabase.from("hotel_channel_connections").select("id,provider,status,last_sync_at,last_error,created_at,updated_at").eq("property_id",propertyId).order("updated_at",{ascending:false}),
        supabase.from("hotel_channel_mappings").select("id,connection_id,mapping_type,local_key,channel_code,external_id,metadata,updated_at").eq("property_id",propertyId).order("mapping_type").order("local_key"),
        supabase.from("hotel_channel_sync_runs").select("id,connection_id,direction,kind,status,item_count,summary,started_at,finished_at").eq("property_id",propertyId).order("started_at",{ascending:false}).limit(100),
      ])
      for(const result of[connRes,mapRes,runRes])if(result.error)throw result.error
      setConnections(connRes.data||[]);setMappings(mapRes.data||[]);setRuns(runRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar el Hub de canales.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])

  const connectionById=useMemo(()=>new Map(connections.map(item=>[item.id,item])),[connections])
  const channelState=useMemo(()=>OTAS.map(ota=>{
    const direct=connections.find(connection=>ota.aliases.some(alias=>norm(connection.provider).includes(alias)))
    const relatedMappings=mappings.filter(mapping=>{const detected=otaFromText(`${mapping.channel_code||""} ${mapping.metadata?.channel||""} ${mapping.metadata?.provider||""}`);return detected?.id===ota.id})
    const viaHub=relatedMappings.map(mapping=>connectionById.get(mapping.connection_id)).find(Boolean)
    const connection=direct||viaHub
    return{...ota,status:connection?.status||"not_connected",lastSync:connection?.last_sync_at||null,lastError:connection?.last_error||null,mappingCount:relatedMappings.length||mappings.filter(mapping=>mapping.connection_id===direct?.id).length}
  }),[connections,mappings,connectionById])
  const stats=useMemo(()=>({connected:channelState.filter(c=>c.status==="connected").length,testing:channelState.filter(c=>c.status==="sandbox").length,issues:channelState.filter(c=>c.status==="error").length,mappings:mappings.length}),[channelState,mappings.length])
  function mappingChannel(mapping){return otaFromText(`${mapping.channel_code||""} ${mapping.metadata?.channel||""}`)?.name||"Canal conectado"}
  function runChannel(run){
    const related=mappings.filter(mapping=>mapping.connection_id===run.connection_id).map(mapping=>otaFromText(`${mapping.channel_code||""} ${mapping.metadata?.channel||""}`)?.name).filter(Boolean)
    return related.length?[...new Set(related)].join(", "):"Hub de canales"
  }

  return <section className={s.page}>
    <header className={s.header}><div><small>CHANNEL HUB</small><h1>Canales de venta</h1><p>Habitación Llena centraliza disponibilidad, tarifas y reservas. La infraestructura técnica queda gestionada por debajo del Hub.</p></div><div className={s.tabs}>{[["channels","Canales"],["rooms","Habitaciones"],["history","Actividad"]].map(([id,label])=><button key={id} className={tab===id?s.active:""} onClick={()=>setTab(id)}>{label}</button>)}</div></header>
    {error&&<div className={s.notice}>{error}</div>}
    <div className={s.metrics}><article><span>Canales activos</span><b>{stats.connected}</b></article><article><span>En prueba</span><b>{stats.testing}</b></article><article><span>Requieren atención</span><b>{stats.issues}</b></article><article><span>Mapeos activos</span><b>{stats.mappings}</b></article></div>
    {loading?<div className={s.notice}>Cargando Channel Hub…</div>:tab==="channels"?<div className={s.cards}>{channelState.map(channel=><article key={channel.id} className={s.card}><div className={s.cardTop}><div className={s.brand}><span className={s.brandMark}>{channel.mark}</span><div><small>CANAL DE VENTA</small><h2>{channel.name}</h2></div></div><span data-status={channel.status}>{STATUS_LABELS[channel.status]||channel.status}</span></div><div className={s.channelInfo}><div><small>Última sincronización</small><b>{fmtDate(channel.lastSync)}</b></div><div><small>Habitaciones / tarifas</small><b>{channel.mappingCount?`${channel.mappingCount} mapeos`:"Pendiente de configurar"}</b></div></div>{channel.lastError?<div className={s.errorBox}>Hay una incidencia de sincronización. Habitación Llena la muestra sin exponer credenciales ni proveedores internos.</div>:<p className={s.channelCopy}>{channel.status==="not_connected"?"Disponible para incorporarse al Hub cuando se habilite la conexión de esta propiedad.":"Tarifas, cupos y reservas viajan a través del Hub de Habitación Llena."}</p>}</article>)}</div>:tab==="rooms"?<div className={s.table}><div className={s.head}><span>Canal</span><span>Tipo</span><span>Habitación / tarifa local</span><span>Código</span><span>Referencia externa</span><span>Actualizado</span></div>{mappings.length?mappings.map(mapping=><article key={mapping.id}><b>{mappingChannel(mapping)}</b><span>{mapping.mapping_type}</span><span>{mapping.local_key}</span><span>{mapping.channel_code||"—"}</span><span>{mapping.external_id||"—"}</span><span>{fmtDate(mapping.updated_at)}</span></article>):<div className={s.empty}>Todavía no hay habitaciones mapeadas a canales.</div>}</div>:<div className={s.table}><div className={s.headHistory}><span>Canal</span><span>Dirección</span><span>Tipo</span><span>Estado</span><span>Ítems</span><span>Inicio</span><span>Detalle</span></div>{runs.length?runs.map(run=><article className={s.historyRow} key={run.id}><b>{runChannel(run)}</b><span>{run.direction}</span><span>{run.kind}</span><span>{run.status}</span><span>{run.item_count}</span><span>{fmtDate(run.started_at)}</span><span>{run.summary||"—"}</span></article>):<div className={s.empty}>Todavía no hay sincronizaciones registradas.</div>}</div>}
    <div className={s.security}><span>HL</span><div><b>Hub administrado por Habitación Llena</b><p>El hotel trabaja con sus OTAs. Credenciales, adaptadores y proveedores de conectividad no se exponen en esta interfaz y permanecen del lado servidor.</p></div></div>
  </section>
}
