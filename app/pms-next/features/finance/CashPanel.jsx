"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./finance.module.css"

function money(value,currency="ARS"){return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value||0))}

export default function CashPanel({propertyId}){
  const[session,setSession]=useState(null)
  const[movements,setMovements]=useState([])
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
      const{data:sessions,error:sessionError}=await supabase.from("hotel_cash_sessions").select("id,opened_by,closed_by,opened_at,closed_at,opening_amount,closing_amount,expected_amount,status,notes").eq("property_id",propertyId).eq("status","open").order("opened_at",{ascending:false}).limit(1)
      if(sessionError)throw sessionError
      const active=sessions?.[0]||null;setSession(active)
      if(active){const{data,error:movementError}=await supabase.from("hotel_cash_movements").select("id,movement_type,method,amount,currency,concept,reference,created_by,created_at").eq("property_id",propertyId).eq("session_id",active.id).order("created_at",{ascending:false});if(movementError)throw movementError;setMovements(data||[])}else setMovements([])
    }catch(err){setError(err?.message||"No se pudo cargar la caja.")}
    finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{load()},[load])

  const totals=useMemo(()=>{let income=0,expense=0;for(const row of movements){const amount=Number(row.amount||0);if(["income","payment"].includes(row.movement_type))income+=amount;else if(["expense","refund"].includes(row.movement_type))expense+=amount;else income+=amount}const expected=Number(session?.opening_amount||0)+income-expense;return{income,expense,expected,difference:Number(counted||0)-expected}},[movements,session,counted])

  async function openSession(){setSaving(true);setError("");try{const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const{error:insertError}=await supabase.from("hotel_cash_sessions").insert({property_id:propertyId,opened_by:userData?.user?.id||null,closed_by:null,opened_at:new Date().toISOString(),closed_at:null,opening_amount:Math.max(0,Number(opening)||0),closing_amount:null,expected_amount:null,status:"open",notes:null});if(insertError)throw insertError;await load()}catch(err){setError(err?.message||"No se pudo abrir la caja.")}finally{setSaving(false)}}

  async function addMovement(){setSaving(true);setError("");try{if(!session)throw new Error("Abrí una caja antes de registrar movimientos.");if(!form.concept.trim()||Number(form.amount)<=0)throw new Error("Ingresá concepto e importe.");const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const{error:insertError}=await supabase.from("hotel_cash_movements").insert({property_id:propertyId,session_id:session.id,reservation_id:null,movement_type:form.movement_type,method:form.method,amount:Number(form.amount),currency:form.currency,concept:form.concept.trim(),reference:form.reference.trim()||null,created_by:userData?.user?.id||null});if(insertError)throw insertError;setForm(current=>({...current,amount:"",concept:"",reference:""}));await load()}catch(err){setError(err?.message||"No se pudo registrar el movimiento.")}finally{setSaving(false)}}

  async function closeSession(){setSaving(true);setError("");try{if(!session)throw new Error("No hay una caja abierta.");if(counted===""||Number(counted)<0)throw new Error("Ingresá el efectivo contado.");const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const{error:updateError}=await supabase.from("hotel_cash_sessions").update({closed_by:userData?.user?.id||null,closed_at:new Date().toISOString(),closing_amount:Number(counted),expected_amount:totals.expected,status:"closed"}).eq("id",session.id).eq("property_id",propertyId);if(updateError)throw updateError;setCounted(0);await load()}catch(err){setError(err?.message||"No se pudo cerrar la caja.")}finally{setSaving(false)}}

  if(loading)return <div className={s.empty}>Cargando caja…</div>
  return <div className={s.financeBody}>
    {error&&<div className={s.alert}>{error}</div>}
    {!session?<article className={`${s.glass} ${s.centerCard}`}><span className={s.bigIcon}>$</span><small>CAJA CERRADA</small><h2>Abrir turno de caja</h2><p>Ingresá el efectivo inicial. Cada movimiento quedará asociado al usuario y a esta propiedad.</p><label className={s.moneyInput}><span>Monto inicial</span><input type="number" min="0" step="0.01" value={opening} onChange={e=>setOpening(e.target.value)}/></label><button className={s.primary} onClick={openSession} disabled={saving}>{saving?"Abriendo…":"Abrir caja"}</button></article>:<>
      <div className={s.cashHero}><article><span>Apertura</span><b>{money(session.opening_amount)}</b></article><article><span>Ingresos</span><b>{money(totals.income)}</b></article><article><span>Egresos</span><b>{money(totals.expense)}</b></article><article><span>Esperado</span><b>{money(totals.expected)}</b></article></div>
      <div className={s.cashColumns}><article className={s.glass}><header><div><small>MOVIMIENTO</small><h2>Registrar ingreso o egreso</h2></div></header><div className={s.formGrid}><label><span>Tipo</span><select value={form.movement_type} onChange={e=>setForm(f=>({...f,movement_type:e.target.value}))}><option value="income">Ingreso</option><option value="expense">Gasto</option><option value="payment">Cobro</option><option value="refund">Devolución</option><option value="adjustment">Ajuste</option></select></label><label><span>Método</span><select value={form.method} onChange={e=>setForm(f=>({...f,method:e.target.value}))}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="other">Otro</option></select></label><label><span>Importe</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></label><label><span>Moneda</span><select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}><option>ARS</option><option>USD</option></select></label><label className={s.full}><span>Concepto</span><input value={form.concept} onChange={e=>setForm(f=>({...f,concept:e.target.value}))} placeholder="Ej. compra de insumos"/></label><label className={s.full}><span>Referencia</span><input value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))}/></label></div><button className={s.primary} onClick={addMovement} disabled={saving}>Registrar movimiento</button></article>
      <article className={s.glass}><header><div><small>ARQUEO</small><h2>Cierre de caja</h2></div></header><label className={s.moneyInput}><span>Efectivo contado</span><input type="number" min="0" step="0.01" value={counted} onChange={e=>setCounted(e.target.value)}/></label><div className={s.reconcile}><span>Esperado <b>{money(totals.expected)}</b></span><span>Diferencia <b className={totals.difference===0?s.goodText:s.warnText}>{money(totals.difference)}</b></span></div><button className={s.danger} onClick={closeSession} disabled={saving}>Cerrar caja</button></article></div>
      <article className={s.glass}><header><div><small>TURNO ACTUAL</small><h2>Movimientos</h2></div></header>{!movements.length?<div className={s.empty}>Todavía no hay movimientos en este turno.</div>:<div className={s.movementList}>{movements.map(row=><div key={row.id}><span className={row.movement_type==="expense"||row.movement_type==="refund"?s.out:s.in}>{row.movement_type==="expense"||row.movement_type==="refund"?"−":"+"}</span><div><b>{row.concept}</b><small>{new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(new Date(row.created_at))} · {row.method}</small></div><strong>{money(row.amount,row.currency)}</strong></div>)}</div>}</article>
    </>}
  </div>
}
