import crypto from"node:crypto"
import{accessTokenFor,auditEvent,authContext,canManage,errorResponse,FRONTDESK_ROLES,guaranteeFor,loadConnection,memberRole,mpFetch,platformReady,reservationFor,safeConnection,safeGuarantee}from"../_lib"

const nowIso=()=>new Date().toISOString()
const moneyNumber=value=>Math.max(0,Number(value||0))
const expiryText=(month,year)=>month&&year?`${String(month).padStart(2,"0")}/${String(year).slice(-2)}`:null

async function snapshot(client,reservation,userRole){
  let guarantee=await guaranteeFor(client,reservation.property_id,reservation.id)
  if(guarantee?.status==="authorized"&&guarantee.authorization_expires_at&&new Date(guarantee.authorization_expires_at).getTime()<=Date.now()){
    const{data}=await client.from("hotel_guarantees").update({status:"expired",updated_at:nowIso()}).eq("id",guarantee.id).select("*").single();if(data){guarantee=data;await auditEvent(client,{guaranteeId:data.id,propertyId:reservation.property_id,reservationId:reservation.id,eventType:"expired",amount:data.authorized_amount,currency:data.currency,providerRef:data.authorized_payment_id,detail:{reason:"authorization_window_elapsed"},userId:null}).catch(()=>{})}
  }
  const connection=await loadConnection(client,reservation.property_id)
  const{data:events}=guarantee?await client.from("hotel_guarantee_events").select("id,event_type,amount,currency,provider_ref,detail,created_at").eq("property_id",reservation.property_id).eq("reserva_id",reservation.id).order("created_at",{ascending:false}).limit(20):{data:[]}
  return{guarantee:safeGuarantee(guarantee),events:events||[],connection:safeConnection(connection,userRole),platform_ready:platformReady()}
}

export async function GET(request){
  try{
    const{client,user}=await authContext(request),url=new URL(request.url),reservationId=Number(url.searchParams.get("reservation_id"));if(!reservationId)return Response.json({error:"Falta la reserva."},{status:400})
    const reservation=await reservationFor(client,reservationId),role=await memberRole(client,user.id,reservation.property_id)
    return Response.json(await snapshot(client,reservation,role))
  }catch(error){return errorResponse(error)}
}

