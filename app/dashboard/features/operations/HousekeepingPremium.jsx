"use client"

import{useEffect,useMemo,useState}from"react"
import{isoDate,shortDate}from"../../core/formatters"
import{
  assignHousekeepingTask,
  autoAssignHousekeeping,
  saveHousekeepingReport,
  resolveHousekeepingReport,
  saveHousekeepingAssignmentRule,
  deleteHousekeepingAssignmentRule,
  reportHousekeepingMaintenance,
}from"../../services/operations"
import{saveHousekeepingSchedule,setHousekeepingRoomState}from"../../services/housekeepingWorkspace"
import{useHousekeepingWorkspace}from"../../hooks/useHousekeepingWorkspace"
import hk from"./housekeeping-premium.module.css"
import ex from"./housekeeping-extended.module.css"

const DAYS=[{v:1,l:"Lu"},{v:2,l:"Ma"},{v:3,l:"Mi"},{v:4,l:"Ju"},{v:5,l:"Vi"},{v:6,l:"Sá"},{v:0,l:"Do"}]
const SOURCE_LABEL={manual:"Cambio manual",checkin:"Check-in",checkout:"Check-out",task:"Tarea",automation:"Automático"}
const ROLE_LABEL={owner:"Propietario",manager:"Gerencia",reception:"Recepción",housekeeping:"Housekeeping",maintenance:"Mantenimiento",night_audit:"Auditoría nocturna"}
const REPORT_LABEL={lost_found:"Objeto perdido",room_note:"Nota de habitación"}
const SCOPE_LABEL={all:"Todo el hotel",floor:"Piso",zone:"Zona",room_type:"Tipología"}
const statusKey=value=>{const v=String(value||"").toLowerCase();if(v==="sucia")return"dirty";if(v==="limpieza"||v==="en_limpieza")return"working";if(v==="limpia")return"clean";if(["inspeccion","inspeccionada","libre","disponible"].includes(v))return"ready";return"blocked"}
const statusLabel=value=>{const v=String(value||"").toLowerCase();if(v==="sucia")return"Sucio";if(v==="limpieza"||v==="en_limpieza")return"En limpieza";if(v==="limpia")return"Limpio";if(v==="inspeccion"||v==="inspeccionada")return"Inspeccionado";if(v==="mantenimiento")return"Mantenimiento";if(v==="fuera_servicio")return"Fuera de servicio";return"Disponible"}
const roomInReservation=(reservation,roomId)=>String(reservation?.habitacion_id??"")===String(roomId)||(reservation?.habitaciones_ids||[]).some(id=>String(id)===String(roomId))
const datePlus=(value,days)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const nightsBetween=(a,b)=>{const start=new Date(`${a}T12:00:00`),end=new Date(`${b}T12:00:00`);return Math.max(0,Math.round((end-start)/86400000))}
const taskDate=task=>String(task?.scheduled_for||"").slice(0,10)
const taskOpen=task=>!["done","cancelled","canceled"].includes(String(task?.status||"").toLowerCase())
const maintenanceOpen=item=>!["done","resolved","cancelled","canceled"].includes(String(item?.status||"").toLowerCase())
const timeLabel=value=>String(value||"").slice(0,5)||"--:--"
const sourceLabel=value=>SOURCE_LABEL[value]||String(value||"Manual")
const csvCell=value=>`"${String(value??"").replaceAll('"','""')}"`
const byPriority=(a,b)=>Number(a.priority||100)-Number(b.priority||100)||(a.scope_type==="all"?1:0)-(b.scope_type==="all"?1:0)

function ActionButtons({item,busy,onState,onInspect}){
  if(item.state==="blocked")return <span className={hk.blockedLabel}>Sin transición</span>
  return <div className={hk.actionRow}>
    {item.state==="dirty"&&<><button type="button" disabled={busy} onClick={()=>onState(item.room,"limpieza")}>Empezar</button><button type="button" disabled={busy} onClick={()=>onState(item.room,"limpia")}>Pasar a limpio</button></>}
    {item.state==="working"&&<button type="button" disabled={busy} onClick={()=>onState(item.room,"limpia")}>Pasar a limpio</button>}
    {item.state==="clean"&&<button type="button" className={hk.inspectButton} disabled={busy} onClick={()=>onInspect(item.room.id)}>Inspeccionar</button>}
    {item.state==="ready"&&<button type="button" disabled={busy} onClick={()=>onState(item.room,"sucia")}>Marcar sucia</button>}
  </div>
}

