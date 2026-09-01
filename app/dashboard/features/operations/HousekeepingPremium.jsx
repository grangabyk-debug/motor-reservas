"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{isoDate,shortDate}from"../../core/formatters"
import hk from"./housekeeping-premium.module.css"

const DAYS=[{v:1,l:"Lu"},{v:2,l:"Ma"},{v:3,l:"Mi"},{v:4,l:"Ju"},{v:5,l:"Vi"},{v:6,l:"Sá"},{v:0,l:"Do"}]
const SOURCE_LABEL={manual:"Cambio manual",checkin:"Check-in",checkout:"Check-out",task:"Tarea",automation:"Automático"}
const statusKey=value=>{const v=String(value||"").toLowerCase();if(v==="sucia")return"dirty";if(v==="limpieza"||v==="en_limpieza")return"working";if(v==="limpia")return"clean";if(["inspeccion","inspeccionada","libre","disponible"].includes(v))return"ready";return"blocked"}
const statusLabel=value=>{const v=String(value||"").toLowerCase();if(v==="sucia")return"Sucio";if(v==="limpieza"||v==="en_limpieza")return"En limpieza";if(v==="limpia")return"Limpio";if(v==="inspeccion"||v==="inspeccionada")return"Inspeccionado";if(v==="mantenimiento")return"Mantenimiento";if(v==="fuera_servicio")return"Fuera de servicio";return"Disponible"}
const roomInReservation=(reservation,roomId)=>String(reservation?.habitacion_id??"")===String(roomId)||(reservation?.habitaciones_ids||[]).some(id=>String(id)===String(roomId))
const datePlus=(value,days)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const nightsBetween=(a,b)=>{const start=new Date(`${a}T12:00:00`),end=new Date(`${b}T12:00:00`);return Math.max(0,Math.round((end-start)/86400000))}
const taskDate=task=>String(task?.scheduled_for||"").slice(0,10)
const taskOpen=task=>!["done","cancelled","canceled"].includes(String(task?.status||"").toLowerCase())
const timeLabel=value=>String(value||"").slice(0,5)||"--:--"
const sourceLabel=value=>SOURCE_LABEL[value]||String(value||"Manual")

function ActionButtons({item,busy,onState,onInspect}){
  if(item.state==="blocked")return <span className={hk.blockedLabel}>Sin transición</span>
  return <div className={hk.actionRow}>
    {item.state==="dirty"&&<><button type="button" disabled={busy} onClick={()=>onState(item.room,"limpieza")}>Empezar</button><button type="button" disabled={busy} onClick={()=>onState(item.room,"limpia")}>Pasar a limpio</button></>}
    {item.state==="working"&&<button type="button" disabled={busy} onClick={()=>onState(item.room,"limpia")}>Pasar a limpio</button>}
    {item.state==="clean"&&<button type="button" className={hk.inspectButton} disabled={busy} onClick={()=>onInspect(item.room.id)}>Inspeccionar</button>}
    {item.state==="ready"&&<button type="button" disabled={busy} onClick={()=>onState(item.room,"sucia")}>Marcar sucia</button>}
  </div>
}

function DayCard({item,kind,selected,busy,onSelect,onState,onInspect}){
  const reservation=kind==="turnover"?item.arrival:item.arrival||item.stay||item.departure
  const right=kind==="turnover"?`${timeLabel(item.departure?.hora_salida_estimada||"10:00")} → ${timeLabel(item.arrival?.hora_llegada_estimada||"14:00")}`:kind==="arrival"?timeLabel(item.arrival?.hora_llegada_estimada||"14:00"):kind==="departure"?timeLabel(item.departure?.hora_salida_estimada||"10:00"):kind==="refresh"?`Limpieza ${item.schedule?.next_cleaning_date===isoDate()?"hoy":shortDate(item.schedule?.next_cleaning_date)}`:statusLabel(item.room.estado)
  return <article className={`${hk.dayCard} ${selected?hk.selectedDayCard:""}`} onClick={()=>onSelect(item.room.id)}>
    <div className={hk.dayTop}><span><b>{item.room.nombre}</b><i className={hk[item.state]}/><small>{item.room.tipo||"Habitación"}</small></span><em>{right}</em></div>
    <div className={hk.dayMeta}><span>♙ {reservation?.cantidad_huespedes||1}/{item.room.capacidad||1}</span>{reservation&&<span>☾ {reservation.noches??nightsBetween(reservation.fecha_entrada,reservation.fecha_salida)}</span>}{item.openTasks.length>0&&<span>☑ {item.openTasks.length} tarea{item.openTasks.length===1?"":"s"}</span>}</div>
    <ActionButtons item={item} busy={busy} onState={onState} onInspect={onInspect}/>
  </article>
}

