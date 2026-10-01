import{allocatedPhysicalAmount,paymentCurrency,validPayment}from"./reservationPaymentInvoiceUtils"

export function deriveBillingRowsPaymentSnapshot({rows=[],total=0,currency="ARS",payments=[]}={}){
  const invoiceCurrency=String(currency||"ARS").toUpperCase(),paymentById=new Map((payments||[]).filter(validPayment).map(row=>[Number(row.id),row]))
  let remaining=Math.max(0,Number(total)||0),covered=0
  const methods=[]
  for(const row of rows){
    for(const part of row?.payment_parts||[]){
      if(remaining<=.009)break
      const payment=paymentById.get(Number(part.payment_id))
      if(!payment)continue
      const receivedCurrency=paymentCurrency(payment),receivedAmount=allocatedPhysicalAmount(payment,part.amount),available=receivedCurrency===invoiceCurrency?receivedAmount:Math.max(0,Number(part.amount)||0),applied=Math.min(remaining,available)
      if(applied<=.009)continue
      covered+=applied;remaining-=applied
      methods.push({payment_id:Number(payment.id),method:payment.metodo||"Pago",amount:applied,currency:invoiceCurrency,received_amount:receivedAmount,received_currency:receivedCurrency,reference:payment.referencia||null,created_at:payment.created_at||null})
    }
  }
  const labels=[...new Set(methods.map(row=>row.method).filter(Boolean))]
  return{sale_condition:remaining<=.02?"contado":"cuenta_corriente",payment_methods:methods,payment_method_label:labels.join(" + ")||null,payment_covered:covered,payment_pending:Math.max(0,remaining)}
}
