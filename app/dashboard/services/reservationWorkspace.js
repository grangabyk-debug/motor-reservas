import{ supabase }from"../../../lib/supabase"
import{ requirePropertyId }from"../data/tenant"

const tenant=id=>requirePropertyId(id)

export async function loadReservationWorkspace({propertyId}){
  const property=tenant(propertyId)
  const[resourcesResult,settingsResult]=await Promise.all([
    supabase.from("hotel_resources").select("*").eq("property_id",property).eq("active",true).order("category").order("name"),
    supabase.from("hotel_os_settings").select("operational_settings").eq("property_id",property).maybeSingle(),
  ])
  if(resourcesResult.error)throw resourcesResult.error
  if(settingsResult.error)throw settingsResult.error
  const operational=settingsResult.data?.operational_settings
  return{resources:resourcesResult.data||[],hotelOps:operational&&typeof operational==="object"?operational:{}}
}
