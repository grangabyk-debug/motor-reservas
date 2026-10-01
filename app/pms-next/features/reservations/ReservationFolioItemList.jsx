"use client"

import s from"./reservationFolioBilling.module.css"
import{folioItemBillingState}from"./reservationBillingCoverage"
import{fmtDate,money,typeLabels}from"./reservationFolioFormat"

export default function ReservationFolioItemList({folioItems=[],selectedItems,onToggle,invoiceCoverage,folios=[],saving=false,onMove}){
  if(!folioItems.length)return <div className={s.empty}>Este folio todavía no tiene consumos. Podés mover cargos desde otra habitación o usarlo como folio de empresa/grupo.</div>
  return <div className={s.itemList}>{folioItems.map(row=>{
    const coverage=invoiceCoverage.get(row.id),billing=folioItemBillingState(row,coverage),invoiceable=billing.remaining>.009,movable=!row.billing_segment_key&&billing.covered<=.009&&!row.invoice_document_id
    const title=billing.key==="draft"?`${money(billing.draft,row.currency)} en factura borrador`:billing.key==="partial"?`${money(billing.issued,row.currency)} facturado de ${money(row.total,row.currency)}`:billing.label
    const paid=Math.max(0,Number(row.paid)||0),remaining=Math.max(0,Number(row.remaining??row.total)||0),parts=Array.isArray(row.payment_parts)?row.payment_parts:[]
    return <div className={s.itemRow} key={row.id}>
      <label className={s.check}><input type="checkbox" checked={selectedItems.has(row.id)} disabled={!invoiceable} onChange={()=>onToggle(row.id)}/></label>
      <div className={s.itemMain}>
        <b>{row.description}</b>
        <small>{fmtDate(row.service_date)} · {typeLabels[row.source_type]||row.source_type}{row.detail?` · ${row.detail}`:""}</small>
        {paid>.009?<small style={{marginTop:3,color:remaining>.009?"#9a6513":"#26794d",fontWeight:800}}>{remaining>.009?`Pagado ${money(paid,row.currency)} · pendiente ${money(remaining,row.currency)}`:`Saldado · ${money(paid,row.currency)}`}</small>:null}
        {parts.map((part,index)=><small key={part.payment_id+"-"+index} style={{marginTop:2,color:"var(--muted)"}}>Pago #{part.payment_id} · {part.method} · {money(part.amount,part.currency||row.currency)}{part.origin?` · origen: ${part.origin}`:""}</small>)}
      </div>
      <strong>{money(row.total,row.currency)}</strong>
      <span title={title} className={`${s.itemStatus} ${billing.key==="invoiced"?s.invoiced:billing.key==="draft"?s.draft:billing.key==="partial"?s.partial:""}`}>{billing.label}</span>
      {movable&&folios.length>1?<select value={row.folio_id} disabled={saving} onChange={event=>onMove(row,event.target.value)} aria-label="Mover consumo a otro folio">{folios.map(folio=><option key={folio.id} value={folio.id}>{folio.label}</option>)}</select>:<span/>}
    </div>
  })}</div>
}
