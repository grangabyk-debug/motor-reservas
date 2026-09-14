"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./channelHealth.module.css"

const BAD=new Set(["error","failed","dead","rejected"])
const PENDING=new Set(["queued","pending","retry","processing","created","draft"])
const fmt=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"Sin registro"
function initialOpen(){if(typeof window==="undefined")return false;return new URL(window.location.href).searchParams.get("channel_health")==="1"}

export default function ChannelHealthPanel({propertyId,prepared=false,canManage=false,onOpenManager}){
  const[data,setData]=useState({hub:null,connections:[],inbox:[],outbox:[],syncRuns:[],actions:[]}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[open,setOpen]=useState(initialOpen)
  const load=useCallback(async()=>{if(!propertyId)return;setLoading(true);setError("");try{
    const[hubRes,connectionRes,inboxRes,outboxRes,syncRes,actionRes]=await Promise.all([
      supabase.from("hotel_channel_hubs").select("status,last_sync_at,last_error,updated_at").eq("property_id",propertyId).eq("provider","channex").maybeSingle(),
      supabase.from("hotel_channel_connections").select("id,provider,status,mode,last_sync_at,last_error,updated_at").eq("property_id",propertyId).order("updated_at",{ascending:false}).limit(20),
      supabase.from("hotel_channel_inbox").select("id,event_type,channel_code,status,error,received_at,processed_at").eq("property_id",propertyId).order("received_at",{ascending:false}).limit(50),
      supabase.from("hotel_channel_outbox").select("id,event_type,status,attempts,next_retry_at,last_error,created_at,updated_at,sent_at").eq("property_id",propertyId).order("updated_at",{ascending:false}).limit(50),
      supabase.from("hotel_channel_sync_runs").select("id,direction,kind,status,item_count,summary,started_at,finished_at").eq("property_id",propertyId).order("started_at",{ascending:false}).limit(30),
      supabase.from("hotel_channel_actions").select("id,action_type,status,attempts,next_retry_at,last_error,created_at,sent_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(30),
    ])
    if(hubRes.error)throw hubRes.error
    setData({hub:hubRes.data||null,connections:connectionRes.error?[]:connectionRes.data||[],inbox:inboxRes.error?[]:inboxRes.data||[],outbox:outboxRes.error?[]:outboxRes.data||[],syncRuns:syncRes.error?[]:syncRes.data||[],actions:actionRes.error?[]:actionRes.data||[]})
  }catch(err){setError(err?.message||"No se pudo leer el estado de sincronización.")}finally{setLoading(false)}},[propertyId])
  useEffect(()=>{load()},[load])

  const metrics=useMemo(()=>{
    const failedOutbox=data.outbox.filter(row=>BAD.has(String(row.status||"").toLowerCase())).length
    const failedActions=data.actions.filter(row=>BAD.has(String(row.status||"").toLowerCase())).length
    const failedSync=data.syncRuns.filter(row=>BAD.has(String(row.status||"").toLowerCase())).length
    const pending=data.outbox.filter(row=>PENDING.has(String(row.status||"").toLowerCase())).length+data.actions.filter(row=>PENDING.has(String(row.status||"").toLowerCase())).length
    const mapping=data.inbox.filter(row=>/mapping_required|mapping|unmapped/i.test(String(row.error||""))).length
    const stamps=[data.hub?.last_sync_at,...data.connections.map(row=>row.last_sync_at),...data.syncRuns.map(row=>row.finished_at)].filter(Boolean).map(value=>new Date(value)).filter(date=>!Number.isNaN(date.getTime())).sort((a,b)=>b-a)
    const lastSync=stamps[0]?.toISOString()||null,lastEvent=data.inbox[0]?.received_at||null,failures=failedOutbox+failedActions+failedSync
    const tone=failures?"danger":mapping||pending?"warn":"ok"
    const label=failures?"Con errores":mapping||pending?"Revisar":"Sin alertas"
    return{failedOutbox,failedActions,failedSync,pending,mapping,lastSync,lastEvent,failures,tone,label}
  },[data])

  function toggle(){const next=!open;setOpen(next);if(typeof window!=="undefined"){const url=new URL(window.location.href);if(next)url.searchParams.set("channel_health","1");else url.searchParams.delete("channel_health");window.history.replaceState(window.history.state,"",url)}}
  const rows=[
    {label:"Mapeos",tone:metrics.mapping?"warn":"ok",value:metrics.mapping?`${metrics.mapping} conflicto${metrics.mapping===1?"":"s"}`:"Sin conflictos"},
    {label:"PMS → OTAs",tone:metrics.failedOutbox||metrics.failedActions?"danger":metrics.pending?"warn":"ok",value:metrics.failedOutbox||metrics.failedActions?`${metrics.failedOutbox+metrics.failedActions} fallido${metrics.failedOutbox+metrics.failedActions===1?"":"s"}`:metrics.pending?`${metrics.pending} pendiente${metrics.pending===1?"":"s"}`:"Cola limpia"},
    {label:"OTAs → PMS",tone:data.inbox.some(row=>BAD.has(String(row.status||"").toLowerCase()))?"danger":"ok",value:data.inbox.length?`${data.inbox.length} eventos recientes`:"Sin eventos recientes"},
    {label:"Sincronización",tone:metrics.failedSync?"danger":"ok",value:metrics.failedSync?`${metrics.failedSync} ejecución${metrics.failedSync===1?"":"es"} con error`:fmt(metrics.lastSync)},
  ]

  return <section className={s.panel}>
    <header className={s.head}><div><small>HEALTH CENTER</small><h3>Estado de sincronización</h3></div><div className={s.headActions}><span className={s.overall} data-tone={metrics.tone}><i/>{loading?"Comprobando":metrics.label}</span><button type="button" onClick={toggle}>{open?"Ocultar":"Ver diagnóstico"}</button></div></header>
    {error?<div className={s.error}>{error}<button type="button" onClick={load}>Reintentar</button></div>:<div className={s.metrics}><article data-tone={metrics.tone}><span>General</span><b>{loading?"—":metrics.label}</b></article><article><span>Última sync</span><b>{loading?"—":fmt(metrics.lastSync)}</b></article><article data-tone={metrics.pending?"warn":"ok"}><span>Cola</span><b>{loading?"—":metrics.pending}</b></article><article data-tone={metrics.mapping?"warn":"ok"}><span>Conflictos</span><b>{loading?"—":metrics.mapping}</b></article></div>}
    {open&&!error?<div className={s.details}>{rows.map(row=><div className={s.detailRow} key={row.label} data-tone={row.tone}><i/><b>{row.label}</b><span>{loading?"Comprobando":row.value}</span>{row.label==="Mapeos"&&metrics.mapping&&prepared&&canManage?<button type="button" onClick={onOpenManager}>Resolver</button>:null}</div>)}<div className={s.lastEvent}><span>Último evento OTA</span><b>{fmt(metrics.lastEvent)}</b><button type="button" onClick={load}>Actualizar</button></div></div>:null}
  </section>
}
