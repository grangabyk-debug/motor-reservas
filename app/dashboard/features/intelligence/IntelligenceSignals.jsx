"use client"

import{isoDate,money}from"../../core/formatters"
import s from"./intelligence-signals.module.css"

const DAY=86400000
const asDate=v=>new Date(`${v}T12:00:00Z`)
const shift=(v,n)=>{const d=asDate(v);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const short=v=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(asDate(v))
const isOta=name=>/booking|expedia|airbnb|despegar|agoda|hotelbeds/i.test(String(name||""))
const active=r=>String(r.estado||"").toLowerCase()!=="cancelada"&&!r.no_show&&!r.merged_into_id
const overlap=(r,a,b)=>String(r.fecha_entrada||"")<b&&String(r.fecha_salida||"")>a
const paymentInvalid=p=>["anulado","cancelado","reembolsado","void","failed"].includes(String(p.estado||"").toLowerCase())

export default function IntelligenceSignals({reservations=[],payments=[],snapshots=[],currency="ARS"}){
  const today=isoDate(),end=shift(today,30),nowRows=snapshots.filter(r=>r.captured_on===today&&r.stay_date>=today&&r.stay_date<end&&String(r.currency||"ARS").toUpperCase()===currency),pastMap=new Map(snapshots.filter(r=>r.captured_on===shift(today,-7)&&r.stay_date>=today&&r.stay_date<end&&String(r.currency||"ARS").toUpperCase()===currency).map(r=>[r.stay_date,r])),signals=[]
  nowRows.forEach(row=>{const occ=Number(row.occupancy_on_books||0),past=Number(pastMap.get(row.stay_date)?.occupancy_on_books||0),delta=occ-past;if(occ>=90&&delta>=3)signals.push({tone:"opportunity",title:`${short(row.stay_date)} está en ${Math.round(occ)}%`,detail:`Subió ${delta.toFixed(0)} pp en 7 días. Quedan pocas unidades: conviene revisar tarifa y restricciones.`,kind:"Revenue"});else if(occ<=35&&delta<=1&&row.stay_date>=shift(today,3))signals.push({tone:"warning",title:`${short(row.stay_date)} sigue en ${Math.round(occ)}%`,detail:`El pickup de 7 días es ${delta>=0?"+":""}${delta.toFixed(0)} pp. Revisá precio, mínimos, canales o promoción directa.`,kind:"Demanda"})})
  const periodReservations=reservations.filter(r=>overlap(r,today,end)&&String(r.moneda||"ARS").toUpperCase()===currency),valid=periodReservations.filter(active),totalGross=valid.reduce((a,r)=>a+Number(r.precio_total||0),0),otaGross=valid.filter(r=>isOta(r.canal_reserva)).reduce((a,r)=>a+Number(r.precio_total||0),0),otaShare=totalGross?otaGross/totalGross*100:0
  if(otaShare>=55)signals.push({tone:"warning",title:`${otaShare.toFixed(0)}% del valor futuro viene de OTA`,detail:"La dependencia es alta. Compará costo de adquisición y buscá mover repetidores o demanda propia al canal directo.",kind:"Distribución"})
  const channelStats=new Map();periodReservations.forEach(r=>{const name=String(r.canal_reserva||"Directa"),v=channelStats.get(name)||{all:0,cancelled:0};v.all+=1;if(!active(r))v.cancelled+=1;channelStats.set(name,v)});[...channelStats.entries()].forEach(([name,v])=>{const rate=v.all?v.cancelled/v.all*100:0;if(v.all>=3&&rate>=25)signals.push({tone:"warning",title:`Cancelación alta en ${name}: ${rate.toFixed(0)}%`,detail:`${v.cancelled} de ${v.all} reservas del próximo mes están canceladas/no-show. Revisá política y calidad de ese canal.`,kind:"Cancelaciones"})})
  const validPayments=payments.filter(p=>String(p.moneda||p.payment_currency||"ARS").toUpperCase()===currency&&!paymentInvalid(p)),paidByReservation=new Map();validPayments.forEach(p=>{const id=String(p.reserva_id||"");paidByReservation.set(id,(paidByReservation.get(id)||0)+Math.max(0,Number(p.monto??p.payment_amount??0)-Number(p.refunded_amount||0)))});const pending=valid.reduce((sum,r)=>sum+Math.max(0,Number(r.precio_total||0)-Number(paidByReservation.get(String(r.id))||0)),0)
  if(pending>0&&totalGross&&pending/totalGross>=.35)signals.push({tone:"info",title:`${money(pending,currency)} pendientes en próximas estadías`,detail:`Representa ${Math.round(pending/totalGross*100)}% del valor reservado para los próximos 30 días. Conviene revisar garantías y anticipos.`,kind:"Cobranza"})
  const ordered=signals.sort((a,b)=>({opportunity:0,warning:1,info:2}[a.tone]-{opportunity:0,warning:1,info:2}[b.tone])).slice(0,8)
  return <section className={s.card}><header><div><small>SEÑALES</small><h2>Qué merece atención ahora</h2><p>Reglas explicables sobre datos reales; cada alerta muestra por qué aparece.</p></div><span>{ordered.length} señal{ordered.length===1?"":"es"}</span></header><div className={s.grid}>{ordered.map((item,index)=><article key={`${item.kind}-${index}`} data-tone={item.tone}><span>{item.kind}</span><h3>{item.title}</h3><p>{item.detail}</p></article>)}{!ordered.length&&<div className={s.clean}><b>Sin alertas relevantes</b><span>No se detectaron desvíos importantes en los próximos 30 días con las reglas actuales.</span></div>}</div><footer>Estas señales no cambian tarifas ni reservas automáticamente. Son recomendaciones para que el hotelero decida con contexto.</footer></section>
}
