"use client"

import{useMemo,useState}from"react"
import useOperationalNotifications from"../../core/useOperationalNotifications"
import useOperationsData from"./useOperationsData"
import s from"./operations.module.css"

const STATUSES={open:"Nueva",assigned:"Asignada",in_progress:"En curso",waiting_parts:"Esperando repuesto",resolved:"Resuelta",cancelled:"Cancelada"}
const PRIORITY={low:"Baja",normal:"Media",high:"Alta",urgent:"Urgente"}
const score={urgent:4,high:3,normal:2,low:1}
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"Sin vencimiento"
const stateTone=status=>status==="resolved"?"green":["assigned","in_progress","waiting_parts"].includes(status)?"yellow":"red"
const priorityTone=value=>value==="urgent"?"red":value==="high"?"orange":value==="normal"?"yellow":"green"
const sortAlerts=(a,b)=>(score[b.priority]||0)-(score[a.priority]||0)||new Date(a.due_at||"2999-01-01")-new Date(b.due_at||"2999-01-01")||new Date(a.created_at||0)-new Date(b.created_at||0)
const EVENT_LABEL={created:"Creada",status_changed:"Cambio de estado",assigned:"Asignación",priority_changed:"Cambio de prioridad"}

export default function OperationsWorkspace({propertyId,onNavigate,allowedViews=[]}){
  const data=useOperationsData(propertyId)
  const[query,setQuery]=useState(""),[view,setView]=useState("active"),[formOpen,setFormOpen]=useState(false),[saving,setSaving]=useState(false)
  const[draft,setDraft]=useState({title:"",description:"",reservation_id:"",room_id:"",priority:"normal",assigned_to:"",due_at:""})
  const[timelineTarget,setTimelineTarget]=useState(null),[timeline,setTimeline]=useState([]),[timelineLoading,setTimelineLoading]=useState(false)
  const notifications=useOperationalNotifications({area:"maintenance"})
  const allowed=useMemo(()=>new Set(allowedViews),[allowedViews])
  const maintenanceStaff=useMemo(()=>data.profiles.filter(person=>["owner","manager","admin","maintenance"].includes(person.member_role||person.role)),[data.profiles])

  const maintenanceRequests=useMemo(()=>data.guestRequests.filter(item=>item.assigned_area==="maintenance"),[data.guestRequests])
  const feed=useMemo(()=>[
    ...data.tickets.map(item=>({...item,_kind:"ticket",_entity:"hotel_maintenance_tickets"})),
    ...maintenanceRequests.map(item=>({...item,_kind:"request",_entity:"hotel_guest_requests",description:item.detail}))
  ].sort(sortAlerts),[data.tickets,maintenanceRequests])
  const active=useMemo(()=>feed.filter(item=>!["resolved","cancelled"].includes(item.status)),[feed])
  const stats=useMemo(()=>({urgent:active.filter(i=>i.priority==="urgent").length,high:active.filter(i=>i.priority==="high").length,pending:active.filter(i=>["open","assigned","waiting_parts"].includes(i.status)).length,progress:active.filter(i=>i.status==="in_progress").length}),[active])
  const visible=useMemo(()=>feed.filter(item=>{
    if(view==="active"&&["resolved","cancelled"].includes(item.status))return false
    if(view==="resolved"&&item.status!=="resolved")return false
    const room=data.roomById.get(Number(item.room_id)),reservation=data.reservationById.get(Number(item.reservation_id)),assignee=data.profileById.get(item.assigned_to),term=query.trim().toLowerCase()
    return !term||`${item.title||""} ${item.description||""} ${room?.nombre||""} ${reservation?.nombre_huesped||""} ${reservation?.numero_reserva||""} ${assignee?.full_name||""}`.toLowerCase().includes(term)
  }),[feed,view,query,data.roomById,data.reservationById,data.profileById])

  async function saveTask(){
    if(!draft.title.trim())return data.setError("Ingresá un título para la tarea.")
    setSaving(true);data.setError("")
    try{await data.createTicket(draft);setFormOpen(false);setDraft({title:"",description:"",reservation_id:"",room_id:"",priority:"normal",assigned_to:"",due_at:""})}
    catch(err){data.setError(err?.message||"No se pudo crear la tarea.")}
    finally{setSaving(false)}
  }
  async function updateItem(item,status){
    try{if(item._kind==="request")await data.updateGuestRequest(item.id,{status});else await data.updateTicket(item.id,{status})}
    catch(err){data.setError(err?.message||"No se pudo actualizar la tarea.")}
  }
  function quickItem(item){updateItem(item,item.status==="in_progress"?"resolved":"in_progress")}
  function openReservation(item){if(!item.reservation_id||!allowed.has("reservations"))return;onNavigate?.("reservations",{reservationId:Number(item.reservation_id),restoreScroll:false})}
  function openRoom(item){if(!item.room_id||!allowed.has("housekeeping"))return;if(typeof window!=="undefined"){const url=new URL(window.location.href);url.searchParams.set("housekeeping_room",String(item.room_id));window.history.replaceState(window.history.state||{},"",url)}onNavigate?.("housekeeping",{restoreScroll:false})}
  async function openTimeline(item){
    setTimelineTarget(item);setTimeline([]);setTimelineLoading(true)
    try{setTimeline(await data.getTimeline(item._entity,item.id))}catch(err){data.setError(err?.message||"No se pudo cargar el seguimiento.")}
    finally{setTimelineLoading(false)}
  }

  return <section className={s.page}>
    <header className={s.header}><div><small>MANTENIMIENTO</small><h1>Panel de mantenimiento</h1><p>Reparaciones, incidencias y peticiones asignadas al área, ordenadas por urgencia.</p></div><div className={s.headerActions}><button type="button" className={`${s.notifyButton} ${notifications.enabled?s.notifyOn:""}`} onClick={notifications.toggle}>{notifications.enabled?"🔔 Alertas activas":"🔕 Activar alertas"}</button></div></header>
    {data.error&&<div className={s.errorBox}>{data.error}</div>}

    <div className={s.overview}><article data-tone="red"><span>Urgentes</span><b>{stats.urgent}</b><small>atención inmediata</small></article><article data-tone="orange"><span>Alta prioridad</span><b>{stats.high}</b><small>resolver pronto</small></article><article data-tone="yellow"><span>Pendientes</span><b>{stats.pending}</b><small>todavía sin cerrar</small></article><article data-tone="green"><span>En proceso</span><b>{stats.progress}</b><small>ya tomadas</small></article></div>

    <section className={s.attention}><header><div><small>ATENCIÓN AHORA</small><h2>{active.length?`${active.length} pendientes activos`:"Todo al día"}</h2></div><span>Rojo urgente · naranja alta · amarillo media · verde baja</span></header>{active.length?<div className={s.alertGrid}>{active.slice(0,8).map(item=>{const room=data.roomById.get(Number(item.room_id)),reservation=data.reservationById.get(Number(item.reservation_id));return <article key={`${item._kind}-${item.id}`} data-priority={priorityTone(item.priority)}><div className={s.alertTop}><span className={s.priorityPill} data-priority={priorityTone(item.priority)}>{PRIORITY[item.priority]||item.priority}</span><span className={s.statePill} data-tone={stateTone(item.status)}>{STATUSES[item.status]||item.status}</span></div><span className={s.typePill}>{item._kind==="request"?"Petición":"Mantenimiento"}</span><h3>{item.title}</h3><p>{item.description||"Sin detalle adicional."}</p><div className={s.alertMeta}><b>{room?`Hab. ${room.nombre}`:"General"}</b>{reservation?<span>{reservation.nombre_huesped} · {reservation.numero_reserva||reservation.id}</span>:null}<span>{fmtDate(item.due_at)}</span></div><div className={s.cardActions}><button type="button" onClick={()=>quickItem(item)}>{item.status==="in_progress"?"✓ Marcar resuelta":"▶ Tomar ahora"}</button><button type="button" onClick={()=>openTimeline(item)}>Historial</button>{reservation&&allowed.has("reservations")?<button type="button" onClick={()=>openReservation(item)}>Reserva</button>:null}{room&&allowed.has("housekeeping")?<button type="button" onClick={()=>openRoom(item)}>Habitación</button>:null}</div></article>})}</div>:<div className={s.goodState}>✓ No hay alertas activas en Mantenimiento.</div>}</section>

    <div className={s.toolbar}><div className={s.segment}><button className={view==="active"?s.active:""} onClick={()=>setView("active")}>Activas</button><button className={view==="resolved"?s.active:""} onClick={()=>setView("resolved")}>Resueltas</button><button className={view==="all"?s.active:""} onClick={()=>setView("all")}>Todas</button></div><label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar habitación, huésped, tarea o técnico"/></label><button className={s.primary} onClick={()=>setFormOpen(true)}>+ Nueva tarea</button></div>

    <div className={s.tableWrap}><table><thead><tr><th>Prioridad</th><th>Tipo / tarea</th><th>Habitación / huésped</th><th>Responsable</th><th>Estado</th><th>Vence</th><th></th></tr></thead><tbody>{visible.map(item=>{const room=data.roomById.get(Number(item.room_id)),reservation=data.reservationById.get(Number(item.reservation_id));return <tr key={`${item._kind}-${item.id}`}><td><span className={s.priorityPill} data-priority={priorityTone(item.priority)}>{PRIORITY[item.priority]||item.priority}</span></td><td><span className={s.typePill}>{item._kind==="request"?"Petición":"Mantenimiento"}</span><b>{item.title}</b><small>{item.description||"Sin detalle"}</small></td><td><b>{room?`Hab. ${room.nombre}`:"General"}</b>{reservation?<small>{reservation.nombre_huesped} · {reservation.numero_reserva||reservation.id}</small>:null}</td><td>{data.profileById.get(item.assigned_to)?.full_name||"Sin asignar"}</td><td><select value={item.status} onChange={e=>updateItem(item,e.target.value)}>{(item._kind==="request"?["open","in_progress","resolved","cancelled"]:["open","assigned","in_progress","waiting_parts","resolved","cancelled"]).map(id=><option key={id} value={id}>{STATUSES[id]}</option>)}</select></td><td>{fmtDate(item.due_at)}</td><td><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{reservation&&allowed.has("reservations")?<button type="button" className={s.tableAction} onClick={()=>openReservation(item)}>Reserva</button>:null}{room&&allowed.has("housekeeping")?<button type="button" className={s.tableAction} onClick={()=>openRoom(item)}>Habitación</button>:null}<button type="button" className={s.tableAction} onClick={()=>openTimeline(item)}>Seguimiento</button></div></td></tr>})}</tbody></table>{!data.loading&&!visible.length?<div className={s.empty}>No hay tareas en esta vista.</div>:null}</div>

    {formOpen&&<div className={s.modalShade} onMouseDown={e=>e.target===e.currentTarget&&setFormOpen(false)}><div className={s.modal}><header><h2>Nueva tarea de mantenimiento</h2><button onClick={()=>setFormOpen(false)}>×</button></header><div className={s.form}><label className={s.wide}>Título<input value={draft.title} onChange={e=>setDraft(v=>({...v,title:e.target.value}))} placeholder="Ej. Revisar pérdida de agua"/></label><label>Reserva<select value={draft.reservation_id} onChange={e=>{const reservation=data.reservationById.get(Number(e.target.value));setDraft(v=>({...v,reservation_id:e.target.value,room_id:reservation?.habitacion_id||v.room_id}))}}><option value="">Sin reserva vinculada</option>{data.reservations.map(r=><option key={r.id} value={r.id}>{r.numero_reserva||r.id} · {r.nombre_huesped}</option>)}</select></label><label>Habitación<select value={draft.room_id} onChange={e=>setDraft(v=>({...v,room_id:e.target.value}))}><option value="">General</option>{data.rooms.map(room=><option key={room.id} value={room.id}>{room.nombre}</option>)}</select></label><label>Prioridad<select value={draft.priority} onChange={e=>setDraft(v=>({...v,priority:e.target.value}))}><option value="low">Baja</option><option value="normal">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Responsable<select value={draft.assigned_to} onChange={e=>setDraft(v=>({...v,assigned_to:e.target.value}))}><option value="">Área sin persona asignada</option>{maintenanceStaff.map(profile=><option key={profile.id} value={profile.id}>{profile.full_name||profile.id.slice(0,8)}</option>)}</select></label><label>Vencimiento<input type="datetime-local" value={draft.due_at} onChange={e=>setDraft(v=>({...v,due_at:e.target.value?new Date(e.target.value).toISOString():""}))}/></label><label className={s.wide}>Descripción<textarea value={draft.description} onChange={e=>setDraft(v=>({...v,description:e.target.value}))}/></label></div><footer><button onClick={()=>setFormOpen(false)}>Cancelar</button><button disabled={saving} onClick={saveTask}>{saving?"Guardando…":"Crear tarea"}</button></footer></div></div>}

    {timelineTarget&&<div className={s.modalShade} onMouseDown={e=>e.target===e.currentTarget&&setTimelineTarget(null)}><div className={s.modal}><header><div><small>SEGUIMIENTO</small><h2>{timelineTarget.title}</h2></div><button onClick={()=>setTimelineTarget(null)}>×</button></header><div className={s.timeline}>{timelineLoading?<div className={s.empty}>Cargando historial…</div>:timeline.map(event=>{const actor=data.profileById.get(event.actor_id);return <article className={s.timelineItem} key={event.id}><i data-tone={stateTone(event.to_status||event.from_status)}/><div><b>{EVENT_LABEL[event.event_type]||event.event_type}</b><span>{event.from_status&&event.to_status&&event.from_status!==event.to_status?`${STATUSES[event.from_status]||event.from_status} → ${STATUSES[event.to_status]||event.to_status}`:STATUSES[event.to_status]||event.to_status||""}</span><small>{actor?.full_name||"Sistema / usuario"} · {fmtDate(event.created_at)}</small></div></article>})}{!timelineLoading&&!timeline.length?<div className={s.empty}>Todavía no hay eventos registrados.</div>:null}</div><footer><button onClick={()=>setTimelineTarget(null)}>Cerrar</button></footer></div></div>}
  </section>
}
