"use client"

import{money}from"../../core/formatters"
import s from"./channel-performance.module.css"

const DAY=86400000
const asDate=value=>new Date(`${String(value).slice(0,10)}T12:00:00Z`)
const diff=(a,b)=>Math.max(0,Math.round((asDate(b)-asDate(a))/DAY))
const overlap=(r,start,end)=>String(r.fecha_entrada||"")<end&&String(r.fecha_salida||"")>start
const status=r=>String(r.estado||"").toLowerCase()
const isCancelled=r=>status(r)==="cancelada"||Boolean(r.no_show)
const safeArray=value=>{if(Array.isArray(value))return value;try{const parsed=JSON.parse(value||"[]");return Array.isArray(parsed)?parsed:[]}catch{return[]}}
const roomIds=r=>[...new Set([r.habitacion_id,...(Array.isArray(r.habitaciones_ids)?r.habitaciones_ids:[])].map(String).filter(Boolean))]
const channelName=r=>String(r.canal_reserva||"Directa").trim()||"Directa"
const channelType=name=>/booking|expedia|airbnb|despegar|agoda|hotelbeds/i.test(name)?"OTA":/agencia|agency|operador|tour/i.test(name)?"Agencia":"Directo"
function nightlyRoomRevenue(r){const details=safeArray(r.habitaciones_detalle),rates=details.map(x=>Number(x?.tarifa_noche??x?.rate??0)).filter(x=>x>0);if(rates.length)return rates.reduce((a,b)=>a+b,0);const count=Math.max(1,roomIds(r).length),rate=Number(r.tarifa_noche||0);if(rate>0)return rate*count;return Number(r.precio_total||0)/Math.max(1,diff(r.fecha_entrada,r.fecha_salida))}

export default function ChannelPerformance({reservations=[],start,end,currency="ARS"}){
  const rowsMap=new Map(),eligible=reservations.filter(r=>overlap(r,start,end)&&String(r.moneda||"ARS").toUpperCase()===currency&& !r.merged_into_id)
  eligible.forEach(r=>{
    const name=channelName(r),row=rowsMap.get(name)||{name,type:channelType(name),reservations:0,cancellations:0,roomNights:0,revenue:0,leadTotal:0,leadCount:0}
    if(isCancelled(r)){row.cancellations+=1;rowsMap.set(name,row);return}
    const from=r.fecha_entrada>start?r.fecha_entrada:start,to=r.fecha_salida<end?r.fecha_salida:end,nights=Math.max(0,diff(from,to)),rooms=Math.max(1,roomIds(r).length)
    row.reservations+=1;row.roomNights+=nights*rooms;row.revenue+=nights*nightlyRoomRevenue(r)
    const created=String(r.created_at||"").slice(0,10);if(created&&r.fecha_entrada){row.leadTotal+=Math.max(0,diff(created,r.fecha_entrada));row.leadCount+=1}
    rowsMap.set(name,row)
  })
  const rows=[...rowsMap.values()].map(row=>({...row,adr:row.roomNights?row.revenue/row.roomNights:0,lead:row.leadCount?row.leadTotal/row.leadCount:0,cancelRate:(row.reservations+row.cancellations)?row.cancellations/(row.reservations+row.cancellations)*100:0})).sort((a,b)=>b.revenue-a.revenue)
  const totalRevenue=rows.reduce((a,r)=>a+r.revenue,0),totalNights=rows.reduce((a,r)=>a+r.roomNights,0),directRevenue=rows.filter(r=>r.type==="Directo").reduce((a,r)=>a+r.revenue,0),otaRevenue=rows.filter(r=>r.type==="OTA").reduce((a,r)=>a+r.revenue,0)
  return <section className={s.card}>
    <header><div><small>DISTRIBUCIÓN</small><h2>Rendimiento por canal</h2><p>Producción real, ADR, cancelación y anticipación de compra. Sin mezclar monedas.</p></div><div className={s.summary}><span><b>{totalNights}</b><small>noches</small></span><span><b>{totalRevenue?Math.round(directRevenue/totalRevenue*100):0}%</b><small>venta directa</small></span><span><b>{totalRevenue?Math.round(otaRevenue/totalRevenue*100):0}%</b><small>OTA</small></span></div></header>
    <div className={s.tableWrap}><table><thead><tr><th>Canal</th><th>Tipo</th><th className={s.num}>Reservas</th><th className={s.num}>Noches</th><th className={s.num}>Producción</th><th className={s.num}>ADR</th><th className={s.num}>Cancelación</th><th className={s.num}>Lead time</th><th>Participación</th></tr></thead><tbody>{rows.map(row=>{const share=totalRevenue?row.revenue/totalRevenue*100:0;return <tr key={row.name}><td><b>{row.name}</b></td><td><span className={s.type} data-type={row.type}>{row.type}</span></td><td className={s.num}>{row.reservations}</td><td className={s.num}>{row.roomNights}</td><td className={s.num}><b>{money(row.revenue,currency)}</b></td><td className={s.num}>{money(row.adr,currency)}</td><td className={s.num}><span data-alert={row.cancelRate>=20?"high":row.cancelRate>=10?"mid":"low"}>{row.cancelRate.toFixed(1)}%</span></td><td className={s.num}>{row.lead.toFixed(1)} días</td><td><div className={s.share}><i style={{width:`${Math.min(100,share)}%`}}/><span>{share.toFixed(1)}%</span></div></td></tr>})}{!rows.length&&<tr><td colSpan="9" className={s.empty}>No hay reservas de {currency} dentro de este período.</td></tr>}</tbody></table></div>
    <footer><span>“Directo” agrupa el canal tal como fue registrado en cada reserva; la tabla mantiene el nombre original para detectar duplicados como Teléfono/Telefónica o Motor web/Motor directo.</span><b>La comisión neta se incorpora sólo cuando exista un costo configurado por canal.</b></footer>
  </section>
}
