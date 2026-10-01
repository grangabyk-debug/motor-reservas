const clean=value=>String(value||"").trim()
const normalize=value=>clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ")
const invalid=new Set(["anulado","cancelado","void","rechazado","cancelled"])

export function paymentOriginCharges(payment){
  const note=clean(payment?.nota)
  const marker=note.match(/Cargos:\s*(.+)$/i)?.[1]||""
  return marker?marker.split(/\s+\+\s+/).map(clean).filter(Boolean):[]
}

export function paymentApplicationsByItem({items=[],allocations=[],payments=[]}={}){
  const itemById=new Map(items.map(item=>[String(item.id),item]))
  const paymentById=new Map(payments.filter(payment=>!invalid.has(normalize(payment?.estado))).map(payment=>[Number(payment.id),payment]))
  const voidNames=new Set(items.filter(item=>normalize(item?.status)==="void").map(item=>normalize(item?.description)).filter(Boolean))
  const result=new Map()
  for(const allocation of allocations||[]){
    const payment=paymentById.get(Number(allocation.payment_id)),item=itemById.get(String(allocation.folio_item_id))
    if(!payment||!item)continue
    const origins=paymentOriginCharges(payment),current=clean(item.description),currentKey=normalize(current),originMatches=origins.some(origin=>normalize(origin)===currentKey)
    const differentOrigin=origins.length>0&&!originMatches
    const originalVoided=differentOrigin&&origins.some(origin=>voidNames.has(normalize(origin)))
    const entry={
      paymentId:Number(payment.id),method:clean(payment.metodo)||"Pago",amount:Number(allocation.amount)||0,currency:clean(payment.moneda)||clean(item.currency)||"ARS",
      createdAt:payment.created_at||"",currentCharge:current,originCharges:origins,note:clean(payment.nota),differentOrigin,originalVoided,
      label:differentOrigin?(originalVoided?"Crédito reaplicado desde un cargo anulado":"Pago reaplicado a otro cargo"):"Pago aplicado a este cargo"
    }
    const key=String(item.id);if(!result.has(key))result.set(key,[]);result.get(key).push(entry)
  }
  return result
}

export function paymentApplicationSummary(entry){
  if(!entry)return""
  if(entry.differentOrigin){
    const origin=entry.originCharges.join(" + ")||"otro cargo"
    return entry.originalVoided?"Originalmente cobrado para "+origin+". Ese cargo fue anulado y el importe quedó como crédito aplicado aquí.":"Originalmente cobrado para "+origin+"; actualmente está aplicado a este cargo."
  }
  return entry.currentCharge?"Aplicado a "+entry.currentCharge+".":"Aplicado a este cargo."
}
