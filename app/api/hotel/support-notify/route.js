import{NextResponse}from"next/server"
import{createClient}from"@supabase/supabase-js"

export async function POST(request){
  try{
    const authorization=request.headers.get("authorization")
    if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"No estás autenticado."},{status:401})
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if(!url||!key)return NextResponse.json({error:"Falta configuración del servidor."},{status:500})
    const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
    const{data:{user},error:userError}=await client.auth.getUser();if(userError||!user)return NextResponse.json({error:"Sesión inválida."},{status:401})
    const body=await request.json().catch(()=>null),propertyId=String(body?.propertyId||""),threadId=String(body?.threadId||""),messageId=String(body?.messageId||"")
    if(!propertyId||!threadId||!messageId)return NextResponse.json({error:"Faltan datos del mensaje."},{status:400})
    const[{data:thread,error:threadError},{data:message,error:messageError},{data:property,error:propertyError}]=await Promise.all([
      client.from("hotel_support_threads").select("id,property_id,subject,priority").eq("id",threadId).eq("property_id",propertyId).single(),
      client.from("hotel_support_messages").select("id,thread_id,property_id,body,sender_kind,created_at").eq("id",messageId).eq("thread_id",threadId).eq("property_id",propertyId).single(),
      client.from("properties").select("id,name,city").eq("id",propertyId).single(),
    ])
    if(threadError||messageError||propertyError||!thread||!message||!property)return NextResponse.json({error:"No pudimos validar la consulta."},{status:404})
    if(message.sender_kind!=="hotel")return NextResponse.json({error:"Tipo de mensaje inválido."},{status:400})
    const supportEmail=process.env.HOTEL_SUPPORT_EMAIL
    if(!supportEmail||!process.env.RESEND_API_KEY||!process.env.HOTEL_EMAIL_FROM)return NextResponse.json({ok:true,emailConfigured:false})
    const subject=`Habitación Llena · ${property.name} · ${thread.subject}`
    const text=`Nuevo mensaje de soporte\n\nHotel: ${property.name}${property.city?` · ${property.city}`:""}\nPrioridad: ${thread.priority}\nConsulta: ${thread.subject}\nUsuario: ${user.email||user.id}\n\n${message.body}\n\nThread: ${thread.id}`
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.HOTEL_EMAIL_FROM,to:[supportEmail],subject,text,reply_to:user.email||undefined})})
    const result=await response.json().catch(()=>({}))
    if(!response.ok)return NextResponse.json({ok:true,emailConfigured:true,emailSent:false,error:result?.message||`Proveedor respondió ${response.status}`})
    return NextResponse.json({ok:true,emailConfigured:true,emailSent:true,id:result?.id||null})
  }catch(error){return NextResponse.json({error:error?.message||"No se pudo notificar a soporte."},{status:500})}
}
