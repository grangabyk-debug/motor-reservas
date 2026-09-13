"use client"

import{money}from"../../core/formatters"
import s from"./financial-performance.module.css"

const DAY=86400000
const asDate=value=>new Date(`${String(value).slice(0,10)}T12:00:00Z`)
const diff=(a,b)=>Math.max(0,Math.round((asDate(b)-asDate(a))/DAY))
const overlap=(r,start,end)=>String(r.fecha_entrada||"")<end&&String(r.fecha_salida||"")>start
const invalidReservation=r=>String(r.estado||"").toLowerCase()==="cancelada"||Boolean(r.no_show)||Boolean(r.merged_into_id)
const invalidPayment=p=>["anulado","cancelado","reembolsado","void","failed"].includes(String(p.estado||"").toLowerCase())
const paymentCurrency=p=>String(p.moneda||p.payment_currency||"ARS").toUpperCase()
const paymentNet=p=>Math.max(0,Number(p.monto??p.payment_amount??0)-Number(p.refunded_amount||0))
const paymentDay=p=>String(p.created_at||"").slice(0,10)
const updatedDay=p=>String(p.updated_at||p.created_at||"").slice(0,10)

export default function FinancialPerformance({reservations=[],payments=[],start,end,currency="ARS"}){
  const stays=reservations.filter(r=>overlap(r,start,end)&&String(r.moneda||"ARS").toUpperCase()===currency&&!invalidReservation(r))
  let production=0
  stays.forEach(r=>{const full=Math.max(1,diff(r.fecha_entrada,r.fecha_salida)),from=r.fecha_entrada>start?r.fecha_entrada:start,to=r.fecha_salida<end?r.fecha_salida:end,part=Math.max(0,diff(from,to));production+=Number(r.precio_total||0)*(part/full)})
  const validPayments=payments.filter(p=>paymentCurrency(p)===currency&&!invalidPayment(p))
  const collectedTransactions=validPayments.filter(p=>{const day=paymentDay(p);return day>=start&&day<end}).reduce((a,p)=>a+paymentNet(p),0)
  const stayIds=new Set(stays.map(r=>String(r.id)))
  const paidAgainstStays=validPayments.filter(p=>stayIds.has(String(p.reserva_id))).reduce((a,p)=>a+paymentNet(p),0)
  const stayTotals=stays.reduce((a,r)=>a+Number(r.precio_total||0),0)
  const pending=Math.max(0,stayTotals-paidAgainstStays)
  const refunds=payments.filter(p=>paymentCurrency(p)===currency&&Number(p.refunded_amount||0)>0&&updatedDay(p)>=start&&updatedDay(p)<end).reduce((a,p)=>a+Number(p.refunded_amount||0),0)
  const methods=[...validPayments.filter(p=>{const day=paymentDay(p);return day>=start&&day<end}).reduce((map,p)=>{const name=String(p.metodo||p.provider||p.source||"Sin especificar");map.set(name,(map.get(name)||0)+paymentNet(p));return map},new Map()).entries()].sort((a,b)=>b[1]-a[1])
  const maxMethod=Math.max(1,...methods.map(([,amount])=>amount))
  const coverage=stayTotals?Math.min(100,paidAgainstStays/stayTotals*100):0
  return <section className={s.card}>
    <header><div><small>FINANZAS</small><h2>Producción, cobros y saldo</h2><p>Distingue lo producido por estadía de los movimientos de dinero realmente registrados.</p></div><span>{coverage.toFixed(0)}% cubierto sobre las reservas del período</span></header>
    <div className={s.metrics}>
      <article><span>Producción del período</span><b>{money(production,currency)}</b><small>Valor proporcional de estadías</small></article>
      <article><span>Cobrado en el período</span><b>{money(collectedTransactions,currency)}</b><small>Pagos registrados por fecha de cobro</small></article>
      <article><span>Cobrado sobre esas estadías</span><b>{money(paidAgainstStays,currency)}</b><small>Incluye anticipos cobrados antes</small></article>
      <article data-alert={pending>0?"warning":"ok"}><span>Saldo pendiente</span><b>{money(pending,currency)}</b><small>Sobre reservas activas del período</small></article>
      <article data-alert={refunds>0?"warning":"ok"}><span>Reintegros</span><b>{money(refunds,currency)}</b><small>Refunds actualizados en el período</small></article>
    </div>
    <div className={s.body}>
      <div className={s.coverage}><div className={s.coverageHead}><span>Cobertura de las estadías</span><b>{coverage.toFixed(1)}%</b></div><div><i style={{width:`${coverage}%`}}/></div><p>{money(paidAgainstStays,currency)} cobrados sobre {money(stayTotals,currency)} comprometidos en las reservas activas que tocan este período.</p></div>
      <div className={s.methods}><header><b>Medios de cobro</b><span>movimientos del período</span></header>{methods.map(([name,amount])=><div key={name}><span>{name}</span><div><i style={{width:`${amount/maxMethod*100}%`}}/></div><b>{money(amount,currency)}</b></div>)}{!methods.length&&<p>Sin cobros registrados en {currency} para este período.</p>}</div>
    </div>
    <footer>“Producción” y “cobrado” no son lo mismo: un anticipo puede cobrarse antes de la estadía y una estadía puede quedar con saldo pendiente. Por eso se muestran separados.</footer>
  </section>
}
