"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./inventory.module.css"

function dateLabel(value){if(!value)return"Sin control reciente";return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value))}
function normalizeChecklist(value){return Array.isArray(value)?value:[]}
function entries(value){return value&&typeof value==="object"&&!Array.isArray(value)?Object.entries(value):[]}

export default function InventoryWorkspace({propertyId}){
  const[mode,setMode]=useState("rooms")
  const[rooms,setRooms]=useState([])
  const[tasks,setTasks]=useState([])
  const[query,setQuery]=useState("")
  const[selected,setSelected]=useState(null)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState("")
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[roomRes,taskRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,estado,sort_order").eq("property_id",propertyId).eq("activa",true).order("sort_order").order("nombre"),
        supabase.from("hotel_housekeeping_tasks").select("id,room_id,task_type,status,checklist,minibar,linen,notes,updated_at,created_at").eq("property_id",propertyId).order("updated_at",{ascending:false}),
      ])
      if(roomRes.error)throw roomRes.error;if(taskRes.error)throw taskRes.error
      setRooms(roomRes.data||[]);setTasks(taskRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar el inventario por habitación.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])

  const taskByRoom=useMemo(()=>{const map=new Map();for(const task of tasks)if(task.room_id&&!map.has(Number(task.room_id)))map.set(Number(task.room_id),task);return map},[tasks])
  const roomRows=useMemo(()=>rooms.map(room=>{
    const task=taskByRoom.get(Number(room.id))||null
    const checklist=normalizeChecklist(task?.checklist)
    const pending=checklist.filter(item=>item&&item.done!==true).length
    return{...room,task,checklist,pending,linen:entries(task?.linen),minibar:Array.isArray(task?.minibar)?task.minibar:entries(task?.minibar)}
  }),[rooms,taskByRoom])
  const filtered=useMemo(()=>roomRows.filter(room=>!query||`${room.nombre} ${room.tipo||""} ${room.estado||""}`.toLowerCase().includes(query.toLowerCase())),[roomRows,query])
  const withControl=roomRows.filter(room=>room.task).length
  const pendingTotal=roomRows.reduce((sum,room)=>sum+room.pending,0)
  const incomplete=roomRows.filter(room=>room.pending>0).length

  async function completeChecklist(room){
    if(!room.task||!room.checklist.length)return
    setSaving(String(room.id));setError("")
    try{
      const checklist=room.checklist.map(item=>({...item,done:true}))
      const{error:updateError}=await supabase.from("hotel_housekeeping_tasks").update({checklist,updated_at:new Date().toISOString()}).eq("id",room.task.id).eq("property_id",propertyId)
      if(updateError)throw updateError
      setSelected(null);await load()
    }catch(err){setError(err?.message||"No se pudo actualizar el control de habitación.")}
    finally{setSaving("")}
  }

  return <section className={s.page}>
    <header className={s.header}><div><small>INVENTARIO</small><h1>Control de habitación</h1><p>Información real registrada por housekeeping, separada por propiedad.</p></div><div className={s.switch}><button className={mode==="rooms"?s.active:""} onClick={()=>setMode("rooms")}>Habitaciones</button><button className={mode==="stock"?s.active:""} onClick={()=>setMode("stock")}>Stock central</button></div></header>
    {error&&<div className={s.ok}>{error}</div>}
    <div className={s.summary}><article><span>Habitaciones con control</span><b>{withControl}/{rooms.length}</b></article><article><span>Ítems pendientes</span><b>{pendingTotal}</b></article><article><span>Controles incompletos</span><b>{incomplete}</b></article></div>

    {mode==="rooms"?<>
      <div className={s.toolbar}><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar habitación, tipo o estado"/></label><button onClick={()=>setQuery("")}>Limpiar</button></div>
      {loading?<div className={s.ok}>Cargando controles…</div>:!rooms.length?<div className={s.ok}>Todavía no hay habitaciones activas en esta propiedad.</div>:<div className={s.rooms}>{filtered.map(room=><button className={`${s.room} ${room.pending?s.roomWarn:""}`} key={room.id} onClick={()=>setSelected(room)}><div><small>Habitación</small><b>{room.nombre}</b></div><span>{!room.task?"Sin control":room.pending?`${room.pending} pendiente${room.pending>1?"s":""}`:"Control completo"}</span><em>{dateLabel(room.task?.updated_at||room.task?.created_at)}</em></button>)}</div>}
      {selected&&<div className={s.drawerBackdrop} onClick={()=>setSelected(null)}><aside className={s.drawer} onClick={e=>e.stopPropagation()}><button className={s.close} onClick={()=>setSelected(null)}>×</button><small>HABITACIÓN</small><h2>{selected.nombre}</h2><p>{selected.tipo||"Habitación"} · {dateLabel(selected.task?.updated_at||selected.task?.created_at)}</p>{!selected.task?<div className={s.ok}>No existe un control de housekeeping registrado para esta habitación.</div>:<><h3>Checklist</h3>{selected.checklist.length?<ul>{selected.checklist.map((item,index)=><li key={`${item?.label||"item"}-${index}`}>{item?.done?"✓ ":"○ "}{item?.label||"Ítem"}</li>)}</ul>:<div className={s.ok}>El último control no tiene checklist cargado.</div>}<h3>Blanquería registrada</h3>{selected.linen.length?<ul>{selected.linen.map(([name,value])=><li key={name}>{name}: {String(value)}</li>)}</ul>:<div className={s.ok}>Sin registro de blanquería.</div>}<h3>Minibar</h3>{selected.minibar.length?<ul>{selected.minibar.map((item,index)=><li key={index}>{Array.isArray(item)?`${item[0]}: ${String(item[1])}`:typeof item==="object"?JSON.stringify(item):String(item)}</li>)}</ul>:<div className={s.ok}>Sin consumos o control de minibar registrado.</div>}{selected.checklist.length>0&&selected.pending>0&&<button className={s.primary} onClick={()=>completeChecklist(selected)} disabled={saving===String(selected.id)}>{saving===String(selected.id)?"Guardando…":"Marcar checklist completo"}</button>}</>}</aside></div>}
    </>:<div className={s.stockTable}><div className={s.ok}><b>Stock central sin catálogo configurado</b><p>La base actual todavía no tiene una entidad de existencias consumibles por propiedad. No mostramos cantidades ficticias. Este módulo se conectará al catálogo de stock cuando se agregue en la migración de PMS Next.</p></div></div>}
  </section>
}
