import{ supabase }from"../../../lib/supabase"
import{ requirePropertyId }from"../data/tenant"

export async function deleteResource({propertyId,id}){
  const property=requirePropertyId(propertyId)
  if(!id)throw new Error("Falta el recurso a eliminar.")
  const{error}=await supabase.from("hotel_resources").delete().eq("id",id).eq("property_id",property)
  if(error)throw error
}
