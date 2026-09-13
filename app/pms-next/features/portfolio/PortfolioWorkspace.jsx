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
const typeLabel={hotel:"Hotel / Hostería",apartment:"Departamento",house:"Casa",building:"Edificio",cabins:"Cabañas",hostel:"Hostel",other:"Otra"}
const canEditMeta=role=>["owner","manager"].includes(role)

export default function PortfolioWorkspace({properties=[],activePropertyId,onProperty,onNavigate}){
  const[rows,setRows]=useState([]),[settingsByProperty,setSettingsByProperty]=useState({}),[loading,setLoading]=useState(true),[error,setError]=useState("")
  const[editor,setEditor]=useState(null),[savingMeta,setSavingMeta]=useState(false)
  const ids=useMemo(()=>properties.map(item=>item.id).filter(Boolean),[properties])
  const load=useCallback(async()=>{
    if(!ids.length){setRows([]);setSettingsByProperty({});setLoading(false);return}
    setLoading(true);setError("")
    const today=dayKey(0),tomorrow=dayKey(1)
    try{
      const[roomRes,reservationRes,maintenanceRes,paymentRes,settingsRes]=await Promise.all([
        supabase.from("habitaciones").select("id,property_id,estado,activa").in("property_id",ids).eq("activa",true),
        supabase.from("reservas").select("id,property_id,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show").in("property_id",ids).lte("fecha_entrada",today).gte("fecha_salida",today),
        supabase.from("hotel_maintenance_tickets").select("id,property_id,status,priority").in("property_id",ids).not("status","in","(resolved,cancelled)"),
        supabase.from("pagos").select("id,property_id,estado").in("property_id",ids).gte("created_at",`${today}T00:00:00`).lt("created_at",`${tomorrow}T00:00:00`),
        supabase.from("property_settings").select("property_id,settings").in("property_id",ids)
      ])
      for(const result of[roomRes,reservationRes,maintenanceRes,paymentRes,settingsRes])if(result.error)throw result.error
      const rooms=roomRes.data||[],reservations=(reservationRes.data||[]).filter(validReservation),maintenance=maintenanceRes.data||[],payments=(paymentRes.data||[]).filter(validPayment),settingsMap=Object.fromEntries((settingsRes.data||[]).map(item=>[item.property_id,item.settings||{}]))
      setSettingsByProperty(settingsMap)
      setRows(properties.map(property=>{
        const propertyRooms=rooms.filter(item=>item.property_id===property.id),propertyReservations=reservations.filter(item=>item.property_id===property.id),occupied=new Set(),portfolio=settingsMap[property.id]?.portfolio||{}
        propertyReservations.filter(item=>item.fecha_entrada<=today&&item.fecha_salida>today&&item.estado!=="finalizada").forEach(item=>reservationRoomIds(item).forEach(id=>occupied.add(id)))
        const arrivals=propertyReservations.filter(item=>item.fecha_entrada===today).length,departures=propertyReservations.filter(item=>item.fecha_salida===today).length,openMaintenance=maintenance.filter(item=>item.property_id===property.id),urgent=openMaintenance.filter(item=>item.priority==="urgent").length,dirty=propertyRooms.filter(item=>item.estado==="sucia").length,ready=propertyRooms.filter(item=>["libre","limpia","inspeccionada"].includes(item.estado)).length,occupancy=propertyRooms.length?Math.min(100,(occupied.size/propertyRooms.length)*100):0
        return{...property,totalUnits:propertyRooms.length,occupied:occupied.size,occupancy,arrivals,departures,dirty,ready,maintenance:openMaintenance.length,urgent,payments:payments.filter(item=>item.property_id===property.id).length,attention:urgent*4+dirty+openMaintenance.length+arrivals,propertyType:portfolio.type||"",address:portfolio.address||""}
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
  function openEditor(item){setError("");setEditor({id:item.id,name:item.name,role:item.role,type:item.propertyType||"hotel",address:item.address||""})}
  async function saveMeta(){if(!editor||!canEditMeta(editor.role))return;setSavingMeta(true);setError("");try{const current=settingsByProperty[editor.id]||{},settings={...current,portfolio:{...(current.portfolio||{}),type:editor.type||"hotel",address:editor.address.trim()}};const{data,error:saveError}=await supabase.from("property_settings").upsert({property_id:editor.id,settings,updated_at:new Date().toISOString()},{onConflict:"property_id"}).select("property_id,settings").single();if(saveError)throw saveError;setSettingsByProperty(map=>({...map,[editor.id]:data.settings||settings}));setRows(list=>list.map(item=>item.id===editor.id?{...item,propertyType:editor.type,address:editor.address.trim()}:item));setEditor(null)}catch(err){setError(err?.message||"No se pudieron guardar los datos de la propiedad.")}finally{setSavingMeta(false)}}

  return <section className={s.page}>
    <header className={s.header}><div><small>CARTERA · MULTI-PROPIEDAD</small><h1>Tu cartera</h1></div><button type="button" className={s.refresh} onClick={load} disabled={loading}>{loading?"Actualizando…":"Actualizar"}</button></header>
    <div className={s.metrics}><article><span>Propiedades</span><b>{totals.properties}</b><small>{totals.units} habitaciones / unidades</small></article><article><span>Ocupación cartera</span><b>{pct(portfolioOccupancy)}</b><small>{totals.occupied} ocupadas hoy</small></article><article><span>Llegadas hoy</span><b>{totals.arrivals}</b><small>{totals.departures} salidas</small></article><article data-tone={totals.urgent?"danger":"ok"}><span>Mantenimiento</span><b>{totals.maintenance}</b><small>{totals.urgent?`${totals.urgent} urgentes`:"Sin urgencias"}</small></article></div>
    <section className={o.now}><header><div><small>OPERACIÓN</small><h2>Pendientes ahora</h2></div><span data-ok={!attention.length}>{attention.length?`${attention.length} grupos de tareas`:"Todo al día"}</span></header>{attention.length?<div className={o.taskList}>{attention.map(item=><article key={item.key} data-tone={item.tone}><b>{item.count}</b><div><strong>{item.label}</strong><small>{item.property}</small></div><button type="button" onClick={()=>openProperty(item.propertyId,item.view)}>Abrir</button></article>)}</div>:<div className={o.clear}>No hay urgencias, limpiezas pendientes ni llegadas para atender en este momento.</div>}</section>
    {error?<div className={s.error}><b>No pudimos completar la operación.</b><span>{error}</span><button onClick={load}>Reintentar</button></div>:null}
    {loading&&!rows.length?<div className={s.loading}>Armando la vista de cartera…</div>:null}
    {!loading&&!rows.length?<div className={s.empty}><b>Todavía no hay propiedades para comparar.</b><span>Cuando tu cuenta tenga más propiedades, van a aparecer acá automáticamente.</span></div>:null}
    <div className={s.grid}>{rows.map(item=><article key={item.id} className={`${s.propertyCard} ${item.id===activePropertyId?s.active:""}`}><div className={s.propertyTop}><span className={s.avatar}>{String(item.name||"P").slice(0,1).toUpperCase()}</span><div className={s.propertyIdentity}><b>{item.name}</b><small>{item.propertyType?typeLabel[item.propertyType]||typeLabel.other:"Tipo pendiente"} · {item.address||item.city||"Ubicación pendiente"} · {roleLabel[item.role]||"Equipo"}</small></div><div className={s.topActions}>{item.id===activePropertyId?<em>ACTIVA</em>:null}{canEditMeta(item.role)?<button type="button" onClick={()=>openEditor(item)}>Datos</button>:null}</div></div><div className={s.propertyMetrics}><span><b>{pct(item.occupancy)}</b><small>ocupación</small></span><span><b>{item.arrivals}</b><small>llegadas</small></span><span><b>{item.departures}</b><small>salidas</small></span><span><b>{item.dirty}</b><small>por limpiar</small></span></div><div className={s.health}><span data-tone={item.urgent?"danger":item.maintenance?"warn":"ok"}>{item.urgent?`${item.urgent} mantenimiento urgente`:item.maintenance?`${item.maintenance} incidencias abiertas`:"Mantenimiento al día"}</span><span>{item.ready} listas · {item.payments} cobros hoy</span></div><div className={s.actions}><button type="button" onClick={()=>openProperty(item.id,"dashboard")}>Abrir propiedad</button><button type="button" onClick={()=>openProperty(item.id,"planning")}>Planning</button></div></article>)}</div>
    {editor?<div className={s.modalShade} onMouseDown={event=>event.target===event.currentTarget&&setEditor(null)}><section className={s.modal} role="dialog" aria-modal="true" aria-label="Datos de la propiedad"><header><div><small>PROPIEDAD</small><h2>{editor.name}</h2></div><button type="button" aria-label="Cerrar" onClick={()=>setEditor(null)}>×</button></header><div className={s.form}><label>Tipo<select value={editor.type} onChange={event=>setEditor(value=>({...value,type:event.target.value}))}><option value="hotel">Hotel / Hostería</option><option value="apartment">Departamento</option><option value="house">Casa</option><option value="building">Edificio</option><option value="cabins">Cabañas</option><option value="hostel">Hostel</option><option value="other">Otra</option></select></label><label>Dirección<input value={editor.address} onChange={event=>setEditor(value=>({...value,address:event.target.value}))} placeholder="Ej. Av. Córdoba 1234, CABA" autoFocus/></label></div><footer><button type="button" onClick={()=>setEditor(null)}>Cancelar</button><button type="button" disabled={savingMeta} onClick={saveMeta}>{savingMeta?"Guardando…":"Guardar"}</button></footer></section></div>:null}
  </section>
}
