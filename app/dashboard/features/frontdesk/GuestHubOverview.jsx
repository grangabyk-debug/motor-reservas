"use client"

import{money,shortDate}from"../../core/formatters"
import hub from"./guest-hub.module.css"

const today=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const cleanPhone=value=>String(value||"").replace(/\D/g,"")

function stayMoment(stays=[]){
  const now=today(),current=stays.find(r=>r.fecha_entrada<=now&&r.fecha_salida>now&&r.estado!=="finalizada"),future=stays.filter(r=>r.fecha_entrada>=now).sort((a,b)=>String(a.fecha_entrada).localeCompare(String(b.fecha_entrada))),past=stays.filter(r=>r.fecha_salida<=now||r.estado==="finalizada").sort((a,b)=>String(b.fecha_salida).localeCompare(String(a.fecha_salida)))
  if(current)return{kind:"inhouse",label:"EN CASA",title:`Hasta ${shortDate(current.fecha_salida)}`,reservation:current}
  if(future[0])return{kind:"upcoming",label:"PRÓXIMA ESTADÍA",title:`Llega ${shortDate(future[0].fecha_entrada)}`,reservation:future[0]}
  if(past[0])return{kind:"returning",label:"ÚLTIMA ESTADÍA",title:`Salió ${shortDate(past[0].fecha_salida)}`,reservation:past[0]}
  return{kind:"new",label:"NUEVO HUÉSPED",title:"Sin estadías todavía",reservation:null}
}

export function GuestHubPulse({guests=[],reservations=[]}){
  const valid=reservations.filter(r=>r.estado!=="cancelada"&&!r.no_show),countByGuest=new Map();valid.forEach(r=>{const id=String(r.guest_profile_id||"");if(id)countByGuest.set(id,(countByGuest.get(id)||0)+1)})
  const returning=[...countByGuest.values()].filter(count=>count>1).length,vip=guests.filter(g=>["vip","signature"].includes(g.vip_level)).length,now=today(),limit=new Date(`${now}T12:00:00`);limit.setDate(limit.getDate()+30);const limitIso=limit.toISOString().slice(0,10),upcoming=new Set(valid.filter(r=>r.fecha_entrada>=now&&r.fecha_entrada<=limitIso).map(r=>String(r.guest_profile_id||"")).filter(Boolean)).size
  return <section className={hub.pulse}><div><small>BASE ACTIVA</small><b>{guests.length}</b><span>huéspedes</span></div><div><small>RECURRENTES</small><b>{returning}</b><span>2+ estadías</span></div><div><small>VIP / SIGNATURE</small><b>{vip}</b><span>servicio prioritario</span></div><div><small>PRÓXIMOS 30 DÍAS</small><b>{upcoming}</b><span>perfiles con llegada</span></div></section>
}

export default function GuestHubOverview({guest,stats,roomById}){
  const moment=stayMoment(stats.stays),phone=cleanPhone(guest.phone),pending=Math.max(0,Number(stats.total||0)-Number(stats.paid||0)),avgTicket=stats.stays.length?Number(stats.total||0)/stats.stays.length:0,avgNights=stats.stays.length?Number(stats.nights||0)/stats.stays.length:0,preference=String(guest.preference_text||guest.preferences?.free_text||"").trim(),room=moment.reservation?roomById.get(String(moment.reservation.habitacion_id)):null
  const openStay=()=>moment.reservation?.id&&window.location.assign(`/dashboard?reservation=${encodeURIComponent(moment.reservation.id)}`)
  return <section className={hub.overview}>
    <header><div><small>GUEST HUB · 360°</small><h4>Contexto antes de atender.</h4></div><span className={hub[moment.kind]}>{moment.label}</span></header>
    <div className={hub.cards}>
      <article><small>MOMENTO</small><b>{moment.title}</b><span>{room?.nombre||moment.reservation?.canal_reserva||"Sin contexto de estadía"}</span></article>
      <article><small>RELACIÓN</small><b>{stats.stays.length>1?`${stats.stays.length} estadías`:stats.stays.length===1?"Primera repetición pendiente":"Primer contacto"}</b><span>{stats.nights} noches · prom. {avgNights.toFixed(1)}</span></article>
      <article><small>VALOR HISTÓRICO</small><b>{money(stats.total)}</b><span>Ticket medio {money(avgTicket)}</span></article>
      <article data-alert={pending>0}><small>SALDO REGISTRADO</small><b>{money(pending)}</b><span>{pending>0?"Revisar pagos de sus estadías":"Sin saldo agregado pendiente"}</span></article>
    </div>
    <div className={hub.serviceMemory}><div><small>MEMORIA DE SERVICIO</small><p>{preference||"Todavía no hay una preferencia principal cargada. Recepción puede registrar piso, habitación, horario o detalle de servicio útil para la próxima visita."}</p></div><nav>{phone&&<button type="button" onClick={()=>window.open(`https://wa.me/${phone}`,"_blank","noopener,noreferrer")}>WhatsApp</button>}{guest.email&&<button type="button" onClick={()=>window.location.href=`mailto:${guest.email}`}>Email</button>}{moment.reservation&&<button type="button" className={hub.primary} onClick={openStay}>Abrir estadía</button>}</nav></div>
  </section>
}
