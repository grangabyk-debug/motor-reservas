import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { fallbackPmsHelp, interpretHotelOperation } from "./oliviaHotelLanguage"
import { applyTenantTerminology, loadTenantMemory, rememberTenantTeaching, tenantMemoryPrompt } from "./oliviaTenantMemory"

const ACTION_TYPES=new Set(["create_guest_request","create_maintenance_ticket"])
const PRIORITIES=new Set(["low","normal","high","urgent"])
const AREAS=new Set(["reception","housekeeping","maintenance"])
const REQUESTED_BY=new Set(["guest","reception","housekeeping","other"])

const OLIVIA_RESPONSE_SCHEMA={type:"object",additionalProperties:false,required:["answer","action"],properties:{answer:{type:"string"},action:{anyOf:[{type:"null"},{type:"object",additionalProperties:false,required:["type","title","detail","priority","assigned_area","requested_by","reservation_id","room_id"],properties:{type:{type:"string",enum:["create_guest_request","create_maintenance_ticket"]},title:{type:"string"},detail:{type:["string","null"]},priority:{type:"string",enum:["low","normal","high","urgent"]},assigned_area:{type:["string","null"],enum:["reception","housekeeping","maintenance",null]},requested_by:{type:["string","null"],enum:["guest","reception","housekeeping","other",null]},reservation_id:{type:["integer","null"]},room_id:{type:["integer","null"]}}}]}}}

const human=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()
const clean=(v,max=600)=>{const s=String(v||"").trim();return s?s.slice(0,max):null}
const id=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null}

function preguntaLocal(question){return /cu[aá]ntas?.*(habitaciones?.*)?ocupad|ocupadas?.*hoy|cu[aá]ntas?.*reservas|reservas.*(tengo|hay)|cu[aá]ntas?.*noches|noches.*vend|cu[aá]ntas?.*habitaci|cu[aá]nto.*(vend|factur|ingres)|ventas.*(hoy|30 d[ií]as|mes)/i.test(question.toLowerCase())}
function courtesyReply(question){const q=human(question);if(/^(gracias|muchas gracias|mil gracias|gracias olivia|perfecto gracias|genial gracias|buenisimo gracias|buenísimo gracias|listo gracias|excelente gracias|joya gracias)$/.test(q))return"De nada. Decime si necesitás otra cosa y lo vemos.";if(/^(hola|buen dia|buenas|buenas tardes|buenas noches|hola olivia)$/.test(q))return"¡Hola! Sí, decime qué necesitás y te doy una mano.";return null}
function contextFor(raw={},propertyId=null){return{plataforma:raw.plataforma||"HabitaciónLlena.com · PMS hotelero",propiedad_id:propertyId,hoy:raw.hoy||null,metricas:raw.metricas||{},alojamientos:Array.isArray(raw.alojamientos)?raw.alojamientos.filter(x=>!propertyId||String(x?.id||"")===String(propertyId)).slice(0,1):[],habitaciones:Array.isArray(raw.habitaciones)?raw.habitaciones.slice(0,300):[],reservas:Array.isArray(raw.reservas)?raw.reservas.slice(-300):[]}}
function historyFor(history){return Array.isArray(history)?history.slice(-10).map(x=>({role:x?.role==="assistant"?"assistant":"user",text:String(x?.text||"").slice(0,1500)})).filter(x=>x.text.trim()):[]}

function normalizeAction(action,context){
  if(!action||typeof action!=="object"||!ACTION_TYPES.has(action.type))return null
  const title=clean(action.title,160);if(!title)return null
  const reservationId=id(action.reservation_id),roomId=id(action.room_id),reservations=context.reservas||[],rooms=context.habitaciones||[]
  const reservation=reservationId?reservations.find(x=>Number(x?.id)===reservationId):null,room=roomId?rooms.find(x=>Number(x?.id)===roomId):null
  if(reservationId&&!reservation||roomId&&!room)return null
  const refs={reservation_id:reservationId,reservation_number:clean(reservation?.numero,80),room_id:roomId,room_name:clean(room?.nombre,80)}
  const priority=PRIORITIES.has(action.priority)?action.priority:"normal"
  if(action.type==="create_guest_request")return{type:action.type,payload:{title,detail:clean(action.detail,1200),priority,assigned_area:AREAS.has(action.assigned_area)?action.assigned_area:"reception",requested_by:REQUESTED_BY.has(action.requested_by)?action.requested_by:"reception",...refs}}
  return{type:action.type,payload:{title,description:clean(action.detail,1200),priority,...refs}}
}

