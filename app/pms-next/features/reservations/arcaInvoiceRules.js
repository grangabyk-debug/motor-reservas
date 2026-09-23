export const RECIPIENT_IVA_CONDITIONS=[
  ["consumidor_final","Consumidor final",5],
  ["responsable_inscripto","Responsable inscripto",1],
  ["monotributo","Monotributo",6],
  ["exento","Exento",4],
  ["cliente_exterior","Cliente del exterior",9],
  ["no_categorizado","No categorizado",7],
  ["no_alcanzado","IVA no alcanzado",15],
]

const norm=value=>String(value||"").trim().toLowerCase()

export function recipientIvaCode(value){
  return RECIPIENT_IVA_CONDITIONS.find(([id])=>id===value)?.[2]||5
}

export function foreignTouristInvoiceTEligible(issuerCondition,recipientCondition,context={}){
  return norm(issuerCondition)==="responsable_inscripto"
    &&norm(recipientCondition)==="cliente_exterior"
    &&Boolean(context.foreignTouristVerified)
    &&Boolean(context.foreignPaymentVerified)
    &&Boolean(context.lodgingOnly)
}

export function receiptRule(issuerCondition,recipientCondition,context={}){
  const issuer=norm(issuerCondition)
  const recipient=norm(recipientCondition||"consumidor_final")
  if(foreignTouristInvoiceTEligible(issuer,recipient,context)){
    return{receiptClass:"T",receiptType:195,issuerCondition:issuer,automatic:true,arcaService:"wsct",supportedByCurrentIntegration:false}
  }
  if(issuer==="responsable_inscripto"){
    const receiptClass=["responsable_inscripto","monotributo"].includes(recipient)?"A":"B"
    return{receiptClass,receiptType:receiptClass==="A"?1:6,issuerCondition:issuer,automatic:true,arcaService:"wsfev1",supportedByCurrentIntegration:true}
  }
  if(["monotributo","exento"].includes(issuer))return{receiptClass:"C",receiptType:11,issuerCondition:issuer,automatic:true,arcaService:"wsfev1",supportedByCurrentIntegration:true}
  return{receiptClass:null,receiptType:null,issuerCondition:null,automatic:false,arcaService:null,supportedByCurrentIntegration:false}
}

export function shouldDiscriminateVat(issuerCondition,recipientCondition,context={}){
  const rule=receiptRule(issuerCondition,recipientCondition,context)
  return ["A","B","T"].includes(rule.receiptClass)
}

export function invoiceVatRate({reservation,taxConfig,issuerCondition}){
  if(["monotributo","exento"].includes(norm(issuerCondition)))return 0
  const stored=Math.max(0,Number(reservation?.iva_porcentaje)||0)
  if(reservation?.impuestos_desglosados&&stored>0)return stored
  return taxConfig?.enabled!==false?Math.max(0,Number(taxConfig?.rate??21)||0):0
}

export function fiscalRecipientNote(issuerCondition,recipientCondition,rate,context={}){
  const rule=receiptRule(issuerCondition,recipientCondition,context)
  const rateLabel=Number(rate).toLocaleString("es-AR",{maximumFractionDigits:2})
  if(!rule.receiptClass){
    return{title:Number(rate)>0?`IVA ${rateLabel}% configurado`:"Sin IVA",detail:"Falta confirmar la condición fiscal del hotel. Habitación Llena no debe marcar un comprobante como emitido hasta tener ese dato configurado."}
  }
  if(rule.receiptClass==="T"){
    return{title:`Factura T · IVA ${rateLabel}% discriminado`,detail:"Se cumplen los datos informados para el régimen de turista extranjero: alojamiento elegible, condición de turista verificada y medio de pago admitido. La T usa el circuito WSCT; no debe reemplazarse por una B. Los extras no elegibles se facturan aparte."}
  }
  if(rule.receiptClass==="A"){
    const monotributo=norm(recipientCondition)==="monotributo"
    return{title:`Factura A · IVA ${rateLabel}% discriminado`,detail:monotributo?"El sistema discrimina el IVA y conserva la identificación fiscal necesaria para la leyenda aplicable a operaciones con Monotributistas.":"El precio neto y el IVA se muestran separados automáticamente."}
  }
  if(rule.receiptClass==="B"){
    const exterior=norm(recipientCondition)==="cliente_exterior"
    return{title:`Factura B · IVA ${rateLabel}% discriminado`,detail:exterior?"Ser cliente del exterior no convierte por sí solo una estadía consumida en Argentina en una exportación ni en Factura E. En el flujo general corresponde B; si además se verifican los requisitos del régimen de turista extranjero, el sistema pasa a T.":"Para Consumidor Final, Exento, IVA no alcanzado y No categorizado el emisor Responsable Inscripto usa clase B; Habitación Llena conserva neto, alícuota, IVA y total sin alterar el precio contratado."}
  }
  return{title:"Factura C · sin IVA discriminado",detail:"La condición fiscal del emisor determina automáticamente la clase C."}
}
