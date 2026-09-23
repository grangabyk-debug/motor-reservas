"use client"

import{useEffect,useMemo,useState}from"react"
import{createPortal}from"react-dom"
import{supabase}from"../../../../lib/supabase"
import s from"./reservationFolioBilling.module.css"
import{printReservationFinanceDocument}from"./reservationInvoicePrint"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):"—"
const DOC_LABELS={invoice:"Factura",credit_note:"Nota de crédito",debit_note:"Nota de débito",receipt:"Recibo",proforma:"Proforma",folio:"Folio"}
const TAX_LABELS={consumidor_final:"Consumidor final",responsable_inscripto:"Responsable inscripto",monotributo:"Monotributo",exento:"Exento",cliente_exterior:"Cliente del exterior",no_categorizado:"No categorizado",no_alcanzado:"IVA no alcanzado"}
const STATUS_LABELS={draft:"Borrador",issued:"Emitida",void:"Anulada",cancelled:"Cancelada",paid:"Pagada",partial:"Pago parcial"}
const SALE_LABELS={contado:"Contado",cuenta_corriente:"Cuenta corriente"}
const A_VARIANT_LABELS={cbu:"PAGO EN CBU INFORMADA",retention:"OPERACIÓN SUJETA A RETENCIÓN"}
const docLabel=doc=>DOC_LABELS[doc?.document_type]||"Documento"
const docNumber=doc=>doc?.number||"Sin numerar"
const nextType=doc=>doc?.document_type==="invoice"?"credit_note":doc?.document_type==="credit_note"?"debit_note":null
const nextLabel=type=>type==="credit_note"?"Nota de crédito":"Nota de débito"
const rowTotal=row=>{const quantity=Math.max(0,Number(row?.quantity)||0),unit=Math.max(0,Number(row?.unit_price)||0),rate=Math.max(0,Number(row?.tax_rate)||0);return Number.isFinite(Number(row?.total))?Number(row.total):quantity*unit*(1+rate/100)}

function sourceLines(doc,remaining){
  const rows=Array.isArray(doc?.items)?doc.items:[]
  const original=Math.max(0,Number(doc?.total)||0)
  const factor=original>0?Math.min(1,Math.max(0,remaining/original)):1
  if(rows.length)return rows.map((row,index)=>({key:`${index}-${row.description||"concepto"}`,description:row.description||"Concepto",detail:row.detail||null,quantity:Math.max(.0001,Number(row.quantity)||1),unit_price:(Number(row.unit_price)||0)*factor,tax_rate:Math.max(0,Number(row.tax_rate)||0)}))
  const tax=Math.max(0,Number(doc?.tax)||0),subtotal=Math.max(0,Number(doc?.subtotal)||Math.max(0,original-tax)),rate=subtotal>0?tax/subtotal*100:0
  return[{key:"document-total",description:docLabel(doc),detail:null,quantity:1,unit_price:remaining/(1+rate/100),tax_rate:rate}]
}

