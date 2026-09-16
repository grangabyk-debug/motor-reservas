"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./reservationFolioBilling.module.css"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const DOC_LABELS={invoice:"Factura",credit_note:"Nota de crédito",debit_note:"Nota de débito",receipt:"Recibo",proforma:"Proforma",folio:"Folio"}
const TAX_LABELS={consumidor_final:"Consumidor final",responsable_inscripto:"Responsable inscripto",monotributo:"Monotributo",exento:"Exento",cliente_exterior:"Cliente del exterior",no_categorizado:"No categorizado"}
const STATUS_LABELS={draft:"Borrador",issued:"Emitida",void:"Anulada",cancelled:"Cancelada",paid:"Pagada",partial:"Pago parcial"}
const INVALID_PAYMENT_STATES=new Set(["anulado","cancelado","void","rechazado","cancelled","reembolsado","refunded"])
const docLabel=doc=>DOC_LABELS[doc?.document_type]||"Documento"
const docNumber=doc=>doc?.number||"Sin numerar"
const nextType=doc=>doc?.document_type==="invoice"?"credit_note":doc?.document_type==="credit_note"?"debit_note":null
const nextLabel=type=>type==="credit_note"?"Nota de crédito":"Nota de débito"
const rowTotal=row=>{const quantity=Math.max(0,Number(row?.quantity)||0),unit=Math.max(0,Number(row?.unit_price)||0),rate=Math.max(0,Number(row?.tax_rate)||0);return Number.isFinite(Number(row?.total))?Number(row.total):quantity*unit*(1+rate/100)}
const netPayment=row=>INVALID_PAYMENT_STATES.has(String(row?.estado||"").toLowerCase())?0:Math.max(0,Number(row?.monto||0)-Number(row?.refunded_amount||0))
function missingPaymentBridge(error){const text=String(error?.message||"").toLowerCase();return error?.code==="42P01"||error?.code==="PGRST205"||text.includes("hotel_finance_document_payment_allocations")&&(text.includes("does not exist")||text.includes("schema cache")||text.includes("not find"))}

function invoiceAmounts(doc,documents,paymentAllocations=[],bridgeReady=false){
  const original=Math.max(0,Number(doc?.total)||0)
  if(doc?.document_type!=="invoice")return{original,effective:original,adjustment:0,applied:Math.max(0,original-Math.max(0,Number(doc?.balance)||0)),balance:Math.max(0,Number(doc?.balance)||0)}
  const credits=documents.filter(row=>row.related_document_id===doc.id&&row.document_type==="credit_note"&&!(["draft","void"].includes(row.status)))
  const creditIds=new Set(credits.map(row=>row.id))
  const credit=credits.reduce((sum,row)=>sum+Math.max(0,Number(row.total)||0),0)
  const debit=documents.filter(row=>creditIds.has(row.related_document_id)&&row.document_type==="debit_note"&&!(["draft","void"].includes(row.status))).reduce((sum,row)=>sum+Math.max(0,Number(row.total)||0),0)
  const effective=Math.max(0,original-credit+debit)
  const explicitApplied=paymentAllocations.filter(row=>row.document_id===doc.id).reduce((sum,row)=>sum+Math.max(0,Number(row.amount)||0),0)
  const legacyApplied=Math.max(0,effective-Math.min(effective,Math.max(0,Number(doc?.balance)||0)))
  const applied=bridgeReady?explicitApplied:legacyApplied
  return{original,effective,adjustment:effective-original,applied,balance:Math.max(0,effective-applied)}
}

