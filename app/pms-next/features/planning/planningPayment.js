export const PAYMENT_STATES=[
  {key:"unpaid",label:"Sin pagar",description:"No hay pagos confirmados en la moneda de la reserva"},
  {key:"partial",label:"Pago parcial",description:"Hay cobros confirmados, pero todavía queda saldo"},
  {key:"paid",label:"Pagada",description:"El total de la reserva está cubierto"},
  {key:"review",label:"Revisar pago",description:"Hay pagos confirmados en otra moneda"},
]

const number=value=>Number.isFinite(Number(value))?Number(value):0

export function paymentState(item){
  const total=Math.max(0,number(item?.precio_total)),paid=Math.max(0,number(item?.payment_paid)),foreign=Math.max(0,number(item?.payment_foreign_count))
  const pct=total>0?Math.max(0,Math.min(100,Math.round(paid/total*100))):paid>0?100:0
  if(foreign>0&&paid<=0)return{key:"review",label:"Revisar pago",paid,total,pct,foreign}
  if(total>0&&paid>=total)return{key:"paid",label:"Pagada",paid,total,pct:100,foreign}
  if(paid>0)return{key:"partial",label:"Pago parcial",paid,total,pct,foreign}
  return{key:"unpaid",label:"Sin pagar",paid:0,total,pct:0,foreign}
}

export function paymentStateLabel(item){return paymentState(item).label}

export function attachPayments(reservations,payments){
  const byReservation=new Map()
  for(const payment of payments||[]){
    if(payment?.estado!=="confirmado"||payment?.reserva_id==null)continue
    const id=Number(payment.reserva_id),current=byReservation.get(id)||{rows:[],latest:null}
    current.rows.push(payment)
    if(!current.latest||String(payment.created_at||"")>String(current.latest.created_at||""))current.latest=payment
    byReservation.set(id,current)
  }
  return(reservations||[]).map(item=>{
    const group=byReservation.get(Number(item.id)),currency=String(item.moneda||"ARS").toUpperCase()
    if(!group)return{...item,payment_paid:0,payment_foreign_count:0,payment_last_id:null,payment_last_at:null}
    let paid=0,foreign=0
    for(const payment of group.rows){
      if(String(payment.moneda||currency).toUpperCase()===currency)paid+=number(payment.monto)
      else foreign++
    }
    return{...item,payment_paid:paid,payment_foreign_count:foreign,payment_last_id:group.latest?.id??null,payment_last_at:group.latest?.created_at??null}
  })
}
