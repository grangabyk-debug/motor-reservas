export function validateFiscalRecipient({billingStatus,taxCondition,billingTaxId}){
  const fiscalId=String(billingTaxId||"").replace(/\D/g,"")
  if(billingStatus==="issued"&&["responsable_inscripto","monotributo"].includes(taxCondition)&&fiscalId.length!==11)throw new Error("Para emitir a Responsable Inscripto o Monotributo cargá el CUIT de 11 dígitos.")
}

export function validateFiscalIssueContext({billingStatus,fiscal}){
  if(billingStatus!=="issued")return
  if(!fiscal?.issuerConfigured)throw new Error("Antes de marcar el documento como Emitido, confirmá la condición fiscal del hotel en Configuración.")
  if(!fiscal?.receiptClass)throw new Error("No se pudo determinar la clase fiscal del comprobante.")
  if(fiscal.receiptClass==="T")throw new Error("Esta operación reúne los datos para Factura T. No se emitió una B: la autorización T debe realizarse por el circuito ARCA WSCT.")
  if(fiscal.receiptClass==="E")throw new Error("La Factura E usa el circuito ARCA WSFEXv1 y no puede emitirse desde el flujo WSFE A/B/C.")
}

export function buildFinanceInvoicePayload({propertyId,reservation,selected,paymentId,billingStatus,billingCurrency,billingName,billingEmail,billingPhone,billingTaxId,billingDueAt,billingNotes,invoiceCalc,invoiceLines,itemIds,billingMode,userId,taxCondition,fiscal}){
  const items=invoiceLines.map(line=>{
    const quantity=Math.max(0,Number(line.quantity||0)),unitPrice=Number(line.unit_price||0),taxRate=Math.max(0,Number(line.tax_rate||0)),subtotal=quantity*unitPrice,tax=subtotal*taxRate/100
    return{folio_item_id:line.folio_item_id||null,description:String(line.description||"").trim(),detail:line.detail||null,quantity,unit_price:unitPrice,tax_rate:taxRate,tax,subtotal,total:subtotal+tax}
  })
  return{
    property_id:propertyId,reservation_id:Number(reservation.id),folio_id:selected.id,payment_id:paymentId,document_type:"invoice",number:null,status:billingStatus,
    currency:billingCurrency||selected.currency||reservation.moneda||"ARS",subtotal:invoiceCalc.subtotal,tax:invoiceCalc.tax,total:invoiceCalc.total,balance:invoiceCalc.total,
    billing_to:{name:billingName.trim(),email:billingEmail.trim()||null,phone:billingPhone.trim()||null,tax_id:String(billingTaxId||"").trim()||null,payer_type:selected.payer_type,folio_label:selected.label,iva_condition:taxCondition,iva_condition_code:fiscal.recipientCode||null,issuer_iva_condition:fiscal.issuerCondition||null,issuer_configured:Boolean(fiscal.issuerConfigured),receipt_class:fiscal.receiptClass||null,receipt_type:fiscal.receiptType||null,arca_service:fiscal.arcaService||null,tax_breakdown_required:Boolean(fiscal.taxBreakdownRequired),foreign_tourist_verified:Boolean(fiscal.foreignTouristVerified),foreign_payment_verified:Boolean(fiscal.foreignPaymentVerified),lodging_only:Boolean(fiscal.lodgingOnly)},
    items,folio_item_ids:itemIds,billing_mode:billingMode,issued_at:billingStatus==="issued"?new Date().toISOString():null,due_at:billingDueAt||null,external_ref:null,
    notes:String(billingNotes||"").trim()||`Preparada desde ${selected.label}`,created_by:userId||null,related_document_id:null,adjustment_reason:null
  }
}
