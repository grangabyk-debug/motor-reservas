"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{convertCurrency,formatCurrency,pricingFromSettings}from"../../core/currency"
import ReservationPaymentChargeSelector from"./ReservationPaymentChargeSelector"
import{allocatePaymentParts,buildChargeLines,paidTotal,roundMoney,selectedBalance,validPayment}from"./paymentChargeUtils"
import s from"./cashActions.module.css"

const RESERVATION_SELECT="id,numero_reserva,nombre_huesped,fecha_entrada,fecha_salida,precio_total,subtotal,moneda,estado,servicios,cochera_total,mascotas_total,early_checkin_importe,late_checkout_importe,extra,extra_descripcion"
const PAYMENT_METHODS=["Efectivo","Transferencia bancaria","Tarjeta de débito","Tarjeta de crédito","Billetera virtual / QR","Cuenta corriente","Voucher / Agencia","Cheque","Otro"]
const CURRENCIES=["ARS","USD"]
const CASH_PREFILL_KEY="hl:pms:cash-prefill"
const normalize=value=>String(value||"").trim().toLowerCase()
const currency=value=>String(value||"ARS").toUpperCase()==="USD"?"USD":"ARS"
const money=(value,code="ARS")=>formatCurrency(value,currency(code),{maximumFractionDigits:2})
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):"—"
const amountNumber=value=>Math.max(0,Number(String(value??"").replace(",","."))||0)
const isCashMethod=method=>normalize(method).includes("efect")||normalize(method)==="cash"
const violetDetailStyle={fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',fontStyle:"normal",fontVariant:"normal",fontFeatureSettings:"normal",fontKerning:"normal",fontWeight:700,letterSpacing:0,textTransform:"none",lineHeight:1.35}

export default function ReservationPaymentPanelMultiCurrency({propertyId,reservationId,session,onClose,onSaved}){
  const[reservation,setReservation]=useState(null),[payments,setPayments]=useState([]),[folioItems,setFolioItems]=useState([]),[itemAllocations,setItemAllocations]=useState([]),[selectedChargeIds,setSelectedChargeIds]=useState(new Set()),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState("")
  const[method,setMethod]=useState("Efectivo"),[paymentCurrency,setPaymentCurrency]=useState("ARS"),[amount,setAmount]=useState(""),[reference,setReference]=useState(""),[note,setNote]=useState("")
  const[paymentParts,setPaymentParts]=useState([]),[cashReceived,setCashReceived]=useState("")
  const[query,setQuery]=useState(""),[results,setResults]=useState([]),[searching,setSearching]=useState(false)
  const[propertySettings,setPropertySettings]=useState({}),[fx,setFx]=useState(null),[fxLoading,setFxLoading]=useState(false)
  const pricing=pricingFromSettings(propertySettings),effectiveFx=pricing.fxMode==="manual"?pricing.manualUsdArs:Number(fx?.rate||0),fxSource=pricing.fxMode==="manual"?"Manual":fx?.source||"BCRA",fxAsOf=pricing.fxMode==="manual"?new Date().toISOString().slice(0,10):fx?.asOf||new Date().toISOString().slice(0,10)
  const reservationCurrency=currency(reservation?.moneda||"ARS")

  const loadFxSettings=useCallback(async()=>{
    if(!propertyId)return
    try{
      const settingsRes=await supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle()
      if(settingsRes.error)throw settingsRes.error
      setPropertySettings(settingsRes.data?.settings||{})
    }catch{}
    setFxLoading(true)
    try{const response=await fetch("/api/hotel/exchange-rate",{cache:"no-store"}),json=await response.json();if(!response.ok)throw new Error(json?.error||"Cotización no disponible");setFx(json)}catch{setFx(null)}finally{setFxLoading(false)}
  },[propertyId])
  useEffect(()=>{loadFxSettings()},[loadFxSettings])

  function toReservation(value,from){const code=currency(from);if(code===reservationCurrency)return roundMoney(value);const converted=convertCurrency(value,code,reservationCurrency,effectiveFx);return converted==null?null:roundMoney(converted)}
  function fromReservation(value,to){const code=currency(to);if(code===reservationCurrency)return roundMoney(value);const converted=convertCurrency(value,reservationCurrency,code,effectiveFx);return converted==null?null:roundMoney(converted)}
  function conversionReady(code){return currency(code)===reservationCurrency||effectiveFx>0}
  function fxRateFor(code){return currency(code)===reservationCurrency?1:effectiveFx}

  const loadReservation=useCallback(async id=>{
    if(!propertyId||!id)return
    setLoading(true);setError("")
    try{
      const ensured=await supabase.rpc("hl_ensure_reservation_folios",{p_reservation_id:Number(id)});if(ensured.error)throw ensured.error
      const[reservationRes,paymentRes,itemRes,allocationRes]=await Promise.all([
        supabase.from("reservas").select(RESERVATION_SELECT).eq("property_id",propertyId).eq("id",Number(id)).single(),
        supabase.from("pagos").select("id,reserva_id,monto,metodo,moneda,payment_currency,payment_amount,fx_rate,fx_source,fx_as_of,estado,refunded_amount,created_at").eq("property_id",propertyId).eq("reserva_id",Number(id)).order("created_at",{ascending:false}),
        supabase.from("hotel_folio_items").select("id,folio_id,source_type,description,detail,service_date,total,currency,status,created_at").eq("property_id",propertyId).eq("reservation_id",Number(id)).eq("status","active").order("created_at",{ascending:true}),
        supabase.from("hotel_folio_item_payment_allocations").select("folio_item_id,payment_id,amount").eq("property_id",propertyId).eq("reservation_id",Number(id)),
      ])
      if(reservationRes.error)throw reservationRes.error;if(paymentRes.error)throw paymentRes.error;if(itemRes.error)throw itemRes.error;if(allocationRes.error)throw allocationRes.error
      const row=reservationRes.data,pays=paymentRes.data||[],items=itemRes.data||[],allocs=allocationRes.data||[]
      const prepared=buildChargeLines(items,allocs,pays,row.precio_total),selectable=new Set(prepared.filter(line=>line.remaining>.009).map(line=>String(line.id)))
      if(Number(row.precio_total)>paidTotal(pays)+.01&&!prepared.length)throw new Error("No se pudieron preparar los cargos de esta reserva para el cobro.")
      const selectedDue=selectedBalance(prepared,selectable),code=currency(row.moneda)
      let requested=selectedDue,prefillReason=""
      if(typeof window!=="undefined")try{const raw=window.sessionStorage.getItem(CASH_PREFILL_KEY);if(raw){const parsed=JSON.parse(raw),createdAt=Number(parsed?.createdAt||0),fresh=createdAt>0&&Date.now()-createdAt<5*60*1000,matches=Number(parsed?.reservationId)===Number(row.id),desired=roundMoney(amountNumber(parsed?.amount));if(matches&&fresh&&desired>0){requested=Math.min(selectedDue,desired);prefillReason=String(parsed?.reason||"")}if(matches||!fresh)window.sessionStorage.removeItem(CASH_PREFILL_KEY)}}catch{try{window.sessionStorage.removeItem(CASH_PREFILL_KEY)}catch{}}
      setReservation(row);setPayments(pays);setFolioItems(items);setItemAllocations(allocs);setSelectedChargeIds(selectable);setPaymentCurrency(code);setAmount(requested?String(requested):"");setReference("");setNote(prefillReason==="no_show_penalty"?"Penalidad por No Show":"");setPaymentParts([]);setCashReceived("")
    }catch(err){setError(err?.message||"No se pudo cargar la reserva para cobrar.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{setReservation(null);setPayments([]);setFolioItems([]);setItemAllocations([]);setSelectedChargeIds(new Set());setQuery("");setResults([]);setError("");setMethod("Efectivo");setPaymentParts([]);setCashReceived("");if(reservationId)loadReservation(reservationId)},[reservationId,loadReservation])
  useEffect(()=>{
    if(reservation||!propertyId)return
    const timer=setTimeout(async()=>{setSearching(true);setError("");try{const term=query.trim().replace(/[,%()]/g," ");let request=supabase.from("reservas").select(RESERVATION_SELECT).eq("property_id",propertyId).neq("estado","cancelada").order("created_at",{ascending:false}).limit(12);if(term.length>=2)request=request.or(`nombre_huesped.ilike.%${term}%,numero_reserva.ilike.%${term}%`);const res=await request;if(res.error)throw res.error;const rows=res.data||[],ids=rows.map(row=>row.id);let pays=[];if(ids.length){const payRes=await supabase.from("pagos").select("reserva_id,monto,estado,refunded_amount").eq("property_id",propertyId).in("reserva_id",ids);if(payRes.error)throw payRes.error;pays=payRes.data||[]}const paidBy=new Map();for(const row of pays){if(!validPayment(row))continue;const id=Number(row.reserva_id);paidBy.set(id,(paidBy.get(id)||0)+Math.max(0,Number(row.monto||0)-Number(row.refunded_amount||0)))}setResults(rows.map(row=>({...row,pending:Math.max(0,Number(row.precio_total||0)-(paidBy.get(Number(row.id))||0))}))}catch(err){setError(err?.message||"No se pudieron buscar reservas.")}finally{setSearching(false)}},250)
    return()=>clearTimeout(timer)
  },[query,reservation,propertyId])

  const paid=useMemo(()=>paidTotal(payments),[payments]),total=Number(reservation?.precio_total||0),pending=Math.max(0,total-paid)
  const lines=useMemo(()=>buildChargeLines(folioItems,itemAllocations,payments,total),[folioItems,itemAllocations,payments,total])
  const selectedPending=useMemo(()=>selectedBalance(lines,selectedChargeIds),[lines,selectedChargeIds]),selectedLines=useMemo(()=>lines.filter(line=>selectedChargeIds.has(String(line.id))),[lines,selectedChargeIds])
  const numericAmount=amountNumber(amount),normalizedSingle=reservation?toReservation(numericAmount,paymentCurrency):0
  const splitActive=paymentParts.length>=2
  const resolvedParts=useMemo(()=>{
    if(!splitActive||!reservation)return[]
    let used=0
    return paymentParts.map((part,index)=>{
      const last=index===paymentParts.length-1,code=currency(part.currency)
      if(last){const normalized=roundMoney(Math.max(0,selectedPending-used)),physical=fromReservation(normalized,code);return{...part,currency:code,amount:physical==null?0:physical,normalized}}
      const normalized=toReservation(amountNumber(part.amount),code);if(normalized!=null)used=roundMoney(used+normalized);return{...part,currency:code,amount:amountNumber(part.amount),normalized:normalized==null?0:normalized}
    })
  },[paymentParts,splitActive,reservationCurrency,selectedPending,effectiveFx])
  const splitTotal=roundMoney(resolvedParts.reduce((sum,part)=>sum+Number(part.normalized||0),0)),splitRemaining=roundMoney(Math.max(0,selectedPending-splitTotal)),splitOver=roundMoney(Math.max(0,splitTotal-selectedPending)),splitUnique=resolvedParts.every((part,index)=>part.method&&resolvedParts.findIndex(other=>other.method===part.method)===index),splitPositive=resolvedParts.every(part=>Number(part.amount)>0&&Number(part.normalized)>0),splitFxReady=resolvedParts.every(part=>conversionReady(part.currency)),splitValid=splitActive&&splitUnique&&splitPositive&&splitFxReady&&selectedPending>0&&Math.abs(splitTotal-selectedPending)<.011
  const cashPart=splitActive?resolvedParts.find(part=>isCashMethod(part.method)):isCashMethod(method)?{currency:paymentCurrency,amount:numericAmount,normalized:normalizedSingle}:null,cashTarget=roundMoney(Number(cashPart?.amount||0)),received=amountNumber(cashReceived),change=roundMoney(Math.max(0,received-cashTarget)),cashShort=roundMoney(Math.max(0,cashTarget-received)),hasCash=cashTarget>0,cashInputValid=!hasCash||!cashReceived||received>=cashTarget
  const selectedPhysical=reservation?fromReservation(selectedPending,paymentCurrency):0,singleFxReady=conversionReady(paymentCurrency),singleValid=Number(normalizedSingle)>0&&Number(normalizedSingle)<=selectedPending+.011&&singleFxReady

  function applySelection(next){const target=selectedBalance(lines,next);setSelectedChargeIds(next);const physical=reservation?fromReservation(target,paymentCurrency):target;setAmount(physical==null?"":String(physical||""));setCashReceived("");setError("")}
  function toggleCharge(id){const next=new Set(selectedChargeIds);next.has(String(id))?next.delete(String(id)):next.add(String(id));applySelection(next)}
  function toggleAllCharges(){const unpaid=lines.filter(line=>line.remaining>.009).map(line=>String(line.id)),all=unpaid.length&&unpaid.every(id=>selectedChargeIds.has(id));applySelection(all?new Set():new Set(unpaid))}
  function changePaymentCurrency(code){const next=currency(code),physical=fromReservation(selectedPending,next);setPaymentCurrency(next);setAmount(physical==null?"":String(physical||""));setCashReceived("");setError("")}
  function startSplit(){if(selectedPending<=0)return;const first=method||"Efectivo",second=PAYMENT_METHODS.find(item=>item!==first)||"Transferencia bancaria",half=roundMoney(selectedPending/2),physical=fromReservation(half,paymentCurrency);setPaymentParts([{method:first,currency:paymentCurrency,amount:physical==null?0:physical},{method:second,currency:reservationCurrency,amount:0}]);setCashReceived("");setError("")}
  function stopSplit(){setMethod(paymentParts[0]?.method||method||"Efectivo");const code=currency(paymentParts[0]?.currency||paymentCurrency);setPaymentCurrency(code);const physical=fromReservation(selectedPending,code);setAmount(physical==null?"":String(physical||""));setPaymentParts([]);setCashReceived("");setError("")}
  function updatePart(index,patch){setPaymentParts(parts=>parts.map((part,i)=>i===index?{...part,...patch}:part));setCashReceived("");setError("")}
  function changePartMethod(index,nextMethod){setPaymentParts(parts=>{const current=parts[index]?.method,duplicate=parts.findIndex((part,i)=>i!==index&&part.method===nextMethod),next=parts.map(part=>({...part}));next[index].method=nextMethod;if(duplicate>=0)next[duplicate].method=current;return next});setCashReceived("")}
  function addPart(){setPaymentParts(parts=>{if(parts.length>=PAYMENT_METHODS.length)return parts;const used=new Set(parts.map(part=>part.method)),methodToAdd=PAYMENT_METHODS.find(item=>!used.has(item));if(!methodToAdd)return parts;return[...parts.slice(0,-1),{method:methodToAdd,currency:reservationCurrency,amount:0},parts[parts.length-1]]})}
  function removePart(index){setPaymentParts(parts=>parts.length<=2?parts:parts.filter((_,i)=>i!==index));setCashReceived("")}

  async function save(){
    if(!reservation||saving)return
    setSaving(true);setError("")
    try{
      if(pending<=0)throw new Error("La reserva ya está totalmente pagada.")
      if(selectedPending<=0)throw new Error("Seleccioná al menos un cargo pendiente para cobrar.")
      let parts
      if(splitActive){if(!splitUnique)throw new Error("Cada parte del pago debe usar un medio diferente.");if(!splitFxReady)throw new Error("No hay cotización disponible para una de las monedas elegidas.");if(!splitPositive)throw new Error("Todos los medios del pago dividido deben tener un importe mayor a cero.");if(!splitValid)throw new Error(`El pago dividido debe completar exactamente ${money(selectedPending,reservationCurrency)}.`);parts=resolvedParts}
      else{if(!singleFxReady)throw new Error("No hay una cotización USD/ARS válida para convertir este cobro.");if(!singleValid)throw new Error(`El pago no puede superar los cargos seleccionados: ${money(selectedPending,reservationCurrency)}.`);parts=[{method,currency:paymentCurrency,amount:numericAmount,normalized:roundMoney(normalizedSingle)}]}
      const allocationsByPart=allocatePaymentParts(lines,selectedChargeIds,parts.map(part=>part.normalized))
      const cash=parts.find(part=>isCashMethod(part.method));if(cash&&!session)throw new Error("Para cobrar en efectivo primero tenés que abrir la caja del turno.");if(cash&&cashReceived&&received<Number(cash.amount))throw new Error(`El efectivo recibido es menor a la parte en efectivo. Faltan ${money(Number(cash.amount)-received,cash.currency)}.`)
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const user=userData?.user;if(!user)throw new Error("No se pudo identificar al usuario que registra el pago.")
      const selectedLabel=`Cargos: ${selectedLines.map(line=>line.name).join(" + ")}`,baseNote=note.trim()||`Cobro desde Caja diaria · ${reservation.numero_reserva||reservation.id}`
      const payloads=parts.map((part,index)=>{const cross=currency(part.currency)!==reservationCurrency,receivedLabel=`${part.method} ${money(part.amount,part.currency)}`,appliedLabel=cross?`aplica ${money(part.normalized,reservationCurrency)} · TC ${Number(effectiveFx).toLocaleString("es-AR",{maximumFractionDigits:4})}`:null,cashLabel=isCashMethod(part.method)&&cashReceived?`Efectivo recibido ${money(received,part.currency)} · Vuelto ${money(Math.max(0,received-Number(part.amount)),part.currency)}`:null;return{user_id:user.id,created_by:user.id,property_id:propertyId,reserva_id:Number(reservation.id),monto:roundMoney(part.normalized),metodo:part.method,moneda:reservationCurrency,payment_currency:currency(part.currency),payment_amount:roundMoney(part.amount),fx_rate:fxRateFor(part.currency),fx_source:cross?fxSource:"Misma moneda",fx_as_of:cross?fxAsOf:null,estado:"confirmado",source:"manual",provider:null,referencia:reference.trim()||null,charge_allocations:allocationsByPart[index],nota:[baseNote,selectedLabel,parts.length>1?`Pago dividido · parte ${index+1}/${parts.length}`:null,receivedLabel,appliedLabel,cashLabel].filter(Boolean).join(" · ")}})
      const{data,error:insertError}=await supabase.from("pagos").insert(payloads).select("id,reserva_id,monto,metodo,moneda,payment_currency,payment_amount,fx_rate,estado,created_at");if(insertError)throw insertError
      const firstPayment=Array.isArray(data)?data[0]:data
      if(typeof window!=="undefined"){window.dispatchEvent(new CustomEvent("hl:pms-payment-updated",{detail:{reservationId:Number(reservation.id),paymentId:firstPayment?.id,paymentIds:(data||[]).map(row=>row.id),folioItemIds:selectedLines.map(line=>line.id)}}));window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:parts.length>1?"Pago dividido registrado":"Pago registrado",message:`${reservation.nombre_huesped} · ${parts.map(part=>`${part.method} ${money(part.amount,part.currency)}`).join(" + ")}.`}}))}
      onSaved?.({payment:firstPayment,payments:data||[],reservation})
    }catch(err){setError(err?.message||"No se pudo registrar el pago.")}
    finally{setSaving(false)}
  }

  const fxCaption=effectiveFx>0?`1 USD = ${money(effectiveFx,"ARS")} · ${fxSource}${fxAsOf?` · ${fxAsOf}`:""}`:fxLoading?"Actualizando cotización…":"Cotización no disponible"
  return <div className={s.overlay} role="dialog" aria-modal="true" aria-label="Cobrar reserva"><section className={`${s.panel} ${s.panelWide}`}>
    <header className={s.panelHeader}><div><small>CAJA DIARIA · COBRO MULTIMONEDA</small><h2>{reservation?`Cobrar a ${reservation.nombre_huesped}`:"Cobrar una reserva"}</h2><p>{reservation?`Reserva ${reservation.numero_reserva||reservation.id} · saldo contable en ${reservationCurrency}.`:"Buscá al huésped o la reserva y el sistema trae automáticamente el saldo pendiente."}</p></div><button type="button" className={s.close} onClick={onClose}>×</button></header>
    <div className={s.body}>{error?<div className={s.alert}>{error}</div>:null}
      {!reservation?<div className={s.searchBox}><input className={s.searchInput} value={query} onChange={event=>setQuery(event.target.value)} autoFocus placeholder="Buscar huésped o número de reserva…"/><div className={s.results}>{searching?<div className={s.empty}>Buscando reservas…</div>:results.length?results.map(row=><button type="button" className={s.result} key={row.id} disabled={row.pending<=0} onClick={()=>loadReservation(row.id)}><span><b>{row.nombre_huesped}</b><small style={violetDetailStyle}>{row.numero_reserva||`Reserva ${row.id}`} · {fmtDate(row.fecha_entrada)} → {fmtDate(row.fecha_salida)}</small></span><strong>{row.pending>0?`Pendiente ${money(row.pending,row.moneda)}`:"Pagada"}</strong></button>):<div className={s.empty}>No hay reservas para mostrar.</div>}</div></div>:loading?<div className={s.empty}>Cargando cuenta…</div>:<>
        <div className={s.account}><div className={s.accountHeader}><div><b>{reservation.nombre_huesped}</b><small style={violetDetailStyle}>Reserva {reservation.numero_reserva||reservation.id} · {fmtDate(reservation.fecha_entrada)} → {fmtDate(reservation.fecha_salida)}</small></div><strong>{money(total,reservationCurrency)}</strong></div><ReservationPaymentChargeSelector lines={lines} selectedIds={selectedChargeIds} onToggle={toggleCharge} onToggleAll={toggleAllCharges} selectedTotal={selectedPending} currency={reservationCurrency}/></div>
        <div className={s.moneyHero}><article><span>Total</span><b>{money(total,reservationCurrency)}</b><small style={violetDetailStyle}>Cuenta completa</small></article><article className={s.paid}><span>Pagado</span><b>{money(paid,reservationCurrency)}</b><small style={violetDetailStyle}>{payments.filter(validPayment).length} pago{payments.filter(validPayment).length===1?"":"s"}</small></article><article className={s.due}><span>Pendiente</span><b>{money(pending,reservationCurrency)}</b><small style={violetDetailStyle}>Saldo de la reserva</small></article></div>
        {pending>0?<><div className={s.hint}><b>Moneda de la reserva: {reservationCurrency}</b> · {fxCaption}. Podés recibir ARS o USD; la reserva conserva siempre su moneda original.</div>
          <div className={s.paymentModeHead}><div><b>{splitActive?"PAGO DIVIDIDO":"MEDIO DE PAGO"}</b>{splitActive?<span>Cada medio puede cobrarse en ARS o USD. El último completa el saldo automáticamente.</span>:null}</div><button type="button" className={s.splitToggle} disabled={selectedPending<=0} onClick={splitActive?stopSplit:startSplit}>{splitActive?"Usar un solo medio":"Dividir pago"}</button></div>
          {!splitActive?<div className={s.formGrid}>
            <label className={s.field}><span>Medio de pago</span><select value={method} onChange={event=>{setMethod(event.target.value);setCashReceived("")}}>{PAYMENT_METHODS.map(item=><option key={item}>{item}</option>)}</select></label>
            <label className={s.field}><span>Moneda recibida</span><select value={paymentCurrency} onChange={event=>changePaymentCurrency(event.target.value)}>{CURRENCIES.map(code=><option key={code}>{code}</option>)}</select></label>
            <label className={s.field}><span>Importe recibido ({paymentCurrency})</span><input type="number" min="0.01" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/><div className={s.quickAmount}><button type="button" disabled={selectedPending<=0||selectedPhysical==null} onClick={()=>setAmount(String(selectedPhysical||""))}>Cobrar selección completa</button></div>{paymentCurrency!==reservationCurrency&&numericAmount>0&&normalizedSingle!=null?<small style={violetDetailStyle}>Se aplican {money(normalizedSingle,reservationCurrency)} a la reserva.</small>:null}</label>
            <label className={s.field}><span>Referencia</span><input value={reference} onChange={event=>setReference(event.target.value)} placeholder="Banco, billetera, cupón, agencia, comprobante…"/></label><label className={s.field}><span>Nota</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder="Opcional"/></label>
          </div>:<div className={s.splitPanel}><div className={s.splitRows}>{resolvedParts.map((part,index)=>{const auto=index===resolvedParts.length-1;return <div className={s.splitRow} key={`${index}-${part.method}`}><span className={s.splitNumber}>{index+1}</span><select value={part.method} onChange={event=>changePartMethod(index,event.target.value)}>{PAYMENT_METHODS.map(item=><option key={item}>{item}</option>)}</select><select value={part.currency} onChange={event=>updatePart(index,{currency:event.target.value})}>{CURRENCIES.map(code=><option key={code}>{code}</option>)}</select>{auto?<div className={s.splitRemainder}><small style={violetDetailStyle}>Resto automático</small><strong>{money(part.amount,part.currency)}</strong>{part.currency!==reservationCurrency?<small style={violetDetailStyle}>Aplica {money(part.normalized,reservationCurrency)}</small>:null}</div>:<input type="number" min="0" step="0.01" value={paymentParts[index]?.amount??""} onChange={event=>updatePart(index,{amount:event.target.value})}/>} {paymentParts.length>2?<button type="button" className={s.splitRemove} onClick={()=>removePart(index)} aria-label={`Quitar medio ${index+1}`}>×</button>:null}</div>})}</div>
            <div className={s.splitTools}>{paymentParts.length<PAYMENT_METHODS.length?<button type="button" onClick={addPart}>+ Agregar otro medio</button>:<span>Ya usaste todos los medios disponibles.</span>}</div>
            <div className={`${s.splitCheck} ${splitValid?s.splitCheckOk:s.splitCheckBad}`}><span>{splitValid?"Selección completa":splitOver>0?`Excede ${money(splitOver,reservationCurrency)}`:`Faltan ${money(splitRemaining,reservationCurrency)}`}</span><b>{resolvedParts.map(part=>`${part.method} ${money(part.amount,part.currency)}`).join(" + ")}</b></div>
            <div className={s.formGrid}><label className={s.field}><span>Referencia</span><input value={reference} onChange={event=>setReference(event.target.value)} placeholder="Banco, billetera, cupón, agencia, comprobante…"/></label><label className={s.field}><span>Nota</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder="Opcional"/></label></div>
          </div>}
          {!splitActive&&normalizedSingle>0&&normalizedSingle<selectedPending?<p className={s.hint}>Pago parcial: se aplican {money(normalizedSingle,reservationCurrency)} y el resto queda pendiente.</p>:null}
          {hasCash?<div className={s.cashReceivedBox}><label><span>Efectivo recibido ({cashPart.currency})</span><input type="number" min="0" step="0.01" value={cashReceived} onChange={event=>setCashReceived(event.target.value)} placeholder={String(cashTarget)}/></label><div className={`${s.changeBox} ${cashReceived&&cashShort>0?s.changeShort:""}`}><span>{cashReceived&&cashShort>0?"Falta":"Vuelto"}</span><strong>{!cashReceived?"—":cashShort>0?money(cashShort,cashPart.currency):money(change,cashPart.currency)}</strong><small style={violetDetailStyle}>Parte en efectivo: {money(cashTarget,cashPart.currency)}</small></div></div>:null}
        </>:<p className={s.hint}>La cuenta está saldada. No hace falta registrar otro pago.</p>}
        {hasCash&&!session&&selectedPending>0?<p className={s.hint}>La caja del turno está cerrada. Podés elegir otro medio de pago o abrir la caja antes de cobrar en efectivo.</p>:null}
        <div className={s.footer}><button type="button" className={s.secondary} onClick={()=>{setReservation(null);setPayments([]);setFolioItems([]);setItemAllocations([]);setSelectedChargeIds(new Set());setAmount("");setPaymentParts([]);setCashReceived("")}}>Cambiar reserva</button><button type="button" className={s.secondary} onClick={onClose}>Cancelar</button><button type="button" className={s.save} disabled={saving||pending<=0||selectedPending<=0||(splitActive?!splitValid:!singleValid)||!cashInputValid} onClick={save}>{saving?"Registrando…":splitActive?"Registrar pago dividido":normalizedSingle<selectedPending?"Registrar pago parcial":"Cobrar selección"}</button></div>
      </>}
    </div>
  </section></div>
}
