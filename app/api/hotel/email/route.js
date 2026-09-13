import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function money(value,currency="ARS"){
  const n=Number(value||0)
  return currency==="USD"?`US$ ${n.toLocaleString("es-AR",{maximumFractionDigits:2})}`:`$ ${n.toLocaleString("es-AR",{maximumFractionDigits:2})}`
}
function roomingText(details=[]){
  const rows=Array.isArray(details)?details:[]
  if(!rows.length)return"Sin configuración de camas informada"
  return rows.map(row=>{const rooming=row?.rooming||{},parts=[];if(Number(rooming.matrimonial)>0)parts.push(`${rooming.matrimonial} matrimonial${Number(rooming.matrimonial)===1?"":"es"}`);if(Number(rooming.individual)>0)parts.push(`${rooming.individual} individual${Number(rooming.individual)===1?"":"es"}`);return`${row?.categoria_vendida||row?.categoria_asignada||"Habitación"}${row?.nombre?` (${row.nombre})`:""}: ${parts.join(" + ")||"sin preferencia"}`}).join(" · ")
}
function chargeText(rule,currency="ARS"){
  const type=rule?.charge_type||"none",value=Math.max(0,Number(rule?.value)||0)
  if(type==="fixed")return money(value,currency)
  if(type==="percent")return`${value}% del total`
  if(type==="nights")return`${value} noche${value===1?"":"s"}`
  return"Sin cargo"
}
function cancellationLines(policy,currency="ARS"){
  if(!policy||typeof policy!=="object"||!Object.keys(policy).length)return["Política de cancelación: consultar con el hotel."]
  const lines=[`Política de cancelación: ${policy.name||policy.code||"Política asignada"}`]
  if(policy.description)lines.push(policy.description)
  const rules=Array.isArray(policy.cancellation_rules)?[...policy.cancellation_rules].sort((a,b)=>Number(b.min_days_before||0)-Number(a.min_days_before||0)):[]
  for(const rule of rules){const days=Math.max(0,Number(rule.min_days_before)||0);lines.push(days>0?`- Cancelando con ${days} día${days===1?"":"s"} o más de anticipación: ${chargeText(rule,policy.currency||currency)}.`:`- Fuera del plazo gratuito / cancelación tardía: ${chargeText(rule,policy.currency||currency)}.`)}
  lines.push(`- No Show: ${chargeText(policy.no_show_rule,policy.currency||currency)}.`)
  lines.push(`- Checkout anticipado: ${chargeText(policy.early_checkout_rule,policy.currency||currency)}.`)
  if(policy.prepayment_required)lines.push(`- Pago anticipado / seña: ${Math.max(0,Number(policy.prepayment_percent)||0)}%.`)
  return lines
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]))}
function textToHtml(value){return String(value||"").split(/\n{2,}/).map(block=>`<p>${escapeHtml(block).replace(/\n/g,"<br>")}</p>`).join("")}
function htmlToText(value){return String(value||"").replace(/<br\s*\/?\s*>/gi,"\n").replace(/<\/p>/gi,"\n\n").replace(/<\/div>/gi,"\n").replace(/<li>/gi,"• ").replace(/<\/li>/gi,"\n").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/\n{3,}/g,"\n\n").trim()}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||"").trim())}
function emailOnly(value){const match=String(value||"").match(/<([^<>]+)>/);return String(match?.[1]||value||"").trim()}
function safeName(value){return String(value||"").replace(/[\r\n<>]/g," ").trim().slice(0,120)}
function sameDomain(a,b){const one=emailOnly(a).split("@")[1]?.toLowerCase(),two=emailOnly(b).split("@")[1]?.toLowerCase();return Boolean(one&&two&&one===two)}
function normalizeAttachments(input){
  if(!Array.isArray(input))return[]
  if(input.length>5)throw new Error("Podés adjuntar hasta 5 archivos por correo.")
  let bytes=0
  return input.map((row,index)=>{const filename=safeName(row?.filename||`archivo-${index+1}`),content=String(row?.content||"").replace(/^data:[^;]+;base64,/,""),contentType=String(row?.content_type||"application/octet-stream").slice(0,120);if(!filename||!content)throw new Error("Hay un adjunto vacío o inválido.");if(!/^[A-Za-z0-9+/=\r\n]+$/.test(content))throw new Error(`El adjunto ${filename} no tiene un contenido válido.`);const approx=Math.floor(content.replace(/\s/g,"").length*3/4);if(approx>2*1024*1024)throw new Error(`${filename} supera el límite de 2 MB.`);bytes+=approx;return{filename,content:content.replace(/\s/g,""),content_type:contentType}})
    .map(row=>{if(bytes>3*1024*1024)throw new Error("Los adjuntos no pueden superar 3 MB en total.");return row})
}

