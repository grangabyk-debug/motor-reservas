import crypto from"node:crypto"
import{createClient}from"@supabase/supabase-js"

const ALLOWED_SCOPES=new Set(["reservations:read"])
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||min))
function clientWithToken(token){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error("Falta configuración pública de Supabase.");return createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}})}
async function context(request){const auth=request.headers.get("authorization")||"";if(!auth.startsWith("Bearer "))throw Object.assign(new Error("No autenticado."),{status:401});const client=clientWithToken(auth.slice(7)),{data:{user},error}=await client.auth.getUser();if(error||!user)throw Object.assign(new Error("Sesión inválida."),{status:401});return{client,user}}
async function requireAction(client,propertyId,action){const{data,error}=await client.rpc("hl_can_property_action",{p_property_id:propertyId,p_action:action});if(error)throw error;if(!data)throw Object.assign(new Error("Tu rol no tiene permiso para administrar claves API."),{status:403})}
function failure(error){const code=String(error?.code||""),status=Number(error?.status)||(code==="42501"?403:code==="P0002"?404:code==="22023"?400:500);return Response.json({error:error?.message||"No se pudo completar la operación."},{status})}

export async function GET(request){
  try{const propertyId=new URL(request.url).searchParams.get("property_id"),{client}=await context(request);if(!propertyId)return Response.json({error:"Falta la propiedad."},{status:400});const{data,error}=await client.rpc("hl_api_keys_snapshot",{p_property_id:propertyId});if(error)throw error;const{data:allowed}=await client.rpc("hl_can_property_action",{p_property_id:propertyId,p_action:"api.manage_keys"});return Response.json({...data,can_manage:Boolean(allowed)})}
  catch(error){return failure(error)}
}

export async function POST(request){
  try{const body=await request.json().catch(()=>({})),propertyId=String(body.property_id||""),name=String(body.name||"").trim().slice(0,80),{client}=await context(request);if(!propertyId)return Response.json({error:"Falta la propiedad."},{status:400});await requireAction(client,propertyId,"api.manage_keys");if(!name)return Response.json({error:"Ingresá un nombre para identificar la clave."},{status:400})
    const scopes=[...new Set((Array.isArray(body.scopes)?body.scopes:[]).map(String).filter(scope=>ALLOWED_SCOPES.has(scope)))];if(!scopes.length)return Response.json({error:"Elegí al menos un permiso disponible."},{status:400})
    const rateLimit=clamp(body.rate_limit_per_min||60,1,600),expiresDays=Number(body.expires_days||0),expiresAt=expiresDays>0?new Date(Date.now()+clamp(expiresDays,1,3650)*86400000).toISOString():null,prefix=crypto.randomBytes(5).toString("hex"),secret=`hl_${prefix}_${crypto.randomBytes(30).toString("base64url")}`,hash=crypto.createHash("sha256").update(secret).digest("hex"),{data,error}=await client.rpc("hl_api_key_create",{p_property_id:propertyId,p_name:name,p_prefix:prefix,p_hash:hash,p_scopes:scopes,p_rate_limit:rateLimit,p_expires_at:expiresAt});if(error)throw error
    return Response.json({key:data,secret,notice:"Copiá esta clave ahora. Por seguridad no se volverá a mostrar."},{status:201})
  }catch(error){return failure(error)}
}

export async function PATCH(request){
  try{const body=await request.json().catch(()=>({})),propertyId=String(body.property_id||""),keyId=String(body.key_id||""),action=String(body.action||""),{client}=await context(request);if(!propertyId||!keyId||action!=="revoke")return Response.json({error:"Acción de clave inválida."},{status:400});await requireAction(client,propertyId,"api.manage_keys");const{data,error}=await client.rpc("hl_api_key_revoke",{p_property_id:propertyId,p_key_id:keyId});if(error)throw error;return Response.json({key:data})}
  catch(error){return failure(error)}
}
