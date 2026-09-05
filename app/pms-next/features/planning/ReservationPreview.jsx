"use client"

import{useLayoutEffect,useRef,useState}from"react"
import c from"./planningCanvas.module.css"
import l from"./planningLifecycle.module.css"
import p from"./planningPayment.module.css"
import{planningStage,planningStageLabel}from"./planningLifecycle"
import{paymentState}from"./planningPayment"

const DAY=86400000
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const diffDays=(a,b)=>Math.max(1,Math.round((fromKey(b)-fromKey(a))/DAY))
const longDate=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(fromKey(value)).replace(".","")
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const roomCount=item=>new Set([item.habitacion_id,...(item.habitaciones_ids||[])].filter(Boolean).map(Number)).size

export default function ReservationPreview({preview}){
  const cardRef=useRef(null)
  const[position,setPosition]=useState({left:12,top:12,ready:false})
  useLayoutEffect(()=>{
    if(!preview?.item||!preview?.rect||!cardRef.current)return
    const rect=preview.rect,card=cardRef.current,gap=9,margin=12
    const width=card.offsetWidth||330,height=card.offsetHeight||280
    const left=Math.max(margin,Math.min(rect.left,window.innerWidth-width-margin))
    const below=rect.bottom+gap
    const above=rect.top-height-gap
    let top=below
    if(below+height>window.innerHeight-margin)top=above
    top=Math.max(margin,Math.min(top,window.innerHeight-height-margin))
    setPosition({left,top,ready:true})
  },[preview])
  if(!preview?.item)return null
  const{item}=preview,nights=diffDays(item.fecha_entrada,item.fecha_salida),rooms=roomCount(item),stage=planningStage(item),stageLabel=planningStageLabel(item),payment=paymentState(item),currency=item.moneda||"ARS"
  return <aside ref={cardRef} className={c.reservationPreview} style={{left:position.left,top:position.top,visibility:position.ready?"visible":"hidden"}} aria-hidden="true">
    <div className={c.previewTop}><div><small>{item.canal_reserva||"Directa"}</small><b>{item.nombre_huesped}</b></div><span className={`${l.stagePill} ${l[stage]}`}>{stageLabel}</span></div>
    <div className={c.previewMeta}>{item.numero_reserva?<p><small>Reserva</small><b>{item.numero_reserva}</b></p>:null}{rooms>1?<p><small>Habitaciones</small><b>{rooms}</b></p>:null}{item.telefono_huesped?<p><small>Teléfono</small><b>{item.telefono_huesped}</b></p>:null}</div>
    <div className={c.previewDates}><div><small>Llegada</small><b>{longDate(item.fecha_entrada)}</b></div><div><small>Salida</small><b>{longDate(item.fecha_salida)}</b></div><div><small>Noches</small><b>{nights}</b></div></div>
    <div className={c.previewTotal}><small>Total</small><b>{money(item.precio_total,currency)}</b></div>
    <div className={p.paymentSummary}><div><small>Pago · {payment.label}</small><b>{money(payment.paid,currency)} de {money(payment.total,currency)} · {payment.pct}%</b></div>{payment.total>0?<progress max="100" value={payment.pct}/>:null}{payment.foreign>0?<small className={p.paymentWarning}>Hay {payment.foreign} pago{payment.foreign===1?"":"s"} confirmado{payment.foreign===1?"":"s"} en otra moneda · revisar cuenta.</small>:null}</div>
    {item.notas?<p className={c.previewNote}><small>Notas</small>{item.notas}</p>:null}
  </aside>
}
