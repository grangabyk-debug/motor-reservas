"use client"

import{useEffect,useState}from"react"
import{createPortal}from"react-dom"
import{supabase}from"../../../../lib/supabase"
import s from"./reservationFolioBilling.module.css"
import{paymentCurrency,allocatedPhysicalAmount}from"./reservationPaymentInvoiceUtils"
import{RECIPIENT_IVA_CONDITIONS,fiscalRecipientNote,invoiceVatRate,receiptRule,recipientIvaCode,shouldDiscriminateVat}from"./arcaInvoiceRules"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())
function retaxPreservingGross(lines,rate){
  const nextRate=Math.max(0,Number(rate)||0)
  return lines.map(line=>{const quantity=Math.max(.0001,Number(line.quantity)||1),unit=Number(line.unit_price)||0,oldRate=Math.max(0,Number(line.tax_rate)||0),gross=Number(line.gross_total)>0?Number(line.gross_total):quantity*unit*(1+oldRate/100),nextUnit=gross/(1+nextRate/100)/quantity;return{...line,unit_price:Math.round(nextUnit*1e6)/1e6,tax_rate:nextRate,gross_total:line.source_type==="payment"?gross:line.gross_total}})
}
const blankLine=(reservation,taxConfig,issuerCondition)=>({folio_item_id:null,service_date:today(),description:"",quantity:1,unit_price:0,tax_rate:invoiceVatRate({reservation,taxConfig,issuerCondition})})

