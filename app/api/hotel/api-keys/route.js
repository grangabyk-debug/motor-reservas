import crypto from"node:crypto"
import{createClient}from"@supabase/supabase-js"

const MANAGE_ROLES=new Set(["owner","manager","admin"])
const ALLOWED_SCOPES=new Set(["reservations:read"])
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||min))
function clientWithToken(token){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error("Falta configuración pública de Supabase.");return createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}})}
function adminClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function safeKey(row){if(!row)return null;const{key_hash,...safe}=row;return safe}
async function managementContext(request,propertyId){
  const auth=request.headers.get("authorization")||"";if(!auth.startsWith("Bearer "))throw Object.assign(new Error("No autenticado."),{status:401})
  const client=clientWithToken(auth.slice(7)),{data:{user},error:userError}=await client.auth.getUser();if(userError||!user)throw Object.assign(new Error("Sesión inválida."),{status:401})
  if(!propertyId)throw Object.assign(new Error("Falta la propiedad."),{status:400})
  const[{data:property,error:propertyError},{data:membership,error:membershipError}]=await Promise.all([client.from("properties").select("id,owner_id,name").eq("id",propertyId).maybeSingle(),client.from("property_members").select("role").eq("property_id",propertyId).eq("user_id",user.id).maybeSingle()])
  if(propertyError||!property)throw Object.assign(new Error("Propiedad no encontrada o sin acceso."),{status:404});if(membershipError)throw membershipError
  const role=property.owner_id===user.id?"owner":membership?.role||"member";if(!MANAGE_ROLES.has(role))throw Object.assign(new Error("Tu rol no puede administrar claves API."),{status:403})
  const admin=adminClient();if(!admin)throw Object.assign(new Error("El servicio de claves API todavía no tiene acceso administrativo configurado."),{status:503})
  return{admin,user,property,role}
}
function failure(error){return Response.json({error:error?.message||"No se pudo completar la operación."},{status:Number(error?.status)||500})}

export async function GET(request){
  try{const url=new URL(request.url),propertyId=url.searchParams.get("property_id"),{admin}=await managementContext(request,propertyId),since=new Date(Date.now()-86400000).toISOString(),[keysRes,logsRes,countRes,errorCountRes]=await Promise.all([admin.from("hotel_api_keys").select("id,property_id,name,key_prefix,scopes,status,rate_limit_per_min,expires_at,last_used_at,created_by,created_at,revoked_at").eq("property_id",propertyId).order("created_at",{ascending:false}),admin.from("hotel_api_request_logs").select("id,api_key_id,method,path,status_code,duration_ms,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(50),admin.from("hotel_api_request_logs").select("id",{count:"exact",head:true}).eq("property_id",propertyId).gte("created_at",since),admin.from("hotel_api_request_logs").select("id",{count:"exact",head:true}).eq("property_id",propertyId).gte("created_at",since).gte("status_code",400)]);for(const result of[keysRes,logsRes,countRes,errorCountRes])if(result.error)throw result.error
    return Response.json({keys:(keysRes.data||[]).map(safeKey),logs:logsRes.data||[],metrics:{requests_24h:Number(countRes.count)||0,errors_24h:Number(errorCountRes.count)||0},available_scopes:[{id:"reservations:read",label:"Reservas · lectura",description:"Consultar reservas de esta propiedad sin modificar datos."}]})
  }catch(error){return failure(error)}
}

export async function POST(request){
  try{const body=await request.json().catch(()=>({})),propertyId=String(body.property_id||""),{admin,user}=await managementContext(request,propertyId),name=String(body.name||"").trim().slice(0,80);if(!name)return Response.json({error:"Ingresá un nombre para identificar la clave."},{status:400})
    const scopes=[...new Set((Array.isArray(body.scopes)?body.scopes:[]).map(String).filter(scope=>ALLOWED_SCOPES.has(scope)))];if(!scopes.length)return Response.json({error:"Elegí al menos un permiso disponible."},{status:400})
    const rateLimit=clamp(body.rate_limit_per_min||60,1,600),expiresDays=Number(body.expires_days||0),expiresAt=expiresDays>0?new Date(Date.now()+clamp(expiresDays,1,3650)*86400000).toISOString():null,prefix=crypto.randomBytes(5).toString("hex"),secret=`hl_${prefix}_${crypto.randomBytes(30).toString("base64url")}`,hash=crypto.createHash("sha256").update(secret).digest("hex")
    const{data,error}=await admin.from("hotel_api_keys").insert({property_id:propertyId,name,key_prefix:prefix,key_hash:hash,scopes,status:"active",rate_limit_per_min:rateLimit,expires_at:expiresAt,created_by:user.id}).select("id,property_id,name,key_prefix,scopes,status,rate_limit_per_min,expires_at,last_used_at,created_by,created_at,revoked_at").single();if(error)throw error
    return Response.json({key:data,secret,notice:"Copiá esta clave ahora. Por seguridad no se volverá a mostrar."},{status:201})
  }catch(error){return failure(error)}
}

export async function PATCH(request){
  try{const body=await request.json().catch(()=>({})),propertyId=String(body.property_id||""),keyId=String(body.key_id||""),action=String(body.action||"");if(!keyId||action!=="revoke")return Response.json({error:"Acción de clave inválida."},{status:400});const{admin}=await managementContext(request,propertyId),{data,error}=await admin.from("hotel_api_keys").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("id",keyId).eq("property_id",propertyId).eq("status","active").select("id,property_id,name,key_prefix,scopes,status,rate_limit_per_min,expires_at,last_used_at,created_by,created_at,revoked_at").maybeSingle();if(error)throw error;if(!data)return Response.json({error:"La clave no existe o ya estaba revocada."},{status:404});return Response.json({key:data})
  }catch(error){return failure(error)}
}
