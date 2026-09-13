const INVALID=new Set(["anulado","cancelado","void","rechazado","cancelled"])
export const normalize=value=>String(value||"").trim().toLowerCase()
export const validPayment=row=>!INVALID.has(normalize(row?.estado))
export const roundMoney=value=>Math.round((Number(value)||0)*100)/100
export const paidTotal=rows=>(rows||[]).filter(validPayment).reduce((sum,row)=>sum+Math.max(0,Number(row.monto||0)-Number(row.refunded_amount||0)),0)

export function buildChargeLines(items=[],allocations=[],payments=[],reservationTotal=0){
  const validIds=new Set((payments||[]).filter(validPayment).map(row=>Number(row.id)))
  const paidByItem=new Map()
  for(const row of allocations||[]){
    if(!validIds.has(Number(row.payment_id)))continue
    const id=String(row.folio_item_id||"")
    paidByItem.set(id,roundMoney((paidByItem.get(id)||0)+Math.max(0,Number(row.amount)||0)))
  }
  const explicitTotal=[...paidByItem.values()].reduce((sum,value)=>sum+value,0)
  let legacyPaid=Math.max(0,roundMoney(paidTotal(payments)-explicitTotal))
  const active=(items||[]).filter(row=>row&&row.status==="active")
  let discount=Math.abs(active.filter(row=>Number(row.total)<0).reduce((sum,row)=>sum+Number(row.total||0),0))
  const lines=[]
  for(const item of active){
    const raw=Math.max(0,Number(item.total)||0)
    if(raw<=.009)continue
    const reduction=Math.min(raw,discount);discount=roundMoney(Math.max(0,discount-reduction))
    const amount=roundMoney(raw-reduction)
    if(amount<=.009)continue
    lines.push({id:String(item.id),folioId:item.folio_id,name:item.description||"Cargo",detail:item.detail||item.service_date||"",amount,currency:item.currency||"ARS",sourceType:item.source_type||"charge",createdAt:item.created_at||""})
  }
  const target=Math.max(0,Number(reservationTotal)||0),sum=roundMoney(lines.reduce((acc,line)=>acc+line.amount,0))
  if(lines.length&&Math.abs(target-sum)>.009){const delta=roundMoney(target-sum),last=lines[lines.length-1];if(last.amount+delta>=0)last.amount=roundMoney(last.amount+delta)}
  for(const line of lines){const explicit=Math.min(line.amount,Math.max(0,paidByItem.get(line.id)||0)),afterExplicit=roundMoney(Math.max(0,line.amount-explicit)),inherited=Math.min(afterExplicit,legacyPaid);legacyPaid=roundMoney(Math.max(0,legacyPaid-inherited));line.paid=roundMoney(explicit+inherited);line.remaining=roundMoney(Math.max(0,line.amount-line.paid))}
  return lines
}

export function selectedBalance(lines,selectedIds){return roundMoney((lines||[]).reduce((sum,line)=>selectedIds?.has(String(line.id))?sum+Math.max(0,Number(line.remaining)||0):sum,0))}

export function allocatePaymentParts(lines,selectedIds,partAmounts){
  const remaining=new Map((lines||[]).filter(line=>selectedIds?.has(String(line.id))).map(line=>[String(line.id),Math.max(0,Number(line.remaining)||0)]))
  return(partAmounts||[]).map(raw=>{let left=roundMoney(Math.max(0,Number(raw)||0)),result=[];for(const line of lines||[]){const id=String(line.id);if(!selectedIds?.has(id)||left<=.009)continue;const available=remaining.get(id)||0;if(available<=.009)continue;const take=roundMoney(Math.min(available,left));if(take>.009){result.push({folio_item_id:id,amount:take});remaining.set(id,roundMoney(available-take));left=roundMoney(left-take)}}if(left>.01)throw new Error("El importe supera el saldo de los cargos seleccionados.");return result})
}
