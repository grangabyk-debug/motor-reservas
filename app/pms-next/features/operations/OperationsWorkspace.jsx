"use client"

import{useMemo,useState}from"react"
import useOperationsData from"./useOperationsData"
import s from"./operations.module.css"

const STATUSES=[["open","Nueva"],["assigned","Asignada"],["in_progress","En curso"],["waiting_parts","Esperando repuesto"],["resolved","Resuelta"],["cancelled","Cancelada"]]
const PRIORITY={low:"Baja",normal:"Media",high:"Alta",urgent:"Urgente"}
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"Sin fecha"

export default function OperationsWorkspace({propertyId,initialTab="maintenance"}){
  const data=useOperationsData(propertyId)
  const[tab,setTab]=useState(initialTab==="tasks"?"checklists":initialTab)
  const[query,setQuery]=useState("")
  const[view,setView]=useState("kanban")
  const[archived,setArchived]=useState(false)
  const[formOpen,setFormOpen]=useState(false)
  const[saving,setSaving]=useState(false)
  const[newChecklist,setNewChecklist]=useState("")
  const[draft,setDraft]=useState({title:"",description:"",room_id:"",priority:"normal",assigned_to:"",due_at:""})

  const visibleTasks=useMemo(()=>data.tickets.filter(t=>{
    if(archived&&t.status!=="cancelled"&&t.status!=="resolved")return false
    if(!archived&&t.status==="cancelled")return false
    const room=data.roomById.get(Number(t.room_id));const assignee=data.profileById.get(t.assigned_to)
    return !query||`${t.title} ${room?.nombre||""} ${assignee?.full_name||""} ${t.description||""}`.toLowerCase().includes(query.toLowerCase())
  }),[data.tickets,data.roomById,data.profileById,query,archived])

  const todayProgress=useMemo(()=>{
    let done=0,total=0
    for(const task of data.housekeepingTasks){const list=Array.isArray(task.checklist)?task.checklist:[];total+=list.length;done+=list.filter(item=>item?.done===true).length}
    return{done,total,pct:total?Math.round(done/total*100):0}
  },[data.housekeepingTasks])

  async function moveTask(id,status){try{await data.updateTicket(id,{status})}catch(err){data.setError(err?.message||"No se pudo actualizar la tarea.")}}
  async function saveTask(){if(!draft.title.trim())return data.setError("Ingresá un título para la tarea.");setSaving(true);data.setError("");try{await data.createTicket(draft);setFormOpen(false);setDraft({title:"",description:"",room_id:"",priority:"normal",assigned_to:"",due_at:""})}catch(err){data.setError(err?.message||"No se pudo crear la tarea.")}finally{setSaving(false)}}
  async function addChecklist(){const label=newChecklist.trim();if(!label)return;setSaving(true);try{await data.createChecklistItem(label);setNewChecklist("")}catch(err){data.setError(err?.message||"No se pudo agregar el ítem.")}finally{setSaving(false)}}

  return <section className={s.page}>
    <header className={s.header}><div><small>OPERACIONES</small><h1>Operación del hotel</h1><p>Mantenimiento y rutinas reales de la propiedad activa.</p></div><div className={s.tabs}><button className={tab==="maintenance"?s.active:""} onClick={()=>setTab("maintenance")}>Mantenimiento</button><button className={tab==="checklists"?s.active:""} onClick={()=>setTab("checklists")}>Check-lists</button><button className={tab==="requests"?s.active:""} onClick={()=>setTab("requests")}>Solicitudes</button></div></header>
    {data.error&&<div className={s.empty}><span>{data.error}</span></div>}

    {tab==="maintenance"&&<><div className={s.toolbar}><div className={s.segment}><button className={view==="kanban"?s.active:""} onClick={()=>setView("kanban")}>Kanban</button><button className={view==="table"?s.active:""} onClick={()=>setView("table")}>Tabla</button></div><label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar tarea, habitación o técnico"/></label><button className={archived?s.active:""} onClick={()=>setArchived(v=>!v)}>Archivo</button><button className={s.primary} onClick={()=>setFormOpen(true)}>+ Nueva tarea</button></div>{data.loading?<div className={s.empty}>Cargando mantenimiento…</div>:view==="kanban"?<div className={s.board}>{STATUSES.filter(([id])=>archived?['resolved','cancelled'].includes(id):id!=='cancelled').map(([id,label])=><section className={s.column} key={id} onDragOver={e=>e.preventDefault()} onDrop={e=>moveTask(e.dataTransfer.getData("task"),id)}><header><b>{label}</b><span>{visibleTasks.filter(t=>t.status===id).length}</span></header><div className={s.cards}>{visibleTasks.filter(t=>t.status===id).map(task=>{const room=data.roomById.get(Number(task.room_id)),assignee=data.profileById.get(task.assigned_to);return <article draggable onDragStart={e=>e.dataTransfer.setData("task",task.id)} className={s.card} key={task.id}><div className={s.cardTop}><span className={s.priority}>{PRIORITY[task.priority]||task.priority}</span><em>{room?`Hab. ${room.nombre}`:"General"}</em></div><h3>{task.title}</h3><p>{task.description||"Sin descripción"}</p><footer><span>{assignee?.full_name||"Sin asignar"}</span><small>{fmtDate(task.due_at)}</small></footer></article>})}{!archived&&<button className={s.addGhost} onClick={()=>setFormOpen(true)}>+ Agregar tarea</button>}</div></section>)}</div>:<div className={s.tableWrap}><table><thead><tr><th>Tarea</th><th>Habitación</th><th>Prioridad</th><th>Responsable</th><th>Estado</th><th>Vence</th></tr></thead><tbody>{visibleTasks.map(task=><tr key={task.id}><td><b>{task.title}</b></td><td>{data.roomById.get(Number(task.room_id))?.nombre||"—"}</td><td>{PRIORITY[task.priority]||task.priority}</td><td>{data.profileById.get(task.assigned_to)?.full_name||"Sin asignar"}</td><td><select value={task.status} onChange={e=>moveTask(task.id,e.target.value)}>{STATUSES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></td><td>{fmtDate(task.due_at)}</td></tr>)}</tbody></table></div>}</>}

    {tab==="checklists"&&<div className={s.checkGrid}><article className={s.checkCard}><div><small>HOY</small><h3>Progreso de housekeeping</h3><span>{data.housekeepingTasks.length} tareas programadas</span></div><div className={s.progress}><i style={{width:`${todayProgress.pct}%`}}/></div><footer><b>{todayProgress.done}/{todayProgress.total}</b><span>{todayProgress.pct}% completado</span></footer></article>{data.checklistCatalog.map(item=><article className={s.checkCard} key={item.id}><div><small>{item.required?"OBLIGATORIO":"OPCIONAL"}</small><h3>{item.label}</h3><span>Inspección de habitación</span></div><footer><b>{item.active?"Activo":"Inactivo"}</b><button disabled={saving} onClick={()=>data.toggleChecklistItem(item)}>{item.active?"Desactivar":"Activar"}</button></footer></article>)}<article className={s.checkCard}><div><small>NUEVO ÍTEM</small><h3>Agregar al checklist</h3><input value={newChecklist} onChange={e=>setNewChecklist(e.target.value)} placeholder="Ej. Revisar caja fuerte"/></div><footer><button disabled={saving||!newChecklist.trim()} onClick={addChecklist}>Agregar</button></footer></article></div>}

    {tab==="requests"&&<div className={s.empty}><b>Solicitudes de huésped</b><span>La base actual no tiene todavía una entidad de solicitudes operativas. No mostramos pedidos ficticios. Se habilitará al agregar el flujo multi-tenant correspondiente.</span></div>}

    {formOpen&&<div className={s.modalShade} onMouseDown={e=>e.target===e.currentTarget&&setFormOpen(false)}><div className={s.modal}><header><h2>Nueva tarea de mantenimiento</h2><button onClick={()=>setFormOpen(false)}>×</button></header><div className={s.form}><label className={s.wide}>Título<input value={draft.title} onChange={e=>setDraft(v=>({...v,title:e.target.value}))}/></label><label>Habitación<select value={draft.room_id} onChange={e=>setDraft(v=>({...v,room_id:e.target.value}))}><option value="">General</option>{data.rooms.map(room=><option key={room.id} value={room.id}>{room.nombre}</option>)}</select></label><label>Prioridad<select value={draft.priority} onChange={e=>setDraft(v=>({...v,priority:e.target.value}))}><option value="low">Baja</option><option value="normal">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Responsable<select value={draft.assigned_to} onChange={e=>setDraft(v=>({...v,assigned_to:e.target.value}))}><option value="">Sin asignar</option>{data.profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.full_name||profile.id.slice(0,8)}</option>)}</select></label><label>Vencimiento<input type="datetime-local" value={draft.due_at} onChange={e=>setDraft(v=>({...v,due_at:e.target.value?new Date(e.target.value).toISOString():""}))}/></label><label className={s.wide}>Descripción<textarea value={draft.description} onChange={e=>setDraft(v=>({...v,description:e.target.value}))}/></label></div><footer><button onClick={()=>setFormOpen(false)}>Cancelar</button><button disabled={saving} onClick={saveTask}>{saving?"Guardando…":"Crear tarea"}</button></footer></div></div>}
  </section>
}
