import{createClient}from"@supabase/supabase-js"

function publicClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error("Motor de reservas sin configuración de servidor.");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
const err=(message,status=400)=>Response.json({error:message},{status,headers:{"Cache-Control":"no-store"}})

export async function GET(request,{params}){try{const{slug}=await params,client=publicClient(),{data,error}=await client.rpc("hl_public_booking_config",{p_slug:slug});if(error)throw error;const ownOrigin=new URL(request.url).origin,allowed=Array.isArray(data?.allowed_origins)?data.allowed_origins.filter(Boolean):[],engine={...data,allowed_origins:[...new Set([ownOrigin,...allowed])]};return Response.json({engine},{headers:{"Cache-Control":"public, max-age=60, stale-while-revalidate=300"}})}catch(error){console.error("booking config",error);return err("Este motor de reservas no está disponible.",404)}}
