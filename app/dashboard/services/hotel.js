import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"

const tenant=id=>requirePropertyId(id)

export async function updateMemberRole({propertyId,userId,role}){const{error}=await supabase.from("property_members").update({role}).eq("property_id",tenant(propertyId)).eq("user_id",userId);if(error)throw error}
export async function saveRolePermission({propertyId,role,permission,allowed}){const{error}=await supabase.from("hotel_role_permissions").upsert({property_id:tenant(propertyId),role,permission,allowed:!!allowed,updated_at:new Date().toISOString()},{onConflict:"property_id,role,permission"});if(error)throw error}

export async function saveAutomation({propertyId,userId,draft}){
  const property=tenant(propertyId),row={property_id:property,name:String(draft.name||"").trim(),trigger_code:draft.trigger_code||"reservation_created",action_code:draft.action_code||"frontdesk_alert",trigger_text:draft.trigger_text||null,action_text:draft.action_text||null,enabled:draft.enabled!==false,config:draft.config||{},created_by:userId,updated_at:new Date().toISOString()};if(!row.name)throw new Error("La automatización necesita un nombre.")
  const query=draft.id?supabase.from("hotel_automations").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("hotel_automations").insert(row);const{error}=await query;if(error)throw error
}
export async function toggleAutomation({propertyId,id,enabled}){const{error}=await supabase.from("hotel_automations").update({enabled:!!enabled,updated_at:new Date().toISOString()}).eq("id",id).eq("property_id",tenant(propertyId));if(error)throw error}
export async function deleteAutomation({propertyId,id}){const{error}=await supabase.from("hotel_automations").delete().eq("id",id).eq("property_id",tenant(propertyId));if(error)throw error}
export async function resolveAutomationEvent({propertyId,id}){const{error}=await supabase.from("hotel_automation_events").update({status:"resolved",resolved_at:new Date().toISOString()}).eq("id",id).eq("property_id",tenant(propertyId));if(error)throw error}

export async function saveHotelSettings({propertyId,draft}){
  const property=tenant(propertyId),row={property_id:property,hotel_name:String(draft.hotel_name||"Hotel").trim(),city:String(draft.city||"").trim(),motto:String(draft.motto||"").trim(),welcome_message:String(draft.welcome_message||"").trim(),theme:draft.theme||"olive",logo_data_url:draft.logo_data_url||null,operational_settings:draft.operational_settings||{},updated_at:new Date().toISOString()},{data,error}=await supabase.from("hotel_os_settings").upsert(row,{onConflict:"property_id"}).select("*").single();if(error)throw error;return data
}

export async function prepareKey({propertyId,userId,reservation,room,encoder={},count=2}){
  const property=tenant(propertyId),row={property_id:property,reserva_id:reservation.id,habitacion_id:reservation.habitacion_id,issued_by:userId,guest_name:reservation.nombre_huesped,encoder_provider:encoder.provider||null,encoder_ref:encoder.bridge_url||null,key_count:Math.max(1,Number(count||2)),valid_from:new Date(`${reservation.fecha_entrada}T12:00:00`).toISOString(),valid_until:new Date(`${reservation.fecha_salida}T12:00:00`).toISOString(),status:"prepared",message:encoder.enabled&&encoder.bridge_url?"Preparada para bridge de encoder.":"Encoder físico no conectado."},{data,error}=await supabase.from("hotel_key_issues").insert(row).select("*").single();if(error)throw error
  if(!encoder.enabled||!encoder.bridge_url)return{...data,physical:false}
  try{const response=await fetch(encoder.bridge_url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"encode",reservation_id:reservation.id,room:room?.nombre||reservation.habitacion_id,guest:reservation.nombre_huesped,key_count:row.key_count,valid_from:row.valid_from,valid_until:row.valid_until})}),ok=response.ok,message=response.ok?"Encoder confirmó la operación.":`Bridge respondió ${response.status}`;await supabase.from("hotel_key_issues").update({status:ok?"encoded":"failed",message}).eq("id",data.id).eq("property_id",property);return{...data,status:ok?"encoded":"failed",message,physical:ok}}catch(error){await supabase.from("hotel_key_issues").update({status:"failed",message:error.message}).eq("id",data.id).eq("property_id",property);return{...data,status:"failed",message:error.message,physical:false}}
}
export async function revokeKey({propertyId,id}){const{error}=await supabase.from("hotel_key_issues").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("id",id).eq("property_id",tenant(propertyId));if(error)throw error}

