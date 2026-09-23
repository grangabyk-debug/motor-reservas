export const RECIPIENT_DOC_TYPES=[
  ["cuit","CUIT",80],
  ["cuil","CUIL",86],
  ["cdi","CDI",87],
  ["dni","DNI",96],
  ["pasaporte","Pasaporte",94],
  ["consumidor_final","Sin identificar",99],
]

export const MONOTRIBUTO_A_LEGEND="El crédito fiscal discriminado en el presente comprobante, solo podrá ser computado a efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley Nº 27.618"

const digits=value=>String(value||"").replace(/\D/g,"")
const round2=value=>Math.round((Number(value)||0)*100)/100
const normalize=value=>String(value||"").trim().toLowerCase()

export function recipientDocTypeCode(value){
  return RECIPIENT_DOC_TYPES.find(([id])=>id===value)?.[2]||99
}

export function defaultRecipientDocType(taxCondition,taxId){
  const condition=normalize(taxCondition),id=digits(taxId)
  if(["responsable_inscripto","monotributo","exento","no_categorizado","no_alcanzado"].includes(condition))return"cuit"
  if(id.length===11)return"cuit"
  if(id.length>=7)return"dni"
  return"consumidor_final"
}

export function validateFiscalRecipient({billingStatus,taxCondition,billingTaxId,billingDocType,billingAddress,invoiceTotal=0}){
  if(billingStatus!=="issued")return
  const condition=normalize(taxCondition),fiscalId=digits(billingTaxId),docType=normalize(billingDocType)
  if(["responsable_inscripto","monotributo","exento","no_categorizado","no_alcanzado"].includes(condition)){
    if(docType!=="cuit"||fiscalId.length!==11)throw new Error("Para este receptor cargá CUIT de 11 dígitos.")
    if(!String(billingAddress||"").trim())throw new Error("ARCA exige el domicilio comercial del receptor para esta condición fiscal.")
  }
  if(condition==="consumidor_final"&&Number(invoiceTotal)>=10000000){
    if(docType==="consumidor_final"||!fiscalId)throw new Error("Para Consumidor Final desde $10.000.000 ARCA exige identificar al receptor con DNI, CUIL, CDI, CUIT o documento equivalente.")
  }
}

export function validateFiscalIssueContext({billingStatus,fiscal}){
  if(billingStatus!=="issued")return
  if(!fiscal?.issuerConfigured)throw new Error("Antes de emitir, completá y verificá la configuración fiscal del hotel en Configuración → ARCA.")
  if(!fiscal?.receiptClass)throw new Error("No se pudo determinar la clase fiscal del comprobante.")
  if(fiscal.receiptClass==="T")throw new Error("Esta operación reúne los datos para Factura T. La autorización T debe realizarse por el circuito ARCA WSCT.")
  if(fiscal.receiptClass==="E")throw new Error("La Factura E usa ARCA WSFEXv1 y no puede emitirse desde el flujo WSFE A/B/C.")
}

export function vatIdForRate(rate){
  const value=Number(rate)||0
  if(Math.abs(value-0)<.001)return 3
  if(Math.abs(value-2.5)<.001)return 9
  if(Math.abs(value-5)<.001)return 8
  if(Math.abs(value-10.5)<.001)return 4
  if(Math.abs(value-21)<.001)return 5
  if(Math.abs(value-27)<.001)return 6
  throw new Error(`La alícuota IVA ${value}% no está mapeada a una alícuota WSFE admitida por ARCA.`)
}

export function buildVatBreakdown(invoiceLines){
  const grouped=new Map()
  for(const line of invoiceLines||[]){
    const quantity=Math.max(0,Number(line.quantity)||0),unit=Math.max(0,Number(line.unit_price)||0),rate=Math.max(0,Number(line.tax_rate)||0)
    if(rate<=0)continue
    const base=quantity*unit,amount=base*rate/100,id=vatIdForRate(rate),current=grouped.get(id)||{id,base:0,amount:0}
    current.base+=base;current.amount+=amount;grouped.set(id,current)
  }
  return[...grouped.values()].map(row=>({...row,base:round2(row.base),amount:round2(row.amount)}))
}

export function normalizedTributes(rows=[]){
  const idByScope={national:1,provincial:2,municipal:3,internal:4,other:99}
  return(rows||[]).map(row=>{
    const base=Math.max(0,Number(row.base)||0),rate=Math.max(0,Number(row.rate)||0)
    const computed=base>0&&rate>0?base*rate/100:0
    const amount=Math.max(0,Number(row.amount)||computed)
    return{id:Number(row.id)||idByScope[row.scope]||99,scope:row.scope||"other",description:String(row.description||"Tributo").trim()||"Tributo",base:round2(base),rate:Number(rate),amount:round2(amount)}
  }).filter(row=>row.amount>0)
}

