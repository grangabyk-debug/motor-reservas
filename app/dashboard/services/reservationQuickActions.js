import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"
import{saveHousekeepingTask}from"./operations"

const validPaymentStatus=value=>!["anulado","cancelado","reembolsado"].includes(String(value||"").toLowerCase())

async function currentUserId(){const{data,error}=await supabase.auth.getUser();if(error)throw error;const id=data?.user?.id;if(!id)throw new Error("La sesión venció. Volvé a ingresar.");return id}

export async function createReservationTask({propertyId,reservationId,roomId,type="service",priority="normal",notes=""}){
  const pid=requirePropertyId(propertyId),userId=await currentUserId()
  return saveHousekeepingTask({propertyId:pid,userId,draft:{room_id:Number(roomId),reservation_id:Number(reservationId),task_type:type,priority,status:"pending",scheduled_for:new Date().toISOString(),notes:String(notes||"").trim()||null}})
}

export async function cancelReservationQuick({propertyId,reservationId}){
  const pid=requirePropertyId(propertyId),rid=Number(reservationId)
  const{data,error}=await supabase.from("reservas").update({estado:"cancelada",tentative_expires_at:null,tentative_note:null,no_show:false}).eq("id",rid).eq("property_id",pid).select("*").single()
  if(error)throw error
  return data
}

export async function requestReservationPayment({propertyId,reservation}){
  const pid=requirePropertyId(propertyId),rid=Number(reservation?.id)
  if(!rid)throw new Error("Falta la reserva.")
  const[{data:{session}},{data:payments,error:paymentsError}]=await Promise.all([
    supabase.auth.getSession(),
    supabase.from("pagos").select("monto,estado").eq("property_id",pid).eq("reserva_id",rid),
  ])
  if(!session?.access_token)throw new Error("La sesión venció.")
  if(paymentsError)throw paymentsError
  const paid=(payments||[]).filter(x=>validPaymentStatus(x.estado)).reduce((sum,x)=>sum+Number(x.monto||0),0),balance=Math.max(0,Number(reservation.precio_total||0)-paid)
  if(balance<=.01)throw new Error("La reserva no tiene saldo pendiente.")
  const response=await fetch("/api/hotel/mercadopago/payment-request",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({property_id:pid,reservation_id:rid,amount:balance,currency:reservation.moneda||"ARS",expires_hours:72,message:`Saldo de reserva ${reservation.numero_reserva||reservation.id}`})}),data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data?.error||"No se pudo generar el enlace de pago.")
  if(!data.checkout_url)throw new Error("Mercado Pago no devolvió un enlace de cobro.")
  return{url:data.checkout_url,balance}
}
