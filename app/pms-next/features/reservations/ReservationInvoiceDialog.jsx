"use client"

import s from"./reservationFolioBilling.module.css"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const blankLine=()=>({folio_item_id:null,description:"",quantity:1,unit_price:0,tax_rate:21})

export default function ReservationInvoiceDialog({
  open,selected,reservation,invoiceMode,changeInvoiceMode,checkedInvoiceItems,invoiceableItems,
  invoicePaymentId,chooseInvoicePayment,folioPayments,folioAllocations,billingName,setBillingName,
  billingEmail,setBillingEmail,billingPhone,setBillingPhone,billingDueAt,setBillingDueAt,
  billingCurrency,setBillingCurrency,billingStatus,setBillingStatus,invoiceLines,setInvoiceLines,
  updateInvoiceLine,billingNotes,setBillingNotes,invoiceCalc,saving,prepareInvoice,onClose,
}){
  if(!open||!selected)return null
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
        <p>{invoiceMode==="folio"?(checkedInvoiceItems.length?`${checkedInvoiceItems.length} cargo${checkedInvoiceItems.length===1?"":"s"} seleccionado${checkedInvoiceItems.length===1?"":"s"} · facturación parcial.`:invoiceableItems.length?`Se cargarán los ${invoiceableItems.length} cargos pendientes del folio.`:"Este folio no tiene cargos pendientes; podés agregar un concepto manualmente."):"Elegí uno de los pagos asignados al folio para preparar el comprobante sobre ese importe."}</p>
      </div>

      {invoiceMode==="payment"?<label className={s.paymentPicker}><span>Pago a facturar</span><select value={invoicePaymentId} onChange={event=>chooseInvoicePayment(event.target.value)}><option value="">Elegir pago…</option>{folioPayments.map(payment=>{const alloc=folioAllocations.find(row=>Number(row.payment_id)===Number(payment.id));return <option key={payment.id} value={payment.id}>{payment.metodo||"Pago"} · {money(alloc?.amount||0,payment.moneda||selected.currency)} · {fmtDateTime(payment.created_at)}</option>})}</select></label>:null}

      <div className={s.formGrid}>
        <label><span>Cliente</span><input value={billingName} onChange={event=>setBillingName(event.target.value)}/></label>
        <label><span>Email</span><input type="email" value={billingEmail} onChange={event=>setBillingEmail(event.target.value)}/></label>
        <label><span>Teléfono</span><input value={billingPhone} onChange={event=>setBillingPhone(event.target.value)}/></label>
        <label><span>Vencimiento</span><input type="date" value={billingDueAt} onChange={event=>setBillingDueAt(event.target.value)}/></label>
        <label><span>Moneda</span><select value={billingCurrency} onChange={event=>setBillingCurrency(event.target.value)}><option value="ARS">ARS</option><option value="USD">USD</option></select></label>
        <label><span>Estado inicial</span><select value={billingStatus} onChange={event=>setBillingStatus(event.target.value)}><option value="draft">Borrador</option><option value="issued">Emitido</option></select></label>
      </div>

      <div className={s.invoiceLines}>
        <header><h3>Conceptos</h3><button type="button" onClick={()=>setInvoiceLines(current=>[...current,blankLine()])}>＋ Agregar línea</button></header>
        {invoiceLines.length?invoiceLines.map((line,index)=><div className={s.invoiceLine} key={`${line.folio_item_id||"manual"}-${index}`} data-discount={line.source_type==="discount"?"true":"false"}>
          <input aria-label="Descripción" placeholder="Descripción" value={line.description} onChange={event=>updateInvoiceLine(index,"description",event.target.value)}/>
          <input aria-label="Cantidad" type="number" min="0" step="1" value={line.quantity} onChange={event=>updateInvoiceLine(index,"quantity",event.target.value)}/>
          <input aria-label="Precio unitario" type="number" step="0.01" value={line.unit_price} onChange={event=>updateInvoiceLine(index,"unit_price",event.target.value)}/>
          <label><span>IVA %</span><input type="number" min="0" max="100" step="0.01" value={line.tax_rate} onChange={event=>updateInvoiceLine(index,"tax_rate",event.target.value)}/></label>
          <button type="button" aria-label="Quitar línea" onClick={()=>setInvoiceLines(current=>current.filter((_,i)=>i!==index))}>×</button>
        </div>):<div className={s.invoiceEmpty}>No hay conceptos cargados todavía.</div>}
      </div>

      <label className={s.notes}><span>Nota interna</span><textarea value={billingNotes} onChange={event=>setBillingNotes(event.target.value)} placeholder={`Factura vinculada a ${selected.label}`}/></label>
      <div className={s.invoiceTotals}><span>Subtotal <b>{money(invoiceCalc.subtotal,billingCurrency)}</b></span><span>Impuestos <b>{money(invoiceCalc.tax,billingCurrency)}</b></span><strong>Total {money(invoiceCalc.total,billingCurrency)}</strong></div>
      <div className={s.documentActions}><button className={s.primary} type="button" onClick={prepareInvoice} disabled={saving||(invoiceMode==="payment"&&!invoicePaymentId)}>{saving?"Guardando…":"Crear documento"}</button></div>
    </div>
  </div>
}