export default function ReservationInvoiceDialog({
  open,selected,reservation,invoiceMode,changeInvoiceMode,checkedInvoiceItems,invoiceableItems,
  invoicePaymentId,chooseInvoicePayment,folioPayments,folioAllocations,billingName,setBillingName,
  billingEmail,setBillingEmail,billingPhone,setBillingPhone,billingTaxId,setBillingTaxId,billingDueAt,setBillingDueAt,
  billingCurrency,setBillingCurrency,billingStatus,setBillingStatus,invoiceLines,setInvoiceLines,
  updateInvoiceLine,billingNotes,setBillingNotes,invoiceCalc,saving,prepareInvoice,onClose,
}){
  const[taxCondition,setTaxCondition]=useState("consumidor_final")
  const[taxConfig,setTaxConfig]=useState({enabled:true,rate:21})
  const[issuerCondition,setIssuerCondition]=useState(null)
  const[portalRoot,setPortalRoot]=useState(null)
  useEffect(()=>{
    if(!open||typeof document==="undefined"){setPortalRoot(null);return}
    setPortalRoot(document.querySelector("[data-theme]")||document.body)
  },[open])
  useEffect(()=>{
    if(!open)return
    let cancelled=false
    async function loadTax(){
      let next={enabled:true,rate:21},issuer=null
      try{
        const propertyId=reservation?.property_id
        if(propertyId){
          const[{data:settings},{data:arca}]=await Promise.all([
            supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
            supabase.from("hotel_arca_settings").select("issuer_iva_condition,enabled").eq("property_id",propertyId).maybeSingle(),
          ])
          const taxes=settings?.settings?.taxes||{}
          next={enabled:taxes.enabled!==false,rate:Math.max(0,Number(taxes.vat_rate??21)),defaultRecipient:taxes.default_recipient_condition||"consumidor_final",issuerCondition:taxes.issuer_iva_condition||null}
          issuer=arca?.enabled===false?null:(arca?.issuer_iva_condition||taxes.issuer_iva_condition||(taxes.enabled!==false&&Number(taxes.vat_rate??21)>0?"responsable_inscripto":null))
        }
      }catch{}
      if(cancelled)return
      const initial=reservation?.condicion_iva_huesped||next.defaultRecipient||"consumidor_final",rate=invoiceVatRate({reservation,taxConfig:next,issuerCondition:issuer})
      setTaxConfig(next);setIssuerCondition(issuer);setTaxCondition(initial);setInvoiceLines(current=>retaxPreservingGross(current,rate))
    }
    loadTax()
    return()=>{cancelled=true}
  },[open,reservation?.id,reservation?.property_id])
  if(!open||!selected||!portalRoot)return null
  const crossCurrencyPayment=folioPayments.find(payment=>paymentCurrency(payment)!==String(payment.moneda||selected.currency||reservation.moneda||"ARS").toUpperCase())
  function changeTaxCondition(value){const rate=invoiceVatRate({reservation,taxConfig,issuerCondition});setTaxCondition(value);setInvoiceLines(current=>retaxPreservingGross(current,rate))}
  const fiscalRule=receiptRule(issuerCondition,taxCondition),currentTaxRate=invoiceVatRate({reservation,taxConfig,issuerCondition}),showTaxBreakdown=shouldDiscriminateVat(issuerCondition,taxCondition),fiscalNote=fiscalRecipientNote(issuerCondition,taxCondition,currentTaxRate),recipientCode=recipientIvaCode(taxCondition)
  const dialog=<div className={s.overlay} role="dialog" aria-modal="true" aria-label="Crear factura o documento" onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
    <div className={`${s.modal} ${s.invoiceModal}`} style={{width:"min(1180px,calc(100vw - 40px))",maxHeight:"calc(100dvh - 40px)",padding:24}}>
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

      {invoiceMode==="folio"&&crossCurrencyPayment?<div style={{margin:"10px 0 0",padding:"10px 12px",border:"1px solid color-mix(in srgb,var(--accent) 22%,var(--line))",borderRadius:12,background:"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))",fontSize:10.5,color:"var(--muted)"}}>Esta reserva está en <b style={{color:"var(--text)"}}>{reservation.moneda||selected.currency}</b>, pero hay un pago recibido en <b style={{color:"var(--accent)"}}>{paymentCurrency(crossCurrencyPayment)}</b>. Si querés que la factura salga en la moneda realmente cobrada, elegí <b style={{color:"var(--text)"}}>Pago registrado</b>.</div>:null}

      {invoiceMode==="payment"?<label className={s.paymentPicker}><span>Pago a facturar</span><select value={invoicePaymentId} onChange={event=>chooseInvoicePayment(event.target.value,currentTaxRate)}><option value="">Elegir pago…</option>{folioPayments.map(payment=>{const alloc=folioAllocations.find(row=>Number(row.payment_id)===Number(payment.id)),physical=allocatedPhysicalAmount(payment,alloc?.amount||0),pCurrency=paymentCurrency(payment),accountingCurrency=String(payment.moneda||selected.currency||"ARS").toUpperCase(),cross=pCurrency!==accountingCurrency;return <option key={payment.id} value={payment.id}>{payment.metodo||"Pago"} · {money(physical,pCurrency)}{cross?` · aplica ${money(alloc?.amount||0,accountingCurrency)}`:""} · {fmtDateTime(payment.created_at)}</option>})}</select></label>:null}

      <div className={s.formGrid}>
        <label><span>Cliente</span><input value={billingName} onChange={event=>setBillingName(event.target.value)}/></label>
        <label><span>Email</span><input type="email" value={billingEmail} onChange={event=>setBillingEmail(event.target.value)}/></label>
        <label><span>Teléfono</span><input value={billingPhone} onChange={event=>setBillingPhone(event.target.value)}/></label>
        <label><span>CUIT / documento</span><input inputMode="numeric" value={billingTaxId} onChange={event=>setBillingTaxId(event.target.value)} placeholder={["responsable_inscripto","monotributo"].includes(taxCondition)?"CUIT de 11 dígitos":"Opcional"}/>{["responsable_inscripto","monotributo"].includes(taxCondition)?<small style={{marginTop:4}}>Requerido para emitir Factura A.</small>:null}</label>
        <label><span>Vencimiento</span><input type="date" value={billingDueAt} onChange={event=>setBillingDueAt(event.target.value)}/></label>
        <label><span>{invoiceMode==="payment"?"Moneda recibida":"Moneda"}</span><select value={billingCurrency} disabled={invoiceMode==="payment"&&Boolean(invoicePaymentId)} onChange={event=>setBillingCurrency(event.target.value)}><option value="ARS">ARS</option><option value="USD">USD</option></select>{invoiceMode==="payment"&&invoicePaymentId?<small style={{marginTop:4}}>Se toma de la moneda realmente recibida en el pago.</small>:null}</label>
        <label><span>Condición IVA del receptor</span><select value={taxCondition} onChange={event=>changeTaxCondition(event.target.value)}>{RECIPIENT_IVA_CONDITIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><small style={{marginTop:4}}>Recepción informa la condición del cliente; el sistema determina automáticamente la clase A/B/C y cómo mostrar el IVA.</small></label>
        <label><span>Estado inicial</span><select value={billingStatus} onChange={event=>setBillingStatus(event.target.value)}><option value="draft">Borrador</option><option value="issued">Emitido</option></select></label>
      </div>
      <div style={{margin:"10px 0 0",padding:"10px 12px",border:"1px solid color-mix(in srgb,var(--accent) 22%,var(--line))",borderRadius:12,background:"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))",fontSize:10.4,lineHeight:1.45}}><b style={{display:"block",color:"var(--text)"}}>{fiscalNote.title}</b><span style={{display:"block",marginTop:3,color:"var(--muted)"}}>{fiscalNote.detail}</span><span style={{display:"block",marginTop:4,color:"var(--muted)"}}>Condición receptor ARCA: código {recipientCode}{issuerCondition?" · Emisor: "+issuerCondition.replaceAll("_"," "):""}</span></div>

      <div className={s.invoiceLines}>
        <header><h3>Conceptos</h3><button type="button" onClick={()=>setInvoiceLines(current=>[...current,blankLine(reservation,taxConfig,issuerCondition)])}>＋ Agregar línea</button></header>
        {invoiceLines.length?<div style={{overflowX:"auto",paddingBottom:2}}><div style={{minWidth:showTaxBreakdown?930:690}}><div style={{display:"grid",gridTemplateColumns:showTaxBreakdown?"105px minmax(180px,2fr) 70px 105px 105px 88px 105px 105px 38px":"105px minmax(220px,2fr) 75px 125px 125px 38px",gap:7,alignItems:"end",padding:"10px 0 2px",fontSize:9.5,fontWeight:850,color:"var(--muted)"}}><span>Fecha</span><span>Descripción</span><span style={{textAlign:"right"}}>Unidades</span><span style={{textAlign:"right"}}>{showTaxBreakdown?"Precio neto":"Precio final"}</span>{showTaxBreakdown?<><span style={{textAlign:"right"}}>Neto</span><span style={{textAlign:"right"}}>IVA %</span><span style={{textAlign:"right"}}>IVA</span></>:null}<span style={{textAlign:"right"}}>Total</span><span></span></div>{invoiceLines.map((line,index)=>{const quantity=Math.max(0,Number(line.quantity||0)),unit=Number(line.unit_price||0),subtotal=quantity*unit,rate=Math.max(0,Number(line.tax_rate||0)),tax=subtotal*rate/100,total=subtotal+tax,finalUnit=unit*(1+rate/100);return <div key={`${line.folio_item_id||"manual"}-${index}`} data-discount={line.source_type==="discount"?"true":"false"} style={{display:"grid",gridTemplateColumns:showTaxBreakdown?"105px minmax(180px,2fr) 70px 105px 105px 88px 105px 105px 38px":"105px minmax(220px,2fr) 75px 125px 125px 38px",gap:7,alignItems:"center",marginTop:7}}>
          <input aria-label="Fecha" type="date" value={line.service_date||reservation.fecha_entrada||today()} onChange={event=>updateInvoiceLine(index,"service_date",event.target.value)}/>
          <input aria-label="Descripción" placeholder="Descripción" value={line.description} onChange={event=>updateInvoiceLine(index,"description",event.target.value)}/>
          <input aria-label="Cantidad" type="number" min="0" step="1" value={line.quantity} onChange={event=>updateInvoiceLine(index,"quantity",event.target.value)}/>
          {showTaxBreakdown?<input aria-label="Precio neto unitario" type="number" step="0.01" value={line.unit_price} onChange={event=>updateInvoiceLine(index,"unit_price",event.target.value)}/>:<input aria-label="Precio final unitario" type="number" step="0.01" value={Math.round(finalUnit*100)/100} onChange={event=>{const gross=Math.max(0,Number(event.target.value)||0),divisor=1+rate/100;updateInvoiceLine(index,"unit_price",divisor>0?Math.round(gross/divisor*1e6)/1e6:gross)}}/>}
          {showTaxBreakdown?<><div style={{height:42,display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"0 8px",border:"1px solid var(--line)",borderRadius:10,background:"color-mix(in srgb,var(--panelSolid) 72%,transparent)",fontSize:10,fontWeight:800}}>{money(subtotal,billingCurrency)}</div><input aria-label="IVA porcentaje" title="Alícuota IVA" type="number" min="0" max="100" step="0.01" value={line.tax_rate} onChange={event=>updateInvoiceLine(index,"tax_rate",event.target.value)}/><div style={{height:42,display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"0 8px",border:"1px solid var(--line)",borderRadius:10,background:"color-mix(in srgb,var(--panelSolid) 72%,transparent)",fontSize:10,fontWeight:800}}>{money(tax,billingCurrency)}</div></>:null}
          <div style={{height:42,display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"0 8px",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))",fontSize:10,fontWeight:900}}>{money(total,billingCurrency)}</div>
          <button type="button" aria-label="Quitar línea" style={{height:42,padding:0}} onClick={()=>setInvoiceLines(current=>current.filter((_,i)=>i!==index))}>×</button>
        </div>})}</div></div>:<div className={s.invoiceEmpty}>No hay conceptos cargados todavía.</div>}
      </div>

      <label className={s.notes}><span>Nota interna</span><textarea value={billingNotes} onChange={event=>setBillingNotes(event.target.value)} placeholder={`Factura vinculada a ${selected.label}`}/></label>
      <div className={s.invoiceTotals}>{showTaxBreakdown?<><span>Precio neto <b>{money(invoiceCalc.subtotal,billingCurrency)}</b></span><span>IVA discriminado <b>{money(invoiceCalc.tax,billingCurrency)}</b></span></>:<span>{fiscalRule.receiptClass==="B"?"IVA incluido · no discriminado":"Sin IVA discriminado"}</span>}<strong>Total {money(invoiceCalc.total,billingCurrency)}</strong></div>
      <div className={s.documentActions}><button className={s.primary} type="button" onClick={()=>prepareInvoice({taxCondition,fiscal:{...fiscalRule,recipientCode,taxBreakdownRequired:showTaxBreakdown,taxRate:currentTaxRate}})} disabled={saving||(invoiceMode==="payment"&&!invoicePaymentId)}>{saving?"Guardando…":"Crear documento"}</button></div>
    </div>
  </div>
  return createPortal(dialog,portalRoot)
}