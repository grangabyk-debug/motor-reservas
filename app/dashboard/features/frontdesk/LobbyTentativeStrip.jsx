"use client"

import{shortDate}from"../../core/formatters"
import{tentativeCountdown}from"../../services/tentatives"
import s from"./lobby-tentatives.module.css"

const byExpiry=(a,b)=>new Date(a.tentative_expires_at||"9999-12-31").getTime()-new Date(b.tentative_expires_at||"9999-12-31").getTime()

export default function LobbyTentativeStrip({reservations=[],rooms=[],onOpen}){
  const tentative=reservations.filter(r=>String(r.estado||"").toLowerCase()==="tentativa"&&r.tentative_expires_at).sort(byExpiry),roomMap=new Map(rooms.map(r=>[String(r.id),r])),urgent=tentative.filter(r=>new Date(r.tentative_expires_at).getTime()-Date.now()<=6*3600000)
  if(!tentative.length)return null
  return <section className={s.root}>
    <header><div><small>SEGUIMIENTO COMERCIAL</small><b>{tentative.length} {tentative.length===1?"reserva tentativa":"reservas tentativas"}</b><span>{urgent.length?`${urgent.length} vencen dentro de 6 horas`:"Inventario retenido sin contar como producción confirmada"}</span></div><i>{urgent.length?"ATENCIÓN":"TENTATIVAS"}</i></header>
    <div className={s.list}>{tentative.slice(0,4).map(r=>{const room=roomMap.get(String(r.habitacion_id)),left=tentativeCountdown(r.tentative_expires_at);return <button key={r.id} type="button" onClick={()=>onOpen?.(r)}><span><b>{r.nombre_huesped||"Huésped sin nombre"}</b><small>{room?.nombre||"Sin habitación"} · {shortDate(r.fecha_entrada)} → {shortDate(r.fecha_salida)}</small></span><em>vence {left}</em></button>})}{tentative.length>4&&<div className={s.more}>+{tentative.length-4} más pendientes de confirmación</div>}</div>
  </section>
}
