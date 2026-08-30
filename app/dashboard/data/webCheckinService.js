import { requirePropertyId } from "./tenant"

export async function createWebCheckinLink(client,{propertyId,reservationId,origin,expiresHours=168}){
  const tenant=requirePropertyId(propertyId)
  const {data,error}=await client.rpc("hl_create_web_checkin_token",{p_property_id:tenant,p_reservation_id:Number(reservationId),p_expires_hours:Number(expiresHours)})
  if(error)throw error
  return `${String(origin||"").replace(/\/$/,"")}/check-in/${data}`
}
