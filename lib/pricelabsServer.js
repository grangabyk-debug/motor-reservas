import crypto from"node:crypto"
import{createClient}from"@supabase/supabase-js"

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SECRET_KEY=process.env.SUPABASE_SECRET_KEY
const MANAGE_ROLES=["owner","manager","admin","revenue"]

export function priceLabsPlatformState(){
  const integrationName=String(process.env.PRICELABS_INTEGRATION_NAME||"").trim(),integrationToken=String(process.env.PRICELABS_INTEGRATION_TOKEN||"").trim(),baseUrl=String(process.env.PRICELABS_IAPI_BASE_URL||"").trim().replace(/\/$/,"")
  const missing=[];if(!integrationName)missing.push("PRICELABS_INTEGRATION_NAME");if(!integrationToken)missing.push("PRICELABS_INTEGRATION_TOKEN");if(!baseUrl)missing.push("PRICELABS_IAPI_BASE_URL")
  return{ready:missing.length===0,missing,integration_name:integrationName||null,base_url:baseUrl||null}
}
export function priceLabsCallbacks(origin){const base=String(process.env.PRICELABS_CALLBACK_BASE_URL||origin||"https://habitacionllena.com").replace(/\/$/,"");return{sync_url:`${base}/api/integrations/pricelabs/sync`,calendar_trigger_url:`${base}/api/integrations/pricelabs/calendar-trigger`,hook_url:`${base}/api/integrations/pricelabs/hook`}}
export function adminSupabase(){if(!SUPABASE_URL||!SUPABASE_SECRET_KEY)throw Object.assign(new Error("Faltan variables de Supabase del servidor."),{status:500});return createClient(SUPABASE_URL,SUPABASE_SECRET_KEY,{auth:{autoRefreshToken:false,persistSession:false}})}
export async function requirePriceLabsRole(request,propertyId,roles=MANAGE_ROLES){
  const authorization=request.headers.get("authorization")||"",accessToken=authorization.startsWith("Bearer ")?authorization.slice(7):"";if(!accessToken)throw Object.assign(new Error("Sesión no autorizada."),{status:401})
  const db=adminSupabase(),{data:{user},error:userError}=await db.auth.getUser(accessToken);if(userError||!user)throw Object.assign(new Error("Sesión inválida."),{status:401})
  const{data:property,error:propertyError}=await db.from("properties").select("id,owner_id,name,city").eq("id",propertyId).maybeSingle();if(propertyError)throw propertyError;if(!property)throw Object.assign(new Error("Propiedad inexistente."),{status:404})
  let role=property.owner_id===user.id?"owner":null;if(!role){const{data:member,error:memberError}=await db.from("property_members").select("role").eq("property_id",propertyId).eq("user_id",user.id).maybeSingle();if(memberError)throw memberError;role=member?.role||null}
  if(!role||(roles.length&&!roles.includes(role)))throw Object.assign(new Error("No tenés permisos para administrar PriceLabs en esta propiedad."),{status:403});return{db,user,role,property}
}
export function listingIdFor(propertyId,roomTypeId){return`hl_${String(propertyId).replace(/-/g,"")}_${String(roomTypeId).replace(/-/g,"")}`}
export function hashPayload(raw){return crypto.createHash("sha256").update(String(raw||"")).digest("hex")}
function hmac(value,key){return crypto.createHmac("sha256",key).update(value).digest("hex")}
function safeEqual(a,b){const left=Buffer.from(String(a||"")),right=Buffer.from(String(b||""));return left.length===right.length&&left.length>0&&crypto.timingSafeEqual(left,right)}
export function verifyPriceLabsSignature(request,rawBody){
  const token=String(process.env.PRICELABS_INTEGRATION_TOKEN||"").trim();if(!token)throw Object.assign(new Error("PriceLabs todavía no tiene credencial de partner configurada."),{status:503,code:"pricelabs_partner_credentials_missing"})
  const source=request.headers.get("x-source")||"",timestamp=request.headers.get("x-pl-timestamp")||"",requestId=request.headers.get("x-pl-requestid")||"",signedHeaders=request.headers.get("x-pl-signed-headers")||"",signedBody=request.headers.get("x-pl-signed-body")||"";if(!source||!timestamp||!requestId||!signedHeaders||!signedBody)throw Object.assign(new Error("Firma de PriceLabs incompleta."),{status:401})
  const version=String(signedHeaders).split(".",1)[0]||"v1",expectedHeaders=`${version}.${hmac(`${version}:${source}:${timestamp}:${requestId}`,token)}`,expectedBody=hmac(`${expectedHeaders}${rawBody}`,token)
  if(!safeEqual(signedHeaders,expectedHeaders)||!safeEqual(signedBody,expectedBody))throw Object.assign(new Error("Firma de PriceLabs inválida."),{status:401})
  return{source,timestamp,requestId,version}
}
export async function priceLabsFetch(path,{method="POST",body}={}){const state=priceLabsPlatformState();if(!state.ready)throw Object.assign(new Error(`Falta completar la configuración de partner de PriceLabs: ${state.missing.join(", ")}.`),{status:503,code:"pricelabs_partner_credentials_missing"});const response=await fetch(`${state.base_url}${path}`,{method,headers:{"Content-Type":"application/json","X-INTEGRATION-NAME":process.env.PRICELABS_INTEGRATION_NAME,"X-INTEGRATION-TOKEN":process.env.PRICELABS_INTEGRATION_TOKEN},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"}),text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}if(!response.ok)throw Object.assign(new Error(payload?.message||payload?.error||`PriceLabs respondió ${response.status}.`),{status:response.status>=500?502:400,detail:payload});return payload}
export function extractListingIds(value){const found=new Set(),visit=node=>{if(!node)return;if(Array.isArray(node)){node.forEach(visit);return}if(typeof node!=="object")return;for(const[key,val]of Object.entries(node)){const normalized=key.toLowerCase().replace(/[^a-z]/g,"");if(["listingid","listingids"].includes(normalized)){if(Array.isArray(val))val.forEach(item=>found.add(String(item)));else if(val!=null)found.add(String(val))}else visit(val)}};visit(value);return[...found]}
export async function logPriceLabsEvent(db,{propertyId=null,listingId=null,requestId=null,eventKind,signatureValid=true,rawBody="",status="received",detail={}}){const payload={property_id:propertyId,listing_id:listingId,request_id:requestId,event_kind:eventKind,signature_valid:signatureValid,payload_hash:hashPayload(rawBody),status,detail,processed_at:status==="processed"?new Date().toISOString():null};if(requestId){const existing=await db.from("hotel_pricelabs_events").select("id,status").eq("request_id",requestId).maybeSingle();if(existing.error)throw existing.error;if(existing.data)return{duplicate:true,event:existing.data}}const inserted=await db.from("hotel_pricelabs_events").insert(payload).select("id,status").single();if(inserted.error)throw inserted.error;return{duplicate:false,event:inserted.data}}
export async function resolvePriceLabsListings(db,listingIds){if(!listingIds.length)return[];const{data,error}=await db.from("hotel_pricelabs_listings").select("id,property_id,room_type_id,listing_id,status,enabled,metadata").in("listing_id",listingIds);if(error)throw error;return data||[]}
export async function updateConnection(db,propertyId,patch){const{data,error}=await db.from("hotel_pricelabs_connections").update({...patch,updated_at:new Date().toISOString()}).eq("property_id",propertyId).select("*").maybeSingle();if(error)throw error;return data}
