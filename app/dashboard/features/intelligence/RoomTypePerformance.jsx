"use client"

import{money}from"../../core/formatters"
import s from"./room-type-performance.module.css"

const DAY=86400000
const asDate=v=>new Date(`${v}T12:00:00Z`)
const shift=(v,n)=>{const d=asDate(v);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const diff=(a,b)=>Math.max(0,Math.round((asDate(b)-asDate(a))/DAY))
const activeRoom=r=>r?.activa!==false&&!['fuera_de_servicio','out_of_service'].includes(String(r?.estado||'').toLowerCase())
const validReservation=r=>String(r.estado||'').toLowerCase()!=='cancelada'&&!r.no_show&&!r.merged_into_id
const safeArray=v=>{if(Array.isArray(v))return v;try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
const idsOf=r=>[...new Set([r.habitacion_id,...(Array.isArray(r.habitaciones_ids)?r.habitaciones_ids:[])].map(String).filter(Boolean))]

export default function RoomTypePerformance({rooms=[],reservations=[],blocks=[],start,end,currency='ARS'}){
  const active=rooms.filter(activeRoom),roomMap=new Map(active.map(r=>[String(r.id),r])),types=new Map()
  for(const room of active){const type=String(room.tipo||room.type||'Sin categoría');if(!types.has(type))types.set(type,{type,rooms:0,capacity:0,sold:0,revenue:0,reservations:new Set()});types.get(type).rooms+=1}
  for(let day=start;day<end;day=shift(day,1)){const blocked=new Set(blocks.filter(b=>String(b.fecha_desde||'')<=day&&String(b.fecha_hasta||'')>day).map(b=>String(b.habitacion_id)));for(const room of active){if(blocked.has(String(room.id)))continue;const type=String(room.tipo||room.type||'Sin categoría');types.get(type).capacity+=1}}
  reservations.filter(r=>validReservation(r)&&String(r.moneda||'ARS').toUpperCase()===currency&&String(r.fecha_entrada||'')<end&&String(r.fecha_salida||'')>start).forEach(r=>{const ids=idsOf(r).filter(id=>roomMap.has(id));if(!ids.length)return;const details=safeArray(r.habitaciones_detalle),detailMap=new Map(details.map(item=>[String(item?.habitacion_id||item?.roomId||''),Number(item?.tarifa_noche??item?.rate??0)])),from=r.fecha_entrada>start?r.fecha_entrada:start,to=r.fecha_salida<end?r.fecha_salida:end,nights=Math.max(0,diff(from,to)),fullNights=Math.max(1,diff(r.fecha_entrada,r.fecha_salida)),fallbackPerRoom=Number(r.precio_total||0)/fullNights/Math.max(1,ids.length);for(const id of ids){const room=roomMap.get(id),type=String(room.tipo||room.type||'Sin categoría'),row=types.get(type),rate=Number(detailMap.get(id)||(String(r.habitacion_id)===id?Number(r.tarifa_noche||0):0)||fallbackPerRoom);row.sold+=nights;row.revenue+=rate*nights;row.reservations.add(String(r.id))}})
  const rows=[...types.values()].map(row=>({...row,occupancy:row.capacity?Math.min(100,row.sold/row.capacity*100):0,adr:row.sold?row.revenue/row.sold:0,revpar:row.capacity?row.revenue/row.capacity:0})).sort((a,b)=>b.revenue-a.revenue),totalRevenue=rows.reduce((a,r)=>a+r.revenue,0)
  return <section className={s.card}><header><div><small>TIPOS DE HABITACIÓN</small><h2>Qué categoría rinde mejor</h2><p>Capacidad real, noches vendidas, ADR y RevPAR por categoría.</p></div><span>{rows.length} categoría{rows.length===1?'':'s'}</span></header><div className={s.grid}>{rows.map(row=>{const share=totalRevenue?row.revenue/totalRevenue*100:0;return <article key={row.type}><header><div><b>{row.type}</b><small>{row.rooms} hab. físicas · {row.reservations.size} reservas</small></div><strong>{row.occupancy.toFixed(0)}%</strong></header><div className={s.track}><i style={{width:`${row.occupancy}%`}}/></div><div className={s.metrics}><span><small>Noches</small><b>{row.sold}/{row.capacity}</b></span><span><small>ADR</small><b>{money(row.adr,currency)}</b></span><span><small>RevPAR</small><b>{money(row.revpar,currency)}</b></span><span><small>Producción</small><b>{money(row.revenue,currency)}</b></span></div><footer><span>Participación</span><b>{share.toFixed(1)}%</b></footer></article>})}{!rows.length&&<p className={s.empty}>No hay categorías disponibles para analizar.</p>}</div></section>
}
