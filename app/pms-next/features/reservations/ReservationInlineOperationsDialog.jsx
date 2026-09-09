"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./reservationInlineOperations.module.css"

const PRIORITY={low:"Baja",normal:"Media",high:"Alta",urgent:"Urgente"}
const TASK_STATUS={open:"Nueva",assigned:"Asignada",in_progress:"En curso",waiting_parts:"En espera",resolved:"Resuelta",cancelled:"Cancelada"}
const REQUEST_STATUS={open:"Nueva",in_progress:"En curso",resolved:"Resuelta",cancelled:"Cancelada"}
const HK_STATUS={scheduled:"Programada",assigned:"Asignada",in_progress:"En curso",inspection:"A inspección",done:"Lista",blocked:"Bloqueada"}
const ROOM_STATUS={sucia:"Sucia",limpia:"Limpia",inspeccionada:"Inspeccionada",libre:"Lista",mantenimiento:"Mantenimiento",fuera_servicio:"Fuera de servicio"}
const HK_TYPE={clean:"Limpieza",stayover:"Repaso de estadía",checkout:"Limpieza de salida",inspection:"Inspección",turndown:"Turn down",linen:"Ropa blanca",minibar:"Minibar",deep_clean:"Limpieza profunda",other:"Otra"}
const AREA={housekeeping:"Housekeeping",maintenance:"Mantenimiento",reception:"Recepción"}

const fmt=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"Sin vencimiento"
const localInput=value=>{if(!value)return"";const date=new Date(value),offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,16)}
const iso=value=>value?new Date(value).toISOString():null
const toneFor=status=>["resolved","done","inspeccionada","libre"].includes(status)?"green":["assigned","in_progress","inspection","limpia"].includes(status)?"yellow":"red"
const activeHousekeeping=status=>status!=="done"
function emit(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}

