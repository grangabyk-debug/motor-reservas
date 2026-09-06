import{createClient}from"@supabase/supabase-js"
import HotelSite from"./HotelSite"

async function config(slug){try{const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)return null;const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),{data,error}=await client.rpc("hl_public_booking_config",{p_slug:slug});return error?null:data}catch{return null}}
export async function generateMetadata({params}){const{slug}=await params,data=await config(slug),title=data?.seo_title||data?.name||"Hotel",description=data?.seo_description||data?.description||data?.booking_message||"Reserva directa con disponibilidad en tiempo real.";return{title,description,robots:{index:Boolean(data),follow:Boolean(data)}}}
export default async function HotelPage({params}){const{slug}=await params;return <HotelSite slug={slug}/>}
