"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./finance.module.css"
import a from"./paymentAutomation.module.css"

const REQUEST_OPEN=new Set(["draft","requested","pending","failed"])
const REQUEST_DONE=new Set(["approved","cancelled","expired"])
const GUARANTEE_ACTIVE=new Set(["available","card_saved","authorized","pending"])
const DEPOSIT_HELD=new Set(["held","pending"])
const INVALID_PAYMENT=new Set(["void","cancelado","anulado","cancelled","reembolsado"])
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)):"—"
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const localKey=value=>{const date=value?new Date(`${value}T12:00:00`):new Date();return Number.isNaN(date.getTime())?"":date.toLocaleDateString("en-CA")}
const statusLabel=value=>({draft:"Borrador",requested:"Enviada",pending:"Pendiente",approved:"Cobrada",failed:"Falló",expired:"Vencida",cancelled:"Cancelada",card_saved:"Tarjeta guardada",authorized:"Retenida",captured:"Capturada",released:"Liberada",available:"Disponible",held:"En depósito",applied:"Aplicado",refunded:"Devuelto"}[String(value||"").toLowerCase()]||String(value||"Sin estado"))
const statusTone=value=>["approved","captured","applied","released"].includes(String(value))?"ok":["failed","expired","cancelled"].includes(String(value))?"danger":["requested","pending","authorized","held","card_saved","available"].includes(String(value))?"warn":"neutral"

async function apiRequest(path,options={}){
  const{data,error}=await supabase.auth.getSession();if(error)throw error
  const token=data?.session?.access_token;if(!token)throw new Error("Tu sesión venció. Volvé a iniciar sesión.")
  const response=await fetch(path,{...options,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(options.headers||{})},cache:"no-store"})
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.error||"No se pudo completar la operación.")
  return payload
}

