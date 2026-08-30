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

async function sessionToken(){const{data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("La sesión expiró.");return session.access_token}

export async function sendReservationEmail({reservationId}){
  const token=await sessionToken(),response=await fetch("/api/hotel/email",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({reservation_id:Number(reservationId)})}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||"No se pudo preparar el email.");if(data.mode==="mailto"&&data.mailto)location.href=data.mailto;return data
}

export async function askIntelligence({question,context}){
  const token=await sessionToken(),response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({question,context})}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||"No se pudo consultar Llena Intelligence.");return data
}