async function createProposal(client,propertyId,action,context,sourceText){
  const normalized=normalizeAction(action,context)
  if(!normalized)return{proposal:null,error:"La acción propuesta no tenía referencias suficientemente seguras."}
  const source=clean(sourceText,500);if(source)normalized.payload.olivia_source_text=source
  const{data,error}=await client.rpc("hl_olivia_propose_action",{p_property_id:propertyId,p_action_type:normalized.type,p_payload:normalized.payload})
  if(error){console.error("OlivIA proposal error:",error);return{proposal:null,error:"No pude dejar la acción preparada para aprobación."}}
  return{proposal:data||null,error:null}
}

export async function POST(request){
  try{
    const authorization=request.headers.get("authorization");if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"No estás autenticado."},{status:401})
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)return NextResponse.json({error:"Falta la configuración de autenticación del servidor."},{status:500})
    const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
    const{data:{user},error:userError}=await client.auth.getUser();if(userError||!user)return NextResponse.json({error:"La sesión no es válida."},{status:401})
    const body=await request.json().catch(()=>null),propertyId=typeof body?.propertyId==="string"?body.propertyId.trim():"",question=typeof body?.question==="string"?body.question.trim():"",raw=body?.context&&typeof body.context==="object"?body.context:{},history=historyFor(body?.history)
    if(!propertyId)return NextResponse.json({error:"Falta la propiedad activa del PMS."},{status:400});if(!question)return NextResponse.json({error:"Falta la pregunta."},{status:400});if(question.length>2000)return NextResponse.json({error:"La pregunta es demasiado larga."},{status:413})
    const{data:membership,error:membershipError}=await client.from("property_members").select("property_id,user_id,role").eq("property_id",propertyId).eq("user_id",user.id).maybeSingle();if(membershipError||!membership)return NextResponse.json({error:"No tenés acceso a esa propiedad."},{status:403})
    const[rr,rs]=await Promise.all([client.from("habitaciones").select("id,nombre,tipo,estado,activa").eq("property_id",propertyId).eq("activa",true).limit(300),client.from("reservas").select("id,numero_reserva,nombre_huesped,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,cantidad_huespedes,canal_reserva,moneda").eq("property_id",propertyId).neq("estado","cancelada").order("created_at",{ascending:false}).limit(150)])
    const reservas=!rs.error&&Array.isArray(rs.data)?rs.data.map(x=>({id:x.id,numero:x.numero_reserva||null,nombre:x.nombre_huesped||"Huésped",entrada:x.fecha_entrada,salida:x.fecha_salida,estado:x.estado,habitacion_id:x.habitacion_id||null,habitaciones_ids:Array.isArray(x.habitaciones_ids)?x.habitaciones_ids:[],huespedes:x.cantidad_huespedes||1,canal:x.canal_reserva||"Directa",moneda:x.moneda||"ARS"})):raw.reservas
    const context=contextFor({...raw,habitaciones:!rr.error&&Array.isArray(rr.data)?rr.data:raw.habitaciones,reservas},propertyId)
    const memory=await loadTenantMemory(client,propertyId)
    const teaching=await rememberTenantTeaching(client,propertyId,question)
    if(teaching)return NextResponse.json({answer:teaching.error?`Entendí que “${teaching.phrase}” significa “${teaching.meaning}”, pero no pude guardarlo ahora. Probá de nuevo en un momento.`:`Perfecto. Para este hotel voy a entender “${teaching.phrase}” como “${teaching.meaning}”. Esto queda solamente en la memoria de esta propiedad.`,mode:"tenant-learning",assistant:"OlivIA",action:null})

    const courtesy=courtesyReply(question)
    if(courtesy)return NextResponse.json({answer:courtesy,mode:"local-social",assistant:"OlivIA",action:null})
    const learnedQuestion=applyTenantTerminology(question,memory)
    const hotelAction=interpretHotelOperation(learnedQuestion,context)
    if(hotelAction?.handled){if(!hotelAction.action)return NextResponse.json({answer:hotelAction.answer,mode:"hotel-language",action:null});hotelAction.action.detail=question;const result=await createProposal(client,propertyId,hotelAction.action,context,question);return NextResponse.json({answer:result.error?`${hotelAction.answer}\n\n${result.error}`:hotelAction.answer,mode:"hotel-language",assistant:"OlivIA",action:result.proposal})}
    if(preguntaLocal(question))return NextResponse.json({answer:responderSinIA(question,context),mode:"local",action:null})

    const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return NextResponse.json({answer:responderSinIA(learnedQuestion,context),mode:"local",action:null})
    const memoryContext=tenantMemoryPrompt(memory)
    const prompt=`Sos OlivIA, asistente operativa de HabitaciónLlena.com. Hablás con Recepción, que escribe rápido, informal, con abreviaturas y errores. Entendé la intención antes que exigir una forma de escribir.

PERSONALIDAD
- Soná como una compañera de recepción inteligente, cálida y resolutiva; nunca como un bot o parser.
- Español argentino natural, profesional y breve. Si está claro: “Dale…”, “Sí, entendí…”, “Perfecto…”.
- Si falta un dato esencial, preguntá sólo ese dato. Usá el historial para “esa”, “la misma”, “también”, “sumale otra”.

OPERACIÓN
- Fallas de aire, TV, cerradura, caja fuerte, agua, electricidad, Wi‑Fi, calefacción, heladera, filtraciones o roturas => mantenimiento.
- Sábanas, toallas, almohadas, mantas, amenities, cuna, papel higiénico, limpieza y recambios => Housekeeping.
- No hace falta que digan “crear”: una afirmación operacional concreta ya puede ser solicitud. Una pregunta informativa NO crea acción.

MEMORIA EXCLUSIVA DE ESTA PROPIEDAD
${memoryContext}
Usá esta memoria sólo como vocabulario y ejemplos de ESTE hotel. Nunca la extrapoles a otro hotel. Los ejemplos aprendidos ayudan a interpretar cómo habla este personal, pero los room_id/reservation_id siempre deben validarse contra el contexto actual.

SEGURIDAD
Podés PREPARAR sólo create_guest_request y create_maintenance_ticket; nunca ejecutar sola. Nunca inventes IDs. Housekeeping => create_guest_request assigned_area="housekeeping", requested_by="reception". Fallas técnicas => create_maintenance_ticket. Toda acción requiere aprobación y ejecución humana.

También podés explicar Planning, Reservas, Mensajes, Portal del huésped, pagos, folios, Caja diaria, tarifas/disponibilidad, bloqueos, Housekeeping, Mantenimiento y check-in/out de forma conversacional.

Contexto validado:${JSON.stringify(context)}
Historial:${JSON.stringify(history)}
Mensaje original:${question}
Mensaje con vocabulario local expandido:${learnedQuestion}`
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model:"gpt-5.6-luna",input:prompt,max_output_tokens:1000,text:{format:{type:"json_schema",name:"olivia_pms_response",strict:true,schema:OLIVIA_RESPONSE_SCHEMA}}})})
    const data=await response.json();if(!response.ok){console.error("Error OpenAI:",data);return NextResponse.json({answer:responderSinIA(learnedQuestion,context),mode:"local",action:null})}
    let parsed;try{parsed=JSON.parse(data.output_text||"{}")}catch(error){console.error("OlivIA structured output parse error:",error);return NextResponse.json({answer:responderSinIA(learnedQuestion,context),mode:"local",action:null})}
    let proposal=null,proposalError=null;if(parsed?.action){const result=await createProposal(client,propertyId,parsed.action,context,question);proposal=result.proposal;proposalError=result.error}
    const answer=String(parsed?.answer||"No pude generar una respuesta en este momento.").trim();return NextResponse.json({answer:proposalError?`${answer}\n\n${proposalError}`:answer,mode:"openai",assistant:"OlivIA",action:proposal})
  }catch(error){console.error("Error asistente OlivIA:",error);return NextResponse.json({error:"No se pudo procesar la consulta."},{status:500})}
}

