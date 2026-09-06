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
    if(!reservationId)return NextResponse.json({error:"Falta la reserva."},{status:400})
    const {data:r,error}=await client.from("reservas").select("id,property_id,numero_reserva,nombre_huesped,email_huesped,fecha_entrada,fecha_salida,habitacion_id,habitaciones_ids,habitaciones_detalle,precio_total,tarifa_noche,noches,moneda,cantidad_huespedes,regimen,notas,cancellation_policy_id,cancellation_policy_snapshot").eq("id",reservationId).single()
    if(error||!r)return NextResponse.json({error:error?.message||"Reserva no encontrada."},{status:404})
    if(!r.email_huesped)return NextResponse.json({error:"La reserva no tiene email cargado."},{status:400})
    const [{data:settings},{data:requests}]=await Promise.all([
      client.from("hotel_os_settings").select("hotel_name,motto,operational_settings").eq("property_id",r.property_id).maybeSingle(),
      client.from("hotel_guest_requests").select("title,detail,status,created_at").eq("property_id",r.property_id).eq("reservation_id",r.id).order("created_at",{ascending:true}),
    ])
    const hotel=settings?.hotel_name||"Habitación Llena"
    const ops=settings?.operational_settings&&typeof settings.operational_settings==="object"?settings.operational_settings:{}
    const subject=`${hotel} · Reserva ${r.numero_reserva||r.id}`
    const details=Array.isArray(r.habitaciones_detalle)?r.habitaciones_detalle:[]
    const roomNames=details.map(row=>row?.nombre).filter(Boolean).join(", ")||String(r.habitacion_id||"Sin asignar")
    const roomTypes=[...new Set(details.map(row=>row?.categoria_vendida||row?.categoria_asignada).filter(Boolean))].join(", ")||"Habitación"
    const requestLines=(requests||[]).filter(row=>row?.detail||row?.title).map(row=>`- ${row.title||"Solicitud"}${row.detail?`: ${row.detail}`:""}`)
    const policy=r.cancellation_policy_snapshot&&typeof r.cancellation_policy_snapshot==="object"?r.cancellation_policy_snapshot:{}
    const textLines=[
      `Hola ${r.nombre_huesped},`,``,
      `Confirmamos tu reserva en ${hotel}.`,``,
      `Número de reserva: ${r.numero_reserva||r.id}`,
      `Entrada: ${r.fecha_entrada}`,
      `Salida: ${r.fecha_salida}`,
      `Noches: ${r.noches||"—"}`,
      `Pasajeros: ${r.cantidad_huespedes||1}`,
      `Habitación: ${roomTypes} · ${roomNames}`,
      `Camas / rooming: ${roomingText(details)}`,
      `Régimen: ${r.regimen||"Alojamiento"}`,
      `Tarifa por noche: ${money(r.tarifa_noche,r.moneda)}`,
      `Total de la reserva: ${money(r.precio_total,r.moneda)}`,
    ]
    if(requestLines.length)textLines.push("","Solicitudes del huésped:",...requestLines)
    textLines.push("",...cancellationLines(policy,r.moneda))
    if(settings?.motto)textLines.push("",settings.motto)
    const text=textLines.join("\n")
    const mailto=`mailto:${encodeURIComponent(r.email_huesped)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
    if(ops?.email?.mode==="mailto"||!process.env.RESEND_API_KEY||!process.env.HOTEL_EMAIL_FROM){
      return NextResponse.json({mode:"mailto",mailto,reason:"provider_not_configured"})
    }
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.HOTEL_EMAIL_FROM,to:[r.email_huesped],subject,text,reply_to:process.env.HOTEL_EMAIL_REPLY_TO||undefined})})
    const result=await response.json().catch(()=>({}))
    if(!response.ok)return NextResponse.json({mode:"mailto",mailto,error:result?.message||`Proveedor respondió ${response.status}`},{status:200})
    await client.from("reservas").update({email_resumen_enviado_at:new Date().toISOString()}).eq("id",r.id).eq("property_id",r.property_id)
    return NextResponse.json({mode:"sent",id:result?.id||null})
  }catch(error){
    return NextResponse.json({error:error?.message||"No se pudo enviar la confirmación."},{status:500})
  }
}
