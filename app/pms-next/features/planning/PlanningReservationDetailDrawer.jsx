"use client"

import s from"./planning.module.css"
import l from"./planningLifecycle.module.css"
import{planningStage,planningStageLabel}from"./planningLifecycle"
import{reservationRoomingSummary}from"./RoomingEditor"

const DAY=86400000
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const diffDays=(a,b)=>Math.round((fromKey(b)-fromKey(a))/DAY)
const longDate=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(fromKey(value)).replace(".","")
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const uniqueIds=values=>[...new Set((values||[]).filter(Boolean).map(value=>String(value)))]

function regimenLabel(selected){
  const roomValue=String(selected?._room_detail?.rate_plan_regimen||selected?._room_detail?.rate_plan_name||"").trim()
  if(roomValue)return roomValue
  const direct=String(selected?.regimen||"").trim()
  if(direct)return direct
  const values=[...new Set((Array.isArray(selected?.habitaciones_detalle)?selected.habitaciones_detalle:[]).map(detail=>String(detail?.rate_plan_regimen||detail?.rate_plan_name||"").trim()).filter(Boolean))]
  return values.length===1?values[0]:values.length>1?"Mixto":"Alojamiento"
}

export default function PlanningReservationDetailDrawer({selected,room,rooms=[],onClose,onOpen}){
  if(!selected)return null
  const assigned=rooms.length?rooms:[room].filter(Boolean),selectedIds=uniqueIds([selected.habitacion_id,...(selected.habitaciones_ids||[])]),roomLabel=assigned.length>1?`${assigned.length} habitaciones · ${assigned.map(item=>item.nombre).join(", ")}`:selectedIds.length>1?`${selectedIds.length} habitaciones asignadas`:`Habitación ${assigned[0]?.nombre||"—"}`,stage=planningStage(selected),regimen=regimenLabel(selected)
  return <aside className={s.detailDrawer}><header><div><small>{selected.canal_reserva||"Walk-in"} · {selected.numero_reserva||selected.id}</small><h2>{selected.nombre_huesped}</h2><p>{roomLabel}</p></div><button className={s.close} onClick={onClose}>×</button></header><div className={s.detailGrid}><div><small>Llegada</small><b>{longDate(selected.fecha_entrada)}</b></div><div><small>Salida</small><b>{longDate(selected.fecha_salida)}</b></div><div><small>Noches</small><b>{Math.max(1,diffDays(selected.fecha_entrada,selected.fecha_salida))}</b></div><div><small>Estado en Planning</small><b><span className={`${l.stagePill} ${l[stage]}`}>{planningStageLabel(selected)}</span></b></div><div><small>Huéspedes</small><b>{selected._room_segment?Math.max(0,Number(selected._room_detail?.huespedes)||0):Math.max(1,Number(selected.cantidad_huespedes)||1)}</b></div><div><small>Régimen</small><b>{regimen}</b></div><div><small>Rooming</small><b>{reservationRoomingSummary(selected,assigned)}</b></div><div><small>Total</small><b>{money(selected.precio_total,selected.moneda)}</b></div></div>{selected.telefono_huesped||selected.email_huesped?<div className={s.contactBlock}>{selected.telefono_huesped?<p><small>Teléfono</small><b>{selected.telefono_huesped}</b></p>:null}{selected.email_huesped?<p><small>Email</small><b>{selected.email_huesped}</b></p>:null}</div>:null}{selected.notas?<div className={s.noteBlock}><small>Notas</small><p>{selected.notas}</p></div>:null}<footer><button onClick={onClose}>Cerrar</button><button className={s.primary} onClick={onOpen}>Abrir reserva</button></footer></aside>
}
