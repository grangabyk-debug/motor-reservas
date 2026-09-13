"use client"

import{useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{cashClosureFileName,cashClosurePdf,cashDual,cashFmt,cashMethodLabel,cashMoney,cashTime}from"./cashClosureReport"
import{parseCashSessionMeta}from"./cashSessionMeta"
import s from"./cashActions.module.css"
import r from"./cashClosureReport.module.css"

const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))
const methodKind=label=>label.startsWith("Efectivo")?"cash":label.startsWith("Transfer")?"transfer":label.startsWith("Mercado")?"mp":label.startsWith("Tarjeta")?"card":"other"
const blobBase64=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");reader.onerror=()=>reject(reader.error||new Error("No se pudo preparar el PDF."));reader.readAsDataURL(blob)})

export default function CashClosureReport({propertyId,report,onBack,onClose,onError}){
  const[emailOpen,setEmailOpen]=useState(false),[emailTo,setEmailTo]=useState(""),[emailSending,setEmailSending]=useState(false),[emailStatus,setEmailStatus]=useState("")
  if(!report)return null
  const meta=parseCashSessionMeta(report.session.notes)
  const openedByName=meta.openerName||report.openedBy
  const shift=meta.shift||"Sin especificar"
  const pending=Array.isArray(meta.handoverPending)?meta.handoverPending:[]
  const normalized={...report,openedBy:`${openedByName}${meta.shift?` · Turno ${meta.shift}`:""}`,handover:{note:meta.handoverNote,pending},session:{...report.session,notes:meta.closeNote}}
  const diffOk=Math.abs(Number(report.diff.ARS||0))<.01&&Math.abs(Number(report.diff.USD||0))<.01

  function download(){
    const url=URL.createObjectURL(cashClosurePdf(normalized)),link=document.createElement("a")
    link.href=url;link.download=cashClosureFileName(normalized);link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  async function share(){
    try{
      const file=new File([cashClosurePdf(normalized)],cashClosureFileName(normalized),{type:"application/pdf"})
      if(!navigator.share||(navigator.canShare&&!navigator.canShare({files:[file]}))){download();return}
      await navigator.share({title:`Cierre de caja #${report.session.id}`,files:[file]})
    }catch(error){
      if(error?.name!=="AbortError")onError?.("No se pudo compartir desde este dispositivo. Podés descargar el PDF y adjuntarlo manualmente.")
    }
  }
  async function sendEmail(){
    setEmailSending(true);setEmailStatus("")
    try{
      if(!propertyId)throw new Error("No se pudo identificar la propiedad.")
      const{data:{session},error:sessionError}=await supabase.auth.getSession()
      if(sessionError||!session?.access_token)throw new Error("Tu sesión venció. Volvé a ingresar para enviar el correo.")
      const pdf=cashClosurePdf(normalized),content=await blobBase64(pdf)
      const response=await fetch("/api/hotel/cash-closure/email",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({property_id:propertyId,session_id:report.session.id,recipient:emailTo.trim(),attachment:{filename:cashClosureFileName(normalized),content,content_type:"application/pdf"}})})
      const result=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(result?.error||"No se pudo enviar el cierre por email.")
      setEmailStatus(`Enviado correctamente${result?.recipients?` a ${result.recipients} destinatario${result.recipients===1?"":"s"}`:""}.`)
    }catch(error){onError?.(error?.message||"No se pudo enviar el cierre por email.")}
    finally{setEmailSending(false)}
  }
  function print(){
    const popup=window.open("","_blank","width=980,height=760")
    if(!popup){onError?.("El navegador bloqueó la ventana de impresión.");return}
    const rows=report.rows.map(row=>`<tr><td>${esc(cashFmt(row.created_at))}</td><td>${esc(row.type)}</td><td>${esc(cashMethodLabel(row.method))}</td><td>${esc(row.reservation||"—")}</td><td>${esc(row.concept)}${row.reference?`<br><small>${esc(row.reference)}</small>`:""}</td><td class="n">${esc(`${row.direction==="out"?"-":"+"}${cashMoney(row.amount,row.currency)}`)}</td></tr>`).join("")
    const cards=[
      ["Ingresos",cashDual(report.totals.income.ARS,report.totals.income.USD)],
      ["Egresos / gastos",cashDual(report.totals.expense.ARS,report.totals.expense.USD)],
      ["Neto",cashDual(report.totals.net.ARS,report.totals.net.USD)],
      ["Efectivo inicial",cashDual(report.session.opening_amount,report.session.opening_amount_usd)],
      ["Esperado → contado",`${cashDual(report.session.expected_amount,report.session.expected_amount_usd)} → ${cashDual(report.session.closing_amount,report.session.closing_amount_usd)}`],
      ["Diferencia",cashDual(report.diff.ARS,report.diff.USD)],
    ].map(([label,value])=>`<div class="card"><small>${esc(label)}</small><br><b>${esc(value)}</b></div>`).join("")
    const pendingHtml=pending.length?`<ul>${pending.map(item=>`<li>${esc(item)}</li>`).join("")}</ul>`:"<div>Sin pendientes informados.</div>"
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cierre de caja</title><style>
      @page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#172033;font-size:11px}header{border-bottom:2px solid #5966dc;padding-bottom:10px}h1{margin:4px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:14px 0}.card,.note{border:1px solid #d9dfeb;border-radius:8px;padding:9px}.card small{color:#667085}.note{white-space:pre-wrap;margin-bottom:8px}.methods{display:flex;gap:8px;flex-wrap:wrap}table{width:100%;border-collapse:collapse;font-size:9px;margin-top:10px}th,td{padding:6px;border-bottom:1px solid #e5e8ef;text-align:left;vertical-align:top}.n{text-align:right;white-space:nowrap;font-weight:700}tr{break-inside:avoid}ul{margin:6px 0 0;padding-left:18px}
    </style></head><body><header><small>HABITACIÓN LLENA · CAJA DIARIA</small><h1>Cierre de caja · Turno #${esc(report.session.id)}</h1><div>${meta.shift?`Turno ${esc(meta.shift)} · `:""}Apertura ${esc(cashFmt(report.session.opened_at))} · Cierre ${esc(cashFmt(report.session.closed_at))}<br>Abierta por ${esc(openedByName)} · Cerrada por ${esc(report.closedBy)}</div></header><div class="grid">${cards}</div><h3>Medios de pago · neto</h3><div class="methods">${report.methods.map(item=>`<span><b>${esc(item.label)}</b> ${esc(cashDual(item.ARS,item.USD))}</span>`).join(" · ")}</div><h3>Libro de novedades</h3><div class="note"><b>Novedades del turno</b><br>${esc(meta.handoverNote||"Sin novedades.")}</div><div class="note"><b>Pendientes para el próximo turno</b>${pendingHtml}</div><h3>Nota de caja</h3><div class="note">${esc(meta.closeNote||"Sin nota.")}</div><h3>Movimientos (${report.rows.length})</h3><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Medio</th><th>Reserva / huésped</th><th>Concepto</th><th>Importe</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Sin movimientos.</td></tr>'}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),150)<\/script></body></html>`)
    popup.document.close()
  }

  const cards=[
    {label:"Ingresos",value:report.totals.income,tone:"income"},
    {label:"Egresos / gastos",value:report.totals.expense,tone:"expense"},
    {label:"Neto",value:report.totals.net,tone:"net"},
    {label:"Efectivo inicial",value:{ARS:report.session.opening_amount,USD:report.session.opening_amount_usd},tone:"opening"},
  ]

  return <div className={r.report}>
    <div className={r.top}>
      <div className={r.turnInfo}>
        <b>Cierre de caja · #{report.session.id}</b>
        <div className={r.metaLine}>
          <span className={r.shift}>Turno {shift}</span>
          <span>{cashFmt(report.session.opened_at)} → {cashFmt(report.session.closed_at)}</span>
          <span>·</span><span>Abrió {openedByName}</span><span>·</span><span>Cerró {report.closedBy}</span>
        </div>
      </div>
      <div className={r.actions}>
        <button type="button" className={s.secondary} onClick={print}>Imprimir</button>
        <button type="button" className={s.save} onClick={download}>Descargar PDF</button>
        <button type="button" className={s.secondary} onClick={share}>Compartir PDF</button>
        <button type="button" className={s.secondary} onClick={()=>{setEmailOpen(value=>!value);setEmailStatus("")}}>Enviar por email</button>
      </div>
    </div>

    {emailOpen?<section className={r.section}>
      <div className={r.sectionTitle}><b>Enviar cierre + libro de novedades</b><small>El PDF se adjunta automáticamente</small></div>
      <label className={`${s.field} ${s.fieldFull}`}><span>Destinatario · opcional</span><input type="email" value={emailTo} onChange={event=>setEmailTo(event.target.value)} placeholder="gerencia@hotel.com · vacío = destinatarios configurados en Informes"/></label>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginTop:10}}>
        <small style={{color:emailStatus?"var(--green)":"var(--muted)",fontSize:10.5}}>{emailStatus||"Se envía un resumen del turno con el cierre en PDF adjunto."}</small>
        <button type="button" className={s.save} disabled={emailSending} onClick={sendEmail}>{emailSending?"Enviando…":"Enviar email"}</button>
      </div>
    </section>:null}

    <div className={r.kpis}>
      {cards.map(item=><article key={item.label} className={r.kpi} data-tone={item.tone}><small>{item.label}</small><b>{cashDual(item.value.ARS,item.value.USD)}</b></article>)}
      <article className={r.kpi} data-tone="reconcile"><small>Esperado → contado</small><b>{cashDual(report.session.expected_amount,report.session.expected_amount_usd)} → {cashDual(report.session.closing_amount,report.session.closing_amount_usd)}</b></article>
      <article className={r.kpi} data-diff={diffOk?"ok":"bad"}><small>Diferencia</small><b>{cashDual(report.diff.ARS,report.diff.USD)}</b></article>
    </div>

    <section className={r.section}>
      <div className={r.sectionTitle}><b>Medios de pago · neto</b><small>Totales del turno</small></div>
      <div className={r.methods}>{report.methods.map(item=><div key={item.label} className={r.method} data-kind={methodKind(item.label)}><i/><b>{item.label}</b><span>{cashDual(item.ARS,item.USD)}</span></div>)}</div>
    </section>

    <div className={r.note}><small>Libro de novedades · novedades del turno</small><div>{meta.handoverNote||"Sin novedades."}</div></div>
    <div className={r.note}><small>Pendientes para el próximo turno</small><div>{pending.length?pending.map((item,index)=>`${index+1}. ${item}`).join("\n"):"Sin pendientes informados."}</div></div>
    <div className={r.note}><small>Nota de caja</small><div>{meta.closeNote||"Sin nota."}</div></div>

    <div className={r.movementsTitle}><h3>Movimientos</h3><span>{report.rows.length} registrados</span></div>
    <div className={r.movementList}>
      {report.rows.length?report.rows.map(row=><div key={row.key} className={r.movement} data-out={row.direction==="out"?"true":"false"}>
        <span className={r.time}>{cashTime(row.created_at)}</span>
        <div className={r.movementMain}>
          <b>{row.type} · {cashMethodLabel(row.method)}</b>
          <small>{row.concept}{row.reference?` · ${row.reference}`:""}</small>
          <small>{row.reservation||"Sin reserva"} · {row.user}</small>
        </div>
        <strong className={r.amount}>{row.direction==="out"?"−":"+"}{cashMoney(row.amount,row.currency)}</strong>
      </div>):<div className={s.empty}>Sin movimientos en este turno.</div>}
    </div>

    <div className={r.bottom}>
      {onBack?<button type="button" className={s.secondary} onClick={onBack}>Ver otros cierres</button>:null}
      <button type="button" className={s.save} onClick={download}>Descargar PDF</button>
      {onClose?<button type="button" className={s.secondary} onClick={onClose}>Cerrar</button>:null}
    </div>
  </div>
}
