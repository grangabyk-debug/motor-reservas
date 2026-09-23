export const RECIPIENT_IVA_CONDITIONS=[
  ["consumidor_final","Consumidor final",5],
  ["responsable_inscripto","Responsable inscripto",1],
  ["monotributo","Monotributo",6],
  ["exento","Exento",4],
  ["cliente_exterior","Cliente del exterior",9],
  ["no_categorizado","No categorizado",7],
  ["no_alcanzado","IVA no alcanzado",15],
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

export function shouldDiscriminateVat(issuerCondition,recipientCondition){
  const rule=receiptRule(issuerCondition,recipientCondition)
  return ["A","B"].includes(rule.receiptClass)
}

export function invoiceVatRate({reservation,taxConfig,issuerCondition}){
  if(["monotributo","exento"].includes(String(issuerCondition||"").toLowerCase()))return 0
  const stored=Math.max(0,Number(reservation?.iva_porcentaje)||0)
  if(reservation?.impuestos_desglosados&&stored>0)return stored
  return taxConfig?.enabled!==false?Math.max(0,Number(taxConfig?.rate??21)||0):0
}

export function fiscalRecipientNote(issuerCondition,recipientCondition,rate){
  const rule=receiptRule(issuerCondition,recipientCondition)
  const rateLabel=Number(rate).toLocaleString("es-AR",{maximumFractionDigits:2})
  const discriminates=shouldDiscriminateVat(issuerCondition,recipientCondition)
  if(!rule.receiptClass){
    return{title:Number(rate)>0?`IVA ${rateLabel}% configurado`:"Sin IVA",detail:"ARCA todavía no está configurado para esta propiedad; al conectarlo, Habitación Llena determinará automáticamente la clase de comprobante y su presentación fiscal."}
  }
  if(rule.receiptClass==="A"){
    const monotributo=String(recipientCondition||"").toLowerCase()==="monotributo"
    return{title:`Factura A · IVA ${rateLabel}% discriminado`,detail:monotributo?"El sistema discrimina el IVA y al emitir deberá incluir la leyenda ARCA correspondiente a operaciones con Monotributistas.":"El precio neto y el IVA se muestran separados automáticamente."}
  }
  if(rule.receiptClass==="B"){
    const exterior=String(recipientCondition||"").toLowerCase()==="cliente_exterior"
    return{title:`Factura B · IVA ${rateLabel}% discriminado`,detail:exterior?"Para alojamiento en Argentina se usa B en el flujo general. La Factura T sólo corresponde si se cumplen las condiciones específicas para turistas extranjeros y medio de pago admitido.":"ARCA determina clase B para Consumidor Final, Exento, No alcanzado y No categorizado; desde el régimen de transparencia fiscal el IVA de operaciones gravadas se muestra discriminado."}
  }
  return{title:"Factura C · sin IVA discriminado",detail:"La condición fiscal del emisor determina automáticamente la clase C."}
}