function DayCard({item,kind,selected,busy,onSelect,onState,onInspect,staffName}){
  const reservation=kind==="turnover"?item.arrival:item.arrival||item.stay||item.departure
  const right=kind==="turnover"?`${timeLabel(item.departure?.hora_salida_estimada||"10:00")} → ${timeLabel(item.arrival?.hora_llegada_estimada||"14:00")}`:kind==="arrival"?timeLabel(item.arrival?.hora_llegada_estimada||"14:00"):kind==="departure"?timeLabel(item.departure?.hora_salida_estimada||"10:00"):kind==="refresh"?`Limpieza ${item.schedule?.next_cleaning_date===isoDate()?"hoy":shortDate(item.schedule?.next_cleaning_date)}`:statusLabel(item.room.estado)
  const assigned=item.openTasks.find(task=>task.assigned_to)
  return <article className={`${hk.dayCard} ${selected?hk.selectedDayCard:""}`} onClick={()=>onSelect(item.room.id)}>
    <div className={hk.dayTop}><span><b>{item.room.nombre}</b><i className={hk[item.state]}/><small>{item.room.tipo||"Habitación"}</small></span><em>{right}</em></div>
    <div className={hk.dayMeta}><span>♙ {reservation?.cantidad_huespedes||1}/{item.room.capacidad||1}</span>{reservation&&<span>☾ {reservation.noches??nightsBetween(reservation.fecha_entrada,reservation.fecha_salida)}</span>}{item.openTasks.length>0&&<span>☑ {item.openTasks.length} tarea{item.openTasks.length===1?"":"s"}</span>}{assigned&&<span>● {staffName(assigned.assigned_to)}</span>}</div>
    <ActionButtons item={item} busy={busy} onState={onState} onInspect={onInspect}/>
  </article>
}

function RackCard({item,selected,onSelect,staffName}){
  const context=item.arrival?item.arrival:item.stay?item.stay:item.departure
  const assigned=item.openTasks.find(task=>task.assigned_to)
  const footer=assigned?`● ${staffName(assigned.assigned_to)}`:item.arrival?`↧ ${shortDate(item.arrival.fecha_entrada)}`:item.departure?`↥ ${shortDate(item.departure.fecha_salida)}`:item.schedule?.next_cleaning_date?`▣ ${shortDate(item.schedule.next_cleaning_date)}`:"Sin novedad"
  return <button type="button" className={`${hk.rackCard} ${hk[item.state]} ${selected?hk.selectedRack:""}`} onClick={()=>onSelect(item.room.id)}>
    <span className={hk.rackNumber}>{item.room.nombre}</span>
    <small>{item.room.tipo||"Habitación"}</small>
    <em>{context?`${context.cantidad_huespedes||1}/${item.room.capacidad||1}`:`0/${item.room.capacidad||1}`}</em>
    <strong>{footer}</strong>
  </button>
}

