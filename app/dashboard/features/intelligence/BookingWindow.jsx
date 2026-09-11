"use client"

import{money}from"../../core/formatters"
import s from"./booking-window.module.css"

const DAY=86400000
const asDate=value=>new Date(`${String(value).slice(0,10)}T12:00:00Z`)
const diff=(a,b)=>Math.max(0,Math.round((asDate(b)-asDate(a))/DAY))
const valid=r=>String(r.estado||"").toLowerCase()!=="cancelada"&&!r.no_show&&!r.merged_into_id
const bucketFor=days=>days===0?"Mismo día":days<=3?"1–3 días":days<=7?"4–7 días":days<=14?"8–14 días":days<=30?"15–30 días":days<=60?"31–60 días":"61+ días"
const ORDER=["Mismo día","1–3 días","4–7 días","8–14 días","15–30 días","31–60 días","61+ días"]

export default function BookingWindow({reservations=[],start,end,currency="ARS"}){
  const rows=reservations.filter(r=>valid(r)&&String(r.moneda||"ARS").toUpperCase()===currency&&String(r.fecha_entrada||"")>=start&&String(r.fecha_entrada||"")<end&&r.created_at)
  const buckets=new Map(ORDER.map(name=>[name,{name,reservations:0,nights:0,revenue:0,leadTotal:0}]))
  const channels=new Map()
  rows.forEach(r=>{const created=String(r.created_at).slice(0,10),lead=Math.max(0,diff(created,r.fecha_entrada)),nights=Math.max(1,diff(r.fecha_entrada,r.fecha_salida)),revenue=Number(r.precio_total||0),bucket=buckets.get(bucketFor(lead));bucket.reservations+=1;bucket.nights+=nights;bucket.revenue+=revenue;bucket.leadTotal+=lead;const name=String(r.canal_reserva||"Directa");const channel=channels.get(name)||{name,count:0,lead:0,nights:0,revenue:0};channel.count+=1;channel.lead+=lead;channel.nights+=nights;channel.revenue+=revenue;channels.set(name,channel)})
  const data=[...buckets.values()],maxCount=Math.max(1,...data.map(x=>x.reservations)),total=rows.length,avgLead=total?data.reduce((a,x)=>a+x.leadTotal,0)/total:0,totalNights=data.reduce((a,x)=>a+x.nights,0),avgStay=total?totalNights/total:0,channelRows=[...channels.values()].sort((a,b)=>b.count-a.count).slice(0,6)
  return <section className={s.card}><header><div><small>BOOKING WINDOW</small><h2>Cuándo compra el huésped</h2><p>Anticipación entre la creación de la reserva y el check-in, tomando llegadas del período elegido.</p></div><div className={s.headMetrics}><span><b>{avgLead.toFixed(1)}</b><small>días de anticipación</small></span><span><b>{avgStay.toFixed(1)}</b><small>noches por reserva</small></span></div></header><div className={s.body}><div className={s.buckets}>{data.map(row=><div key={row.name}><header><span>{row.name}</span><b>{row.reservations}</b></header><div><i style={{width:`${row.reservations/maxCount*100}%`}}/></div><small>{total?Math.round(row.reservations/total*100):0}% · {money(row.revenue,currency)}</small></div>)}</div><aside><header><b>Anticipación por canal</b><span>Top 6 por reservas</span></header>{channelRows.map(row=><div key={row.name}><span>{row.name}</span><b>{row.count?row.lead/row.count:0 .toFixed?.(1)}{typeof (row.count?row.lead/row.count:0)==="number"?(row.lead/row.count).toFixed(1):"0.0"} días</b><small>{row.count} reservas · {(row.nights/Math.max(1,row.count)).toFixed(1)} noches</small></div>)}{!channelRows.length&&<p>Sin reservas con fecha de creación para este período.</p>}</aside></div><footer>Booking Window ayuda a decidir cuándo lanzar promociones, cuándo subir tarifas y qué canal trae demanda más anticipada.</footer></section>
}
