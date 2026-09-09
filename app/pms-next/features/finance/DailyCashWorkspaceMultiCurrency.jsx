"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"
import DailyCashActions from"./DailyCashActions"
import s from"./dailyCash.module.css"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value)||0)
const dual=(ars,usd)=>`${money(ars,"ARS")}${Math.abs(Number(usd)||0)>.009?` · ${money(usd,"USD")}`:""}`
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
const fmtTime=value=>value?new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"—"
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)):"—"
const normalize=value=>String(value||"").trim().toLowerCase()
const currency=value=>String(value||"ARS").toUpperCase()==="USD"?"USD":"ARS"
const isVoid=row=>["anulado","cancelado","void","rechazado","cancelled"].includes(normalize(row?.estado))
const isPaymentMirror=row=>normalize(row?.reference).startsWith("pago:")
const round=value=>Math.round((Number(value)||0)*100)/100
function methodGroup(value){const key=normalize(value);if(key.includes("efect")||key==="cash")return"cash";if(key.includes("transfer"))return"transfer";if(key.includes("mercado")||key==="mp"||key.includes("billetera")||key.includes("qr"))return"mp";if(key.includes("tarjet")||key.includes("card")||key.includes("debito")||key.includes("débito")||key.includes("credito")||key.includes("crédito"))return"card";return"other"}
const methodLabel=value=>{const group=methodGroup(value);return group==="cash"?"Efectivo":group==="transfer"?"Transferencias":group==="mp"?"Mercado Pago / QR":group==="card"?"Tarjetas":String(value||"Otros")}
function dateBounds(value){const start=new Date(`${value}T00:00:00`),end=new Date(start);end.setDate(end.getDate()+1);return[start.toISOString(),end.toISOString()]}
function blankPair(){return{ARS:0,USD:0}}
function physicalPayment(row){const accountingGross=Math.max(0,Number(row.monto||0)),accountingNet=Math.max(0,accountingGross-Number(row.refunded_amount||0)),ratio=accountingGross>0?Math.min(1,accountingNet/accountingGross):0,gross=Math.max(0,Number(row.payment_amount??row.monto)||0);return{amount:round(gross*ratio),currency:currency(row.payment_currency||row.moneda)}}

