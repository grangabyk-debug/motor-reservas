import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {inspectorManualText} from "../../../../products/comanda/inspector/manual";

function extractText(data){
  if(typeof data?.output_text==="string"&&data.output_text.trim())return data.output_text.trim();
  const parts=[];
  for(const item of data?.output||[])for(const content of item?.content||[])if(content?.type==="output_text"&&content?.text)parts.push(content.text);
  return parts.join("\n").trim();
}

function compactHistory(rows){
  if(!Array.isArray(rows))return [];
  return rows.slice(-10).map(row=>({role:row?.role==="assistant"?"assistant":"user",text:String(row?.text||"").slice(0,900)})).filter(row=>row.text);
}

export async function POST(request){
  try{
    const authorization=request.headers.get("authorization");
    if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"No estás autenticado."},{status:401});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if(!url||!key)return NextResponse.json({error:"Falta configuración del servidor."},{status:500});
    const auth=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await auth.auth.getUser();
    if(userError||!user)return NextResponse.json({error:"La sesión no es válida."},{status:401});

    const body=await request.json().catch(()=>({}));
    const action=body?.action==="inspection"?"inspection":"chat";
    const question=String(body?.question||"").trim().slice(0,1800);
    if(action==="chat"&&!question)return NextResponse.json({error:"Falta el mensaje."},{status:400});
    const context=body?.context&&typeof body.context==="object"?body.context:{};
    const report=body?.report&&typeof body.report==="object"?body.report:null;
    const history=compactHistory(body?.history);
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey)return NextResponse.json({error:"Inspector todavía no tiene configurada la IA del servidor."},{status:503});

    const rules=`Sos Inspector, el agente de control de calidad de Comanda Llena. Hablás con el propietario del sistema en español argentino natural, humano y muy claro. Tu trabajo es ayudarlo a entender si Comanda funciona bien y qué hay que revisar. No respondas como un programador salvo que te pidan detalle técnico.\n\nREGLAS OBLIGATORIAS:\n- Basate en el manual interno y en evidencia real recibida.\n- Nunca digas que hiciste clic, navegaste un flujo, cobraste, imprimiste, abriste una mesa o verificaste visualmente algo si la evidencia no demuestra esa acción.\n- Diferenciá siempre entre 'verificado', 'no pude verificar' y 'encontré un problema'.\n- No inventes datos ni estados.\n- Una advertencia no equivale a una falla.\n- Si existe un problema importante, explicá primero qué le pasaría al usuario del restaurante.\n- No expongas UUID, nombres de tablas, HTTP, SQL ni detalles de infraestructura salvo que el usuario los pida.\n- Máximo 4 párrafos breves.\n\nMANUAL INTERNO:\n${inspectorManualText()}`;

    const task=action==="inspection"
      ?`Acaba de terminar una inspección automática de sólo lectura. Convertí el resultado en un informe corto y humano. Indicá si hay algo urgente. No llames "aprobado" a módulos que quedaron como warning/no verificados.\n\nContexto del dispositivo y sesión: ${JSON.stringify(context)}\n\nResultado: ${JSON.stringify(report)}`
      :`Contexto actual: ${JSON.stringify(context)}\nÚltima inspección disponible: ${JSON.stringify(report)}\nHistorial reciente: ${JSON.stringify(history)}\n\nMensaje del usuario: ${question}`;

    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},
      body:JSON.stringify({model:"gpt-5-mini",instructions:rules,input:task,max_output_tokens:520,store:false})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){console.error("COMANDA INSPECTOR AI",response.status,data?.error?.message);return NextResponse.json({error:"No pude consultar al Inspector."},{status:502});}
    const answer=extractText(data);
    return NextResponse.json({answer:answer||"No pude generar una respuesta con suficiente evidencia."});
  }catch(error){
    console.error("COMANDA INSPECTOR ERROR",error);
    return NextResponse.json({error:"No pude procesar la consulta del Inspector."},{status:500});
  }
}
