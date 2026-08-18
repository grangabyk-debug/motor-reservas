import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

const compact=(c={})=>({
  sucursal:c.branch||null,puesto:c.workstation||null,
  categorias:Array.isArray(c.categories)?c.categories.slice(0,80):[],
  productos:Array.isArray(c.products)?c.products.slice(0,250).map(p=>({id:p.id,nombre:p.public_name||p.name,precio:p.price,cocina:p.kitchen_id,stock:p.stock_quantity,control_stock:p.track_stock})):[],
  cocinas:Array.isArray(c.kitchens)?c.kitchens.slice(0,20):[],
  ventas:Array.isArray(c.orders)?c.orders.slice(-160):[],
  items:Array.isArray(c.items)?c.items.slice(-350):[],
  pagos:Array.isArray(c.payments)?c.payments.slice(-250):[],
  caja:c.cash||null,
  clientes:Array.isArray(c.customers)?c.customers.slice(0,120).map(x=>({id:x.id,nombre:x.full_name,descuento:x.discount_percent})):[]
});

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
    const question=String(body?.question||"").trim();
    if(!question)return NextResponse.json({error:"Falta la pregunta."},{status:400});
    if(question.length>1600)return NextResponse.json({error:"La pregunta es demasiado larga."},{status:413});
    const context=compact(body?.context);
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey)return NextResponse.json({answer:"El asistente de IA todavía no tiene configurada la credencial del servidor."});
    const prompt=`Sos el asistente operativo de Comanda Llena, un sistema gastronómico para restaurantes, bares y hoteles. Respondé en español argentino, claro, humano y breve. Ayudá sobre productos, menú, cocina, comandas, ventas, clientes, caja y uso del sistema. Usá únicamente los datos del contexto para cifras o hechos de la operación. No inventes ventas, stock, clientes ni estados. Si faltan datos, decilo. No expongas IDs técnicos salvo que sean imprescindibles. Si hay una consulta de inocuidad alimentaria, especialmente celiaquía, recordá que una marca en la comanda es una alerta operativa y no garantiza ausencia de contaminación cruzada. Máximo 5 párrafos cortos.\n\nContexto:\n${JSON.stringify(context)}\n\nPregunta:\n${question}`;
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model:"gpt-5-mini",input:prompt,max_output_tokens:650})});
    const data=await response.json();
    if(!response.ok){console.error("COMANDA AI",data);return NextResponse.json({error:"No se pudo consultar el asistente."},{status:502});}
    return NextResponse.json({answer:data.output_text||"No pude generar una respuesta."});
  }catch(error){console.error("COMANDA ASSISTANT ERROR",error);return NextResponse.json({error:"No se pudo procesar la consulta."},{status:500});}
}
