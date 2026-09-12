"use client"

import{cashClosureFileName,cashClosurePdf,cashDual,cashFmt,cashMethodLabel,cashMoney,cashTime}from"./cashClosureReport"
import s from"./cashActions.module.css"

const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))

export default function CashClosureReport({report,onBack,onClose,onError}){
  if(!report)return null
  function download(){
    const url=URL.createObjectURL(cashClosurePdf(report)),link=document.createElement("a")
    link.href=url;link.download=cashClosureFileName(report);link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  async function share(){
    try{
      const file=new File([cashClosurePdf(report)],cashClosureFileName(report),{type:"application/pdf"})
      if(!navigator.share||(navigator.canShare&&!navigator.canShare({files:[file]}))){download();return}
      await navigator.share({title:`Cierre de caja #${report.session.id}`,files:[file]})
    }catch(error){
      if(error?.name!=="AbortError")onError?.("No se pudo compartir desde este dispositivo. Podés descargar el PDF y adjuntarlo manualmente.")
    }
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
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cierre de caja</title><style>
      @page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#172033;font-size:11px}header{border-bottom:2px solid #5966dc;padding-bottom:10px}h1{margin:4px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:14px 0}.card,.note{border:1px solid #d9dfeb;border-radius:8px;padding:9px}.card small{color:#667085}.note{white-space:pre-wrap}.methods{display:flex;gap:8px;flex-wrap:wrap}table{width:100%;border-collapse:collapse;font-size:9px;margin-top:10px}th,td{padding:6px;border-bottom:1px solid #e5e8ef;text-align:left;vertical-align:top}.n{text-align:right;white-space:nowrap;font-weight:700}tr{break-inside:avoid}
    </style></head><body><header><small>HABITACIÓN LLENA · CAJA DIARIA</small><h1>Cierre de caja · Turno #${esc(report.session.id)}</h1><div>Apertura ${esc(cashFmt(report.session.opened_at))} · Cierre ${esc(cashFmt(report.session.closed_at))}<br>Abierta por ${esc(report.openedBy)} · Cerrada por ${esc(report.closedBy)}</div></header><div class="grid">${cards}</div><h3>Medios de pago · neto</h3><div class="methods">${report.methods.map(item=>`<span><b>${esc(item.label)}</b> ${esc(cashDual(item.ARS,item.USD))}</span>`).join(" · ")}</div><h3>Nota de cierre</h3><div class="note">${esc(report.session.notes||"Sin nota.")}</div><h3>Movimientos (${report.rows.length})</h3><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Medio</th><th>Reserva / huésped</th><th>Concepto</th><th>Importe</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Sin movimientos.</td></tr>'}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),150)<\/script></body></html>`)
    popup.document.close()
  }
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",alignItems:"center"}}>
      <div><b>Turno #{report.session.id}</b><small style={{display:"block",color:"var(--muted)"}}>{cashFmt(report.session.opened_at)} → {cashFmt(report.session.closed_at)} · {report.closedBy}</small></div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        <button type="button" className={s.secondary} onClick={print}>Imprimir</button>
        <button type="button" className={s.save} onClick={download}>Descargar PDF</button>
        <button type="button" className={s.secondary} onClick={share}>Compartir PDF</button>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,margin:"14px 0"}}>
      {[
        ["Ingresos",report.totals.income],["Egresos / gastos",report.totals.expense],["Neto",report.totals.net],
        ["Efectivo inicial",{ARS:report.session.opening_amount,USD:report.session.opening_amount_usd}],["Diferencia",report.diff],
      ].map(([label,value])=><article key={label} style={{padding:10,border:"1px solid var(--line)",borderRadius:11}}><small style={{color:"var(--muted)"}}>{label}</small><b style={{display:"block",marginTop:4}}>{cashDual(value.ARS,value.USD)}</b></article>)}
      <article style={{padding:10,border:"1px solid var(--line)",borderRadius:11}}><small style={{color:"var(--muted)"}}>Esperado → contado</small><b style={{display:"block",marginTop:4}}>{cashDual(report.session.expected_amount,report.session.expected_amount_usd)} → {cashDual(report.session.closing_amount,report.session.closing_amount_usd)}</b></article>
    </div>
    <div style={{padding:10,border:"1px solid var(--line)",borderRadius:11,marginBottom:12}}>
      <b>Medios de pago · neto</b><div style={{marginTop:5}}>{report.methods.map(item=>`${item.label} ${cashDual(item.ARS,item.USD)}`).join(" · ")}</div>
    </div>
    <div style={{padding:10,border:"1px solid var(--line)",borderRadius:11,marginBottom:12,whiteSpace:"pre-wrap"}}>
      <small style={{color:"var(--muted)"}}>NOTA DE CIERRE</small><div style={{marginTop:4}}>{report.session.notes||"Sin nota."}</div>
    </div>
    <h3 style={{fontSize:12}}>Movimientos · {report.rows.length}</h3>
    <div style={{display:"grid",gap:5,maxHeight:300,overflow:"auto"}}>
      {report.rows.map(row=><div key={row.key} style={{display:"grid",gridTemplateColumns:"52px minmax(0,1fr) 110px",gap:7,padding:8,border:"1px solid var(--line)",borderRadius:9,fontSize:10}}>
        <span>{cashTime(row.created_at)}</span>
        <div><b>{row.type} · {cashMethodLabel(row.method)}</b><small style={{display:"block",color:"var(--muted)"}}>{row.concept}{row.reference?` · ${row.reference}`:""}</small><small style={{display:"block",color:"var(--muted)"}}>{row.reservation||"Sin reserva"} · {row.user}</small></div>
        <strong style={{textAlign:"right"}}>{row.direction==="out"?"−":"+"}{cashMoney(row.amount,row.currency)}</strong>
      </div>)}
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}>
      {onBack?<button type="button" className={s.secondary} onClick={onBack}>Ver otros cierres</button>:null}
      <button type="button" className={s.save} onClick={download}>Descargar PDF</button>
      {onClose?<button type="button" className={s.secondary} onClick={onClose}>Cerrar</button>:null}
    </div>
  </div>
}
