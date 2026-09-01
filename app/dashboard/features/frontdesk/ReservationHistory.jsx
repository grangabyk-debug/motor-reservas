"use client"

import{useEffect,useMemo,useState}from"react"
import{money,shortDate}from"../../core/formatters"
import{loadReservationHistory}from"../../services/reservationHistory"
import s from"./reservation-history.module.css"

const ICON={created:"＋",status:"✓",room:"⌂",stay:"↔",account:"$",guest:"◎",articles:"＋",payment_added:"$",payment_removed:"−",payment_changed:"$"}
const isoToday=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const dayKey=value=>String(value||"").slice(0,10)
function dayLabel(value){const key=dayKey(value),today=isoToday(),y=new Date();y.setDate(y.getDate()-1);const yesterday=`${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,"0")}-${String(y.getDate()).padStart(2,"0")}`;if(key===today)return"HOY";if(key===yesterday)return"AYER";return new Date(`${key}T12:00:00`).toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"}).toUpperCase()}
function hour(value){return new Date(value).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}
function stayStatus(row){if(row.no_show)return"NO SHOW";if(row.estado==="cancelada")return"CANCELADA";if(row.estado==="finalizada")return"OUT";if(row.estado==="alojado")return"IN";return"RESERVA"}

export default function ReservationHistory({propertyId,reservationId,guestProfileId,guestIdentity,rooms=[],compact=false}){
  const[data,setData]=useState({events:[],stays:[],payments:[]}),[loading,setLoading]=useState(false),[message,setMessage]=useState("")
  useEffect(()=>{let active=true;if(!reservationId)return;setLoading(true);setMessage("");loadReservationHistory({propertyId,reservationId,guestProfileId,guestIdentity}).then(next=>active&&setData(next)).catch(error=>active&&setMessage(error.message||"No se pudo cargar el historial.")).finally(()=>active&&setLoading(false));return()=>{active=false}},[propertyId,reservationId,guestProfileId,guestIdentity?.document,guestIdentity?.email,guestIdentity?.phone])
  const roomMap=useMemo(()=>new Map(rooms.map(room=>[String(room.id),room.nombre||`Hab. ${room.id}`])),[rooms])
  const paymentMap=useMemo(()=>{const map=new Map();for(const payment of data.payments||[])map.set(String(payment.reserva_id),(map.get(String(payment.reserva_id))||0)+Number(payment.monto||0));return map},[data.payments])
  const stays=useMemo(()=>(data.stays||[]).filter(row=>String(row.id)!==String(reservationId)),[data.stays,reservationId])
  const activeStays=useMemo(()=>stays.filter(row=>row.estado!=="cancelada"&&!row.no_show),[stays])
  const stats=useMemo(()=>({count:activeStays.length,nights:activeStays.reduce((sum,row)=>sum+Number(row.noches||0),0),total:activeStays.reduce((sum,row)=>sum+Number(row.precio_total||0),0),paid:activeStays.reduce((sum,row)=>sum+(paymentMap.get(String(row.id))||0),0)}),[activeStays,paymentMap])
  const grouped=useMemo(()=>{const groups=[];for(const event of data.events||[]){const key=dayKey(event.created_at);let group=groups.find(item=>item.key===key);if(!group){group={key,label:dayLabel(event.created_at),items:[]};groups.push(group)}group.items.push(event)}return groups},[data.events])

  if(compact)return <article className={s.preview}><div className={s.previewHead}><span><small>HISTORIAL</small><b>{loading?"Cargando…":data.events?.[0]?.title||"Sin movimientos todavía"}</b></span><em>{stays.length?`${stays.length} estadía${stays.length===1?"":"s"} previa${stays.length===1?"":"s"}`:"Primera estadía"}</em></div>{data.events?.[0]&&<p>{data.events[0].detail||data.events[0].actor_name||"Cambio registrado"} · {hour(data.events[0].created_at)}</p>}</article>

  return <section className={s.workspace}>
    <div className={s.hero}><div><small>HISTORIA VIVA</small><h3>Cada cambio deja rastro.</h3><p>Check-in, pagos, habitación, fechas, artículos y estado quedan registrados con usuario y hora.</p></div>{stays.length>0&&<span className={s.repeat}>Huésped recurrente · {stays.length} previa{stays.length===1?"":"s"}</span>}</div>
    {message&&<div className={s.message}>{message}</div>}
    <div className={s.grid}>
      <article className={s.timelineCard}><header><div><small>HISTORIAL DE LA RESERVA</small><h4>Actividad</h4></div><span>{data.events.length} eventos</span></header><div className={s.timeline}>{loading&&<div className={s.empty}>Cargando actividad…</div>}{!loading&&!grouped.length&&<div className={s.empty}>Los próximos cambios de esta reserva van a aparecer acá.</div>}{grouped.map(group=><div className={s.day} key={group.key}><b className={s.dayLabel}>{group.label}</b>{group.items.map(event=><div className={s.event} key={event.id}><span className={s.icon}>{ICON[event.event_type]||"•"}</span><div><b>{event.title}</b>{event.detail&&<p>{event.detail}</p>}<small>{hour(event.created_at)} · {event.actor_name||"Sistema"}</small></div></div>)}</div>)}</div></article>
      <aside className={s.guestCard}><header><div><small>HISTÓRICO DEL HUÉSPED</small><h4>{stays.length?"Huésped recurrente":"Primera estadía registrada"}</h4></div></header><div className={s.stats}><div><small>Estadías</small><b>{stats.count}</b></div><div><small>Noches</small><b>{stats.nights}</b></div><div><small>Facturado</small><b>{money(stats.total)}</b></div><div><small>Pagado</small><b>{money(stats.paid)}</b></div></div><div className={s.stays}>{stays.slice(0,8).map(row=><div className={s.stay} key={row.id}><span><b>{row.numero_reserva||`Reserva ${row.id}`}</b><small>{shortDate(row.fecha_entrada)} → {shortDate(row.fecha_salida)} · {row.canal_reserva||"Directa"}</small></span><span><b>{roomMap.get(String(row.habitacion_id))||`Hab. ${row.habitacion_id||"—"}`}</b><small>{money(row.precio_total,row.moneda)} · pagado {money(paymentMap.get(String(row.id))||0,row.moneda)}</small></span><em data-status={stayStatus(row)}>{stayStatus(row)}</em></div>)}{!stays.length&&<div className={s.empty}>Cuando el huésped vuelva, vas a ver acá sus estadías anteriores, importes y habitaciones.</div>}</div></aside>
    </div>
  </section>
}
