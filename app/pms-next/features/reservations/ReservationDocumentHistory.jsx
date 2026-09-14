"use client"

import{useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./reservationFolioBilling.module.css"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const DOC_LABELS={invoice:"Factura",credit_note:"Nota de crédito",debit_note:"Nota de débito",receipt:"Recibo",proforma:"Proforma",folio:"Folio"}
const TAX_LABELS={consumidor_final:"Consumidor final",responsable_inscripto:"Responsable inscripto",monotributo:"Monotributo",exento:"Exento",cliente_exterior:"Cliente del exterior",no_categorizado:"No categorizado"}
const docLabel=doc=>DOC_LABELS[doc?.document_type]||"Documento"
const docNumber=doc=>doc?.number||"Sin numerar"
const nextType=doc=>doc?.document_type==="invoice"?"credit_note":doc?.document_type==="credit_note"?"debit_note":null
const nextLabel=type=>type==="credit_note"?"Nota de crédito":"Nota de débito"

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
  const[saving,setSaving]=useState(false)
  const folioDocs=useMemo(()=>selected?documents.filter(row=>row.folio_id===selected.id):[],[documents,selected?.id])
  const relatedById=useMemo(()=>new Map(documents.map(row=>[row.id,row])),[documents])

  function usedAmount(doc,type){return documents.filter(row=>row.related_document_id===doc.id&&row.document_type===type&&row.status!=="void").reduce((sum,row)=>sum+Math.max(0,Number(row.total)||0),0)}
  function remainingFor(doc,type){return Math.max(0,(Number(doc.total)||0)-usedAmount(doc,type))}
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
      setAdjustment(null);await onRefresh?.(true)
      if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:["hotel_finance_documents"]}}))
    }catch(err){setError?.(err?.message||"No se pudo crear la nota.")}
    finally{setSaving(false)}
  }

  const visible=showAll?folioDocs:folioDocs.slice(0,4)
  const actionButton={height:28,padding:"0 8px",border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:9.5,fontWeight:850,cursor:"pointer",whiteSpace:"nowrap"}
  const tag={display:"inline-flex",alignItems:"center",height:20,padding:"0 6px",borderRadius:999,border:"1px solid var(--line)",fontSize:8.5,fontWeight:900,letterSpacing:".02em",whiteSpace:"nowrap"}

  return <>
    <div className={s.docs}>
      <header><b>Facturas y notas vinculadas</b>{folioDocs.length>4?<button type="button" onClick={()=>setShowAll(value=>!value)}>{showAll?"Ver menos":`Ver todas (${folioDocs.length})`}</button>:null}</header>
      {folioDocs.length?visible.map(doc=>{
        const type=nextType(doc),remaining=type?remainingFor(doc,type):0,original=doc.related_document_id?relatedById.get(doc.related_document_id):null
        return <div key={doc.id} style={{gap:8}}>
          <span style={{minWidth:0}}><span style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><b>{docNumber(doc)}</b><em style={tag}>{docLabel(doc)}</em></span><small>{doc.billing_mode==="payment"?"Sobre pago":doc.billing_mode==="partial_items"?"Parcial":doc.billing_mode==="adjustment_partial"?"Ajuste parcial":doc.billing_mode==="adjustment_total"?"Ajuste total":"Sobre folio"} · {fmtDateTime(doc.issued_at||doc.created_at)}{original?` · Vinculada a ${docLabel(original)} ${docNumber(original)}`:""}</small></span>
          <strong>{money(doc.total,doc.currency)}</strong>
          <em data-status={doc.status}>{doc.status==="draft"?"Borrador":doc.status==="issued"?"Emitida":doc.status}</em>
          {type&&doc.status!=="draft"&&doc.status!=="void"&&remaining>.009?<button type="button" style={actionButton} onClick={()=>openAdjustment(doc)}>{type==="credit_note"?"＋ Nota de crédito":"＋ Nota de débito"}</button>:<span/>}
        </div>
      }):<div className={s.emptySmall}>Todavía no hay facturas ni notas para este folio.</div>}
    </div>

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
