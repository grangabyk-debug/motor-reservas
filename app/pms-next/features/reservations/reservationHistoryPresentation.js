const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".",""):"—"
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const commercialRate=(value,payload,reservation,key)=>{const stored=Number(payload?.[key]);if(Number.isFinite(stored))return stored;const net=Number(value)||0,vat=Math.max(0,Number(reservation?.iva_porcentaje)||0);return reservation?.impuestos_desglosados?net*(1+vat/100):net}

export default function historyPresentation(event,fallbackCurrency="ARS",reservation=null){
  const payload=event?.payload||{},currency=payload.after_currency||payload.before_currency||payload.currency||fallbackCurrency||"ARS"
  if(payload.invalidated===true||payload.correction===true||payload.repair===true)return{title:event?.title||"Corrección de cuenta",detail:event?.detail||"Se corrigió un cálculo anterior de la reserva."}
  if(event?.event_type==="room"&&payload.mid_stay_split===true){
    const prefix=String(event?.detail||"Cambio de habitación").split(" · tarifa")[0]
    if(payload.reprice===false)return{title:event?.title||"Cambio de habitación durante la estadía",detail:`${prefix} · tarifa original mantenida`}
    const before=commercialRate(payload.before_rate,payload,reservation,"before_commercial_rate"),after=commercialRate(payload.after_rate,payload,reservation,"after_commercial_rate")
    return{title:event?.title||"Cambio de habitación durante la estadía",detail:`${prefix} · tarifa comercial ${money(before,currency)} → ${money(after,currency)} por noche`}
  }
  if(event?.event_type==="account"&&payload.before_rate!=null&&payload.after_rate!=null){
    const beforeRate=Number(payload.before_rate)||0,afterRate=Number(payload.after_rate)||0,beforeTotal=Number(payload.before_total)||0,afterTotal=Number(payload.after_total)||0
    if(afterRate===beforeRate){
      const delta=Math.abs(afterTotal-beforeTotal),late=Math.max(0,Number(reservation?.late_checkout_importe)||0),early=Math.max(0,Number(reservation?.early_checkin_importe)||0),same=(a,b)=>Math.abs(a-b)<.02
      const service=late>0&&same(delta,late)?" · Late check-out":early>0&&same(delta,early)?" · Early check-in":""
      return{title:`Cambio de tarifa${service}`,detail:`Tarifa ${money(beforeRate,currency)} → ${money(afterRate,currency)} por noche · Total ${money(beforeTotal,currency)} → ${money(afterTotal,currency)}`}
    }
    const movement=afterRate>beforeRate?"Upgrade":"Downgrade"
    return{title:`${afterRate>beforeRate?"↑ ":"↓ "}${movement} de tarifa`,detail:`Tarifa ${money(beforeRate,currency)} → ${money(afterRate,currency)} por noche · Total ${money(beforeTotal,currency)} → ${money(afterTotal,currency)}`}
  }
  if(event?.event_type==="room"&&payload.before_room_id!=null&&payload.after_room_id!=null)return{title:"Cambio de habitación",detail:`Habitación ${payload.before_room_id} → ${payload.after_room_id}`}
  if(event?.event_type==="stay"&&(payload.before_start||payload.after_start)){const before=`${fmtDate(payload.before_start)} → ${fmtDate(payload.before_end)}`,after=`${fmtDate(payload.after_start)} → ${fmtDate(payload.after_end)}`;return{title:"Estadía modificada",detail:`${before} · ahora ${after}`}}
  return{title:event?.title||event?.event_type||"Movimiento de reserva",detail:event?.detail||"Cambio registrado en la reserva."}
}
