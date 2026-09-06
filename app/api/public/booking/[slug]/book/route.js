import{createHash}from"node:crypto"
import{createClient}from"@supabase/supabase-js"

function publicClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error("Motor de reservas sin configuración de servidor.");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
const text=(value,max)=>String(value||"").trim().slice(0,max)
function clientKey(request){const ip=(request.headers.get("x-forwarded-for")||request.headers.get("x-real-ip")||"unknown").split(",")[0].trim(),agent=request.headers.get("user-agent")||"";return createHash("sha256").update(`${ip}|${agent}`).digest("hex").slice(0,48)}
function money(value,currency="ARS"){try{return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value)||0)}catch{return `${currency} ${Number(value)||0}`}}
const count=value=>Math.min(8,Math.max(0,Number(value)||0))
const cleanRooming=value=>({matrimonial:count(value?.matrimonial),individual:count(value?.individual)})
const roomingLabel=value=>{const rooming=cleanRooming(value),parts=[];if(rooming.matrimonial)parts.push(`${rooming.matrimonial} matrimonial${rooming.matrimonial===1?"":"es"}`);if(rooming.individual)parts.push(`${rooming.individual} individual${rooming.individual===1?"":"es"}`);return parts.join(" + ")||"Sin preferencia"}
function chargeText(rule,currency="ARS"){const type=rule?.charge_type||"none",value=Math.max(0,Number(rule?.value)||0);if(type==="fixed")return money(value,currency);if(type==="percent")return`${value}% del total`;if(type==="nights")return`${value} noche${value===1?"":"s"}`;return"Sin cargo"}
function policyLines(policy,currency="ARS"){if(!policy||typeof policy!=="object"||!Object.keys(policy).length)return["Política de cancelación: consultar con el hotel."];const lines=[`Política de cancelación: ${policy.name||policy.code||"Política asignada"}`];if(policy.description)lines.push(policy.description);const rules=Array.isArray(policy.cancellation_rules)?[...policy.cancellation_rules].sort((a,b)=>Number(b.min_days_before||0)-Number(a.min_days_before||0)):[];for(const rule of rules){const days=Math.max(0,Number(rule.min_days_before)||0);lines.push(days>0?`- Con ${days} día${days===1?"":"s"} o más antes del check-in: ${chargeText(rule,policy.currency||currency)}.`:`- Cancelación tardía: ${chargeText(rule,policy.currency||currency)}.`)}lines.push(`- No Show: ${chargeText(policy.no_show_rule,policy.currency||currency)}.`,`- Checkout anticipado: ${chargeText(policy.early_checkout_rule,policy.currency||currency)}.`);if(policy.prepayment_required)lines.push(`- Pago anticipado / seña: ${Math.max(0,Number(policy.prepayment_percent)||0)}%.`);return lines}
async function sendConfirmation(client,slug,payload,booking,baseUrl){
  if(!process.env.RESEND_API_KEY||!process.env.HOTEL_EMAIL_FROM||!payload.email||booking?.idempotent_replay)return false
  try{
    const{data:config,error}=await client.rpc("hl_public_booking_config",{p_slug:slug});if(error)throw error
    const hotel=config?.name||"Hotel",subject=`${hotel} · Reserva ${booking.numero_reserva||booking.id}`,currency=booking.currency||config?.currency||"ARS",nights=Math.max(1,Number(booking.nights)||1),nightly=Number(booking.total||0)/nights
    const lines=[`Hola ${payload.name},`,``,`Tu reserva en ${hotel} quedó confirmada.`,``,`Número de reserva: ${booking.numero_reserva||booking.id}`,`Entrada: ${booking.check_in||payload.check_in}`,`Salida: ${booking.check_out||payload.check_out}`,`Noches: ${nights}`,`Pasajeros: ${payload.guests||1}`,`Tipo de habitación: ${booking.room_type||payload.room_type}`,`Camas / rooming: ${roomingLabel(booking.rooming||payload.rooming)}`,`Tarifa promedio por noche: ${money(nightly,currency)}`,`Total: ${money(booking.total,currency)}`]
    lines.push("",...policyLines(booking.cancellation_policy||config?.default_cancellation_policy,currency))
    if(config?.contact_phone||config?.contact_email)lines.push("",`Contacto del hotel: ${[config.contact_phone,config.contact_email].filter(Boolean).join(" · ")}`)
    if(baseUrl&&booking?.manage_token)lines.push("",`Ver o gestionar la reserva: ${baseUrl}/book/${encodeURIComponent(slug)}/manage/${booking.manage_token}`)
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.HOTEL_EMAIL_FROM,to:[payload.email],subject,text:lines.join("\n"),reply_to:config?.contact_email||process.env.HOTEL_EMAIL_REPLY_TO||undefined})})
    return response.ok
  }catch(error){console.error("booking confirmation email",error);return false}
}

export async function POST(request,{params}){
  try{
    const{slug}=await params,raw=await request.json().catch(()=>null);if(!raw)return Response.json({error:"Solicitud inválida."},{status:400})
    const payload={check_in:text(raw.check_in,10),check_out:text(raw.check_out,10),guests:Math.min(20,Math.max(1,Number(raw.guests)||1)),name:text(raw.name,160),email:text(raw.email,180),phone:text(raw.phone,80),rooming:cleanRooming(raw.rooming),room_type:text(raw.room_type,120),request_id:text(raw.request_id,120)}
    if(!payload.name||!payload.room_type||!payload.email)return Response.json({error:"Faltan datos para confirmar la reserva."},{status:400})
    const client=publicClient(),limit=await client.rpc("hl_public_booking_rate_limit",{p_slug:slug,p_client_key:`book:${clientKey(request)}`,p_limit:12,p_window_minutes:15});if(limit.error)throw limit.error
    if(limit.data!==true)return Response.json({error:"Se realizaron demasiados intentos de reserva. Esperá unos minutos y volvé a intentar."},{status:429,headers:{"Retry-After":"300","Cache-Control":"no-store"}})
    const{data,error}=await client.rpc("hl_public_booking_create",{p_slug:slug,p_payload:payload});if(error)throw error
    const email_sent=await sendConfirmation(client,slug,payload,data,new URL(request.url).origin)
    return Response.json({...data,email_sent},{status:data?.idempotent_replay?200:201,headers:{"Cache-Control":"no-store"}})
  }catch(error){
    console.error("public booking create",error)
    const message=String(error?.message||"")
    return Response.json({error:message.includes("acaba de dejar")?"Ese tipo de habitación acaba de agotarse. Volvé a buscar disponibilidad.":message.includes("capacidad")?"La habitación no admite esa cantidad de huéspedes.":"No se pudo confirmar la reserva. Volvé a buscar disponibilidad."},{status:409,headers:{"Cache-Control":"no-store"}})
  }
}
