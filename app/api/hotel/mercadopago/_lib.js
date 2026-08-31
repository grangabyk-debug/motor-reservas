import crypto from"node:crypto"
import{createClient}from"@supabase/supabase-js"

const MP_API="https://api.mercadopago.com"
const MP_AUTH="https://auth.mercadopago.com/authorization"
const MANAGE_ROLES=["owner","manager","admin"]
const FRONTDESK_ROLES=[...MANAGE_ROLES,"reception"]

export function platformReady(){return!!(process.env.MERCADOPAGO_CLIENT_ID&&process.env.MERCADOPAGO_CLIENT_SECRET)}
export function redirectUri(){return process.env.MERCADOPAGO_REDIRECT_URI||"https://habitacionllena.com/api/hotel/mercadopago/oauth/callback"}
function encryptionSecret(){return process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY||process.env.MERCADOPAGO_CLIENT_SECRET||""}
function cipherKey(){const secret=encryptionSecret();if(!secret)throw httpError(503,"Falta configurar la clave privada de Mercado Pago.");return crypto.createHash("sha256").update(secret).digest()}
export function httpError(status,message,detail=null){const error=new Error(message);error.status=status;error.detail=detail;return error}
export function errorResponse(error){return Response.json({error:error?.message||"No se pudo completar la operación.",detail:error?.detail||undefined},{status:Number(error?.status)||500})}

export async function authContext(request){
  const authorization=request.headers.get("authorization")
  if(!authorization?.startsWith("Bearer "))throw httpError(401,"No estás autenticado.")
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if(!supabaseUrl||!publishableKey)throw httpError(500,"Falta configuración de Supabase en el servidor.")
  const client=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
  const{data:{user},error}=await client.auth.getUser();if(error||!user)throw httpError(401,"La sesión no es válida.")
  return{client,user}
}

export async function memberRole(client,userId,propertyId){
  if(!propertyId)throw httpError(400,"Falta la propiedad.")
  const{data,error}=await client.from("property_members").select("role").eq("property_id",propertyId).eq("user_id",userId).maybeSingle()
  if(error)throw httpError(403,"No pudimos validar el acceso a esta propiedad.")
  if(!data?.role)throw httpError(403,"No tenés acceso a esta propiedad.")
  return String(data.role)
}
export async function requireRole(client,userId,propertyId,roles=FRONTDESK_ROLES){const role=await memberRole(client,userId,propertyId);if(!roles.includes(role))throw httpError(403,"Tu rol no puede realizar esta operación.");return role}
export function canManage(role){return MANAGE_ROLES.includes(String(role||""))}
export{MANAGE_ROLES,FRONTDESK_ROLES,MP_API}