export async function POST(request){
  try{
    const authorization=request.headers.get("authorization")
    if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"No estás autenticado."},{status:401})
    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
    const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if(!supabaseUrl||!publishableKey)return NextResponse.json({error:"Falta configuración del servidor."},{status:500})
    const client=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
    const {data:{user},error:userError}=await client.auth.getUser()
    if(userError||!user)return NextResponse.json({error:"La sesión no es válida."},{status:401})
    const body=await request.json().catch(()=>null)
    const reservationId=Number(body?.reservation_id)
    const customSubject=String(body?.subject||"").trim().slice(0,200)
    const customHtml=String(body?.html||"").trim().slice(0,120000)
    const customText=String(body?.text||"").trim().slice(0,40000)
    const requestedFromName=safeName(body?.from_name)
    const requestedFromEmail=String(body?.from_email||"").trim().slice(0,200)
    const attachments=normalizeAttachments(body?.attachments)
    if(!reservationId)return NextResponse.json({error:"Falta la reserva."},{status:400})
    if(requestedFromEmail&&!validEmail(requestedFromEmail))return NextResponse.json({error:"El email del remitente no es válido."},{status:400})

    const {data:r,error}=await client.from("reservas").select("id,property_id,numero_reserva,nombre_huesped,email_huesped,fecha_entrada,fecha_salida,habitacion_id,habitaciones_ids,habitaciones_detalle,precio_total,tarifa_noche,noches,moneda,cantidad_huespedes,regimen,notas,cancellation_policy_id,cancellation_policy_snapshot,impuestos_desglosados,iva_porcentaje,iva_importe,precio_sin_impuestos_nacionales,condicion_iva_huesped").eq("id",reservationId).single()
    if(error||!r)return NextResponse.json({error:error?.message||"Reserva no encontrada."},{status:404})
    if(!r.email_huesped)return NextResponse.json({error:"La reserva no tiene email cargado."},{status:400})

    const [{data:settings},{data:propertySettings},{data:requests}]=await Promise.all([
      client.from("hotel_os_settings").select("hotel_name,motto,operational_settings").eq("property_id",r.property_id).maybeSingle(),
      client.from("property_settings").select("settings").eq("property_id",r.property_id).maybeSingle(),
      client.from("hotel_guest_requests").select("title,detail,status,created_at").eq("property_id",r.property_id).eq("reservation_id",r.id).order("created_at",{ascending:true}),
    ])
    const hotel=settings?.hotel_name||"Habitación Llena"
    const ops=settings?.operational_settings&&typeof settings.operational_settings==="object"?settings.operational_settings:{}
    const storedMail=propertySettings?.settings?.email||{}
    const defaultSubject=`${hotel} · Reserva ${r.numero_reserva||r.id}`
    const details=Array.isArray(r.habitaciones_detalle)?r.habitaciones_detalle:[]
    const roomNames=details.map(row=>row?.nombre).filter(Boolean).join(", ")||String(r.habitacion_id||"Sin asignar")
    const roomTypes=[...new Set(details.map(row=>row?.categoria_vendida||row?.categoria_asignada).filter(Boolean))].join(", ")||"Habitación"
    const requestLines=(requests||[]).filter(row=>row?.detail||row?.title).map(row=>`- ${row.title||"Solicitud"}${row.detail?`: ${row.detail}`:""}`)
    const policy=r.cancellation_policy_snapshot&&typeof r.cancellation_policy_snapshot==="object"?r.cancellation_policy_snapshot:{}
    const textLines=[`Hola ${r.nombre_huesped},`,``,`Confirmamos tu reserva en ${hotel}.`,``,`Número de reserva: ${r.numero_reserva||r.id}`,`Entrada: ${r.fecha_entrada}`,`Salida: ${r.fecha_salida}`,`Noches: ${r.noches||"—"}`,`Pasajeros: ${r.cantidad_huespedes||1}`,`Habitación: ${roomTypes} · ${roomNames}`,`Camas / rooming: ${roomingText(details)}`,`Régimen: ${r.regimen||"Alojamiento"}`]
    if(r.impuestos_desglosados)textLines.push(`Tarifa por noche (sin impuestos): ${money(r.tarifa_noche,r.moneda)}`,`Precio sin impuestos nacionales: ${money(r.precio_sin_impuestos_nacionales,r.moneda)}`,`IVA ${Number(r.iva_porcentaje||0)}%: ${money(r.iva_importe,r.moneda)}`,`Total de la reserva: ${money(r.precio_total,r.moneda)}`)
    else textLines.push(`Tarifa por noche: ${money(r.tarifa_noche,r.moneda)}`,`Total de la reserva: ${money(r.precio_total,r.moneda)}`)
    if(requestLines.length)textLines.push("","Solicitudes del huésped:",...requestLines)
    textLines.push("",...cancellationLines(policy,r.moneda))
    if(settings?.motto)textLines.push("",settings.motto)
    const defaultText=textLines.join("\n")
    const subject=customSubject||defaultSubject
    const html=customHtml||textToHtml(customText||defaultText)
    const text=customText||htmlToText(customHtml)||defaultText
    if(!subject||!text)return NextResponse.json({error:"Completá asunto y mensaje antes de enviar."},{status:400})

    const configuredFrom=process.env.HOTEL_EMAIL_FROM||""
    const storedFrom=storedMail.sender_email||ops?.email?.from_email||""
    const chosenReply=requestedFromEmail||storedMail.reply_to||ops?.email?.reply_to||process.env.HOTEL_EMAIL_REPLY_TO||""
    const senderName=requestedFromName||storedMail.sender_name||ops?.email?.from_name||hotel
    let actualFrom=configuredFrom
    if(configuredFrom&&requestedFromEmail&&sameDomain(configuredFrom,requestedFromEmail))actualFrom=`${senderName} <${requestedFromEmail}>`
    else if(configuredFrom&&storedFrom&&sameDomain(configuredFrom,storedFrom))actualFrom=`${senderName} <${storedFrom}>`
    else if(configuredFrom&&emailOnly(configuredFrom)===configuredFrom)actualFrom=`${senderName} <${configuredFrom}>`

    const mailto=`mailto:${encodeURIComponent(r.email_huesped)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
    if(ops?.email?.mode==="mailto"||!process.env.RESEND_API_KEY||!actualFrom){
      if(attachments.length)return NextResponse.json({error:"Para enviar archivos adjuntos hay que tener configurado el proveedor de correo del alojamiento. Sin proveedor sólo se puede abrir el correo del dispositivo."},{status:503})
      return NextResponse.json({mode:"mailto",mailto,reason:"provider_not_configured"})
    }

    const resendAttachments=attachments.map(row=>({filename:row.filename,content:row.content,content_type:row.content_type}))
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:actualFrom,to:[r.email_huesped],subject,text,html,reply_to:validEmail(chosenReply)?chosenReply:undefined,attachments:resendAttachments.length?resendAttachments:undefined})})
    const result=await response.json().catch(()=>({}))
    if(!response.ok)return NextResponse.json({error:result?.message||`El proveedor de correo respondió ${response.status}.`},{status:502})

    await client.from("reservas").update({email_resumen_enviado_at:new Date().toISOString()}).eq("id",r.id).eq("property_id",r.property_id)
    await client.from("hotel_reservation_messages").insert({property_id:r.property_id,reservation_id:r.id,channel:"email",status:"sent",recipient:r.email_huesped,subject,body:text,metadata:{provider:"resend",provider_id:result?.id||null,from_name:senderName,from_email:requestedFromEmail||storedFrom||emailOnly(configuredFrom),attachments:attachments.map(row=>({filename:row.filename,content_type:row.content_type}))},created_by:user.id})
    return NextResponse.json({mode:"sent",id:result?.id||null})
  }catch(error){return NextResponse.json({error:error?.message||"No se pudo enviar el email."},{status:500})}
}