export default function ReservationDocumentHistory({documents,selected,reservation,propertyId,onRefresh,setError,onIssueDocument}){
  const[showAll,setShowAll]=useState(false)
  const[adjustment,setAdjustment]=useState(null)
  const[preview,setPreview]=useState(null)
  const[saving,setSaving]=useState(false)
  const folioDocs=useMemo(()=>selected?documents.filter(row=>row.folio_id===selected.id):[],[documents,selected?.id])
  const relatedById=useMemo(()=>new Map(documents.map(row=>[row.id,row])),[documents])

  function usedAmount(doc,type){return documents.filter(row=>row.related_document_id===doc.id&&row.document_type===type&&row.status!=="void").reduce((sum,row)=>sum+Math.max(0,Number(row.total)||0),0)}
  function remainingFor(doc,type){return Math.max(0,(Number(doc.total)||0)-usedAmount(doc,type))}
  function openPreview(doc){setError?.("");setPreview(doc)}
  function openAdjustment(doc){
    const type=nextType(doc);if(!type)return
    const remaining=remainingFor(doc,type)
    if(doc.status==="draft"||doc.status==="void")return setError?.("Primero debe estar emitido el comprobante original.")
    if(remaining<=.009)return setError?.(type==="credit_note"?"Esta factura ya no tiene saldo disponible para acreditar.":"Esta Nota de Crédito ya fue compensada por completo.")
    setError?.("")
    setAdjustment({type,original:doc,mode:"total",reason:"",status:"draft",lines:sourceLines(doc,remaining),remaining})
  }
  function calc(lines){let subtotal=0,tax=0;for(const line of lines||[]){const base=Math.max(0,Number(line.quantity)||0)*Math.max(0,Number(line.unit_price)||0),rate=Math.max(0,Number(line.tax_rate)||0);subtotal+=base;tax+=base*rate/100}return{subtotal,tax,total:subtotal+tax}}
  function setMode(mode){setAdjustment(current=>current?{...current,mode,lines:sourceLines(current.original,current.remaining)}:current)}
  function updateLine(index,key,value){setAdjustment(current=>current?{...current,lines:current.lines.map((line,i)=>i===index?{...line,[key]:value}:line)}:current)}
  function removeLine(index){setAdjustment(current=>current?{...current,mode:"partial",lines:current.lines.filter((_,i)=>i!==index)}:current)}
  function addLine(){setAdjustment(current=>current?{...current,mode:"partial",lines:[...current.lines,{key:`manual-${Date.now()}`,description:"",detail:null,quantity:1,unit_price:0,tax_rate:Number(current.original?.items?.[0]?.tax_rate)||0}]}:current)}

  async function issueExisting(doc){
    if(!doc||saving||!onIssueDocument)return
    const original=doc.related_document_id?relatedById.get(doc.related_document_id):null
    setSaving(true);setError?.("")
    try{
      const invoice=await onIssueDocument(doc,original)
      await onRefresh?.(true)
      setPreview(current=>current?.id===doc.id?null:current)
      if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:"Comprobante autorizado",message:`ARCA otorgó CAE ${invoice?.cae||""}.`}}))
    }catch(err){setError?.(`ARCA no autorizó el comprobante: ${err?.message||"error de autorización"}. El documento sigue como borrador y podés reintentar.`)}
    finally{setSaving(false)}
  }

  async function saveAdjustment(){
    if(!adjustment||saving)return
    const totals=calc(adjustment.lines)
    if(!adjustment.reason.trim())return setError?.("Indicá el motivo de la nota.")
    if(!adjustment.lines.length||totals.total<=0)return setError?.("La nota necesita al menos un concepto con importe.")
    if(adjustment.lines.some(line=>!String(line.description||"").trim()))return setError?.("Completá la descripción de todos los conceptos.")
    if(totals.total>adjustment.remaining+.01)return setError?.(`${nextLabel(adjustment.type)} supera el importe disponible de ${money(adjustment.remaining,adjustment.original.currency)}.`)
    setSaving(true);setError?.("")
    let created=null
    try{
      const userRes=await supabase.auth.getUser();if(userRes.error)throw userRes.error
      const payloadItems=adjustment.lines.map(line=>{const quantity=Math.max(0,Number(line.quantity)||0),unitPrice=Math.max(0,Number(line.unit_price)||0),taxRate=Math.max(0,Number(line.tax_rate)||0),subtotal=quantity*unitPrice,tax=subtotal*taxRate/100;return{description:String(line.description||"").trim(),detail:line.detail||null,quantity,unit_price:unitPrice,tax_rate:taxRate,subtotal,tax,total:subtotal+tax}})
      const original=adjustment.original,billing={...(original.billing_to||{}),payment_methods:[],payment_method_label:null,payment_covered:0,payment_pending:totals.total,sale_condition:"cuenta_corriente"}
      const payload={property_id:propertyId,reservation_id:Number(reservation.id),folio_id:selected.id,payment_id:null,document_type:adjustment.type,number:null,status:"draft",currency:original.currency||reservation.moneda||"ARS",subtotal:totals.subtotal,tax:totals.tax,total:totals.total,balance:totals.total,billing_to:billing,items:payloadItems,folio_item_ids:[],billing_mode:adjustment.mode==="total"?"adjustment_total":"adjustment_partial",issued_at:null,due_at:original.due_at||reservation.fecha_salida||null,external_ref:null,notes:`${nextLabel(adjustment.type)} vinculada a ${docLabel(original)} ${docNumber(original)}`,created_by:userRes.data?.user?.id||null,related_document_id:original.id,adjustment_reason:adjustment.reason.trim()}
      const res=await supabase.from("hotel_finance_documents").insert(payload).select("*").single();if(res.error)throw res.error
      created=res.data
      if(adjustment.status==="issued"){
        if(!onIssueDocument)throw new Error("La integración ARCA no está disponible.")
        await onIssueDocument(created,original)
      }
      setAdjustment(null);await onRefresh?.(true)
      if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:["hotel_finance_documents"]}}))
    }catch(err){
      if(created&&adjustment.status==="issued"){setAdjustment(null);await onRefresh?.(true);setError?.(`La nota quedó guardada como borrador, pero ARCA no la autorizó: ${err?.message||"error de autorización"}. Podés reintentar desde Facturas y notas vinculadas.`)}
      else setError?.(err?.message||"No se pudo crear la nota.")
    }finally{setSaving(false)}
  }

  const visible=showAll?folioDocs:folioDocs.slice(0,4)
  const actionButton={height:28,padding:"0 8px",border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:9.5,fontWeight:850,cursor:"pointer",whiteSpace:"nowrap"}
  const tag={display:"inline-flex",alignItems:"center",height:20,padding:"0 6px",borderRadius:999,border:"1px solid var(--line)",fontSize:8.5,fontWeight:900,letterSpacing:".02em",whiteSpace:"nowrap"}

  return <>
    <div className={s.docs}>
      <header><b>Facturas y notas vinculadas</b>{folioDocs.length>4?<button type="button" onClick={()=>setShowAll(value=>!value)}>{showAll?"Ver menos":`Ver todas (${folioDocs.length})`}</button>:null}</header>
      {folioDocs.length?visible.map(doc=>{
        const type=nextType(doc),remaining=type?remainingFor(doc,type):0,original=doc.related_document_id?relatedById.get(doc.related_document_id):null,fiscal=Boolean(doc.billing_to?.cae)
        return <div key={doc.id} role="button" tabIndex={0} aria-label={`Ver ${docLabel(doc)} ${docNumber(doc)}`} onClick={()=>openPreview(doc)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openPreview(doc)}}} style={{gap:8,cursor:"pointer"}}>
          <span style={{minWidth:0}}><span style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><b>{docNumber(doc)}</b><em style={tag}>{docLabel(doc)}</em>{fiscal?<em style={{...tag,color:"#26794d",borderColor:"color-mix(in srgb,#2d9f62 28%,var(--line))"}}>CAE</em>:null}</span><small>{doc.billing_mode==="payment"?"Sobre pago":doc.billing_mode==="partial_items"?"Parcial":doc.billing_mode==="adjustment_partial"?"Ajuste parcial":doc.billing_mode==="adjustment_total"?"Ajuste total":"Sobre folio"} · {fmtDateTime(doc.issued_at||doc.created_at)}{original?` · Vinculada a ${docLabel(original)} ${docNumber(original)}`:""}</small></span>
          <strong>{money(doc.total,doc.currency)}</strong>
          <em data-status={doc.status}>{STATUS_LABELS[doc.status]||doc.status}</em>
          <span style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
            {doc.status==="draft"&&["invoice","credit_note","debit_note"].includes(doc.document_type)?<button type="button" style={actionButton} disabled={saving} onClick={event=>{event.stopPropagation();issueExisting(doc)}}>{saving?"Procesando…":"Emitir ARCA"}</button>:null}
            {type&&doc.status!=="draft"&&doc.status!=="void"&&remaining>.009?<button type="button" style={actionButton} onClick={event=>{event.stopPropagation();openAdjustment(doc)}}>{type==="credit_note"?"＋ Nota de crédito":"＋ Nota de débito"}</button>:null}
          </span>
        </div>
      }):<div className={s.emptySmall}>Todavía no hay facturas ni notas para este folio.</div>}
    </div>

    {preview?<DocumentPreview doc={preview} reservation={reservation} onClose={()=>setPreview(null)} onIssue={()=>issueExisting(preview)} saving={saving}/>:null}

    {adjustment?<div className={s.overlay} onMouseDown={event=>event.target===event.currentTarget&&!saving&&setAdjustment(null)}><div className={`${s.modal} ${s.invoiceModal}`}>
      <button className={s.close} onClick={()=>!saving&&setAdjustment(null)}>×</button>
      <small>{adjustment.type==="credit_note"?"NOTA DE CRÉDITO":"NOTA DE DÉBITO"}</small>
      <h2>Emitir {nextLabel(adjustment.type).toLowerCase()}</h2>
      <div style={{padding:"10px 12px",border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--bg) 45%,var(--panelSolid))",margin:"10px 0 12px",fontSize:10.5,lineHeight:1.5}}><b>{docLabel(adjustment.original)} {docNumber(adjustment.original)}</b><div>Cliente: {adjustment.original.billing_to?.name||reservation.nombre_huesped||"—"} · {TAX_LABELS[adjustment.original.billing_to?.iva_condition]||adjustment.original.billing_to?.iva_condition||"Condición IVA no informada"}</div><div>Disponible para ajustar: <b>{money(adjustment.remaining,adjustment.original.currency)}</b></div></div>
      <div className={s.scopeButtons} style={{marginBottom:12}}><button type="button" className={adjustment.mode==="total"?s.scopeActive:""} onClick={()=>setMode("total")}>Total disponible</button><button type="button" className={adjustment.mode==="partial"?s.scopeActive:""} onClick={()=>setMode("partial")}>Parcial</button></div>
      <div className={s.formGrid}><label className={s.full}><span>Motivo</span><input value={adjustment.reason} onChange={event=>setAdjustment(current=>({...current,reason:event.target.value}))} placeholder={adjustment.type==="credit_note"?"Ej. anulación, devolución, corrección de importe…":"Ej. diferencia o corrección documentada…"}/></label><label><span>Moneda</span><input value={adjustment.original.currency||"ARS"} readOnly/></label><label><span>Acción</span><select value={adjustment.status} onChange={event=>setAdjustment(current=>({...current,status:event.target.value}))}><option value="draft">Guardar borrador</option><option value="issued">Emitir y pedir CAE a ARCA</option></select></label></div>
      <div className={s.invoiceLines}><header><h3>Conceptos</h3>{adjustment.mode==="partial"?<button type="button" onClick={addLine}>＋ Agregar línea</button>:null}</header><div style={{overflowX:"auto",paddingBottom:2}}><div style={{minWidth:770}}><div style={{display:"grid",gridTemplateColumns:"minmax(210px,2fr) 80px 115px 90px 115px 40px",gap:7,alignItems:"end",padding:"8px 0 2px",fontSize:9.5,fontWeight:850,color:"var(--muted)"}}><span>Descripción</span><span>Unidades</span><span>Precio</span><span>IVA %</span><span>Total</span><span/></div>{adjustment.lines.map((line,index)=>{const row=calc([line]);return <div key={line.key||index} style={{display:"grid",gridTemplateColumns:"minmax(210px,2fr) 80px 115px 90px 115px 40px",gap:7,alignItems:"center",marginTop:7}}><input value={line.description} readOnly={adjustment.mode==="total"} onChange={event=>updateLine(index,"description",event.target.value)}/><input type="number" min="0" step="0.01" value={line.quantity} readOnly={adjustment.mode==="total"} onChange={event=>updateLine(index,"quantity",event.target.value)}/><input type="number" min="0" step="0.01" value={line.unit_price} readOnly={adjustment.mode==="total"} onChange={event=>updateLine(index,"unit_price",event.target.value)}/><input type="number" min="0" step="0.01" value={line.tax_rate} readOnly={adjustment.mode==="total"} onChange={event=>updateLine(index,"tax_rate",event.target.value)}/><div style={{height:42,display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"0 8px",border:"1px solid var(--line)",borderRadius:10,fontSize:10,fontWeight:900}}>{money(row.total,adjustment.original.currency)}</div>{adjustment.mode==="partial"?<button type="button" style={{height:42,padding:0}} onClick={()=>removeLine(index)}>×</button>:<span/>}</div>})}</div></div></div>
      {(()=>{const totals=calc(adjustment.lines);return <div className={s.invoiceTotals}><span>Subtotal <b>{money(totals.subtotal,adjustment.original.currency)}</b></span><span>IVA / impuestos <b>{money(totals.tax,adjustment.original.currency)}</b></span><strong>Total {money(totals.total,adjustment.original.currency)}</strong></div>})()}
      <div className={s.documentActions}><button type="button" onClick={()=>setAdjustment(null)} disabled={saving}>Cancelar</button><button className={s.primary} type="button" onClick={saveAdjustment} disabled={saving}>{saving?"Procesando…":adjustment.status==="issued"?"Emitir con ARCA":adjustment.type==="credit_note"?"Guardar nota de crédito":"Guardar nota de débito"}</button></div>
    </div></div>:null}
  </>
}

