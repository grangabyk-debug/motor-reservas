import{createHash}from"node:crypto"
import{createClient}from"@supabase/supabase-js"

function publicClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error("Motor de reservas sin configuración de servidor.");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
const text=(value,max)=>String(value||"").trim().slice(0,max)
function clientKey(request){const ip=(request.headers.get("x-forwarded-for")||request.headers.get("x-real-ip")||"unknown").split(",")[0].trim(),agent=request.headers.get("user-agent")||"";return createHash("sha256").update(`${ip}|${agent}`).digest("hex").slice(0,48)}

export async function POST(request,{params}){
  try{
    const{slug}=await params,raw=await request.json().catch(()=>null);if(!raw)return Response.json({error:"Solicitud inválida."},{status:400,headers:{"Cache-Control":"no-store"}})
    const payload={name:text(raw.name,160),email:text(raw.email,180).toLowerCase(),reservation_code:text(raw.reservation_code,120),detail:text(raw.detail,1200)}
    if(!payload.name||!payload.email||!payload.email.includes("@"))return Response.json({error:"Completá nombre y un email válido."},{status:400,headers:{"Cache-Control":"no-store"}})
    const client=publicClient(),limit=await client.rpc("hl_public_booking_rate_limit",{p_slug:slug,p_client_key:`regret:${clientKey(request)}`,p_limit:6,p_window_minutes:15});if(limit.error)throw limit.error
    if(limit.data!==true)return Response.json({error:"Se realizaron demasiadas solicitudes. Esperá unos minutos y volvé a intentar."},{status:429,headers:{"Retry-After":"300","Cache-Control":"no-store"}})
    const{data,error}=await client.rpc("hl_public_booking_regret",{p_slug:slug,p_payload:payload});if(error)throw error
    return Response.json(data,{status:201,headers:{"Cache-Control":"no-store"}})
  }catch(error){console.error("public booking regret",error);return Response.json({error:"No se pudo registrar la solicitud. Volvé a intentar o contactá al hotel."},{status:400,headers:{"Cache-Control":"no-store"}})}
}
