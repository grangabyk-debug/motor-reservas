"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"
import s from"./housekeeping.module.css"

const labels={sucia:"Sucia",limpia:"Limpia",inspeccionada:"Inspeccionada",libre:"Lista",mantenimiento:"Mantenimiento"}
const actionLabel={sucia:"Marcar limpia",limpia:"Marcar inspeccionada"}

function localDate(){return new Date().toLocaleDateString("en-CA")}
function daysBetween(a,b){return Math.floor((b-a)/86400000)}
function dateLabel(value){if(!value)return"Nunca";return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value))}

export default function HousekeepingWorkspace({propertyId}){
  const[rooms,setRooms]=useState([])
  const[reservations,setReservations]=useState([])
  const[tasks,setTasks]=useState([])
  const[deepTasks,setDeepTasks]=useState([])
  const[filter,setFilter]=useState("all")
  const[query,setQuery]=useState("")
  const[mode,setMode]=useState("daily")
  const[deepCadence,setDeepCadence]=useState(90)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState("")
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    const today=localDate()
    try{
      const[roomRes,reservationRes,taskRes,deepRes,settingsRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,estado,sort_order,housekeeping_zone").eq("property_id",propertyId).eq("activa",true).order("sort_order").order("nombre"),
        supabase.from("reservas").select("id,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,hora_llegada_estimada,hora_salida_estimada").eq("property_id",propertyId).lte("fecha_entrada",today).gte("fecha_salida",today),
        supabase.from("hotel_housekeeping_tasks").select("id,room_id,task_type,status,assigned_to,scheduled_for,notes,updated_at").eq("property_id",propertyId).neq("task_type","deep_clean").order("updated_at",{ascending:false}),
        supabase.from("hotel_housekeeping_tasks").select("id,room_id,status,scheduled_for,completed_at,created_at,notes").eq("property_id",propertyId).eq("task_type","deep_clean").order("completed_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}),
        supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      ])
      for(const result of[roomRes,reservationRes,taskRes,deepRes,settingsRes])if(result.error)throw result.error
      setRooms(roomRes.data||[]);setReservations(reservationRes.data||[]);setTasks(taskRes.data||[]);setDeepTasks(deepRes.data||[])
      const configured=Number(settingsRes.data?.settings?.housekeeping?.deep_clean_cadence_days)
      if(configured>0)setDeepCadence(configured)
    }catch(err){setError(err?.message||"No se pudo cargar Housekeeping.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])
  usePmsAutoRefresh(propertyId,load,["reservas","habitaciones","hotel_housekeeping_tasks"])

  const reservationByRoom=useMemo(()=>{
    const map=new Map()
    for(const reservation of reservations){
      const ids=[reservation.habitacion_id,...(reservation.habitaciones_ids||[])].filter(Boolean)
      ids.forEach(id=>map.set(Number(id),reservation))
    }
    return map
  },[reservations])

  const taskByRoom=useMemo(()=>{
    const map=new Map();for(const task of tasks)if(task.room_id&&!map.has(Number(task.room_id)))map.set(Number(task.room_id),task);return map
  },[tasks])

  const lastDeepByRoom=useMemo(()=>{
    const map=new Map();for(const task of deepTasks)if(task.room_id&&task.status==="done"&&!map.has(Number(task.room_id)))map.set(Number(task.room_id),task);return map
  },[deepTasks])

  const enriched=useMemo(()=>rooms.map(room=>{
    const reservation=reservationByRoom.get(Number(room.id));const task=taskByRoom.get(Number(room.id));const deep=lastDeepByRoom.get(Number(room.id))
    const today=localDate();let occupancy="Sin estadía activa"
    if(reservation){if(reservation.fecha_entrada===today&&reservation.fecha_salida===today)occupancy="Entrada y salida hoy";else if(reservation.fecha_entrada===today)occupancy=`Entrada hoy${reservation.hora_llegada_estimada?` · ${reservation.hora_llegada_estimada}`:""}`;else if(reservation.fecha_salida===today)occupancy=`Salida hoy${reservation.hora_salida_estimada?` · ${reservation.hora_salida_estimada}`:""}`;else occupancy="Huésped alojado"}
    const completed=deep?.completed_at||null;const elapsed=completed?daysBetween(new Date(completed),new Date()):null;const due=elapsed==null?null:deepCadence-elapsed
    return{...room,reservation,task,occupancy,lastDeep:completed,deepDue:due}
  }),[rooms,reservationByRoom,taskByRoom,lastDeepByRoom,deepCadence])

  const visible=useMemo(()=>enriched.filter(room=>(filter==="all"||room.estado===filter)&&(!query||`${room.nombre} ${room.tipo||""} ${room.housekeeping_zone||""} ${room.occupancy}`.toLowerCase().includes(query.toLowerCase()))),[enriched,filter,query])
  const counts=useMemo(()=>Object.fromEntries(Object.keys(labels).map(key=>[key,enriched.filter(room=>room.estado===key).length])),[enriched])

  async function advance(room){
    const next=room.estado==="sucia"?"limpia":room.estado==="limpia"?"inspeccionada":null
    if(!next)return
    setSaving(String(room.id));setError("")
    try{
      const{error:updateError}=await supabase.from("habitaciones").update({estado:next}).eq("id",room.id).eq("property_id",propertyId)
      if(updateError)throw updateError
      const{data:userData}=await supabase.auth.getUser()
      const{error:historyError}=await supabase.from("hotel_housekeeping_history").insert({property_id:propertyId,room_id:room.id,reservation_id:room.reservation?.id||null,task_id:room.task?.id||null,from_status:room.estado,to_status:next,source:"pms_next",note:null,metadata:{surface:"housekeeping"},actor_id:userData?.user?.id||null})
      if(historyError)throw historyError
      await load()
    }catch(err){setError(err?.message||"No se pudo actualizar la habitación.")}
    finally{setSaving("")}
  }

  async function registerDeepClean(room){
    setSaving(`deep-${room.id}`);setError("")
    try{
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
      const now=new Date().toISOString()
      const{error:taskError}=await supabase.from("hotel_housekeeping_tasks").insert({property_id:propertyId,room_id:room.id,reservation_id:room.reservation?.id||null,task_type:"deep_clean",priority:"normal",status:"done",assigned_to:userData?.user?.id||null,scheduled_for:now,started_at:now,completed_at:now,checklist:[],minibar:{},linen:{},notes:null,created_by:userData?.user?.id||null})
      if(taskError)throw taskError
      await load()
    }catch(err){setError(err?.message||"No se pudo registrar la limpieza profunda.")}
    finally{setSaving("")}
  }

  async function saveCadence(){
    setSaving("cadence");setError("")
    try{
      const{data:current,error:readError}=await supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle();if(readError)throw readError
      const settings={...(current?.settings||{}),housekeeping:{...(current?.settings?.housekeeping||{}),deep_clean_cadence_days:deepCadence}}
      const{error:writeError}=await supabase.from("property_settings").upsert({property_id:propertyId,settings,updated_at:new Date().toISOString()},{onConflict:"property_id"});if(writeError)throw writeError
    }catch(err){setError(err?.message||"No se pudo guardar la cadencia.")}
    finally{setSaving("")}
  }

  return <section className={s.page}>
    <header className={s.header}><div><small>HOUSEKEEPING</small><h1>Estado de habitaciones</h1><p>Limpieza diaria, inspección y limpieza profunda con datos de la propiedad activa.</p></div><div className={s.mode}><button className={mode==="daily"?s.active:""} onClick={()=>setMode("daily")}>Operación diaria</button><button className={mode==="deep"?s.active:""} onClick={()=>setMode("deep")}>Limpieza profunda</button></div></header>
    {error&&<div className={s.note}>{error}</div>}
    {loading?<div className={s.note}>Cargando habitaciones…</div>:!rooms.length?<div className={s.note}>Todavía no hay habitaciones activas en esta propiedad.</div>:mode==="daily"?<>
      <div className={s.stats}>{Object.entries(labels).map(([key,label])=><button key={key} className={filter===key?s.selected:""} onClick={()=>setFilter(filter===key?"all":key)}><span>{label}</span><b>{counts[key]||0}</b></button>)}</div>
      <div className={s.toolbar}><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar habitación, tipo o zona"/></label><button onClick={()=>setFilter("all")}>Todas</button></div>
      <div className={s.roomGrid}>{visible.map(room=><article className={s.roomCard} key={room.id}><div className={s.roomTop}><div><small>{room.tipo||"Habitación"}</small><h2>{room.nombre}</h2></div><span data-status={room.estado}>{labels[room.estado]||room.estado}</span></div><p className={s.occupancy}>{room.occupancy}</p><dl><div><dt>Tarea</dt><dd>{room.task?room.task.task_type.replaceAll("_"," "):"Sin tarea pendiente"}</dd></div><div><dt>Última profunda</dt><dd>{dateLabel(room.lastDeep)}</dd></div></dl>{room.task?.notes&&<p className={s.note}>{room.task.notes}</p>}<footer>{actionLabel[room.estado]&&<button onClick={()=>advance(room)} disabled={saving===String(room.id)}>{saving===String(room.id)?"Guardando…":actionLabel[room.estado]}</button>}</footer></article>)}</div>
    </>:<>
      <div className={s.deepToolbar}><div><b>Cadencia de limpieza profunda</b><span>Cada <input type="number" min="1" max="365" value={deepCadence} onChange={e=>setDeepCadence(Math.max(1,Number(e.target.value)||1))}/> días <button onClick={saveCadence} disabled={saving==="cadence"}>Guardar</button></span></div><div><strong>{enriched.filter(r=>r.deepDue==null||r.deepDue<=14).length}</strong><span>habitaciones sin registro o próximas a vencer</span></div></div>
      <div className={s.deepList}>{enriched.map(room=>{const overdue=room.deepDue!=null&&room.deepDue<=0;const dueSoon=room.deepDue==null||room.deepDue<=14;return <article key={room.id} className={s.deepRow}><div className={s.deepRoom}><b>{room.nombre}</b><small>{room.tipo||"Habitación"}</small></div><div><small>Última limpieza</small><b>{dateLabel(room.lastDeep)}</b></div><div><small>Próxima</small><b className={overdue?s.overdue:dueSoon?s.soon:""}>{room.deepDue==null?"Sin registro":overdue?"Vencida":`${room.deepDue} días`}</b></div><button onClick={()=>registerDeepClean(room)} disabled={saving===`deep-${room.id}`}>{saving===`deep-${room.id}`?"Guardando…":"Registrar profunda"}</button></article>})}</div>
    </>}
  </section>
}
