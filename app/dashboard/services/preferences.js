import{ supabase }from"../../../lib/supabase"
import{ requirePropertyId }from"../data/tenant"

export async function loadUserPreference({propertyId,userId,key}){
  const property=requirePropertyId(propertyId)
  if(!userId||!key)return null
  const{data,error}=await supabase.from("hotel_user_preferences").select("value").eq("property_id",property).eq("user_id",userId).eq("preference_key",key).maybeSingle()
  if(error)throw error
  return data?.value??null
}

export async function saveUserPreference({propertyId,userId,key,value}){
  const property=requirePropertyId(propertyId)
  if(!userId||!key)throw new Error("Faltan usuario o preferencia.")
  const{error}=await supabase.from("hotel_user_preferences").upsert({property_id:property,user_id:userId,preference_key:key,value,updated_at:new Date().toISOString()},{onConflict:"property_id,user_id,preference_key"})
  if(error)throw error
}
