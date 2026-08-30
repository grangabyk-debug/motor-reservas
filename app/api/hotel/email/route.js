import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function money(value,currency="ARS"){
  const n=Number(value||0)
  return currency==="USD"?`US$ ${n.toLocaleString("es-AR",{maximumFractionDigits:2})}`:`$ ${Math.round(n).toLocaleString("es-AR")}`
}

export async function POST(request){
  try{
    const authorization=request.headers.get("authorization")
    if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"No estás autenticado."},{status:401})
    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
    const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if(!supabaseUrl||!publishableKey)return NextResponse.json({error:"Falta configuración del servidor."},{status:500})
    const client=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
    const {data:{user},error:userError}=await client.auth.getUser()
    if(userError||!user)return NextResponse.json({error:"La sesión no es válida."},{status:401})
    const body=await request.json().catch(()=>null)
    const reservationId=Number(body?.reservation_id)
    if(!reservationId)return NextResponse.json({error:"Falta la reserva."},{status:400})
    const {data:r,error}=await client.from("reservas").select("id,property_id,numero_reserva,nombre_huesped,email_huesped,fecha_entrada,fecha_salida,habitacion_id,precio_total,moneda,notas").eq("id",reservationId).single()
    if(error||!r)return NextResponse.json({error:error?.message||"Reserva no encontrada."},{status:404})
    if(!r.email_huesped)return NextResponse.json({error:"La reserva no tiene email cargado."},{status:400})
    const [{data:settings},{data:room}]=await Promise.all([
      client.from("hotel_os_settings").select("hotel_name,motto,operational_settings").eq("property_id",r.property_id).maybeSingle(),
      client.from("habitaciones").select("nombre").eq("id",r.habitacion_id).maybeSingle(),
    ])
    const hotel=settings?.hotel_name||"Habitación Llena"
    const ops=settings?.operational_settings&&typeof settings.operational_settings==="object"?settings.operational_settings:{}
    const subject=`${hotel} · Reserva ${r.numero_reserva||r.id}`
    const text=`Hola ${r.nombre_huesped},\n\nConfirmamos tu reserva en ${hotel}.\nHabitación: ${room?.nombre||r.habitacion_id}\nLlegada: ${r.fecha_entrada}\nSalida: ${r.fecha_salida}\nTotal: ${money(r.precio_total,r.moneda)}\n\n${settings?.motto||""}`
    const mailto=`mailto:${encodeURIComponent(r.email_huesped)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
    if(ops?.email?.mode==="mailto"||!process.env.RESEND_API_KEY||!process.env.HOTEL_EMAIL_FROM){
      return NextResponse.json({mode:"mailto",mailto,reason:"provider_not_configured"})
    }
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.HOTEL_EMAIL_FROM,to:[r.email_huesped],subject,text,reply_to:process.env.HOTEL_EMAIL_REPLY_TO||undefined})})
    const result=await response.json().catch(()=>({}))
    if(!response.ok)return NextResponse.json({mode:"mailto",mailto,error:result?.message||`Proveedor respondió ${response.status}`},{status:200})
    await client.from("reservas").update({email_resumen_enviado_at:new Date().toISOString()}).eq("id",r.id).eq("property_id",r.property_id)
    return NextResponse.json({mode:"sent",id:result?.id||null})
  }catch(error){
    return NextResponse.json({error:error?.message||"No se pudo enviar la confirmación."},{status:500})
  }
}
