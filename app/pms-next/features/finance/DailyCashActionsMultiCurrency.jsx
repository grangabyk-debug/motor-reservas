"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import ReservationPaymentPanel from"./ReservationPaymentPanel"
import CashClosureReport from"./CashClosureReport"
import{buildCashClosureReport,cashDual,cashFmt,cashMoney}from"./cashClosureReport"
import{parseCashSessionMeta,serializeCashSessionMeta,suggestedCashShift}from"./cashSessionMeta"
import s from"./cashActions.module.css"

export default function DailyCashActionsMultiCurrency({propertyId,session,expectedArs=0,expectedUsd=0,focusReservationId,onFocusHandled,onChanged}){
  const[paymentOpen,setPaymentOpen]=useState(false)
  const[paymentReservationId,setPaymentReservationId]=useState(null)
  const[mode,setMode]=useState(null),[saving,setSaving]=useState(false),[error,setError]=useState("")
  const[openingArs,setOpeningArs]=useState("0"),[openingUsd,setOpeningUsd]=useState("0")
  const[openingName,setOpeningName]=useState(""),[openingShift,setOpeningShift]=useState(()=>suggestedCashShift())
  const[countedArs,setCountedArs]=useState(""),[countedUsd,setCountedUsd]=useState(""),[note,setNote]=useState("")
  const[history,setHistory]=useState([]),[report,setReport]=useState(null)
  const[form,setForm]=useState({kind:"expense",other_direction:"expense",method:"Efectivo",amount:"",currency:"ARS",concept:"",reference:""})
  const differenceArs=Number(countedArs||0)-Number(expectedArs||0)
  const differenceUsd=Number(countedUsd||0)-Number(expectedUsd||0)

  useEffect(()=>{
    if(!focusReservationId)return
    setPaymentReservationId(Number(focusReservationId));setPaymentOpen(true);onFocusHandled?.()
  },[focusReservationId,onFocusHandled])
  useEffect(()=>{
    if(mode!=="history"||!propertyId)return
    let cancelled=false
    ;(async()=>{
      const result=await supabase.from("hotel_cash_sessions").select("id,opened_by,closed_by,opened_at,closed_at,opening_amount,opening_amount_usd,closing_amount,closing_amount_usd,expected_amount,expected_amount_usd,status,notes").eq("property_id",propertyId).eq("status","closed").order("closed_at",{ascending:false}).limit(12)
      if(!cancelled&&!result.error)setHistory(result.data||[])
      if(!cancelled&&result.error)setError(result.error.message||"No se pudieron cargar los cierres.")
    })()
    return()=>{cancelled=true}
  },[mode,propertyId])
  useEffect(()=>{
    if(mode!=="open")return
    let cancelled=false
    setOpeningShift(suggestedCashShift())
    ;(async()=>{
      const{data}=await supabase.auth.getUser()
      if(cancelled)return
      const user=data?.user
      const name=user?.user_metadata?.full_name||user?.user_metadata?.name||String(user?.email||"").split("@")[0]||""
      setOpeningName(name)
    })()
    return()=>{cancelled=true}
  },[mode])
  useEffect(()=>{if(!session){setCountedArs("");setCountedUsd("");setNote("")}},[session?.id])

  async function currentUser(){
    const{data,error:userError}=await supabase.auth.getUser()
    if(userError)throw userError
    if(!data?.user)throw new Error("No se pudo identificar al usuario actual.")
    return data.user
  }
  function finish(){setMode(null);setError("");onChanged?.()}
  async function openSession(){
    setSaving(true);setError("")
    try{
      const ars=Number(openingArs||0),usd=Number(openingUsd||0),openerName=openingName.trim()
      if(!openerName)throw new Error("Ingresá el nombre de la persona que abre la caja.")
      if(!openingShift)throw new Error("Seleccioná el turno.")
      if(!Number.isFinite(ars)||ars<0||!Number.isFinite(usd)||usd<0)throw new Error("Ingresá montos iniciales válidos.")
      const user=await currentUser()
      const notes=serializeCashSessionMeta({openerName,shift:openingShift,closeNote:""})
      const{error:insertError}=await supabase.from("hotel_cash_sessions").insert({property_id:propertyId,opened_by:user.id,closed_by:null,opened_at:new Date().toISOString(),closed_at:null,opening_amount:ars,opening_amount_usd:usd,closing_amount:null,closing_amount_usd:null,expected_amount:null,expected_amount_usd:null,status:"open",notes})
      if(insertError)throw insertError
      setOpeningArs("0");setOpeningUsd("0");setOpeningName("");setOpeningShift(suggestedCashShift());finish()
    }catch(err){setError(err?.message||"No se pudo abrir la caja.")}finally{setSaving(false)}
  }
  async function addMovement(){
    setSaving(true);setError("")
    try{
      if(!session)throw new Error("Abrí una caja antes de registrar movimientos.")
      const amount=Number(form.amount||0)
      if(!Number.isFinite(amount)||amount<=0)throw new Error("Ingresá un importe válido.")
      if(!form.concept.trim())throw new Error("Ingresá el concepto del movimiento.")
      const movementType=form.kind==="income"?"income":form.kind==="refund"?"refund":form.kind==="other"?form.other_direction:"expense"
      const user=await currentUser()
      const{error:insertError}=await supabase.from("hotel_cash_movements").insert({property_id:propertyId,session_id:session.id,reservation_id:null,movement_type:movementType,method:form.method,amount,currency:form.currency,concept:form.concept.trim(),reference:form.reference.trim()||null,created_by:user.id})
      if(insertError)throw insertError
      setForm(current=>({...current,amount:"",concept:"",reference:""}));finish()
    }catch(err){setError(err?.message||"No se pudo registrar el movimiento.")}finally{setSaving(false)}
  }
  async function showReport(closedSession){
    setSaving(true);setError("")
    try{setReport(await buildCashClosureReport(propertyId,closedSession));setMode("report")}
    catch(err){setError(err?.message||"No se pudo reconstruir el cierre.")}
    finally{setSaving(false)}
  }
  async function closeSession(){
    setSaving(true);setError("")
    let closed=false
    try{
      if(!session)throw new Error("No hay una caja abierta.")
      if(countedArs===""||countedUsd===""||Number(countedArs)<0||Number(countedUsd)<0)throw new Error("Contá el efectivo en ARS y USD. Si no hay dólares, ingresá 0.")
      const user=await currentUser(),ars=Number(countedArs),usd=Number(countedUsd),closedAt=new Date().toISOString()
      const meta=parseCashSessionMeta(session.notes)
      const notes=serializeCashSessionMeta({openerName:meta.openerName,shift:meta.shift,closeNote:note.trim()})
      const{error:updateError}=await supabase.from("hotel_cash_sessions").update({closed_by:user.id,closed_at:closedAt,closing_amount:ars,closing_amount_usd:usd,expected_amount:Number(expectedArs||0),expected_amount_usd:Number(expectedUsd||0),status:"closed",notes}).eq("id",session.id).eq("property_id",propertyId)
      if(updateError)throw updateError
      closed=true
      const snapshot={...session,closed_by:user.id,closed_at:closedAt,closing_amount:ars,closing_amount_usd:usd,expected_amount:Number(expectedArs||0),expected_amount_usd:Number(expectedUsd||0),status:"closed",notes}
      setCountedArs("");setCountedUsd("");setNote("");onChanged?.()
      window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:"Caja cerrada",message:"El cierre quedó listo para imprimir o descargar en PDF."}}))
      try{setReport(await buildCashClosureReport(propertyId,snapshot,user));setMode("report")}
      catch(err){setMode("history");setError(`La caja se cerró correctamente, pero no se pudo armar el comprobante ahora. Podés reabrirlo desde Cierres. ${err?.message||""}`)}
    }catch(err){if(!closed)setError(err?.message||"No se pudo cerrar la caja.")}
    finally{setSaving(false)}
  }

  const recent=useMemo(()=>history.map(row=>{const meta=parseCashSessionMeta(row.notes);return{...row,meta,diffArs:Number(row.closing_amount||0)-Number(row.expected_amount||0),diffUsd:Number(row.closing_amount_usd||0)-Number(row.expected_amount_usd||0)}}),[history])
  const closeReady=countedArs!==""&&countedUsd!==""
  const title=mode==="open"?"Abrir caja":mode==="movement"?"Registrar movimiento":mode==="history"?"Cierres de caja":mode==="report"?"Cierre de caja":"Arqueo y cierre de caja"
  const subtitle=mode==="report"?"Documento final del turno con saldos, movimientos y nota.":mode==="history"?"Reabrí un cierre para imprimirlo o descargar su PDF.":mode==="close"?"Contá el efectivo, agregá una nota opcional y cerrá el turno.":mode==="movement"?"Ingresos y egresos manuales quedan vinculados al turno abierto.":"Identificá quién abre la caja, el turno y el efectivo inicial."

  return<>
    <div className={s.actions}>
      <button type="button" className={s.action} onClick={()=>{setPaymentReservationId(null);setPaymentOpen(true)}}>＋ Cobrar reserva</button>
      <button type="button" className={s.action} onClick={()=>{setError("");setMode(session?"movement":"open")}}>{session?"＋ Movimiento":"＋ Abrir caja"}</button>
      <button type="button" className={s.action} onClick={()=>{setError("");setMode("history")}}>Cierres</button>
      <button type="button" className={s.primary} onClick={()=>{setError("");setMode(session?"close":"open")}}>{session?"Arqueo / cerrar caja":"Abrir caja"}</button>
    </div>
    {paymentOpen?<ReservationPaymentPanel propertyId={propertyId} reservationId={paymentReservationId} session={session} onClose={()=>{setPaymentOpen(false);setPaymentReservationId(null)}} onSaved={()=>{setPaymentOpen(false);setPaymentReservationId(null);onChanged?.()}}/>:null}
    {mode?<div className={s.overlay} role="dialog" aria-modal="true" aria-label={title}><section className={`${s.panel} ${mode==="report"?s.panelWide:""}`}>
      <header className={s.panelHeader}><div><small>CAJA DIARIA · TURNO MULTIMONEDA</small><h2>{title}</h2><p>{subtitle}</p></div><button type="button" className={s.close} onClick={()=>{setMode(null);setError("")}}>×</button></header>
      <div className={s.body}>
        {error?<div className={s.alert}>{error}</div>:null}
        {mode==="open"?<>
          <p className={s.hint}>Estos datos quedan vinculados al turno y aparecen luego en el cierre de caja.</p>
          <div className={s.formGrid}>
            <label className={s.field}><span>Nombre de quien abre</span><input value={openingName} maxLength={120} onChange={event=>setOpeningName(event.target.value)} placeholder="Ej. Gabriel" autoFocus/></label>
            <label className={s.field}><span>Turno</span><select value={openingShift} onChange={event=>setOpeningShift(event.target.value)}><option>Mañana</option><option>Tarde</option><option>Noche</option></select></label>
            <label className={s.field}><span>Efectivo inicial ARS</span><input type="number" min="0" step="0.01" value={openingArs} onChange={event=>setOpeningArs(event.target.value)}/></label>
            <label className={s.field}><span>Efectivo inicial USD</span><input type="number" min="0" step="0.01" value={openingUsd} onChange={event=>setOpeningUsd(event.target.value)}/></label>
          </div>
          <div className={s.footer}><button type="button" className={s.secondary} onClick={()=>setMode(null)}>Cancelar</button><button type="button" className={s.save} disabled={saving} onClick={openSession}>{saving?"Abriendo…":"Abrir caja"}</button></div>
        </>:mode==="movement"?<>
          <div className={s.formGrid}>
            <label className={s.field}><span>Tipo</span><select value={form.kind} onChange={event=>setForm(current=>({...current,kind:event.target.value}))}><option value="income">Ingreso</option><option value="expense">Egreso</option><option value="spending">Gasto</option><option value="refund">Devolución</option><option value="other">Otro</option></select></label>
            {form.kind==="other"?<label className={s.field}><span>Impacta como</span><select value={form.other_direction} onChange={event=>setForm(current=>({...current,other_direction:event.target.value}))}><option value="income">Ingreso</option><option value="expense">Egreso</option></select></label>:null}
            <label className={s.field}><span>Medio</span><select value={form.method} onChange={event=>setForm(current=>({...current,method:event.target.value}))}><option>Efectivo</option><option>Transferencia</option><option>Mercado Pago</option><option>Tarjeta</option><option>Otro</option></select></label>
            <label className={s.field}><span>Importe</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={event=>setForm(current=>({...current,amount:event.target.value}))}/></label>
            <label className={s.field}><span>Moneda</span><select value={form.currency} onChange={event=>setForm(current=>({...current,currency:event.target.value}))}><option>ARS</option><option>USD</option></select></label>
            <label className={`${s.field} ${s.fieldFull}`}><span>Concepto</span><input value={form.concept} onChange={event=>setForm(current=>({...current,concept:event.target.value}))} placeholder="Ej. compra de insumos, retiro, proveedor…"/></label>
            <label className={`${s.field} ${s.fieldFull}`}><span>Referencia</span><input value={form.reference} onChange={event=>setForm(current=>({...current,reference:event.target.value}))} placeholder="Opcional"/></label>
          </div>
          <div className={s.footer}><button type="button" className={s.secondary} onClick={()=>setMode(null)}>Cancelar</button><button type="button" className={s.save} disabled={saving} onClick={addMovement}>{saving?"Registrando…":"Registrar movimiento"}</button></div>
        </>:mode==="close"?<>
          <div className={s.reconcile}>
            <div className={s.reconcileRow}><span>Efectivo esperado ARS</span><b>{cashMoney(expectedArs,"ARS")}</b></div>
            <label className={s.field}><span>Efectivo contado ARS</span><input type="number" min="0" step="0.01" value={countedArs} onChange={event=>setCountedArs(event.target.value)} autoFocus/></label>
            <div className={s.reconcileRow}><span>Diferencia ARS</span><b className={Math.abs(differenceArs)<.01?s.good:s.bad}>{countedArs===""?"—":cashMoney(differenceArs,"ARS")}</b></div>
            <div className={s.reconcileRow}><span>Efectivo esperado USD</span><b>{cashMoney(expectedUsd,"USD")}</b></div>
            <label className={s.field}><span>Efectivo contado USD</span><input type="number" min="0" step="0.01" value={countedUsd} onChange={event=>setCountedUsd(event.target.value)} placeholder="0"/></label>
            <div className={s.reconcileRow}><span>Diferencia USD</span><b className={Math.abs(differenceUsd)<.01?s.good:s.bad}>{countedUsd===""?"—":cashMoney(differenceUsd,"USD")}</b></div>
          </div>
          <label className={`${s.field} ${s.fieldFull}`}><span>Nota de cierre · opcional</span><textarea maxLength={1000} value={note} onChange={event=>setNote(event.target.value)} placeholder="Novedades, diferencias justificadas, comprobantes pendientes…"/></label>
          <p className={s.hint} style={{marginTop:10}}>La nota queda guardada con el turno y sale en la impresión y el PDF.</p>
          <div className={s.footer}><button type="button" className={s.secondary} onClick={()=>setMode(null)}>Cancelar</button><button type="button" className={s.danger} disabled={saving||!closeReady} onClick={closeSession}>{saving?"Cerrando…":"Cerrar caja y generar cierre"}</button></div>
        </>:mode==="history"?<>
          {saving?<div className={s.empty}>Cargando cierre…</div>:recent.length?<div className={s.history}><h3>Últimos cierres</h3><div className={s.historyRows}><div className={`${s.historyRow} ${s.historyHead}`}><span>Turno</span><span>Apertura</span><span>Esperado</span><span>Contado</span><span>Diferencia</span></div>{recent.map(row=><div className={s.historyRow} key={row.id}><span><b>{cashFmt(row.closed_at)}</b><small>{row.meta.shift?`Turno ${row.meta.shift} · `:""}{row.meta.openerName||`Abierta ${cashFmt(row.opened_at)}`}</small><button type="button" className={s.secondary} style={{height:27,padding:"0 8px",marginTop:4}} onClick={()=>showReport(row)}>Ver cierre</button></span><span>{cashDual(row.opening_amount,row.opening_amount_usd)}</span><span>{cashDual(row.expected_amount,row.expected_amount_usd)}</span><span>{cashDual(row.closing_amount,row.closing_amount_usd)}</span><strong className={Math.abs(row.diffArs)<.01&&Math.abs(row.diffUsd)<.01?s.good:s.bad}>{cashDual(row.diffArs,row.diffUsd)}</strong></div>)}</div></div>:<div className={s.empty}>Todavía no hay cierres guardados.</div>}
        </>:mode==="report"&&report?<CashClosureReport report={report} onBack={()=>setMode("history")} onClose={()=>setMode(null)} onError={setError}/>:null}
      </div>
    </section></div>:null}
  </>
}
