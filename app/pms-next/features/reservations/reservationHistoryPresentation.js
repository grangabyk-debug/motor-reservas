const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".",""):"—"
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const commercialRate=(value,payload,reservation,key)=>{const stored=Number(payload?.[key]);if(Number.isFinite(stored))return stored;const net=Number(value)||0,vat=Math.max(0,Number(reservation?.iva_porcentaje)||0);return reservation?.impuestos_desglosados?net*(1+vat/100):net}
const extensionPlanFinal=(reservation,row)=>{const detail=(Array.isArray(reservation?.habitaciones_detalle)?reservation.habitaciones_detalle:[]).find(x=>Number(x?.habitacion_id)===Number(row?.room_id))||{},from=String(row?.old_end||""),to=String(row?.new_end||""),occ=Array.isArray(detail?.occupancy_nights)?detail.occupancy_nights:[],sum=occ.filter(n=>{const d=String(n?.date||"");return d&&(!from||d>=from)&&(!to||d<to)}).reduce((s,n)=>s+Math.max(0,Number(n?.adjustment_final)||0),0);if(sum>0)return sum;return Math.max(0,Number(detail?.rate_plan_adjustment_final_per_night)||0)*Math.max(0,Number(row?.extra_nights)||0)}

export default function historyPresentation(event,fallbackCurrency="ARS",reservation=null){
  const payload=event?.payload||{},currency=payload.after_currency||payload.before_currency||payload.currency||fallbackCurrency||"ARS"
  if(payload.invalidated===true||payload.correction===true||payload.repair===true)return{title:event?.title||"Corrección de cuenta",detail:event?.detail||"Se corrigió un cálculo anterior de la reserva."}
  if(event?.event_type==="payment_changed"){
    const amount=Number(payload.payment_amount??payload.amount)||0,method=String(payload.method||"Pago"),id=payload.payment_id||"",note=String(payload.note||""),match=note.match(/Cargos:\s*(.+)$/i),applied=match?.[1]?.trim()
    return{title:`Pago · ${method} · ${money(amount,currency)}`,detail:`${id?`Pago #${id}`:"Movimiento de pago"}${applied?` · registrado originalmente para ${applied}`:" · registrado en la cuenta de la reserva"}`}
  }
  if(event?.event_type==="group_room_extension"){
    const extensions=Array.isArray(payload.extensions)?payload.extensions:[],first=extensions[0]||{},rooms=extensions.map(row=>row.room_name||row.room_id).filter(Boolean).join(", "),extra=extensions.reduce((sum,row)=>sum+Math.max(0,Number(row.extra_nights)||0),0),baseFinal=extensions.reduce((sum,row)=>sum+Math.max(0,Number(row.extension_final_total)||0),0),planFinal=extensions.reduce((sum,row)=>sum+extensionPlanFinal(reservation,row),0),extensionFinal=baseFinal+planFinal,lateNet=extensions.reduce((sum,row)=>sum+Math.max(0,Number(row.late_credit_booked)||0),0),lateFinal=commercialRate(lateNet,payload,reservation,"__missing_late_final"),additionalFinal=Math.max(0,extensionFinal-lateFinal)
    const dates=first.old_end&&first.new_end?`${fmtDate(first.old_end)} → ${fmtDate(first.new_end)}`:""
    const amounts=extensionFinal?` · noche completa ${money(extensionFinal,currency)}${planFinal>0?` (alojamiento ${money(baseFinal,currency)} + régimen ${money(planFinal,currency)})`:""}`:""
    const late=lateFinal>0?` · crédito Late −${money(lateFinal,currency)}`:""
    const additional=additionalFinal>0?` · adicional real ${money(additionalFinal,currency)}`:""
    return{title:`Extensión de noches${rooms?` · Hab. ${rooms}`:""}`,detail:`${dates}${extra?` · +${extra} noche${extra===1?"":"s"}`:""}${amounts}${late}${additional}`}
  }
  if(event?.event_type==="extension_discount")return{title:"Descuento aplicado a la extensión",detail:`${Number(payload.discount_percent)||0}% sobre las noches nuevas · −${money(commercialRate(payload.discount_net,payload,reservation,"__missing_discount_final"),currency)}`}
  if(event?.event_type==="group_room_special_stay"){const kind=payload.kind==="early"?"Early check-in":"Late check-out",state=(Array.isArray(payload.states)?payload.states:[]).find(x=>Number(x?.room_id)===Number(payload.room_id))||{},amount=commercialRate(state.net_amount,payload,reservation,"__missing_special_final");return{title:`${kind} · Hab. ${state.room_name||payload.room_id||"—"}`,detail:`${payload.enabled===false?"Quitado":"Recargo aplicado"}${state.percent!=null?` · ${state.percent}% de la tarifa de la noche de ${payload.kind==="early"?"entrada":"salida"}`:""}${amount>0?` · +${money(amount,currency)}`:""}`}}
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