export function buildFinanceInvoicePayload({propertyId,reservation,selected,paymentId,billingStatus,billingCurrency,billingName,billingEmail,billingPhone,billingTaxId,billingDocType,billingAddress,billingDueAt,billingNotes,billingExchangeRate,invoiceCalc,invoiceLines,itemIds,billingMode,userId,taxCondition,fiscal,paymentSnapshot,billingTributes=[]}){
  const tributes=normalizedTributes(billingTributes)
  const items=invoiceLines.map(line=>{
    const quantity=Math.max(0,Number(line.quantity||0)),unitPrice=Number(line.unit_price||0),taxRate=Math.max(0,Number(line.tax_rate||0)),subtotal=quantity*unitPrice,tax=subtotal*taxRate/100
    return{folio_item_id:line.folio_item_id||null,service_date:line.service_date||null,source_type:line.source_type||null,description:String(line.description||"").trim(),detail:line.detail||null,quantity,unit_price:unitPrice,tax_rate:taxRate,tax,subtotal,total:subtotal+tax}
  })
  const otherNationalIndirect=round2(tributes.filter(row=>["national","internal"].includes(row.scope)).reduce((sum,row)=>sum+row.amount,0))
  return{
    property_id:propertyId,reservation_id:Number(reservation.id),folio_id:selected.id,payment_id:paymentId,document_type:"invoice",number:null,status:billingStatus==="issued"?"draft":billingStatus,
    currency:billingCurrency||selected.currency||reservation.moneda||"ARS",subtotal:invoiceCalc.subtotal,tax:invoiceCalc.tax,total:invoiceCalc.total,balance:invoiceCalc.total,
    billing_to:{
      name:billingName.trim(),email:billingEmail.trim()||null,phone:billingPhone.trim()||null,address:String(billingAddress||"").trim()||null,
      tax_id:String(billingTaxId||"").trim()||null,doc_type:billingDocType||"consumidor_final",doc_type_code:recipientDocTypeCode(billingDocType),
      payer_type:selected.payer_type,folio_label:selected.label,iva_condition:taxCondition,iva_condition_code:fiscal.recipientCode||null,
      issuer_iva_condition:fiscal.issuerCondition||null,issuer_configured:Boolean(fiscal.issuerConfigured),receipt_class:fiscal.receiptClass||null,receipt_type:fiscal.receiptType||null,
      arca_service:fiscal.arcaService||null,tax_breakdown_required:Boolean(fiscal.taxBreakdownRequired),foreign_tourist_verified:Boolean(fiscal.foreignTouristVerified),
      foreign_payment_verified:Boolean(fiscal.foreignPaymentVerified),lodging_only:Boolean(fiscal.lodgingOnly),invoice_a_variant:fiscal.invoiceAVariant||"standard",
      sale_condition:paymentSnapshot?.sale_condition||"cuenta_corriente",payment_methods:paymentSnapshot?.payment_methods||[],payment_method_label:paymentSnapshot?.payment_method_label||null,
      payment_covered:round2(paymentSnapshot?.payment_covered||0),payment_pending:round2(paymentSnapshot?.payment_pending??invoiceCalc.total),
      exchange_rate:Number(billingExchangeRate)||1,tributes,transparency:{iva_contenido:round2(invoiceCalc.tax),otros_impuestos_nacionales_indirectos:otherNationalIndirect},
      monotributo_a_legend:fiscal.receiptClass==="A"&&taxCondition==="monotributo"?MONOTRIBUTO_A_LEGEND:null
    },
    items,folio_item_ids:itemIds,billing_mode:billingMode,issued_at:null,due_at:billingDueAt||reservation.fecha_salida||null,external_ref:null,
    notes:String(billingNotes||"").trim()||`Preparada desde ${selected.label}`,created_by:userId||null,related_document_id:null,adjustment_reason:null
  }
}

export function buildArcaIssueRequest({documentId,propertyId,reservation,billingCurrency,billingTaxId,billingDocType,billingDueAt,billingExchangeRate,invoiceCalc,invoiceLines,taxCondition,fiscal,billingTributes=[]}){
  const tributes=normalizedTributes(billingTributes)
  const serviceDates=(invoiceLines||[]).map(line=>String(line.service_date||"").slice(0,10)).filter(Boolean).sort()
  return{
    request_id:`finance-${documentId}`,property_id:propertyId,reservation_id:Number(reservation.id),finance_document_id:documentId,document_type:"invoice",
    receipt_class:fiscal.receiptClass,receipt_type:fiscal.receiptType,recipient_iva_condition:taxCondition,recipient_iva_condition_id:fiscal.recipientCode||null,
    recipient_doc_type:recipientDocTypeCode(billingDocType),recipient_doc_number:digits(billingTaxId)||"0",
    amount:round2(invoiceCalc.total),net_amount:round2(invoiceCalc.subtotal),vat_amount:round2(invoiceCalc.tax),exempt_amount:0,untaxed_amount:0,
    tribute_amount:round2(tributes.reduce((sum,row)=>sum+row.amount,0)),tributes,vat_breakdown:buildVatBreakdown(invoiceLines),
    currency:String(billingCurrency||reservation.moneda||"ARS").toUpperCase(),exchange_rate:Number(billingExchangeRate)||1,
    service_from:serviceDates[0]||reservation.fecha_entrada||null,service_to:serviceDates.at(-1)||reservation.fecha_salida||null,
    payment_due:billingDueAt||reservation.fecha_salida||null
  }
}
