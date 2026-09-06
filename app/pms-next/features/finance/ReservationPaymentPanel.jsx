"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./cashActions.module.css"

const RESERVATION_SELECT="id,numero_reserva,nombre_huesped,fecha_entrada,fecha_salida,precio_total,subtotal,moneda,estado,servicios,cochera_total,mascotas_total,early_checkin_importe,late_checkout_importe,extra,extra_descripcion"
const PAYMENT_METHODS=["Efectivo","Transferencia bancaria","Tarjeta de débito","Tarjeta de crédito","Billetera virtual / QR","Cuenta corriente","Voucher / Agencia","Cheque","Otro"]
const normalize=value=>String(value||"").trim().toLowerCase()
const validPayment=row=>!["anulado","cancelado","void","rechazado"].includes(normalize(row?.estado))
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):"—"
const amountNumber=value=>Math.max(0,Number(String(value??"").replace(",","."))||0)
const roundMoney=value=>Math.round((Number(value)||0)*100)/100
const isCashMethod=method=>normalize(method).includes("efect")||normalize(method)==="cash"
const violetDetailStyle={fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',fontStyle:"normal",fontVariant:"normal",fontFeatureSettings:"normal",fontKerning:"normal",fontWeight:700,letterSpacing:0,textTransform:"none",lineHeight:1.35}

function paidTotal(rows){return(rows||[]).filter(validPayment).reduce((sum,row)=>sum+Math.max(0,Number(row.monto||0)-Number(row.refunded_amount||0)),0)}
function serviceLines(reservation){
  if(!reservation)return[]
  const total=Number(reservation.precio_total||0),services=Array.isArray(reservation.servicios)?reservation.servicios:[],serviceTotal=services.reduce((sum,row)=>sum+Number(row?.total||row?.precio_total||row?.precio||0),0)
  let base=Number(reservation.subtotal||0);if(!base)base=Math.max(0,total-serviceTotal)
  const lines=[{key:"stay",name:"Alojamiento",detail:`${fmtDate(reservation.fecha_entrada)} → ${fmtDate(reservation.fecha_salida)}`,amount:base}]
  services.forEach((row,index)=>lines.push({key:`service-${row?.id||index}`,name:row?.nombre||row?.name||"Extra",detail:row?.detalle||row?.detail||"Servicio adicional",amount:Number(row?.total||row?.precio_total||row?.precio||0)}))
  const hasCategory=category=>services.some(row=>normalize(row?.categoria)===category)
  if(Number(reservation.cochera_total)>0&&!hasCategory("parking"))lines.push({key:"parking",name:"Cochera",detail:"Adicional",amount:Number(reservation.cochera_total)})
  if(Number(reservation.mascotas_total)>0&&!hasCategory("pet"))lines.push({key:"pets",name:"Mascotas",detail:"Adicional",amount:Number(reservation.mascotas_total)})
  if(Number(reservation.early_checkin_importe)>0)lines.push({key:"early",name:"Early check-in",detail:"Adicional",amount:Number(reservation.early_checkin_importe)})
  if(Number(reservation.late_checkout_importe)>0)lines.push({key:"late",name:"Late check-out",detail:"Adicional",amount:Number(reservation.late_checkout_importe)})
  if(Number(reservation.extra)>0)lines.push({key:"extra",name:reservation.extra_descripcion||"Extra",detail:"Adicional",amount:Number(reservation.extra)})
  return lines
}

function rebalanceParts(parts,target){
  if(!parts.length)return[]
  if(parts.length===1)return[{...parts[0],amount:roundMoney(target)}]
  const next=parts.map(part=>({...part,amount:roundMoney(amountNumber(part.amount))}))
  const fixed=next.slice(0,-1).reduce((sum,part)=>sum+part.amount,0)
  next[next.length-1].amount=roundMoney(Math.max(0,target-fixed))
  return next
}

export default function ReservationPaymentPanel({propertyId,reservationId,session,onClose,onSaved}){
  const[reservation,setReservation]=useState(null),[payments,setPayments]=useState([]),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState("")
  const[method,setMethod]=useState("Efectivo"),[amount,setAmount]=useState(""),[reference,setReference]=useState(""),[note,setNote]=useState("")
  const[paymentParts,setPaymentParts]=useState([]),[cashReceived,setCashReceived]=useState("")
  const[query,setQuery]=useState(""),[results,setResults]=useState([]),[searching,setSearching]=useState(false)

  const loadReservation=useCallback(async id=>{
    if(!propertyId||!id)return
    setLoading(true);setError("")
    try{
      const[reservationRes,paymentRes]=await Promise.all([
        supabase.from("reservas").select(RESERVATION_SELECT).eq("property_id",propertyId).eq("id",Number(id)).single(),
        supabase.from("pagos").select("id,reserva_id,monto,metodo,moneda,estado,refunded_amount,created_at").eq("property_id",propertyId).eq("reserva_id",Number(id)).order("created_at",{ascending:false}),
      ])
      if(reservationRes.error)throw reservationRes.error;if(paymentRes.error)throw paymentRes.error
      const row=reservationRes.data,pays=paymentRes.data||[],pending=Math.max(0,Number(row.precio_total||0)-paidTotal(pays))
      setReservation(row);setPayments(pays);setAmount(pending?String(pending):"");setReference("");setNote("");setPaymentParts([]);setCashReceived("")
    }catch(err){setError(err?.message||"No se pudo cargar la reserva para cobrar.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{setReservation(null);setPayments([]);setQuery("");setResults([]);setError("");setMethod("Efectivo");setPaymentParts([]);setCashReceived("");if(reservationId)loadReservation(reservationId)},[reservationId,loadReservation])
  useEffect(()=>{
    if(reservation||!propertyId)return
    const timer=setTimeout(async()=>{
      setSearching(true);setError("")
      try{
        const term=query.trim().replace(/[,%()]/g," ")
        let request=supabase.from("reservas").select(RESERVATION_SELECT).eq("property_id",propertyId).neq("estado","cancelada").order("created_at",{ascending:false}).limit(12)
        if(term.length>=2)request=request.or(`nombre_huesped.ilike.%${term}%,numero_reserva.ilike.%${term}%`)
        const res=await request;if(res.error)throw res.error
        const rows=res.data||[],ids=rows.map(row=>row.id)
        let pays=[]
        if(ids.length){const payRes=await supabase.from("pagos").select("reserva_id,monto,estado,refunded_amount").eq("property_id",propertyId).in("reserva_id",ids);if(payRes.error)throw payRes.error;pays=payRes.data||[]}
        const paidBy=new Map();for(const row of pays){if(!validPayment(row))continue;const id=Number(row.reserva_id);paidBy.set(id,(paidBy.get(id)||0)+Math.max(0,Number(row.monto||0)-Number(row.refunded_amount||0)))}
        setResults(rows.map(row=>({...row,pending:Math.max(0,Number(row.precio_total||0)-(paidBy.get(Number(row.id))||0))})))
      }catch(err){setError(err?.message||"No se pudieron buscar reservas.")}
      finally{setSearching(false)}
    },250)
    return()=>clearTimeout(timer)
  },[query,reservation,propertyId])

  const paid=useMemo(()=>paidTotal(payments),[payments]),total=Number(reservation?.precio_total||0),pending=Math.max(0,total-paid),lines=useMemo(()=>serviceLines(reservation),[reservation]),numericAmount=amountNumber(amount)
  const splitActive=paymentParts.length>=2
  const splitTotal=roundMoney(paymentParts.reduce((sum,part)=>sum+amountNumber(part.amount),0))
  const splitRemaining=roundMoney(Math.max(0,pending-splitTotal))
  const splitOver=roundMoney(Math.max(0,splitTotal-pending))
  const splitUnique=paymentParts.every((part,index)=>part.method&&paymentParts.findIndex(other=>other.method===part.method)===index)
  const splitPositive=paymentParts.every(part=>amountNumber(part.amount)>0)
  const splitValid=splitActive&&splitUnique&&splitPositive&&Math.abs(splitTotal-pending)<.01
  const cashTarget=roundMoney(splitActive?paymentParts.reduce((sum,part)=>isCashMethod(part.method)?sum+amountNumber(part.amount):sum,0):isCashMethod(method)?numericAmount:0)
  const received=amountNumber(cashReceived),change=roundMoney(Math.max(0,received-cashTarget)),cashShort=roundMoney(Math.max(0,cashTarget-received))
  const hasCash=cashTarget>0
  const cashInputValid=!hasCash||!cashReceived||received>=cashTarget

  function startSplit(){
    if(pending<=0)return
    const first=method||"Efectivo",second=PAYMENT_METHODS.find(item=>item!==first)||"Transferencia bancaria"
    setPaymentParts([{method:first,amount:0},{method:second,amount:roundMoney(pending)}]);setCashReceived("");setError("")
  }
  function stopSplit(){setMethod(paymentParts[0]?.method||method||"Efectivo");setAmount(String(pending));setPaymentParts([]);setCashReceived("");setError("")}
  function changePartMethod(index,nextMethod){
    setPaymentParts(parts=>{
      const currentMethod=parts[index]?.method
      const duplicateIndex=parts.findIndex((part,i)=>i!==index&&part.method===nextMethod)
      const next=parts.map(part=>({...part}))
      next[index].method=nextMethod
      if(duplicateIndex>=0)next[duplicateIndex].method=currentMethod
      return rebalanceParts(next,pending)
    });setCashReceived("")
  }
  function changePartAmount(index,value){
    setPaymentParts(parts=>{
      if(index===parts.length-1)return parts
      const max=Math.max(0,pending-parts.reduce((sum,part,i)=>i!==index&&i!==parts.length-1?sum+amountNumber(part.amount):sum,0))
      const requested=Math.min(max,amountNumber(value))
      const next=parts.map((part,i)=>i===index?{...part,amount:roundMoney(requested)}:part)
      return rebalanceParts(next,pending)
    })
  }
  function addPart(){
    setPaymentParts(parts=>{
      if(parts.length>=PAYMENT_METHODS.length)return parts
      const used=new Set(parts.map(part=>part.method)),methodToAdd=PAYMENT_METHODS.find(item=>!used.has(item));if(!methodToAdd)return parts
      const next=[...parts.slice(0,-1),{method:methodToAdd,amount:0},parts[parts.length-1]]
      return rebalanceParts(next,pending)
    })
  }
  function removePart(index){
    setPaymentParts(parts=>{if(parts.length<=2)return parts;return rebalanceParts(parts.filter((_,i)=>i!==index),pending)});setCashReceived("")
  }

  async function save(){
    if(!reservation||saving)return
    setSaving(true);setError("")
    try{
      if(pending<=0)throw new Error("La reserva ya está totalmente pagada.")
      let parts
      if(splitActive){
        if(!splitUnique)throw new Error("Cada parte del pago debe usar un medio diferente.")
        if(!splitPositive)throw new Error("Todos los medios del pago dividido deben tener un importe mayor a cero.")
        if(!splitValid)throw new Error(`El pago dividido debe completar exactamente el saldo pendiente de ${money(pending,reservation.moneda)}.`)
        parts=paymentParts.map(part=>({method:part.method,amount:amountNumber(part.amount)}))
      }else{
        if(!Number.isFinite(numericAmount)||numericAmount<=0)throw new Error("Ingresá un importe válido.")
        if(numericAmount>pending+.01)throw new Error(`El pago no puede superar el saldo pendiente de ${money(pending,reservation.moneda)}.`)
        parts=[{method,amount:numericAmount}]
      }
      const cashDue=parts.reduce((sum,part)=>isCashMethod(part.method)?sum+part.amount:sum,0)
      if(cashDue>0&&!session)throw new Error("Para cobrar en efectivo primero tenés que abrir la caja del turno.")
      if(cashDue>0&&cashReceived&&received<cashDue)throw new Error(`El efectivo recibido es menor a la parte en efectivo. Faltan ${money(cashDue-received,reservation.moneda)}.`)
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const user=userData?.user;if(!user)throw new Error("No se pudo identificar al usuario que registra el pago.")
      const splitLabel=parts.length>1?`Pago dividido ${parts.map(part=>`${part.method} ${money(part.amount,reservation.moneda)}`).join(" + ")}`:null
      const cashLabel=cashDue>0&&cashReceived?`Efectivo recibido ${money(received,reservation.moneda)} · Vuelto ${money(Math.max(0,received-cashDue),reservation.moneda)}`:null
      const baseNote=note.trim()||`Cobro desde Caja diaria · ${reservation.numero_reserva||reservation.id}`
      const payloads=parts.map((part,index)=>({
        user_id:user.id,created_by:user.id,property_id:propertyId,reserva_id:Number(reservation.id),monto:part.amount,metodo:part.method,moneda:reservation.moneda||"ARS",estado:"confirmado",source:"manual",provider:null,referencia:reference.trim()||null,
        nota:[baseNote,splitLabel&&`${splitLabel} · parte ${index+1}/${parts.length}`,isCashMethod(part.method)&&cashLabel].filter(Boolean).join(" · ")
      }))
      const{data,error:insertError}=await supabase.from("pagos").insert(payloads).select("id,reserva_id,monto,metodo,moneda,estado,created_at")
      if(insertError)throw insertError
      const firstPayment=Array.isArray(data)?data[0]:data
      if(typeof window!=="undefined"){
        window.dispatchEvent(new CustomEvent("hl:pms-payment-updated",{detail:{reservationId:Number(reservation.id),paymentId:firstPayment?.id,paymentIds:(data||[]).map(row=>row.id)}}))
        window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:parts.length>1?"Pago dividido registrado":"Pago registrado",message:`${reservation.nombre_huesped} · ${parts.map(part=>`${part.method} ${money(part.amount,reservation.moneda)}`).join(" + ")}.`}}))
      }
      onSaved?.({payment:firstPayment,payments:data||[],reservation})
    }catch(err){setError(err?.message||"No se pudo registrar el pago.")}
    finally{setSaving(false)}
  }

  return <div className={s.overlay} role="dialog" aria-modal="true" aria-label="Cobrar reserva">
    <section className={`${s.panel} ${s.panelWide}`}>
      <header className={s.panelHeader}><div><small>CAJA DIARIA · COBRO</small><h2>{reservation?`Cobrar a ${reservation.nombre_huesped}`:"Cobrar una reserva"}</h2><p>{reservation?`Reserva ${reservation.numero_reserva||reservation.id} · los importes ya incluyen alojamiento y extras.`:"Buscá al huésped o la reserva y el sistema trae automáticamente el saldo pendiente."}</p></div><button type="button" className={s.close} onClick={onClose}>×</button></header>
      <div className={s.body}>
        {error?<div className={s.alert}>{error}</div>:null}
        {!reservation?<div className={s.searchBox}><input className={s.searchInput} value={query} onChange={event=>setQuery(event.target.value)} autoFocus placeholder="Buscar huésped o número de reserva…"/><div className={s.results}>{searching?<div className={s.empty}>Buscando reservas…</div>:results.length?results.map(row=><button type="button" className={s.result} key={row.id} disabled={row.pending<=0} onClick={()=>loadReservation(row.id)}><span><b>{row.nombre_huesped}</b><small style={violetDetailStyle}>{row.numero_reserva||`Reserva ${row.id}`} · {fmtDate(row.fecha_entrada)} → {fmtDate(row.fecha_salida)}</small></span><strong>{row.pending>0?`Pendiente ${money(row.pending,row.moneda)}`:"Pagada"}</strong></button>):<div className={s.empty}>No hay reservas para mostrar.</div>}</div></div>:loading?<div className={s.empty}>Cargando cuenta…</div>:<>
          <div className={s.account}><div className={s.accountHeader}><div><b>{reservation.nombre_huesped}</b><small style={violetDetailStyle}>Reserva {reservation.numero_reserva||reservation.id} · {fmtDate(reservation.fecha_entrada)} → {fmtDate(reservation.fecha_salida)}</small></div><strong>{money(total,reservation.moneda)}</strong></div>{lines.map(line=><div className={s.line} key={line.key}><span><b>{line.name}</b><small style={violetDetailStyle}>{line.detail}</small></span><strong>{money(line.amount,reservation.moneda)}</strong></div>)}</div>
          <div className={s.moneyHero}><article><span>Total</span><b>{money(total,reservation.moneda)}</b><small style={violetDetailStyle}>Cuenta completa</small></article><article className={s.paid}><span>Pagado</span><b>{money(paid,reservation.moneda)}</b><small style={violetDetailStyle}>{payments.filter(validPayment).length} pago{payments.filter(validPayment).length===1?"":"s"}</small></article><article className={s.due}><span>Pendiente</span><b>{money(pending,reservation.moneda)}</b><small style={violetDetailStyle}>Saldo a cobrar</small></article></div>
          {pending>0?<>
            <div className={s.paymentModeHead}><div><b>{splitActive?"PAGO DIVIDIDO":"MEDIO DE PAGO"}</b><span>{splitActive?"El último medio completa automáticamente el saldo restante.":"Podés cobrar con un solo medio o dividir el saldo."}</span></div><button type="button" className={s.splitToggle} onClick={splitActive?stopSplit:startSplit}>{splitActive?"Usar un solo medio":"Dividir pago"}</button></div>
            {!splitActive?<div className={s.formGrid}>
              <label className={s.field}><span>Medio de pago</span><select value={method} onChange={event=>{setMethod(event.target.value);setCashReceived("")}}>{PAYMENT_METHODS.map(item=><option key={item}>{item}</option>)}</select></label>
              <label className={s.field}><span>Importe</span><input type="number" min="0.01" max={pending} step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/><div className={s.quickAmount}><button type="button" onClick={()=>setAmount(String(pending))}>Cobrar saldo completo</button></div></label>
              <label className={s.field}><span>Referencia</span><input value={reference} onChange={event=>setReference(event.target.value)} placeholder="Banco, billetera, cupón, agencia, comprobante…"/></label><label className={s.field}><span>Nota</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder="Opcional"/></label>
            </div>:<div className={s.splitPanel}>
              <div className={s.splitRows}>{paymentParts.map((part,index)=>{const auto=index===paymentParts.length-1;return <div className={s.splitRow} key={`${index}-${part.method}`}><span className={s.splitNumber}>{index+1}</span><select value={part.method} onChange={event=>changePartMethod(index,event.target.value)}>{PAYMENT_METHODS.map(item=><option key={item}>{item}</option>)}</select>{auto?<div className={s.splitRemainder}><small style={violetDetailStyle}>Resto automático</small><strong>{money(part.amount,reservation.moneda)}</strong></div>:<input type="number" min="0" step="0.01" value={part.amount} onChange={event=>changePartAmount(index,event.target.value)}/>} {paymentParts.length>2?<button type="button" className={s.splitRemove} onClick={()=>removePart(index)} aria-label={`Quitar medio ${index+1}`}>×</button>:null}</div>})}</div>
              <div className={s.splitTools}>{paymentParts.length<PAYMENT_METHODS.length?<button type="button" onClick={addPart}>+ Agregar otro medio</button>:<span>Ya usaste todos los medios disponibles.</span>}</div>
              <div className={`${s.splitCheck} ${splitValid?s.splitCheckOk:s.splitCheckBad}`}><span>{splitValid?"Pago completo":splitOver>0?`Excede ${money(splitOver,reservation.moneda)}`:`Faltan ${money(splitRemaining,reservation.moneda)}`}</span><b>{paymentParts.map(part=>`${part.method} ${money(part.amount,reservation.moneda)}`).join(" + ")}</b></div>
              <div className={s.formGrid}><label className={s.field}><span>Referencia</span><input value={reference} onChange={event=>setReference(event.target.value)} placeholder="Banco, billetera, cupón, agencia, comprobante…"/></label><label className={s.field}><span>Nota</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder="Opcional"/></label></div>
            </div>}
            {hasCash?<div className={s.cashReceivedBox}><label><span>Efectivo recibido</span><input type="number" min="0" step="0.01" value={cashReceived} onChange={event=>setCashReceived(event.target.value)} placeholder={String(cashTarget)}/></label><div className={`${s.changeBox} ${cashReceived&&cashShort>0?s.changeShort:""}`}><span>{cashReceived&&cashShort>0?"Falta":"Vuelto"}</span><strong>{!cashReceived?"—":cashShort>0?money(cashShort,reservation.moneda):money(change,reservation.moneda)}</strong><small style={violetDetailStyle}>Parte en efectivo: {money(cashTarget,reservation.moneda)}</small></div></div>:null}
          </>:<p className={s.hint}>La cuenta está saldada. No hace falta registrar otro pago.</p>}
          {hasCash&&!session&&pending>0?<p className={s.hint}>La caja del turno está cerrada. Podés elegir otro medio de pago o cerrar este cuadro y abrir la caja antes de cobrar en efectivo.</p>:null}
          <div className={s.footer}><button type="button" className={s.secondary} onClick={()=>{setReservation(null);setPayments([]);setAmount("");setPaymentParts([]);setCashReceived("")}}>Cambiar reserva</button><button type="button" className={s.secondary} onClick={onClose}>Cancelar</button><button type="button" className={s.save} disabled={saving||pending<=0||(splitActive&&!splitValid)||!cashInputValid} onClick={save}>{saving?"Registrando…":splitActive?"Registrar pago dividido":numericAmount<pending?"Registrar pago parcial":"Cobrar saldo"}</button></div>
        </>}
      </div>
    </section>
  </div>
}