export async function createWebCheckin({propertyId,reservationId,expiresHours=168}){const{data,error}=await supabase.rpc("hl_create_web_checkin_token",{p_property_id:tenant(propertyId),p_reservation_id:Number(reservationId),p_expires_hours:Math.max(1,Math.min(720,Number(expiresHours||168)))});if(error)throw error;return`${location.origin}/check-in/${data}`}

async function sessionToken(refresh=false){const{data}=refresh?await supabase.auth.refreshSession():await supabase.auth.getSession(),session=data?.session;if(!session?.access_token)throw new Error("La sesión expiró.");return session.access_token}

export async function sendReservationEmail({reservationId}){
  const token=await sessionToken(),response=await fetch("/api/hotel/email",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({reservation_id:Number(reservationId)})}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||"No se pudo preparar el email.");if(data.mode==="mailto"&&data.mailto)location.href=data.mailto;return data
}

const fmt=value=>`$ ${Number(value||0).toLocaleString("es-AR",{maximumFractionDigits:0})}`
const qnorm=value=>String(value||"").toLowerCase()
const sameRoom=(a,b)=>String(a?.habitacion_id??"")===String(b?.habitacion_id??"")

function localIntelligence(question,context={}){
  const q=qnorm(question),reservations=Array.isArray(context.reservas)?context.reservas:[],rooms=Array.isArray(context.habitaciones)?context.habitaciones:[],metrics=context.metricas||{},center=context.command_center||{},today=context.hoy
  const active=rooms.filter(r=>r.activa!==false),sellable=Number(metrics.habitaciones_vendibles??active.filter(r=>!['mantenimiento','fuera_servicio'].includes(String(r.estado||"").toLowerCase())).length),occupied=Number(metrics.habitaciones_ocupadas_hoy??new Set(reservations.filter(r=>r.estado!=="cancelada"&&r.entrada<=today&&r.salida>today).map(r=>String(r.habitacion_id))).size),occupancy=Number(metrics.ocupacion_hoy??(sellable?Math.round(occupied/sellable*100):0))
  const arrivals=Array.isArray(center.llegadas_hoy)?center.llegadas_hoy:reservations.filter(r=>r.estado!=="cancelada"&&r.entrada===today&&r.estado!=="alojado"),departures=Array.isArray(center.salidas_hoy)?center.salidas_hoy:reservations.filter(r=>r.estado!=="cancelada"&&r.salida===today&&r.estado!=="finalizada"),attention=Array.isArray(center.habitaciones_atencion)?center.habitaciones_atencion:rooms.filter(r=>['sucia','inspeccion','mantenimiento','fuera_servicio'].includes(String(r.estado||"").toLowerCase()))
  const withBalance=arrivals.filter(r=>Number(r.saldo||0)>.01),balance=withBalance.reduce((sum,r)=>sum+Number(r.saldo||0),0),rotations=arrivals.filter(a=>departures.some(d=>sameRoom(a,d))),arrivalAttention=arrivals.filter(a=>attention.some(r=>String(r.id)===String(a.habitacion_id)))
  const arrivalLabel=r=>`${r.nombre||"Huésped"} · ${r.habitacion||`Hab. ${r.habitacion_id}`}${r.hora_llegada?` · ${r.hora_llegada}`:""}`

  if(/atenci|priori|urgenc|necesita.*ahora|antes de|qué hago|que hago/.test(q)){
    const pieces=[]
    if(rotations.length)pieces.push(`${rotations.length} habitación(es) tienen salida y nueva llegada hoy: ${rotations.slice(0,3).map(arrivalLabel).join("; ")}.`)
    if(arrivalAttention.length)pieces.push(`${arrivalAttention.length} llegada(s) están asociadas a habitaciones con estado pendiente: ${arrivalAttention.slice(0,3).map(arrivalLabel).join("; ")}.`)
    if(withBalance.length)pieces.push(`${withBalance.length} llegada(s) tienen saldo pendiente por ${fmt(balance)}.`)
    if(pieces.length)return`Según el Command Center, esto es lo que requiere atención: ${pieces.join(" ")}`
    if(attention.length)return`No veo una urgencia ligada a una llegada, pero hay ${attention.length} habitación(es) con estado operativo pendiente: ${attention.slice(0,4).map(r=>`${r.nombre||r.id} (${r.estado})`).join(", ")}.`
    if(arrivals.length)return`No veo una urgencia operativa con los datos cargados. Sí hay ${arrivals.length} llegada(s) prevista(s) para hoy: ${arrivals.slice(0,4).map(arrivalLabel).join("; ")}. ${arrivals.some(r=>r.hora_llegada)?"Usé las horas cargadas donde existen.":"No tengo horas de llegada cargadas para ordenarlas por horario."}`
    if(departures.length)return`No veo una urgencia operativa. Hoy hay ${departures.length} salida(s) registradas, pero ninguna llegada o estado de habitación me marca una prioridad inmediata.`
    return`Con los datos del Command Center no veo nada que requiera atención inmediata. La ocupación de hoy es ${occupancy}% (${occupied} de ${sellable} habitaciones vendibles) y no hay llegadas ni salidas previstas para hoy.`
  }
  if(/ocup|en casa|hu[eé]spedes.*hoy/.test(q))return`La ocupación de hoy es ${occupancy}%: ${occupied} habitación(es) ocupada(s) sobre ${sellable} vendible(s). Hay ${arrivals.length} llegada(s) y ${departures.length} salida(s) registradas para hoy.`
  if(/saldo|deuda|pendiente.*pago|lleg.*pago|lleg.*saldo/.test(q)){if(!withBalance.length)return"No veo llegadas de hoy con saldo pendiente según los pagos registrados en Habitación Llena.";return`Hay ${withBalance.length} llegada(s) de hoy con saldo pendiente por ${fmt(balance)}: ${withBalance.slice(0,4).map(r=>`${arrivalLabel(r)} · saldo ${fmt(r.saldo)}`).join("; ")}.`}
  if(/lleg|check.?in|entrada/.test(q)){if(!arrivals.length)return"No hay llegadas registradas para hoy en el Command Center.";return`Hoy hay ${arrivals.length} llegada(s): ${arrivals.slice(0,5).map(arrivalLabel).join("; ")}.`}
  if(/salid|check.?out|\bout\b/.test(q)){if(!departures.length)return"No hay salidas registradas para hoy en el Command Center.";return`Hoy hay ${departures.length} salida(s): ${departures.slice(0,5).map(r=>`${r.nombre||"Huésped"} · ${r.habitacion||`Hab. ${r.habitacion_id}`}`).join("; ")}.`}
  if(/habit|cuarto/.test(q))return`Hay ${active.length} habitación(es) activa(s) y ${sellable} vendible(s) en este momento. ${attention.length?`${attention.length} tienen un estado que requiere revisión operativa.`:"No hay habitaciones marcadas con estados de atención."}`
  if(/reserv/.test(q))return`El Command Center me está entregando ${reservations.length} reserva(s) activas o relevantes para analizar. Si querés, preguntame por llegadas, salidas, ocupación o una reserva concreta.`
  return"No tengo un dato suficientemente específico en el Command Center para responder eso con seguridad. Puedo analizar ocupación, llegadas, salidas, saldos, habitaciones y prioridades operativas sin inventar información."
}

function shouldUseCommandCenterAnswer(question){return/atenci|priori|urgenc|necesita.*ahora|antes de|ocup|en casa|saldo|deuda|pendiente.*pago|lleg|check.?in|entrada|salid|check.?out|\bout\b|habit|cuarto|reserv/i.test(String(question||""))}
async function assistantRequest(token,question,context){const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({question,context})}),data=await response.json().catch(()=>({}));return{response,data}}
export async function askIntelligence({question,context}){
  if(shouldUseCommandCenterAnswer(question))return{answer:localIntelligence(question,context),mode:"command-center"}
  try{let token=await sessionToken(),result=await assistantRequest(token,question,context);if(result.response.status===401){token=await sessionToken(true);result=await assistantRequest(token,question,context)}if(result.response.ok)return result.data;return{answer:localIntelligence(question,context),mode:"local-fallback"}}catch{return{answer:localIntelligence(question,context),mode:"local-fallback"}}
}