function DocumentPreview({doc,reservation,onClose,onIssue,saving}){
  const[portalRoot,setPortalRoot]=useState(null)
  useEffect(()=>{if(typeof document==="undefined"){setPortalRoot(null);return}setPortalRoot(document.querySelector("[data-theme]")||document.body)},[])
  const rows=Array.isArray(doc?.items)?doc.items:[],currency=doc?.currency||reservation?.moneda||"ARS",billing=doc?.billing_to||{}
  const total=Math.max(0,Number(doc?.total)||0),balance=Math.max(0,Number(doc?.balance)||0),applied=Math.max(0,total-balance)
  const receiptClass=String(billing.receipt_class||"").toUpperCase(),showTaxBreakdown=Boolean(billing.tax_breakdown_required)||["A","B","T"].includes(receiptClass)
  const title=doc?.status==="draft"?`Borrador de ${docLabel(doc).toLowerCase()}`:`${docLabel(doc)} ${docNumber(doc)}`
  const methods=Array.isArray(billing.payment_methods)?billing.payment_methods:[],tributes=Array.isArray(billing.tributes)?billing.tributes:[],transparency=billing.transparency||{},aVariant=A_VARIANT_LABELS[billing.invoice_a_variant]||null
  const qrSrc=billing.qr_svg?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(billing.qr_svg)}`:null
  if(!portalRoot)return null
  const preview=<div className={s.overlay} onMouseDown={event=>event.target===event.currentTarget&&onClose?.()}><div className={`${s.modal} ${s.invoiceModal}`} role="dialog" aria-modal="true" aria-label={title} style={{width:"min(1180px,calc(100vw - 40px))",maxHeight:"calc(100dvh - 40px)",padding:24}}>
    <button className={s.close} type="button" onClick={onClose}>×</button>
    <small>{docLabel(doc).toUpperCase()} · {STATUS_LABELS[doc.status]||doc.status||"Documento"}</small>
    <h2>{title}</h2>
    {aVariant&&receiptClass==="A"?<div style={{margin:"8px 0",padding:"8px 11px",border:"1px solid var(--line)",borderRadius:10,fontWeight:950,letterSpacing:".04em"}}>{aVariant}</div>:null}
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) minmax(200px,.8fr)",gap:10,margin:"10px 0 12px"}}>
      <div style={{padding:"11px 12px",border:"1px solid var(--line)",borderRadius:12,background:"color-mix(in srgb,var(--bg) 42%,var(--panelSolid))",fontSize:10.5,lineHeight:1.55}}>
        {billing.issuer_legal_name?<><b style={{display:"block"}}>{billing.issuer_trade_name||billing.issuer_legal_name}</b><div>{billing.issuer_legal_name} · CUIT {billing.issuer_tax_id||"—"}</div><div>{billing.issuer_fiscal_address||"—"}</div><div>Ingresos Brutos: {billing.issuer_gross_income_condition==="non_contributor"?"No contribuyente":billing.issuer_gross_income_number||"—"} · Inicio: {fmtDate(billing.issuer_activity_start_date)}</div><hr style={{border:0,borderTop:"1px solid var(--line)",margin:"8px 0"}}/></>:null}
        <b>{billing.name||reservation?.nombre_huesped||"Cliente sin identificar"}</b>
        <div>{TAX_LABELS[billing.iva_condition]||billing.iva_condition||"Condición IVA no informada"}{receiptClass?` · ${docLabel(doc)} ${receiptClass}`:""}</div>
        <div>{billing.doc_type?String(billing.doc_type).toUpperCase():"Documento"}: {billing.tax_id||"—"}</div>
        {billing.address?<div>{billing.address}</div>:null}
        {billing.folio_label?<div>Folio: {billing.folio_label}</div>:null}
        <div style={{marginTop:6}}><b>Condición de venta: {SALE_LABELS[billing.sale_condition]||billing.sale_condition||"—"}</b></div>
        {methods.length?methods.map((row,index)=><div key={`${row.payment_id||index}-${index}`} style={{color:"var(--muted)"}}>{row.method||"Pago"} · {money(row.amount,row.currency||currency)}</div>):<div style={{color:"var(--muted)"}}>Sin pagos aplicados al emitir.</div>}
        {currency==="USD"?<div style={{marginTop:4}}>Cotización ARS/USD: <b>{Number(billing.exchange_rate||0).toLocaleString("es-AR",{maximumFractionDigits:6})}</b></div>:null}
      </div>
      <div style={{display:"grid",gap:7}}><PreviewStat label="Total" value={money(total,currency)}/><PreviewStat label="Pago imputado" value={money(applied,currency)}/><PreviewStat label="Saldo" value={money(balance,currency)} strong/>{billing.point_of_sale?<PreviewStat label="Punto de venta" value={String(billing.point_of_sale).padStart(5,"0")}/>:null}</div>
    </div>

    <div className={s.invoiceLines}><header><h3>Conceptos</h3><span style={{fontSize:9.5,color:"var(--muted)",fontWeight:800}}>{rows.length} línea{rows.length===1?"":"s"}</span></header><div style={{overflowX:"auto",paddingBottom:2}}><div style={{minWidth:showTaxBreakdown?760:570}}><div style={{display:"grid",gridTemplateColumns:showTaxBreakdown?"minmax(240px,2fr) 72px 118px 105px 105px":"minmax(260px,2fr) 72px 130px 130px",gap:8,padding:"7px 0 3px",fontSize:9,fontWeight:850,color:"var(--muted)"}}><span>Descripción</span><span>Cant.</span><span>{showTaxBreakdown?"Precio neto":"Precio final"}</span>{showTaxBreakdown?<><span>IVA</span><span style={{textAlign:"right"}}>IVA $</span></>:null}<span style={{textAlign:"right"}}>Total</span></div>{rows.length?rows.map((row,index)=>{const subtotal=(Number(row.quantity)||1)*(Number(row.unit_price)||0),tax=subtotal*(Number(row.tax_rate)||0)/100;return <div key={`${index}-${row.folio_item_id||row.description||"line"}`} style={{display:"grid",gridTemplateColumns:showTaxBreakdown?"minmax(240px,2fr) 72px 118px 105px 105px 120px":"minmax(260px,2fr) 72px 130px 130px",gap:8,alignItems:"center",padding:"9px 0",borderTop:"1px solid var(--line)",fontSize:10}}><span><b>{row.description||"Concepto"}</b>{row.detail?<small style={{display:"block",marginTop:2,color:"var(--muted)"}}>{row.detail}</small>:null}</span><span>{Number(row.quantity)||1}</span><span>{money(showTaxBreakdown?row.unit_price:(Number(row.unit_price)||0)*(1+(Number(row.tax_rate)||0)/100),currency)}</span>{showTaxBreakdown?<><span>{Number(row.tax_rate)||0}%</span><span style={{textAlign:"right"}}>{money(tax,currency)}</span></>:null}<strong style={{textAlign:"right"}}>{money(rowTotal(row),currency)}</strong></div>}):<div style={{padding:"16px 0",color:"var(--muted)",fontSize:10}}>El documento no tiene líneas detalladas guardadas.</div>}</div></div></div>

    {tributes.length?<div style={{marginTop:10,padding:"10px 12px",border:"1px solid var(--line)",borderRadius:11,fontSize:10.3}}><b>Tributos / percepciones</b>{tributes.map((row,index)=><div key={index} style={{display:"flex",justifyContent:"space-between",gap:12,marginTop:5}}><span>{row.description||"Tributo"}</span><b>{money(row.amount,currency)}</b></div>)}</div>:null}
    <div className={s.invoiceTotals}>{showTaxBreakdown?<><span>Precio neto <b>{money(doc.subtotal,currency)}</b></span><span>IVA discriminado <b>{money(doc.tax,currency)}</b></span></>:<span>{receiptClass==="C"?"Sin IVA discriminado":"Precio final"}</span>}{tributes.length?<span>Tributos <b>{money(tributes.reduce((sum,row)=>sum+Number(row.amount||0),0),currency)}</b></span>:null}<strong>Total {money(total,currency)}</strong></div>

    {["consumidor_final","exento"].includes(String(billing.iva_condition||""))&&receiptClass==="B"?<div style={{marginTop:10,padding:"10px 12px",border:"1px solid var(--line)",borderRadius:11,fontSize:10.3,lineHeight:1.5}}><b>Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</b><div>IVA Contenido: {money(transparency.iva_contenido||doc.tax||0,currency)}</div><div>Otros Impuestos Nacionales Indirectos: {money(transparency.otros_impuestos_nacionales_indirectos||0,currency)}</div></div>:null}
    {billing.monotributo_a_legend?<div style={{marginTop:10,padding:"9px 11px",border:"1px solid var(--line)",borderRadius:11,fontSize:9.5,lineHeight:1.45,color:"var(--muted)"}}>{billing.monotributo_a_legend}</div>:null}

    {billing.cae?<div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:14,alignItems:"center",marginTop:12,padding:"11px 12px",border:"1px solid color-mix(in srgb,#2d9f62 28%,var(--line))",borderRadius:12,background:"color-mix(in srgb,#2d9f62 6%,var(--panelSolid))"}}><div style={{fontSize:10.5,lineHeight:1.55}}><b style={{display:"block",color:"#26794d"}}>Autorizado por ARCA</b><div>CAE: <strong>{billing.cae}</strong></div><div>Vencimiento CAE: {fmtDate(billing.cae_expiration)}</div><div>Comprobante: {doc.number||"—"}</div></div>{qrSrc?<img src={qrSrc} alt="QR ARCA" style={{width:122,height:122,background:"#fff",padding:4,borderRadius:8}}/>:null}</div>:doc.status==="draft"?<div style={{marginTop:10,padding:"9px 11px",border:"1px solid var(--line)",borderRadius:11,fontSize:9.5,color:"var(--muted)",lineHeight:1.45}}>Este comprobante está en <b style={{color:"var(--text)"}}>borrador</b>. Todavía no tiene número fiscal ni CAE.</div>:null}

    <div className={s.documentActions}>{doc.status==="draft"&&["invoice","credit_note","debit_note"].includes(doc.document_type)?<button type="button" onClick={onIssue} disabled={saving}>{saving?"Procesando…":"Emitir con ARCA"}</button>:null}{billing.cae?<button type="button" onClick={()=>printReservationFinanceDocument(doc,reservation)}>Imprimir / PDF</button>:null}<button type="button" className={s.primary} onClick={onClose}>Cerrar</button></div>
  </div></div>
  return createPortal(preview,portalRoot)
}

function PreviewStat({label,value,strong=false}){return <div style={{padding:"8px 10px",border:"1px solid var(--line)",borderRadius:11,background:"var(--panelSolid)",display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",fontSize:9.5}}><span style={{color:"var(--muted)",fontWeight:800}}>{label}</span>{strong?<strong style={{fontSize:11}}>{value}</strong>:<b>{value}</b>}</div>}
