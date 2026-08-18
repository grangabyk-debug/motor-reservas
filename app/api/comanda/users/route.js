import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export async function POST(request){
  try{
    const authorization=request.headers.get("authorization");
    if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"No estás autenticado."},{status:401});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
    if(!url||!pub||!secret)return NextResponse.json({error:"Falta configuración del servidor."},{status:500});
    const caller=createClient(url,pub,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user:current},error:authError}=await caller.auth.getUser();
    if(authError||!current)return NextResponse.json({error:"La sesión no es válida."},{status:401});
    const body=await request.json().catch(()=>({}));
    const accountId=String(body.accountId||""),email=String(body.email||"").trim().toLowerCase(),fullName=String(body.fullName||"").trim(),username=String(body.username||"").trim(),phone=String(body.phone||"").trim(),role=String(body.role||"operator");
    if(!accountId||!email)return NextResponse.json({error:"Faltan cuenta o email."},{status:400});
    if(!["admin","operator","viewer"].includes(role))return NextResponse.json({error:"Perfil no válido."},{status:400});
    const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:account}=await admin.from("comanda_accounts").select("id,owner_id").eq("id",accountId).maybeSingle();
    if(!account)return NextResponse.json({error:"No se encontró el comercio."},{status:404});
    let allowed=account.owner_id===current.id;
    if(!allowed){const {data:m}=await admin.from("comanda_members").select("role").eq("account_id",accountId).eq("user_id",current.id).maybeSingle();allowed=["owner","admin"].includes(m?.role)}
    if(!allowed)return NextResponse.json({error:"No tenés permisos para administrar usuarios."},{status:403});
    const {data:list,error:listError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
    if(listError)return NextResponse.json({error:"No se pudieron consultar los usuarios."},{status:500});
    let target=list.users.find(u=>u.email?.toLowerCase()===email);
    if(!target){const {data:inv,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:fullName}});if(inviteError)return NextResponse.json({error:inviteError.message||"No se pudo enviar la invitación."},{status:400});target=inv.user}
    const memberRole=role;
    const {error:memberError}=await admin.from("comanda_members").upsert({account_id:accountId,user_id:target.id,role:memberRole},{onConflict:"account_id,user_id"});
    if(memberError)return NextResponse.json({error:"No se pudo asignar el acceso al comercio."},{status:500});
    const {error:profileError}=await admin.from("comanda_user_profiles").upsert({account_id:accountId,user_id:target.id,username:username||email.split("@")[0],full_name:fullName,email,phone,access_level:role,active:true,updated_at:new Date().toISOString()},{onConflict:"account_id,user_id"});
    if(profileError)return NextResponse.json({error:"El usuario se creó, pero no se pudo guardar su perfil."},{status:500});
    return NextResponse.json({success:true,userId:target.id,invited:!list.users.some(u=>u.id===target.id)});
  }catch(error){console.error("COMANDA USERS ERROR",error);return NextResponse.json({error:error?.message||"No se pudo administrar el usuario."},{status:500});}
}
