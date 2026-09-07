import{createClient}from"@supabase/supabase-js"

const reserved=new Set(["www","app","api","admin","panel","motor","reservas"])
function client(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
export function cleanHost(value){return String(value||"").toLowerCase().split(":")[0].replace(/\.$/,"")}
export async function resolvePublicHotelSlug(hostValue){const host=cleanHost(hostValue);if(!host||host==="habitacionllena.com"||host==="www.habitacionllena.com"||host==="localhost"||host.endsWith(".vercel.app"))return null;if(host.endsWith(".habitacionllena.com")){const sub=host.slice(0,-".habitacionllena.com".length).split(".").pop();if(sub&&!reserved.has(sub))return sub}const supabase=client();if(!supabase)return null;try{const{data,error}=await supabase.rpc("hl_public_site_by_domain",{p_hostname:host});if(error)return null;return data?.slug||null}catch{return null}}
export async function getPublicHotelConfig(slug){const supabase=client();if(!supabase||!slug)return null;try{const{data,error}=await supabase.rpc("hl_public_booking_config",{p_slug:slug});return error?null:data}catch{return null}}