function sourceLines(doc,remaining){
  const rows=Array.isArray(doc?.items)?doc.items:[]
  const original=Math.max(0,Number(doc?.total)||0)
  const factor=original>0?Math.min(1,Math.max(0,remaining/original)):1
  if(rows.length)return rows.map((row,index)=>({key:`${index}-${row.description||"concepto"}`,description:row.description||"Concepto",detail:row.detail||null,quantity:Math.max(.0001,Number(row.quantity)||1),unit_price:(Number(row.unit_price)||0)*factor,tax_rate:Math.max(0,Number(row.tax_rate)||0)}))
  const tax=Math.max(0,Number(doc?.tax)||0),subtotal=Math.max(0,Number(doc?.subtotal)||Math.max(0,original-tax)),rate=subtotal>0?tax/subtotal*100:0
  return[{key:"document-total",description:docLabel(doc),detail:null,quantity:1,unit_price:remaining/(1+rate/100),tax_rate:rate}]
}

export default function ReservationDocumentHistory({documents,selected,reservation,propertyId,onRefresh,setError}){
  const[showAll,setShowAll]=useState(false)
  const[adjustment,setAdjustment]=useState(null)
  const[preview,setPreview]=useState(null)
  const[saving,setSaving]=useState(false)
  const[paymentBridgeReady,setPaymentBridgeReady]=useState(false)
  const[documentPaymentAllocations,setDocumentPaymentAllocations]=useState([])
  const[folioPaymentAllocations,setFolioPaymentAllocations]=useState([])
  const[bridgePayments,setBridgePayments]=useState([])
  const[paymentTarget,setPaymentTarget]=useState(null)
  const folioDocs=useMemo(()=>selected?documents.filter(row=>row.folio_id===selected.id):[],[documents,selected?.id])
  const relatedById=useMemo(()=>new Map(documents.map(row=>[row.id,row])),[documents])

  const loadPaymentBridge=useCallback(async()=>{
    if(!propertyId||!reservation?.id||!selected?.id){setPaymentBridgeReady(false);return}
    try{
      const bridge=await supabase.from("hotel_finance_document_payment_allocations").select("id,folio_id,document_id,payment_id,amount,currency,created_at,updated_at").eq("property_id",propertyId).eq("reservation_id",Number(reservation.id))
      if(bridge.error){if(missingPaymentBridge(bridge.error)){setPaymentBridgeReady(false);setDocumentPaymentAllocations([]);return}throw bridge.error}
      const[folioRes,payRes]=await Promise.all([
        supabase.from("hotel_folio_payment_allocations").select("id,folio_id,payment_id,amount,currency").eq("property_id",propertyId).eq("reservation_id",Number(reservation.id)),
        supabase.from("pagos").select("id,folio_id,monto,refunded_amount,moneda,metodo,estado,referencia,created_at").eq("property_id",propertyId).eq("reserva_id",Number(reservation.id)).order("created_at",{ascending:false}),
      ])
      if(folioRes.error)throw folioRes.error;if(payRes.error)throw payRes.error
      setDocumentPaymentAllocations(bridge.data||[]);setFolioPaymentAllocations(folioRes.data||[]);setBridgePayments(payRes.data||[]);setPaymentBridgeReady(true)
    }catch(err){setPaymentBridgeReady(false);setDocumentPaymentAllocations([]);if(!missingPaymentBridge(err))setError?.(err?.message||"No se pudo cargar la conciliación de facturas.")}
  },[propertyId,reservation?.id,selected?.id,setError])
  useEffect(()=>{loadPaymentBridge()},[loadPaymentBridge])

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

  async function saveAdjustment(){
    if(!adjustment||saving)return
    const totals=calc(adjustment.lines)
    if(!adjustment.reason.trim())return setError?.("Indicá el motivo de la nota.")
    if(!adjustment.lines.length||totals.total<=0)return setError?.("La nota necesita al menos un concepto con importe.")
    if(adjustment.lines.some(line=>!String(line.description||"").trim()))return setError?.("Completá la descripción de todos los conceptos.")
    if(totals.total>adjustment.remaining+.01)return setError?.(`${nextLabel(adjustment.type)} supera el importe disponible de ${money(adjustment.remaining,adjustment.original.currency)}.`)
    setSaving(true);setError?.("")
    try{
      const userRes=await supabase.auth.getUser();if(userRes.error)throw userRes.error
      const payloadItems=adjustment.lines.map(line=>{const quantity=Math.max(0,Number(line.quantity)||0),unitPrice=Math.max(0,Number(line.unit_price)||0),taxRate=Math.max(0,Number(line.tax_rate)||0),subtotal=quantity*unitPrice,tax=subtotal*taxRate/100;return{description:String(line.description||"").trim(),detail:line.detail||null,quantity,unit_price:unitPrice,tax_rate:taxRate,subtotal,tax,total:subtotal+tax}})
      const original=adjustment.original
      const payload={property_id:propertyId,reservation_id:Number(reservation.id),folio_id:selected.id,payment_id:null,document_type:adjustment.type,number:null,status:adjustment.status,currency:original.currency||reservation.moneda||"ARS",subtotal:totals.subtotal,tax:totals.tax,total:totals.total,balance:totals.total,billing_to:original.billing_to||{},items:payloadItems,folio_item_ids:[],billing_mode:adjustment.mode==="total"?"adjustment_total":"adjustment_partial",issued_at:adjustment.status==="issued"?new Date().toISOString():null,due_at:null,external_ref:null,notes:`${nextLabel(adjustment.type)} vinculada a ${docLabel(original)} ${docNumber(original)}`,created_by:userRes.data?.user?.id||null,related_document_id:original.id,adjustment_reason:adjustment.reason.trim()}
      const res=await supabase.from("hotel_finance_documents").insert(payload).select("id").single();if(res.error)throw res.error
      setAdjustment(null);await onRefresh?.(true);await loadPaymentBridge()
      if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:["hotel_finance_documents"]}}))
    }catch(err){setError?.(err?.message||"No se pudo crear la nota.")}
    finally{setSaving(false)}
  }

  const paymentCandidates=useMemo(()=>{
    if(!paymentTarget||!paymentBridgeReady||!selected)return[]
    const amounts=invoiceAmounts(paymentTarget,documents,documentPaymentAllocations,true)
    return bridgePayments.map(payment=>{
      if(String(payment.moneda||"").toUpperCase()!==String(paymentTarget.currency||"").toUpperCase())return null
      const net=netPayment(payment);if(net<=.009)return null
      const folioAllowed=folioPaymentAllocations.filter(row=>Number(row.payment_id)===Number(payment.id)&&row.folio_id===paymentTarget.folio_id).reduce((sum,row)=>sum+Number(row.amount||0),0)
      if(folioAllowed<=.009)return null
      const usedInFolio=documentPaymentAllocations.filter(row=>Number(row.payment_id)===Number(payment.id)&&row.folio_id===paymentTarget.folio_id).reduce((sum,row)=>sum+Number(row.amount||0),0)
      const current=documentPaymentAllocations.find(row=>Number(row.payment_id)===Number(payment.id)&&row.document_id===paymentTarget.id)
      const currentAmount=Number(current?.amount||0)
      const maxForDocument=Math.max(0,Math.min(net,folioAllowed)-Math.max(0,usedInFolio-currentAmount))
      const additional=Math.max(0,maxForDocument-currentAmount)
      if(additional<=.009&&currentAmount<=.009)return null
      return{payment,currentAmount,additional,suggested:currentAmount+Math.min(amounts.balance,additional)}
    }).filter(Boolean)
  },[paymentTarget,paymentBridgeReady,selected,documents,documentPaymentAllocations,bridgePayments,folioPaymentAllocations])

  async function allocatePayment(candidate,clear=false){
    if(!paymentTarget||saving)return
    setSaving(true);setError?.("")
    try{
      const amount=clear?0:candidate.suggested
      const res=await supabase.rpc("hl_allocate_payment_to_finance_document",{p_payment_id:Number(candidate.payment.id),p_document_id:paymentTarget.id,p_amount:amount})
      if(res.error)throw res.error
      setPaymentTarget(null);await onRefresh?.(true);await loadPaymentBridge()
      if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:["hotel_finance_documents","hotel_finance_document_payment_allocations"]}}))
    }catch(err){setError?.(err?.message||"No se pudo imputar el cobro a la factura.")}
    finally{setSaving(false)}
  }

  const visible=showAll?folioDocs:folioDocs.slice(0,4)
  const actionButton={height:28,padding:"0 8px",border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:9.5,fontWeight:850,cursor:"pointer",whiteSpace:"nowrap"}
  const tag={display:"inline-flex",alignItems:"center",height:20,padding:"0 6px",borderRadius:999,border:"1px solid var(--line)",fontSize:8.5,fontWeight:900,letterSpacing:".02em",whiteSpace:"nowrap"}

  return <>
    <div className={s.docs}>
      <header><b>Facturas y notas vinculadas</b>{folioDocs.length>4?<button type="button" onClick={()=>setShowAll(value=>!value)}>{showAll?"Ver menos":`Ver todas (${folioDocs.length})`}</button>:null}</header>
      {folioDocs.length?visible.map(doc=>{
        const type=nextType(doc),remaining=type?remainingFor(doc,type):0,original=doc.related_document_id?relatedById.get(doc.related_document_id):null,amounts=invoiceAmounts(doc,documents,documentPaymentAllocations,paymentBridgeReady)
        const canAllocate=paymentBridgeReady&&doc.document_type==="invoice"&&!(["draft","void"].includes(doc.status))&&amounts.balance>.009
        return <div key={doc.id} role="button" tabIndex={0} aria-label={`Ver ${docLabel(doc)} ${docNumber(doc)}`} onClick={()=>openPreview(doc)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openPreview(doc)}}} style={{gap:8,cursor:"pointer"}}>
          <span style={{minWidth:0}}><span style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><b>{docNumber(doc)}</b><em style={tag}>{docLabel(doc)}</em></span><small>{doc.billing_mode==="payment"?"Sobre pago":doc.billing_mode==="partial_items"?"Parcial":doc.billing_mode==="adjustment_partial"?"Ajuste parcial":doc.billing_mode==="adjustment_total"?"Ajuste total":"Sobre folio"} · {fmtDateTime(doc.issued_at||doc.created_at)}{original?` · Vinculada a ${docLabel(original)} ${docNumber(original)}`:""}{doc.document_type==="invoice"&&!(["draft","void"].includes(doc.status))?` · saldo ${money(amounts.balance,doc.currency)}`:""}</small></span>
          <strong>{money(doc.total,doc.currency)}</strong>
          <em data-status={doc.status}>{STATUS_LABELS[doc.status]||doc.status}</em>
          <span style={{display:"flex",justifyContent:"flex-end",gap:5,flexWrap:"wrap"}}>{canAllocate?<button type="button" style={actionButton} onClick={event=>{event.stopPropagation();setError?.("");setPaymentTarget(doc)}}>Imputar cobro</button>:null}{type&&doc.status!=="draft"&&doc.status!=="void"&&remaining>.009?<button type="button" style={actionButton} onClick={event=>{event.stopPropagation();openAdjustment(doc)}}>{type==="credit_note"?"＋ Nota de crédito":"＋ Nota de débito"}</button>:null}</span>
        </div>
      }):<div className={s.emptySmall}>Todavía no hay facturas ni notas para este folio.</div>}
    </div>

    {preview?<DocumentPreview doc={preview} reservation={reservation} documents={documents} paymentAllocations={documentPaymentAllocations} bridgeReady={paymentBridgeReady} onClose={()=>setPreview(null)}/>:null}

    {paymentTarget?<div className={s.overlay} onMouseDown={event=>event.target===event.currentTarget&&!saving&&setPaymentTarget(null)}><div className={s.modal} style={{width:"min(560px,94vw)"}}>
      <button className={s.close} onClick={()=>!saving&&setPaymentTarget(null)}>×</button><small>IMPUTAR COBRO</small><h2>{docNumber(paymentTarget)}</h2><p style={{margin:"-7px 0 14px",fontSize:10.5,color:"var(--muted)"}}>Saldo pendiente: <b style={{color:"var(--text)"}}>{money(invoiceAmounts(paymentTarget,documents,documentPaymentAllocations,true).balance,paymentTarget.currency)}</b>. Sólo aparecen cobros ya asignados a este folio.</p>
      {!paymentCandidates.length?<div className={s.emptySmall}>No hay cobros disponibles para imputar. Si ya existe un pago, asignalo primero a este folio.</div>:<div style={{display:"grid",gap:8}}>{paymentCandidates.map(candidate=><div key={candidate.payment.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"center",padding:"11px 12px",border:"1px solid var(--line)",borderRadius:12,background:"var(--panelSolid)"}}><span><b style={{display:"block",fontSize:11}}>{candidate.payment.metodo||"Pago"} · {money(netPayment(candidate.payment),candidate.payment.moneda)}</b><small style={{display:"block",marginTop:3,color:"var(--muted)",fontSize:9.5}}>{fmtDateTime(candidate.payment.created_at)}{candidate.currentAmount>.009?` · ya imputado ${money(candidate.currentAmount,candidate.payment.moneda)}`:""}{candidate.additional>.009?` · disponible ${money(candidate.additional,candidate.payment.moneda)}`:""}</small></span><span style={{display:"flex",gap:5}}>{candidate.additional>.009?<button type="button" className={s.primary} style={{minHeight:34,padding:"0 10px"}} disabled={saving} onClick={()=>allocatePayment(candidate,false)}>Imputar {money(candidate.suggested-candidate.currentAmount,candidate.payment.moneda)}</button>:null}{candidate.currentAmount>.009?<button type="button" style={actionButton} disabled={saving} onClick={()=>allocatePayment(candidate,true)}>Quitar</button>:null}</span></div>)}</div>}
    </div></div>:null}

    {adjustment?<div className={s.overlay} onMouseDown={event=>event.target===event.currentTarget&&!saving&&setAdjustment(null)}><div className={`${s.modal} ${s.invoiceModal}`}>
      <button className={s.close} onClick={()=>!saving&&setAdjustment(null)}>×</button>
      <small>{adjustment.type==="credit_note"?"NOTA DE CRÉDITO":"NOTA DE DÉBITO"}</small>
      <h2>Emitir {nextLabel(adjustment.type).toLowerCase()}</h2>
      <div style={{padding:"10px 12px",border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--bg) 45%,var(--panelSolid))",margin:"10px 0 12px",fontSize:10.5,lineHeight:1.5}}><b>{docLabel(adjustment.original)} {docNumber(adjustment.original)}</b><div>Cliente: {adjustment.original.billing_to?.name||reservation.nombre_huesped||"—"} · {TAX_LABELS[adjustment.original.billing_to?.iva_condition]||adjustment.original.billing_to?.iva_condition||"Condición IVA no informada"}</div><div>Disponible para ajustar: <b>{money(adjustment.remaining,adjustment.original.currency)}</b></div></div>
      <div className={s.scopeButtons} style={{marginBottom:12}}><button type="button" className={adjustment.mode==="total"?s.scopeActive:""} onClick={()=>setMode("total")}>Total disponible</button><button type="button" className={adjustment.mode==="partial"?s.scopeActive:""} onClick={()=>setMode("partial")}>Parcial</button></div>
      <div className={s.formGrid}><label className={s.full}><span>Motivo</span><input value={adjustment.reason} onChange={event=>setAdjustment(current=>({...current,reason:event.target.value}))} placeholder={adjustment.type==="credit_note"?"Ej. anulación, devolución, corrección de importe…":"Ej. revertir total o parcialmente la Nota de Crédito…"}/></label><label><span>Moneda</span><input value={adjustment.original.currency||"ARS"} readOnly/></label><label><span>Estado inicial</span><select value={adjustment.status} onChange={event=>setAdjustment(current=>({...current,status:event.target.value}))}><option value="draft">Borrador</option><option value="issued">Emitido</option></select></label></div>
      <div className={s.invoiceLines}><header><h3>Conceptos</h3>{adjustment.mode==="partial"?<button type="button" onClick={addLine}>＋ Agregar línea</button>:null}</header><div style={{overflowX:"auto",paddingBottom:2}}><div style={{minWidth:770}}><div style={{display:"grid",gridTemplateColumns:"minmax(210px,2fr) 80px 115px 90px 115px 40px",gap:7,alignItems:"end",padding:"8px 0 2px",fontSize:9.5,fontWeight:850,color:"var(--muted)"}}><span>Descripción</span><span>Unidades</span><span>Precio</span><span>IVA %</span><span>Total</span><span/></div>{adjustment.lines.map((line,index)=>{const row=calc([line]);return <div key={line.key||index} style={{display:"grid",gridTemplateColumns:"minmax(210px,2fr) 80px 115px 90px 115px 40px",gap:7,alignItems:"center",marginTop:7}}><input value={line.description} readOnly={adjustment.mode==="total"} onChange={event=>updateLine(index,"description",event.target.value)}/><input type="number" min="0" step="0.01" value={line.quantity} readOnly={adjustment.mode==="total"} onChange={event=>updateLine(index,"quantity",event.target.value)}/><input type="number" min="0" step="0.01" value={line.unit_price} readOnly={adjustment.mode==="total"} onChange={event=>updateLine(index,"unit_price",event.target.value)}/><input type="number" min="0" step="0.01" value={line.tax_rate} readOnly={adjustment.mode==="total"} onChange={event=>updateLine(index,"tax_rate",event.target.value)}/><div style={{height:42,display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"0 8px",border:"1px solid var(--line)",borderRadius:10,fontSize:10,fontWeight:900}}>{money(row.total,adjustment.original.currency)}</div>{adjustment.mode==="partial"?<button type="button" style={{height:42,padding:0}} onClick={()=>removeLine(index)}>×</button>:<span/>}</div>})}</div></div></div>
      {(()=>{const totals=calc(adjustment.lines);return <div className={s.invoiceTotals}><span>Subtotal <b>{money(totals.subtotal,adjustment.original.currency)}</b></span><span>IVA / impuestos <b>{money(totals.tax,adjustment.original.currency)}</b></span><strong>Total {money(totals.total,adjustment.original.currency)}</strong></div>})()}
      <div className={s.documentActions}><button type="button" onClick={()=>setAdjustment(null)} disabled={saving}>Cancelar</button><button className={s.primary} type="button" onClick={saveAdjustment} disabled={saving}>{saving?"Guardando…":adjustment.type==="credit_note"?"Crear nota de crédito":"Crear nota de débito"}</button></div>
    </div></div>:null}
  </>
}

