import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"
import{createPaymentProviderRequest,loadPaymentProviderStatus,verifyPaymentProviderRequest}from"./paymentProviders"

export async function loadPaymentWorkspace(propertyId){
  const pid=requirePropertyId(propertyId)
  const[{data:requests,error:rErr},{data:deposits,error:dErr},{data:ota,error:oErr},{data:payments,error:pErr}]=await Promise.all([
    supabase.from("hotel_payment_requests").select("*").eq("property_id",pid).order("created_at",{ascending:false}).limit(100),
    supabase.from("hotel_deposits").select("*").eq("property_id",pid).order("created_at",{ascending:false}).limit(100),
    supabase.from("hotel_ota_prepayments").select("*").eq("property_id",pid).order("reported_at",{ascending:false}).limit(100),
    supabase.from("pagos").select("id,property_id,reserva_id,monto,metodo,moneda,nota,estado,source,provider,external_ref,referencia,payment_request_id,created_at").eq("property_id",pid).order("created_at",{ascending:false}).limit(300)
  ])
  if(rErr)throw rErr;if(dErr)throw dErr;if(oErr)throw oErr;if(pErr)throw pErr
  return{requests:requests||[],deposits:deposits||[],ota:ota||[],payments:payments||[]}
}

// Wrappers retrocompatibles. Las pantallas nuevas usan paymentProviders directamente.
export async function createPaymentRequest({providerId="mercadopago",...args}){return createPaymentProviderRequest({providerId,...args})}
export async function verifyPaymentRequest({providerId="mercadopago",...args}){return verifyPaymentProviderRequest({providerId,...args})}
export async function loadPaymentConnection(propertyId,providerId="mercadopago"){
  const status=await loadPaymentProviderStatus({providerId,propertyId:requirePropertyId(propertyId)})
  return{provider:{id:status.providerId,name:status.name,implemented:status.implemented,capabilities:status.capabilities},platform_ready:status.platformReady,connection:{...(status.connection||{}),connected:status.connected,can_manage:status.canManage}}
}

export async function createDeposit({propertyId,userId,reservationId,amount,currency="ARS",method="Depósito",reference="",notes=""}){
  const row={property_id:requirePropertyId(propertyId),reserva_id:Number(reservationId),amount:Number(amount),currency:String(currency||"ARS").toUpperCase(),method,reference:reference||null,notes:notes||null,created_by:userId||null};if(!(row.amount>0))throw new Error("Ingresá un importe válido para la fianza o depósito.")
  const{data,error}=await supabase.from("hotel_deposits").insert(row).select("*").single();if(error)throw error;return data
}
export async function applyDeposit(id){const{data,error}=await supabase.rpc("hl_apply_deposit",{p_deposit_id:id});if(error)throw error;return Array.isArray(data)?data[0]:data}
export async function refundDeposit(id,note=""){const{data,error}=await supabase.rpc("hl_refund_deposit",{p_deposit_id:id,p_note:note||null});if(error)throw error;return Array.isArray(data)?data[0]:data}

export async function createOtaPrepayment({propertyId,userId,reservationId,channel,externalRef,amount,currency="ARS"}){
  const row={property_id:requirePropertyId(propertyId),reserva_id:Number(reservationId),channel:String(channel||"").trim(),external_ref:String(externalRef||"").trim(),amount:Number(amount),currency:String(currency||"ARS").toUpperCase(),created_by:userId||null};if(!row.channel||!row.external_ref)throw new Error("Indicá el canal y su referencia para evitar duplicados.");if(!(row.amount>0))throw new Error("Ingresá un importe válido.")
  const{data,error}=await supabase.from("hotel_ota_prepayments").insert(row).select("*").single();if(error){if(error.code==="23505")throw new Error("Ese prepago del canal ya fue registrado.");throw error}return data
}
export async function convertOtaPrepayment(id){const{data,error}=await supabase.rpc("hl_convert_ota_prepayment",{p_prepayment_id:id});if(error)throw error;return Array.isArray(data)?data[0]:data}

export function paidByReservation(payments=[]){const map=new Map();for(const p of payments){if(["anulado","cancelado","reembolsado"].includes(String(p.estado||"").toLowerCase()))continue;const key=String(p.reserva_id);map.set(key,(map.get(key)||0)+Number(p.monto||0))}return map}
