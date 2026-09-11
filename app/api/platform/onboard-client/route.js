import{NextResponse}from"next/server"
import{createClient}from"@supabase/supabase-js"

const json=(body,status=200)=>NextResponse.json(body,{status})
const emailRx=/^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request){
  let invitedUserId=null
  try{
    const body=await request.json()
    const propertyName=String(body?.propertyName||"").trim(),city=String(body?.city||"").trim(),ownerName=String(body?.ownerName||"").trim(),ownerEmail=String(body?.ownerEmail||"").trim().toLowerCase(),planCode=String(body?.planCode||"base").trim().toLowerCase(),billingCycle=String(body?.billingCycle||"monthly").trim().toLowerCase(),roomTier=String(body?.roomTier||"").trim()||null,priceCurrency=String(body?.priceCurrency||"ARS").trim().toUpperCase(),notes=String(body?.notes||"").trim()||null
    const roomLimit=body?.roomLimit==null||body.roomLimit===""?null:Number(body.roomLimit),priceAmount=body?.priceAmount==null||body.priceAmount===""?null:Number(body.priceAmount),trialDays=Math.max(0,Math.min(90,Number(body?.trialDays||0))),modules=Array.isArray(body?.modules)?[...new Set(body.modules.map(value=>String(value).trim()).filter(Boolean))]:null
    if(!propertyName||!ownerEmail)return json({error:"Nombre del alojamiento y email del propietario son obligatorios."},400)
    if(!emailRx.test(ownerEmail))return json({error:"El email del propietario no es válido."},400)
    if(!["monthly","annual"].includes(billingCycle))return json({error:"Ciclo de facturación inválido."},400)
    if(roomLimit!=null&&(!Number.isFinite(roomLimit)||roomLimit<1))return json({error:"El límite de habitaciones debe ser mayor a cero."},400)
    if(priceAmount!=null&&(!Number.isFinite(priceAmount)||priceAmount<0))return json({error:"El precio no es válido."},400)

    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secretKey=process.env.SUPABASE_SECRET_KEY,authorization=request.headers.get("authorization")
    if(!supabaseUrl||!publishableKey||!secretKey)return json({error:"Faltan variables de configuración del servidor."},500)
    if(!authorization?.startsWith("Bearer "))return json({error:"No estás autenticado."},401)

    const userClient=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}}),adminClient=createClient(supabaseUrl,secretKey,{auth:{autoRefreshToken:false,persistSession:false}})
    const{data:{user:currentUser},error:userError}=await userClient.auth.getUser()
    if(userError||!currentUser)return json({error:"La sesión no es válida."},401)
    const{data:isAdmin,error:adminError}=await userClient.rpc("hl_is_platform_admin")
    if(adminError||!isAdmin)return json({error:"No tenés permisos para dar de alta clientes."},403)

    let existing=null,page=1
    while(page<=10&&!existing){const{data,error}=await adminClient.auth.admin.listUsers({page,perPage:1000});if(error)return json({error:"No se pudo consultar usuarios existentes."},500);existing=(data.users||[]).find(user=>user.email?.toLowerCase()===ownerEmail)||null;if((data.users||[]).length<1000)break;page++}
    let ownerId,invited=false
    if(existing)ownerId=existing.id
    else{
      const redirectTo=`${request.nextUrl.origin}/reset-password`,{data,error}=await adminClient.auth.admin.inviteUserByEmail(ownerEmail,{redirectTo,data:{full_name:ownerName||propertyName}})
      if(error)return json({error:error.message||"No se pudo enviar la invitación al propietario."},400)
      ownerId=data.user.id;invited=true;invitedUserId=ownerId
    }

    const{data,error}=await userClient.rpc("hl_platform_admin_onboard_property",{p_owner_id:ownerId,p_owner_name:ownerName||ownerEmail,p_owner_email:ownerEmail,p_property_name:propertyName,p_city:city||null,p_plan_code:planCode,p_billing_cycle:billingCycle,p_room_tier:roomTier,p_room_limit:roomLimit,p_price_amount:priceAmount,p_price_currency:priceCurrency,p_trial_days:trialDays,p_enabled_modules:modules,p_notes:notes})
    if(error||data?.error){if(invitedUserId)await adminClient.auth.admin.deleteUser(invitedUserId);return json({error:error?.message||data?.error||"No se pudo completar el alta del cliente."},400)}
    return json({success:true,...data,owner:{id:ownerId,email:ownerEmail,invited},message:invited?"Cliente creado e invitación enviada.":"Cliente creado y vinculado a un usuario existente."})
  }catch(error){
    if(invitedUserId){try{const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,secretKey=process.env.SUPABASE_SECRET_KEY;if(supabaseUrl&&secretKey){const adminClient=createClient(supabaseUrl,secretKey,{auth:{autoRefreshToken:false,persistSession:false}});await adminClient.auth.admin.deleteUser(invitedUserId)}}catch{}}
    console.error("PLATFORM ONBOARD CLIENT ERROR:",error)
    return json({error:error?.message||"No se pudo completar el alta del cliente."},500)
  }
}