function DocumentPreview({doc,reservation,documents,paymentAllocations,bridgeReady,onClose}){
  const rows=Array.isArray(doc?.items)?doc.items:[]
  const currency=doc?.currency||reservation?.moneda||"ARS"
  const amounts=invoiceAmounts(doc,documents,paymentAllocations,bridgeReady)
  const billing=doc?.billing_to||{}
  const title=doc?.status==="draft"?`Borrador de ${docLabel(doc).toLowerCase()}`:`${docLabel(doc)} ${docNumber(doc)}`
  return <div className={s.overlay} onMouseDown={event=>event.target===event.currentTarget&&onClose?.()}><div className={`${s.modal} ${s.invoiceModal}`} role="dialog" aria-modal="true" aria-label={title}>
    <button className={s.close} type="button" onClick={onClose}>×</button>
    <small>{docLabel(doc).toUpperCase()} · {STATUS_LABELS[doc.status]||doc.status||"Documento"}</small>
    <h2>{title}</h2>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) minmax(180px,.8fr)",gap:10,margin:"10px 0 12px"}}>
      <div style={{padding:"11px 12px",border:"1px solid var(--line)",borderRadius:12,background:"color-mix(in srgb,var(--bg) 42%,var(--panelSolid))",fontSize:10.5,lineHeight:1.55}}><b>{billing.name||reservation?.nombre_huesped||"Cliente sin identificar"}</b><div>{TAX_LABELS[billing.iva_condition]||billing.iva_condition||"Condición IVA no informada"}</div>{billing.folio_label?<div>Folio: {billing.folio_label}</div>:null}{billing.email?<div>{billing.email}</div>:null}<div style={{marginTop:4,color:"var(--muted)"}}>{doc.number?`Comprobante ${doc.number}`:"Todavía sin número fiscal"} · {fmtDateTime(doc.issued_at||doc.created_at)}</div></div>
      <div style={{display:"grid",gap:7}}><PreviewStat label={doc.document_type==="invoice"?"Total original":"Total"} value={money(amounts.original,currency)}/>{doc.document_type==="invoice"&&Math.abs(amounts.adjustment)>.009?<PreviewStat label="Ajustes netos" value={`${amounts.adjustment>0?"+":""}${money(amounts.adjustment,currency)}`}/>:null}{doc.document_type==="invoice"?<PreviewStat label="Cobros imputados" value={money(amounts.applied,currency)}/>:null}<PreviewStat label="Saldo" value={money(amounts.balance,currency)} strong/></div>
    </div>
    <div className={s.invoiceLines}><header><h3>Conceptos</h3><span style={{fontSize:9.5,color:"var(--muted)",fontWeight:800}}>{rows.length} línea{rows.length===1?"":"s"}</span></header><div style={{overflowX:"auto",paddingBottom:2}}><div style={{minWidth:690}}><div style={{display:"grid",gridTemplateColumns:"minmax(240px,2fr) 72px 118px 76px 120px",gap:8,padding:"7px 0 3px",fontSize:9,fontWeight:850,color:"var(--muted)"}}><span>Descripción</span><span>Cant.</span><span>Precio</span><span>IVA</span><span style={{textAlign:"right"}}>Total</span></div>{rows.length?rows.map((row,index)=><div key={`${index}-${row.folio_item_id||row.description||"line"}`} style={{display:"grid",gridTemplateColumns:"minmax(240px,2fr) 72px 118px 76px 120px",gap:8,alignItems:"center",padding:"9px 0",borderTop:"1px solid var(--line)",fontSize:10}}><span><b>{row.description||"Concepto"}</b>{row.detail?<small style={{display:"block",marginTop:2,color:"var(--muted)"}}>{row.detail}</small>:null}</span><span>{Number(row.quantity)||1}</span><span>{money(row.unit_price,currency)}</span><span>{Number(row.tax_rate)||0}%</span><strong style={{textAlign:"right"}}>{money(rowTotal(row),currency)}</strong></div>):<div style={{padding:"16px 0",color:"var(--muted)",fontSize:10}}>El documento no tiene líneas detalladas guardadas.</div>}</div></div></div>
    <div className={s.invoiceTotals}><span>Subtotal <b>{money(doc.subtotal,currency)}</b></span><span>IVA / impuestos <b>{money(doc.tax,currency)}</b></span><strong>Total {money(amounts.original,currency)}</strong></div>
    {doc.status==="draft"?<div style={{marginTop:10,padding:"9px 11px",border:"1px solid var(--line)",borderRadius:11,fontSize:9.5,color:"var(--muted)",lineHeight:1.45}}>Este comprobante está en <b style={{color:"var(--text)"}}>borrador</b>. Podés revisarlo, pero todavía no tiene numeración fiscal ni se considera emitido.</div>:null}
    <div className={s.documentActions}><button type="button" className={s.primary} onClick={onClose}>Cerrar</button></div>
  </div></div>
}

function PreviewStat({label,value,strong=false}){return <div style={{padding:"8px 10px",border:"1px solid var(--line)",borderRadius:11,background:"var(--panelSolid)",display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",fontSize:9.5}}><span style={{color:"var(--muted)",fontWeight:800}}>{label}</span>{strong?<strong style={{fontSize:11}}>{value}</strong>:<b>{value}</b>}</div>}