export default function PaymentAutomationPanel({propertyId}){
  const[requests,setRequests]=useState([]),[guarantees,setGuarantees]=useState([]),[deposits,setDeposits]=useState([]),[reservations,setReservations]=useState([]),[payments,setPayments]=useState([])
  const[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(""),[createOpen,setCreateOpen]=useState(false),[createdUrl,setCreatedUrl]=useState("")
  const[form,setForm]=useState({reservationId:"",amount:"",expiresHours:"72",message:""})

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[requestRes,guaranteeRes,depositRes,reservationRes,paymentRes]=await Promise.all([
        supabase.from("hotel_payment_requests").select("id,reserva_id,amount,currency,status,provider,init_point,sandbox_init_point,payer_email,expires_at,message,created_at,updated_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
        supabase.from("hotel_guarantees").select("id,reserva_id,status,card_brand,last_four,authorized_amount,captured_amount,currency,authorization_expires_at,updated_at,deleted_at").eq("property_id",propertyId).is("deleted_at",null).order("updated_at",{ascending:false}).limit(100),
        supabase.from("hotel_deposits").select("id,reserva_id,amount,currency,status,method,reference,held_at,applied_at,refunded_at,released_at,updated_at").eq("property_id",propertyId).order("held_at",{ascending:false}).limit(100),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,fecha_entrada,fecha_salida,estado,no_show,precio_total,moneda").eq("property_id",propertyId).order("fecha_entrada",{ascending:true}),
        supabase.from("pagos").select("id,reserva_id,monto,refunded_amount,estado,moneda,created_at").eq("property_id",propertyId),
      ])
      for(const result of[requestRes,guaranteeRes,depositRes,reservationRes,paymentRes])if(result.error)throw result.error
      setRequests(requestRes.data||[]);setGuarantees(guaranteeRes.data||[]);setDeposits(depositRes.data||[]);setReservations(reservationRes.data||[]);setPayments(paymentRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar el centro de automatización de cobros.")}
    finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{load()},[load])

  const reservationById=useMemo(()=>new Map(reservations.map(row=>[Number(row.id),row])),[reservations])
  const paidByReservation=useMemo(()=>{const map=new Map();for(const row of payments){if(INVALID_PAYMENT.has(String(row.estado||"").toLowerCase()))continue;const id=Number(row.reserva_id);map.set(id,(map.get(id)||0)+Math.max(0,Number(row.monto||0)-Number(row.refunded_amount||0)))}return map},[payments])
  const balanceFor=useCallback(row=>Math.max(0,Number(row?.precio_total||0)-(paidByReservation.get(Number(row?.id))||0)),[paidByReservation])
  const latestRequest=useMemo(()=>{const map=new Map();for(const row of requests)if(!map.has(Number(row.reserva_id)))map.set(Number(row.reserva_id),row);return map},[requests])
  const openRequests=useMemo(()=>requests.filter(row=>REQUEST_OPEN.has(String(row.status||"").toLowerCase())),[requests])
  const activeGuarantees=useMemo(()=>guarantees.filter(row=>GUARANTEE_ACTIVE.has(String(row.status||"").toLowerCase())),[guarantees])
  const heldDeposits=useMemo(()=>deposits.filter(row=>DEPOSIT_HELD.has(String(row.status||"").toLowerCase())),[deposits])
  const candidates=useMemo(()=>reservations.filter(row=>!row.no_show&&!["cancelada","cancelado","finalizada"].includes(String(row.estado||"").toLowerCase())&&balanceFor(row)>.01).sort((x,y)=>String(x.fecha_entrada).localeCompare(String(y.fecha_entrada))),[reservations,balanceFor])

  const attention=useMemo(()=>{
    const out=[],today=localKey(),now=Date.now()
    for(const req of requests){const state=String(req.status||"").toLowerCase(),reservation=reservationById.get(Number(req.reserva_id));if(["failed","expired"].includes(state))out.push({key:`req-${req.id}`,kind:"Cobro",tone:"danger",title:`${statusLabel(state)} · ${reservation?.nombre_huesped||`Reserva #${req.reserva_id}`}`,detail:`${money(req.amount,req.currency)} · ${reservation?.numero_reserva||"sin número"}`,reservationId:req.reserva_id,request:req})}
    for(const guarantee of guarantees){const state=String(guarantee.status||"").toLowerCase(),reservation=reservationById.get(Number(guarantee.reserva_id)),expires=guarantee.authorization_expires_at?new Date(guarantee.authorization_expires_at).getTime():0;if(state==="authorized"&&expires&&expires-now<48*3600000)out.push({key:`guar-${guarantee.id}`,kind:"Garantía",tone:"warn",title:`Retención por vencer · ${reservation?.nombre_huesped||`Reserva #${guarantee.reserva_id}`}`,detail:`${money(guarantee.authorized_amount,guarantee.currency)} · vence ${fmtDate(guarantee.authorization_expires_at)}`,reservationId:guarantee.reserva_id})}
    for(const deposit of deposits){const state=String(deposit.status||"").toLowerCase(),reservation=reservationById.get(Number(deposit.reserva_id)),rState=String(reservation?.estado||"").toLowerCase();if(DEPOSIT_HELD.has(state)&&(["finalizada","cancelada","cancelado"].includes(rState)||(reservation?.fecha_salida&&String(reservation.fecha_salida)<today)))out.push({key:`dep-${deposit.id}`,kind:"Depósito",tone:"warn",title:`Depósito todavía retenido · ${reservation?.nombre_huesped||`Reserva #${deposit.reserva_id}`}`,detail:`${money(deposit.amount,deposit.currency)} · ${reservation?.numero_reserva||"sin número"}`,reservationId:deposit.reserva_id})}
    for(const reservation of candidates){if(String(reservation.fecha_entrada||"")<today)continue;const days=Math.round((new Date(`${reservation.fecha_entrada}T12:00:00`).getTime()-new Date(`${today}T12:00:00`).getTime())/86400000);if(days<0||days>7)continue;const req=latestRequest.get(Number(reservation.id));if(req&&!REQUEST_DONE.has(String(req.status||"").toLowerCase()))continue;out.push({key:`bal-${reservation.id}`,kind:"Saldo",tone:"neutral",title:`Saldo antes de llegada · ${reservation.nombre_huesped}`,detail:`${money(balanceFor(reservation),reservation.moneda)} · llega ${reservation.fecha_entrada}`,reservationId:reservation.id,canRequest:String(reservation.moneda||"ARS").toUpperCase()==="ARS"})}
    return out.slice(0,12)
  },[requests,guarantees,deposits,reservationById,candidates,latestRequest,balanceFor])

  function openCreate(reservationId=""){
    const reservation=reservationId?reservationById.get(Number(reservationId)):null
    setCreatedUrl("");setError("");setNotice("")
    setForm({reservationId:reservation?String(reservation.id):"",amount:reservation?String(balanceFor(reservation).toFixed(2)):"",expiresHours:"72",message:""})
    setCreateOpen(true)
  }
  function chooseReservation(value){const reservation=reservationById.get(Number(value));setForm(current=>({...current,reservationId:value,amount:reservation?String(balanceFor(reservation).toFixed(2)):""}))}
  async function createRequest(){
    const reservation=reservationById.get(Number(form.reservationId)),amount=Number(form.amount)
    if(!reservation)return setError("Elegí una reserva.")
    if(String(reservation.moneda||"ARS").toUpperCase()!=="ARS")return setError("Este flujo de Mercado Pago emite links en ARS. Las reservas en otra moneda siguen por cobro manual o conversión controlada.")
    if(!(amount>0))return setError("Ingresá un importe mayor a cero.")
    setBusy("create");setError("");setNotice("")
    try{
      const result=await apiRequest("/api/hotel/mercadopago/payment-request",{method:"POST",body:JSON.stringify({property_id:propertyId,reservation_id:Number(form.reservationId),amount,currency:"ARS",expires_hours:Number(form.expiresHours)||72,message:form.message.trim()})})
      setCreatedUrl(result.checkout_url||"");setNotice("Solicitud creada. El link quedó vinculado a la reserva y listo para compartir.");await load()
    }catch(err){setError(err?.message||"No se pudo crear la solicitud de cobro.")}
    finally{setBusy("")}
  }
  async function verify(row){setBusy(`verify-${row.id}`);setError("");setNotice("");try{const result=await apiRequest("/api/hotel/mercadopago/payment-request",{method:"PATCH",body:JSON.stringify({property_id:propertyId,request_id:row.id,action:"verify"})});setNotice(result.approved?"Mercado Pago confirmó el cobro y quedó conciliado en la reserva.":`Verificación completada: ${statusLabel(result.request?.status||row.status)}.`);await load()}catch(err){setError(err?.message||"No se pudo verificar el cobro.")}finally{setBusy("")}}
  async function copyLink(rowOrUrl){const value=typeof rowOrUrl==="string"?rowOrUrl:rowOrUrl?.init_point||rowOrUrl?.sandbox_init_point||"";if(!value)return;try{await navigator.clipboard.writeText(value);setNotice("Link de cobro copiado.")}catch{setError("No se pudo copiar el link desde este navegador.")}}

  if(loading)return <div className={s.empty}>Preparando automatización de cobros…</div>
  return <div className={s.financeBody}>
    {error?<div className={s.alert} style={{color:"var(--red)"}}>{error}</div>:null}{notice?<div className={s.alert} style={{color:"var(--green)"}}>{notice}</div>:null}
    <div className={a.metrics}><article><small>Solicitudes activas</small><b>{openRequests.length}</b><span>links pendientes de resolución</span></article><article><small>Garantías activas</small><b>{activeGuarantees.length}</b><span>tarjetas o retenciones vigentes</span></article><article><small>Depósitos retenidos</small><b>{heldDeposits.length}</b><span>pendientes de aplicar o liberar</span></article><article data-tone={attention.length?"warn":"ok"}><small>Requieren atención</small><b>{attention.length}</b><span>excepciones detectadas</span></article></div>

    <article className={s.glass}><header><div><small>PAYMENTS AUTOMATION</small><h2>Centro de automatización de cobros</h2><p>Unificamos solicitudes, garantías, depósitos y conciliación sin ejecutar cargos silenciosos. El dinero sigue bajo control humano mientras se completan las reglas automáticas.</p></div><button type="button" className={s.primary} onClick={()=>openCreate()}>＋ Solicitud de cobro</button></header><div className={a.flow}><span>Política</span><i>›</i><span>Solicitud / garantía</span><i>›</i><span>Proveedor</span><i>›</i><span>Pago</span><i>›</i><span>Conciliación</span></div><div className={a.capabilities}><div><b>Ya operativo</b><p>Links Mercado Pago, verificación, conciliación, tarjeta de garantía, retención/captura/liberación y depósitos registrados.</p></div><div><b>Siguiente corte</b><p>Reglas programadas, reintentos, penalidades automáticas y devoluciones guiadas con límites y auditoría.</p></div></div></article>

    <article className={s.glass}><header><div><small>EXCEPCIONES</small><h2>Qué necesita intervención</h2><p>Primero muestra fallos y vencimientos; después saldos próximos a la llegada.</p></div><button type="button" onClick={load} className={a.ghost}>Actualizar</button></header>{!attention.length?<div className={a.emptyGood}>✓ No hay excepciones financieras prioritarias con los datos actuales.</div>:<div className={a.attentionList}>{attention.map(item=><div key={item.key} className={a.attentionRow} data-tone={item.tone}><span className={a.dot}/><div><small>{item.kind}</small><b>{item.title}</b><p>{item.detail}</p></div><div className={a.rowActions}>{item.request&&["requested","pending","failed"].includes(String(item.request.status||"").toLowerCase())?<button type="button" disabled={busy===`verify-${item.request.id}`} onClick={()=>verify(item.request)}>{busy===`verify-${item.request.id}`?"Verificando…":"Verificar"}</button>:null}{item.canRequest?<button type="button" onClick={()=>openCreate(item.reservationId)}>Crear link</button>:null}</div></div>)}</div>}</article>

    <div className={a.twoCols}><article className={s.glass}><header><div><small>COBROS</small><h2>Solicitudes recientes</h2><p>{requests.length} registradas</p></div></header>{!requests.length?<div className={s.empty}>Todavía no hay solicitudes de cobro.</div>:<div className={a.itemList}>{requests.slice(0,10).map(row=>{const reservation=reservationById.get(Number(row.reserva_id)),link=row.init_point||row.sandbox_init_point;return <div key={row.id} className={a.item}><div><b>{reservation?.nombre_huesped||`Reserva #${row.reserva_id}`}</b><small>{reservation?.numero_reserva||"Sin número"} · {money(row.amount,row.currency)} · {fmtDate(row.created_at)}</small></div><span className={a.pill} data-tone={statusTone(row.status)}>{statusLabel(row.status)}</span><div className={a.inlineActions}>{["requested","pending","failed"].includes(String(row.status||"").toLowerCase())?<button type="button" disabled={busy===`verify-${row.id}`} onClick={()=>verify(row)}>Verificar</button>:null}{link?<button type="button" onClick={()=>copyLink(row)}>Copiar link</button>:null}</div></div>})}</div>}</article>

      <article className={s.glass}><header><div><small>GARANTÍAS Y DEPÓSITOS</small><h2>Respaldo de la reserva</h2><p>Estado financiero previo al cobro definitivo.</p></div></header><div className={a.stack}><section><div className={a.subhead}><b>Garantías</b><span>{guarantees.length}</span></div>{guarantees.slice(0,6).map(row=>{const reservation=reservationById.get(Number(row.reserva_id));return <div className={a.miniRow} key={row.id}><span><b>{reservation?.nombre_huesped||`Reserva #${row.reserva_id}`}</b><small>{row.card_brand?`${row.card_brand} •••• ${row.last_four||""}`:"Sin tarjeta visible"}{row.authorization_expires_at?` · vence ${fmtDate(row.authorization_expires_at)}`:""}</small></span><em data-tone={statusTone(row.status)}>{statusLabel(row.status)}</em></div>})}{!guarantees.length?<p className={a.muted}>Sin garantías registradas.</p>:null}</section><section><div className={a.subhead}><b>Depósitos</b><span>{deposits.length}</span></div>{deposits.slice(0,6).map(row=>{const reservation=reservationById.get(Number(row.reserva_id));return <div className={a.miniRow} key={row.id}><span><b>{reservation?.nombre_huesped||`Reserva #${row.reserva_id}`}</b><small>{money(row.amount,row.currency)} · {row.method||"Depósito"}</small></span><em data-tone={statusTone(row.status)}>{statusLabel(row.status)}</em></div>})}{!deposits.length?<p className={a.muted}>Sin depósitos registrados.</p>:null}</section></div></article></div>

    {createOpen?<div className={s.modalBackdrop} onMouseDown={event=>event.target===event.currentTarget&&!busy&&setCreateOpen(false)}><section className={s.modal} role="dialog" aria-modal="true" aria-label="Crear solicitud de cobro"><button type="button" className={s.modalClose} onClick={()=>setCreateOpen(false)}>×</button><small>SOLICITUD DE COBRO</small><h2>Generar link de pago</h2><div className={s.formGrid}><label className={s.full}><span>Reserva</span><select value={form.reservationId} onChange={e=>chooseReservation(e.target.value)}><option value="">Elegir reserva con saldo</option>{candidates.map(row=><option key={row.id} value={row.id}>{row.nombre_huesped} · {row.numero_reserva||row.id} · {money(balanceFor(row),row.moneda)}</option>)}</select></label><label><span>Importe</span><input type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm(v=>({...v,amount:e.target.value}))}/></label><label><span>Vigencia</span><select value={form.expiresHours} onChange={e=>setForm(v=>({...v,expiresHours:e.target.value}))}><option value="24">24 horas</option><option value="48">48 horas</option><option value="72">72 horas</option><option value="168">7 días</option></select></label><label className={s.full}><span>Mensaje / referencia opcional</span><textarea rows="3" value={form.message} onChange={e=>setForm(v=>({...v,message:e.target.value}))}/></label></div>{createdUrl?<div className={a.createdLink}><b>Link generado</b><span>{createdUrl}</span><button type="button" onClick={()=>copyLink(createdUrl)}>Copiar</button></div>:null}<footer className={a.modalFooter}><button type="button" className={a.ghost} onClick={()=>setCreateOpen(false)}>Cerrar</button><button type="button" className={s.primary} disabled={busy==="create"||!form.reservationId||!form.amount} onClick={createRequest}>{busy==="create"?"Generando…":"Generar link"}</button></footer></section></div>:null}
  </div>
}
