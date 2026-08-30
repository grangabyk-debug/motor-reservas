import{NextResponse}from"next/server"
import{createClient}from"@supabase/supabase-js"

const ALLOWED_ROLES=["manager","reception","housekeeping","admin","revenue","maintenance","night_audit"]
const json=(body,status=200)=>NextResponse.json(body,{status})

export async function POST(request){
  try{
    const body=await request.json(),email=String(body?.email||"").trim().toLowerCase(),fullName=String(body?.fullName||"").trim(),role=body?.role,propertyId=body?.propertyId
    if(!email||!propertyId||!role)return json({error:"Faltan datos obligatorios."},400)
    if(!ALLOWED_ROLES.includes(role))return json({error:`Rol no válido: ${role}`},400)

    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secretKey=process.env.SUPABASE_SECRET_KEY,authorization=request.headers.get("authorization")
    if(!supabaseUrl||!publishableKey||!secretKey)return json({error:"Faltan variables de configuración del servidor."},500)
    if(!authorization?.startsWith("Bearer "))return json({error:"No estás autenticado."},401)

    const userClient=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}}),{data:{user:currentUser},error:userError}=await userClient.auth.getUser()
    if(userError||!currentUser)return json({error:"La sesión no es válida."},401)

    const adminClient=createClient(supabaseUrl,secretKey,{auth:{autoRefreshToken:false,persistSession:false}}),{data:property,error:propertyError}=await adminClient.from("properties").select("id,name,owner_id").eq("id",propertyId).single()
    if(propertyError||!property)return json({error:"No se encontró el alojamiento."},404)
    if(property.owner_id!==currentUser.id)return json({error:"Solo el propietario puede invitar usuarios."},403)

    let existing=null,page=1
    while(page<=10&&!existing){const{data,error}=await adminClient.auth.admin.listUsers({page,perPage:1000});if(error)return json({error:"No se pudieron consultar los usuarios."},500);existing=data.users.find(user=>user.email?.toLowerCase()===email)||null;if((data.users||[]).length<1000)break;page++}

    let userId
    if(existing){
      userId=existing.id
      const{data:membership,error}=await adminClient.from("property_members").select("property_id,user_id,role").eq("property_id",propertyId).eq("user_id",userId).maybeSingle()
      if(error)return json({error:"No se pudo comprobar el acceso del usuario."},500)
      if(membership)return json({error:"Ese usuario ya tiene acceso a este alojamiento."},409)
    }else{
      const{data,error}=await adminClient.auth.admin.inviteUserByEmail(email)
      if(error)return json({error:error.message||"No se pudo enviar la invitación."},400)
      userId=data.user.id
    }

    const{error:profileError}=await adminClient.from("profiles").upsert({id:userId,full_name:fullName,role},{onConflict:"id"})
    if(profileError)return json({error:"El usuario fue creado, pero no se pudo crear su perfil."},500)
    const{error:memberError}=await adminClient.from("property_members").insert({property_id:propertyId,user_id:userId,role})
    if(memberError)return json({error:"El usuario fue creado, pero no se pudo asignar al alojamiento."},500)
    return json({success:true,message:"Usuario invitado correctamente.",userId,propertyId,role})
  }catch(error){console.error("INVITATION ERROR:",error);return json({error:error?.message||"Ocurrió un error inesperado."},500)}
}
