import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"
import{money,shortDate}from"../core/formatters"

const DEFAULT_TEMPLATES=[
  {code:"payment_request",name:"Petición de pago",sort_order:10,body:"Hola {{guest_first}}, te escribimos de {{hotel}} por tu reserva {{reservation}}. Queda un saldo pendiente de {{balance}}. Si necesitás coordinar el pago, respondé este mensaje y te ayudamos."},
  {code:"confirmation",name:"Confirmación de reserva",sort_order:20,body:"Hola {{guest_first}}. Tu reserva {{reservation}} en {{hotel}} está confirmada del {{arrival_date}} al {{departure_date}}. Habitación: {{room}}. Te esperamos."},
  {code:"pre_checkin",name:"Pre check-in",sort_order:30,body:"Hola {{guest_first}}. Para agilizar tu llegada a {{hotel}}, podés completar el pre check-in desde este enlace: {{web_checkin_url}}. Reserva {{reservation}}."},
  {code:"arrival_day",name:"Mensaje día de llegada",sort_order:40,body:"Hola {{guest_first}}, hoy te esperamos en {{hotel}}. Tu llegada está prevista para las {{arrival_time}}. Reserva {{reservation}} · {{room}}. Si cambia tu horario, avisarnos por acá nos ayuda mucho."},
  {code:"during_stay",name:"Durante la estadía",sort_order:50,body:"Hola {{guest_first}}. Esperamos que estés disfrutando tu estadía en {{hotel}}. Si necesitás algo para la habitación o querés consultarnos por servicios y experiencias, escribinos por acá."},
  {code:"checkout_reminder",name:"Recordatorio de salida",sort_order:60,body:"Hola {{guest_first}}. Te recordamos que el check-out de tu reserva {{reservation}} es el {{departure_date}} a las {{departure_time}}. {{balance_line}} Si necesitás coordinar late check-out, consultanos disponibilidad."}
]

export async function loadMessageTemplates({propertyId,userId}){
  const property=requirePropertyId(propertyId)
  let{data,error}=await supabase.from("hotel_message_templates").select("*").eq("property_id",property).eq("enabled",true).order("sort_order").order("name")
  if(error)throw error
  if(data?.length)return data
  const rows=DEFAULT_TEMPLATES.map(item=>({...item,property_id:property,channel:"whatsapp",is_system:true,created_by:userId||null}))
  const{error:insertError}=await supabase.from("hotel_message_templates").upsert(rows,{onConflict:"property_id,code,channel"})
  if(insertError)throw insertError
  const{data:created,error:readError}=await supabase.from("hotel_message_templates").select("*").eq("property_id",property).eq("enabled",true).order("sort_order").order("name")
  if(readError)throw readError
  return created||[]
}

export async function saveMessageTemplate({propertyId,userId,draft}){
  const property=requirePropertyId(propertyId),row={property_id:property,code:String(draft.code||"custom").trim().toLowerCase().replace(/[^a-z0-9_]+/g,"_")||"custom",name:String(draft.name||"").trim(),channel:draft.channel||"whatsapp",subject:draft.subject||null,body:String(draft.body||"").trim(),enabled:draft.enabled!==false,sort_order:Number(draft.sort_order||100),is_system:false,created_by:draft.created_by||userId||null,updated_at:new Date().toISOString()}
  if(!row.name||!row.body)throw new Error("La plantilla necesita nombre y mensaje.")
  const query=draft.id?supabase.from("hotel_message_templates").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("hotel_message_templates").insert(row)
  const{error}=await query;if(error)throw error
}

const firstName=value=>String(value||"").trim().split(/\s+/)[0]||""
const safe=value=>value==null?"":String(value)
export function templateContext({draft,original,room,hotelName,balance=0,webCheckinUrl=""}){
  const currency=draft?.currency||original?.moneda||"ARS",reservation=original?.numero_reserva||original?.codigo_canal||draft?.id||"",pending=Math.max(0,Number(balance||0))
  return{
    guest:safe(draft?.guest||original?.nombre_huesped),
    guest_first:firstName(draft?.guest||original?.nombre_huesped),
    hotel:safe(hotelName||"el hotel"),
    reservation:safe(reservation),
    room:safe(room?.nombre||original?.habitacion_id||"a confirmar"),
    arrival_date:draft?.start?shortDate(draft.start):safe(original?.fecha_entrada),
    departure_date:draft?.end?shortDate(draft.end):safe(original?.fecha_salida),
    arrival_time:safe(draft?.arrivalTime||original?.hora_llegada_estimada||"14:00"),
    departure_time:safe(draft?.departureTime||original?.hora_salida_estimada||"10:00"),
    balance:money(pending,currency),
    balance_line:pending>.01?`Queda un saldo pendiente de ${money(pending,currency)}.`:"La cuenta no registra saldo pendiente.",
    web_checkin_url:safe(webCheckinUrl)
  }
}

export function renderMessageTemplate(template,context={}){
  const apply=value=>String(value||"").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi,(_,key)=>safe(context[key]))
  return{subject:apply(template?.subject||""),body:apply(template?.body||"").replace(/\s+([.,;:!?])/g,"$1").replace(/\n{3,}/g,"\n\n").trim()}
}

export async function logReservationMessage({propertyId,userId,reservationId,templateId=null,channel="whatsapp",status="opened",recipient="",subject="",body,metadata={}}){
  if(!reservationId||!body)return
  const{error}=await supabase.from("hotel_reservation_messages").insert({property_id:requirePropertyId(propertyId),reservation_id:Number(reservationId),template_id:templateId||null,channel,status,recipient:recipient||null,subject:subject||null,body,metadata,created_by:userId||null})
  if(error)throw error
}

export function whatsappUrl(phone,body=""){
  const digits=String(phone||"").replace(/\D/g,"")
  if(!digits)return""
  return`https://wa.me/${digits}${body?`?text=${encodeURIComponent(body)}`:""}`
}

export function emailUrl(email,subject="",body=""){
  const to=String(email||"").trim();if(!to)return""
  const params=new URLSearchParams();if(subject)params.set("subject",subject);if(body)params.set("body",body)
  return`mailto:${encodeURIComponent(to)}${params.toString()?`?${params.toString()}`:""}`
}