export default function ReservationInlineOperationsDialog({mode,item,rooms=[],propertyId,onClose}){
  const[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("")
  const[tasks,setTasks]=useState([]),[requests,setRequests]=useState([]),[hkTasks,setHkTasks]=useState([]),[freshRooms,setFreshRooms]=useState([]),[staff,setStaff]=useState([])
  const[formOpen,setFormOpen]=useState(false)
  const roomIds=useMemo(()=>[...new Set((rooms.length?rooms:[{id:item?.habitacion_id}]).map(room=>Number(room?.id)).filter(Boolean))],[rooms,item?.habitacion_id])
  const roomMap=useMemo(()=>new Map((freshRooms.length?freshRooms:rooms).map(room=>[Number(room.id),room])),[freshRooms,rooms])
  const staffMap=useMemo(()=>new Map(staff.map(profile=>[profile.id,profile])),[staff])
  const defaultRoom=String(roomIds[0]||"")
  const[taskDraft,setTaskDraft]=useState({title:"",description:"",room_id:defaultRoom,priority:"normal",assigned_to:"",due_at:""})
  const[requestDraft,setRequestDraft]=useState({title:"",detail:"",room_id:defaultRoom,priority:"normal",assigned_area:"housekeeping",assigned_to:"",requested_by:"guest",due_at:""})
  const[hkDraft,setHkDraft]=useState({room_id:defaultRoom,task_type:item?.estado==="alojado"?"stayover":"clean",priority:"normal",assigned_to:"",scheduled_for:"",notes:""})
  const title=mode==="tasks"?"Tareas de mantenimiento":mode==="requests"?"Peticiones del huésped":"Pisos / Housekeeping"
  const kicker=mode==="tasks"?"MANTENIMIENTO":mode==="requests"?"PETICIONES":"HOUSEKEEPING"
  const subtitle=`${item?.nombre_huesped||"Huésped"} · Reserva ${item?.numero_reserva||item?.id||"—"}`
  const areaStaff=useMemo(()=>staff.filter(person=>["owner","manager","admin",requestDraft.assigned_area].includes(person.member_role||person.role)),[staff,requestDraft.assigned_area])
  const maintenanceStaff=useMemo(()=>staff.filter(person=>["owner","manager","admin","maintenance"].includes(person.member_role||person.role)),[staff])
  const housekeepingStaff=useMemo(()=>staff.filter(person=>["owner","manager","admin","housekeeping"].includes(person.member_role||person.role)),[staff])

  async function load(){
    if(!propertyId||!item?.id)return
    setLoading(true);setError("")
    try{
      const memberRes=await supabase.from("property_members").select("user_id,role").eq("property_id",propertyId)
      if(memberRes.error)throw memberRes.error
      const members=memberRes.data||[],memberIds=members.map(row=>row.user_id),roleByUser=new Map(members.map(row=>[row.user_id,row.role]))
      let profileRows=[]
      if(memberIds.length){const profileRes=await supabase.from("profiles").select("id,full_name,role").in("id",memberIds);if(profileRes.error)throw profileRes.error;profileRows=(profileRes.data||[]).map(row=>({...row,member_role:roleByUser.get(row.id)||row.role}))}
      setStaff(profileRows)
      if(mode==="tasks"){
        const res=await supabase.from("hotel_maintenance_tickets").select("id,reservation_id,room_id,title,description,priority,status,assigned_to,due_at,started_at,completed_at,created_at,updated_at").eq("property_id",propertyId).eq("reservation_id",Number(item.id)).order("created_at",{ascending:false}).limit(100)
        if(res.error)throw res.error;setTasks(res.data||[])
      }else if(mode==="requests"){
        const res=await supabase.from("hotel_guest_requests").select("id,reservation_id,room_id,title,detail,status,priority,assigned_area,assigned_to,requested_by,due_at,resolved_at,created_at,updated_at").eq("property_id",propertyId).eq("reservation_id",Number(item.id)).order("created_at",{ascending:false}).limit(100)
        if(res.error)throw res.error;setRequests(res.data||[])
      }else{
        const roomRes=roomIds.length?await supabase.from("habitaciones").select("id,nombre,tipo,estado,housekeeping_zone").eq("property_id",propertyId).in("id",roomIds):{data:[],error:null}
        const taskRes=await supabase.from("hotel_housekeeping_tasks").select("id,reservation_id,room_id,task_type,priority,status,assigned_to,scheduled_for,started_at,completed_at,notes,created_at,updated_at").eq("property_id",propertyId).eq("reservation_id",Number(item.id)).order("created_at",{ascending:false}).limit(100)
        if(roomRes.error)throw roomRes.error;if(taskRes.error)throw taskRes.error;setFreshRooms(roomRes.data||[]);setHkTasks(taskRes.data||[])
      }
    }catch(err){setError(err?.message||"No se pudo cargar la operación de esta reserva.")}
    finally{setLoading(false)}
  }

  useEffect(()=>{setFormOpen(false);setTaskDraft(v=>({...v,room_id:defaultRoom}));setRequestDraft(v=>({...v,room_id:defaultRoom}));setHkDraft(v=>({...v,room_id:defaultRoom}));load()},[mode,item?.id,propertyId,defaultRoom])
  function notify(tables){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables}}))}

  async function createTask(){
    if(!taskDraft.title.trim())return setError("Escribí qué tarea hay que realizar.")
    setSaving(true);setError("")
    try{const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const payload={property_id:propertyId,reservation_id:Number(item.id),room_id:taskDraft.room_id?Number(taskDraft.room_id):null,title:taskDraft.title.trim(),description:taskDraft.description.trim()||null,priority:taskDraft.priority,status:"open",assigned_to:taskDraft.assigned_to||null,reported_by:userData?.user?.id||null,due_at:iso(taskDraft.due_at),cost:0,photos:[],notes:`Reserva ${item.numero_reserva||item.id} · ${item.nombre_huesped||"Huésped"}`};const{data,error:insertError}=await supabase.from("hotel_maintenance_tickets").insert(payload).select().single();if(insertError)throw insertError;setTasks(list=>[data,...list]);setTaskDraft({title:"",description:"",room_id:defaultRoom,priority:"normal",assigned_to:"",due_at:""});setFormOpen(false);notify(["hotel_maintenance_tickets"]);emit({title:"Enviado a Mantenimiento",message:"La tarea ya está en la cola del área y quedó vinculada a la reserva."})}catch(err){setError(err?.message||"No se pudo crear la tarea.")}finally{setSaving(false)}}

  async function createRequest(){
    if(!requestDraft.title.trim())return setError("Escribí el pedido o la solicitud.")
    setSaving(true);setError("")
    try{const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const payload={property_id:propertyId,reservation_id:Number(item.id),room_id:requestDraft.room_id?Number(requestDraft.room_id):Number(item.habitacion_id)||null,title:requestDraft.title.trim(),detail:requestDraft.detail.trim()||null,status:"open",priority:requestDraft.priority,assigned_area:requestDraft.assigned_area,assigned_to:requestDraft.assigned_to||null,requested_by:requestDraft.requested_by,created_by:userData?.user?.id||null,due_at:iso(requestDraft.due_at)};const{data,error:insertError}=await supabase.from("hotel_guest_requests").insert(payload).select().single();if(insertError)throw insertError;setRequests(list=>[data,...list]);setRequestDraft({title:"",detail:"",room_id:defaultRoom,priority:"normal",assigned_area:"housekeeping",assigned_to:"",requested_by:"guest",due_at:""});setFormOpen(false);notify(["hotel_guest_requests"]);emit({title:`Enviado a ${AREA[payload.assigned_area]||"el área"}`,message:"La petición quedó vinculada al huésped y se notificará en tiempo real al área elegida."})}catch(err){setError(err?.message||"No se pudo crear la petición.")}finally{setSaving(false)}}

  async function createHousekeeping(overrides={}){
    const draft={...hkDraft,...overrides},roomId=Number(draft.room_id)
    if(!roomId)return setError("Elegí una habitación.")
    if(hkTasks.find(task=>Number(task.room_id)===roomId&&activeHousekeeping(task.status)))return setError("Esa habitación ya tiene una tarea de pisos activa.")
    setSaving(true);setError("")
    try{const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const now=new Date().toISOString(),payload={property_id:propertyId,reservation_id:Number(item.id),room_id:roomId,task_type:draft.task_type||"stayover",priority:draft.priority||"normal",status:"scheduled",assigned_to:draft.assigned_to||null,scheduled_for:iso(draft.scheduled_for)||now,checklist:[],minibar:[],linen:{},notes:draft.notes.trim()||`Solicitado desde la ficha de ${item.nombre_huesped||"huésped"}.`,created_by:userData?.user?.id||null};const{data,error:insertError}=await supabase.from("hotel_housekeeping_tasks").insert(payload).select().single();if(insertError)throw insertError;setHkTasks(list=>[data,...list]);setHkDraft({room_id:defaultRoom,task_type:item?.estado==="alojado"?"stayover":"clean",priority:"normal",assigned_to:"",scheduled_for:"",notes:""});setFormOpen(false);notify(["hotel_housekeeping_tasks"]);emit({title:"Enviado a Housekeeping",message:`Hab. ${roomMap.get(roomId)?.nombre||roomId} ya está en la cola de pisos.`})}catch(err){setError(err?.message||"No se pudo crear la tarea de pisos.")}finally{setSaving(false)}}

  const rows=mode==="tasks"?tasks:mode==="requests"?requests:hkTasks
  const counts=useMemo(()=>{let red=0,yellow=0,green=0;for(const row of rows){const tone=toneFor(row.status);if(tone==="green")green++;else if(tone==="yellow")yellow++;else red++}return{red,yellow,green}},[rows])

  return <div className={s.shade} onMouseDown={event=>event.target===event.currentTarget&&!saving&&onClose?.()}>
    <section className={s.dialog} role="dialog" aria-modal="true" aria-label={title}>
      <header className={s.header}><div><small>{kicker}</small><h2>{title}</h2><p>{subtitle}</p></div><button type="button" className={s.close} disabled={saving} onClick={onClose}>×</button></header>
      <div className={s.statusStrip}><span data-tone="red"><i/>Pendientes {counts.red}</span><span data-tone="yellow"><i/>En proceso {counts.yellow}</span><span data-tone="green"><i/>Listas {counts.green}</span></div>
      {error?<div className={s.error}>{error}<button type="button" onClick={()=>setError("")}>×</button></div>:null}
      <div className={s.toolbar}><div><b>{mode==="tasks"?"Tareas vinculadas":mode==="requests"?"Pedidos vinculados":"Habitaciones de la reserva"}</b><small>{mode==="housekeeping"?`${freshRooms.length||rooms.length} habitación${(freshRooms.length||rooms.length)===1?"":"es"}`:`${rows.length} registro${rows.length===1?"":"s"}`}</small></div><button type="button" className={s.primary} onClick={()=>setFormOpen(value=>!value)}>{formOpen?"Cerrar":mode==="tasks"?"+ Nueva tarea":mode==="requests"?"+ Nueva petición":"+ Tarea de pisos"}</button></div>

      {formOpen&&mode==="tasks"?<div className={s.form}><label className={s.wide}>Tarea<input value={taskDraft.title} onChange={event=>setTaskDraft(v=>({...v,title:event.target.value}))} placeholder="Ej. Revisar aire acondicionado"/></label><label>Habitación<select value={taskDraft.room_id} onChange={event=>setTaskDraft(v=>({...v,room_id:event.target.value}))}><option value="">General</option>{rooms.map(room=><option key={room.id} value={room.id}>{room.nombre} · {room.tipo||"Habitación"}</option>)}</select></label><label>Prioridad<select value={taskDraft.priority} onChange={event=>setTaskDraft(v=>({...v,priority:event.target.value}))}><option value="low">Baja</option><option value="normal">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Responsable<select value={taskDraft.assigned_to} onChange={event=>setTaskDraft(v=>({...v,assigned_to:event.target.value}))}><option value="">Área sin persona asignada</option>{maintenanceStaff.map(profile=><option key={profile.id} value={profile.id}>{profile.full_name||profile.id.slice(0,8)}</option>)}</select></label><label>Vencimiento<input type="datetime-local" value={localInput(taskDraft.due_at)} onChange={event=>setTaskDraft(v=>({...v,due_at:event.target.value}))}/></label><label className={s.wide}>Detalle<textarea value={taskDraft.description} onChange={event=>setTaskDraft(v=>({...v,description:event.target.value}))} placeholder="Información para Mantenimiento"/></label><div className={s.formActions}><button type="button" onClick={()=>setFormOpen(false)}>Cancelar</button><button type="button" className={s.primary} disabled={saving} onClick={createTask}>{saving?"Guardando…":"Enviar a Mantenimiento"}</button></div></div>:null}

      {formOpen&&mode==="requests"?<div className={s.form}><label className={s.wide}>Pedido o solicitud<input value={requestDraft.title} onChange={event=>setRequestDraft(v=>({...v,title:event.target.value}))} placeholder="Ej. Cuna, almohada extra, revisar cerradura…"/></label><label>Área responsable<select value={requestDraft.assigned_area} onChange={event=>setRequestDraft(v=>({...v,assigned_area:event.target.value,assigned_to:""}))}><option value="housekeeping">Housekeeping</option><option value="maintenance">Mantenimiento</option><option value="reception">Recepción</option></select></label><label>Habitación<select value={requestDraft.room_id} onChange={event=>setRequestDraft(v=>({...v,room_id:event.target.value}))}>{rooms.map(room=><option key={room.id} value={room.id}>{room.nombre} · {room.tipo||"Habitación"}</option>)}</select></label><label>Prioridad<select value={requestDraft.priority} onChange={event=>setRequestDraft(v=>({...v,priority:event.target.value}))}><option value="low">Baja</option><option value="normal">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Responsable<select value={requestDraft.assigned_to} onChange={event=>setRequestDraft(v=>({...v,assigned_to:event.target.value}))}><option value="">Sin persona asignada</option>{areaStaff.map(profile=><option key={profile.id} value={profile.id}>{profile.full_name||profile.id.slice(0,8)}</option>)}</select></label><label>Solicitado por<select value={requestDraft.requested_by} onChange={event=>setRequestDraft(v=>({...v,requested_by:event.target.value}))}><option value="guest">Huésped</option><option value="reception">Recepción</option><option value="housekeeping">Housekeeping</option><option value="other">Otro</option></select></label><label>Vencimiento<input type="datetime-local" value={localInput(requestDraft.due_at)} onChange={event=>setRequestDraft(v=>({...v,due_at:event.target.value}))}/></label><label className={s.wide}>Detalle<textarea value={requestDraft.detail} onChange={event=>setRequestDraft(v=>({...v,detail:event.target.value}))} placeholder={`Indicaciones para ${AREA[requestDraft.assigned_area]||"el área"}`}/></label><div className={s.formActions}><button type="button" onClick={()=>setFormOpen(false)}>Cancelar</button><button type="button" className={s.primary} disabled={saving} onClick={createRequest}>{saving?"Guardando…":`Enviar a ${AREA[requestDraft.assigned_area]||"área"}`}</button></div></div>:null}

      {formOpen&&mode==="housekeeping"?<div className={s.form}><label>Habitación<select value={hkDraft.room_id} onChange={event=>setHkDraft(v=>({...v,room_id:event.target.value}))}>{rooms.map(room=><option key={room.id} value={room.id}>{room.nombre} · {room.tipo||"Habitación"}</option>)}</select></label><label>Tipo<select value={hkDraft.task_type} onChange={event=>setHkDraft(v=>({...v,task_type:event.target.value}))}>{Object.entries(HK_TYPE).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Prioridad<select value={hkDraft.priority} onChange={event=>setHkDraft(v=>({...v,priority:event.target.value}))}><option value="low">Baja</option><option value="normal">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Responsable<select value={hkDraft.assigned_to} onChange={event=>setHkDraft(v=>({...v,assigned_to:event.target.value}))}><option value="">Área sin persona asignada</option>{housekeepingStaff.map(profile=><option key={profile.id} value={profile.id}>{profile.full_name||profile.id.slice(0,8)}</option>)}</select></label><label>Programar<input type="datetime-local" value={localInput(hkDraft.scheduled_for)} onChange={event=>setHkDraft(v=>({...v,scheduled_for:event.target.value}))}/></label><label className={s.wide}>Nota<textarea value={hkDraft.notes} onChange={event=>setHkDraft(v=>({...v,notes:event.target.value}))} placeholder="Indicaciones para pisos"/></label><div className={s.formActions}><button type="button" onClick={()=>setFormOpen(false)}>Cancelar</button><button type="button" className={s.primary} disabled={saving} onClick={()=>createHousekeeping()}>{saving?"Guardando…":"Enviar a Housekeeping"}</button></div></div>:null}

      <div className={s.body}>
        {loading?<div className={s.empty}>Cargando…</div>:mode==="tasks"?<div className={s.list}>{tasks.map(task=><article className={s.row} key={task.id}><div className={s.statusDot} data-tone={toneFor(task.status)}/><div className={s.rowMain}><div className={s.rowTitle}><b>{task.title}</b><span data-tone={toneFor(task.status)}>{TASK_STATUS[task.status]||task.status}</span></div><p>{task.description||"Sin detalle"}</p><small>Hab. {roomMap.get(Number(task.room_id))?.nombre||"General"} · {PRIORITY[task.priority]||task.priority} · {staffMap.get(task.assigned_to)?.full_name||"Sin asignar"} · {fmt(task.due_at)}</small></div></article>)}{!tasks.length?<div className={s.empty}>No hay tareas vinculadas a esta estadía.</div>:null}</div>:mode==="requests"?<div className={s.list}>{requests.map(request=><article className={s.row} key={request.id}><div className={s.statusDot} data-tone={toneFor(request.status)}/><div className={s.rowMain}><div className={s.rowTitle}><b>{request.title}</b><span data-tone={toneFor(request.status)}>{REQUEST_STATUS[request.status]||request.status}</span></div><p>{request.detail||"Sin detalle"}</p><small>{AREA[request.assigned_area]||"Recepción"} · Hab. {roomMap.get(Number(request.room_id))?.nombre||"—"} · {PRIORITY[request.priority]||request.priority} · {staffMap.get(request.assigned_to)?.full_name||"Sin asignar"} · {fmt(request.due_at)}</small></div></article>)}{!requests.length?<div className={s.empty}>Todavía no hay peticiones para esta reserva.</div>:null}</div>:<div className={s.floorGrid}>{(freshRooms.length?freshRooms:rooms).map(room=>{const roomTasks=hkTasks.filter(task=>Number(task.room_id)===Number(room.id)),active=roomTasks.find(task=>activeHousekeeping(task.status))||null;return <article className={s.floorCard} key={room.id}><div className={s.floorTop}><div><small>{room.tipo||"Habitación"}</small><b>Hab. {room.nombre}</b></div><span data-tone={toneFor(room.estado)}><i/>{ROOM_STATUS[room.estado]||room.estado||"Sin estado"}</span></div>{active?<div className={s.hkTask}><div><b>{HK_TYPE[active.task_type]||active.task_type}</b><small>{staffMap.get(active.assigned_to)?.full_name||"Sin asignar"} · {fmt(active.scheduled_for)}</small></div><span data-tone={toneFor(active.status)}>{HK_STATUS[active.status]||active.status}</span></div>:<p className={s.noTask}>Sin tarea activa de pisos.</p>}<div className={s.floorActions}>{!active?<button type="button" className={s.primary} disabled={saving} onClick={()=>createHousekeeping({room_id:String(room.id),task_type:item?.estado==="alojado"?"stayover":"clean"})}>Solicitar limpieza</button>:null}</div></article>})}</div>}
      </div>
      <footer className={s.footer}><span>Recepción crea y consulta. El área responsable toma y resuelve desde su dashboard.</span><button type="button" onClick={onClose}>Cerrar</button></footer>
    </section>
  </div>
}
