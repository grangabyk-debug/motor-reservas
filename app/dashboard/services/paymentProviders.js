import{mercadoPagoAuthFetch}from"./mercadoPagoOAuth"

export const PAYMENT_PROVIDERS={
  mercadopago:{id:"mercadopago",name:"Mercado Pago",implemented:true,capabilities:{connect:true,paymentLinks:true,guarantees:true,refunds:true}},
  stripe:{id:"stripe",name:"Stripe",implemented:false,capabilities:{connect:true,paymentLinks:true,guarantees:false,refunds:true}},
}

export function normalizePaymentProviderId(value){const raw=String(value||"").trim().toLowerCase();if(raw.includes("mercado"))return"mercadopago";if(raw.includes("stripe"))return"stripe";return raw}
export function paymentProviderInfo(id){return PAYMENT_PROVIDERS[normalizePaymentProviderId(id)]||null}
function provider(id){const key=normalizePaymentProviderId(id),item=PAYMENT_PROVIDERS[key];if(!item)throw new Error("Proveedor de pagos no reconocido.");return item}
function requireProperty(propertyId){const value=String(propertyId||"").trim();if(!value)throw new Error("Falta la propiedad para operar con el proveedor de pagos.");return value}
function requireImplemented(item,capability){if(!item.implemented)throw new Error(`${item.name} todavía no tiene un conector productivo habilitado en Habitación Llena.`);if(capability&&!item.capabilities?.[capability])throw new Error(`${item.name} no tiene disponible la función solicitada.`)}

export async function loadPaymentProviderStatus({providerId,propertyId}){
  const item=provider(providerId),property=requireProperty(propertyId)
  if(item.id==="mercadopago"){
    const data=await mercadoPagoAuthFetch(`/api/hotel/mercadopago/config?property_id=${encodeURIComponent(property)}`)
    return{providerId:item.id,name:item.name,implemented:true,capabilities:item.capabilities,platformReady:!!data?.platform_ready,connected:!!data?.connection?.connected,canManage:!!data?.connection?.can_manage,connection:data?.connection||null}
  }
  return{providerId:item.id,name:item.name,implemented:item.implemented,capabilities:item.capabilities,platformReady:false,connected:false,canManage:false,connection:null}
}

export async function startPaymentProviderConnection({providerId,propertyId}){
  const item=provider(providerId),property=requireProperty(propertyId);requireImplemented(item,"connect")
  if(item.id==="mercadopago"){
    const data=await mercadoPagoAuthFetch("/api/hotel/mercadopago/oauth/start",{method:"POST",body:JSON.stringify({property_id:property})})
    if(!data?.url)throw new Error("Mercado Pago no devolvió una URL de conexión.")
    return data
  }
  throw new Error(`${item.name} todavía no tiene conexión productiva disponible.`)
}

export async function createPaymentProviderRequest({providerId,propertyId,reservationId,amount,currency,expiresHours=72,message=""}){
  const item=provider(providerId),property=requireProperty(propertyId);requireImplemented(item,"paymentLinks")
  const value=Number(amount||0);if(!(value>0))throw new Error("Ingresá un importe válido para solicitar el pago.")
  if(item.id==="mercadopago"){
    const data=await mercadoPagoAuthFetch("/api/hotel/mercadopago/payment-request",{method:"POST",body:JSON.stringify({property_id:property,reservation_id:Number(reservationId),amount:value,currency:String(currency||"ARS").toUpperCase(),expires_hours:Number(expiresHours||72),message})})
    return{...data,providerId:item.id,providerName:item.name}
  }
  throw new Error(`${item.name} todavía no puede generar enlaces de pago desde Habitación Llena.`)
}

export async function verifyPaymentProviderRequest({providerId,propertyId,requestId}){
  const item=provider(providerId),property=requireProperty(propertyId);requireImplemented(item,"paymentLinks")
  if(item.id==="mercadopago"){
    const data=await mercadoPagoAuthFetch("/api/hotel/mercadopago/payment-request",{method:"PATCH",body:JSON.stringify({property_id:property,request_id:requestId,action:"verify"})})
    return{...data,providerId:item.id,providerName:item.name}
  }
  throw new Error(`${item.name} todavía no puede verificar cobros desde Habitación Llena.`)
}
