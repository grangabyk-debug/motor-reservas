"use client"

import{useEffect,useMemo,useState}from"react"
import{money,shortDate}from"../../core/formatters"
import{loadPlanningContext}from"../../services/planningWorkspace"
import PlanningHistory from"./PlanningHistory"
import pc from"./planning-context.module.css"
import pa from"./hl-pulse-actions.module.css"

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
function minuteDiff(a,b){return Math.round((new Date(b)-new Date(a))/60000)}
function durationLabel(minutes){if(minutes<=0)return"sin margen";const h=Math.floor(minutes/60),m=minutes%60;return h?`${h}h${m?` ${m}m`:""}`:`${m}m`}
function arrivalLabel(minutes){if(minutes<=0)return"llegada en curso";if(minutes<60)return`faltan ${minutes}m`;const h=Math.floor(minutes/60),m=minutes%60;return`faltan ${h}h${m?` ${m}m`:""}`}
function roomState(value){const v=String(value||"").toLowerCase();if(v==="sucia")return"Sucia";if(v==="limpieza"||v==="en_limpieza")return"En limpieza";if(v==="limpia")return"Limpia";if(v==="inspeccion"||v==="inspeccionada")return"Inspeccionada";if(v==="mantenimiento")return"Mantenimiento";if(v==="fuera_servicio")return"Fuera de servicio";return"Disponible"}
function roomReady(value){return["limpia","inspeccion","inspeccionada","libre","disponible"].includes(String(value||"").toLowerCase())}
function normalizeText(value){return String(value||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ")}
function guestKey(r){const email=normalizeText(r?.email_huesped||r?.email);if(email)return`e:${email}`;const phone=String(r?.telefono_huesped||r?.telefono||"").replace(/\D/g,"");if(phone.length>=7)return`p:${phone}`;const name=normalizeText(r?.nombre_huesped);return name?`n:${name}`:""}
function suggestedRate(room,pressure){const base=Number(room?.precio||0);if(!base)return 0;const multiplier=pressure>=90?1.12:pressure>=75?1.07:pressure<45?.94:1,step=base>=1000?100:1;return Math.max(step,Math.round(base*multiplier/step)*step)}
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
  const[groupBlocks,setGroupBlocks]=useState([]),[groups,setGroups]=useState([]),[open,setOpen]=useState(true),[assigning,setAssigning]=useState(false),[assignMessage,setAssignMessage]=useState(""),[insightOpen,setInsightOpen]=useState(""),[copied,setCopied]=useState("")
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
    const today=isoToday(),horizon=addDate(today,30),active=reservations.filter(activeReservation),days=Array.from({length:7},(_,i)=>addDate(today,i))
    const daily=days.map(day=>{const next=addDate(day,1),occupied=new Set(active.filter(r=>occupancyStart(r)<`${next}T00:00:00`&&occupancyEnd(r)>`${day}T00:00:00`).map(r=>String(r.habitacion_id)).filter(Boolean)).size,blocked=new Set((blocks||[]).filter(b=>b.fecha_desde<next&&b.fecha_hasta>day).map(b=>String(b.habitacion_id))).size,total=Math.max(rooms.length,1),pressure=Math.min(100,Math.round((occupied+blocked)/total*100));return{day,occupied,blocked,pressure,total}})
    const pressureFor=date=>daily.find(d=>d.day===date)?.pressure??Math.round(daily.reduce((sum,d)=>sum+d.pressure,0)/Math.max(1,daily.length)),gaps=[],turnovers=[]
    for(const room of rooms){
      const list=active.filter(r=>String(r.habitacion_id)===String(room.id)).sort((a,b)=>occupancyStart(a).localeCompare(occupancyStart(b)))
      for(let i=0;i<list.length-1;i++){
        const before=list[i],after=list[i+1],gap=dayDiff(before.fecha_salida,after.fecha_entrada)
        if(gap===1&&before.fecha_salida>=today&&before.fecha_salida<=horizon){const pressure=pressureFor(before.fecha_salida),rate=suggestedRate(room,pressure);gaps.push({room,date:before.fecha_salida,before,after,pressure,rate})}
      }
      const outgoing=list.filter(r=>r.fecha_salida===today),incoming=list.filter(r=>r.fecha_entrada===today)
      if(outgoing.length&&incoming.length){const out=outgoing[0],inc=incoming[0],buffer=minuteDiff(occupancyEnd(out),occupancyStart(inc)),until=minuteDiff(new Date().toISOString(),occupancyStart(inc)),ready=roomReady(room.estado),risk=ready?"low":until<=120?"high":until<=240?"medium":"low";turnovers.push({room,outgoing:out,incoming:inc,buffer,until,ready,risk})}
    }
    turnovers.sort((a,b)=>({high:0,medium:1,low:2}[a.risk]-({high:0,medium:1,low:2}[b.risk]))||a.until-b.until)
    const recurrent=[]
    const upcoming=active.filter(r=>r.fecha_entrada>=today&&r.fecha_entrada<=addDate(today,7)).sort((a,b)=>occupancyStart(a).localeCompare(occupancyStart(b)))
    for(const incoming of upcoming){
      const key=guestKey(incoming);if(!key)continue
      const prior=reservations.filter(r=>String(r.id)!==String(incoming.id)&&guestKey(r)===key&&r.fecha_salida<=incoming.fecha_entrada&&r.estado!=="cancelada").sort((a,b)=>String(b.fecha_salida||"").localeCompare(String(a.fecha_salida||"")))
      if(!prior.length)continue
      const typeCounts=new Map();prior.forEach(r=>{const room=rooms.find(x=>String(x.id)===String(r.habitacion_id)),type=String(room?.tipo||"").trim();if(type)typeCounts.set(type,(typeCounts.get(type)||0)+1)})
      const preferred=[...typeCounts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||"Sin patrón",last=prior[0]
      recurrent.push({incoming,prior,last,preferred,note:last?.notas||last?.observaciones||""})
    }
    const average=Math.round(daily.reduce((sum,d)=>sum+d.pressure,0)/Math.max(1,daily.length)),busiest=[...daily].sort((a,b)=>b.pressure-a.pressure)[0]
    return{gaps:gaps.sort((a,b)=>b.pressure-a.pressure||a.date.localeCompare(b.date)).slice(0,12),turnovers:turnovers.slice(0,12),daily,average,busiest,recurrent:recurrent.slice(0,9)}
  },[rooms,reservations,blocks])

  const hasOperationalCards=!!(unassigned.length||visibleBlocks.length||suggestions.length),hasPulse=!!(rooms.length||reservations.length)
  const insightMeta={gaps:["RADAR DE INGRESOS","Huecos de una noche con tarifa sugerida según presión"],turnovers:["TURNOVER CLOCK","Cuánto margen real queda entre OUT, limpieza e IN"],pressure:["PRESIÓN OPERATIVA","Los próximos siete días, antes de que se compliquen"],guests:["MEMORIA DE HUÉSPED","Llegadas de clientes recurrentes con contexto útil"]}[insightOpen]||["HL PULSE","Inteligencia operativa"]

  async function assignBest(){if(assigning||!suggestions.length||!onMove)return;setAssigning(true);setAssignMessage("");let done=0;for(const item of suggestions){const result=await onMove(item.incoming.id,item.room.id,item.incoming.fecha_entrada);if(!result)break;done++}setAssignMessage(done===suggestions.length?`${done} reservas asignadas automáticamente.`:`Se asignaron ${done} de ${suggestions.length}. Revisá las restantes.`);setAssigning(false)}
  async function copyRate(item){if(!item.rate)return;const key=`${item.room.id}-${item.date}`;try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(String(item.rate));else window.prompt("Copiá la tarifa sugerida",String(item.rate));setCopied(key);setTimeout(()=>setCopied(""),2200)}catch{window.prompt("Copiá la tarifa sugerida",String(item.rate))}}

  if(!propertyId&&!hasOperationalCards&&!hasPulse)return null
  return <section className={pc.context}>
    {hasPulse&&<div className={pc.pulse}>
      <div className={pc.pulseBrand}><span className={pc.pulseMark}/><div><small>HL PULSE</small><b>El Planning detecta lo que merece atención.</b><p>Ingresos posibles, recambios críticos y memoria de huésped sin salir del calendario.</p></div></div>
      <div className={`${pc.pulseMetrics} ${pa.pulseMetricsFive}`}>
        <button className={`${pc.pulseMetric} ${pulse.gaps.length?pc.metricOpportunity:""}`} onClick={()=>setInsightOpen(v=>v==="gaps"?"":"gaps")}><small>HUECOS VENDIBLES</small><b>{pulse.gaps.length}</b><span>{pulse.gaps.length?"con tarifa sugerida":"sin huecos críticos"}</span></button>
        <button className={`${pc.pulseMetric} ${pulse.turnovers.some(x=>x.risk!=="low")?pc.metricTurnover:""}`} onClick={()=>setInsightOpen(v=>v==="turnovers"?"":"turnovers")}><small>TURNOVER CLOCK</small><b>{pulse.turnovers.length}</b><span>{pulse.turnovers.length?`${pulse.turnovers.filter(x=>x.risk==="high").length} críticos hoy`:"operación tranquila"}</span></button>
        <button className={`${pc.pulseMetric} ${pulse.average>=80?pc.metricPressure:""}`} onClick={()=>setInsightOpen(v=>v==="pressure"?"":"pressure")}><small>PRESIÓN 7 DÍAS</small><b>{pulse.average}%</b><span>{pulse.busiest?`pico ${dayLabel(pulse.busiest.day)} · ${pulse.busiest.pressure}%`:"sin datos"}</span></button>
        <button className={`${pc.pulseMetric} ${pa.metricMemory}`} onClick={()=>setInsightOpen(v=>v==="guests"?"":"guests")}><small>MEMORIA HUÉSPED</small><b>{pulse.recurrent.length}</b><span>{pulse.recurrent.length?"recurrentes por llegar":"sin coincidencias"}</span></button>
        <div className={`${pc.pulseMetric} ${unassigned.length?pc.metricAlert:""}`}><small>SIN ASIGNAR</small><b>{unassigned.length}</b><span>{unassigned.length?"requiere decisión":"todo asignado"}</span></div>
      </div>
    </div>}

    {insightOpen&&<div className={pc.insightPanel}>
      <div className={pc.insightHead}><div><small>{insightMeta[0]}</small><b>{insightMeta[1]}</b></div><div>{copied&&<span className={pa.copied}>✓ Tarifa copiada</span>}<button onClick={()=>setInsightOpen("")}>Cerrar</button></div></div>

      {insightOpen==="gaps"&&<div className={pc.insightRows}>{pulse.gaps.length?pulse.gaps.map(item=><div key={`${item.room.id}-${item.date}`}><span><b>{item.room.nombre||roomName(rooms,item.room.id)}</b><small>{dayLabel(item.date)} · entre {item.before.nombre_huesped||"reserva anterior"} y {item.after.nombre_huesped||"reserva siguiente"}</small>{item.rate>0&&<span className={pa.rateChip}>{money(item.rate,item.after.moneda||item.before.moneda)} <em>· presión {item.pressure}%</em></span>}</span><div className={pa.rowActions}>{item.rate>0&&<button className={pa.secondary} onClick={()=>copyRate(item)}>Copiar tarifa</button>}<button onClick={()=>onOpen?.(item.after)}>Abrir próxima</button></div></div>):<p className={pc.insightEmpty}>No detectamos huecos de una sola noche en los próximos 30 días.</p>}</div>}

      {insightOpen==="turnovers"&&<div className={pc.insightRows}>{pulse.turnovers.length?pulse.turnovers.map(item=><div key={item.room.id}><span><b>{item.room.nombre||roomName(rooms,item.room.id)}</b><small>OUT {item.outgoing.nombre_huesped||"huésped"} → IN {item.incoming.nombre_huesped||"huésped"} · {item.incoming.hora_llegada_estimada||"14:00"}</small><span className={pa.turnoverMeta}><span className={`${pa.clock} ${item.ready?pa.ready:item.risk==="high"?pa.riskHigh:item.risk==="medium"?pa.riskMedium:pa.riskLow}`}>{item.ready?"Lista":`${durationLabel(item.buffer)} de margen · ${arrivalLabel(item.until)}`}</span><span className={pa.stateBadge}>{roomState(item.room.estado)}</span></span></span><div className={pa.rowActions}><button onClick={()=>onOpen?.(item.incoming)}>Abrir llegada</button></div></div>):<p className={pc.insightEmpty}>Hoy no hay habitaciones con salida e ingreso el mismo día.</p>}</div>}

      {insightOpen==="pressure"&&<div className={pa.pressureGrid}>{pulse.daily.map(item=><article key={item.day} className={pa.pressureDay}><header><b>{dayLabel(item.day)}</b><span>{item.pressure}%</span></header><div className={pa.bar}><i style={{width:`${item.pressure}%`}}/></div><small>{item.occupied} ocupadas · {item.blocked} bloqueadas · {Math.max(0,item.total-item.occupied-item.blocked)} libres teóricas</small></article>)}</div>}

      {insightOpen==="guests"&&<div className={pa.guestGrid}>{pulse.recurrent.length?pulse.recurrent.map(item=><article className={pa.guestCard} key={item.incoming.id}><header><span><b>{item.incoming.nombre_huesped||"Huésped"}</b><small>Llega {dayLabel(item.incoming.fecha_entrada)} · {item.incoming.hora_llegada_estimada||"horario sin confirmar"}</small></span><em className={pa.memoryBadge}>{item.prior.length} previas</em></header><div className={pa.guestFacts}><span><small>ÚLTIMA ESTADÍA</small><b>{shortDate(item.last.fecha_entrada)} → {shortDate(item.last.fecha_salida)}</b></span><span><small>PREFERENCIA</small><b>{item.preferred}</b></span></div>{item.note&&<p className={pa.guestNote}>Última nota: {String(item.note).slice(0,150)}</p>}<footer><button onClick={()=>onOpen?.(item.incoming)}>Abrir llegada</button></footer></article>):<p className={pc.insightEmpty}>No encontramos llegadas recurrentes en los próximos siete días.</p>}</div>}
    </div>}

    <header className={pc.head}><div><small>OPERACIÓN DEL PLANNING</small><b>{unassigned.length?`${unassigned.length} sin habitación`:"Sin pendientes"}{visibleBlocks.length?` · ${visibleBlocks.length} cupos de grupo`:""}</b></div><div className={pc.headActions}>{propertyId&&<PlanningHistory propertyId={propertyId} rooms={rooms}/>} {hasOperationalCards&&<button onClick={()=>setOpen(v=>!v)}>{open?"Ocultar":"Mostrar"}</button>}</div></header>
    {open&&hasOperationalCards&&<div className={pc.body}>
      {unassigned.length>0&&<article className={pc.playground}><div className={pc.title}><span><i/>Playground</span><small>Arrastrá una reserva al calendario para asignarla.</small></div><div className={pc.cards}>{unassigned.slice(0,10).map(r=><button key={r.id} draggable onDragStart={e=>e.dataTransfer.setData("application/x-hl-move",String(r.id))} onDoubleClick={()=>onOpen?.(r)} title="Arrastrar al planning"><span><b>{r.nombre_huesped||"Sin nombre"}</b><small>{shortDate(r.fecha_entrada)} → {shortDate(r.fecha_salida)} · {r.cantidad_huespedes||1} pax</small></span><em>↕</em></button>)}</div></article>}
      {suggestions.length>0&&<article className={pc.outin}><div className={pc.title}><span><i/>Out → In inteligente</span><div className={pc.titleActions}><small>Prioriza salida del mismo día, tipología y capacidad.</small>{suggestions.length>1&&<button className={pc.bulkAssign} disabled={assigning} onClick={assignBest}>{assigning?"Asignando…":`Asignar ${suggestions.length} mejores`}</button>}</div></div><div className={pc.suggestions}>{suggestions.map(x=><div key={`${x.incoming.id}-${x.room.id}`}><span><b>{x.incoming.nombre_huesped}</b><small>{x.room.nombre||roomName(rooms,x.room.id)} · {x.room.tipo||"Habitación"}{x.outgoing?` · OUT ${x.outgoing.nombre_huesped||"previo"}`:""}</small><em className={pc.reason}>{x.reason}</em></span><button onClick={()=>onMove?.(x.incoming.id,x.room.id,x.incoming.fecha_entrada)}>Asignar {x.room.nombre||"hab."}</button></div>)}{assignMessage&&<p className={pc.assignmentFeedback}>{assignMessage}</p>}</div></article>}
      {visibleBlocks.length>0&&<article className={pc.groups}><div className={pc.title}><span><i/>Cupos de grupos</span><small>Inventario firme/tentativo que debe respetar disponibilidad.</small></div><div className={pc.groupRows}>{visibleBlocks.map(b=>{const g=groups.find(x=>String(x.id)===String(b.group_id));return <div key={b.id}><span><b>{g?.name||"Grupo"}</b><small>{b.room_type} · {shortDate(b.arrival_date)} → {shortDate(b.departure_date)}</small></span><strong>{b.quantity} hab.</strong><em data-status={b.status}>{b.status==="firm"?"FIRME":"TENTATIVO"}</em></div>})}</div></article>}
    </div>}
  </section>
}
