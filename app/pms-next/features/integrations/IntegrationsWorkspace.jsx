"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./integrations.module.css"

const STATUS_LABELS={not_connected:"Sin conectar",sandbox:"Sandbox",connected:"Conectado",error:"Error",paused:"Pausado"}
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"Nunca"

export default function IntegrationsWorkspace({propertyId}){
  const[tab,setTab]=useState("connections")
  const[connections,setConnections]=useState([])
  const[mappings,setMappings]=useState([])
  const[runs,setRuns]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")
  const[saving,setSaving]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[connRes,mapRes,runRes]=await Promise.all([
        supabase.from("hotel_channel_connections").select("id,provider,status,mode,account_ref,mapping,last_sync_at,last_error,created_at,updated_at,transport,adapter,external_property_id,diagnostics").eq("property_id",propertyId).order("provider"),
        supabase.from("hotel_channel_mappings").select("id,connection_id,mapping_type,local_key,channel_code,external_id,metadata,updated_at").eq("property_id",propertyId).order("mapping_type").order("local_key"),
        supabase.from("hotel_channel_sync_runs").select("id,connection_id,direction,kind,status,item_count,summary,started_at,finished_at").eq("property_id",propertyId).order("started_at",{ascending:false}).limit(100),
      ])
      for(const result of[connRes,mapRes,runRes])if(result.error)throw result.error
      setConnections(connRes.data||[]);setMappings(mapRes.data||[]);setRuns(runRes.data||[])
    }catch(err){setError(err?.message||"No se pudieron cargar las integraciones.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])

  async function togglePause(connection){
    if(!['connected','paused'].includes(connection.status))return
    setSaving(connection.id);setError("")
    try{const next=connection.status==="paused"?"connected":"paused";const{error:updateError}=await supabase.from("hotel_channel_connections").update({status:next,updated_at:new Date().toISOString()}).eq("id",connection.id).eq("property_id",propertyId);if(updateError)throw updateError;await load()}
    catch(err){setError(err?.message||"No se pudo actualizar la integración.")}
    finally{setSaving("")}
  }

  const stats=useMemo(()=>({connected:connections.filter(c=>c.status==="connected").length,sandbox:connections.filter(c=>c.status==="sandbox").length,errors:connections.filter(c=>c.status==="error").length,mappings:mappings.length}),[connections,mappings])
  const providerById=useMemo(()=>new Map(connections.map(c=>[c.id,c.provider])),[connections])

  return <section className={s.page}>
    <header className={s.header}><div><small>INTEGRACIONES</small><h1>Canales y conexiones</h1><p>Estado real del channel manager, mapeos y sincronizaciones de la propiedad.</p></div><div className={s.tabs}>{[["connections","Conexiones"],["mappings","Mapeos"],["history","Sincronizaciones"]].map(([id,label])=><button key={id} className={tab===id?s.active:""} onClick={()=>setTab(id)}>{label}</button>)}</div></header>
    {error&&<div className={s.notice}>{error}</div>}
    <div className={s.metrics}><article><span>Conectadas</span><b>{stats.connected}</b></article><article><span>Sandbox</span><b>{stats.sandbox}</b></article><article><span>Errores</span><b>{stats.errors}</b></article><article><span>Mapeos</span><b>{stats.mappings}</b></article></div>
    {loading?<div className={s.notice}>Cargando integraciones…</div>:tab==="connections"?<div className={s.cards}>{connections.length?connections.map(connection=><article key={connection.id} className={s.card}><div className={s.cardTop}><div><small>{connection.transport||"CHANNEL"}</small><h2>{connection.provider}</h2></div><span data-status={connection.status}>{STATUS_LABELS[connection.status]||connection.status}</span></div><dl><div><dt>Modo</dt><dd>{connection.mode}</dd></div><div><dt>Cuenta</dt><dd>{connection.account_ref||connection.external_property_id||"—"}</dd></div><div><dt>Última sincronización</dt><dd>{fmtDate(connection.last_sync_at)}</dd></div><div><dt>Adaptador</dt><dd>{connection.adapter||"—"}</dd></div></dl>{connection.last_error&&<div className={s.errorBox}>{connection.last_error}</div>}<footer>{['connected','paused'].includes(connection.status)&&<button onClick={()=>togglePause(connection)} disabled={saving===connection.id}>{saving===connection.id?"Guardando…":connection.status==="paused"?"Reanudar":"Pausar"}</button>}<span>{mappings.filter(m=>m.connection_id===connection.id).length} mapeos</span></footer></article>):<div className={s.notice}>No hay canales configurados para esta propiedad. No mostramos conectores ficticios.</div>}</div>:tab==="mappings"?<div className={s.table}><div className={s.head}><span>Canal</span><span>Tipo</span><span>Local</span><span>Código</span><span>ID externo</span><span>Actualizado</span></div>{mappings.map(mapping=><article key={mapping.id}><b>{providerById.get(mapping.connection_id)||"Canal"}</b><span>{mapping.mapping_type}</span><span>{mapping.local_key}</span><span>{mapping.channel_code}</span><span>{mapping.external_id}</span><span>{fmtDate(mapping.updated_at)}</span></article>)}</div>:<div className={s.table}><div className={s.headHistory}><span>Canal</span><span>Dirección</span><span>Tipo</span><span>Estado</span><span>Ítems</span><span>Inicio</span><span>Detalle</span></div>{runs.map(run=><article className={s.historyRow} key={run.id}><b>{providerById.get(run.connection_id)||"Canal"}</b><span>{run.direction}</span><span>{run.kind}</span><span>{run.status}</span><span>{run.item_count}</span><span>{fmtDate(run.started_at)}</span><span>{run.summary||"—"}</span></article>)}</div>}
    <div className={s.security}><b>Seguridad de credenciales</b><p>Esta pantalla no consulta tokens ni secretos. Las credenciales quedan fuera del cliente y las conexiones se identifican únicamente por referencias seguras.</p></div>
  </section>
}
