import{NextResponse}from"next/server"
import{createClient}from"@supabase/supabase-js"

const PREFIX="HL_CASH_META_V1:"
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]))
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||"").trim())
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value)||0)
const fromAddress=value=>!value?"":value.includes("<")?value:`Habitación Llena <${value}>`
function parseMeta(value){
  const raw=String(value||"")
  if(!raw.startsWith(PREFIX))return{openerName:"",shift:"",closeNote:raw,handoverNote:"",handoverPending:[]}
  try{const data=JSON.parse(raw.slice(PREFIX.length));return{openerName:String(data?.openerName||"").trim(),shift:String(data?.shift||"").trim(),closeNote:String(data?.closeNote||"").trim(),handoverNote:String(data?.handoverNote||"").trim(),handoverPending:Array.isArray(data?.handoverPending)?data.handoverPending.map(item=>String(item||"").trim()).filter(Boolean).slice(0,20):[]}}
  catch{return{openerName:"",shift:"",closeNote:raw,handoverNote:"",handoverPending:[]}}
}
function recipientsFrom(manual,settings){
  const typed=String(manual||"").split(/[;,]/).map(item=>item.trim()).filter(Boolean)
  const configured=Array.isArray(settings?.daily_report?.recipients)?settings.daily_report.recipients.map(String).map(item=>item.trim()).filter(Boolean):[]
  const result=[...new Set((typed.length?typed:configured).filter(validEmail))].slice(0,5)
  if(!result.length)throw new Error("Ingresá un email o configurá destinatarios en Informes.")
  return result
}
function attachmentFrom(input,sessionId){
  const content=String(input?.content||"").replace(/^data:[^;]+;base64,/,"").replace(/\s/g,"")
  if(!content||!/^[A-Za-z0-9+/=]+$/.test(content))throw new Error("No se pudo preparar el PDF adjunto.")
  const approx=Math.floor(content.length*3/4)
  if(approx>3*1024*1024)throw new Error("El PDF supera el límite de 3 MB.")
  return{filename:String(input?.filename||`cierre-caja-${sessionId}.pdf`).replace(/[\r\n<>]/g," ").slice(0,160),content,content_type:"application/pdf"}
}