export default function DailyCashWorkspaceMultiCurrency({propertyId,property,onNavigate,focusReservationId,onFocusHandled}){
  const[day,setDay]=useState(()=>dateKey(new Date()))
  const[payments,setPayments]=useState([]),[manual,setManual]=useState([]),[documents,setDocuments]=useState([]),[reservations,setReservations]=useState(new Map()),[profiles,setProfiles]=useState(new Map()),[session,setSession]=useState(null),[sessionLedger,setSessionLedger]=useState({payments:[],movements:[]})
  const[loading,setLoading]=useState(true),[error,setError]=useState(""),[tab,setTab]=useState("movements")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[start,end]=dateBounds(day)
      const[paymentRes,movementRes,documentRes,sessionRes]=await Promise.all([
        supabase.from("pagos").select("id,reserva_id,monto,metodo,created_at,moneda,payment_currency,payment_amount,fx_rate,fx_source,fx_as_of,estado,source,provider,referencia,external_ref,refunded_amount,created_by,nota").eq("property_id",propertyId).gte("created_at",start).lt("created_at",end).order("created_at",{ascending:false}),
        supabase.from("hotel_cash_movements").select("id,reservation_id,movement_type,method,amount,currency,concept,reference,created_by,created_at,session_id").eq("property_id",propertyId).gte("created_at",start).lt("created_at",end).order("created_at",{ascending:false}),
        supabase.from("hotel_finance_documents").select("id,reservation_id,document_type,number,status,currency,total,balance,issued_at,created_at,created_by").eq("property_id",propertyId).gte("created_at",start).lt("created_at",end).order("created_at",{ascending:false}),
        supabase.from("hotel_cash_sessions").select("id,opened_by,closed_by,opened_at,closed_at,opening_amount,opening_amount_usd,closing_amount,closing_amount_usd,expected_amount,expected_amount_usd,status,notes").eq("property_id",propertyId).eq("status","open").order("opened_at",{ascending:false}).limit(1),
      ])
      for(const result of[paymentRes,movementRes,documentRes,sessionRes])if(result.error)throw result.error
      const pay=paymentRes.data||[],mov=movementRes.data||[],docs=documentRes.data||[],active=sessionRes.data?.[0]||null
      setPayments(pay);setManual(mov);setDocuments(docs);setSession(active)

      let ledgerPayments=[],ledgerMovements=[]
      if(active){const[ledgerPaymentRes,ledgerMovementRes]=await Promise.all([
        supabase.from("pagos").select("id,monto,metodo,moneda,payment_currency,payment_amount,estado,refunded_amount,created_at").eq("property_id",propertyId).gte("created_at",active.opened_at),
        supabase.from("hotel_cash_movements").select("id,movement_type,method,amount,currency,reference,created_at").eq("property_id",propertyId).eq("session_id",active.id),
      ]);if(ledgerPaymentRes.error)throw ledgerPaymentRes.error;if(ledgerMovementRes.error)throw ledgerMovementRes.error;ledgerPayments=ledgerPaymentRes.data||[];ledgerMovements=ledgerMovementRes.data||[]}
      setSessionLedger({payments:ledgerPayments,movements:ledgerMovements})

      const reservationIds=[...new Set([...pay.map(row=>row.reserva_id),...mov.map(row=>row.reservation_id),...docs.map(row=>row.reservation_id)].filter(Boolean).map(Number))],profileIds=[...new Set([...pay.map(row=>row.created_by),...mov.map(row=>row.created_by),...docs.map(row=>row.created_by),active?.opened_by].filter(Boolean))]
      const[reservationRes,profileRes]=await Promise.all([reservationIds.length?supabase.from("reservas").select("id,numero_reserva,nombre_huesped,habitacion_id").eq("property_id",propertyId).in("id",reservationIds):Promise.resolve({data:[],error:null}),profileIds.length?supabase.from("profiles").select("id,full_name").in("id",profileIds):Promise.resolve({data:[],error:null})])
      if(reservationRes.error)throw reservationRes.error;if(profileRes.error)throw profileRes.error
      setReservations(new Map((reservationRes.data||[]).map(row=>[Number(row.id),row])));setProfiles(new Map((profileRes.data||[]).map(row=>[row.id,row])))
    }catch(err){setError(err?.message||"No se pudo cargar la caja diaria.")}finally{setLoading(false)}
  },[propertyId,day])
  useEffect(()=>{load()},[load])
  usePmsAutoRefresh(propertyId,load,["reservas","pagos","hotel_cash_movements","hotel_finance_documents","hotel_cash_sessions"])

  const validPayments=useMemo(()=>payments.filter(row=>!isVoid(row)),[payments]),manualOnly=useMemo(()=>manual.filter(row=>!isPaymentMirror(row)),[manual])
  const totals=useMemo(()=>{
    const byMethod={cash:blankPair(),transfer:blankPair(),mp:blankPair(),card:blankPair(),other:blankPair()},income=blankPair(),expense=blankPair()
    for(const row of validPayments){const actual=physicalPayment(row);income[actual.currency]+=actual.amount;byMethod[methodGroup(row.metodo)][actual.currency]+=actual.amount}
    for(const row of manualOnly){const code=currency(row.currency),amount=Number(row.amount||0),out=["expense","refund"].includes(normalize(row.movement_type)),group=methodGroup(row.method);if(out)expense[code]+=amount;else income[code]+=amount;byMethod[group][code]+=out?-amount:amount}
    return{byMethod,income,expense,net:{ARS:round(income.ARS-expense.ARS),USD:round(income.USD-expense.USD)}}
  },[validPayments,manualOnly])
  const sessionCash=useMemo(()=>{
    if(!session)return null
    const income=blankPair(),expense=blankPair()
    for(const row of sessionLedger.payments){if(isVoid(row)||methodGroup(row.metodo)!=="cash")continue;const actual=physicalPayment(row);income[actual.currency]+=actual.amount}
    for(const row of sessionLedger.movements){if(isPaymentMirror(row)||methodGroup(row.method)!=="cash")continue;const code=currency(row.currency),amount=Number(row.amount||0);if(["expense","refund"].includes(normalize(row.movement_type)))expense[code]+=amount;else income[code]+=amount}
    return{income,expense,expected:{ARS:round(Number(session.opening_amount||0)+income.ARS-expense.ARS),USD:round(Number(session.opening_amount_usd||0)+income.USD-expense.USD)}}
  },[session,sessionLedger])
  const movements=useMemo(()=>{
    const paymentRows=validPayments.map(row=>{const actual=physicalPayment(row),cross=currency(row.payment_currency||row.moneda)!==currency(row.moneda);return{key:`p-${row.id}`,created_at:row.created_at,reservation_id:row.reserva_id,concept:row.nota||"Pago de reserva",method:row.metodo,amount:actual.amount,currency:actual.currency,direction:"in",created_by:row.created_by,reference:row.referencia||row.external_ref||"",source:cross?`Reserva · aplica ${money(Math.max(0,Number(row.monto||0)-Number(row.refunded_amount||0)),currency(row.moneda))}`:"Reserva"}})
    const manualRows=manualOnly.map(row=>({key:`m-${row.id}`,created_at:row.created_at,reservation_id:row.reservation_id,concept:row.concept||"Movimiento de caja",method:row.method,amount:Number(row.amount||0),currency:currency(row.currency),direction:["expense","refund"].includes(normalize(row.movement_type))?"out":"in",created_by:row.created_by,reference:row.reference||"",source:"Caja"}))
    return[...paymentRows,...manualRows].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
  },[validPayments,manualOnly])
  const isToday=day===dateKey(new Date())

  function openReservation(id){if(!id)return;onNavigate?.("reservations",{reservationId:Number(id),restoreScroll:false})}
  function handleCashChanged(){const today=dateKey(new Date());if(day!==today)setDay(today);else load()}

  return <section className={s.page}>
    <header className={s.header}><div><small>OPERACIÓN · RECEPCIÓN</small><h1>Caja diaria</h1><p>{property?.name||"Propiedad activa"} · ARS y USD separados, sin mezclar monedas en saldos ni arqueos.</p></div><div className={s.headerActions}><input type="date" value={day} onChange={event=>setDay(event.target.value)}/>{!isToday?<button type="button" onClick={()=>setDay(dateKey(new Date()))}>Hoy</button>:null}<button type="button" onClick={load}>↻ Actualizar</button><DailyCashActions propertyId={propertyId} session={session} expectedArs={sessionCash?.expected.ARS||0} expectedUsd={sessionCash?.expected.USD||0} focusReservationId={focusReservationId} onFocusHandled={onFocusHandled} onChanged={handleCashChanged}/></div></header>
    {error?<div className={s.alert}>{error}</div>:null}
    <div className={s.summary}>
      <article><span>Ingresos</span><b>{dual(totals.income.ARS,totals.income.USD)}</b><small>{validPayments.length} pago{validPayments.length===1?"":"s"} de reservas</small></article>
      <article><span>Egresos</span><b>{dual(totals.expense.ARS,totals.expense.USD)}</b><small>Movimientos manuales por moneda</small></article>
      <article><span>Neto del día</span><b>{dual(totals.net.ARS,totals.net.USD)}</b><small>ARS y USD no se compensan entre sí</small></article>
      <article className={session?s.open:s.closed}><span>{session?"Efectivo esperado":"Turno de caja"}</span><b>{session?dual(sessionCash?.expected.ARS||0,sessionCash?.expected.USD||0):"Cerrado"}</b><small>{session?`Desde apertura · ARS ${money(sessionCash?.income.ARS||0,"ARS")} · USD ${money(sessionCash?.income.USD||0,"USD")}`:"Abrí una caja para controlar efectivo"}</small></article>
    </div>
    <div className={s.layout}>
      <aside className={s.accounts}><div className={s.accountTitle}><small>SALDOS DEL DÍA</small><h2>Cuentas</h2></div><div className={s.cashAccount}><span className={s.accountIcon}>$</span><div><small>Efectivo</small><b>{dual(totals.byMethod.cash.ARS,totals.byMethod.cash.USD)}</b></div></div>{[["transfer","Transferencias","⇄"],["mp","Mercado Pago / QR","MP"],["card","Tarjetas","▣"],["other","Otros","＋"]].map(([key,label,icon])=><div className={s.account} key={key}><span className={s.accountIcon}>{icon}</span><div><small>{label}</small><b>{dual(totals.byMethod[key].ARS,totals.byMethod[key].USD)}</b></div></div>)}{session?<div className={s.sessionBox}><span>Turno abierto</span><b>{profiles.get(session.opened_by)?.full_name||"Usuario"}</b><small>Desde {fmtDateTime(session.opened_at)} · apertura {dual(session.opening_amount,session.opening_amount_usd)}</small></div>:null}</aside>
      <main className={s.central}><nav className={s.tabs}><button type="button" className={tab==="movements"?s.active:""} onClick={()=>setTab("movements")}>Movimientos <span>{movements.length}</span></button><button type="button" className={tab==="documents"?s.active:""} onClick={()=>setTab("documents")}>Facturación <span>{documents.length}</span></button></nav>
      {loading?<div className={s.empty}>Cargando caja diaria…</div>:tab==="movements"?<div className={s.table}><div className={s.head}><span>Hora</span><span>Cuenta / concepto</span><span>Reserva / pasajero</span><span>Usuario</span><span>Ingreso</span><span>Egreso</span></div>{movements.length?movements.map(row=>{const reservation=reservations.get(Number(row.reservation_id)),profile=profiles.get(row.created_by);return <div className={s.row} key={row.key}><span>{fmtTime(row.created_at)}</span><div><b>{methodLabel(row.method)}</b><small>{row.concept}{row.reference?` · ${row.reference}`:""}{row.source!=="Reserva"&&row.source!=="Caja"?` · ${row.source}`:""}</small></div><button type="button" className={s.reservationLink} disabled={!reservation} onClick={()=>openReservation(row.reservation_id)}><b>{reservation?.numero_reserva||"Sin reserva"}</b><small>{reservation?.nombre_huesped||row.source}</small></button><span>{profile?.full_name||"Sistema"}</span><strong className={s.in}>{row.direction==="in"?money(row.amount,row.currency):"—"}</strong><strong className={s.out}>{row.direction==="out"?money(row.amount,row.currency):"—"}</strong></div>}):<div className={s.empty}>No hay movimientos registrados para esta fecha.</div>}</div>:<div className={s.table}><div className={`${s.head} ${s.docHead}`}><span>Estado</span><span>Fecha</span><span>Tipo / número</span><span>Reserva</span><span>Total</span></div>{documents.length?documents.map(row=>{const reservation=reservations.get(Number(row.reservation_id));return <div className={`${s.row} ${s.docRow}`} key={row.id}><span className={s.docStatus}>{row.status||"nuevo"}</span><span>{fmtTime(row.issued_at||row.created_at)}</span><div><b>{row.document_type||"Comprobante"}</b><small>{row.number||"Sin número"}</small></div><button type="button" className={s.reservationLink} disabled={!reservation} onClick={()=>openReservation(row.reservation_id)}><b>{reservation?.numero_reserva||"Sin reserva"}</b><small>{reservation?.nombre_huesped||"—"}</small></button><strong>{money(row.total,currency(row.currency||"ARS"))}</strong></div>}):<div className={s.empty}>No hay comprobantes creados para esta fecha.</div>}</div>}</main>
    </div>
  </section>
}
