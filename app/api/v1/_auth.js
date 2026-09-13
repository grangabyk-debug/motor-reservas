import crypto from"node:crypto"
import{createClient}from"@supabase/supabase-js"

function serviceClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function bearer(request){const auth=request.headers.get("authorization")||"";return auth.startsWith("Bearer ")?auth.slice(7).trim():""}
function ipFor(request){return(request.headers.get("x-forwarded-for")||request.headers.get("x-real-ip")||"").split(",")[0].trim().slice(0,120)||null}
function jsonError(message,status,headers={}){return Response.json({error:message},{status,headers:{"Cache-Control":"no-store",...headers}})}

export async function authorizeApiRequest(request,requiredScope){
  const started=Date.now(),admin=serviceClient();if(!admin)return{response:jsonError("API temporalmente no disponible.",503)}
  const raw=bearer(request);if(!raw||!raw.startsWith("hl_"))return{response:jsonError("API key inválida o ausente.",401)}
  const hash=crypto.createHash("sha256").update(raw).digest("hex"),{data:key,error}=await admin.from("hotel_api_keys").select("id,property_id,name,key_prefix,scopes,status,rate_limit_per_min,expires_at,last_used_at").eq("key_hash",hash).maybeSingle();if(error)return{response:jsonError("No se pudo validar la credencial.",503)};if(!key||key.status!=="active")return{response:jsonError("API key inválida o revocada.",401)}
  const requestPath=new URL(request.url).pathname,ip=ipFor(request),log=async statusCode=>{try{await admin.from("hotel_api_request_logs").insert({property_id:key.property_id,api_key_id:key.id,method:request.method,path:requestPath,status_code:Number(statusCode)||500,duration_ms:Math.max(0,Date.now()-started),ip})}catch{}}
  if(key.expires_at&&new Date(key.expires_at).getTime()<=Date.now()){await log(401);return{response:jsonError("La API key venció.",401)}}
  if(requiredScope&&(!Array.isArray(key.scopes)||!key.scopes.includes(requiredScope))){await log(403);return{response:jsonError(`La clave no tiene el permiso ${requiredScope}.`,403)}}
  const since=new Date(Date.now()-60000).toISOString(),{count,error:countError}=await admin.from("hotel_api_request_logs").select("id",{count:"exact",head:true}).eq("api_key_id",key.id).gte("created_at",since);if(countError){await log(503);return{response:jsonError("No se pudo verificar el límite de uso.",503)}}
  const limit=Math.max(1,Number(key.rate_limit_per_min)||60),used=Number(count)||0;if(used>=limit){await log(429);return{response:jsonError("Rate limit excedido. Reintentá en un minuto.",429,{"Retry-After":"60","X-RateLimit-Limit":String(limit),"X-RateLimit-Remaining":"0"})}}
  await admin.from("hotel_api_keys").update({last_used_at:new Date().toISOString()}).eq("id",key.id)
  return{context:{admin,key,started,log,rateLimit:limit,rateRemaining:Math.max(0,limit-used-1)}}
}

export function apiHeaders(context){return{"Cache-Control":"no-store","X-RateLimit-Limit":String(context.rateLimit),"X-RateLimit-Remaining":String(context.rateRemaining)}}
