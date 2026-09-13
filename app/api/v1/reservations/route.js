import crypto from"node:crypto"
import{createClient}from"@supabase/supabase-js"

const dateOk=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))
function publicClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function bearer(request){const auth=request.headers.get("authorization")||"";return auth.startsWith("Bearer ")?auth.slice(7).trim():""}
function ipFor(request){return(request.headers.get("x-forwarded-for")||request.headers.get("x-real-ip")||"").split(",")[0].trim().slice(0,120)||null}

export async function GET(request){
  const client=publicClient();if(!client)return Response.json({error:"API temporalmente no disponible."},{status:503})
  const raw=bearer(request);if(!raw||!raw.startsWith("hl_"))return Response.json({error:"API key inválida o ausente."},{status:401,headers:{"Cache-Control":"no-store"}})
  const url=new URL(request.url),from=url.searchParams.get("from"),to=url.searchParams.get("to"),status=String(url.searchParams.get("status")||"").trim().toLowerCase().slice(0,40),limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit"))||50)),afterId=Number(url.searchParams.get("after_id"))||0
  if(from&&!dateOk(from))return Response.json({error:"El parámetro from debe usar YYYY-MM-DD."},{status:400});if(to&&!dateOk(to))return Response.json({error:"El parámetro to debe usar YYYY-MM-DD."},{status:400})
  const hash=crypto.createHash("sha256").update(raw).digest("hex"),{data,error}=await client.rpc("hl_api_v1_reservations",{p_key_hash:hash,p_from:from||null,p_to:to||null,p_status:status||null,p_limit:limit,p_after_id:afterId,p_method:"GET",p_path:url.pathname,p_ip:ipFor(request)});if(error)return Response.json({error:"No se pudo consultar la API."},{status:500,headers:{"Cache-Control":"no-store"}})
  const payload=data||{},responseStatus=Number(payload.status)||500,headers={"Cache-Control":"no-store"};if(payload.rate_limit!=null)headers["X-RateLimit-Limit"]=String(payload.rate_limit);if(payload.remaining!=null)headers["X-RateLimit-Remaining"]=String(payload.remaining);if(responseStatus===429)headers["Retry-After"]="60"
  if(payload.ok!==true)return Response.json({error:payload.error||"No autorizado."},{status:responseStatus,headers})
  return Response.json({data:payload.data||[],meta:payload.meta||{}},{status:200,headers})
}
