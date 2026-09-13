"use client"

import{supabase}from"../../../../lib/supabase"

export const cashMoney=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value)||0)
export const cashFmt=value=>value?new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)):"—"
export const cashTime=value=>value?new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"—"
export const cashDual=(ars,usd)=>`${cashMoney(ars,"ARS")}${Math.abs(Number(usd)||0)>.009?` · ${cashMoney(usd,"USD")}`:""}`
const norm=value=>String(value||"").trim().toLowerCase()
const currency=value=>String(value||"ARS").toUpperCase()==="USD"?"USD":"ARS"
const round=value=>Math.round((Number(value)||0)*100)/100
const pair=()=>({ARS:0,USD:0})
const voided=row=>["anulado","cancelado","void","rechazado","cancelled"].includes(norm(row?.estado))
const paymentMirror=row=>norm(row?.reference).startsWith("pago:")
export function cashMethodGroup(value){
  const key=norm(value)
  if(key.includes("efect")||key==="cash")return"cash"
  if(key.includes("transfer"))return"transfer"
  if(key.includes("mercado")||key==="mp"||key.includes("billetera")||key.includes("qr"))return"mp"
  if(key.includes("tarjet")||key.includes("card")||key.includes("debito")||key.includes("débito")||key.includes("credito")||key.includes("crédito"))return"card"
  return"other"
}
export function cashMethodLabel(value){
  const group=cashMethodGroup(value)
  return group==="cash"?"Efectivo":group==="transfer"?"Transferencia":group==="mp"?"Mercado Pago / QR":group==="card"?"Tarjeta":String(value||"Otro")
}
function physicalPayment(row){
  const gross=Math.max(0,Number(row.monto||0))
  const net=Math.max(0,gross-Number(row.refunded_amount||0))
  const ratio=gross?Math.min(1,net/gross):0
  return{amount:round(Math.max(0,Number(row.payment_amount??row.monto)||0)*ratio),currency:currency(row.payment_currency||row.moneda)}
}
export async function buildCashClosureReport(propertyId,session,currentUser=null){
  const[paymentRes,movementRes]=await Promise.all([
    supabase.from("pagos").select("id,reserva_id,monto,metodo,created_at,moneda,payment_currency,payment_amount,refunded_amount,estado,referencia,external_ref,nota,created_by").eq("property_id",propertyId).gte("created_at",session.opened_at).lte("created_at",session.closed_at).order("created_at",{ascending:true}),
    supabase.from("hotel_cash_movements").select("id,reservation_id,movement_type,method,amount,currency,concept,reference,created_by,created_at").eq("property_id",propertyId).eq("session_id",session.id).order("created_at",{ascending:true}),
  ])
  if(paymentRes.error)throw paymentRes.error
  if(movementRes.error)throw movementRes.error
  const payments=(paymentRes.data||[]).filter(row=>!voided(row))
  const movements=(movementRes.data||[]).filter(row=>!paymentMirror(row))
  const reservationIds=[...new Set([...payments.map(row=>row.reserva_id),...movements.map(row=>row.reservation_id)].filter(Boolean).map(Number))]
  const profileIds=[...new Set([session.opened_by,session.closed_by,...payments.map(row=>row.created_by),...movements.map(row=>row.created_by)].filter(Boolean))]
  const[reservationRes,profileRes]=await Promise.all([
    reservationIds.length?supabase.from("reservas").select("id,numero_reserva,nombre_huesped").eq("property_id",propertyId).in("id",reservationIds):Promise.resolve({data:[],error:null}),
    profileIds.length?supabase.from("profiles").select("id,full_name").in("id",profileIds):Promise.resolve({data:[],error:null}),
  ])
  if(reservationRes.error)throw reservationRes.error
  if(profileRes.error)throw profileRes.error
  const reservations=new Map((reservationRes.data||[]).map(row=>[Number(row.id),row]))
  const profiles=new Map((profileRes.data||[]).map(row=>[row.id,row]))
  const rows=[]
  for(const row of payments){
    const actual=physicalPayment(row),reservation=reservations.get(Number(row.reserva_id))
    rows.push({
      key:`p-${row.id}`,created_at:row.created_at,type:"Cobro",method:row.metodo,amount:actual.amount,currency:actual.currency,direction:"in",
      concept:row.nota||"Pago de reserva",reference:row.referencia||row.external_ref||"",
      reservation:reservation?[reservation.numero_reserva,reservation.nombre_huesped].filter(Boolean).join(" · "):"Reserva",
      user:profiles.get(row.created_by)?.full_name||"Sistema",
    })
  }
  for(const row of movements){
    const out=["expense","refund"].includes(norm(row.movement_type)),reservation=reservations.get(Number(row.reservation_id))
    rows.push({
      key:`m-${row.id}`,created_at:row.created_at,type:norm(row.movement_type)==="refund"?"Devolución":out?"Egreso / gasto":"Ingreso",
      method:row.method,amount:Number(row.amount||0),currency:currency(row.currency),direction:out?"out":"in",
      concept:row.concept||"Movimiento de caja",reference:row.reference||"",
      reservation:reservation?[reservation.numero_reserva,reservation.nombre_huesped].filter(Boolean).join(" · "):"",
      user:profiles.get(row.created_by)?.full_name||"Sistema",
    })
  }
  rows.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
  const totals={income:pair(),expense:pair(),net:pair()}
  const byMethod={cash:pair(),transfer:pair(),mp:pair(),card:pair(),other:pair()}
  for(const row of rows){
    const sign=row.direction==="out"?-1:1
    if(sign<0)totals.expense[row.currency]+=row.amount
    else totals.income[row.currency]+=row.amount
    byMethod[cashMethodGroup(row.method)][row.currency]+=sign*row.amount
  }
  for(const code of["ARS","USD"]){
    totals.income[code]=round(totals.income[code])
    totals.expense[code]=round(totals.expense[code])
    totals.net[code]=round(totals.income[code]-totals.expense[code])
  }
  const methods=[["cash","Efectivo"],["transfer","Transferencias"],["mp","Mercado Pago / QR"],["card","Tarjetas"],["other","Otros"]].map(([key,label])=>({label,ARS:round(byMethod[key].ARS),USD:round(byMethod[key].USD)}))
  return{
    session,rows,totals,methods,
    diff:{ARS:round(Number(session.closing_amount||0)-Number(session.expected_amount||0)),USD:round(Number(session.closing_amount_usd||0)-Number(session.expected_amount_usd||0))},
    openedBy:profiles.get(session.opened_by)?.full_name||"Usuario",
    closedBy:profiles.get(session.closed_by)?.full_name||currentUser?.user_metadata?.full_name||currentUser?.email||"Usuario",
  }
}
const ascii=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,"-").replace(/…/g,"...").replace(/[^\x20-\x7E]/g,"?")
function wrap(value,width=88){
  const words=String(value||"").replace(/\s+/g," ").trim().split(" ").filter(Boolean),out=[]
  let line=""
  for(const word of words){const next=line?`${line} ${word}`:word;if(next.length>width){if(line)out.push(line);line=word}else line=next}
  if(line)out.push(line)
  return out.length?out:[""]
}
export function cashClosurePdf(report){
  const lines=[],add=(text="",bold=false)=>lines.push({text:ascii(text),bold})
  add("HABITACIONLLENA.COM",true);add("CIERRE DE CAJA",true);add(`Turno #${report.session.id}`)
  add(`Apertura: ${cashFmt(report.session.opened_at)} | Cierre: ${cashFmt(report.session.closed_at)}`)
  add(`Abierta por: ${report.openedBy} | Cerrada por: ${report.closedBy}`);add("")
  add("RESUMEN",true)
  const summary=[
    ["Ingresos",report.totals.income],["Egresos / gastos",report.totals.expense],["Neto",report.totals.net],
    ["Efectivo esperado",{ARS:report.session.expected_amount,USD:report.session.expected_amount_usd}],
    ["Efectivo contado",{ARS:report.session.closing_amount,USD:report.session.closing_amount_usd}],["Diferencia",report.diff],
  ]
  for(const[item,values]of summary)add(`${item}: ${Number(values.ARS||0).toFixed(2)} ARS | ${Number(values.USD||0).toFixed(2)} USD`)
  add("");add("MEDIOS DE PAGO - NETO",true)
  report.methods.forEach(item=>add(`${item.label}: ${item.ARS.toFixed(2)} ARS | ${item.USD.toFixed(2)} USD`))
  add("");add("LIBRO DE NOVEDADES",true)
  add("Novedades del turno:",true);wrap(report.handover?.note||"Sin novedades.").forEach(text=>add(text))
  add("Pendientes para el proximo turno:",true)
  const pending=Array.isArray(report.handover?.pending)?report.handover.pending:[]
  if(pending.length)pending.forEach((item,index)=>wrap(`${index+1}. ${item}`).forEach(text=>add(text)))
  else add("Sin pendientes informados.")
  add("");add("NOTA DE CAJA",true);wrap(report.session.notes||"Sin nota.").forEach(text=>add(text))
  add("");add(`MOVIMIENTOS (${report.rows.length})`,true)
  for(const row of report.rows){
    wrap(`${cashTime(row.created_at)} | ${row.type} | ${cashMethodLabel(row.method)} | ${row.reservation||"Sin reserva"} | ${row.direction==="out"?"-":"+"}${Number(row.amount).toFixed(2)} ${row.currency}`).forEach(text=>add(text))
    wrap(`  ${[row.concept,row.reference,row.user?`Usuario: ${row.user}`:""].filter(Boolean).join(" · ")}`,86).forEach(text=>add(text))
  }
  const pages=[];for(let i=0;i<lines.length;i+=64)pages.push(lines.slice(i,i+64))
  const objects=[];objects[1]="<< /Type /Catalog /Pages 2 0 R >>"
  const pageRefs=pages.map((_,index)=>5+index*2)
  objects[2]=`<< /Type /Pages /Kids [${pageRefs.map(ref=>`${ref} 0 R`).join(" ")}] /Count ${pages.length} >>`
  objects[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"
  objects[4]="<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>"
  pages.forEach((page,index)=>{
    const pageObject=5+index*2,contentObject=pageObject+1
    let y=800,stream="BT\n"
    for(const line of page){const text=line.text.replace(/([\\()])/g,"\\$1");stream+=`/${line.bold?"F2":"F1"} ${line.bold?9.2:8.3} Tf\n1 0 0 1 44 ${y} Tm\n(${text}) Tj\n`;y-=12}
    stream+="ET"
    objects[pageObject]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`
    objects[contentObject]=`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })
  let pdf="%PDF-1.4\n",offsets=[0]
  for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`}
  const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for(let i=1;i<objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`
  pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([new TextEncoder().encode(pdf)],{type:"application/pdf"})
}
export const cashClosureFileName=report=>`cierre-caja-${new Date(report.session.closed_at||Date.now()).toISOString().slice(0,10)}-turno-${report.session.id}.pdf`