export default function HousekeepingPremium({rooms=[],floors=[],reservations=[],tasks=[],onSaveTask,onTaskStatus}){
  const propertyId=rooms.find(r=>r.property_id)?.property_id||reservations.find(r=>r.property_id)?.property_id||null
  const today=isoDate()
  const{ schedules,history,checklist,reports,rules,tasks:localTasks,maintenance,staff,error:workspaceError,refresh:loadHousekeepingMeta }=useHousekeepingWorkspace(propertyId,tasks)
  const[dayOffset,setDayOffset]=useState(0)
  const selectedDate=datePlus(today,dayOffset)
  const[selectedFloor,setSelectedFloor]=useState("all")
  const[statusFilter,setStatusFilter]=useState("all")
  const[selectedRoomId,setSelectedRoomId]=useState(null)
  const[checkState,setCheckState]=useState({})
  const[scheduleDraft,setScheduleDraft]=useState({mode:"periodic",every:2,weekdays:[],active:true,notes:""})
  const[message,setMessage]=useState("")
  const[busyRoom,setBusyRoom]=useState(null)
  const[historyOpen,setHistoryOpen]=useState(false)
  const[taskRoom,setTaskRoom]=useState("")
  const[reportDraft,setReportDraft]=useState(null)
  const[rulesOpen,setRulesOpen]=useState(false)
  const[ruleDraft,setRuleDraft]=useState({scope_type:"all",scope_value:"",assignee_id:"",priority:100,active:true})
  const[autoBusy,setAutoBusy]=useState(false)

  useEffect(()=>{if(workspaceError)setMessage(workspaceError)},[workspaceError])

  const floorNames=useMemo(()=>new Map(floors.map(f=>[String(f.id),f.name])),[floors])
  const scheduleByReservation=useMemo(()=>new Map(schedules.map(s=>[String(s.reservation_id),s])),[schedules])
  const staffName=id=>staff.find(member=>String(member.user_id)===String(id))?.profile?.full_name||staff.find(member=>String(member.user_id)===String(id))?.role||"Sin asignar"

  const details=useMemo(()=>rooms.map(room=>{
    const linked=reservations.filter(r=>r.estado!=="cancelada"&&!r.no_show&&roomInReservation(r,room.id))
    const arrival=linked.find(r=>r.fecha_entrada===selectedDate&&r.estado!=="finalizada")
    const departure=linked.find(r=>r.fecha_salida===selectedDate&&r.estado!=="finalizada")
    const stay=linked.find(r=>r.fecha_entrada<selectedDate&&r.fecha_salida>selectedDate&&r.estado==="alojado")
    const schedule=scheduleByReservation.get(String(stay?.id||arrival?.id||""))||null
    const openTasks=localTasks.filter(t=>String(t.room_id)===String(room.id)&&taskOpen(t)&&(!taskDate(t)||taskDate(t)<=selectedDate))
    const state=statusKey(room.estado),turnover=!!(arrival&&departure),refresh=!!(stay&&schedule?.active&&schedule.next_cleaning_date===selectedDate)
    const priority=turnover&&state!=="ready"?0:arrival&&state!=="ready"?1:refresh?2:openTasks.some(t=>t.priority==="urgent")?1:state==="dirty"?3:state==="working"||state==="clean"?4:5
    return{room,arrival,departure,stay,schedule,openTasks,state,turnover,refresh,priority,floor:floorNames.get(String(room.floor_id))||"Sin piso"}
  }).sort((a,b)=>a.priority-b.priority||String(a.room.nombre).localeCompare(String(b.room.nombre),"es",{numeric:true})),[rooms,reservations,localTasks,selectedDate,scheduleByReservation,floorNames])

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
  const selected=details.find(item=>String(item.room.id)===String(selectedRoomId))||null
  const selectedReservation=selected?.stay||selected?.arrival||selected?.departure||null
  const selectedSchedule=selectedReservation?scheduleByReservation.get(String(selectedReservation.id))||null:null
  const selectedHistory=selected?history.filter(row=>String(row.room_id)===String(selected.room.id)).slice(0,10):[]
  const selectedReports=selected?reports.filter(row=>String(row.room_id)===String(selected.room.id)).slice(0,8):[]
  const selectedMaintenance=selected?maintenance.filter(row=>String(row.room_id)===String(selected.room.id)&&maintenanceOpen(row)).slice(0,6):[]
  const lastClean=selected?history.find(row=>String(row.room_id)===String(selected.room.id)&&["limpia","inspeccionada","inspeccion"].includes(String(row.to_status||"").toLowerCase())):null
  const primaryTask=selected?.openTasks.find(task=>task.assigned_to)||selected?.openTasks[0]||null

  useEffect(()=>{if(selectedRoomId||!daily.some(section=>section.items.length))return;const first=daily.find(section=>section.items.length)?.items[0];if(first)setSelectedRoomId(first.room.id)},[selectedRoomId,daily])
  useEffect(()=>{if(!selectedReservation){setScheduleDraft({mode:"periodic",every:2,weekdays:[],active:true,notes:""});return}setScheduleDraft({mode:selectedSchedule?.mode||"periodic",every:selectedSchedule?.every_n_nights||2,weekdays:selectedSchedule?.weekdays||[],active:selectedSchedule?.active!==false,notes:selectedSchedule?.notes||""})},[selectedReservation?.id,selectedSchedule?.updated_at])
  useEffect(()=>{if(!selectedRoomId)return;const next={};checklist.forEach(item=>{next[item.id]=false});setCheckState(next)},[selectedRoomId,checklist])

  function matchRule(room){
    return [...rules].filter(rule=>rule.active!==false).sort(byPriority).find(rule=>{
      if(rule.scope_type==="all")return true
      if(rule.scope_type==="floor")return String(rule.scope_value||"")===String(room.floor_id||"")
      if(rule.scope_type==="zone")return String(rule.scope_value||"").toLowerCase()===String(room.housekeeping_zone||"").toLowerCase()
      if(rule.scope_type==="room_type")return String(rule.scope_value||"").toLowerCase()===String(room.tipo||"").toLowerCase()
      return false
    })||null
  }

  async function setRoomState(room,status,checklistPayload=[]){
    setMessage("");setBusyRoom(room.id)
    try{
      await setHousekeepingRoomState({roomId:room.id,status,checklist:checklistPayload,source:"manual",note:null})
      setMessage(status==="inspeccionada"?`Habitación ${room.nombre} inspeccionada y lista.`:`Habitación ${room.nombre}: ${statusLabel(status)}.`)
      await loadHousekeepingMeta()
    }catch(e){setMessage(e.message||"No pudimos cambiar el estado.")}finally{setBusyRoom(null)}
  }
  function inspectRoom(roomId){setSelectedRoomId(roomId);setTimeout(()=>document.getElementById("hl-housekeeping-checklist")?.scrollIntoView({behavior:"smooth",block:"center"}),20)}
  async function confirmInspection(){if(!selected)return;const payload=checklist.map(item=>({id:item.id,label:item.label,required:item.required,done:!!checkState[item.id]}));await setRoomState(selected.room,"inspeccionada",payload)}
  async function saveSchedule(){if(!selectedReservation)return;setMessage("");try{await saveHousekeepingSchedule({reservationId:selectedReservation.id,draft:scheduleDraft});await loadHousekeepingMeta();setMessage("Rutina de limpieza guardada. La próxima fecha se recalculó.")}catch(e){setMessage(e.message||"No pudimos guardar la rutina.")}}
  async function quickTask(){if(!taskRoom)return;const room=rooms.find(r=>String(r.id)===String(taskRoom)),rule=room?matchRule(room):null;await onSaveTask?.({room_id:taskRoom,task_type:"cleaning",priority:"normal",status:"pending",assigned_to:rule?.assignee_id||null,scheduled_for:new Date().toISOString(),notes:"Tarea creada desde Housekeeping"});setTaskRoom("");await loadHousekeepingMeta()}
  async function finishTask(task){await onTaskStatus?.(task,"done");await loadHousekeepingMeta()}
  async function changeAssignee(task,assigneeId){try{await assignHousekeepingTask({taskId:task.id,assigneeId:assigneeId||null});await loadHousekeepingMeta();setMessage(assigneeId?`Tarea asignada a ${staffName(assigneeId)}.`:"Tarea sin responsable fijo.")}catch(e){setMessage(e.message||"No pudimos asignar la tarea.")}}
  async function runAutoAssign(){if(!propertyId)return;setAutoBusy(true);setMessage("");try{const result=await autoAssignHousekeeping({propertyId,date:selectedDate});await loadHousekeepingMeta();setMessage(`Turno preparado: ${Number(result?.created||0)} tarea(s) creada(s) y ${Number(result?.assigned||0)} asignada(s) por reglas.`)}catch(e){setMessage(e.message||"No pudimos autoasignar el turno.")}finally{setAutoBusy(false)}}
  const toggleWeekday=value=>setScheduleDraft(x=>({...x,weekdays:x.weekdays.includes(value)?x.weekdays.filter(v=>v!==value):[...x.weekdays,value]}))
  const requiredChecklist=checklist.filter(item=>item.required),requiredDone=requiredChecklist.every(item=>checkState[item.id])

  function openReport(kind){
    if(!selected)return
    setReportDraft({kind,title:"",detail:"",priority:kind==="maintenance"?"high":"normal"})
  }
  async function submitReport(event){
    event.preventDefault()
    if(!selected||!reportDraft)return
    try{
      if(reportDraft.kind==="maintenance")await reportHousekeepingMaintenance({propertyId,roomId:selected.room.id,title:reportDraft.title,description:reportDraft.detail,priority:reportDraft.priority})
      else await saveHousekeepingReport({propertyId,roomId:selected.room.id,reservationId:selectedReservation?.id||null,kind:reportDraft.kind,title:reportDraft.title,detail:reportDraft.detail,priority:reportDraft.priority})
      setReportDraft(null);await loadHousekeepingMeta();setMessage(reportDraft.kind==="maintenance"?"Avería enviada a Mantenimiento.":reportDraft.kind==="lost_found"?"Objeto perdido registrado.":"Nota guardada en la habitación.")
    }catch(e){setMessage(e.message||"No pudimos guardar el reporte.")}
  }
  async function closeReport(report){try{await resolveHousekeepingReport({propertyId,id:report.id});await loadHousekeepingMeta();setMessage("Reporte marcado como resuelto.")}catch(e){setMessage(e.message||"No pudimos cerrar el reporte.")}}

  function resetRuleDraft(){setRuleDraft({scope_type:"all",scope_value:"",assignee_id:staff[0]?.user_id||"",priority:100,active:true})}
  function scopeOptions(){
    if(ruleDraft.scope_type==="floor")return floors.filter(f=>f.active!==false).map(f=>({value:String(f.id),label:f.name}))
    if(ruleDraft.scope_type==="zone")return [...new Set(rooms.map(r=>String(r.housekeeping_zone||"").trim()).filter(Boolean))].sort().map(v=>({value:v,label:v}))
    if(ruleDraft.scope_type==="room_type")return [...new Set(rooms.map(r=>String(r.tipo||"").trim()).filter(Boolean))].sort().map(v=>({value:v,label:v}))
    return[]
  }
  async function saveRule(event){
    event.preventDefault()
    try{await saveHousekeepingAssignmentRule({propertyId,draft:ruleDraft});await loadHousekeepingMeta();resetRuleDraft();setMessage("Regla de autoasignación guardada.")}catch(e){setMessage(e.message||"No pudimos guardar la regla.")}
  }
  async function removeRule(rule){try{await deleteHousekeepingAssignmentRule({propertyId,id:rule.id});await loadHousekeepingMeta();setMessage("Regla eliminada.")}catch(e){setMessage(e.message||"No pudimos eliminar la regla.")}}

  function exportHistory(){
    const header=["Fecha","Habitación","Estado","Origen","Responsable","Reserva","Nota"]
    const rows=history.map(row=>[
      new Date(row.created_at).toLocaleString("es-AR"),
      rooms.find(room=>String(room.id)===String(row.room_id))?.nombre||row.room_id,
      statusLabel(row.to_status),
      sourceLabel(row.source),
      staffName(row.actor_id),
      row.reservation_id||"",
      row.note||"",
    ])
    const csv=[header,...rows].map(row=>row.map(csvCell).join(";")).join("\n")
    const blob=new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"})
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`housekeeping-${selectedDate}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }

  return <div className={hk.page}>
    <header className={hk.hero}><div><small>HOUSEKEEPING · RECEPCIÓN + PISOS</small><h2>El turno se entiende de un vistazo.</h2><p>Salidas con entrada, llegadas, repasos, responsables e incidencias viven en la misma operación.</p></div><div className={hk.summary}><span className={hk.ready}><b>{counts.ready||0}</b><small>Inspeccionadas</small></span><span className={hk.clean}><b>{counts.clean||0}</b><small>Limpias</small></span><span className={hk.dirty}><b>{counts.dirty||0}</b><small>Sucias</small></span></div></header>
    {message&&<div className={hk.notice}>{message}</div>}
    <div className={hk.toolbar}>
      <div className={hk.daySwitch}><button type="button" className={dayOffset===0?hk.active:""} onClick={()=>setDayOffset(0)}>Hoy</button><button type="button" className={dayOffset===1?hk.active:""} onClick={()=>setDayOffset(1)}>Mañana</button><span>{shortDate(selectedDate)}</span></div>
      <div className={hk.filterRow}><select value={selectedFloor} onChange={e=>setSelectedFloor(e.target.value)}><option value="all">Todos los pisos</option>{floors.filter(f=>f.active!==false).map(f=><option value={String(f.id)} key={f.id}>{f.name}</option>)}<option value="orphan">Sin piso</option></select>{[["all","Todos"],["dirty","Sucio"],["working","En limpieza"],["clean","Limpio"],["ready","Inspeccionado"]].map(([id,label])=><button type="button" key={id} className={statusFilter===id?hk.filterActive:""} onClick={()=>setStatusFilter(id)}>{label}</button>)}<button type="button" disabled={autoBusy} onClick={runAutoAssign}>{autoBusy?"Asignando…":"Autoasignar turno"}</button><button type="button" onClick={()=>{resetRuleDraft();setRulesOpen(true)}}>Equipo & reglas</button><button type="button" onClick={exportHistory}>Exportar</button><button type="button" onClick={()=>setHistoryOpen(true)}>Historial</button></div>
    </div>

    <div className={hk.workspace}>
      <aside className={hk.turnList}><header><div><small>LISTA DEL DÍA</small><h3>{dayOffset===0?"Qué urge hoy":"Preparar mañana"}</h3></div><span>{daily.reduce((n,s)=>n+s.items.length,0)}</span></header><div className={hk.sectionStack}>{daily.map(section=><section key={section.id} className={hk.daySection}><h4>{section.label}<span>{section.items.length}</span></h4>{section.items.map(item=><DayCard key={`${section.id}-${item.room.id}`} item={item} kind={section.id} selected={String(selectedRoomId)===String(item.room.id)} busy={String(busyRoom)===String(item.room.id)} onSelect={setSelectedRoomId} onState={setRoomState} onInspect={inspectRoom} staffName={staffName}/>)}{!section.items.length&&<p className={hk.sectionEmpty}>Sin habitaciones.</p>}</section>)}</div></aside>
      <main className={hk.rack}><header><div><small>RACK POR PISOS</small><h3>Estado del hotel</h3></div><div className={hk.legend}><span><i className={hk.dirty}/>Sucio</span><span><i className={hk.clean}/>Limpio</span><span><i className={hk.ready}/>Inspeccionado</span></div></header>{floorGroups.map(([name,items])=><section key={name}><div className={hk.floorTitle}><span><b>{name}</b><small>{items[0]?.room?.housekeeping_zone?`Zona ${items[0].room.housekeeping_zone}`:"Habitaciones agrupadas por planta"}</small></span><em>{items.length}</em></div><div className={hk.rackGrid}>{items.map(item=><RackCard key={item.room.id} item={item} selected={String(selectedRoomId)===String(item.room.id)} onSelect={setSelectedRoomId} staffName={staffName}/>)}</div></section>)}{!floorGroups.length&&<div className={hk.empty}>No hay habitaciones para estos filtros.</div>}</main>
    </div>

    <section className={hk.quickTask}><div><small>TAREA RÁPIDA</small><b>Agregar una limpieza o repaso; si hay una regla, se asigna sola.</b></div><select value={taskRoom} onChange={e=>setTaskRoom(e.target.value)}><option value="">Elegir habitación…</option>{rooms.map(r=><option value={r.id} key={r.id}>Hab. {r.nombre}</option>)}</select><button type="button" disabled={!taskRoom} onClick={quickTask}>＋ Crear tarea</button></section>

    {selected&&<div className={hk.drawerBackdrop} onMouseDown={e=>e.target===e.currentTarget&&setSelectedRoomId(null)}><aside className={hk.drawer}><header><div><small>HOUSEKEEPING · HABITACIÓN</small><h3>{selected.room.nombre} <span>{selected.room.tipo||"Habitación"}</span></h3><p>{selected.floor} · {statusLabel(selected.room.estado)}</p></div><button type="button" onClick={()=>setSelectedRoomId(null)}>×</button></header>
      <div className={hk.drawerBody}>
        <section className={hk.statusPanel}><div className={hk.statusFlow}><span className={selected.state==="dirty"?hk.flowActive:""}>Sucio</span><i>→</i><span className={selected.state==="clean"||selected.state==="working"?hk.flowActive:""}>Limpio</span><i>→</i><span className={selected.state==="ready"?hk.flowActive:""}>Inspeccionado</span></div><ActionButtons item={selected} busy={String(busyRoom)===String(selected.room.id)} onState={setRoomState} onInspect={inspectRoom}/></section>

        <section className={ex.staffStrip}>
          <div><small>ÚLTIMA LIMPIEZA / INSPECCIÓN</small><b>{lastClean?new Date(lastClean.created_at).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"}):"Sin registro"}</b><span>{lastClean?staffName(lastClean.actor_id):"Todavía no hay responsable registrado"}</span></div>
          <div><small>RESPONSABLE ACTUAL</small>{primaryTask?<select value={primaryTask.assigned_to||""} onChange={e=>changeAssignee(primaryTask,e.target.value)}><option value="">Sin asignar</option>{staff.map(member=><option key={member.user_id} value={member.user_id}>{member.profile?.full_name||member.role} · {ROLE_LABEL[member.role]||member.role}</option>)}</select>:<b>Sin tarea abierta</b>}<span>{selected.room.housekeeping_zone?`Zona ${selected.room.housekeeping_zone}`:"Sin zona configurada"}</span></div>
        </section>

        {selectedReservation&&<section className={hk.contextCard}><header><h4>Contexto de la reserva</h4><button type="button" onClick={()=>window.open(`/dashboard?reservation=${encodeURIComponent(selectedReservation.id)}`,"_blank","noopener,noreferrer")}>Ir a la reserva ↗</button></header><div className={hk.contextGrid}><span><small>Llegada</small><b>{shortDate(selectedReservation.fecha_entrada)}</b></span><span><small>Salida</small><b>{shortDate(selectedReservation.fecha_salida)}</b></span><span><small>Ocupación</small><b>{selectedReservation.cantidad_huespedes||1}</b></span><span><small>Noches</small><b>{selectedReservation.noches??nightsBetween(selectedReservation.fecha_entrada,selectedReservation.fecha_salida)}</b></span></div>{selected.turnover&&<div className={hk.turnoverNote}>Salida + entrada el mismo día: esta habitación bloquea una llegada hasta quedar inspeccionada.</div>}</section>}

        <section className={ex.reportActions}><header><div><small>INCIDENCIAS Y MEMORIA DE HABITACIÓN</small><h4>Lo que antes se avisaba por radio, queda vinculado a la puerta.</h4></div></header><div><button type="button" onClick={()=>openReport("maintenance")}>⚒ Reportar avería</button><button type="button" onClick={()=>openReport("lost_found")}>⌕ Objeto perdido</button><button type="button" onClick={()=>openReport("room_note")}>✎ Nota de habitación</button></div>{selectedMaintenance.map(ticket=><article key={ticket.id}><span><b>Avería · {ticket.title}</b><small>{ticket.priority} · {ticket.status}</small></span><em>Mantenimiento</em></article>)}{selectedReports.map(report=><article key={report.id}><span><b>{REPORT_LABEL[report.kind]} · {report.title}</b><small>{report.detail||"Sin detalle"} · {new Date(report.created_at).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"})}</small></span>{report.status==="open"?<button type="button" onClick={()=>closeReport(report)}>Resolver</button>:<em>Resuelto</em>}</article>)}</section>

        {selected.state==="clean"&&<section id="hl-housekeeping-checklist" className={hk.checklistPanel}><header><div><small>CHECKLIST DE INSPECCIÓN</small><h4>La habitación no avanza a inspeccionada a ciegas.</h4></div><span>{Object.values(checkState).filter(Boolean).length}/{checklist.length}</span></header><div className={hk.checkRows}>{checklist.map(item=><label key={item.id}><input type="checkbox" checked={!!checkState[item.id]} onChange={e=>setCheckState(x=>({...x,[item.id]:e.target.checked}))}/><span><b>{item.label}</b><small>{item.required?"Obligatoria":"Opcional"}</small></span></label>)}</div><button type="button" className={hk.confirmInspect} disabled={!requiredDone||String(busyRoom)===String(selected.room.id)} onClick={confirmInspection}>✓ Confirmar inspección</button>{!requiredDone&&<p>Las tareas obligatorias bloquean la inspección hasta completarse.</p>}</section>}

        {selectedReservation&&selectedReservation.fecha_salida>selectedReservation.fecha_entrada&&<section className={hk.schedulePanel}><header><div><small>GESTIONAR LIMPIEZA</small><h4>Rutina durante la estadía</h4></div>{selectedSchedule?.next_cleaning_date&&<span>Próxima · {shortDate(selectedSchedule.next_cleaning_date)}</span>}</header><div className={hk.modeSwitch}><button type="button" className={scheduleDraft.mode==="periodic"?hk.active:""} onClick={()=>setScheduleDraft(x=>({...x,mode:"periodic"}))}>Periódica</button><button type="button" className={scheduleDraft.mode==="weekdays"?hk.active:""} onClick={()=>setScheduleDraft(x=>({...x,mode:"weekdays"}))}>Elegir días</button></div>{scheduleDraft.mode==="periodic"?<label className={hk.nightField}><span>Cada cuántas noches</span><input type="number" min="1" max="60" value={scheduleDraft.every} onChange={e=>setScheduleDraft(x=>({...x,every:e.target.value}))}/></label>:<div className={hk.weekdays}>{DAYS.map(day=><button type="button" key={day.v} className={scheduleDraft.weekdays.includes(day.v)?hk.dayActive:""} onClick={()=>toggleWeekday(day.v)}>{day.l}</button>)}</div>}<label className={hk.toggle}><input type="checkbox" checked={scheduleDraft.active!==false} onChange={e=>setScheduleDraft(x=>({...x,active:e.target.checked}))}/><span>Rutina activa durante la estadía</span></label><button type="button" className={hk.saveSchedule} onClick={saveSchedule}>Guardar rutina</button></section>}

        <section className={hk.taskPanel}><header><small>TAREAS ABIERTAS</small><span>{selected.openTasks.length}</span></header>{selected.openTasks.map(task=><article key={task.id}><span><b>{String(task.task_type||"Tarea").replace(/_/g," ")}</b><small>{task.priority||"normal"} · {task.scheduled_for?new Date(task.scheduled_for).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"}):"Sin horario"}</small></span><select className={ex.assigneeSelect} value={task.assigned_to||""} onChange={e=>changeAssignee(task,e.target.value)}><option value="">Sin asignar</option>{staff.map(member=><option value={member.user_id} key={member.user_id}>{member.profile?.full_name||member.role}</option>)}</select><button type="button" onClick={()=>finishTask(task)}>Terminar</button></article>)}{!selected.openTasks.length&&<p className={hk.sectionEmpty}>Sin tareas pendientes.</p>}</section>

        <section className={hk.historyPanel}><header><div><small>MEMORIA</small><h4>Últimos cambios</h4></div><button type="button" onClick={()=>setHistoryOpen(true)}>Ver historial completo</button></header>{selectedHistory.map(row=><article key={row.id}><i className={hk[statusKey(row.to_status)]}/><span><b>{sourceLabel(row.source)} · {statusLabel(row.to_status)}</b><small>{new Date(row.created_at).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"})} · {staffName(row.actor_id)}{row.note?` · ${row.note}`:""}</small></span></article>)}{!selectedHistory.length&&<p className={hk.sectionEmpty}>Todavía no hay cambios registrados para esta habitación.</p>}</section>
      </div>
    </aside></div>}

    {reportDraft&&<div className={ex.modalBackdrop} onMouseDown={e=>e.target===e.currentTarget&&setReportDraft(null)}><form className={ex.modalCard} onSubmit={submitReport}><header><div><small>HABITACIÓN {selected?.room?.nombre}</small><h3>{reportDraft.kind==="maintenance"?"Reportar avería":reportDraft.kind==="lost_found"?"Registrar objeto perdido":"Agregar nota de habitación"}</h3></div><button type="button" onClick={()=>setReportDraft(null)}>×</button></header><label><span>{reportDraft.kind==="lost_found"?"Objeto":"Título"}</span><input autoFocus value={reportDraft.title} onChange={e=>setReportDraft(x=>({...x,title:e.target.value}))}/></label><label><span>Detalle</span><textarea rows="4" value={reportDraft.detail} onChange={e=>setReportDraft(x=>({...x,detail:e.target.value}))}/></label>{reportDraft.kind!=="room_note"&&<label><span>Prioridad</span><select value={reportDraft.priority} onChange={e=>setReportDraft(x=>({...x,priority:e.target.value}))}><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>}<footer><button type="button" onClick={()=>setReportDraft(null)}>Cancelar</button><button>Guardar</button></footer></form></div>}

    {rulesOpen&&<div className={ex.modalBackdrop} onMouseDown={e=>e.target===e.currentTarget&&setRulesOpen(false)}><section className={`${ex.modalCard} ${ex.rulesCard}`}><header><div><small>EQUIPO DE PISOS</small><h3>Responsables y autoasignación</h3><p>Podés asignar por piso, zona, tipología o dejar una regla general de respaldo.</p></div><button type="button" onClick={()=>setRulesOpen(false)}>×</button></header><div className={ex.staffGrid}>{staff.map(member=><article key={member.user_id}><span>{(member.profile?.full_name||member.role||"?").slice(0,2).toUpperCase()}</span><div><b>{member.profile?.full_name||"Usuario del hotel"}</b><small>{ROLE_LABEL[member.role]||member.role}</small></div></article>)}</div><div className={ex.ruleList}>{rules.map(rule=><article key={rule.id}><div><b>{SCOPE_LABEL[rule.scope_type]||rule.scope_type}{rule.scope_value?` · ${rule.scope_type==="floor"?(floors.find(f=>String(f.id)===String(rule.scope_value))?.name||rule.scope_value):rule.scope_value}`:""}</b><small>→ {staffName(rule.assignee_id)} · prioridad {rule.priority}</small></div><button type="button" onClick={()=>removeRule(rule)}>Eliminar</button></article>)}{!rules.length&&<p>No hay reglas todavía. Sin reglas, las tareas quedan disponibles para asignación manual.</p>}</div><form className={ex.ruleForm} onSubmit={saveRule}><select value={ruleDraft.scope_type} onChange={e=>setRuleDraft(x=>({...x,scope_type:e.target.value,scope_value:""}))}><option value="all">Todo el hotel</option><option value="floor">Piso</option><option value="zone">Zona</option><option value="room_type">Tipología</option></select>{ruleDraft.scope_type!=="all"&&<select value={ruleDraft.scope_value} onChange={e=>setRuleDraft(x=>({...x,scope_value:e.target.value}))}><option value="">Elegir…</option>{scopeOptions().map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>}<select value={ruleDraft.assignee_id} onChange={e=>setRuleDraft(x=>({...x,assignee_id:e.target.value}))}><option value="">Responsable…</option>{staff.map(member=><option key={member.user_id} value={member.user_id}>{member.profile?.full_name||member.role}</option>)}</select><input aria-label="Prioridad" type="number" min="1" max="999" value={ruleDraft.priority} onChange={e=>setRuleDraft(x=>({...x,priority:e.target.value}))}/><button>＋ Regla</button></form></section></div>}

    {historyOpen&&<div className={hk.historyBackdrop} onMouseDown={e=>e.target===e.currentTarget&&setHistoryOpen(false)}><section className={hk.historyModal}><header><div><small>HOUSEKEEPING · AUDITORÍA</small><h3>Historial de limpiezas</h3></div><div className={ex.historyTools}><button type="button" onClick={exportHistory}>Exportar CSV</button><button type="button" onClick={()=>setHistoryOpen(false)}>×</button></div></header><div className={hk.historyTable}><div className={hk.historyHead}><span>Acción</span><span>Puerta</span><span>Reserva</span><span>Fecha / responsable</span><span>Estado</span></div>{history.slice(0,180).map(row=><div className={hk.historyLine} key={row.id}><span>{sourceLabel(row.source)}</span><span>{rooms.find(room=>String(room.id)===String(row.room_id))?.nombre||row.room_id}</span><span>{row.reservation_id?`#${row.reservation_id}`:"—"}</span><span>{new Date(row.created_at).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"})}<small className={ex.historyPerson}>{staffName(row.actor_id)}</small></span><span><i className={hk[statusKey(row.to_status)]}/>{statusLabel(row.to_status)}</span></div>)}</div></section></div>}
  </div>
}
