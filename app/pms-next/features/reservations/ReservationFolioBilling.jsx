"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./reservationFolioBilling.module.css"
import ReservationInvoiceDialog from"./ReservationInvoiceDialog"
import{printReservationFolio}from"./reservationFolioPrint"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".",""):"—"
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const validPayment=row=>!["anulado","cancelado","void","rechazado","cancelled"].includes(String(row?.estado||"").toLowerCase())
const netPayment=row=>validPayment(row)?Math.max(0,Number(row?.monto||0)-Number(row?.refunded_amount||0)):0
const payerLabels={guest:"Huésped",company:"Empresa",agency:"Agencia",group:"Grupo",other:"Otro"}
const typeLabels={lodging:"Alojamiento",parking:"Cochera",pet:"Mascotas",service:"Servicio",extra:"Extra",discount:"Descuento",adjustment:"Ajuste",fee:"Cargo"}
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[char])

export default function ReservationFolioBilling({reservation,propertyId,property,onNavigate}){
  const[folios,setFolios]=useState([])
  const[items,setItems]=useState([])
  const[allocations,setAllocations]=useState([])
  const[payments,setPayments]=useState([])
  const[documents,setDocuments]=useState([])
  const[selectedId,setSelectedId]=useState("")
  const[selectedItems,setSelectedItems]=useState(new Set())
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState("")
  const[newOpen,setNewOpen]=useState(false)
  const[newDraft,setNewDraft]=useState({label:"",payer_type:"guest",payer_name:""})
  const[invoiceOpen,setInvoiceOpen]=useState(false)
  const[invoiceMode,setInvoiceMode]=useState("folio")
  const[invoicePaymentId,setInvoicePaymentId]=useState("")
  const[billingName,setBillingName]=useState(reservation.nombre_huesped||"")
  const[billingEmail,setBillingEmail]=useState(reservation.email_huesped||"")
  const[billingPhone,setBillingPhone]=useState(reservation.telefono_huesped||"")
  const[billingDueAt,setBillingDueAt]=useState("")
  const[billingCurrency,setBillingCurrency]=useState(reservation.moneda||"ARS")
  const[billingStatus,setBillingStatus]=useState("draft")
  const[billingNotes,setBillingNotes]=useState("")
  const[invoiceLines,setInvoiceLines]=useState([])

  const load=useCallback(async(silent=false)=>{
    if(!propertyId||!reservation?.id)return
    if(!silent)setLoading(true)
    setError("")
    try{
      const ensure=await supabase.rpc("hl_ensure_reservation_folios",{p_reservation_id:Number(reservation.id)})
      if(ensure.error)throw ensure.error
      const[folioRes,itemRes,allocationRes,paymentRes,docRes]=await Promise.all([
        supabase.from("hotel_folios").select("id,room_id,folio_type,label,payer_type,payer_name,currency,status,is_primary,sort_order,created_at").eq("property_id",propertyId).eq("reservation_id",Number(reservation.id)).neq("status","void").order("sort_order").order("created_at"),
        supabase.from("hotel_folio_items").select("id,folio_id,room_id,source_type,source_key,description,detail,service_date,quantity,unit_price,discount,tax_rate,tax,subtotal,total,currency,status,invoice_document_id,created_at").eq("property_id",propertyId).eq("reservation_id",Number(reservation.id)).order("service_date").order("created_at"),
        supabase.from("hotel_folio_payment_allocations").select("id,folio_id,payment_id,amount,currency,source,created_at").eq("property_id",propertyId).eq("reservation_id",Number(reservation.id)),
        supabase.from("pagos").select("id,folio_id,monto,refunded_amount,moneda,metodo,estado,referencia,nota,created_at").eq("property_id",propertyId).eq("reserva_id",Number(reservation.id)).order("created_at",{ascending:false}),
        supabase.from("hotel_finance_documents").select("id,folio_id,payment_id,document_type,number,status,currency,total,balance,billing_to,items,folio_item_ids,billing_mode,issued_at,created_at").eq("property_id",propertyId).eq("reservation_id",Number(reservation.id)).order("created_at",{ascending:false}),
      ])
      for(const result of[folioRes,itemRes,allocationRes,paymentRes,docRes])if(result.error)throw result.error
      const nextFolios=folioRes.data||[]
      setFolios(nextFolios)
      setItems(itemRes.data||[])
      setAllocations(allocationRes.data||[])
      setPayments(paymentRes.data||[])
      setDocuments(docRes.data||[])
      setSelectedId(current=>nextFolios.some(row=>row.id===current)?current:(nextFolios.find(row=>row.folio_type==="room")||nextFolios.find(row=>row.is_primary)||nextFolios[0])?.id||"")
    }catch(err){setError(err?.message||"No se pudieron cargar los folios.")}
    finally{if(!silent)setLoading(false)}
  },[propertyId,reservation?.id])

  useEffect(()=>{load()},[load])
  useEffect(()=>{
    setBillingName(reservation.nombre_huesped||"")
    setBillingEmail(reservation.email_huesped||"")
    setBillingPhone(reservation.telefono_huesped||"")
    setBillingCurrency(reservation.moneda||"ARS")
    setSelectedItems(new Set())
  },[reservation.id,reservation.nombre_huesped,reservation.email_huesped,reservation.telefono_huesped,reservation.moneda])
  useEffect(()=>{
    if(typeof window==="undefined")return
    let timer=null
    const refresh=event=>{
      const detail=event?.detail||{}
      if(detail.propertyId&&String(detail.propertyId)!==String(propertyId))return
      const tables=detail.tables||[]
      const relevant=["hotel_folios","hotel_folio_items","hotel_folio_payment_allocations","pagos","hotel_finance_documents","reservas","resume","reconnected"]
      if(tables.length&&!tables.some(table=>relevant.includes(table)))return
      if(timer)clearTimeout(timer)
      timer=setTimeout(()=>load(true),100)
    }
    window.addEventListener("hl:pms-data-updated",refresh)
    return()=>{if(timer)clearTimeout(timer);window.removeEventListener("hl:pms-data-updated",refresh)}
  },[propertyId,load])

  const selected=folios.find(row=>row.id===selectedId)||folios[0]||null
  const activeItems=useMemo(()=>items.filter(row=>row.status==="active"),[items])
  const allocationByPayment=useMemo(()=>{
    const map=new Map()
    for(const row of allocations)map.set(Number(row.payment_id),(map.get(Number(row.payment_id))||0)+Number(row.amount||0))
    return map
  },[allocations])
  const statsByFolio=useMemo(()=>{
    const map=new Map(folios.map(folio=>[folio.id,{charges:0,paid:0,invoiced:0}]))
    for(const item of activeItems){const stat=map.get(item.folio_id);if(stat){stat.charges+=Number(item.total||0);if(item.invoice_document_id)stat.invoiced+=Number(item.total||0)}}
    for(const row of allocations){const stat=map.get(row.folio_id);if(stat)stat.paid+=Number(row.amount||0)}
    return map
  },[folios,activeItems,allocations])
  const selectedStats=selected?statsByFolio.get(selected.id)||{charges:0,paid:0,invoiced:0}:{charges:0,paid:0,invoiced:0}
  const folioItems=selected?activeItems.filter(row=>row.folio_id===selected.id):[]
  const folioAllocations=selected?allocations.filter(row=>row.folio_id===selected.id):[]
  const folioPaymentIds=new Set(folioAllocations.map(row=>Number(row.payment_id)))
  const folioPayments=payments.filter(row=>folioPaymentIds.has(Number(row.id)))
  const folioDocs=selected?documents.filter(row=>row.folio_id===selected.id):[]
  const draftReservedIds=useMemo(()=>new Set(documents.filter(doc=>doc.status==="draft").flatMap(doc=>Array.isArray(doc.folio_item_ids)?doc.folio_item_ids:[])),[documents])
  const invoiceableItems=folioItems.filter(row=>!row.invoice_document_id&&!draftReservedIds.has(row.id))
  const checkedInvoiceItems=invoiceableItems.filter(row=>selectedItems.has(row.id))
  const unallocatedPayments=payments.map(row=>({...row,remaining:Math.max(0,netPayment(row)-(allocationByPayment.get(Number(row.id))||0))})).filter(row=>row.remaining>.009)
  const balance=selectedStats.charges-selectedStats.paid
  const invoiceCalc=useMemo(()=>{
    let subtotal=0,tax=0
    for(const line of invoiceLines){
      const quantity=Math.max(0,Number(line.quantity||0))
      const unitPrice=Number(line.unit_price||0)
      const rate=Math.max(0,Number(line.tax_rate||0))
      const base=quantity*unitPrice
      subtotal+=base
      tax+=base*rate/100
    }
    return{subtotal,tax,total:subtotal+tax}
  },[invoiceLines])

  function toggleItem(id){setSelectedItems(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next})}

  function linesFromFolio(){
    const source=checkedInvoiceItems.length?checkedInvoiceItems:invoiceableItems
    return source.map(row=>{
      const quantity=Math.max(.0001,Number(row.quantity||1))
      const taxRate=Math.max(0,Number(row.tax_rate||0))
      const storedSubtotal=Number(row.subtotal)
      let unitPrice=Number(row.unit_price||0)
      if(Number.isFinite(storedSubtotal)&&storedSubtotal!==0)unitPrice=storedSubtotal/quantity
      else if(!unitPrice&&Number(row.total||0)!==0)unitPrice=Number(row.total||0)/(1+taxRate/100)/quantity
      return{folio_item_id:row.id,description:row.description||typeLabels[row.source_type]||"Cargo",detail:row.detail||null,source_type:row.source_type,quantity,unit_price:unitPrice,tax_rate:taxRate}
    })
  }

  function openInvoice(mode="folio"){
    if(!selected)return
    setInvoiceMode(mode)
    setInvoicePaymentId("")
    setBillingName(selected.payer_name||reservation.nombre_huesped||"")
    setBillingEmail(reservation.email_huesped||"")
    setBillingPhone(reservation.telefono_huesped||"")
    setBillingDueAt("")
    setBillingCurrency(selected.currency||reservation.moneda||"ARS")
    setBillingStatus("draft")
    setBillingNotes("")
    setInvoiceLines(mode==="folio"?linesFromFolio():[])
    setInvoiceOpen(true)
  }

  function changeInvoiceMode(mode){
    setInvoiceMode(mode)
    setInvoicePaymentId("")
    setInvoiceLines(mode==="folio"?linesFromFolio():[])
  }

  function chooseInvoicePayment(value){
    setInvoicePaymentId(value)
    const paymentId=Number(value)||null
    if(!paymentId){setInvoiceLines([]);return}
    const allocation=folioAllocations.find(row=>Number(row.payment_id)===paymentId)
    const payment=payments.find(row=>Number(row.id)===paymentId)
    if(!allocation||!payment){setInvoiceLines([]);return}
    const amount=Number(allocation.amount||0)
    setInvoiceLines([{folio_item_id:null,description:`Pago registrado · ${payment.metodo||"Pago"}`,detail:null,source_type:"payment",quantity:1,unit_price:amount,tax_rate:0}])
    setBillingCurrency(payment.moneda||selected?.currency||reservation.moneda||"ARS")
  }

  function updateInvoiceLine(index,key,value){
    setInvoiceLines(current=>current.map((line,i)=>i===index?{...line,[key]:value}:line))
  }

  async function moveItem(item,target){
    if(!target||target===item.folio_id)return
    setSaving(true);setError("")
    try{const res=await supabase.rpc("hl_move_folio_item",{p_item_id:item.id,p_target_folio_id:target});if(res.error)throw res.error;setSelectedItems(current=>{const next=new Set(current);next.delete(item.id);return next});await load(true)}
    catch(err){setError(err?.message||"No se pudo mover el consumo.")}
    finally{setSaving(false)}
  }

  async function consolidate(){
    if(!selected||selected.folio_type!=="master")return
    if(!window.confirm("¿Mover al Folio maestro todos los consumos todavía no facturados de las habitaciones?"))return
    setSaving(true);setError("")
    try{const res=await supabase.rpc("hl_consolidate_folio",{p_target_folio_id:selected.id});if(res.error)throw res.error;await load(true)}
    catch(err){setError(err?.message||"No se pudieron consolidar los consumos.")}
    finally{setSaving(false)}
  }

  async function createFolio(){
    if(!newDraft.label.trim()||saving)return
    setSaving(true);setError("")
    try{
      const res=await supabase.rpc("hl_create_reservation_folio",{p_reservation_id:Number(reservation.id),p_label:newDraft.label.trim(),p_payer_type:newDraft.payer_type,p_payer_name:newDraft.payer_name.trim()||null})
      if(res.error)throw res.error
      setNewOpen(false);setNewDraft({label:"",payer_type:"guest",payer_name:""});await load(true)
      if(res.data?.id)setSelectedId(res.data.id)
    }catch(err){setError(err?.message||"No se pudo crear el folio.")}
    finally{setSaving(false)}
  }

  async function allocate(payment){
    if(!selected||payment.remaining<=0)return
    const due=Math.max(0,balance),amount=due>0?Math.min(payment.remaining,due):payment.remaining
    if(amount<=0)return
    setSaving(true);setError("")
    try{const res=await supabase.rpc("hl_allocate_payment_to_folio",{p_payment_id:Number(payment.id),p_folio_id:selected.id,p_amount:amount});if(res.error)throw res.error;await load(true)}
    catch(err){setError(err?.message||"No se pudo asignar el pago al folio.")}
    finally{setSaving(false)}
  }

  async function prepareInvoice(){
    if(!selected||saving)return
    setSaving(true);setError("")
    try{
      if(!billingName.trim())throw new Error("Ingresá el nombre o razón social del cliente.")
      if(!invoiceLines.length||invoiceCalc.total<=0)throw new Error("Agregá al menos un concepto con importe.")
      if(invoiceLines.some(line=>!String(line.description||"").trim()))throw new Error("Completá la descripción de todos los conceptos.")
      let itemIds=[],paymentId=null,billingMode="folio"
      if(invoiceMode==="payment"){
        paymentId=Number(invoicePaymentId)||null
        const allocation=folioAllocations.find(row=>Number(row.payment_id)===paymentId)
        const payment=payments.find(row=>Number(row.id)===paymentId)
        if(!allocation||!payment)throw new Error("Elegí un pago asignado a este folio.")
        billingMode="payment"
      }else{
        const source=checkedInvoiceItems.length?checkedInvoiceItems:invoiceableItems
        itemIds=source.map(row=>row.id)
        billingMode=checkedInvoiceItems.length?"partial_items":"folio"
      }
      const userRes=await supabase.auth.getUser();if(userRes.error)throw userRes.error
      const payloadItems=invoiceLines.map(line=>{
        const quantity=Math.max(0,Number(line.quantity||0))
        const unitPrice=Number(line.unit_price||0)
        const taxRate=Math.max(0,Number(line.tax_rate||0))
        const subtotal=quantity*unitPrice
        const tax=subtotal*taxRate/100
        return{folio_item_id:line.folio_item_id||null,description:String(line.description||"").trim(),detail:line.detail||null,quantity,unit_price:unitPrice,tax_rate:taxRate,tax,subtotal,total:subtotal+tax}
      })
      const payload={
        property_id:propertyId,
        reservation_id:Number(reservation.id),
        folio_id:selected.id,
        payment_id:paymentId,
        document_type:"invoice",
        number:null,
        status:billingStatus,
        currency:billingCurrency||selected.currency||reservation.moneda||"ARS",
        subtotal:invoiceCalc.subtotal,
        tax:invoiceCalc.tax,
        total:invoiceCalc.total,
        balance:invoiceCalc.total,
        billing_to:{name:billingName.trim(),email:billingEmail.trim()||null,phone:billingPhone.trim()||null,payer_type:selected.payer_type,folio_label:selected.label},
        items:payloadItems,
        folio_item_ids:itemIds,
        billing_mode:billingMode,
        issued_at:billingStatus==="issued"?new Date().toISOString():null,
        due_at:billingDueAt||null,
        external_ref:null,
        notes:billingNotes.trim()||`Preparada desde ${selected.label}`,
        created_by:userRes.data?.user?.id||null
      }
      const res=await supabase.from("hotel_finance_documents").insert(payload).select("id").single()
      if(res.error)throw res.error
      if(billingStatus==="issued"&&itemIds.length&&res.data?.id){
        const mark=await supabase.from("hotel_folio_items").update({invoice_document_id:res.data.id}).eq("property_id",propertyId).eq("reservation_id",Number(reservation.id)).in("id",itemIds)
        if(mark.error)throw mark.error
      }
      setInvoiceOpen(false);setSelectedItems(new Set());setInvoicePaymentId("");setInvoiceLines([]);await load(true)
      window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:["hotel_finance_documents","hotel_folio_items"]}}))
    }catch(err){setError(err?.message||"No se pudo crear el documento.")}
    finally{setSaving(false)}
  }

  function printFolio(){printReservationFolio({selected,folioItems,folioPayments,folioAllocations,selectedStats,balance,reservation,property,setError})}

  if(loading)return <section className={s.card}><div className={s.empty}>Armando folios de la reserva…</div></section>

  return <section className={s.card}>
    <header className={s.header}>
      <div><small>CUENTA DE LA ESTADÍA</small><h3>Folios y facturas</h3></div>
      <div className={s.headerActions}>
        <button type="button" onClick={()=>setNewOpen(true)}>＋ Folio</button>
        <button type="button" onClick={printFolio} disabled={!selected}>Imprimir</button>
        <button type="button" className={s.primary} onClick={()=>openInvoice("folio")} disabled={!selected}>＋ Factura</button>
      </div>
    </header>
    {error?<div className={s.error}>{error}</div>:null}

    <nav className={s.folioTabs}>
      {folios.map(folio=>{
        const stats=statsByFolio.get(folio.id)||{charges:0,paid:0}
        return <button type="button" key={folio.id} className={folio.id===selected?.id?s.active:""} onClick={()=>{setSelectedId(folio.id);setSelectedItems(new Set())}}>
          <span>{folio.folio_type==="master"?"◇":"▣"} {folio.label}</span>
          <small>{payerLabels[folio.payer_type]||folio.payer_type} · saldo {money(stats.charges-stats.paid,folio.currency)}</small>
        </button>
      })}
    </nav>

    {selected?<>
      <div className={s.summary}>
        <div data-tone="lilac"><span>Cargos</span><b>{money(selectedStats.charges,selected.currency)}</b></div>
        <div data-tone="green"><span>Pagos asignados</span><b>{money(selectedStats.paid,selected.currency)}</b></div>
        <div data-tone="yellow"><span>Facturado</span><b>{money(selectedStats.invoiced,selected.currency)}</b></div>
        <div data-tone={balance>.01?"rose":"green"}><span>Saldo</span><b>{money(balance,selected.currency)}</b></div>
      </div>

      <div className={s.folioMeta}>
        <span><b>{selected.label}</b> · {payerLabels[selected.payer_type]||selected.payer_type}{selected.payer_name?` · ${selected.payer_name}`:""}</span>
        <div>
          {selected.folio_type==="master"&&folios.length>2?<button type="button" onClick={consolidate} disabled={saving}>Consolidar grupo</button>:null}
          <small>{selectedItems.size?`${selectedItems.size} consumo${selectedItems.size===1?"":"s"} seleccionado${selectedItems.size===1?"":"s"} para facturar parcialmente`:"Seleccioná consumos si querés facturar sólo una parte."}</small>
        </div>
      </div>

      <div className={s.itemList}>
        {folioItems.length?folioItems.map(row=>{
          const invoiceable=!row.invoice_document_id&&!draftReservedIds.has(row.id)
          return <div className={s.itemRow} key={row.id}>
            <label className={s.check}><input type="checkbox" checked={selectedItems.has(row.id)} disabled={!invoiceable} onChange={()=>toggleItem(row.id)}/></label>
            <div className={s.itemMain}><b>{row.description}</b><small>{fmtDate(row.service_date)} · {typeLabels[row.source_type]||row.source_type}{row.detail?` · ${row.detail}`:""}</small></div>
            <strong>{money(row.total,row.currency)}</strong>
            <span className={`${s.itemStatus} ${row.invoice_document_id?s.invoiced:draftReservedIds.has(row.id)?s.draft:""}`}>{row.invoice_document_id?"Facturado":draftReservedIds.has(row.id)?"En borrador":"Pendiente"}</span>
            {invoiceable&&folios.length>1?<select value={row.folio_id} disabled={saving} onChange={event=>moveItem(row,event.target.value)} aria-label="Mover consumo a otro folio">{folios.map(folio=><option key={folio.id} value={folio.id}>{folio.label}</option>)}</select>:<span/>}
          </div>
        }):<div className={s.empty}>Este folio todavía no tiene consumos. Podés mover cargos desde otra habitación o usarlo como folio de empresa/grupo.</div>}
      </div>

      {unallocatedPayments.length?<div className={s.unallocated}>
        <header><div><b>Pagos sin asignar</b><small>En reservas con varias habitaciones decidís a qué folio pertenece cada pago.</small></div></header>
        {unallocatedPayments.map(payment=><div key={payment.id}><span><b>{payment.metodo||"Pago"}</b><small>{fmtDateTime(payment.created_at)} · disponible {money(payment.remaining,payment.moneda)}</small></span><button type="button" onClick={()=>allocate(payment)} disabled={saving}>Asignar a {selected.label}</button></div>)}
      </div>:null}

      <div className={s.docs}>
        <header><b>Facturas vinculadas</b><button type="button" onClick={()=>openInvoice("folio")}>Abrir facturación</button></header>
        {folioDocs.length?folioDocs.slice(0,4).map(doc=><div key={doc.id}><span><b>{doc.number||"Borrador sin numerar"}</b><small>{doc.billing_mode==="payment"?"Sobre pago":doc.billing_mode==="partial_items"?"Parcial":"Sobre folio"} · {fmtDateTime(doc.issued_at||doc.created_at)}</small></span><strong>{money(doc.total,doc.currency)}</strong><em data-status={doc.status}>{doc.status==="draft"?"Borrador":doc.status==="issued"?"Emitida":doc.status}</em></div>):<div className={s.emptySmall}>Todavía no hay facturas para este folio.</div>}
      </div>
    </>:<div className={s.empty}>No hay folios disponibles.</div>}

    {newOpen?<div className={s.overlay} onMouseDown={event=>event.target===event.currentTarget&&setNewOpen(false)}><div className={s.modal}>
      <button className={s.close} onClick={()=>setNewOpen(false)}>×</button><small>NUEVO FOLIO</small><h2>Separar una cuenta</h2><p>Usalo para empresa, agencia, pasajero o una parte específica del grupo.</p>
      <label>Nombre del folio<input value={newDraft.label} onChange={event=>setNewDraft(v=>({...v,label:event.target.value}))} placeholder="Ej. Empresa ACME / Habitación 203 extras" autoFocus/></label>
      <label>Quién paga<select value={newDraft.payer_type} onChange={event=>setNewDraft(v=>({...v,payer_type:event.target.value}))}><option value="guest">Huésped</option><option value="company">Empresa</option><option value="agency">Agencia</option><option value="group">Grupo</option><option value="other">Otro</option></select></label>
      <label>Nombre / razón social<input value={newDraft.payer_name} onChange={event=>setNewDraft(v=>({...v,payer_name:event.target.value}))} placeholder="Opcional"/></label>
      <footer><button onClick={()=>setNewOpen(false)}>Cancelar</button><button className={s.primary} onClick={createFolio} disabled={saving||!newDraft.label.trim()}>{saving?"Creando…":"Crear folio"}</button></footer>
    </div></div>:null}

    <ReservationInvoiceDialog
      open={invoiceOpen}
      selected={selected}
      reservation={reservation}
      invoiceMode={invoiceMode}
      changeInvoiceMode={changeInvoiceMode}
      checkedInvoiceItems={checkedInvoiceItems}
      invoiceableItems={invoiceableItems}
      invoicePaymentId={invoicePaymentId}
      chooseInvoicePayment={chooseInvoicePayment}
      folioPayments={folioPayments}
      folioAllocations={folioAllocations}
      billingName={billingName}
      setBillingName={setBillingName}
      billingEmail={billingEmail}
      setBillingEmail={setBillingEmail}
      billingPhone={billingPhone}
      setBillingPhone={setBillingPhone}
      billingDueAt={billingDueAt}
      setBillingDueAt={setBillingDueAt}
      billingCurrency={billingCurrency}
      setBillingCurrency={setBillingCurrency}
      billingStatus={billingStatus}
      setBillingStatus={setBillingStatus}
      invoiceLines={invoiceLines}
      setInvoiceLines={setInvoiceLines}
      updateInvoiceLine={updateInvoiceLine}
      billingNotes={billingNotes}
      setBillingNotes={setBillingNotes}
      invoiceCalc={invoiceCalc}
      saving={saving}
      prepareInvoice={prepareInvoice}
      onClose={()=>setInvoiceOpen(false)}
    />
  </section>
}