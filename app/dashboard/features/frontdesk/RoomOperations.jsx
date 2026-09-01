"use client"

import{useMemo,useState}from"react"
import{money,shortDate}from"../../core/formatters"
import{changeReservationRoom,swapReservations}from"../../services/reservations"
import ops from"./room-operations.module.css"

const active=r=>r&&r.estado!=="cancelada"&&!r.no_show
const roomLabel=(room,current)=>`${room.nombre} · ${room.tipo||"Habitación"}${room.precio!=null?` · ${money(room.precio,current?.moneda||"ARS")}`:""}`

export default function RoomOperations({reservation,rooms=[],reservations=[]}){
  const[open,setOpen]=useState(false),[targetRoom,setTargetRoom]=useState(""),[swapId,setSwapId]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("")
  const currentRoom=rooms.find(r=>String(r.id)===String(reservation?.habitacion_id))
  const targetRooms=useMemo(()=>rooms.filter(r=>r.activa!==false&&String(r.id)!==String(reservation?.habitacion_id)&&!["mantenimiento","fuera_servicio"].includes(String(r.estado||"").toLowerCase())).sort((a,b)=>String(a.nombre||"").localeCompare(String(b.nombre||""),"es")),[rooms,reservation?.habitacion_id])
  const swapCandidates=useMemo(()=>reservations.filter(r=>active(r)&&String(r.id)!==String(reservation?.id)&&r.habitacion_id&&String(r.habitacion_id)!==String(reservation?.habitacion_id)).sort((a,b)=>String(a.fecha_entrada||"").localeCompare(String(b.fecha_entrada||""))).slice(0,40),[reservations,reservation?.id,reservation?.habitacion_id])
  if(!reservation)return null

  async function relocate(reprice){if(!targetRoom)return setMessage("Elegí la habitación destino.");setBusy(true);setMessage("");try{await changeReservationRoom({reservationId:reservation.id,roomId:targetRoom,reprice});const room=rooms.find(r=>String(r.id)===String(targetRoom));setMessage(reprice?`Cambio realizado. La tarifa base pasó a la de ${room?.nombre||"la habitación destino"}.`:`Reserva reubicada en ${room?.nombre||"la habitación destino"} conservando la tarifa.`);setTargetRoom("")}catch(e){setMessage(e.message||"No se pudo cambiar la habitación.")}finally{setBusy(false)}}
  async function swap(){if(!swapId)return setMessage("Elegí la otra reserva.");setBusy(true);setMessage("");try{const other=reservations.find(r=>String(r.id)===String(swapId));await swapReservations({reservationId:reservation.id,otherReservationId:swapId});setMessage(`Habitaciones intercambiadas con ${other?.nombre_huesped||"la otra reserva"}. Las tarifas se conservaron.`);setSwapId("")}catch(e){setMessage(e.message||"No se pudo intercambiar las habitaciones.")}finally{setBusy(false)}}

  return <div className={ops.root}><button type="button" className={ops.trigger} onClick={()=>setOpen(v=>!v)}>Mover / swap</button>{open&&<div className={ops.popover}>
    <header><div><small>OPERACIONES DE HABITACIÓN</small><b>{reservation.nombre_huesped}</b><span>{currentRoom?.nombre||"Sin habitación"} · {shortDate(reservation.fecha_entrada)} → {shortDate(reservation.fecha_salida)}</span></div><button type="button" onClick={()=>setOpen(false)}>×</button></header>
    <section><label><span>Reubicar / upgrade / downgrade</span><select value={targetRoom} onChange={e=>setTargetRoom(e.target.value)}><option value="">Elegir habitación destino…</option>{targetRooms.map(room=><option value={room.id} key={room.id}>{roomLabel(room,reservation)}</option>)}</select></label><div className={ops.actions}><button type="button" disabled={busy||!targetRoom} onClick={()=>relocate(false)}>Mover y conservar tarifa</button><button type="button" disabled={busy||!targetRoom} className={ops.primary} onClick={()=>relocate(true)}>Mover + aplicar tarifa base</button></div><p>La primera opción sirve para reubicaciones operativas. La segunda aplica la tarifa base actual de la nueva habitación.</p></section>
    <section><label><span>Intercambiar dos reservas</span><select value={swapId} onChange={e=>setSwapId(e.target.value)}><option value="">Elegir otra reserva…</option>{swapCandidates.map(r=>{const room=rooms.find(x=>String(x.id)===String(r.habitacion_id));return <option key={r.id} value={r.id}>{r.nombre_huesped} · {room?.nombre||`Hab. ${r.habitacion_id}`} · {shortDate(r.fecha_entrada)}→{shortDate(r.fecha_salida)}</option>})}</select></label><button type="button" disabled={busy||!swapId} onClick={swap}>Intercambiar habitaciones</button><p>El intercambio es atómico: si cualquiera de las dos habitaciones tiene otro huésped o un bloqueo en las fechas necesarias, no se modifica nada.</p></section>
    {message&&<div className={ops.message}>{message}</div>}
  </div>}</div>
}