export async function POST(request){
  try{
    const authorization=request.headers.get("authorization")
    if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"No estás autenticado."},{status:401})
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if(!url||!key)return NextResponse.json({error:"Falta configuración del servidor."},{status:500})
    const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
    const{data:{user},error:userError}=await client.auth.getUser()
    if(userError||!user)return NextResponse.json({error:"La sesión no es válida."},{status:401})
    const body=await request.json().catch(()=>null),propertyId=body?.property_id,sessionId=body?.session_id
    if(!propertyId||!sessionId)return NextResponse.json({error:"Falta la propiedad o el cierre de caja."},{status:400})
    const[propRes,memberRes,setRes,cashRes]=await Promise.all([
      client.from("properties").select("id,name,owner_id").eq("id",propertyId).maybeSingle(),
      client.from("property_members").select("role").eq("property_id",propertyId).eq("user_id",user.id).maybeSingle(),
      client.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      client.from("hotel_cash_sessions").select("id,property_id,opened_at,closed_at,opening_amount,opening_amount_usd,closing_amount,closing_amount_usd,expected_amount,expected_amount_usd,status,notes").eq("id",sessionId).eq("property_id",propertyId).eq("status","closed").maybeSingle(),
    ])
    if(propRes.error||!propRes.data)return NextResponse.json({error:"No tenés acceso a esa propiedad."},{status:403})
    if(propRes.data.owner_id!==user.id&&!memberRes.data)return NextResponse.json({error:"No tenés acceso a esa propiedad."},{status:403})
    if(cashRes.error||!cashRes.data)return NextResponse.json({error:"No se encontró ese cierre de caja."},{status:404})
    if(!process.env.RESEND_API_KEY||!process.env.HOTEL_EMAIL_FROM)return NextResponse.json({error:"El alojamiento todavía no tiene configurado el proveedor de correo para enviar adjuntos."},{status:503})

    const settings=setRes.data?.settings||{},recipients=recipientsFrom(body?.recipient,settings),attachment=attachmentFrom(body?.attachment,sessionId)
    const cash=cashRes.data,meta=parseMeta(cash.notes),diffArs=Number(cash.closing_amount||0)-Number(cash.expected_amount||0),diffUsd=Number(cash.closing_amount_usd||0)-Number(cash.expected_amount_usd||0)
    const pending=meta.handoverPending.length?`<ul style="margin:8px 0 0;padding-left:20px">${meta.handoverPending.map(item=>`<li style="margin:5px 0">${esc(item)}</li>`).join("")}</ul>`:'<p style="margin:8px 0 0;color:#667085">Sin pendientes informados.</p>'
    const closedLabel=cash.closed_at?new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(new Date(cash.closed_at)):"—"
    const html=`<!doctype html><html><body style="margin:0;background:#eef3fb;font-family:Arial,sans-serif;color:#18243c"><div style="max-width:720px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border:1px solid #dfe7f5;border-radius:22px;overflow:hidden"><header style="padding:24px;background:#f7f9ff;border-bottom:1px solid #e1e7f2"><div style="font-size:11px;letter-spacing:.14em;color:#5264d9;font-weight:700">HABITACIÓN LLENA · PASE DE TURNO</div><h1 style="font-size:24px;margin:7px 0 4px">Cierre de caja + libro de novedades</h1><p style="margin:0;color:#667085">${esc(propRes.data.name||"Hotel")} · ${esc(closedLabel)}${meta.shift?` · Turno ${esc(meta.shift)}`:""}</p></header><main style="padding:22px"><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><div style="padding:14px;border:1px solid #e2e7f0;border-radius:14px"><small style="color:#667085">Efectivo contado</small><b style="display:block;margin-top:5px">${esc(money(cash.closing_amount,"ARS"))}${Math.abs(Number(cash.closing_amount_usd||0))>.009?` · ${esc(money(cash.closing_amount_usd,"USD"))}`:""}</b></div><div style="padding:14px;border:1px solid #e2e7f0;border-radius:14px"><small style="color:#667085">Diferencia</small><b style="display:block;margin-top:5px">${esc(money(diffArs,"ARS"))}${Math.abs(diffUsd)>.009?` · ${esc(money(diffUsd,"USD"))}`:""}</b></div></div><h2 style="font-size:16px;margin:22px 0 8px">Libro de novedades</h2><div style="padding:14px;border:1px solid #e2e7f0;border-radius:14px;white-space:pre-wrap">${esc(meta.handoverNote||"Sin novedades.")}</div><h3 style="font-size:14px;margin:18px 0 7px">Pendientes para el próximo turno</h3>${pending}${meta.closeNote?`<h3 style="font-size:14px;margin:18px 0 7px">Nota de caja</h3><div style="padding:12px;border-left:3px solid #6474df;background:#f7f8ff;white-space:pre-wrap">${esc(meta.closeNote)}</div>`:""}<p style="margin:22px 0 0;color:#667085;font-size:12px">El cierre completo se adjunta en PDF.</p></main></div></div></body></html>`
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:fromAddress(process.env.HOTEL_EMAIL_FROM),to:recipients,subject:`${propRes.data.name||"Hotel"} · Pase de turno · ${meta.shift||"Cierre"} · ${closedLabel}`,html,reply_to:process.env.HOTEL_EMAIL_REPLY_TO||undefined,attachments:[attachment]})})
    const result=await response.json().catch(()=>({}))
    if(!response.ok)return NextResponse.json({error:result?.message||`El proveedor de correo respondió ${response.status}.`},{status:502})
    return NextResponse.json({mode:"sent",id:result?.id||null,recipients:recipients.length})
  }catch(error){return NextResponse.json({error:error?.message||"No se pudo enviar el cierre por email."},{status:500})}
}
