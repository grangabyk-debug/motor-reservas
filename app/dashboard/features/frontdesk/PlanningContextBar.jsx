"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{shortDate}from"../../core/formatters"
import PlanningHistory from"./PlanningHistory"
import pc from"./planning-context.module.css"

function roomName(rooms,id){return rooms.find(r=>String(r.id)===String(id))?.nombre||`Hab. ${id}`}
function activeReservation(r){return r&&r.estado!=="cancelada"&&!r.no_show}
function occupancyStart(r){return String(r?.ocupacion_desde_local||`${r?.fecha_entrada||""}T${r?.hora_llegada_estimada||"14:00"}:00`).replace(" ","T")}
function occupancyEnd(r){return String(r?.ocupacion_hasta_local||`${r?.fecha_salida||""}T${r?.hora_salida_estimada||"10:00"}:00`).replace(" ","T")}
function overlaps(aStart,aEnd,bStart,bEnd){return aStart<bEnd&&aEnd>bStart}
function incomingType(r){return String(r?.tipo_habitacion||r?.room_type||r?.habitacion_tipo||"").trim().toLowerCase()}
function blockOverlaps(block,reservation){if(!block||!reservation)return false;return reservation.fecha_entrada<block.fecha_hasta&&reservation.fecha_salida>=block.fecha_desde}
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
  const[groupBlocks,setGroupBlocks]=useState([]),[groups,setGroups]=useState([]),[open,setOpen]=useState(true),[assigning,setAssigning]=useState(false),[assignMessage,setAssignMessage]=useState("")
  useEffect(()=>{let active=true;if(!propertyId){setGroupBlocks([]);setGroups([]);return()=>{active=false}}Promise.all([
    supabase.from("hotel_group_inventory_blocks").select("*").eq("property_id",propertyId).neq("status","released").order("arrival_date"),
    supabase.from("hotel_groups").select("id,name,code,sales_stage,arrival_date,departure_date").eq("property_id",propertyId),
  ]).then(([b,g])=>{if(!active)return;if(!b.error)setGroupBlocks(b.data||[]);if(!g.error)setGroups(g.data||[])});return()=>{active=false}},[propertyId])

  const unassigned=useMemo(()=>reservations.filter(r=>activeReservation(r)&&(!r.habitacion_id||!rooms.some(room=>String(room.id)===String(r.habitacion_id)))).sort((a,b)=>occupancyStart(a).localeCompare(occupancyStart(b))),[reservations,rooms])
  const visibleBlocks=useMemo(()=>groupBlocks.filter(b=>b.departure_date>=new Date().toISOString().slice(0,10)).slice(0,8),[groupBlocks])
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
  const hasOperationalCards=!!(unassigned.length||visibleBlocks.length||suggestions.length)

  async function assignBest(){if(assigning||!suggestions.length||!onMove)return;setAssigning(true);setAssignMessage("");let done=0;for(const item of suggestions){const result=await onMove(item.incoming.id,item.room.id,item.incoming.fecha_entrada);if(!result)break;done++}setAssignMessage(done===suggestions.length?`${done} reservas asignadas automáticamente.`:`Se asignaron ${done} de ${suggestions.length}. Revisá las restantes.`);setAssigning(false)}

  if(!propertyId&&!hasOperationalCards)return null
  return <section className={pc.context}>
    <header className={pc.head}><div><small>OPERACIÓN DEL PLANNING</small><b>{unassigned.length?`${unassigned.length} sin habitación`:"Sin pendientes"}{visibleBlocks.length?` · ${visibleBlocks.length} cupos de grupo`:""}</b></div><div className={pc.headActions}>{propertyId&&<PlanningHistory propertyId={propertyId} rooms={rooms}/>} {hasOperationalCards&&<button onClick={()=>setOpen(v=>!v)}>{open?"Ocultar":"Mostrar"}</button>}</div></header>
    {open&&hasOperationalCards&&<div className={pc.body}>
      {unassigned.length>0&&<article className={pc.playground}><div className={pc.title}><span><i/>Playground</span><small>Arrastrá una reserva al calendario para asignarla.</small></div><div className={pc.cards}>{unassigned.slice(0,10).map(r=><button key={r.id} draggable onDragStart={e=>e.dataTransfer.setData("application/x-hl-move",String(r.id))} onDoubleClick={()=>onOpen?.(r)} title="Arrastrar al planning"><span><b>{r.nombre_huesped||"Sin nombre"}</b><small>{shortDate(r.fecha_entrada)} → {shortDate(r.fecha_salida)} · {r.cantidad_huespedes||1} pax</small></span><em>↕</em></button>)}</div></article>}
      {suggestions.length>0&&<article className={pc.outin}><div className={pc.title}><span><i/>Out → In inteligente</span><div className={pc.titleActions}><small>Prioriza salida del mismo día, tipología y capacidad.</small>{suggestions.length>1&&<button className={pc.bulkAssign} disabled={assigning} onClick={assignBest}>{assigning?"Asignando…":`Asignar ${suggestions.length} mejores`}</button>}</div></div><div className={pc.suggestions}>{suggestions.map(x=><div key={`${x.incoming.id}-${x.room.id}`}><span><b>{x.incoming.nombre_huesped}</b><small>{x.room.nombre||roomName(rooms,x.room.id)} · {x.room.tipo||"Habitación"}{x.outgoing?` · OUT ${x.outgoing.nombre_huesped||"previo"}`:""}</small><em className={pc.reason}>{x.reason}</em></span><button onClick={()=>onMove?.(x.incoming.id,x.room.id,x.incoming.fecha_entrada)}>Asignar {x.room.nombre||"hab."}</button></div>)}{assignMessage&&<p className={pc.assignmentFeedback}>{assignMessage}</p>}</div></article>}
      {visibleBlocks.length>0&&<article className={pc.groups}><div className={pc.title}><span><i/>Cupos de grupos</span><small>Inventario firme/tentativo que debe respetar disponibilidad.</small></div><div className={pc.groupRows}>{visibleBlocks.map(b=>{const g=groups.find(x=>String(x.id)===String(b.group_id));return <div key={b.id}><span><b>{g?.name||"Grupo"}</b><small>{b.room_type} · {shortDate(b.arrival_date)} → {shortDate(b.departure_date)}</small></span><strong>{b.quantity} hab.</strong><em data-status={b.status}>{b.status==="firm"?"FIRME":"TENTATIVO"}</em></div>})}</div></article>}
    </div>}
  </section>
}