function RackCard({item,selected,onSelect}){
  const context=item.arrival?item.arrival:item.stay?item.stay:item.departure
  const footer=item.arrival?`↧ ${shortDate(item.arrival.fecha_entrada)}`:item.departure?`↥ ${shortDate(item.departure.fecha_salida)}`:item.schedule?.next_cleaning_date?`▣ ${shortDate(item.schedule.next_cleaning_date)}`:"Sin novedad"
  return <button type="button" className={`${hk.rackCard} ${hk[item.state]} ${selected?hk.selectedRack:""}`} onClick={()=>onSelect(item.room.id)}>
    <span className={hk.rackNumber}>{item.room.nombre}</span>
    <small>{item.room.tipo||"Habitación"}</small>
    <em>{context?`${context.cantidad_huespedes||1}/${item.room.capacidad||1}`:`0/${item.room.capacidad||1}`}</em>
    <strong>{footer}</strong>
  </button>
}

export default function HousekeepingPremium({rooms=[],floors=[],reservations=[],tasks=[],onSaveTask,onTaskStatus}){
  const propertyId=rooms.find(r=>r.property_id)?.property_id||reservations.find(r=>r.property_id)?.property_id||null
  const today=isoDate(),[dayOffset,setDayOffset]=useState(0),selectedDate=datePlus(today,dayOffset),[selectedFloor,setSelectedFloor]=useState("all"),[statusFilter,setStatusFilter]=useState("all"),[selectedRoomId,setSelectedRoomId]=useState(null),[schedules,setSchedules]=useState([]),[history,setHistory]=useState([]),[checklist,setChecklist]=useState([]),[checkState,setCheckState]=useState({}),[scheduleDraft,setScheduleDraft]=useState({mode:"periodic",every:2,weekdays:[],active:true,notes:""}),[message,setMessage]=useState(""),[busyRoom,setBusyRoom]=useState(null),[historyOpen,setHistoryOpen]=useState(false),[taskRoom,setTaskRoom]=useState("")

  async function loadHousekeepingMeta(){if(!propertyId)return;const[s,h,c]=await Promise.all([supabase.from("hotel_housekeeping_schedules").select("*").eq("property_id",propertyId).order("next_cleaning_date"),supabase.from("hotel_housekeeping_history").select("*").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(400),supabase.from("hotel_housekeeping_checklist_catalog").select("*").eq("property_id",propertyId).eq("active",true).order("sort_order").order("label")]);const error=[s,h,c].find(x=>x.error)?.error;if(error)throw error;setSchedules(s.data||[]);setHistory(h.data||[]);setChecklist(c.data||[])}
  useEffect(()=>{if(!propertyId)return;let alive=true;loadHousekeepingMeta().catch(e=>alive&&setMessage(e.message||"No pudimos cargar la operación de pisos."));const channel=supabase.channel(`hl-housekeeping-${propertyId}`).on("postgres_changes",{event:"*",schema:"public",table:"hotel_housekeeping_schedules",filter:`property_id=eq.${propertyId}`},()=>loadHousekeepingMeta().catch(()=>{})).on("postgres_changes",{event:"*",schema:"public",table:"hotel_housekeeping_history",filter:`property_id=eq.${propertyId}`},()=>loadHousekeepingMeta().catch(()=>{})).on("postgres_changes",{event:"*",schema:"public",table:"hotel_housekeeping_checklist_catalog",filter:`property_id=eq.${propertyId}`},()=>loadHousekeepingMeta().catch(()=>{})).subscribe();return()=>{alive=false;supabase.removeChannel(channel)}},[propertyId])

  const floorNames=useMemo(()=>new Map(floors.map(f=>[String(f.id),f.name])),[floors]),scheduleByReservation=useMemo(()=>new Map(schedules.map(s=>[String(s.reservation_id),s])),[schedules])
  const details=useMemo(()=>rooms.map(room=>{
    const linked=reservations.filter(r=>r.estado!=="cancelada"&&!r.no_show&&roomInReservation(r,room.id)),arrival=linked.find(r=>r.fecha_entrada===selectedDate&&r.estado!=="finalizada"),departure=linked.find(r=>r.fecha_salida===selectedDate&&r.estado!=="finalizada"),stay=linked.find(r=>r.fecha_entrada<selectedDate&&r.fecha_salida>selectedDate&&r.estado==="alojado"),schedule=scheduleByReservation.get(String(stay?.id||arrival?.id||""))||null,openTasks=tasks.filter(t=>String(t.room_id)===String(room.id)&&taskOpen(t)&&(!taskDate(t)||taskDate(t)<=selectedDate)),state=statusKey(room.estado),turnover=!!(arrival&&departure),refresh=!!(stay&&schedule?.active&&schedule.next_cleaning_date===selectedDate),priority=turnover&&state!=="ready"?0:arrival&&state!=="ready"?1:refresh?2:openTasks.some(t=>t.priority==="urgent")?1:state==="dirty"?3:state==="working"||state==="clean"?4:5
    return{room,arrival,departure,stay,schedule,openTasks,state,turnover,refresh,priority,floor:floorNames.get(String(room.floor_id))||"Sin piso"}
  }).sort((a,b)=>a.priority-b.priority||String(a.room.nombre).localeCompare(String(b.room.nombre),"es",{numeric:true})),[rooms,reservations,tasks,selectedDate,scheduleByReservation,floorNames])

  const filtered=useMemo(()=>details.filter(item=>(selectedFloor==="all"||String(item.room.floor_id||"orphan")===selectedFloor)&&(statusFilter==="all"||item.state===statusFilter)),[details,selectedFloor,statusFilter])
  const daily=useMemo(()=>{const used=new Set(),take=predicate=>filtered.filter(item=>predicate(item)&&!used.has(String(item.room.id))).map(item=>{used.add(String(item.room.id));return item});return[
    {id:"turnover",label:"Salidas con entrada",items:take(i=>i.turnover)},
    {id:"arrival",label:"Llegadas del día",items:take(i=>!!i.arrival)},
    {id:"departure",label:"Salidas",items:take(i=>!!i.departure)},
    {id:"refresh",label:"Repaso",items:take(i=>i.refresh)},
    {id:"pending",label:"Pendientes",items:take(i=>i.state==="dirty"||i.state==="working"||i.state==="clean"||i.openTasks.length>0)},
  ]},[filtered])
  const floorGroups=useMemo(()=>{const map=new Map();filtered.forEach(item=>{if(!map.has(item.floor))map.set(item.floor,[]);map.get(item.floor).push(item)});return[...map.entries()]},[filtered])
  const counts=details.reduce((a,item)=>{a[item.state]=(a[item.state]||0)+1;return a},{})
  const selected=details.find(item=>String(item.room.id)===String(selectedRoomId))||null,selectedReservation=selected?.stay||selected?.arrival||selected?.departure||null,selectedSchedule=selectedReservation?scheduleByReservation.get(String(selectedReservation.id))||null:null,selectedHistory=selected?history.filter(row=>String(row.room_id)===String(selected.room.id)).slice(0,8):[]

  useEffect(()=>{if(selectedRoomId||!daily.some(section=>section.items.length))return;const first=daily.find(section=>section.items.length)?.items[0];if(first)setSelectedRoomId(first.room.id)},[selectedRoomId,daily])
  useEffect(()=>{if(!selectedReservation){setScheduleDraft({mode:"periodic",every:2,weekdays:[],active:true,notes:""});return}setScheduleDraft({mode:selectedSchedule?.mode||"periodic",every:selectedSchedule?.every_n_nights||2,weekdays:selectedSchedule?.weekdays||[],active:selectedSchedule?.active!==false,notes:selectedSchedule?.notes||""})},[selectedReservation?.id,selectedSchedule?.updated_at])
  useEffect(()=>{if(!selectedRoomId)return;const next={};checklist.forEach(item=>{next[item.id]=false});setCheckState(next)},[selectedRoomId,checklist])

  async function setRoomState(room,status,checklistPayload=[]){setMessage("");setBusyRoom(room.id);try{const{error}=await supabase.rpc("hl_housekeeping_set_room_state",{p_room_id:Number(room.id),p_status:status,p_checklist:checklistPayload,p_source:"manual",p_note:null});if(error)throw error;setMessage(status==="inspeccionada"?`Habitación ${room.nombre} inspeccionada y lista.`:`Habitación ${room.nombre}: ${statusLabel(status)}.`);await loadHousekeepingMeta()}catch(e){setMessage(e.message||"No pudimos cambiar el estado.")}finally{setBusyRoom(null)}}
  function inspectRoom(roomId){setSelectedRoomId(roomId);setTimeout(()=>document.getElementById("hl-housekeeping-checklist")?.scrollIntoView({behavior:"smooth",block:"center"}),20)}
  async function confirmInspection(){if(!selected)return;const payload=checklist.map(item=>({id:item.id,label:item.label,required:item.required,done:!!checkState[item.id]}));await setRoomState(selected.room,"inspeccionada",payload)}
  async function saveSchedule(){if(!selectedReservation)return;setMessage("");try{const{error}=await supabase.rpc("hl_housekeeping_save_schedule",{p_reservation_id:Number(selectedReservation.id),p_mode:scheduleDraft.mode,p_every_n_nights:Math.max(1,Number(scheduleDraft.every||2)),p_weekdays:scheduleDraft.weekdays.map(Number),p_active:scheduleDraft.active!==false,p_notes:scheduleDraft.notes||null});if(error)throw error;await loadHousekeepingMeta();setMessage("Rutina de limpieza guardada. La próxima fecha se recalculó.")}catch(e){setMessage(e.message||"No pudimos guardar la rutina.")}}
  async function quickTask(){if(!taskRoom)return;await onSaveTask?.({room_id:taskRoom,task_type:"cleaning",priority:"normal",status:"pending",scheduled_for:new Date().toISOString(),notes:"Tarea creada desde Housekeeping"});setTaskRoom("")}
  async function finishTask(task){await onTaskStatus?.(task,"done")}
  const toggleWeekday=value=>setScheduleDraft(x=>({...x,weekdays:x.weekdays.includes(value)?x.weekdays.filter(v=>v!==value):[...x.weekdays,value]}))
  const requiredChecklist=checklist.filter(item=>item.required),requiredDone=requiredChecklist.every(item=>checkState[item.id])

  return <div className={hk.page}>
    <header className={hk.hero}><div><small>HOUSEKEEPING · RECEPCIÓN + PISOS</small><h2>El turno se entiende de un vistazo.</h2><p>Salidas con entrada, llegadas, repasos y estado real por planta. El check-in y el check-out alimentan el rack automáticamente.</p></div><div className={hk.summary}><span className={hk.ready}><b>{counts.ready||0}</b><small>Inspeccionadas</small></span><span className={hk.clean}><b>{counts.clean||0}</b><small>Limpias</small></span><span className={hk.dirty}><b>{counts.dirty||0}</b><small>Sucias</small></span></div></header>
    {message&&<div className={hk.notice}>{message}</div>}
    <div className={hk.toolbar}><div className={hk.daySwitch}><button type="button" className={dayOffset===0?hk.active:""} onClick={()=>setDayOffset(0)}>Hoy</button><button type="button" className={dayOffset===1?hk.active:""} onClick={()=>setDayOffset(1)}>Mañana</button><span>{shortDate(selectedDate)}</span></div><div className={hk.filterRow}><select value={selectedFloor} onChange={e=>setSelectedFloor(e.target.value)}><option value="all">Todos los pisos</option>{floors.filter(f=>f.active!==false).map(f=><option value={String(f.id)} key={f.id}>{f.name}</option>)}<option value="orphan">Sin piso</option></select>{[["all","Todos"],["dirty","Sucio"],["working","En limpieza"],["clean","Limpio"],["ready","Inspeccionado"]].map(([id,label])=><button type="button" key={id} className={statusFilter===id?hk.filterActive:""} onClick={()=>setStatusFilter(id)}>{label}</button>)}<button type="button" onClick={()=>setHistoryOpen(true)}>Historial</button></div></div>

    <div className={hk.workspace}>
      <aside className={hk.turnList}><header><div><small>LISTA DEL DÍA</small><h3>{dayOffset===0?"Qué urge hoy":"Preparar mañana"}</h3></div><span>{daily.reduce((n,s)=>n+s.items.length,0)}</span></header><div className={hk.sectionStack}>{daily.map(section=><section key={section.id} className={hk.daySection}><h4>{section.label}<span>{section.items.length}</span></h4>{section.items.map(item=><DayCard key={`${section.id}-${item.room.id}`} item={item} kind={section.id} selected={String(selectedRoomId)===String(item.room.id)} busy={String(busyRoom)===String(item.room.id)} onSelect={setSelectedRoomId} onState={setRoomState} onInspect={inspectRoom}/>)}{!section.items.length&&<p className={hk.sectionEmpty}>Sin habitaciones.</p>}</section>)}</div></aside>

      <main className={hk.rack}><header><div><small>RACK POR PISOS</small><h3>Estado del hotel</h3></div><div className={hk.legend}><span><i className={hk.dirty}/>Sucio</span><span><i className={hk.clean}/>Limpio</span><span><i className={hk.ready}/>Inspeccionado</span></div></header>{floorGroups.map(([name,items])=><section key={name}><div className={hk.floorTitle}><span><b>{name}</b><small>{items[0]?.room?.tipo?"Habitaciones agrupadas por planta":""}</small></span><em>{items.length}</em></div><div className={hk.rackGrid}>{items.map(item=><RackCard key={item.room.id} item={item} selected={String(selectedRoomId)===String(item.room.id)} onSelect={setSelectedRoomId}/>)}</div></section>)}{!floorGroups.length&&<div className={hk.empty}>No hay habitaciones para estos filtros.</div>}</main>
    </div>

    <section className={hk.quickTask}><div><small>TAREA RÁPIDA</small><b>Agregar una limpieza o repaso sin salir del rack</b></div><select value={taskRoom} onChange={e=>setTaskRoom(e.target.value)}><option value="">Elegir habitación…</option>{rooms.map(r=><option value={r.id} key={r.id}>Hab. {r.nombre}</option>)}</select><button type="button" disabled={!taskRoom} onClick={quickTask}>＋ Crear tarea</button></section>

    {selected&&<div className={hk.drawerBackdrop} onMouseDown={e=>e.target===e.currentTarget&&setSelectedRoomId(null)}><aside className={hk.drawer}><header><div><small>HOUSEKEEPING · HABITACIÓN</small><h3>{selected.room.nombre} <span>{selected.room.tipo||"Habitación"}</span></h3><p>{selected.floor} · {statusLabel(selected.room.estado)}</p></div><button type="button" onClick={()=>setSelectedRoomId(null)}>×</button></header>
      <div className={hk.drawerBody}>
        <section className={hk.statusPanel}><div className={hk.statusFlow}><span className={selected.state==="dirty"?hk.flowActive:""}>Sucio</span><i>→</i><span className={selected.state==="clean"||selected.state==="working"?hk.flowActive:""}>Limpio</span><i>→</i><span className={selected.state==="ready"?hk.flowActive:""}>Inspeccionado</span></div><ActionButtons item={selected} busy={String(busyRoom)===String(selected.room.id)} onState={setRoomState} onInspect={inspectRoom}/></section>
        {selectedReservation&&<section className={hk.contextCard}><header><h4>Contexto de la reserva</h4><button type="button" onClick={()=>window.open(`/dashboard?reservation=${encodeURIComponent(selectedReservation.id)}`,"_blank","noopener,noreferrer")}>Ir a la reserva ↗</button></header><div className={hk.contextGrid}><span><small>Llegada</small><b>{shortDate(selectedReservation.fecha_entrada)}</b></span><span><small>Salida</small><b>{shortDate(selectedReservation.fecha_salida)}</b></span><span><small>Ocupación</small><b>{selectedReservation.cantidad_huespedes||1}</b></span><span><small>Noches</small><b>{selectedReservation.noches??nightsBetween(selectedReservation.fecha_entrada,selectedReservation.fecha_salida)}</b></span></div>{selected.turnover&&<div className={hk.turnoverNote}>Salida + entrada el mismo día: esta habitación bloquea una llegada hasta quedar inspeccionada.</div>}</section>}

        {selected.state==="clean"&&<section id="hl-housekeeping-checklist" className={hk.checklistPanel}><header><div><small>CHECKLIST DE INSPECCIÓN</small><h4>La habitación no avanza a inspeccionada a ciegas.</h4></div><span>{Object.values(checkState).filter(Boolean).length}/{checklist.length}</span></header><div className={hk.checkRows}>{checklist.map(item=><label key={item.id}><input type="checkbox" checked={!!checkState[item.id]} onChange={e=>setCheckState(x=>({...x,[item.id]:e.target.checked}))}/><span><b>{item.label}</b><small>{item.required?"Obligatoria":"Opcional"}</small></span></label>)}</div><button type="button" className={hk.confirmInspect} disabled={!requiredDone||String(busyRoom)===String(selected.room.id)} onClick={confirmInspection}>✓ Confirmar inspección</button>{!requiredDone&&<p>Las tareas obligatorias bloquean la inspección hasta completarse.</p>}</section>}

        {selectedReservation&&selectedReservation.fecha_salida>selectedReservation.fecha_entrada&&<section className={hk.schedulePanel}><header><div><small>GESTIONAR LIMPIEZA</small><h4>Rutina durante la estadía</h4></div>{selectedSchedule?.next_cleaning_date&&<span>Próxima · {shortDate(selectedSchedule.next_cleaning_date)}</span>}</header><div className={hk.modeSwitch}><button type="button" className={scheduleDraft.mode==="periodic"?hk.active:""} onClick={()=>setScheduleDraft(x=>({...x,mode:"periodic"}))}>Periódica</button><button type="button" className={scheduleDraft.mode==="weekdays"?hk.active:""} onClick={()=>setScheduleDraft(x=>({...x,mode:"weekdays"}))}>Elegir días</button></div>{scheduleDraft.mode==="periodic"?<label className={hk.nightField}><span>Cada cuántas noches</span><input type="number" min="1" max="60" value={scheduleDraft.every} onChange={e=>setScheduleDraft(x=>({...x,every:e.target.value}))}/></label>:<div className={hk.weekdays}>{DAYS.map(day=><button type="button" key={day.v} className={scheduleDraft.weekdays.includes(day.v)?hk.dayActive:""} onClick={()=>toggleWeekday(day.v)}>{day.l}</button>)}</div>}<label className={hk.toggle}><input type="checkbox" checked={scheduleDraft.active!==false} onChange={e=>setScheduleDraft(x=>({...x,active:e.target.checked}))}/><span>Rutina activa durante la estadía</span></label><button type="button" className={hk.saveSchedule} onClick={saveSchedule}>Guardar rutina</button></section>}

        <section className={hk.taskPanel}><header><small>TAREAS ABIERTAS</small><span>{selected.openTasks.length}</span></header>{selected.openTasks.map(task=><article key={task.id}><span><b>{String(task.task_type||"Tarea").replace(/_/g," ")}</b><small>{task.priority||"normal"} · {task.scheduled_for?new Date(task.scheduled_for).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"}):"Sin horario"}</small></span><button type="button" onClick={()=>finishTask(task)}>Terminar</button></article>)}{!selected.openTasks.length&&<p className={hk.sectionEmpty}>Sin tareas pendientes.</p>}</section>

        <section className={hk.historyPanel}><header><div><small>MEMORIA</small><h4>Últimos cambios</h4></div><button type="button" onClick={()=>setHistoryOpen(true)}>Ver historial completo</button></header>{selectedHistory.map(row=><article key={row.id}><i className={hk[statusKey(row.to_status)]}/><span><b>{sourceLabel(row.source)} · {statusLabel(row.to_status)}</b><small>{new Date(row.created_at).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"})}{row.note?` · ${row.note}`:""}</small></span></article>)}{!selectedHistory.length&&<p className={hk.sectionEmpty}>Todavía no hay cambios registrados para esta habitación.</p>}</section>
      </div>
    </aside></div>}

    {historyOpen&&<div className={hk.historyBackdrop} onMouseDown={e=>e.target===e.currentTarget&&setHistoryOpen(false)}><section className={hk.historyModal}><header><div><small>HOUSEKEEPING · AUDITORÍA</small><h3>Historial de limpiezas</h3></div><button type="button" onClick={()=>setHistoryOpen(false)}>×</button></header><div className={hk.historyTable}><div className={hk.historyHead}><span>Acción</span><span>Puerta</span><span>Reserva</span><span>Fecha</span><span>Estado</span></div>{history.slice(0,120).map(row=><div className={hk.historyLine} key={row.id}><span>{sourceLabel(row.source)}</span><span>{rooms.find(room=>String(room.id)===String(row.room_id))?.nombre||row.room_id}</span><span>{row.reservation_id?`#${row.reservation_id}`:"—"}</span><span>{new Date(row.created_at).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"})}</span><span><i className={hk[statusKey(row.to_status)]}/>{statusLabel(row.to_status)}</span></div>)}</div></section></div>}
  </div>
}