export async function POST(request){
  try{
    const{client,user}=await authContext(request),body=await request.json().catch(()=>({})),reservationId=Number(body?.reservation_id),action=String(body?.action||"");if(!reservationId||!action)return Response.json({error:"Faltan la reserva o la acción de garantía."},{status:400})
    const reservation=await reservationFor(client,reservationId),role=await memberRole(client,user.id,reservation.property_id);if(!FRONTDESK_ROLES.includes(role))return Response.json({error:"Tu rol no puede administrar garantías."},{status:403})
    const propertyId=reservation.property_id,current=await guaranteeFor(client,propertyId,reservationId)

    if(action==="save_card"){
      if(current?.status==="authorized")return Response.json({error:"Primero liberá o capturá la garantía activa antes de reemplazar la tarjeta."},{status:409})
      if(!body?.consent_accepted)return Response.json({error:"El huésped debe aceptar las condiciones de garantía antes de guardar la tarjeta."},{status:400})
      const token=String(body?.token||""),email=String(body?.email||reservation.email_huesped||"").trim();if(!token)return Response.json({error:"Mercado Pago no devolvió un token de tarjeta válido."},{status:400});if(!email)return Response.json({error:"Cargá el email del huésped para vincular la tarjeta de garantía."},{status:400})
      const{accessToken}=await accessTokenFor(client,propertyId)
      const search=await mpFetch(`/v1/customers/search?email=${encodeURIComponent(email)}`,{accessToken}),found=Array.isArray(search?.results)?search.results[0]:null
      const customer=found||await mpFetch("/v1/customers",{accessToken,method:"POST",body:{email,first_name:String(reservation.nombre_huesped||"").trim()||undefined}})
      const card=await mpFetch(`/v1/customers/${encodeURIComponent(customer.id)}/cards`,{accessToken,method:"POST",body:{token}}),brand=card?.payment_method?.name||card?.payment_method?.id||body?.payment_method_id||"Tarjeta",lastFour=card?.last_four_digits||null,month=Number(card?.expiration_month)||null,year=Number(card?.expiration_year)||null
      const row={property_id:propertyId,reserva_id:reservationId,provider:"mercadopago",guarantee_type:"card",status:"card_saved",customer_id:String(customer.id),card_id:String(card.id),payment_method_id:card?.payment_method?.id||body?.payment_method_id||null,issuer_id:card?.issuer?.id==null?null:String(card.issuer.id),card_brand:brand,last_four:lastFour,expiration_month:month,expiration_year:year,authorized_payment_id:null,authorized_amount:0,captured_amount:0,currency:reservation.moneda||"ARS",authorization_expires_at:null,consent_accepted_at:nowIso(),consent_version:"hl-card-guarantee-v1",consent_note:String(body?.consent_note||"Autorización de garantía aceptada en recepción."),metadata:{cardholder_name:card?.cardholder?.name||body?.cardholder_name||null,saved_via:"mercadopago_js"},created_by:current?.created_by||user.id,updated_at:nowIso()}
      const{data:guarantee,error}=await client.from("hotel_guarantees").upsert(row,{onConflict:"property_id,reserva_id"}).select("*").single();if(error)throw error
      const{error:reservationError}=await client.from("reservas").update({garantia_tipo:"Tarjeta",garantia_marca:brand,garantia_ultimos4:lastFour,garantia_vencimiento:expiryText(month,year)}).eq("id",reservationId).eq("property_id",propertyId);if(reservationError)throw reservationError
      await auditEvent(client,{guaranteeId:guarantee.id,propertyId,reservationId,eventType:"card_saved",currency:reservation.moneda||"ARS",providerRef:String(card.id),detail:{brand,last_four:lastFour},userId:user.id})
      return Response.json({ok:true,...await snapshot(client,reservation,role)})
    }

    if(action==="authorize"){
      if(!current?.card_id)return Response.json({error:"Primero guardá una tarjeta de garantía."},{status:409})
      if(current.status==="authorized")return Response.json({error:"Ya existe una garantía retenida activa."},{status:409})
      const amount=moneyNumber(body?.amount),token=String(body?.token||"");if(!(amount>0))return Response.json({error:"Ingresá el monto a retener."},{status:400});if(!token)return Response.json({error:"Volvé a ingresar el código de seguridad de la tarjeta."},{status:400})
      const{accessToken}=await accessTokenFor(client,propertyId),idempotencyKey=String(body?.idempotency_key||crypto.randomUUID()),payment=await mpFetch("/v1/payments",{accessToken,method:"POST",idempotencyKey,body:{transaction_amount:amount,token,description:`Garantía reserva ${reservation.numero_reserva||reservation.id}`,installments:1,payment_method_id:body?.payment_method_id||current.payment_method_id,payer:{email:reservation.email_huesped||body?.email},capture:false,external_reference:`HL-GUARANTEE-${reservation.id}`}}),authorized=payment?.status==="authorized",pending=["in_process","pending"].includes(payment?.status),status=authorized?"authorized":pending?"pending":"failed",expires=authorized?new Date(new Date(payment.date_created||Date.now()).getTime()+7*86400000).toISOString():null
      const{data:guarantee,error}=await client.from("hotel_guarantees").update({status,authorized_payment_id:payment?.id==null?null:String(payment.id),authorized_amount:authorized?amount:0,captured_amount:0,currency:payment?.currency_id||reservation.moneda||"ARS",authorization_expires_at:expires,metadata:{...(current.metadata||{}),authorization_status_detail:payment?.status_detail||null,last_authorization_idempotency_key:idempotencyKey},updated_at:nowIso()}).eq("id",current.id).select("*").single();if(error)throw error
      await auditEvent(client,{guaranteeId:guarantee.id,propertyId,reservationId,eventType:authorized?"authorized":"authorization_failed",amount,currency:guarantee.currency,providerRef:guarantee.authorized_payment_id,detail:{status:payment?.status,status_detail:payment?.status_detail},userId:user.id})
      if(!authorized)return Response.json({error:pending?"Mercado Pago dejó la retención pendiente de confirmación.":`No se pudo retener la garantía: ${payment?.status_detail||payment?.status||"rechazada"}.`,...await snapshot(client,reservation,role)},{status:409})
      return Response.json({ok:true,...await snapshot(client,reservation,role)})
    }

    if(action==="capture"){
      if(!current?.authorized_payment_id||current.status!=="authorized")return Response.json({error:"No hay una retención activa para capturar."},{status:409})
      if(current.authorization_expires_at&&new Date(current.authorization_expires_at).getTime()<=Date.now())return Response.json({error:"La retención venció. Hay que generar una nueva autorización."},{status:409})
      const amount=moneyNumber(body?.amount),max=moneyNumber(current.authorized_amount);if(!(amount>0)||amount>max+.01)return Response.json({error:`El cargo debe ser mayor a cero y no superar la garantía retenida de ${max}.`},{status:400})
      const{accessToken}=await accessTokenFor(client,propertyId),idempotencyKey=String(body?.idempotency_key||crypto.randomUUID()),payment=await mpFetch(`/v1/payments/${encodeURIComponent(current.authorized_payment_id)}`,{accessToken,method:"PUT",idempotencyKey,body:{transaction_amount:amount,capture:true}});if(payment?.status!=="approved")return Response.json({error:`Mercado Pago no confirmó el cobro (${payment?.status_detail||payment?.status||"sin estado"}).`},{status:409})
      const concept=String(body?.concept||"Cargo por garantía").trim()||"Cargo por garantía",providerRef=String(payment.id||current.authorized_payment_id),addCharge=body?.add_charge!==false
      if(addCharge){
        const services=Array.isArray(reservation.servicios)?reservation.servicios:[],already=services.some(item=>String(item?.provider_ref||"")===providerRef&&item?.kind==="guarantee_capture")
        if(!already){const next=[...services,{name:concept,kind:"guarantee_capture",total:amount,provider:"mercadopago",provider_ref:providerRef,created_at:nowIso()}],newTotal=moneyNumber(reservation.precio_total)+amount,{error}=await client.from("reservas").update({servicios:next,precio_total:newTotal}).eq("id",reservationId).eq("property_id",propertyId);if(error)throw error}
      }
      const note=`Garantía MP ${providerRef} · ${concept}`,{data:existingPayment}=await client.from("pagos").select("id").eq("property_id",propertyId).eq("reserva_id",reservationId).eq("nota",note).maybeSingle();if(!existingPayment){const{error}=await client.from("pagos").insert({property_id:propertyId,user_id:user.id,reserva_id:reservationId,monto:amount,metodo:"Mercado Pago · Garantía",moneda:payment?.currency_id||current.currency||"ARS",nota:note});if(error)throw error}
      const{data:guarantee,error}=await client.from("hotel_guarantees").update({status:"captured",captured_amount:amount,authorized_amount:max,currency:payment?.currency_id||current.currency||"ARS",metadata:{...(current.metadata||{}),capture_concept:concept,capture_idempotency_key:idempotencyKey},updated_at:nowIso()}).eq("id",current.id).select("*").single();if(error)throw error
      await auditEvent(client,{guaranteeId:guarantee.id,propertyId,reservationId,eventType:"captured",amount,currency:guarantee.currency,providerRef,detail:{concept,add_charge:addCharge,status:payment.status},userId:user.id})
      return Response.json({ok:true,...await snapshot(client,await reservationFor(client,reservationId),role)})
    }

    if(action==="release"){
      if(!current?.authorized_payment_id||current.status!=="authorized")return Response.json({error:"No hay una retención activa para liberar."},{status:409})
      const{accessToken}=await accessTokenFor(client,propertyId),idempotencyKey=String(body?.idempotency_key||crypto.randomUUID()),payment=await mpFetch(`/v1/payments/${encodeURIComponent(current.authorized_payment_id)}`,{accessToken,method:"PUT",idempotencyKey,body:{status:"canceled"}}),{data:guarantee,error}=await client.from("hotel_guarantees").update({status:"released",authorization_expires_at:null,metadata:{...(current.metadata||{}),release_status:payment?.status||"cancelled",release_idempotency_key:idempotencyKey},updated_at:nowIso()}).eq("id",current.id).select("*").single();if(error)throw error
      await auditEvent(client,{guaranteeId:guarantee.id,propertyId,reservationId,eventType:"released",amount:current.authorized_amount,currency:current.currency,providerRef:current.authorized_payment_id,detail:{status:payment?.status},userId:user.id})
      return Response.json({ok:true,...await snapshot(client,reservation,role)})
    }

    if(action==="remove_card"){
      if(!current?.card_id)return Response.json({error:"No hay una tarjeta guardada."},{status:409});if(current.status==="authorized")return Response.json({error:"Primero liberá o capturá la retención activa."},{status:409})
      const{accessToken}=await accessTokenFor(client,propertyId);if(current.customer_id)await mpFetch(`/v1/customers/${encodeURIComponent(current.customer_id)}/cards/${encodeURIComponent(current.card_id)}`,{accessToken,method:"DELETE"})
      const{data:guarantee,error}=await client.from("hotel_guarantees").update({status:"cancelled",card_id:null,payment_method_id:null,issuer_id:null,card_brand:null,last_four:null,expiration_month:null,expiration_year:null,authorized_payment_id:null,authorized_amount:0,captured_amount:0,authorization_expires_at:null,updated_at:nowIso()}).eq("id",current.id).select("*").single();if(error)throw error
      await client.from("reservas").update({garantia_tipo:"Sin garantía",garantia_marca:null,garantia_ultimos4:null,garantia_vencimiento:null}).eq("id",reservationId).eq("property_id",propertyId)
      await auditEvent(client,{guaranteeId:guarantee.id,propertyId,reservationId,eventType:"card_removed",currency:current.currency,providerRef:current.card_id,detail:{},userId:user.id})
      return Response.json({ok:true,...await snapshot(client,reservation,role)})
    }

    return Response.json({error:"Acción de garantía desconocida."},{status:400})
  }catch(error){return errorResponse(error)}
}