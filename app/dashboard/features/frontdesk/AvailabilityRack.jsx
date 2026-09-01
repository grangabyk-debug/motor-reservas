"use client"

import{useEffect,useMemo,useState}from"react"
import{addDays,isoDate}from"../../core/formatters"
import{loadAvailabilityGroupBlocks}from"../../services/planningWorkspace"
import rack from"./availability-rack.module.css"

const activeReservation=r=>r&&r.estado!=="cancelada"&&!r.no_show
const roomType=room=>String(room?.tipo||"Habitación").trim()||"Habitación"
const reservationOverlapsDay=(r,day)=>activeReservation(r)&&String(r.fecha_entrada||"")<addDays(day,1)&&String(r.fecha_salida||"")>day
const blockOverlapsDay=(b,day)=>String(b.fecha_desde||"")<addDays(day,1)&&String(b.fecha_hasta||"")>day
const groupBlockOverlapsDay=(b,day)=>b.status!=="released"&&String(b.arrival_date||"")<=day&&String(b.departure_date||"")>day
const dayLabel=day=>new Date(`${day}T12:00:00`).toLocaleDateString("es-AR",{weekday:"short",day:"2-digit"}).replace(".","")

export default function AvailabilityRack({rooms=[],reservations=[],blocks=[]}){
  const propertyId=rooms.find(r=>r.property_id)?.property_id||reservations.find(r=>r.property_id)?.property_id||null
  const[groupBlocks,setGroupBlocks]=useState([]),[open,setOpen]=useState(true),today=isoDate()
  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(today,i)),[today])
  const types=useMemo(()=>[...new Set(rooms.map(roomType))].sort((a,b)=>a.localeCompare(b,"es")),[rooms])

  useEffect(()=>{let active=true;if(!propertyId){setGroupBlocks([]);return()=>{active=false}}loadAvailabilityGroupBlocks(propertyId).then(data=>{if(active)setGroupBlocks(data)}).catch(()=>{if(active)setGroupBlocks([])});return()=>{active=false}},[propertyId])

  function statFor(type,day){
    const typeRooms=rooms.filter(r=>roomType(r)===type),ids=new Set(typeRooms.map(r=>String(r.id))),unavailable=new Set()
    reservations.filter(r=>reservationOverlapsDay(r,day)&&ids.has(String(r.habitacion_id))).forEach(r=>unavailable.add(String(r.habitacion_id)))
    blocks.filter(b=>blockOverlapsDay(b,day)&&ids.has(String(b.habitacion_id))).forEach(b=>unavailable.add(String(b.habitacion_id)))
    const grouped=new Map()
    groupBlocks.filter(b=>String(b.room_type||"").trim().toLowerCase()===type.toLowerCase()&&groupBlockOverlapsDay(b,day)).forEach(b=>grouped.set(String(b.group_id),(grouped.get(String(b.group_id))||0)+Math.max(0,Number(b.quantity||0))))
    let groupHold=0
    grouped.forEach((qty,groupId)=>{const assigned=new Set(reservations.filter(r=>reservationOverlapsDay(r,day)&&String(r.group_id||"")===groupId&&ids.has(String(r.habitacion_id))).map(r=>String(r.habitacion_id)));groupHold+=Math.max(0,qty-assigned.size)})
    const total=typeRooms.length,physical=unavailable.size,free=Math.max(0,total-physical-groupHold),used=Math.min(total,physical+groupHold)
    return{total,free,physical,groupHold,used,percent:total?Math.round(used/total*100):0}
  }

  const totalToday=types.reduce((acc,type)=>{const s=statFor(type,today);acc.total+=s.total;acc.free+=s.free;acc.groupHold+=s.groupHold;return acc},{total:0,free:0,groupHold:0})
  if(!rooms.length)return null
  return <section className={rack.wrap}>
    <header className={rack.head}><div><small>RACK DE DISPONIBILIDAD REAL</small><b>{totalToday.free} libres de {totalToday.total} hoy{totalToday.groupHold?` · ${totalToday.groupHold} retenidas por grupos`:""}</b><span>Descuenta reservas, bloqueos operativos y cupos grupales todavía no asignados.</span></div><button onClick={()=>setOpen(v=>!v)}>{open?"Ocultar rack":"Mostrar rack"}</button></header>
    {open&&<div className={rack.table}><div className={rack.corner}><b>Tipología</b><small>7 días</small></div>{days.map(day=><div className={rack.dayHead} key={day}><b>{dayLabel(day)}</b><small>{day===today?"HOY":""}</small></div>)}{types.map(type=><div className={rack.row} key={type}><div className={rack.typeCell}><b>{type}</b><small>{rooms.filter(r=>roomType(r)===type).length} habitaciones</small></div>{days.map(day=>{const s=statFor(type,day),tone=s.free===0?"sold":s.free<=Math.max(1,Math.ceil(s.total*.25))?"low":s.groupHold?"group":"ok";return <div className={rack.cell} data-tone={tone} key={`${type}-${day}`} title={`${s.free} libres · ${s.physical} ocupadas/bloqueadas · ${s.groupHold} retenidas por grupos`}><strong>{s.free}</strong><span>libres</span>{s.groupHold>0&&<em>{s.groupHold} grupo</em>}</div>})}</div>)}</div>}
  </section>
}
