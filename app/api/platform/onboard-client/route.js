import{NextResponse}from"next/server"
import{createClient}from"@supabase/supabase-js"

const json=(body,status=200)=>NextResponse.json(body,{status})
const emailRx=/^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request){
  let createdPropertyId=null
  try{
    const body=await request.json()
    const propertyName=String(body?.propertyName||"").trim()
    const city=String(body?.city||"").trim()
    const ownerName=String(body?.ownerName||"").trim()
    const ownerEmail=String(body?.ownerEmail||"").trim().toLowerCase()
    const planCode=String(body?.planCode||"base").trim().toLowerCase()
    const billingCycle=String(body?.billingCycle||"monthly").trim().toLowerCase()
    const roomLimit=body?.roomLimit==null||body.roomLimit===""?null:Number(body.roomLimit)
    const roomTier=String(body?.roomTier||"").trim()||null
    const priceAmount=body?.priceAmount==null||body.priceAmount===""?null:Number(body.priceAmount)
    const priceCurrency=String(body?.priceCurrency||"ARS").trim().toUpperCase()
    const trialDays=Math.max(0,Math.min(90,Number(body?.trialDays||0)))
    const customModules=Array.isArray(body?.modules)?[...new Set(body.modules.map(value=>String(value).trim()).filter(Boolean))]:null
    const notes=String(body?.notes||"").trim()||null

    if(!propertyName||!ownerEmail)return json({error:"Nombre del alojamiento y email del propietario son obligatorios."},400)
    if(!emailRx.test(ownerEmail))return json({error:"El email del propietario no es válido."},400)
    if(!["monthly","annual"].includes(billingCycle))return json({error:"Ciclo de facturación inválido."},400)
    if(roomLimit!=null&&(!Number.isFinite(roomLimit)||roomLimit<1))return json({error:"El límite de habitaciones debe ser mayor a cero."},400)
    if(priceAmount!=null&&(!Number.isFinite(priceAmount)||priceAmount<0))return json({error:"El precio no es válido."},400)

    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
    const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const secretKey=process.env.SUPABASE_SECRET_KEY
    const authorization=request.headers.get("authorization")
    if(!supabaseUrl||!publishableKey||!secretKey)return json({error:"Faltan variables de configuración del servidor."},500)
    if(!authorization?.startsWith("Bearer "))return json({error:"No estás autenticado."},401)

    const userClient=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
    const{data:{user:currentUser},error:userError}=await userClient.auth.getUser()
    if(userError||!currentUser)return json({error:"La sesión no es válida."},401)

    const adminClient=createClient(supabaseUrl,secretKey,{auth:{autoRefreshToken:false,persistSession:false}})
    const{data:platformAdmin,error:adminError}=await adminClient.from("platform_admins").select("user_id").eq("user_id",currentUser.id).maybeSingle()
    if(adminError)return json({error:"No se pudo validar el acceso de plataforma."},500)
    if(!platformAdmin)return json({error:"No tenés permisos para dar de alta clientes."},403)

    const{data:plan,error:planError}=await adminClient.from("hotel_plan_catalog").select("plan_code,label").eq("plan_code",planCode).eq("active",true).maybeSingle()
    if(planError)return json({error:"No se pudo validar el plan."},500)
    if(!plan)return json({error:"El plan seleccionado no existe o está inactivo."},400)

    let existing=null,page=1
    while(page<=10&&!existing){
      const{data,error}=await adminClient.auth.admin.listUsers({page,perPage:1000})
      if(error)return json({error:"No se pudo consultar usuarios existentes."},500)
      existing=(data.users||[]).find(user=>user.email?.toLowerCase()===ownerEmail)||null
      if((data.users||[]).length<1000)break
      page++
    }

    let ownerId,invited=false
    if(existing){ownerId=existing.id}
    else{
      const redirectTo=`${request.nextUrl.origin}/reset-password`
      const{data,error}=await adminClient.auth.admin.inviteUserByEmail(ownerEmail,{redirectTo,data:{full_name:ownerName||propertyName}})
      if(error)return json({error:error.message||"No se pudo enviar la invitación al propietario."},400)
      ownerId=data.user.id
      invited=true
    }

    const{error:profileError}=await adminClient.from("profiles").upsert({id:ownerId,full_name:ownerName||ownerEmail,role:"owner"},{onConflict:"id"})
    if(profileError)return json({error:"No se pudo preparar el perfil del propietario."},500)

    const{data:property,error:propertyError}=await adminClient.from("properties").insert({name:propertyName,city:city||null,owner_id:ownerId}).select("id,name,city,owner_id,created_at").single()
    if(propertyError)return json({error:propertyError.message||"No se pudo crear el alojamiento."},500)
    createdPropertyId=property.id

    const now=new Date(),trialing=trialDays>0,trialEnd=trialing?new Date(now.getTime()+trialDays*86400000).toISOString():null
    const subscriptionPayload={property_id:property.id,plan_code:planCode,status:trialing?"trialing":"active",billing_cycle:billingCycle,room_tier:roomTier,room_limit:roomLimit,price_amount:priceAmount,price_currency:priceCurrency,started_at:now.toISOString(),trial_starts_at:trialing?now.toISOString():null,trial_ends_at:trialEnd,source:"platform",metadata:{created_from:"platform_onboarding",created_by:currentUser.id,admin_notes:notes}}
    const{error:subError}=await adminClient.from("hotel_subscriptions").insert(subscriptionPayload)
    if(subError)throw new Error(`No se pudo crear la suscripción: ${subError.message}`)

    if(customModules){
      const{data:catalog,error:catalogError}=await adminClient.from("hotel_module_catalog").select("module_code,base_required").eq("active",true)
      if(catalogError)throw new Error("No se pudo validar el catálogo de módulos.")
      const valid=new Set((catalog||[]).map(item=>item.module_code)),selected=new Set(customModules)
      for(const moduleCode of selected)if(!valid.has(moduleCode))throw new Error(`Módulo inválido: ${moduleCode}`)
      const rows=(catalog||[]).filter(item=>!item.base_required).map(item=>({property_id:property.id,feature_code:item.module_code,enabled:selected.has(item.module_code),source:"admin",metadata:{created_from:"platform_onboarding",updated_by:currentUser.id}}))
      if(rows.length){const{error}=await adminClient.from("hotel_feature_entitlements").upsert(rows,{onConflict:"property_id,feature_code"});if(error)throw new Error(`No se pudieron guardar los módulos: ${error.message}`)}
    }

    const{error:controlError}=await adminClient.from("platform_property_controls").upsert({property_id:property.id,account_enabled:true,maintenance_mode:false,notes,updated_at:new Date().toISOString()},{onConflict:"property_id"})
    if(controlError)throw new Error(`No se pudo habilitar la cuenta: ${controlError.message}`)

    await adminClient.from("platform_admin_audit_log").insert({actor_user_id:currentUser.id,property_id:property.id,action:"client_onboarded",payload:{property_name:propertyName,owner_email:ownerEmail,plan_code:planCode,trial_days:trialDays,custom_modules:customModules||null,invited}})

    return json({success:true,property,owner:{id:ownerId,email:ownerEmail,invited},subscription:{plan_code:planCode,status:trialing?"trialing":"active",trial_ends_at:trialEnd},message:invited?"Cliente creado e invitación enviada.":"Cliente creado y vinculado a un usuario existente."})
  }catch(error){
    console.error("PLATFORM ONBOARD CLIENT ERROR:",error)
    return json({error:error?.message||"No se pudo completar el alta del cliente.",propertyId:createdPropertyId},500)
  }
}
