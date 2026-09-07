"use client"

import{useEffect,useState}from"react"
import s from"./reservationFolioBilling.module.css"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())
const TAX_CONDITIONS=[["consumidor_final","Consumidor final"],["responsable_inscripto","Responsable inscripto"],["monotributo","Monotributo"],["exento","Exento"],["cliente_exterior","Cliente del exterior"],["no_categorizado","No categorizado"]]
const taxRateFor=(condition,reservation)=>{
  const base=reservation?.impuestos_desglosados?Math.max(0,Number(reservation.iva_porcentaje||21)):0
  return["exento","cliente_exterior"].includes(condition)?0:base
}
const blankLine=(reservation,condition)=>({folio_item_id:null,service_date:today(),description:"",quantity:1,unit_price:0,tax_rate:taxRateFor(condition,reservation)})

export default function ReservationInvoiceDialog({
  open,selected,reservation,invoiceMode,changeInvoiceMode,checkedInvoiceItems,invoiceableItems,
  invoicePaymentId,chooseInvoicePayment,folioPayments,folioAllocations,billingName,setBillingName,
  billingEmail,setBillingEmail,billingPhone,setBillingPhone,billingDueAt,setBillingDueAt,
  billingCurrency,setBillingCurrency,billingStatus,setBillingStatus,invoiceLines,setInvoiceLines,
  updateInvoiceLine,billingNotes,setBillingNotes,invoiceCalc,saving,prepareInvoice,onClose,
}){
  const[taxCondition,setTaxCondition]=useState("consumidor_final")
  useEffect(()=>{
    if(!open)return
    const initial=reservation?.condicion_iva_huesped||"consumidor_final",rate=taxRateFor(initial,reservation)
    setTaxCondition(initial)
    setInvoiceLines(current=>current.map(line=>({...line,tax_rate:rate})))
  },[open,reservation?.id])
  if(!open||!selected)return null
  function changeTaxCondition(value){const rate=taxRateFor(value,reservation);setTaxCondition(value);setInvoiceLines(current=>current.map(line=>({...line,tax_rate:rate})))}
  return <div className={s.overlay} onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
    <div className={`${s.modal} ${s.invoiceModal}`}>
      <button className={s.close} onClick={onClose}>×</button>
      <small>NUEVO DOCUMENTO</small>
      <h2>Crear factura / documento</h2>

      <div className={s.formGrid}>
        <label className={s.full}><span>Vincular reserva</span><input value={`${reservation.numero_reserva||`#${reservation.id}`} · ${reservation.nombre_huesped||"Huésped"} · ${selected.label}`} readOnly/></label>
      </div>

      <div className={s.invoiceScope}>
        <div><span>Qué facturar</span><small>El comprobante queda vinculado a esta reserva y a {selected.label}.</small></div>
        <div className={s.scopeButtons}>
          <button type="button" className={invoiceMode==="folio"?s.scopeActive:""} onClick={()=>changeInvoiceMode("folio")}>Cargos del folio</button>
          <button type="button" className={invoiceMode==="payment"?s.scopeActive:""} onClick={()=>changeInvoiceMode("payment")}>Pago registrado</button>
        </div>
      </div>

      {invoiceMode==="payment"?<label className={s.paymentPicker}><span>Pago a facturar</span><select value={invoicePaymentId} onChange={event=>chooseInvoicePayment(event.target.value)}><option value="">Elegir pago…</option>{folioPayments.map(payment=>{const alloc=folioAllocations.find(row=>Number(row.payment_id)===Number(payment.id));return <option key={payment.id} value={payment.id}>{payment.metodo||"Pago"} · {money(alloc?.amount||0,payment.moneda||selected.currency)} · {fmtDateTime(payment.created_at)}</option>})}</select></label>:null}

      <div className={s.formGrid}>
        <label><span>Cliente</span><input value={billingName} onChange={event=>setBillingName(event.target.value)}/></label>
        <label><span>Email</span><input type="email" value={billingEmail} onChange={event=>setBillingEmail(event.target.value)}/></label>
        <label><span>Teléfono</span><input value={billingPhone} onChange={event=>setBillingPhone(event.target.value)}/></label>
        <label><span>Vencimiento</span><input type="date" value={billingDueAt} onChange={event=>setBillingDueAt(event.target.value)}/></label>
        <label><span>Moneda</span><select value={billingCurrency} onChange={event=>setBillingCurrency(event.target.value)}><option value="ARS">ARS</option><option value="USD">USD</option></select></label>
        <label><span>Condición IVA</span><select value={taxCondition} onChange={event=>changeTaxCondition(event.target.value)}>{TAX_CONDITIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Estado inicial</span><select value={billingStatus} onChange={event=>setBillingStatus(event.target.value)}><option value="draft">Borrador</option><option value="issued">Emitido</option></select></label>
      </div>

      <div className={s.invoiceLines}>
        <header><h3>Conceptos</h3><button type="button" onClick={()=>setInvoiceLines(current=>[...current,blankLine(reservation,taxCondition)])}>＋ Agregar línea</button></header>
        {invoiceLines.length?<div style={{overflowX:"auto",paddingBottom:2}}><div style={{minWidth:930}}><div style={{display:"grid",gridTemplateColumns:"105px minmax(180px,2fr) 70px 105px 105px 88px 105px 105px 38px",gap:7,alignItems:"end",padding:"10px 0 2px",fontSize:9.5,fontWeight:850,color:"var(--muted)"}}><span>Fecha</span><span>Descripción</span><span style={{textAlign:"right"}}>Unidades</span><span style={{textAlign:"right"}}>Precio</span><span style={{textAlign:"right"}}>Subtotal</span><span style={{textAlign:"right"}}>Impuestos</span><span style={{textAlign:"right"}}>IVA</span><span style={{textAlign:"right"}}>Total</span><span></span></div>{invoiceLines.map((line,index)=>{const quantity=Math.max(0,Number(line.quantity||0)),unit=Number(line.unit_price||0),subtotal=quantity*unit,rate=Math.max(0,Number(line.tax_rate||0)),tax=subtotal*rate/100,total=subtotal+tax;return <div key={`${line.folio_item_id||"manual"}-${index}`} data-discount={line.source_type==="discount"?"true":"false"} style={{display:"grid",gridTemplateColumns:"105px minmax(180px,2fr) 70px 105px 105px 88px 105px 105px 38px",gap:7,alignItems:"center",marginTop:7}}>
          <input aria-label="Fecha" type="date" value={line.service_date||reservation.fecha_entrada||today()} onChange={event=>updateInvoiceLine(index,"service_date",event.target.value)}/>
          <input aria-label="Descripción" placeholder="Descripción" value={line.description} onChange={event=>updateInvoiceLine(index,"description",event.target.value)}/>
          <input aria-label="Cantidad" type="number" min="0" step="1" value={line.quantity} onChange={event=>updateInvoiceLine(index,"quantity",event.target.value)}/>
          <input aria-label="Precio unitario" type="number" step="0.01" value={line.unit_price} onChange={event=>updateInvoiceLine(index,"unit_price",event.target.value)}/>
          <div style={{height:42,display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"0 8px",border:"1px solid var(--line)",borderRadius:10,background:"color-mix(in srgb,var(--panelSolid) 72%,transparent)",fontSize:10,fontWeight:800}}>{money(subtotal,billingCurrency)}</div>
          <input aria-label="IVA porcentaje" title="Alícuota IVA" type="number" min="0" max="100" step="0.01" value={line.tax_rate} onChange={event=>updateInvoiceLine(index,"tax_rate",event.target.value)}/>
          <div style={{height:42,display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"0 8px",border:"1px solid var(--line)",borderRadius:10,background:"color-mix(in srgb,var(--panelSolid) 72%,transparent)",fontSize:10,fontWeight:800}}>{money(tax,billingCurrency)}</div>
          <div style={{height:42,display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"0 8px",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))",fontSize:10,fontWeight:900}}>{money(total,billingCurrency)}</div>
          <button type="button" aria-label="Quitar línea" style={{height:42,padding:0}} onClick={()=>setInvoiceLines(current=>current.filter((_,i)=>i!==index))}>×</button>
        </div>})}</div></div>:<div className={s.invoiceEmpty}>No hay conceptos cargados todavía.</div>}
      </div>

      <label className={s.notes}><span>Nota interna</span><textarea value={billingNotes} onChange={event=>setBillingNotes(event.target.value)} placeholder={`Factura vinculada a ${selected.label}`}/></label>
      <div className={s.invoiceTotals}><span>Precio sin impuestos nacionales <b>{money(invoiceCalc.subtotal,billingCurrency)}</b></span><span>IVA / impuestos <b>{money(invoiceCalc.tax,billingCurrency)}</b></span><strong>Total {money(invoiceCalc.total,billingCurrency)}</strong></div>
      <div className={s.documentActions}><button className={s.primary} type="button" onClick={()=>prepareInvoice({taxCondition})} disabled={saving||(invoiceMode==="payment"&&!invoicePaymentId)}>{saving?"Guardando…":"Crear documento"}</button></div>
    </div>
  </div>
}