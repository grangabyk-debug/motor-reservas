import{accessTokenFor,authContext,errorResponse,mpFetch,platformReady,requireRole}from"../_lib"

const ROLES=["owner","manager","admin","reception","night_audit"]
const num=value=>Number(value||0)
const cleanEmail=value=>{const v=String(value||"").trim();return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?v:null}

async function reservationContext(client,propertyId,reservationId){
  const{data:reservation,error}=await client.from("reservas").select("id,property_id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,precio_total,moneda").eq("id",Number(reservationId)).eq("property_id",propertyId).single();if(error||!reservation)throw Object.assign(new Error("Reserva no encontrada en esta propiedad."),{status:404})
  const{data:payments,error:payError}=await client.from("pagos").select("monto,estado").eq("property_id",propertyId).eq("reserva_id",Number(reservationId));if(payError)throw payError
  const paid=(payments||[]).filter(p=>!["anulado","cancelado","reembolsado"].includes(String(p.estado||"").toLowerCase())).reduce((sum,p)=>sum+num(p.monto),0)
  return{reservation,paid,balance:Math.max(0,num(reservation.precio_total)-paid)}
}

export async function GET(request){
  try{
    const{client,user}=await authContext(request),url=new URL(request.url),propertyId=url.searchParams.get("property_id"),reservationId=url.searchParams.get("reservation_id");if(!propertyId)return Response.json({error:"Falta la propiedad."},{status:400})
    await requireRole(client,user.id,propertyId,ROLES)
    let query=client.from("hotel_payment_requests").select("*").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100);if(reservationId)query=query.eq("reserva_id",Number(reservationId));const{data,error}=await query;if(error)throw error
    return Response.json({requests:data||[]})
  }catch(error){return errorResponse(error)}
}

export async function POST(request){
  try{
    const{client,user}=await authContext(request),body=await request.json().catch(()=>({})),propertyId=body?.property_id,reservationId=Number(body?.reservation_id),amount=num(body?.amount),currency=String(body?.currency||"ARS").toUpperCase(),expiresHours=Math.min(168,Math.max(1,num(body?.expires_hours)||72));if(!propertyId||!reservationId||!(amount>0))return Response.json({error:"Faltan reserva o importe."},{status:400})
    await requireRole(client,user.id,propertyId,ROLES);if(!platformReady())return Response.json({error:"Mercado Pago todavía no está habilitado en la plataforma."},{status:503});if(currency!=="ARS")return Response.json({error:"Los enlaces de Mercado Pago de este flujo se emiten en ARS. Para otra moneda registrá el cobro manual o convertí el importe antes."},{status:400})
    const{reservation,balance}=await reservationContext(client,propertyId,reservationId);if(balance<=.01)return Response.json({error:"La reserva no tiene saldo pendiente."},{status:409});if(amount>balance+.01)return Response.json({error:`El importe supera el saldo pendiente de $ ${balance.toLocaleString("es-AR",{minimumFractionDigits:2})}.`},{status:400})
    const expiresAt=new Date(Date.now()+expiresHours*3600000),{data:row,error:insertError}=await client.from("hotel_payment_requests").insert({property_id:propertyId,reserva_id:reservationId,amount,currency,status:"draft",provider:"mercadopago",payer_email:cleanEmail(reservation.email_huesped),expires_at:expiresAt.toISOString(),message:String(body?.message||"").trim()||null,created_by:user.id}).select("*").single();if(insertError)throw insertError
    const{accessToken}=await accessTokenFor(client,propertyId),externalReference=`hlpr_${String(row.id).replaceAll("-","")}`,preference={items:[{id:`reservation_${reservation.id}`,title:`Reserva ${reservation.numero_reserva||reservation.id}`,description:"Saldo de alojamiento y servicios",quantity:1,currency_id:"ARS",unit_price:amount}],external_reference:externalReference,expires:true,expiration_date_to:expiresAt.toISOString(),metadata:{payment_request_id:row.id,reservation_id:String(reservation.id)}};const payer=cleanEmail(reservation.email_huesped);if(payer)preference.payer={email:payer}
    const mp=await mpFetch("/checkout/preferences",{accessToken,method:"POST",body:preference,idempotencyKey:row.id}),{data:updated,error:updateError}=await client.from("hotel_payment_requests").update({status:"requested",provider_preference_id:String(mp.id||""),init_point:mp.init_point||null,sandbox_init_point:mp.sandbox_init_point||null,metadata:{external_reference:externalReference},updated_at:new Date().toISOString()}).eq("id",row.id).eq("property_id",propertyId).select("*").single();if(updateError)throw updateError
    return Response.json({request:updated,checkout_url:updated.init_point||updated.sandbox_init_point||null})
  }catch(error){return errorResponse(error)}
}

export async function PATCH(request){
  try{
    const{client,user}=await authContext(request),body=await request.json().catch(()=>({})),propertyId=body?.property_id,requestId=body?.request_id,action=body?.action;if(!propertyId||!requestId)return Response.json({error:"Falta identificar la solicitud."},{status:400});await requireRole(client,user.id,propertyId,ROLES)
    const{data:req,error:reqError}=await client.from("hotel_payment_requests").select("*").eq("id",requestId).eq("property_id",propertyId).single();if(reqError||!req)return Response.json({error:"Solicitud no encontrada."},{status:404})
    if(action!=="verify")return Response.json({error:"Acción no soportada."},{status:400});if(req.status==="approved")return Response.json({request:req,approved:true,already:true});if(req.status==="cancelled")return Response.json({error:"La solicitud fue cancelada."},{status:409});if(req.expires_at&&new Date(req.expires_at).getTime()<Date.now()){await client.from("hotel_payment_requests").update({status:"expired",updated_at:new Date().toISOString()}).eq("id",req.id).eq("property_id",propertyId);return Response.json({request:{...req,status:"expired"},approved:false})}
    const{accessToken}=await accessTokenFor(client,propertyId),externalReference=req.metadata?.external_reference||`hlpr_${String(req.id).replaceAll("-","")}`,end=new Date(),begin=new Date(end.getTime()-1000*60*60*24*365),query=`/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&range=date_created&begin_date=${encodeURIComponent(begin.toISOString())}&end_date=${encodeURIComponent(end.toISOString())}&sort=date_created&criteria=desc`,result=await mpFetch(query,{accessToken}),rows=Array.isArray(result?.results)?result.results:[],approved=rows.find(p=>String(p.status)==="approved"&&String(p.currency_id||"ARS").toUpperCase()===String(req.currency||"ARS").toUpperCase()&&Math.abs(num(p.transaction_amount)-num(req.amount))<=.01)
    if(!approved){const latest=rows[0],status=latest?.status==="rejected"?"failed":"pending";await client.from("hotel_payment_requests").update({status,updated_at:new Date().toISOString()}).eq("id",req.id).eq("property_id",propertyId);return Response.json({request:{...req,status},approved:false,provider_status:latest?.status||"not_found"})}
    const{data:settled,error:settleError}=await client.rpc("hl_settle_payment_request",{p_request_id:req.id,p_provider_payment_id:String(approved.id),p_amount:num(approved.transaction_amount),p_method:approved.payment_method_id?`Mercado Pago · ${approved.payment_method_id}`:"Mercado Pago"});if(settleError)throw settleError
    const{data:fresh}=await client.from("hotel_payment_requests").select("*").eq("id",req.id).single();return Response.json({request:fresh,payment:Array.isArray(settled)?settled[0]:settled,approved:true})
  }catch(error){return errorResponse(error)}
}
