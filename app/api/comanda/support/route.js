import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

const CENTRAL_URL="https://pejkycdttogpmmdntzuq.supabase.co";
const CENTRAL_KEY="sb_publishable_JmqxkVG1qNuCwWfqMeVgBg_-Nn32N2I";

async function centralRpc(name,body){
  const r=await fetch(`${CENTRAL_URL}/rest/v1/rpc/${name}`,{method:"POST",headers:{"Content-Type":"application/json",apikey:CENTRAL_KEY,Authorization:`Bearer ${CENTRAL_KEY}`},body:JSON.stringify(body),cache:"no-store"});
  const text=await r.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(typeof data==="object"&&data?.message?data.message:"No se pudo conectar con Central Llena.");
  return data;
}

export async function POST(request){
  try{
    const authorization=request.headers.get("authorization");
    if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"No estás autenticado."},{status:401});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
    if(!url||!pub||!secret)return NextResponse.json({error:"Falta configuración del servidor."},{status:500});
    const client=createClient(url,pub,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError||!user)return NextResponse.json({error:"La sesión no es válida."},{status:401});
    const body=await request.json().catch(()=>({}));
    const accountId=String(body.accountId||"");
    if(!accountId)return NextResponse.json({error:"Falta el comercio."},{status:400});
    const {data:account,error:accountError}=await client.from("comanda_accounts").select("id,name").eq("id",accountId).maybeSingle();
    if(accountError||!account)return NextResponse.json({error:"No tenés acceso a este comercio."},{status:403});
    const {data:member}=await client.from("comanda_members").select("role").eq("account_id",accountId).eq("user_id",user.id).maybeSingle();
    const accessToken=createHash("sha256").update(`${secret}:${accountId}:${user.id}:central-support-v1`).digest("hex");
    const common={p_product_slug:"comanda-llena",p_external_tenant_id:accountId,p_external_user_id:user.id,p_access_token:accessToken};
    if(body.action==="send"){
      const message=String(body.message||"").trim();
      if(!message)return NextResponse.json({error:"Escribí un mensaje."},{status:400});
      if(message.length>4000)return NextResponse.json({error:"El mensaje es demasiado largo."},{status:413});
      await centralRpc("support_customer_send",{...common,p_external_tenant_name:String(body.branchName||account.name||"Comanda Llena"),p_external_user_email:user.email||"",p_external_user_role:member?.role||"operator",p_section:String(body.workstationName||"Ayuda humana"),p_subject:"Ayuda humana desde Comanda Llena",p_body:message});
    }
    const rows=await centralRpc("support_customer_read",common);
    const messages=Array.isArray(rows)?rows.map(r=>({id:r.message_id,sender_type:r.sender_type==="customer"?"user":r.sender_type==="agent"?"agent":r.sender_type,text:r.body,sender_name:r.sender_name,created_at:r.created_at,status:r.status})):[];
    return NextResponse.json({messages,connected:true});
  }catch(error){console.error("COMANDA SUPPORT BRIDGE",error);return NextResponse.json({error:error?.message||"No se pudo conectar con ayuda humana."},{status:502});}
}
