import{mercadoPagoAuthFetch}from"./mercadoPagoOAuth"

export const PAYMENT_PROVIDERS={
  mercadopago:{id:"mercadopago",name:"Mercado Pago",implemented:true},
  stripe:{id:"stripe",name:"Stripe",implemented:false},
}

function provider(id){const item=PAYMENT_PROVIDERS[id];if(!item)throw new Error("Proveedor de pagos no reconocido.");return item}

export async function loadPaymentProviderStatus({providerId,propertyId}){
  const item=provider(providerId)
  if(!propertyId)throw new Error("Falta la propiedad para revisar el proveedor de pagos.")
  if(providerId==="mercadopago"){
    const data=await mercadoPagoAuthFetch(`/api/hotel/mercadopago/config?property_id=${encodeURIComponent(propertyId)}`)
    return{providerId,implemented:true,platformReady:!!data?.platform_ready,connected:!!data?.connection?.connected,canManage:!!data?.connection?.can_manage,connection:data?.connection||null}
  }
  return{providerId,implemented:item.implemented,platformReady:false,connected:false,canManage:false,connection:null}
}

export async function startPaymentProviderConnection({providerId,propertyId}){
  const item=provider(providerId)
  if(!item.implemented)throw new Error(`${item.name} todavía no tiene un conector productivo habilitado en Habitación Llena.`)
  if(providerId==="mercadopago"){
    const data=await mercadoPagoAuthFetch("/api/hotel/mercadopago/oauth/start",{method:"POST",body:JSON.stringify({property_id:propertyId})})
    if(!data?.url)throw new Error("Mercado Pago no devolvió una URL de conexión.")
    return data
  }
  throw new Error("Proveedor no implementado.")
}
