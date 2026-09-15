import{createClient}from"@supabase/supabase-js"
import{accessTokenFor,errorResponse,mpFetch}from"../_lib"

const num=value=>Number(value||0)
const text=value=>String(value??"").trim()

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY
  if(!url||!key)throw Object.assign(new Error("Faltan las credenciales de Supabase del servidor para conciliar pagos."),{status:503})
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
}
function paymentIdFrom(request,body){
  const url=new URL(request.url)
  return text(body?.data?.id||body?.id||url.searchParams.get("data.id")||url.searchParams.get("id"))
}
function eventType(body){return text(body?.type||body?.topic||body?.action).toLowerCase()}
function providerMethod(payment){
  const method=text(payment?.payment_method_id),type=text(payment?.payment_type_id)
  if(method&&type)return`Mercado Pago · ${method} (${type})`
  if(method)return`Mercado Pago · ${method}`
  return"Mercado Pago"
}

export async function POST(request){
  try{
    const url=new URL(request.url),requestId=text(url.searchParams.get("request_id")),body=await request.json().catch(()=>({})),kind=eventType(body),providerPaymentId=paymentIdFrom(request,body)
    if(!requestId)return Response.json({ok:true,ignored:"missing_request_id"})
    if(kind&&!kind.includes("payment"))return Response.json({ok:true,ignored:"unsupported_event"})
    if(!providerPaymentId)return Response.json({ok:true,ignored:"missing_payment_id"})

    const db=adminClient(),{data:req,error:reqError}=await db.from("hotel_payment_requests").select("*").eq("id",requestId).eq("provider","mercadopago").maybeSingle()
    if(reqError)throw reqError
    if(!req)return Response.json({ok:true,ignored:"unknown_request"})
    if(req.status==="approved"&&req.provider_payment_id)return Response.json({ok:true,approved:true,idempotent:true})

    const{accessToken}=await accessTokenFor(db,req.property_id),payment=await mpFetch(`/v1/payments/${encodeURIComponent(providerPaymentId)}`,{accessToken}),expectedReference=req.metadata?.external_reference||`hlpr_${String(req.id).replaceAll("-","")}`,actualReference=text(payment?.external_reference),currency=text(payment?.currency_id||"ARS").toUpperCase(),expectedCurrency=text(req.currency||"ARS").toUpperCase(),amount=num(payment?.transaction_amount),expectedAmount=num(req.amount)

    if(actualReference!==expectedReference)return Response.json({ok:true,ignored:"external_reference_mismatch"})
    if(currency!==expectedCurrency)return Response.json({ok:true,ignored:"currency_mismatch"})
    if(Math.abs(amount-expectedAmount)>.01)return Response.json({ok:true,ignored:"amount_mismatch"})

    const providerStatus=text(payment?.status).toLowerCase(),metadata={...(req.metadata||{}),provider_status:providerStatus,last_provider_payment_id:String(payment?.id||providerPaymentId),webhook_processed_at:new Date().toISOString()}
    if(providerStatus!=="approved"){
      const status=providerStatus==="rejected"?"failed":providerStatus==="cancelled"?"cancelled":"pending"
      const{error:updateError}=await db.from("hotel_payment_requests").update({status,metadata,updated_at:new Date().toISOString()}).eq("id",req.id).eq("property_id",req.property_id)
      if(updateError)throw updateError
      return Response.json({ok:true,approved:false,status})
    }

    const{data:settled,error:settleError}=await db.rpc("hl_settle_payment_request",{p_request_id:req.id,p_provider_payment_id:String(payment.id||providerPaymentId),p_amount:amount,p_method:providerMethod(payment)})
    if(settleError)throw settleError
    const{error:metadataError}=await db.from("hotel_payment_requests").update({metadata,updated_at:new Date().toISOString()}).eq("id",req.id).eq("property_id",req.property_id)
    if(metadataError)throw metadataError
    return Response.json({ok:true,approved:true,payment_id:Array.isArray(settled)?settled[0]?.id:settled?.id||null})
  }catch(error){return errorResponse(error)}
}

export async function GET(){return Response.json({ok:true,provider:"mercadopago",webhook:true})}
