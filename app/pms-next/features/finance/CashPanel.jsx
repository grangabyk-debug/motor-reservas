"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./finance.module.css"
import h from"./cash-history.module.css"

function money(value,currency="ARS"){return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value||0))}
const fmt=value=>value?new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)):"—"
const normalize=value=>String(value||"").trim().toLowerCase()
const isCash=value=>{const key=normalize(value);return key==="cash"||key.includes("efect")}
const validPayment=row=>!["anulado","cancelado","void","rechazado"].includes(normalize(row?.estado))

export default function CashPanel({propertyId}){
  const[session,setSession]=useState(null)
  const[movements,setMovements]=useState([])
  const[reservationPayments,setReservationPayments]=useState([])
  const[history,setHistory]=useState([])
  const[opening,setOpening]=useState(0)
  const[counted,setCounted]=useState(0)
  const[form,setForm]=useState({movement_type:"expense",method:"cash",amount:"",concept:"",reference:"",currency:"ARS"})
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[openRes,historyRes]=await Promise.all([
        supabase.from("hotel_cash_sessions").select("id,opened_by,closed_by,opened_at,closed_at,opening_amount,closing_amount,expected_amount,status,notes").eq("property_id",propertyId).eq("status","open").order("opened_at",{ascending:false}).limit(1),
        supabase.from("hotel_cash_sessions").select("id,opened_by,closed_by,opened_at,closed_at,opening_amount,closing_amount,expected_amount,status,notes").eq("property_id",propertyId).eq("status","closed").order("closed_at",{ascending:false}).limit(20),
      ])
      if(openRes.error)throw openRes.error;if(historyRes.error)throw historyRes.error
      const active=openRes.data?.[0]||null;setSession(active);setHistory(historyRes.data||[])
      if(active){
        const[movementRes,paymentRes]=await Promise.all([
          supabase.from("hotel_cash_movements").select("id,movement_type,method,amount,currency,concept,reference,created_by,created_at").eq("property_id",propertyId).eq("session_id",active.id).order("created_at",{ascending:false}),
          supabase.from("pagos").select("id,reserva_id,monto,metodo,moneda,estado,refunded_amount,created_at").eq("property_id",propertyId).gte("created_at",active.opened_at).order("created_at",{ascending:false}),
        ])
        if(movementRes.error)throw movementRes.error;if(paymentRes.error)throw paymentRes.error
        setMovements(movementRes.data||[]);setReservationPayments((paymentRes.data||[]).filter(validPayment))
      }else{setMovements([]);setReservationPayments([])}
    }catch(err){setError(err?.message||"No se pudo cargar la caja.")}
    finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{load()},[load])

  const totals=useMemo(()=>{
    let manualIncome=0,manualExpense=0,cashManualIncome=0,cashManualExpense=0,paymentIncome=0,cashPaymentIncome=0
    for(const row of movements){const amount=Number(row.amount||0),out=["expense","refund"].includes(normalize(row.movement_type));if(out){manualExpense+=amount;if(isCash(row.method))cashManualExpense+=amount}else{manualIncome+=amount;if(isCash(row.method))cashManualIncome+=amount}}
    for(const row of reservationPayments){const amount=Math.max(0,Number(row.monto||0)-Number(row.refunded_amount||0));paymentIncome+=amount;if(isCash(row.metodo))cashPaymentIncome+=amount}
    const income=manualIncome+paymentIncome,expense=manualExpense,expected=Number(session?.opening_amount||0)+cashManualIncome+cashPaymentIncome-cashManualExpense
    return{income,expense,expected,difference:Number(counted||0)-expected,cashPaymentIncome}
  },[movements,reservationPayments,session,counted])

  async function openSession(){setSaving(true);setError("");try{const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const{error:insertError}=await supabase.from("hotel_cash_sessions").insert({property_id:propertyId,opened_by:userData?.user?.id||null,closed_by:null,opened_at:new Date().toISOString(),closed_at:null,opening_amount:Math.max(0,Number(opening)||0),closing_amount:null,expected_amount:null,status:"open",notes:null});if(insertError)throw insertError;setOpening(0);await load()}catch(err){setError(err?.message||"No se pudo abrir la caja.")}finally{setSaving(false)}}

  async function addMovement(){setSaving(true);setError("");try{if(!session)throw new Error("Abrí una caja antes de registrar movimientos.");if(!form.concept.trim()||Number(form.amount)<=0)throw new Error("Ingresá concepto e importe.");const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const{error:insertError}=await supabase.from("hotel_cash_movements").insert({property_id:propertyId,session_id:session.id,reservation_id:null,movement_type:form.movement_type,method:form.method,amount:Number(form.amount),currency:form.currency,concept:form.concept.trim(),reference:form.reference.trim()||null,created_by:userData?.user?.id||null});if(insertError)throw insertError;setForm(current=>({...current,amount:"",concept:"",reference:""}));await load()}catch(err){setError(err?.message||"No se pudo registrar el movimiento.")}finally{setSaving(false)}}

  async function closeSession(){setSaving(true);setError("");try{if(!session)throw new Error("No hay una caja abierta.");if(counted===""||Number(counted)<0)throw new Error("Ingresá el efectivo contado.");const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const{error:updateError}=await supabase.from("hotel_cash_sessions").update({closed_by:userData?.user?.id||null,closed_at:new Date().toISOString(),closing_amount:Number(counted),expected_amount:totals.expected,status:"closed"}).eq("id",session.id).eq("property_id",propertyId);if(updateError)throw updateError;window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:"Caja cerrada",message:`Esperado ${money(totals.expected)} · contado ${money(counted)} · diferencia ${money(Number(counted)-totals.expected)}.`}}));setCounted(0);await load()}catch(err){setError(err?.message||"No se pudo cerrar la caja.")}finally{setSaving(false)}}

  if(loading)return <div className={s.empty}>Cargando caja…</div>
  return <div className={s.financeBody}>
    {error&&<div className={s.alert}>{error}</div>}
    {!session?<article className={`${s.glass} ${s.centerCard}`}><span className={s.bigIcon}>$</span><small>CAJA CERRADA</small><h2>Abrir turno de caja</h2><p>Ingresá el efectivo inicial. Los cobros en efectivo de reservas y los movimientos manuales impactarán automáticamente en el arqueo.</p><label className={s.moneyInput}><span>Monto inicial</span><input type="number" min="0" step="0.01" value={opening} onChange={e=>setOpening(e.target.value)}/></label><button className={s.primary} onClick={openSession} disabled={saving}>{saving?"Abriendo…":"Abrir caja"}</button></article>:<>
      <div className={s.cashHero}><article><span>Apertura</span><b>{money(session.opening_amount)}</b></article><article><span>Ingresos</span><b>{money(totals.income)}</b></article><article><span>Egresos</span><b>{money(totals.expense)}</b></article><article><span>Efectivo esperado</span><b>{money(totals.expected)}</b></article></div>
      <div className={s.cashColumns}><article className={s.glass}><header><div><small>MOVIMIENTO</small><h2>Registrar ingreso o egreso</h2></div></header><div className={s.formGrid}><label><span>Tipo</span><select value={form.movement_type} onChange={e=>setForm(f=>({...f,movement_type:e.target.value}))}><option value="income">Ingreso</option><option value="expense">Gasto</option><option value="payment">Cobro</option><option value="refund">Devolución</option><option value="adjustment">Ajuste</option></select></label><label><span>Método</span><select value={form.method} onChange={e=>setForm(f=>({...f,method:e.target.value}))}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="other">Otro</option></select></label><label><span>Importe</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></label><label><span>Moneda</span><select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}><option>ARS</option><option>USD</option></select></label><label className={s.full}><span>Concepto</span><input value={form.concept} onChange={e=>setForm(f=>({...f,concept:e.target.value}))} placeholder="Ej. compra de insumos"/></label><label className={s.full}><span>Referencia</span><input value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))}/></label></div><button className={s.primary} onClick={addMovement} disabled={saving}>Registrar movimiento</button></article>
      <article className={s.glass}><header><div><small>ARQUEO</small><h2>Cierre de caja</h2></div></header><div className={s.reconcile}><span>Cobros en efectivo de reservas <b>{money(totals.cashPaymentIncome)}</b></span></div><label className={s.moneyInput}><span>Efectivo contado</span><input type="number" min="0" step="0.01" value={counted} onChange={e=>setCounted(e.target.value)}/></label><div className={s.reconcile}><span>Esperado <b>{money(totals.expected)}</b></span><span>Diferencia <b className={totals.difference===0?s.goodText:s.warnText}>{money(totals.difference)}</b></span></div><button className={s.danger} onClick={closeSession} disabled={saving}>Cerrar caja</button></article></div>
      <article className={s.glass}><header><div><small>TURNO ACTUAL</small><h2>Movimientos manuales</h2><p>Los cobros vinculados a reservas se visualizan en Caja diaria y ya están incluidos en el efectivo esperado.</p></div></header>{!movements.length?<div className={s.empty}>Todavía no hay movimientos manuales en este turno.</div>:<div className={s.movementList}>{movements.map(row=><div key={row.id}><span className={row.movement_type==="expense"||row.movement_type==="refund"?s.out:s.in}>{row.movement_type==="expense"||row.movement_type==="refund"?"−":"+"}</span><div><b>{row.concept}</b><small>{fmt(row.created_at)} · {row.method}</small></div><strong>{money(row.amount,row.currency)}</strong></div>)}</div>}</article>
    </>}
    <article className={h.history}><header><div><small>HISTORIAL AUDITADO</small><h2>Últimos cierres de caja</h2><p>Cada cierre conserva apertura, esperado, contado y diferencia para control de gerencia.</p></div><span>{history.length} cierres</span></header>{history.length?<div className={h.table}><div className={h.head}><span>Turno</span><span>Apertura</span><span>Esperado</span><span>Contado</span><span>Diferencia</span></div>{history.map(row=>{const diff=Number(row.closing_amount||0)-Number(row.expected_amount||0);return <div className={h.row} key={row.id}><span><b>{fmt(row.closed_at)}</b><small>Abierta {fmt(row.opened_at)}</small></span><span>{money(row.opening_amount)}</span><span>{money(row.expected_amount)}</span><span>{money(row.closing_amount)}</span><strong data-ok={Math.abs(diff)<.01}>{money(diff)}</strong></div>})}</div>:<div className={h.empty}>Todavía no hay cierres anteriores.</div>}</article>
  </div>
}