export function seal(value,aad="hotel-mercadopago"){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",cipherKey(),iv);cipher.setAAD(Buffer.from(aad));const encrypted=Buffer.concat([cipher.update(String(value),"utf8"),cipher.final()]),tag=cipher.getAuthTag();return[iv,tag,encrypted].map(x=>x.toString("base64url")).join(".")
}
export function unseal(value,aad="hotel-mercadopago"){
  try{const[ivRaw,tagRaw,dataRaw]=String(value||"").split("."),iv=Buffer.from(ivRaw,"base64url"),tag=Buffer.from(tagRaw,"base64url"),data=Buffer.from(dataRaw,"base64url"),decipher=crypto.createDecipheriv("aes-256-gcm",cipherKey(),iv);decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8")}catch{throw httpError(400,"La credencial cifrada no es válida.")}
}
export function createOAuthState({propertyId,userId}){
  const verifier=crypto.randomBytes(48).toString("base64url"),payload={property_id:propertyId,user_id:userId,verifier,exp:Date.now()+15*60*1000,nonce:crypto.randomUUID()};return{state:seal(JSON.stringify(payload),"mp-oauth-state"),verifier,challenge:crypto.createHash("sha256").update(verifier).digest("base64url")}
}
export function readOAuthState(state){let payload;try{payload=JSON.parse(unseal(state,"mp-oauth-state"))}catch{throw httpError(400,"El estado de conexión de Mercado Pago no es válido.")}if(!payload?.property_id||!payload?.user_id||!payload?.verifier||Number(payload.exp)<Date.now())throw httpError(400,"La conexión con Mercado Pago venció. Volvé a iniciarla.");return payload}
export function authorizationUrl({state,challenge}){if(!platformReady())throw httpError(503,"Mercado Pago todavía no está activado en Habitación Llena.");const url=new URL(MP_AUTH);url.searchParams.set("response_type","code");url.searchParams.set("client_id",process.env.MERCADOPAGO_CLIENT_ID);url.searchParams.set("redirect_uri",redirectUri());url.searchParams.set("state",state);url.searchParams.set("code_challenge",challenge);url.searchParams.set("code_challenge_method","S256");return url.toString()}

export async function mpFetch(path,{accessToken,method="GET",body,idempotencyKey}={}){
  const headers={Authorization:`Bearer ${accessToken}`,Accept:"application/json"};if(body!==undefined)headers["Content-Type"]="application/json";if(idempotencyKey)headers["X-Idempotency-Key"]=String(idempotencyKey)
  const response=await fetch(`${MP_API}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"}),text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
  if(!response.ok)throw httpError(response.status>=500?502:400,data?.message||data?.error||`Mercado Pago respondió ${response.status}.`,data)
  return data
}
export async function exchangeCode({code,verifier}){
  if(!platformReady())throw httpError(503,"Mercado Pago todavía no está activado en Habitación Llena.")
  const response=await fetch(`${MP_API}/oauth/token`,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({client_id:process.env.MERCADOPAGO_CLIENT_ID,client_secret:process.env.MERCADOPAGO_CLIENT_SECRET,grant_type:"authorization_code",code,redirect_uri:redirectUri(),code_verifier:verifier}),cache:"no-store"}),data=await response.json().catch(()=>({}));if(!response.ok)throw httpError(400,data?.message||data?.error||"Mercado Pago rechazó la autorización.",data);return data
}

export async function loadConnection(client,propertyId){const{data,error}=await client.from("hotel_payment_connections").select("*").eq("property_id",propertyId).maybeSingle();if(error)throw httpError(400,error.message);return data||null}
export function safeConnection(row,role=""){
  if(!row)return{connected:false,status:"disconnected",can_manage:canManage(role)}
  return{connected:row.status==="connected",status:row.status,provider:row.provider,external_user_id:row.external_user_id||null,public_key:row.public_key||null,live_mode:!!row.live_mode,token_expires_at:row.token_expires_at||null,updated_at:row.updated_at||null,can_manage:canManage(role)}
}
export async function accessTokenFor(client,propertyId){const row=await loadConnection(client,propertyId);if(!row||row.status!=="connected"||!row.access_token_encrypted)throw httpError(409,"Este hotel todavía no conectó su cuenta de Mercado Pago.");if(row.token_expires_at&&new Date(row.token_expires_at).getTime()<=Date.now())throw httpError(409,"La conexión de Mercado Pago venció. Un administrador tiene que reconectarla.");return{row,accessToken:unseal(row.access_token_encrypted,`mp:${propertyId}`)}}

export function safeGuarantee(row){
  if(!row)return null
  return{id:row.id,status:row.status,provider:row.provider,guarantee_type:row.guarantee_type,customer_id:row.customer_id||null,card_id:row.card_id||null,payment_method_id:row.payment_method_id||null,card_brand:row.card_brand||null,last_four:row.last_four||null,expiration_month:row.expiration_month||null,expiration_year:row.expiration_year||null,authorized_amount:Number(row.authorized_amount||0),captured_amount:Number(row.captured_amount||0),currency:row.currency||"ARS",authorization_expires_at:row.authorization_expires_at||null,consent_accepted_at:row.consent_accepted_at||null,updated_at:row.updated_at||null}
}
export async function reservationFor(client,reservationId){const{data,error}=await client.from("reservas").select("id,property_id,numero_reserva,nombre_huesped,email_huesped,dni_huesped,precio_total,moneda,servicios,garantia_tipo,garantia_marca,garantia_ultimos4,garantia_vencimiento").eq("id",Number(reservationId)).single();if(error||!data)throw httpError(404,error?.message||"Reserva no encontrada.");return data}
export async function guaranteeFor(client,propertyId,reservationId){const{data,error}=await client.from("hotel_guarantees").select("*").eq("property_id",propertyId).eq("reserva_id",Number(reservationId)).maybeSingle();if(error)throw httpError(400,error.message);return data||null}
export async function auditEvent(client,{guaranteeId,propertyId,reservationId,eventType,amount=null,currency=null,providerRef=null,detail={},userId}){const{error}=await client.from("hotel_guarantee_events").insert({guarantee_id:guaranteeId,property_id:propertyId,reserva_id:Number(reservationId),event_type:eventType,amount,currency,provider_ref:providerRef,detail,created_by:userId});if(error)throw httpError(400,error.message)}