function responderSinIA(question,context={}){
  const q=question.toLowerCase(),reservas=Array.isArray(context.reservas)?context.reservas:[],habitaciones=Array.isArray(context.habitaciones)?context.habitaciones:[],m=context.metricas||{},activas=habitaciones.filter(h=>h.activa!==false),ocupadas=reservas.filter(r=>r.estado!=="cancelada"&&r.entrada<=context.hoy&&r.salida>context.hoy),total=Number.isFinite(Number(m.habitacionesActivas))?Number(m.habitacionesActivas):activas.length,used=Number.isFinite(Number(m.alojados))?Number(m.alojados):ocupadas.length,occ=Number.isFinite(Number(m.ocupacion))?Number(m.ocupacion):total?(used/total)*100:0
  if(q.includes("ocupad")||q.includes("ocupación")||q.includes("ocupacion"))return`Hoy la ocupación visible en el dashboard es ${occ.toFixed(0)}%: ${used} de ${total} habitación(es) activas.`
  if(q.includes("reserva")){if(Number.isFinite(Number(m.reservas30dias)))return`En los últimos 30 días registrás ${Number(m.reservas30dias)} reserva(s).`;if(Number.isFinite(Number(m.llegadasHoy))||Number.isFinite(Number(m.salidasHoy)))return`Hoy el dashboard muestra ${Number(m.llegadasHoy||0)} llegada(s) y ${Number(m.salidasHoy||0)} salida(s).`}
  if(q.includes("noche")){if(Number.isFinite(Number(m.noches)))return`En el período disponible registrás ${Number(m.noches)} noche(s) vendida(s).`;return"El dashboard actual no me está pasando el total de noches vendidas para ese período."}
  if(q.includes("ingreso")||q.includes("venta")||q.includes("factur")||q.includes("cobrad")){if(Number.isFinite(Number(m.cobradoHoy)))return`Hoy el dashboard muestra ${Number(m.cobradoHoy).toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0})} cobrados.`;if(Number.isFinite(Number(m.ingresos)))return`Hay ${Number(m.ingresos).toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0})} registrados.`;return"No tengo un importe económico suficiente en el contexto para responderte con precisión."}
  if(q.includes("atención")||q.includes("atencion")||q.includes("urgente")||q.includes("prioridad")){const a=[];if(Number(m.mantenimientoUrgente||0)>0)a.push(`${Number(m.mantenimientoUrgente)} mantenimiento(s) urgente(s)`);if(Number(m.habitacionesSucias||0)>0)a.push(`${Number(m.habitacionesSucias)} habitación(es) sucia(s)`);if(Number(m.llegadasHoy||0)>0)a.push(`${Number(m.llegadasHoy)} llegada(s) para revisar`);return a.length?`Yo priorizaría: ${a.join(", ")}.`:"No veo alertas operativas evidentes en los datos que tengo cargados ahora."}
  if((q.includes("crear")||q.includes("hacer"))&&q.includes("reserva"))return"Para crear una reserva, abrí Reservas o seleccioná el rango desde el Planning, elegí habitación y fechas, cargá huésped, revisá el total y confirmá."
  const help=fallbackPmsHelp(question);if(help)return help
  if(q.includes("habitación")||q.includes("habitacion")||q.includes("cuarto"))return`Tenés ${total} habitación(es) activa(s) visibles en la operación actual.`
  return"Decime qué necesitás de la operación o del sistema. Podés escribirme como te salga; si es un pedido operativo, con la habitación y lo que pasa me alcanza para orientarlo."
}
