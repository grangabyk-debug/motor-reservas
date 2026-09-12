"use client"

import{cashClosureFileName,cashClosurePdf,cashDual,cashFmt,cashMethodLabel,cashMoney,cashTime}from"./cashClosureReport"
import{parseCashSessionMeta}from"./cashSessionMeta"
import s from"./cashActions.module.css"
import r from"./cashClosureReport.module.css"

const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))
const methodKind=label=>label.startsWith("Efectivo")?"cash":label.startsWith("Transfer")?"transfer":label.startsWith("Mercado")?"mp":label.startsWith("Tarjeta")?"card":"other"

export default function CashClosureReport({report,onBack,onClose,onError}){
  if(!report)return null
  const meta=parseCashSessionMeta(report.session.notes)
  const openedByName=meta.openerName||report.openedBy
  const shift=meta.shift||"Sin especificar"
  const normalized={...report,openedBy:`${openedByName}${meta.shift?` · Turno ${meta.shift}`:""}`,session:{...report.session,notes:meta.closeNote}}
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
    </style></head><body><header><small>HABITACIÓN LLENA · CAJA DIARIA</small><h1>Cierre de caja · Turno #${esc(report.session.id)}</h1><div>${meta.shift?`Turno ${esc(meta.shift)} · `:""}Apertura ${esc(cashFmt(report.session.opened_at))} · Cierre ${esc(cashFmt(report.session.closed_at))}<br>Abierta por ${esc(openedByName)} · Cerrada por ${esc(report.closedBy)}</div></header><div class="grid">${cards}</div><h3>Medios de pago · neto</h3><div class="methods">${report.methods.map(item=>`<span><b>${esc(item.label)}</b> ${esc(cashDual(item.ARS,item.USD))}</span>`).join(" · ")}</div><h3>Nota de cierre</h3><div class="note">${esc(meta.closeNote||"Sin nota.")}</div><h3>Movimientos (${report.rows.length})</h3><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Medio</th><th>Reserva / huésped</th><th>Concepto</th><th>Importe</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Sin movimientos.</td></tr>'}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),150)<\/script></body></html>`)
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
      </div>
    </div>

    <div className={r.kpis}>
      {cards.map(item=><article key={item.label} className={r.kpi} data-tone={item.tone}><small>{item.label}</small><b>{cashDual(item.value.ARS,item.value.USD)}</b></article>)}
      <article className={r.kpi} data-tone="reconcile"><small>Esperado → contado</small><b>{cashDual(report.session.expected_amount,report.session.expected_amount_usd)} → {cashDual(report.session.closing_amount,report.session.closing_amount_usd)}</b></article>
      <article className={r.kpi} data-diff={diffOk?"ok":"bad"}><small>Diferencia</small><b>{cashDual(report.diff.ARS,report.diff.USD)}</b></article>
    </div>

    <section className={r.section}>
      <div className={r.sectionTitle}><b>Medios de pago · neto</b><small>Totales del turno</small></div>
      <div className={r.methods}>{report.methods.map(item=><div key={item.label} className={r.method} data-kind={methodKind(item.label)}><i/><b>{item.label}</b><span>{cashDual(item.ARS,item.USD)}</span></div>)}</div>
    </section>

    <div className={r.note}><small>Nota de cierre</small><div>{meta.closeNote||"Sin nota."}</div></div>

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
