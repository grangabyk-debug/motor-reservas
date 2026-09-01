"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{shortDate}from"../../core/formatters"
import pc from"./planning-context.module.css"

function roomName(rooms,id){return rooms.find(r=>String(r.id)===String(id))?.nombre||`Hab. ${id}`}
function activeReservation(r){return r&&r.estado!=="cancelada"&&!r.no_show}
function overlaps(aStart,aEnd,bStart,bEnd){return aStart<bEnd&&aEnd>bStart}

export default function PlanningContextBar({rooms=[],reservations=[],onMove,onOpen}){
  const propertyId=rooms.find(r=>r.property_id)?.property_id||reservations.find(r=>r.property_id)?.property_id||null
  const[groupBlocks,setGroupBlocks]=useState([]),[groups,setGroups]=useState([]),[open,setOpen]=useState(true)
  useEffect(()=>{let active=true;if(!propertyId){setGroupBlocks([]);setGroups([]);return()=>{active=false}}Promise.all([
    supabase.from("hotel_group_inventory_blocks").select("*").eq("property_id",propertyId).neq("status","released").order("arrival_date"),
    supabase.from("hotel_groups").select("id,name,code,sales_stage,arrival_date,departure_date").eq("property_id",propertyId),
  ]).then(([b,g])=>{if(!active)return;if(!b.error)setGroupBlocks(b.data||[]);if(!g.error)setGroups(g.data||[])});return()=>{active=false}},[propertyId])

  const unassigned=useMemo(()=>reservations.filter(r=>activeReservation(r)&&(!r.habitacion_id||!rooms.some(room=>String(room.id)===String(r.habitacion_id)))),[reservations,rooms])
  const visibleBlocks=useMemo(()=>groupBlocks.filter(b=>b.departure_date>=new Date().toISOString().slice(0,10)).slice(0,8),[groupBlocks])
  const suggestions=useMemo(()=>unassigned.map(incoming=>{
    const candidates=reservations.filter(out=>activeReservation(out)&&out.habitacion_id&&out.fecha_salida===incoming.fecha_entrada).filter(out=>{
      const roomId=out.habitacion_id
      return !reservations.some(other=>String(other.id)!==String(out.id)&&String(other.id)!==String(incoming.id)&&String(other.habitacion_id)===String(roomId)&&activeReservation(other)&&overlaps(incoming.fecha_entrada,incoming.fecha_salida,other.fecha_entrada,other.fecha_salida))
    })
    const exact=candidates.find(out=>{const room=rooms.find(x=>String(x.id)===String(out.habitacion_id));return room&&(!incoming.tipo_habitacion||String(room.tipo||"").toLowerCase()===String(incoming.tipo_habitacion||"").toLowerCase())})||candidates[0]
    return exact?{incoming,outgoing:exact,room:rooms.find(x=>String(x.id)===String(exact.habitacion_id))}:null
  }).filter(Boolean).slice(0,4),[unassigned,reservations,rooms])

  if(!unassigned.length&&!visibleBlocks.length&&!suggestions.length)return null
  return <section className={pc.context}>
    <header className={pc.head}><div><small>OPERACIÓN DEL PLANNING</small><b>{unassigned.length?`${unassigned.length} sin habitación`:"Sin pendientes"}{visibleBlocks.length?` · ${visibleBlocks.length} cupos de grupo`:""}</b></div><button onClick={()=>setOpen(v=>!v)}>{open?"Ocultar":"Mostrar"}</button></header>
    {open&&<div className={pc.body}>
      {unassigned.length>0&&<article className={pc.playground}><div className={pc.title}><span><i/>Playground</span><small>Arrastrá una reserva al calendario para asignarla.</small></div><div className={pc.cards}>{unassigned.slice(0,10).map(r=><button key={r.id} draggable onDragStart={e=>e.dataTransfer.setData("application/x-hl-move",String(r.id))} onDoubleClick={()=>onOpen?.(r)} title="Arrastrar al planning"><span><b>{r.nombre_huesped||"Sin nombre"}</b><small>{shortDate(r.fecha_entrada)} → {shortDate(r.fecha_salida)} · {r.cantidad_huespedes||1} pax</small></span><em>↕</em></button>)}</div></article>}
      {suggestions.length>0&&<article className={pc.outin}><div className={pc.title}><span><i/>Out → In sugerido</span><small>Habitaciones que se liberan el mismo día de la llegada.</small></div><div className={pc.suggestions}>{suggestions.map(x=><div key={`${x.incoming.id}-${x.outgoing.id}`}><span><b>{x.incoming.nombre_huesped}</b><small>{x.outgoing.nombre_huesped} sale · {x.room?.nombre||roomName(rooms,x.outgoing.habitacion_id)}</small></span><button onClick={()=>onMove?.(x.incoming.id,x.outgoing.habitacion_id,x.incoming.fecha_entrada)}>Asignar {x.room?.nombre||"hab."}</button></div>)}</div></article>}
      {visibleBlocks.length>0&&<article className={pc.groups}><div className={pc.title}><span><i/>Cupos de grupos</span><small>Inventario firme/tentativo que debe respetar disponibilidad.</small></div><div className={pc.groupRows}>{visibleBlocks.map(b=>{const g=groups.find(x=>String(x.id)===String(b.group_id));return <div key={b.id}><span><b>{g?.name||"Grupo"}</b><small>{b.room_type} · {shortDate(b.arrival_date)} → {shortDate(b.departure_date)}</small></span><strong>{b.quantity} hab.</strong><em data-status={b.status}>{b.status==="firm"?"FIRME":"TENTATIVO"}</em></div>})}</div></article>}
    </div>}
  </section>
}