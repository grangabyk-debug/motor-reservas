"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./cashActions.module.css"

const RESERVATION_SELECT="id,numero_reserva,nombre_huesped,fecha_entrada,fecha_salida,precio_total,subtotal,moneda,estado,servicios,cochera_total,mascotas_total,early_checkin_importe,late_checkout_importe,extra,extra_descripcion"
const normalize=value=>String(value||"").trim().toLowerCase()
const validPayment=row=>!["anulado","cancelado","void","rechazado"].includes(normalize(row?.estado))
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):"—"

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

export default function ReservationPaymentPanel({propertyId,reservationId,session,onClose,onSaved}){
  const[reservation,setReservation]=useState(null),[payments,setPayments]=useState([]),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState("")
  const[method,setMethod]=useState("Efectivo"),[amount,setAmount]=useState(""),[reference,setReference]=useState(""),[note,setNote]=useState("")
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
      setReservation(row);setPayments(pays);setAmount(pending?String(pending):"");setReference("");setNote("")
    }catch(err){setError(err?.message||"No se pudo cargar la reserva para cobrar.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{setReservation(null);setPayments([]);setQuery("");setResults([]);setError("");setMethod("Efectivo");if(reservationId)loadReservation(reservationId)},[reservationId,loadReservation])
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

  const paid=useMemo(()=>paidTotal(payments),[payments]),total=Number(reservation?.precio_total||0),pending=Math.max(0,total-paid),lines=useMemo(()=>serviceLines(reservation),[reservation]),numericAmount=Number(amount||0)
  const isCash=normalize(method).includes("efect")||normalize(method)==="cash"

  async function save(){
    if(!reservation||saving)return
    setSaving(true);setError("")
    try{
      if(pending<=0)throw new Error("La reserva ya está totalmente pagada.")
      if(!Number.isFinite(numericAmount)||numericAmount<=0)throw new Error("Ingresá un importe válido.")
      if(numericAmount>pending+.01)throw new Error(`El pago no puede superar el saldo pendiente de ${money(pending,reservation.moneda)}.`)
      if(isCash&&!session)throw new Error("Para cobrar en efectivo primero tenés que abrir la caja del turno.")
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const user=userData?.user;if(!user)throw new Error("No se pudo identificar al usuario que registra el pago.")
      const{data,error:insertError}=await supabase.from("pagos").insert({user_id:user.id,created_by:user.id,property_id:propertyId,reserva_id:Number(reservation.id),monto:numericAmount,metodo:method,moneda:reservation.moneda||"ARS",estado:"confirmado",source:"manual",provider:null,referencia:reference.trim()||null,nota:note.trim()||`Cobro desde Caja diaria · ${reservation.numero_reserva||reservation.id}`}).select("id,reserva_id,monto,metodo,moneda,estado,created_at").single()
      if(insertError)throw insertError
      if(typeof window!=="undefined"){window.dispatchEvent(new CustomEvent("hl:pms-payment-updated",{detail:{reservationId:Number(reservation.id),paymentId:data.id}}));window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:"Pago registrado",message:`${reservation.nombre_huesped} · ${money(numericAmount,reservation.moneda)} · ${method}.`}}))}
      onSaved?.({payment:data,reservation})
    }catch(err){setError(err?.message||"No se pudo registrar el pago.")}
    finally{setSaving(false)}
  }

  return <div className={s.overlay} role="dialog" aria-modal="true" aria-label="Cobrar reserva">
    <section className={`${s.panel} ${s.panelWide}`}>
      <header className={s.panelHeader}><div><small>CAJA DIARIA · COBRO</small><h2>{reservation?`Cobrar a ${reservation.nombre_huesped}`:"Cobrar una reserva"}</h2><p>{reservation?`Reserva ${reservation.numero_reserva||reservation.id} · los importes ya incluyen alojamiento y extras.`:"Buscá al huésped o la reserva y el sistema trae automáticamente el saldo pendiente."}</p></div><button type="button" className={s.close} onClick={onClose}>×</button></header>
      <div className={s.body}>
        {error?<div className={s.alert}>{error}</div>:null}
        {!reservation?<div className={s.searchBox}><input className={s.searchInput} value={query} onChange={event=>setQuery(event.target.value)} autoFocus placeholder="Buscar huésped o número de reserva…"/><div className={s.results}>{searching?<div className={s.empty}>Buscando reservas…</div>:results.length?results.map(row=><button type="button" className={s.result} key={row.id} disabled={row.pending<=0} onClick={()=>loadReservation(row.id)}><span><b>{row.nombre_huesped}</b><small>{row.numero_reserva||`Reserva ${row.id}`} · {fmtDate(row.fecha_entrada)} → {fmtDate(row.fecha_salida)}</small></span><strong>{row.pending>0?`Pendiente ${money(row.pending,row.moneda)}`:"Pagada"}</strong></button>):<div className={s.empty}>No hay reservas para mostrar.</div>}</div></div>:loading?<div className={s.empty}>Cargando cuenta…</div>:<>
          <div className={s.account}><div className={s.accountHeader}><div><b>{reservation.nombre_huesped}</b><small>Reserva {reservation.numero_reserva||reservation.id} · {fmtDate(reservation.fecha_entrada)} → {fmtDate(reservation.fecha_salida)}</small></div><strong>{money(total,reservation.moneda)}</strong></div>{lines.map(line=><div className={s.line} key={line.key}><span><b>{line.name}</b><small>{line.detail}</small></span><strong>{money(line.amount,reservation.moneda)}</strong></div>)}</div>
          <div className={s.moneyHero}><article><span>Total</span><b>{money(total,reservation.moneda)}</b><small>Cuenta completa</small></article><article className={s.paid}><span>Pagado</span><b>{money(paid,reservation.moneda)}</b><small>{payments.filter(validPayment).length} pago{payments.filter(validPayment).length===1?"":"s"}</small></article><article className={s.due}><span>Pendiente</span><b>{money(pending,reservation.moneda)}</b><small>Saldo a cobrar</small></article></div>
          {pending>0?<div className={s.formGrid}><label className={s.field}><span>Medio de pago</span><select value={method} onChange={event=>setMethod(event.target.value)}><option>Efectivo</option><option>Transferencia</option><option>Mercado Pago</option><option>Tarjeta</option><option>Otro</option></select></label><label className={s.field}><span>Importe</span><input type="number" min="0.01" max={pending} step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/><div className={s.quickAmount}><button type="button" onClick={()=>setAmount(String(pending))}>Cobrar saldo completo</button></div></label><label className={s.field}><span>Referencia</span><input value={reference} onChange={event=>setReference(event.target.value)} placeholder="Transferencia, cupón, comprobante…"/></label><label className={s.field}><span>Nota</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder="Opcional"/></label></div>:<p className={s.hint}>La cuenta está saldada. No hace falta registrar otro pago.</p>}
          {isCash&&!session&&pending>0?<p className={s.hint}>La caja del turno está cerrada. Podés elegir otro medio de pago o cerrar este cuadro y abrir la caja antes de cobrar en efectivo.</p>:null}
          <div className={s.footer}><button type="button" className={s.secondary} onClick={()=>{setReservation(null);setPayments([]);setAmount("")}}>Cambiar reserva</button><button type="button" className={s.secondary} onClick={onClose}>Cancelar</button><button type="button" className={s.save} disabled={saving||pending<=0} onClick={save}>{saving?"Registrando…":numericAmount<pending?"Registrar pago parcial":"Cobrar saldo"}</button></div>
        </>}
      </div>
    </section>
  </div>
}
