import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"

const nowIso=()=>new Date().toISOString()

export async function expireTentativeReservations({propertyId}){
  const property=requirePropertyId(propertyId),now=nowIso()
  const{data,error}=await supabase.from("reservas").update({estado:"cancelada",tentative_expired_at:now}).eq("property_id",property).eq("estado","tentativa").is("tentative_expired_at",null).lt("tentative_expires_at",now).select("id")
  if(error)throw error
  return data||[]
}

export async function setReservationTentative({propertyId,reservationId,expiresAt,note=""}){
  const property=requirePropertyId(propertyId),rid=Number(reservationId),expiry=new Date(expiresAt)
  if(!rid)throw new Error("Falta la reserva.")
  if(!expiresAt||Number.isNaN(expiry.getTime()))throw new Error("Elegí hasta cuándo se mantiene la reserva tentativa.")
  if(expiry.getTime()<=Date.now()+60000)throw new Error("El vencimiento debe quedar al menos un minuto en el futuro.")
  const{data,error}=await supabase.from("reservas").update({estado:"tentativa",tentative_expires_at:expiry.toISOString(),tentative_note:String(note||"").trim()||null,tentative_expired_at:null,no_show:false}).eq("id",rid).eq("property_id",property).select("*").single();if(error)throw error;return data
}

export async function confirmTentativeReservation({propertyId,reservationId}){
  const property=requirePropertyId(propertyId),rid=Number(reservationId)
  const{data,error}=await supabase.from("reservas").update({estado:"confirmada",tentative_expires_at:null,tentative_note:null,tentative_expired_at:null}).eq("id",rid).eq("property_id",property).select("*").single();if(error)throw error;return data
}

export function tentativeCountdown(value,now=Date.now()){
  if(!value)return""
  const diff=new Date(value).getTime()-now
  if(diff<=0)return"Vencida"
  const minutes=Math.ceil(diff/60000),hours=Math.floor(minutes/60),mins=minutes%60,days=Math.floor(hours/24),remHours=hours%24
  if(days>0)return`${days}d ${remHours}h`
  if(hours>0)return`${hours}h ${mins}m`
  return`${minutes}m`
}

export function defaultTentativeExpiry(hours=24){
  const d=new Date(Date.now()+Number(hours||24)*3600000),pad=n=>String(n).padStart(2,"0")
  return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
