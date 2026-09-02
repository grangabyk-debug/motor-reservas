"use client"

import{useEffect,useMemo,useState}from"react"
import{shortDate}from"../../core/formatters"
import{loadPlanningContext}from"../../services/planningWorkspace"
import PlanningHistory from"./PlanningHistory"
import pc from"./planning-context.module.css"

function roomName(rooms,id){return rooms.find(r=>String(r.id)===String(id))?.nombre||`Hab. ${id}`}
function activeReservation(r){return r&&r.estado!=="cancelada"&&!r.no_show}
function occupancyStart(r){return String(r?.ocupacion_desde_local||`${r?.fecha_entrada||""}T${r?.hora_llegada_estimada||"14:00"}:00`).replace(" ","T")}
function occupancyEnd(r){return String(r?.ocupacion_hasta_local||`${r?.fecha_salida||""}T${r?.hora_salida_estimada||"10:00"}:00`).replace(" ","T")}
function overlaps(aStart,aEnd,bStart,bEnd){return aStart<bEnd&&aEnd>bStart}
function incomingType(r){return String(r?.tipo_habitacion||r?.room_type||r?.habitacion_tipo||"").trim().toLowerCase()}
function blockOverlaps(block,reservation){if(!block||!reservation)return false;return reservation.fecha_entrada<block.fecha_hasta&&reservation.fecha_salida>=block.fecha_desde}
function isoToday(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function addDate(date,days){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function dayDiff(a,b){return Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000)}
function dayLabel(date){return new Date(`${date}T12:00:00`).toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"}).replace(/\./g,"")}
function roomUsable(room,incoming,reservations,blocks,planned){
  if(!room||room.activa===false)return false
  const pax=Math.max(1,Number(incoming.cantidad_huespedes||1));if(Number(room.capacidad||1)<pax)return false
  const start=occupancyStart(incoming),end=occupancyEnd(incoming)
  if((blocks||[]).some(b=>String(b.habitacion_id)===String(room.id)&&blockOverlaps(b,incoming)))return false
  if(reservations.some(other=>String(other.id)!==String(incoming.id)&&activeReservation(other)&&String(other.habitacion_id)===String(room.id)&&overlaps(start,end,occupancyStart(other),occupancyEnd(other))))return false
  if(planned.some(item=>String(item.roomId)===String(room.id)&&overlaps(start,end,item.start,item.end)))return false
  return true
}
function roomScore(room,incoming,reservations){
  const pax=Math.max(1,Number(incoming.cantidad_huespedes||1)),hint=incomingType(incoming),roomType=String(room.tipo||"").trim().toLowerCase(),sameType=hint&&roomType===hint,outgoing=reservations.filter(r=>activeReservation(r)&&String(r.habitacion_id)===String(room.id)&&r.fecha_salida===incoming.fecha_entrada&&occupancyEnd(r)<=occupancyStart(incoming)).sort((a,b)=>occupancyEnd(b).localeCompare(occupancyEnd(a)))[0]||null,capacityGap=Math.max(0,Number(room.capacidad||1)-pax),state=String(room.estado||"").toLowerCase();let score=0
  if(outgoing)score+=70;if(sameType)score+=40;score+=Math.max(0,18-capacityGap*4);if(state==="limpia"||state==="libre")score+=10;if(state==="sucia")score-=8
  return{score,outgoing,sameType,capacityGap}
}

export default function PlanningContextBar({rooms=[],reservations=[],blocks=[],onMove,onOpen}){
  const propertyId=rooms.find(r=>r.property_id)?.property_id||reservations.find(r=>r.property_id)?.property_id||null
  const[groupBlocks,setGroupBlocks]=useState([]),[groups,setGroups]=useState([]),[open,setOpen]=useState(true),[assigning,setAssigning]=useState(false),[assignMessage,setAssignMessage]=useState(""),[insightOpen,setInsightOpen]=useState("")
  useEffect(()=>{let active=true;if(!propertyId){setGroupBlocks([]);setGroups([]);return()=>{active=false}}loadPlanningContext(propertyId).then(data=>{if(!active)return;setGroupBlocks(data.groupBlocks);setGroups(data.groups)}).catch(()=>{if(active){setGroupBlocks([]);setGroups([])}});return()=>{active=false}},[propertyId])

  const unassigned=useMemo(()=>reservations.filter(r=>activeReservation(r)&&(!r.habitacion_id||!rooms.some(room=>String(room.id)===String(r.habitacion_id)))).sort((a,b)=>occupancyStart(a).localeCompare(occupancyStart(b))),[reservations,rooms])
  const visibleBlocks=useMemo(()=>groupBlocks.filter(b=>b.departure_date>=isoToday()).slice(0,8),[groupBlocks])
  const suggestions=useMemo(()=>{
    const planned=[],output=[]
    for(const incoming of unassigned){
      const ranked=rooms.filter(room=>roomUsable(room,incoming,reservations,blocks,planned)).map(room=>({room,...roomScore(room,incoming,reservations)})).sort((a,b)=>b.score-a.score||a.capacityGap-b.capacityGap||String(a.room.nombre||"").localeCompare(String(b.room.nombre||""),"es"))
      const best=ranked[0];if(!best)continue
      const reason=best.outgoing?`${best.outgoing.nombre_huesped||"Huésped"} sale ese día · habitación lista para el próximo ingreso`:best.sameType?`Tipología exacta · disponible durante toda la estadía`:`Mejor disponible · capacidad ${best.room.capacidad||1} pax`
      output.push({incoming,room:best.room,outgoing:best.outgoing,reason,score:best.score});planned.push({roomId:best.room.id,start:occupancyStart(incoming),end:occupancyEnd(incoming)})
    }
    return output.slice(0,8)
  },[unassigned,rooms,reservations,blocks])

  const pulse=useMemo(()=>{
    const today=isoToday(),horizon=addDate(today,30),active=reservations.filter(activeReservation),gaps=[],turnovers=[]
    for(const room of rooms){
      const list=active.filter(r=>String(r.habitacion_id)===String(room.id)).sort((a,b)=>occupancyStart(a).localeCompare(occupancyStart(b)))
      for(let i=0;i<list.length-1;i++){
        const before=list[i],after=list[i+1],gap=dayDiff(before.fecha_salida,after.fecha_entrada)
        if(gap===1&&before.fecha_salida>=today&&before.fecha_salida<=horizon)gaps.push({room,date:before.fecha_salida,before,after})
      }
      const outgoing=list.filter(r=>r.fecha_salida===today),incoming=list.filter(r=>r.fecha_entrada===today)
      if(outgoing.length&&incoming.length)turnovers.push({room,outgoing:outgoing[0],incoming:incoming[0]})
    }
    const days=Array.from({length:7},(_,i)=>addDate(today,i)),daily=days.map(day=>{const next=addDate(day,1),occupied=new Set(active.filter(r=>occupancyStart(r)<`${next}T00:00:00`&&occupancyEnd(r)>`${day}T00:00:00`).map(r=>String(r.habitacion_id)).filter(Boolean)).size,blocked=new Set((blocks||[]).filter(b=>b.fecha_desde<next&&b.fecha_hasta>day).map(b=>String(b.habitacion_id))).size,total=Math.max(rooms.length,1),pressure=Math.min(100,Math.round((occupied+blocked)/total*100));return{day,occupied,blocked,pressure}}),average=Math.round(daily.reduce((sum,d)=>sum+d.pressure,0)/daily.length),busiest=[...daily].sort((a,b)=>b.pressure-a.pressure)[0]
    return{gaps:gaps.slice(0,12),turnovers:turnovers.slice(0,12),average,busiest}
  },[rooms,reservations,blocks])

  const hasOperationalCards=!!(unassigned.length||visibleBlocks.length||suggestions.length),hasPulse=!!(rooms.length||reservations.length)

  async function assignBest(){if(assigning||!suggestions.length||!onMove)return;setAssigning(true);setAssignMessage("");let done=0;for(const item of suggestions){const result=await onMove(item.incoming.id,item.room.id,item.incoming.fecha_entrada);if(!result)break;done++}setAssignMessage(done===suggestions.length?`${done} reservas asignadas automáticamente.`:`Se asignaron ${done} de ${suggestions.length}. Revisá las restantes.`);setAssigning(false)}

  if(!propertyId&&!hasOperationalCards&&!hasPulse)return null
  return <section className={pc.context}>
    {hasPulse&&<div className={pc.pulse}>
      <div className={pc.pulseBrand}><span className={pc.pulseMark}/><div><small>HL PULSE</small><b>El Planning detecta lo que merece atención.</b><p>Oportunidades, recambios y presión operativa sin salir del calendario.</p></div></div>
      <div className={pc.pulseMetrics}>
        <button className={`${pc.pulseMetric} ${pulse.gaps.length?pc.metricOpportunity:""}`} onClick={()=>setInsightOpen(v=>v==="gaps"?"":"gaps")}><small>HUECOS VENDIBLES</small><b>{pulse.gaps.length}</b><span>{pulse.gaps.length?"1 noche entre reservas":"sin huecos críticos"}</span></button>
        <button className={`${pc.pulseMetric} ${pulse.turnovers.length?pc.metricTurnover:""}`} onClick={()=>setInsightOpen(v=>v==="turnovers"?"":"turnovers")}><small>RECAMBIO HOY</small><b>{pulse.turnovers.length}</b><span>{pulse.turnovers.length?"OUT → limpieza → IN":"operación tranquila"}</span></button>
        <div className={`${pc.pulseMetric} ${pulse.average>=80?pc.metricPressure:""}`}><small>PRESIÓN 7 DÍAS</small><b>{pulse.average}%</b><span>{pulse.busiest?`pico ${dayLabel(pulse.busiest.day)} · ${pulse.busiest.pressure}%`:"sin datos"}</span></div>
        <div className={`${pc.pulseMetric} ${unassigned.length?pc.metricAlert:""}`}><small>SIN ASIGNAR</small><b>{unassigned.length}</b><span>{unassigned.length?"requiere decisión":"todo asignado"}</span></div>
      </div>
    </div>}

    {insightOpen&&<div className={pc.insightPanel}>
      <div className={pc.insightHead}><div><small>{insightOpen==="gaps"?"RADAR DE INGRESOS":"RADAR DE RECAMBIO"}</small><b>{insightOpen==="gaps"?"Huecos de una noche que podés vender":"Habitaciones que salen y vuelven a entrar hoy"}</b></div><button onClick={()=>setInsightOpen("")}>Cerrar</button></div>
      {insightOpen==="gaps"?<div className={pc.insightRows}>{pulse.gaps.length?pulse.gaps.map(item=><div key={`${item.room.id}-${item.date}`}><span><b>{item.room.nombre||roomName(rooms,item.room.id)}</b><small>{dayLabel(item.date)} · entre {item.before.nombre_huesped||"reserva anterior"} y {item.after.nombre_huesped||"reserva siguiente"}</small></span><button onClick={()=>onOpen?.(item.after)}>Abrir próxima</button></div>):<p className={pc.insightEmpty}>No detectamos huecos de una sola noche en los próximos 30 días.</p>}</div>:<div className={pc.insightRows}>{pulse.turnovers.length?pulse.turnovers.map(item=><div key={item.room.id}><span><b>{item.room.nombre||roomName(rooms,item.room.id)}</b><small>OUT {item.outgoing.nombre_huesped||"huésped"} → IN {item.incoming.nombre_huesped||"huésped"}</small></span><button onClick={()=>onOpen?.(item.incoming)}>Abrir llegada</button></div>):<p className={pc.insightEmpty}>Hoy no hay habitaciones con salida e ingreso el mismo día.</p>}</div>}
    </div>}

    <header className={pc.head}><div><small>OPERACIÓN DEL PLANNING</small><b>{unassigned.length?`${unassigned.length} sin habitación`:"Sin pendientes"}{visibleBlocks.length?` · ${visibleBlocks.length} cupos de grupo`:""}</b></div><div className={pc.headActions}>{propertyId&&<PlanningHistory propertyId={propertyId} rooms={rooms}/>} {hasOperationalCards&&<button onClick={()=>setOpen(v=>!v)}>{open?"Ocultar":"Mostrar"}</button>}</div></header>
    {open&&hasOperationalCards&&<div className={pc.body}>
      {unassigned.length>0&&<article className={pc.playground}><div className={pc.title}><span><i/>Playground</span><small>Arrastrá una reserva al calendario para asignarla.</small></div><div className={pc.cards}>{unassigned.slice(0,10).map(r=><button key={r.id} draggable onDragStart={e=>e.dataTransfer.setData("application/x-hl-move",String(r.id))} onDoubleClick={()=>onOpen?.(r)} title="Arrastrar al planning"><span><b>{r.nombre_huesped||"Sin nombre"}</b><small>{shortDate(r.fecha_entrada)} → {shortDate(r.fecha_salida)} · {r.cantidad_huespedes||1} pax</small></span><em>↕</em></button>)}</div></article>}
      {suggestions.length>0&&<article className={pc.outin}><div className={pc.title}><span><i/>Out → In inteligente</span><div className={pc.titleActions}><small>Prioriza salida del mismo día, tipología y capacidad.</small>{suggestions.length>1&&<button className={pc.bulkAssign} disabled={assigning} onClick={assignBest}>{assigning?"Asignando…":`Asignar ${suggestions.length} mejores`}</button>}</div></div><div className={pc.suggestions}>{suggestions.map(x=><div key={`${x.incoming.id}-${x.room.id}`}><span><b>{x.incoming.nombre_huesped}</b><small>{x.room.nombre||roomName(rooms,x.room.id)} · {x.room.tipo||"Habitación"}{x.outgoing?` · OUT ${x.outgoing.nombre_huesped||"previo"}`:""}</small><em className={pc.reason}>{x.reason}</em></span><button onClick={()=>onMove?.(x.incoming.id,x.room.id,x.incoming.fecha_entrada)}>Asignar {x.room.nombre||"hab."}</button></div>)}{assignMessage&&<p className={pc.assignmentFeedback}>{assignMessage}</p>}</div></article>}
      {visibleBlocks.length>0&&<article className={pc.groups}><div className={pc.title}><span><i/>Cupos de grupos</span><small>Inventario firme/tentativo que debe respetar disponibilidad.</small></div><div className={pc.groupRows}>{visibleBlocks.map(b=>{const g=groups.find(x=>String(x.id)===String(b.group_id));return <div key={b.id}><span><b>{g?.name||"Grupo"}</b><small>{b.room_type} · {shortDate(b.arrival_date)} → {shortDate(b.departure_date)}</small></span><strong>{b.quantity} hab.</strong><em data-status={b.status}>{b.status==="firm"?"FIRME":"TENTATIVO"}</em></div>})}</div></article>}
    </div>}
  </section>
}
