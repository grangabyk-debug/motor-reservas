import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

const MAX_BYTES=8*1024*1024;

export async function POST(request){
  try{
    const previewMode=process.env.VERCEL_ENV==="preview";
    const authorization=request.headers.get("authorization");
    if(!previewMode){
      if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"No estás autenticado."},{status:401});
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if(!url||!key)return NextResponse.json({error:"Falta configuración del servidor."},{status:500});
      const auth=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
      const {data:{user},error:userError}=await auth.auth.getUser();
      if(userError||!user)return NextResponse.json({error:"La sesión no es válida."},{status:401});
    }

    const form=await request.formData();
    const file=form.get("file");
    if(!(file instanceof File)||!file.size)return NextResponse.json({error:"No recibí un audio válido."},{status:400});
    if(file.size>MAX_BYTES)return NextResponse.json({error:"El audio es demasiado largo para este chat."},{status:413});
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey)return NextResponse.json({error:"La transcripción por voz todavía no está configurada."},{status:503});

    const outbound=new FormData();outbound.append("file",file,file.name||"mensaje.webm");outbound.append("model","gpt-4o-mini-transcribe");outbound.append("language","es");
    const response=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`},body:outbound});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){console.error("COMANDA VOICE",response.status,data?.error?.message);return NextResponse.json({error:"No pude transcribir el audio."},{status:502});}
    const text=String(data?.text||"").trim();if(!text)return NextResponse.json({error:"No pude entender el audio."},{status:422});return NextResponse.json({text});
  }catch(error){console.error("COMANDA VOICE ERROR",error);return NextResponse.json({error:"No pude procesar el audio."},{status:500})}
}
