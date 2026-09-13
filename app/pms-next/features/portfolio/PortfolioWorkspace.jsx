"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./portfolio.module.css"
import o from"./portfolioOps.module.css"

const dayKey=(offset=0)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return d.toLocaleDateString("en-CA")}
const validReservation=item=>!item?.no_show&&!["cancelada","cancelado","cancelled"].includes(String(item?.estado||"").toLowerCase())
const validPayment=item=>!["void","cancelado","anulado","cancelled"].includes(String(item?.estado||"").toLowerCase())
const reservationRoomIds=item=>[...new Set([item?.habitacion_id,...(item?.habitaciones_ids||[])].filter(Boolean).map(Number))]
const pct=value=>`${Math.round(Number(value)||0)}%`
const roleLabel={owner:"Propietario",admin:"Administrador",manager:"Gerencia",reception:"Recepción",night_audit:"Auditoría nocturna",housekeeping:"Housekeeping",maintenance:"Mantenimiento",revenue:"Revenue",member:"Equipo"}

export default function PortfolioWorkspace({properties=[],activePropertyId,onProperty,onNavigate}){
  const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("")
  const ids=useMemo(()=>properties.map(item=>item.id).filter(Boolean),[properties])
  const load=useCallback(async()=>{
    if(!ids.length){setRows([]);setLoading(false);return}
    setLoading(true);setError("")
    const today=dayKey(0),tomorrow=dayKey(1)
    try{
      const[roomRes,reservationRes,maintenanceRes,paymentRes]=await Promise.all([
        supabase.from("habitaciones").select("id,property_id,estado,activa").in("property_id",ids).eq("activa",true),
        supabase.from("reservas").select("id,property_id,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show").in("property_id",ids).lte("fecha_entrada",today).gte("fecha_salida",today),
        supabase.from("hotel_maintenance_tickets").select("id,property_id,status,priority").in("property_id",ids).not("status","in","(resolved,cancelled)"),
        supabase.from("pagos").select("id,property_id,estado").in("property_id",ids).gte("created_at",`${today}T00:00:00`).lt("created_at",`${tomorrow}T00:00:00`)
      ])
      for(const result of[roomRes,reservationRes,maintenanceRes,paymentRes])if(result.error)throw result.error
      const rooms=roomRes.data||[],reservations=(reservationRes.data||[]).filter(validReservation),maintenance=maintenanceRes.data||[],payments=(paymentRes.data||[]).filter(validPayment)
      setRows(properties.map(property=>{
        const propertyRooms=rooms.filter(item=>item.property_id===property.id),propertyReservations=reservations.filter(item=>item.property_id===property.id),occupied=new Set()
        propertyReservations.filter(item=>item.fecha_entrada<=today&&item.fecha_salida>today&&item.estado!=="finalizada").forEach(item=>reservationRoomIds(item).forEach(id=>occupied.add(id)))
        const arrivals=propertyReservations.filter(item=>item.fecha_entrada===today).length,departures=propertyReservations.filter(item=>item.fecha_salida===today).length,openMaintenance=maintenance.filter(item=>item.property_id===property.id),urgent=openMaintenance.filter(item=>item.priority==="urgent").length,dirty=propertyRooms.filter(item=>item.estado==="sucia").length,ready=propertyRooms.filter(item=>["libre","limpia","inspeccionada"].includes(item.estado)).length,occupancy=propertyRooms.length?Math.min(100,(occupied.size/propertyRooms.length)*100):0
        return{...property,totalUnits:propertyRooms.length,occupied:occupied.size,occupancy,arrivals,departures,dirty,ready,maintenance:openMaintenance.length,urgent,payments:payments.filter(item=>item.property_id===property.id).length,attention:urgent*4+dirty+openMaintenance.length+arrivals}
      }).sort((a,b)=>b.attention-a.attention||String(a.name).localeCompare(String(b.name))))
    }catch(err){setError(err?.message||"No se pudo cargar la cartera de propiedades.")}finally{setLoading(false)}
  },[ids,properties])
  useEffect(()=>{load()},[load])

  const totals=useMemo(()=>rows.reduce((acc,item)=>({properties:acc.properties+1,units:acc.units+item.totalUnits,occupied:acc.occupied+item.occupied,arrivals:acc.arrivals+item.arrivals,departures:acc.departures+item.departures,maintenance:acc.maintenance+item.maintenance,urgent:acc.urgent+item.urgent}),{properties:0,units:0,occupied:0,arrivals:0,departures:0,maintenance:0,urgent:0}),[rows])
  const portfolioOccupancy=totals.units?totals.occupied/totals.units*100:0
  const attention=useMemo(()=>rows.flatMap(item=>[
    item.urgent?{key:`urgent-${item.id}`,propertyId:item.id,property:item.name,count:item.urgent,label:"Mantenimiento urgente",view:"maintenance",tone:"danger",rank:0}:null,
    item.dirty?{key:`dirty-${item.id}`,propertyId:item.id,property:item.name,count:item.dirty,label:"Por limpiar",view:"housekeeping",tone:"warn",rank:1}:null,
    item.arrivals?{key:`arrivals-${item.id}`,propertyId:item.id,property:item.name,count:item.arrivals,label:"Llegadas hoy",view:"reservations",tone:"info",rank:2}:null,
  ].filter(Boolean)).sort((a,b)=>a.rank-b.rank||b.count-a.count).slice(0,8),[rows])
  function openProperty(id,view="dashboard"){onProperty?.(id);window.setTimeout(()=>onNavigate?.(view),0)}

  return <section className={s.page}>
    <header className={s.header}><div><small>CARTERA · MULTI-PROPIEDAD</small><h1>Tu cartera</h1></div><button type="button" className={s.refresh} onClick={load} disabled={loading}>{loading?"Actualizando…":"Actualizar"}</button></header>
    <div className={s.metrics}><article><span>Propiedades</span><b>{totals.properties}</b><small>{totals.units} habitaciones / unidades</small></article><article><span>Ocupación cartera</span><b>{pct(portfolioOccupancy)}</b><small>{totals.occupied} ocupadas hoy</small></article><article><span>Llegadas hoy</span><b>{totals.arrivals}</b><small>{totals.departures} salidas</small></article><article data-tone={totals.urgent?"danger":"ok"}><span>Mantenimiento</span><b>{totals.maintenance}</b><small>{totals.urgent?`${totals.urgent} urgentes`:"Sin urgencias"}</small></article></div>
    <section className={o.now}><header><div><small>OPERACIÓN</small><h2>Pendientes ahora</h2></div><span data-ok={!attention.length}>{attention.length?`${attention.length} grupos de tareas`:"Todo al día"}</span></header>{attention.length?<div className={o.taskList}>{attention.map(item=><article key={item.key} data-tone={item.tone}><b>{item.count}</b><div><strong>{item.label}</strong><small>{item.property}</small></div><button type="button" onClick={()=>openProperty(item.propertyId,item.view)}>Abrir</button></article>)}</div>:<div className={o.clear}>No hay urgencias, limpiezas pendientes ni llegadas para atender en este momento.</div>}</section>
    {error?<div className={s.error}><b>No pudimos actualizar la cartera.</b><span>{error}</span><button onClick={load}>Reintentar</button></div>:null}
    {loading&&!rows.length?<div className={s.loading}>Armando la vista de cartera…</div>:null}
    {!loading&&!rows.length?<div className={s.empty}><b>Todavía no hay propiedades para comparar.</b><span>Cuando tu cuenta tenga más propiedades, van a aparecer acá automáticamente.</span></div>:null}
    <div className={s.grid}>{rows.map(item=><article key={item.id} className={`${s.propertyCard} ${item.id===activePropertyId?s.active:""}`}><div className={s.propertyTop}><span className={s.avatar}>{String(item.name||"P").slice(0,1).toUpperCase()}</span><div><b>{item.name}</b><small>{item.city||"Ubicación pendiente"} · {roleLabel[item.role]||"Equipo"}</small></div>{item.id===activePropertyId?<em>ACTIVA</em>:null}</div><div className={s.propertyMetrics}><span><b>{pct(item.occupancy)}</b><small>ocupación</small></span><span><b>{item.arrivals}</b><small>llegadas</small></span><span><b>{item.departures}</b><small>salidas</small></span><span><b>{item.dirty}</b><small>por limpiar</small></span></div><div className={s.health}><span data-tone={item.urgent?"danger":item.maintenance?"warn":"ok"}>{item.urgent?`${item.urgent} mantenimiento urgente`:item.maintenance?`${item.maintenance} incidencias abiertas`:"Mantenimiento al día"}</span><span>{item.ready} listas · {item.payments} cobros hoy</span></div><div className={s.actions}><button type="button" onClick={()=>openProperty(item.id,"dashboard")}>Abrir propiedad</button><button type="button" onClick={()=>openProperty(item.id,"planning")}>Planning</button></div></article>)}</div>
  </section>
}
