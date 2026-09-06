import{NextResponse}from"next/server"
import{createClient}from"@supabase/supabase-js"

const DAY=86400000
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[char])
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)
function dayInZone(date,zone){try{return new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}catch{return new Intl.DateTimeFormat("en-CA",{timeZone:"UTC",year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}}
function isTarget(timestamp,target,zone){return timestamp&&dayInZone(new Date(timestamp),zone)===target}
function fromAddress(value){if(!value)return"";return value.includes("<")?value:`Habitación Llena <${value}>`}

export async function POST(request){
  try{
    const authorization=request.headers.get("authorization")
    if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"No estás autenticado."},{status:401})
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if(!url||!key)return NextResponse.json({error:"Falta configuración del servidor."},{status:500})
    const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
    const{data:{user},error:userError}=await client.auth.getUser();if(userError||!user)return NextResponse.json({error:"La sesión no es válida."},{status:401})
    const body=await request.json().catch(()=>null),propertyId=body?.property_id
    if(!propertyId)return NextResponse.json({error:"Falta la propiedad."},{status:400})
    const[propRes,memberRes,setRes]=await Promise.all([
      client.from("properties").select("id,name,owner_id").eq("id",propertyId).single(),
      client.from("property_members").select("role").eq("property_id",propertyId).eq("user_id",user.id).maybeSingle(),
      client.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
    ])
    if(propRes.error||!propRes.data)return NextResponse.json({error:"No tenés acceso a esa propiedad."},{status:403})
    const role=propRes.data.owner_id===user.id?"owner":memberRes.data?.role||"member"
    if(!["owner","manager","admin"].includes(role))return NextResponse.json({error:"No tenés permisos para enviar informes de gerencia."},{status:403})
    const reportConfig=setRes.data?.settings?.daily_report||{},recipients=(reportConfig.recipients||[]).map(String).map(x=>x.trim()).filter(Boolean)
    if(!recipients.length)return NextResponse.json({error:"Configurá al menos un destinatario en Informes."},{status:400})
    const timezone=reportConfig.timezone||setRes.data?.settings?.preferences?.timezone||"America/Argentina/Buenos_Aires"
    const currency=setRes.data?.settings?.preferences?.currency||"ARS"
    const target=dayInZone(new Date(Date.now()-DAY),timezone),today=dayInZone(new Date(),timezone),since=new Date(Date.now()-3*DAY).toISOString()
    const[roomsRes,occupancyRes,arrivalsRes,departuresRes,recentRes,payRes,cashRes]=await Promise.all([
      client.from("habitaciones").select("id").eq("property_id",propertyId).eq("activa",true),
      client.from("reservas").select("id,estado,no_show").eq("property_id",propertyId).lte("fecha_entrada",target).gt("fecha_salida",target).neq("estado","cancelada").eq("no_show",false),
      client.from("reservas").select("id,numero_reserva,nombre_huesped,canal_reserva,habitacion_id,estado").eq("property_id",propertyId).eq("fecha_entrada",target).neq("estado","cancelada").eq("no_show",false),
      client.from("reservas").select("id,numero_reserva,nombre_huesped,canal_reserva,habitacion_id,estado").eq("property_id",propertyId).eq("fecha_salida",target).neq("estado","cancelada"),
      client.from("reservas").select("id,numero_reserva,nombre_huesped,canal_reserva,estado,created_at").eq("property_id",propertyId).gte("created_at",since),
      client.from("pagos").select("id,monto,moneda,metodo,estado,created_at").eq("property_id",propertyId).gte("created_at",since),
      client.from("hotel_cash_sessions").select("id,opened_at,closed_at,opening_amount,closing_amount,expected_amount,status").eq("property_id",propertyId).gte("closed_at",since).eq("status","closed"),
    ])
    for(const result of[roomsRes,occupancyRes,arrivalsRes,departuresRes,recentRes,payRes,cashRes])if(result.error)return NextResponse.json({error:result.error.message},{status:400})
    const created=(recentRes.data||[]).filter(row=>isTarget(row.created_at,target,timezone)),payments=(payRes.data||[]).filter(row=>isTarget(row.created_at,target,timezone)&&!["anulado","cancelado","void","refunded"].includes(String(row.estado||"").toLowerCase())),cash=(cashRes.data||[]).filter(row=>isTarget(row.closed_at,target,timezone))
    const paid=payments.reduce((sum,row)=>sum+Number(row.monto||0),0),methods={};for(const row of payments){const key=String(row.metodo||"Otro");methods[key]=(methods[key]||0)+Number(row.monto||0)}
    const roomCount=(roomsRes.data||[]).length,occupied=(occupancyRes.data||[]).length,occupancy=roomCount?Math.min(100,occupied/roomCount*100):0
    const channels={};for(const row of created){const key=row.canal_reserva||"Directa";channels[key]=(channels[key]||0)+1}
    const cashDifference=cash.reduce((sum,row)=>sum+(Number(row.closing_amount||0)-Number(row.expected_amount||0)),0)
    const include={payments:true,reservations:true,arrivals:true,departures:true,cash:true,occupancy:true,channels:true,...(reportConfig.include||{})}
    const sections=[]
    if(include.occupancy)sections.push(card("Ocupación",`${occupancy.toFixed(0)}%`,`${occupied} de ${roomCount} habitaciones`))
    if(include.payments)sections.push(card("Cobrado",money(paid,currency),`${payments.length} movimientos`))
    if(include.reservations)sections.push(card("Reservas creadas",created.length,"durante el día"))
    if(include.arrivals)sections.push(card("Llegadas",(arrivalsRes.data||[]).length,"check-ins previstos"))
    if(include.departures)sections.push(card("Salidas",(departuresRes.data||[]).length,"check-outs previstos"))
    const methodsHtml=include.payments?listBlock("Pagos por medio",Object.entries(methods).sort((a,b)=>b[1]-a[1]).map(([name,total])=>[name,money(total,currency)])):""
    const channelsHtml=include.channels?listBlock("Reservas por canal",Object.entries(channels).sort((a,b)=>b[1]-a[1]).map(([name,count])=>[name,count])):""
    const cashHtml=include.cash?listBlock("Caja",[["Cierres registrados",cash.length],["Diferencia acumulada",money(cashDifference,currency)] ]):""
    const nextArrivals=await client.from("reservas").select("id,nombre_huesped,numero_reserva").eq("property_id",propertyId).eq("fecha_entrada",today).neq("estado","cancelada").eq("no_show",false).limit(20)
    const todayHtml=!nextArrivals.error&&nextArrivals.data?.length?`<div style="margin-top:24px;padding:18px;border-radius:16px;background:#f5f8ff"><b style="color:#294fca">Para hoy</b><p style="margin:6px 0 0;color:#5c6981">${nextArrivals.data.length} llegada${nextArrivals.data.length===1?"":"s"}: ${nextArrivals.data.slice(0,6).map(r=>esc(r.nombre_huesped)).join(", ")}${nextArrivals.data.length>6?"…":""}</p></div>`:""
    const html=`<!doctype html><html><body style="margin:0;background:#eef3fb;font-family:Arial,sans-serif;color:#18243c"><div style="max-width:760px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border:1px solid #dfe7f5;border-radius:24px;overflow:hidden;box-shadow:0 18px 48px rgba(38,61,113,.10)"><header style="padding:28px;background:linear-gradient(135deg,#f9fbff,#eef4ff);border-bottom:1px solid #dfe7f5"><div style="font-size:12px;letter-spacing:.16em;color:#4165d6;font-weight:700">HABITACIÓN LLENA</div><h1 style="font-size:28px;margin:7px 0 4px">Resumen de ${esc(propRes.data.name)}</h1><p style="margin:0;color:#6a768b">${esc(target)} · cierre automático del día anterior</p></header><main style="padding:24px"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${sections.join("")}</div>${methodsHtml}${channelsHtml}${cashHtml}${todayHtml}</main><footer style="padding:18px 24px;border-top:1px solid #e4eaf4;color:#7a8699;font-size:12px">Generado por Habitación Llena · ${esc(timezone)}</footer></div></div></body></html>`
    if(!process.env.RESEND_API_KEY||!process.env.HOTEL_EMAIL_FROM)return NextResponse.json({mode:"not_configured",preview:{date:target,occupancy,paid,reservations:created.length,arrivals:(arrivalsRes.data||[]).length,departures:(departuresRes.data||[]).length}})
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:fromAddress(process.env.HOTEL_EMAIL_FROM),to:recipients,subject:`Habitación Llena · Resumen ${target} · ${propRes.data.name}`,html,reply_to:process.env.HOTEL_EMAIL_REPLY_TO||undefined})})
    const result=await response.json().catch(()=>({}));if(!response.ok)return NextResponse.json({error:result?.message||`Proveedor respondió ${response.status}`},{status:502})
    return NextResponse.json({mode:"sent",id:result?.id||null,recipients:recipients.length,date:target})
  }catch(error){return NextResponse.json({error:error?.message||"No se pudo generar el informe diario."},{status:500})}
}

function card(label,value,note){return`<div style="padding:15px;border:1px solid #e0e7f4;border-radius:15px;background:#fbfcff"><span style="display:block;font-size:12px;color:#718099">${esc(label)}</span><b style="display:block;font-size:22px;margin:5px 0;color:#274ec6">${esc(value)}</b><small style="color:#7a8699">${esc(note)}</small></div>`}
function listBlock(title,rows){if(!rows.length)return"";return`<div style="margin-top:22px"><b style="font-size:16px">${esc(title)}</b><div style="margin-top:8px;border:1px solid #e0e7f4;border-radius:14px;overflow:hidden">${rows.map(([label,value])=>`<div style="display:flex;justify-content:space-between;padding:11px 13px;border-bottom:1px solid #edf1f7"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join("")}</div></div>`}
