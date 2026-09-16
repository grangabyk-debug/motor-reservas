"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./finance.module.css"

const PAGE=50
const REFUND_ROLES=new Set(["owner","admin","manager","reception","night_audit"])
const EXTERNAL_SOURCES=new Set(["mercadopago","online","payment_request","booking_engine","ota","channex"])
function money(value,currency="ARS"){return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value||0))}
function csvCell(value){const text=String(value??"").replaceAll('"','""');return `"${text}"`}
const isVoid=row=>["anulado","cancelado","void","rechazado","cancelled"].includes(String(row?.estado||"").toLowerCase())
const refundable=row=>Math.max(0,Number(row?.monto||0)-Number(row?.refunded_amount||0))
const externalPayment=row=>Boolean(String(row?.provider||"").trim()||String(row?.external_ref||"").trim()||EXTERNAL_SOURCES.has(String(row?.source||"").trim().toLowerCase()))

export default function PaymentsPanel({propertyId,property}){
  const[rows,setRows]=useState([])
  const[reservations,setReservations]=useState(new Map())
  const[profiles,setProfiles]=useState(new Map())
  const[page,setPage]=useState(0)
  const[count,setCount]=useState(0)
  const[method,setMethod]=useState("all")
  const[from,setFrom]=useState("")
  const[to,setTo]=useState("")
  const[query,setQuery]=useState("")
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")
  const[notice,setNotice]=useState("")
  const[refundAvailable,setRefundAvailable]=useState(false)
  const[refundTarget,setRefundTarget]=useState(null)
  const[refundAmount,setRefundAmount]=useState("")
  const[refundReason,setRefundReason]=useState("")
  const[externalConfirmed,setExternalConfirmed]=useState(false)
  const[refunding,setRefunding]=useState(false)
  const canRefund=REFUND_ROLES.has(property?.role)

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      let request=supabase.from("pagos").select("id,reserva_id,monto,metodo,created_at,moneda,estado,source,provider,referencia,external_ref,refunded_amount,created_by",{count:"exact"}).eq("property_id",propertyId).order("created_at",{ascending:false}).range(page*PAGE,page*PAGE+PAGE-1)
      if(method!=="all")request=request.eq("metodo",method)
      if(from)request=request.gte("created_at",`${from}T00:00:00`)
      if(to)request=request.lte("created_at",`${to}T23:59:59`)
      const result=await request;if(result.error)throw result.error
      const data=result.data||[];setRows(data);setCount(result.count||0)
      const reservationIds=[...new Set(data.map(row=>row.reserva_id).filter(Boolean))]
      const profileIds=[...new Set(data.map(row=>row.created_by).filter(Boolean))]
      const[resResult,profileResult]=await Promise.all([
        reservationIds.length?supabase.from("reservas").select("id,nombre_huesped,numero_reserva,habitacion_id").eq("property_id",propertyId).in("id",reservationIds):Promise.resolve({data:[],error:null}),
        profileIds.length?supabase.from("profiles").select("id,full_name").in("id",profileIds):Promise.resolve({data:[],error:null}),
      ])
      if(resResult.error)throw resResult.error;if(profileResult.error)throw profileResult.error
      setReservations(new Map((resResult.data||[]).map(row=>[row.id,row])));setProfiles(new Map((profileResult.data||[]).map(row=>[row.id,row])))
    }catch(err){setError(err?.message||"No se pudieron cargar los pagos.")}
    finally{setLoading(false)}
  },[propertyId,page,method,from,to])
  useEffect(()=>{load()},[load])
  useEffect(()=>{
    if(!canRefund){setRefundAvailable(false);return}
    let alive=true
    ;(async()=>{
      const{error:probeError}=await supabase.rpc("hl_refund_payment_atomic",{p_payment_id:0,p_amount:1,p_reason:"capability_probe",p_external_refund_confirmed:false})
      if(!alive)return
      const code=String(probeError?.code||""),message=String(probeError?.message||"").toLowerCase(),missing=code==="PGRST202"||code==="42883"||message.includes("could not find the function")||message.includes("does not exist")
      setRefundAvailable(!missing)
    })()
    return()=>{alive=false}
  },[canRefund])

  const visible=useMemo(()=>rows.filter(row=>{if(!query)return true;const reservation=reservations.get(row.reserva_id);return `${reservation?.nombre_huesped||""} ${reservation?.numero_reserva||""} ${row.referencia||""} ${row.external_ref||""} ${row.metodo||""}`.toLowerCase().includes(query.toLowerCase())}),[rows,reservations,query])
  const methods=useMemo(()=>[...new Set(rows.map(row=>row.metodo).filter(Boolean))].sort(),[rows])

  function exportCsv(){
    const header=["Fecha","Reserva","Huésped","Registrado por","Monto original","Devuelto","Neto","Moneda","Método","Estado","Referencia"]
    const lines=visible.map(row=>{const reservation=reservations.get(row.reserva_id);return[row.created_at,reservation?.numero_reserva||row.reserva_id,reservation?.nombre_huesped||"",profiles.get(row.created_by)?.full_name||"",row.monto,row.refunded_amount||0,refundable(row),row.moneda,row.metodo,row.estado,row.referencia||row.external_ref||""]})
    const csv=[header,...lines].map(line=>line.map(csvCell).join(",")).join("\n");const blob=new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`pagos-${from||"inicio"}-${to||"hoy"}.csv`;a.click();URL.revokeObjectURL(url)
  }
  function openRefund(row){const remaining=refundable(row);if(!refundAvailable||remaining<=.009||isVoid(row))return;setRefundTarget(row);setRefundAmount(String(remaining));setRefundReason("");setExternalConfirmed(false);setError("");setNotice("")}
  async function submitRefund(){
    if(!refundTarget||refunding)return
    const amount=Number(refundAmount),remaining=refundable(refundTarget),external=externalPayment(refundTarget)
    if(!Number.isFinite(amount)||amount<=0||amount>remaining+.009){setError(`Ingresá un importe entre 0 y ${money(remaining,refundTarget.moneda||"ARS")}.`);return}
    if(!refundReason.trim()){setError("Indicá el motivo de la devolución.");return}
    if(external&&!externalConfirmed){setError("Confirmá que el dinero ya fue devuelto en el proveedor externo.");return}
    setRefunding(true);setError("");setNotice("")
    try{
      const{error:refundError}=await supabase.rpc("hl_refund_payment_atomic",{p_payment_id:Number(refundTarget.id),p_amount:amount,p_reason:refundReason.trim(),p_external_refund_confirmed:Boolean(externalConfirmed)})
      if(refundError)throw refundError
      setRefundTarget(null);setNotice(`Devolución registrada por ${money(amount,refundTarget.moneda||"ARS")}. El saldo y las asignaciones del folio fueron recalculados.`);await load()
      if(typeof window!=="undefined"){window.dispatchEvent(new CustomEvent("hl:pms-payment-updated",{detail:{reservationId:Number(refundTarget.reserva_id)}}));window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:["pagos","hotel_folio_payment_allocations","hotel_folio_item_payment_allocations","hotel_cash_movements"]}}))}
    }catch(err){setError(err?.message||"No se pudo registrar la devolución.")}
    finally{setRefunding(false)}
  }

  const refundGrid=refundAvailable?{gridTemplateColumns:"1fr 1.45fr .85fr 1.05fr .8fr .75fr .65fr"}:undefined
  return <div className={s.financeBody}>
    <div className={s.toolbar}><label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar huésped, reserva o referencia"/></label><select value={method} onChange={e=>{setMethod(e.target.value);setPage(0)}}><option value="all">Todos los métodos</option>{methods.map(item=><option value={item} key={item}>{item}</option>)}</select><input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(0)}}/><input type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(0)}}/><button onClick={exportCsv} disabled={!visible.length}>Exportar CSV</button></div>
    {error&&<div className={s.alert}>{error}</div>}{notice&&<div className={s.alert}>{notice}</div>}
    <article className={s.glass}><header><div><small>REGISTRO</small><h2>Pagos</h2><p>{count} resultado{count===1?"":"s"}</p></div></header>{loading?<div className={s.empty}>Cargando pagos…</div>:!visible.length?<div className={s.empty}>No hay pagos para los filtros seleccionados.</div>:<div className={s.paymentTable}><div className={s.paymentHead} style={refundGrid}><span>Fecha</span><span>Reserva / huésped</span><span>Registrado por</span><span>Monto</span><span>Método</span><span>Estado</span>{refundAvailable?<span>Acción</span>:null}</div>{visible.map(row=>{const reservation=reservations.get(row.reserva_id),remaining=refundable(row),refunded=Math.max(0,Number(row.refunded_amount||0));return <div className={s.paymentRow} style={refundGrid} key={row.id}><span>{new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(new Date(row.created_at))}</span><div><b>{reservation?.nombre_huesped||`Reserva #${row.reserva_id}`}</b><small>{reservation?.numero_reserva||row.referencia||"Sin referencia"}</small></div><span>{profiles.get(row.created_by)?.full_name||"—"}</span><div><b>{money(remaining,row.moneda||"ARS")}</b>{refunded>.009?<small>Original {money(row.monto,row.moneda||"ARS")} · devuelto {money(refunded,row.moneda||"ARS")}</small>:null}</div><span>{row.metodo}</span><span className={s.status}>{remaining<=.009&&refunded>.009?"Reembolsado":row.estado}</span>{refundAvailable?<button type="button" disabled={remaining<=.009||isVoid(row)} onClick={()=>openRefund(row)} style={{minHeight:34,border:"1px solid color-mix(in srgb,currentColor 11%,transparent)",borderRadius:10,background:"color-mix(in srgb,var(--panel,#fff) 78%,transparent)",color:"inherit",fontSize:10,fontWeight:800,cursor:remaining>.009&&!isVoid(row)?"pointer":"not-allowed",opacity:remaining>.009&&!isVoid(row)?1:.4}}>Devolver</button>:null}</div>})}</div>}
      <footer className={s.pagination}><button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>← Anterior</button><span>Página {page+1} de {Math.max(1,Math.ceil(count/PAGE))}</span><button onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PAGE>=count}>Siguiente →</button></footer>
    </article>
    {refundTarget?<div role="dialog" aria-modal="true" aria-label="Devolver pago" style={{position:"fixed",inset:0,zIndex:140,display:"grid",placeItems:"center",padding:18,background:"rgba(8,12,27,.4)",backdropFilter:"blur(8px)"}} onMouseDown={event=>event.target===event.currentTarget&&!refunding&&setRefundTarget(null)}><section style={{position:"relative",width:"min(560px,96vw)",padding:22,border:"1px solid rgba(255,255,255,.18)",borderRadius:22,background:"color-mix(in srgb,var(--panelSolid,#fff) 96%,transparent)",boxShadow:"0 28px 80px rgba(21,27,70,.24)"}}><button type="button" disabled={refunding} onClick={()=>setRefundTarget(null)} style={{position:"absolute",right:15,top:15,width:36,height:36,border:"1px solid color-mix(in srgb,currentColor 10%,transparent)",borderRadius:10,background:"var(--panelSolid)",color:"inherit",fontSize:19}}>×</button><small style={{display:"block",fontSize:10,fontWeight:850,letterSpacing:".1em",color:"var(--accent)"}}>DEVOLUCIÓN DE PAGO</small><h2 style={{margin:"5px 0 4px",fontSize:24}}>Registrar devolución</h2><p style={{margin:"0 0 16px",color:"var(--muted)",fontSize:11,lineHeight:1.5}}>Pago {refundTarget.metodo} · disponible {money(refundable(refundTarget),refundTarget.moneda||"ARS")}. La devolución recalcula el saldo y conserva el pago original.</p><div style={{display:"grid",gap:10}}><label style={{display:"grid",gap:5,fontSize:10,fontWeight:760,color:"var(--muted)"}}>Importe<input type="number" min="0.01" max={refundable(refundTarget)} step="0.01" value={refundAmount} onChange={e=>setRefundAmount(e.target.value)} style={{minHeight:41,border:"1px solid var(--line)",borderRadius:11,padding:"9px 10px",background:"var(--panelSolid)",color:"inherit",font: "inherit"}}/></label><label style={{display:"grid",gap:5,fontSize:10,fontWeight:760,color:"var(--muted)"}}>Motivo<textarea rows="3" value={refundReason} onChange={e=>setRefundReason(e.target.value)} placeholder="Ej. cancelación acordada con el huésped" style={{border:"1px solid var(--line)",borderRadius:11,padding:10,background:"var(--panelSolid)",color:"inherit",font:"inherit",resize:"vertical"}}/></label>{externalPayment(refundTarget)?<label style={{display:"flex",gap:9,alignItems:"flex-start",padding:11,border:"1px solid color-mix(in srgb,#d89b34 24%,var(--line))",borderRadius:11,background:"color-mix(in srgb,#d89b34 6%,var(--panelSolid))",fontSize:10,lineHeight:1.45}}><input type="checkbox" checked={externalConfirmed} onChange={e=>setExternalConfirmed(e.target.checked)} style={{marginTop:2}}/><span><b>Ya devolví el dinero en {refundTarget.provider||"el proveedor externo"}.</b><br/>Habitación Llena registra la devolución contable; no debe marcarse antes de confirmar el reembolso real en el proveedor.</span></label>:null}</div><footer style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16,paddingTop:13,borderTop:"1px solid var(--line)"}}><button type="button" disabled={refunding} onClick={()=>setRefundTarget(null)} style={{minHeight:39,border:"1px solid var(--line)",borderRadius:10,padding:"0 13px",background:"var(--panelSolid)",color:"inherit",fontWeight:800}}>Cancelar</button><button type="button" disabled={refunding||!(Number(refundAmount)>0)||!refundReason.trim()||(externalPayment(refundTarget)&&!externalConfirmed)} onClick={submitRefund} style={{minHeight:39,border:0,borderRadius:10,padding:"0 15px",background:"linear-gradient(145deg,#d95c74,#c94f69)",color:"#fff",fontWeight:850,opacity:refunding?.65:1}}>{refunding?"Registrando…":"Confirmar devolución"}</button></footer></section></div>:null}
  </div>
}
