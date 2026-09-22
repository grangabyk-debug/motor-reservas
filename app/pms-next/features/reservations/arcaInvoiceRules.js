export const RECIPIENT_IVA_CONDITIONS=[
  ["consumidor_final","Consumidor final",5],
  ["responsable_inscripto","Responsable inscripto",1],
  ["monotributo","Monotributo",6],
  ["exento","Exento",4],
  ["cliente_exterior","Cliente del exterior",9],
  ["no_categorizado","No categorizado",7],
]

export function recipientIvaCode(value){
  return RECIPIENT_IVA_CONDITIONS.find(([id])=>id===value)?.[2]||5
}

export function receiptRule(issuerCondition,recipientCondition){
  const issuer=String(issuerCondition||"").toLowerCase()
  const recipient=String(recipientCondition||"consumidor_final").toLowerCase()
  if(issuer==="responsable_inscripto"){
    const receiptClass=["responsable_inscripto","monotributo"].includes(recipient)?"A":"B"
    return{receiptClass,receiptType:receiptClass==="A"?1:6,issuerCondition:issuer,automatic:true}
  }
  if(["monotributo","exento"].includes(issuer))return{receiptClass:"C",receiptType:11,issuerCondition:issuer,automatic:true}
  return{receiptClass:null,receiptType:null,issuerCondition:null,automatic:false}
}

export function invoiceVatRate({reservation,taxConfig,issuerCondition}){
  if(["monotributo","exento"].includes(String(issuerCondition||"").toLowerCase()))return 0
  const stored=Math.max(0,Number(reservation?.iva_porcentaje)||0)
  if(reservation?.impuestos_desglosados&&stored>0)return stored
  return taxConfig?.enabled!==false?Math.max(0,Number(taxConfig?.rate??21)||0):0
}

export function fiscalRecipientNote(issuerCondition,recipientCondition,rate){
  const rule=receiptRule(issuerCondition,recipientCondition)
  const vat=Number(rate)>0?`IVA ${Number(rate).toLocaleString("es-AR",{maximumFractionDigits:2})}% discriminado`:"Sin IVA discriminado"
  if(!rule.receiptClass)return{title:vat,detail:"ARCA todavía no está configurado para esta propiedad; al conectarlo, Habitación Llena determinará automáticamente la clase de comprobante."}
  if(recipientCondition==="cliente_exterior"&&rule.receiptClass==="B")return{title:`Factura ${rule.receiptClass} · ${vat}`,detail:"Para una estadía en Argentina corresponde B en el flujo general. La Factura T se usa sólo cuando el turista extranjero y el medio de pago cumplen el régimen específico de alojamiento."}
  return{title:`Factura ${rule.receiptClass} · ${vat}`,detail:"La clase se determina automáticamente por la condición fiscal del emisor y del receptor."}
}
