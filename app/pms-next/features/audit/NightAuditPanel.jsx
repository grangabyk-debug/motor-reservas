"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{pmsConfirm}from"../../components/system/PmsDialogHost"
import s from"./audit.module.css"

const pad=value=>String(value).padStart(2,"0")
const isoDate=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const normalize=value=>String(value||"").trim().toLowerCase()
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`)).replace(".",""):"—"
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const isMissingBackend=error=>["PGRST202","42P01","42883"].includes(error?.code)||/hl_night_audit_status|hotel_night_audit_closures|schema cache|does not exist/i.test(String(error?.message||""))

function localBusinessDate(timezone,cutoff){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:timezone||"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).reduce((acc,item)=>(acc[item.type]=item.value,acc),{})
  const date=new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00`),nowMinutes=Number(parts.hour||0)*60+Number(parts.minute||0),[h,m]=String(cutoff||"05:00").split(":").map(Number),cutoffMinutes=(Number(h)||0)*60+(Number(m)||0)
  if(nowMinutes<cutoffMinutes)date.setDate(date.getDate()-1)
  return isoDate(date)
}

export default function NightAuditPanel({propertyId,property,onNavigate}){
  const[status,setStatus]=useState(null),[history,setHistory]=useState([]),[loading,setLoading]=useState(true),[closing,setClosing]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[note,setNote]=useState(""),[backendReady,setBackendReady]=useState(true),[cutoffEditing,setCutoffEditing]=useState(false),[cutoffDraft,setCutoffDraft]=useState("05:00"),[savingCutoff,setSavingCutoff]=useState(false)
  const canManageCutoff=["owner","admin","manager"].includes(property?.role)

  const fallbackStatus=useCallback(async()=>{
    const settingsRes=await supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle()
    if(settingsRes.error)throw settingsRes.error
    const prefs=settingsRes.data?.settings?.preferences||{},timezone=prefs.timezone||"America/Argentina/Buenos_Aires",cutoff=prefs.business_day_cutoff||"05:00",businessDate=localBusinessDate(timezone,cutoff)
    const[reservationRes,cashRes]=await Promise.all([
      supabase.from("reservas").select("id,numero_reserva,nombre_huesped,fecha_entrada,fecha_salida,fecha_operativa,estado,no_show,precio_total,moneda,merged_into_id").eq("property_id",propertyId).limit(1200),
      supabase.from("hotel_cash_sessions").select("id,opened_at,opened_by,status").eq("property_id",propertyId).eq("status","open").order("opened_at",{ascending:true}),
    ])
    if(reservationRes.error)throw reservationRes.error;if(cashRes.error)throw cashRes.error
    const rows=reservationRes.data||[],activeRows=rows.filter(row=>!row.merged_into_id),pendingArrivals=activeRows.filter(row=>(row.fecha_operativa||row.fecha_entrada)<=businessDate&&!row.no_show&&!["alojado","finalizada","cancelada","cancelled","anulada","anulado"].includes(normalize(row.estado))).map(row=>({id:row.id,code:row.numero_reserva||String(row.id),guest:row.nombre_huesped,state:row.estado||"pendiente",arrival_date:row.fecha_entrada,operational_date:row.fecha_operativa||row.fecha_entrada})),pendingDepartures=activeRows.filter(row=>row.fecha_salida<=businessDate&&!row.no_show&&normalize(row.estado)==="alojado").map(row=>({id:row.id,code:row.numero_reserva||String(row.id),guest:row.nombre_huesped,state:row.estado,departure_date:row.fecha_salida})),finalized=activeRows.filter(row=>row.fecha_salida<=businessDate&&!row.no_show&&normalize(row.estado)==="finalizada")
    let debt=[]
    if(finalized.length){const ids=finalized.map(row=>row.id),paymentRes=await supabase.from("pagos").select("reserva_id,monto,refunded_amount,estado").eq("property_id",propertyId).in("reserva_id",ids);if(paymentRes.error)throw paymentRes.error;const paid=new Map();for(const payment of paymentRes.data||[]){if(["anulado","cancelado","void","rechazado","cancelled"].includes(normalize(payment.estado)))continue;paid.set(Number(payment.reserva_id),(paid.get(Number(payment.reserva_id))||0)+Math.max(0,Number(payment.monto||0)-Number(payment.refunded_amount||0)))}debt=finalized.map(row=>({...row,balance:Math.max(0,Number(row.precio_total||0)-(paid.get(Number(row.id))||0))})).filter(row=>row.balance>.009).map(row=>({id:row.id,code:row.numero_reserva||String(row.id),guest:row.nombre_huesped,currency:row.moneda||"ARS",balance:row.balance,departure_date:row.fecha_salida}))}
    const openCash=cashRes.data||[],blockerCount=pendingArrivals.length+pendingDepartures.length+openCash.length
    return{business_date:businessDate,timezone,cutoff_time:cutoff,already_closed:false,closure:null,ready:blockerCount===0,blocker_count:blockerCount,warning_count:debt.length,counts:{pending_arrivals:pendingArrivals.length,pending_departures:pendingDepartures.length,open_cash_sessions:openCash.length,closed_with_balance:debt.length},blockers:{pending_arrivals:pendingArrivals,pending_departures:pendingDepartures,open_cash_sessions:openCash},warnings:{closed_with_balance:debt},preview_fallback:true}
  },[propertyId])

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("");setNotice("")
    try{
      const rpc=await supabase.rpc("hl_night_audit_status",{p_property_id:propertyId,p_business_date:null})
      if(rpc.error){if(!isMissingBackend(rpc.error))throw rpc.error;setBackendReady(false);setStatus(await fallbackStatus());setHistory([]);return}
      setBackendReady(true);setStatus(rpc.data||null)
      const historyRes=await supabase.from("hotel_night_audit_closures").select("id,business_date,cutoff_time,timezone,closed_by,closed_at,note,snapshot").eq("property_id",propertyId).order("business_date",{ascending:false}).limit(10)
      if(historyRes.error&&!isMissingBackend(historyRes.error))throw historyRes.error
      setHistory(historyRes.data||[])
    }catch(err){setError(err?.message||"No se pudo preparar el cierre diario.")}
    finally{setLoading(false)}
  },[propertyId,fallbackStatus])
  useEffect(()=>{load()},[load])
  useEffect(()=>{if(!cutoffEditing&&status?.cutoff_time)setCutoffDraft(String(status.cutoff_time).slice(0,5))},[status?.cutoff_time,cutoffEditing])

  const blockers=status?.blockers||{},warnings=status?.warnings||{},counts=status?.counts||{},ready=Boolean(status?.ready),alreadyClosed=Boolean(status?.already_closed)
  const cards=useMemo(()=>[
    {id:"arrivals",label:"Llegadas pendientes",count:Number(counts.pending_arrivals||0),tone:Number(counts.pending_arrivals||0)?"bad":"ok",help:"Toda llegada vencida debe quedar con check-in, cancelada o resuelta como No Show.",items:blockers.pending_arrivals||[],action:"reservations"},
    {id:"departures",label:"Salidas pendientes",count:Number(counts.pending_departures||0),tone:Number(counts.pending_departures||0)?"bad":"ok",help:"Las estadías con salida vencida deben completar su check-out.",items:blockers.pending_departures||[],action:"reservations"},
    {id:"cash",label:"Caja abierta",count:Number(counts.open_cash_sessions||0),tone:Number(counts.open_cash_sessions||0)?"bad":"ok",help:"No se cierra el día mientras exista un turno de caja abierto.",items:blockers.open_cash_sessions||[],action:"dailycash"},
    {id:"debt",label:"Saldos post check-out",count:Number(counts.closed_with_balance||0),tone:Number(counts.closed_with_balance||0)?"warn":"ok",help:"Se informan como advertencia: la deuda queda registrada y nunca se cobra automáticamente.",items:warnings.closed_with_balance||[],action:"reservations"},
  ],[blockers,warnings,counts])

  function openItem(card,item){if(card.action==="dailycash")return onNavigate?.("dailycash");if(item?.id)return onNavigate?.("reservations",{reservationId:Number(item.id),restoreScroll:false});onNavigate?.(card.action)}
  async function saveCutoff(){
    if(!canManageCutoff||savingCutoff)return
    const value=String(cutoffDraft||"").slice(0,5)
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)){setError("Ingresá una hora de corte válida.");return}
    setSavingCutoff(true);setError("");setNotice("")
    try{
      const[settingsRes,userRes]=await Promise.all([supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),supabase.auth.getUser()])
      if(settingsRes.error)throw settingsRes.error
      const current=settingsRes.data?.settings||{},next={...current,preferences:{...(current.preferences||{}),business_day_cutoff:value}}
      const write=await supabase.from("property_settings").upsert({property_id:propertyId,settings:next,updated_at:new Date().toISOString(),updated_by:userRes.data?.user?.id||null},{onConflict:"property_id"})
      if(write.error)throw write.error
      if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:property-settings-updated",{detail:{propertyId,settings:next}}))
      setCutoffEditing(false);setNotice(`Corte del día operativo actualizado a ${value}.`);await load()
    }catch(err){setError(err?.message||"No se pudo guardar el horario de corte.")}
    finally{setSavingCutoff(false)}
  }
  async function closeDay(){
    if(closing||alreadyClosed||!ready)return
    if(!backendReady){setError("El cierre definitivo todavía no está habilitado para esta propiedad. Podés seguir revisando y resolviendo pendientes sin riesgo.");return}
    if(Number(status?.warning_count||0)>0&&!await pmsConfirm({title:"Cerrar día con pendientes",message:"Hay saldos pendientes de estadías ya finalizadas. El cierre no los elimina ni los cobra. ¿Cerrar el día igualmente?",confirmLabel:"Cerrar igualmente",tone:"warning"}))return
    setClosing(true);setError("");setNotice("")
    try{
      const result=await supabase.rpc("hl_close_business_day",{p_property_id:propertyId,p_business_date:status.business_date,p_note:note.trim()||null})
      if(result.error)throw result.error
      setNotice(result.data?.already_closed?"Ese día operativo ya estaba cerrado.":`Día ${fmtDate(status.business_date)} cerrado correctamente. El snapshot quedó guardado para auditoría.`);setNote("");await load()
    }catch(err){setError(err?.message||"No se pudo cerrar el día operativo.")}
    finally{setClosing(false)}
  }

  if(loading)return <div className={s.auditLoading}>Preparando cierre diario…</div>
  if(!status)return <div className={s.notice}>{error||"No se pudo obtener el estado del día operativo."}</div>
  return <div className={s.nightAudit}>
    {!backendReady?<div className={s.backendNotice}><b>Cierre en modo revisión</b><span>Podés revisar y resolver todos los pendientes del día. El cierre definitivo todavía no está habilitado para esta propiedad.</span></div>:null}
    {error?<div className={s.errorNotice}>{error}</div>:null}{notice?<div className={s.successNotice}>{notice}</div>:null}
    <section className={s.dayHero} data-state={alreadyClosed?"closed":ready?"ready":"blocked"}>
      <div><small>DÍA OPERATIVO</small><h2>{fmtDate(status.business_date)}</h2><div className={s.cutoffRow}><p>Corte {String(status.cutoff_time||"05:00").slice(0,5)} · {status.timezone||"America/Argentina/Buenos_Aires"}</p>{canManageCutoff&&!cutoffEditing?<button type="button" className={s.cutoffLink} onClick={()=>setCutoffEditing(true)}>Cambiar corte</button>:null}</div>{canManageCutoff&&cutoffEditing?<div className={s.cutoffEditor}><input type="time" value={cutoffDraft} onChange={event=>setCutoffDraft(event.target.value)} disabled={savingCutoff}/><button type="button" onClick={saveCutoff} disabled={savingCutoff}>{savingCutoff?"Guardando…":"Guardar"}</button><button type="button" className={s.cutoffCancel} onClick={()=>{setCutoffEditing(false);setCutoffDraft(String(status.cutoff_time||"05:00").slice(0,5))}} disabled={savingCutoff}>Cancelar</button></div>:null}</div>
      <div className={s.dayState}><i/><div><b>{alreadyClosed?"Día cerrado":ready?"Listo para cerrar":`${status.blocker_count||0} pendiente${Number(status.blocker_count||0)===1?"":"s"} obligatorio${Number(status.blocker_count||0)===1?"":"s"}`}</b><span>{alreadyClosed?`Cerrado ${fmtDateTime(status.closure?.closed_at)}`:ready?"No hay bloqueos operativos.":"Resolvé los puntos rojos antes de cerrar."}</span></div></div>
    </section>
    <div className={s.auditGrid}>{cards.map(card=><article className={s.auditCard} data-tone={card.tone} key={card.id}><header><div><small>{card.tone==="warn"?"ADVERTENCIA":"CONTROL"}</small><h3>{card.label}</h3></div><strong>{card.count}</strong></header><p>{card.help}</p>{card.items.length?<div className={s.auditItems}>{card.items.slice(0,5).map((item,index)=><button type="button" key={item.id||`${card.id}-${index}`} onClick={()=>openItem(card,item)}><span><b>{item.code?`#${item.code}`:card.id==="cash"?`Caja desde ${fmtDateTime(item.opened_at)}`:"Pendiente"}</b><small>{item.guest||item.state||"Abrir detalle"}{item.balance?` · ${money(item.balance,item.currency)}`:""}</small></span><i>→</i></button>)}{card.items.length>5?<small className={s.moreItems}>+ {card.items.length-5} más</small>:null}</div>:<div className={s.auditOk}>Sin pendientes</div>}</article>)}</div>
    <section className={s.closePanel}><div><small>CIERRE</small><h3>{alreadyClosed?"Este día ya está sellado":!backendReady?"Cierre definitivo no habilitado":"Confirmar cierre diario"}</h3><p>{!backendReady?"Usá esta vista para revisar y resolver pendientes. Cuando el cierre definitivo esté habilitado, aparecerá aquí la acción de cierre.":"El cierre guarda fecha, usuario, hora, controles y advertencias. No genera cargos, facturas ni cambios de estado en reservas."}</p></div>{alreadyClosed?<div className={s.closedStamp}><b>Cerrado</b><span>{fmtDateTime(status.closure?.closed_at)}</span></div>:!backendReady?<div className={s.closedStamp}><b>Solo revisión</b><span>Sin cambios automáticos</span></div>:<div className={s.closeForm}><textarea rows="2" value={note} onChange={event=>setNote(event.target.value)} placeholder="Nota de turno opcional"/><button type="button" disabled={!ready||closing} onClick={closeDay}>{closing?"Cerrando…":ready?"Cerrar día operativo":"Resolver pendientes"}</button></div>}</section>
    {history.length?<section className={s.history}><div className={s.historyTitle}><small>HISTORIAL</small><h3>Últimos cierres</h3></div>{history.map(row=><article key={row.id}><div><b>{fmtDate(row.business_date)}</b><span>Corte {String(row.cutoff_time||"05:00").slice(0,5)}</span></div><time>{fmtDateTime(row.closed_at)}</time></article>)}</section>:null}
  </div>
}