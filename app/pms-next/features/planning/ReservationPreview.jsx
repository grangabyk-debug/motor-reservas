"use client"

import c from"./planningCanvas.module.css"
import l from"./planningLifecycle.module.css"
import{planningStage,planningStageLabel}from"./planningLifecycle"

const DAY=86400000
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const diffDays=(a,b)=>Math.max(1,Math.round((fromKey(b)-fromKey(a))/DAY))
const longDate=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(fromKey(value)).replace(".","")
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const roomCount=item=>new Set([item.habitacion_id,...(item.habitaciones_ids||[])].filter(Boolean).map(Number)).size

export default function ReservationPreview({preview}){
  if(!preview?.item)return null
  const{item,x,y}=preview,nights=diffDays(item.fecha_entrada,item.fecha_salida),rooms=roomCount(item),stage=planningStage(item),stageLabel=planningStageLabel(item)
  return <aside className={c.reservationPreview} style={{left:x,top:y}} aria-hidden="true">
    <div className={c.previewTop}><div><small>{item.canal_reserva||"Directa"}</small><b>{item.nombre_huesped}</b></div><span className={`${l.stagePill} ${l[stage]}`}>{stageLabel}</span></div>
    <div className={c.previewMeta}>{item.numero_reserva?<p><small>Reserva</small><b>{item.numero_reserva}</b></p>:null}{rooms>1?<p><small>Habitaciones</small><b>{rooms}</b></p>:null}{item.telefono_huesped?<p><small>Teléfono</small><b>{item.telefono_huesped}</b></p>:null}</div>
    <div className={c.previewDates}><div><small>Llegada</small><b>{longDate(item.fecha_entrada)}</b></div><div><small>Salida</small><b>{longDate(item.fecha_salida)}</b></div><div><small>Noches</small><b>{nights}</b></div></div>
    <div className={c.previewTotal}><small>Total</small><b>{money(item.precio_total,item.moneda)}</b></div>
    {item.notas?<p className={c.previewNote}><small>Notas</small>{item.notas}</p>:null}
  </aside>
}
