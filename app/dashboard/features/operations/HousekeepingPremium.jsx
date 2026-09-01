"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import{isoDate}from"../../core/formatters"
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
import HousekeepingWorkspaceView from"./components/HousekeepingWorkspaceView"

const SOURCE_LABEL={manual:"Cambio manual",checkin:"Check-in",checkout:"Check-out",task:"Tarea",automation:"Automático"}
const statusLabel=value=>{const v=String(value||"").toLowerCase();if(v==="sucia")return"Sucio";if(v==="limpieza"||v==="en_limpieza")return"En limpieza";if(v==="limpia")return"Limpio";if(v==="inspeccion"||v==="inspeccionada")return"Inspeccionado";if(v==="mantenimiento")return"Mantenimiento";if(v==="fuera_servicio")return"Fuera de servicio";return"Disponible"}
const roomInReservation=(reservation,roomId)=>String(reservation?.habitacion_id??"")===String(roomId)||(reservation?.habitaciones_ids||[]).some(id=>String(id)===String(roomId))
const datePlus=(value,days)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const taskDate=task=>String(task?.scheduled_for||"").slice(0,10)
const taskOpen=task=>!["done","cancelled","canceled"].includes(String(task?.status||"").toLowerCase())
const maintenanceOpen=item=>!["done","resolved","cancelled","canceled"].includes(String(item?.status||"").toLowerCase())
const sourceLabel=value=>SOURCE_LABEL[value]||String(value||"Manual")
const csvCell=value=>`"${String(value??"").replaceAll('"','""')}"`
const byPriority=(a,b)=>Number(a.priority||100)-Number(b.priority||100)||(a.scope_type==="all"?1:0)-(b.scope_type==="all"?1:0)

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
  const autoSelectedRoom=useRef(false)

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
    const state=(()=>{const v=String(room.estado||"").toLowerCase();if(v==="sucia")return"dirty";if(v==="limpieza"||v==="en_limpieza")return"working";if(v==="limpia")return"clean";if(["inspeccion","inspeccionada","libre","disponible"].includes(v))return"ready";return"blocked"})(),turnover=!!(arrival&&departure),refresh=!!(stay&&schedule?.active&&schedule.next_cleaning_date===selectedDate)
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

  useEffect(()=>{if(autoSelectedRoom.current||selectedRoomId||!daily.some(section=>section.items.length))return;const first=daily.find(section=>section.items.length)?.items[0];if(first){autoSelectedRoom.current=true;setSelectedRoomId(first.room.id)}},[selectedRoomId,daily])
  useEffect(()=>{if(!selectedReservation){setScheduleDraft({mode:"periodic",every:2,weekdays:[],active:true,notes:""});return}setScheduleDraft({mode:selectedSchedule?.mode||"periodic",every:selectedSchedule?.every_n_nights||2,weekdays:selectedSchedule?.weekdays||[],active:selectedSchedule?.active!==false,notes:selectedSchedule?.notes||""})},[selectedReservation?.id,selectedSchedule?.updated_at])
  useEffect(()=>{if(!selectedRoomId)return;const next={};checklist.forEach(item=>{next[item.id]=false});setCheckState(next)},[selectedRoomId,checklist])
  useEffect(()=>{
    if(!selectedRoomId)return
    const previousOverflow=document.body.style.overflow
    const onKeyDown=event=>{if(event.key!=="Escape")return;if(reportDraft)setReportDraft(null);else setSelectedRoomId(null)}
    document.body.style.overflow="hidden"
    window.addEventListener("keydown",onKeyDown)
    return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener("keydown",onKeyDown)}
  },[selectedRoomId,reportDraft])

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

  return <HousekeepingWorkspaceView vm={{
    rooms,floors,staff,history,checklist,reports,rules,selectedDate,dayOffset,selectedFloor,statusFilter,selectedRoomId,checkState,scheduleDraft,message,busyRoom,historyOpen,taskRoom,reportDraft,rulesOpen,ruleDraft,autoBusy,daily,floorGroups,counts,selected,selectedReservation,selectedSchedule,selectedHistory,selectedReports,selectedMaintenance,lastClean,primaryTask,requiredDone,
    setDayOffset,setSelectedFloor,setStatusFilter,setSelectedRoomId,setCheckState,setScheduleDraft,setHistoryOpen,setTaskRoom,setReportDraft,setRulesOpen,setRuleDraft,
    setRoomState,inspectRoom,confirmInspection,saveSchedule,quickTask,finishTask,changeAssignee,runAutoAssign,toggleWeekday,openReport,submitReport,closeReport,resetRuleDraft,scopeOptions,saveRule,removeRule,exportHistory,staffName,statusLabel,sourceLabel,
  }}/>
}
