import{supabase}from"../../../../lib/supabase"
import{validPayment,paymentCurrency,allocatedPhysicalAmount}from"./reservationPaymentInvoiceUtils"
import{buildArcaIssueRequest,buildArcaIssueRequestFromDocument,buildFinanceInvoicePayload,validateFiscalIssueContext,validateFiscalRecipient}from"./reservationInvoiceDocument"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)

export function calculateInvoiceTotals(invoiceLines=[],billingTributes=[]){
  let subtotal=0,tax=0
  for(const line of invoiceLines){const quantity=Math.max(0,Number(line.quantity||0)),unitPrice=Number(line.unit_price||0),rate=Math.max(0,Number(line.tax_rate||0)),base=quantity*unitPrice;subtotal+=base;tax+=base*rate/100}
  const tributes=(billingTributes||[]).reduce((sum,row)=>{const base=Math.max(0,Number(row.base)||0),rate=Math.max(0,Number(row.rate)||0),computed=base>0&&rate>0?base*rate/100:0;return sum+Math.max(0,Number(row.amount)||computed)},0)
  return{subtotal,tax,tributes,total:subtotal+tax+tributes}
}

export function deriveInvoicePaymentSnapshot({total,currency,paymentId=null,folioAllocations=[],payments=[]}){
  const invoiceCurrency=String(currency||"ARS").toUpperCase(),rows=(paymentId?folioAllocations.filter(row=>Number(row.payment_id)===Number(paymentId)):folioAllocations).slice().sort((a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0))
  let remaining=Math.max(0,Number(total)||0),covered=0
  const methods=[]
  for(const allocation of rows){
    if(remaining<=.009)break
    const payment=payments.find(row=>Number(row.id)===Number(allocation.payment_id))
    if(!payment||!validPayment(payment))continue
    const receivedCurrency=paymentCurrency(payment),receivedAmount=allocatedPhysicalAmount(payment,allocation.amount),available=receivedCurrency===invoiceCurrency?receivedAmount:Math.max(0,Number(allocation.amount)||0),applied=Math.min(remaining,available)
    if(applied<=.009)continue
    covered+=applied;remaining-=applied
    methods.push({payment_id:Number(payment.id),method:payment.metodo||"Pago",amount:applied,currency:invoiceCurrency,received_amount:receivedAmount,received_currency:receivedCurrency,reference:payment.referencia||null,created_at:payment.created_at||null})
  }
  const labels=[...new Set(methods.map(row=>row.method).filter(Boolean))]
  return{sale_condition:remaining<=.02?"contado":"cuenta_corriente",payment_methods:methods,payment_method_label:labels.join(" + ")||null,payment_covered:covered,payment_pending:Math.max(0,remaining)}
}

export async function issueArcaFinanceDocument({doc,reservation,relatedDocument=null}){
  const request=buildArcaIssueRequestFromDocument({doc,reservation,relatedDocument})
  const{data,error:fnError}=await supabase.functions.invoke("hotel-arca-invoice",{body:request})
  if(fnError)throw fnError
  if(!data?.ok)throw new Error(data?.error||(data?.invoice?.errors||[]).map(row=>row.msg||row.code).join(" · ")||"ARCA no autorizó el comprobante.")
  return data.invoice
}

export async function createFinanceInvoice(input){
  const{propertyId,reservation,selected,billingStatus,billingCurrency,billingName,billingEmail,billingPhone,billingTaxId,billingDocType,billingAddress,billingDueAt,billingNotes,billingExchangeRate,invoiceCalc,invoiceLines,invoiceMode,invoicePaymentId,folioAllocations,payments,checkedInvoiceItems,invoiceableItems,taxCondition,fiscal,billingTributes}=input
  if(!billingName.trim())throw new Error("Ingresá el nombre o razón social del cliente.")
  if(!invoiceLines.length||invoiceCalc.total<=0)throw new Error("Agregá al menos un concepto con importe.")
  if(invoiceLines.some(line=>!String(line.description||"").trim()))throw new Error("Completá la descripción de todos los conceptos.")
  validateFiscalRecipient({billingStatus,taxCondition,billingTaxId,billingDocType,billingAddress,invoiceTotal:invoiceCalc.total})
  validateFiscalIssueContext({billingStatus,fiscal})
  let itemIds=[],paymentId=null,billingMode="folio"
  if(invoiceMode==="payment"){
    paymentId=Number(invoicePaymentId)||null
    const allocation=folioAllocations.find(row=>Number(row.payment_id)===paymentId),payment=payments.find(row=>Number(row.id)===paymentId)
    if(!allocation||!payment)throw new Error("Elegí un pago asignado a este folio.")
    const expectedCurrency=paymentCurrency(payment),expectedTotal=allocatedPhysicalAmount(payment,allocation.amount)
    if(String(billingCurrency||"").toUpperCase()!==expectedCurrency)throw new Error(`La factura de este pago debe emitirse en ${expectedCurrency}, que fue la moneda realmente recibida.`)
    if(Math.abs(invoiceCalc.total-expectedTotal)>.02)throw new Error(`El total debe coincidir con el importe recibido: ${money(expectedTotal,expectedCurrency)}.`)
    billingMode="payment"
  }else{
    const source=checkedInvoiceItems.length?checkedInvoiceItems:invoiceableItems
    itemIds=source.map(row=>row.id);billingMode=checkedInvoiceItems.length?"partial_items":"folio"
  }
  if(String(billingCurrency).toUpperCase()==="USD"&&Number(billingExchangeRate)<=0)throw new Error("Para emitir en USD cargá la cotización ARS/USD.")
  const paymentSnapshot=deriveInvoicePaymentSnapshot({total:invoiceCalc.total,currency:billingCurrency,paymentId,folioAllocations,payments})
  const userRes=await supabase.auth.getUser();if(userRes.error)throw userRes.error
  const payload=buildFinanceInvoicePayload({propertyId,reservation,selected,paymentId,billingStatus,billingCurrency,billingName,billingEmail,billingPhone,billingTaxId,billingDocType,billingAddress,billingDueAt,billingNotes,billingExchangeRate,invoiceCalc,invoiceLines,itemIds,billingMode,userId:userRes.data?.user?.id,taxCondition,fiscal,paymentSnapshot,billingTributes})
  const res=await supabase.from("hotel_finance_documents").insert(payload).select("*").single()
  if(res.error)throw res.error
  const doc=res.data
  let invoice=null
  if(billingStatus==="issued"){
    const request=buildArcaIssueRequest({documentId:doc.id,propertyId,reservation,billingCurrency,billingTaxId,billingDocType,billingDueAt,billingExchangeRate,invoiceCalc,invoiceLines,taxCondition,fiscal,billingTributes})
    const{data,error:fnError}=await supabase.functions.invoke("hotel-arca-invoice",{body:request})
    if(fnError)throw Object.assign(fnError,{financeDocument:doc})
    if(!data?.ok){const error=new Error(data?.error||(data?.invoice?.errors||[]).map(row=>row.msg||row.code).join(" · ")||"ARCA no autorizó el comprobante.");error.financeDocument=doc;throw error}
    invoice=data.invoice||null
  }
  return{doc,invoice,paymentSnapshot}
}
