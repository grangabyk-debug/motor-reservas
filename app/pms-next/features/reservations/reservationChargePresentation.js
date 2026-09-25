const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".",""):"—"
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)

export default function serviceLines(item,room,rooms=[]){
  const lines=[],assigned=rooms.length?rooms:[room].filter(Boolean),taxEnabled=Boolean(item.impuestos_desglosados),vatRate=taxEnabled?Math.max(0,Number(item.iva_porcentaje)||0):0,gross=value=>{const amount=Number(value)||0;return taxEnabled?Math.round(amount*(1+vatRate/100)*100)/100:amount}
  const nights=Math.max(1,Number(item.noches)||Math.round((new Date(`${item.fecha_salida}T12:00:00`)-new Date(`${item.fecha_entrada}T12:00:00`))/86400000)||1)
  const stayAmount=Number(item.tarifa_noche||0)*nights||Number(item.subtotal||item.precio_sin_impuestos_nacionales||item.precio_total||0)
  const details=Array.isArray(item.habitaciones_detalle)?item.habitaciones_detalle:[]
  const segmented=details.filter(detail=>detail?.habitacion_id&&detail?.fecha_entrada&&detail?.fecha_salida&&Number(detail?.tarifa_noche)>=0&&String(detail?.segment_role||"").toLowerCase()!=="transient_room")
  if(segmented.length){
    segmented.forEach((detail,index)=>{
      const segmentNights=Math.max(1,Math.round((new Date(`${detail.fecha_salida}T12:00:00`)-new Date(`${detail.fecha_entrada}T12:00:00`))/86400000)||1)
      const amount=Number(detail.tarifa_noche||0)*segmentNights
      lines.push({key:`stay-segment-${detail.habitacion_id}-${index}`,title:`Alojamiento · Habitación ${detail.nombre||detail.habitacion_id}`,meta:`${item.regimen||"Alojamiento"} · ${segmentNights} noche${segmentNights===1?"":"s"} · ${taxEnabled?`Precio final · IVA ${vatRate}% incluido`:"Precio"}`,detail:`${fmtDate(detail.fecha_entrada)} → ${fmtDate(detail.fecha_salida)}${detail.segment_role==="previous_room"?" · tramo anterior":" · habitación actual"}`,amount,displayAmount:gross(amount)})
    })
  }else if(assigned.length>1)lines.push({key:"stay",title:`Alojamiento grupal · ${assigned.length} habitaciones`,meta:`${item.regimen||"Alojamiento"} · ${nights} noche${nights===1?"":"s"}`,detail:`${assigned.map(item=>item.nombre).join(", ")} · ${fmtDate(item.fecha_entrada)} al ${fmtDate(item.fecha_salida)}`,amount:stayAmount,displayAmount:gross(stayAmount)})
  else lines.push({key:"stay",title:`${room?.tipo||"Habitación"} ${room?.nombre||""}`.trim(),meta:`${item.regimen||"Alojamiento"} · ${nights} noche${nights===1?"":"s"}`,detail:`Estadía del ${fmtDate(item.fecha_entrada)} al ${fmtDate(item.fecha_salida)}`,amount:stayAmount,displayAmount:gross(stayAmount)})
  const services=(Array.isArray(item.servicios)?item.servicios:[]).map((service,index)=>({service,index})).sort((a,b)=>{const at=Date.parse(a.service?.created_at||"")||0,bt=Date.parse(b.service?.created_at||"")||0;return at-bt||a.index-b.index}).map(row=>row.service)
  services.forEach((service,index)=>{const qty=Number(service?.cantidad||service?.qty||1)||1,unit=Number(service?.precio||service?.price||service?.importe||0),total=Number(service?.total||service?.precio_total||unit*qty),chargedNights=Number(service?.noches||0),metaParts=[];if(qty>1)metaParts.push(`${qty} unidades`);if(chargedNights>0)metaParts.push(`${chargedNights} noche${chargedNights===1?"":"s"}`);lines.push({key:`service-${service?.id||index}`,title:service?.nombre||service?.name||service?.descripcion||"Servicio",meta:metaParts.join(" · ")||"Servicio",detail:service?.detalle||service?.detail||"",amount:total,displayAmount:Number(service?.total_final??gross(total))})})
  if(Number(item.cochera_total)>0)lines.push({key:"parking",title:"Cochera",meta:taxEnabled?`Adicional · Precio final · IVA ${vatRate}% incluido`:"Adicional de estadía",detail:"",amount:Number(item.cochera_total),displayAmount:gross(Number(item.cochera_total))})
  if(Number(item.mascotas_total)>0)lines.push({key:"pets",title:"Mascotas",meta:taxEnabled?`Adicional · Precio final · IVA ${vatRate}% incluido`:"Adicional de estadía",detail:"",amount:Number(item.mascotas_total),displayAmount:gross(Number(item.mascotas_total))})
  if(Number(item.early_checkin_importe)>0)lines.push({key:"early",title:"Early check-in",meta:taxEnabled?`Servicio adicional · Precio final · IVA ${vatRate}% incluido`:"Servicio adicional",detail:"",amount:Number(item.early_checkin_importe),displayAmount:gross(Number(item.early_checkin_importe))})
  if(Number(item.late_checkout_importe)>0)lines.push({key:"late",title:"Late check-out",meta:taxEnabled?`Servicio adicional · Precio final · IVA ${vatRate}% incluido`:"Servicio adicional",detail:"",amount:Number(item.late_checkout_importe),displayAmount:gross(Number(item.late_checkout_importe))})
  if(Number(item.extra)>0)lines.push({key:"extra",title:item.extra_descripcion||"Extra",meta:taxEnabled?`Cargo adicional · Precio final · IVA ${vatRate}% incluido`:"Cargo adicional",detail:"",amount:Number(item.extra),displayAmount:gross(Number(item.extra))})
  const discountAmount=Math.max(0,Number(item.descuento_importe)||0)
  if(discountAmount>0){
    const type=String(item.descuento_tipo||"").toLowerCase(),value=Math.max(0,Number(item.descuento_valor)||0),isPercent=type==="percent"||type==="porcentaje"
    const reason=String(item.descuento_motivo||"").trim()||"Motivo no documentado"
    const origin=String(item.descuento_origen||"manual").toLowerCase(),originLabel=origin==="rule"?"Regla configurada":origin==="promotion"?"Promoción configurada":origin==="package"?"Paquete":origin==="channel"?"Canal":"Ingresado manualmente"
    lines.push({key:"discount",kind:"discount",title:isPercent&&value>0?`Descuento ${value}%`:"Descuento aplicado",meta:`${originLabel} · −${money(discountAmount,item.moneda)}`,detail:reason,amount:-discountAmount})
  }
  return lines
}
