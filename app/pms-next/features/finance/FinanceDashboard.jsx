"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"
import s from"./finance.module.css"

const POSITIVE_PAYMENT_STATES=new Set(["confirmado","confirmed","approved","paid","settled","completed","success","succeeded"])
const RECENT_STEP=5
const clean=value=>String(value||"").trim()
const currency=value=>clean(value||"ARS").toUpperCase()||"ARS"
function money(value,code="ARS"){try{return new Intl.NumberFormat("es-AR",{style:"currency",currency:currency(code),maximumFractionDigits:0}).format(Number(value)||0)}catch{return`${currency(code)} ${Math.round(Number(value)||0).toLocaleString("es-AR")}`}}
function keyParts(value){const[y,m,d]=String(value||"").slice(0,10).split("-").map(Number);return{y,m,d}}
function keyEpoch(value){const{y,m,d}=keyParts(value);return Date.UTC(y||1970,(m||1)-1,d||1)}
function daysBetween(start,end){return Math.max(0,Math.round((keyEpoch(end)-keyEpoch(start))/86400000))}
function addDaysKey(value,days){const date=new Date(keyEpoch(value)+days*86400000);return`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`}
function localKey(date=new Date()){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function periodStart(period){const now=new Date(),today=localKey(now);if(period==="today")return today;if(period==="7")return addDaysKey(today,-6);if(period==="month")return`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;return addDaysKey(today,-29)}
function overlapNights(start,end,rangeStart,rangeEnd){const from=Math.max(keyEpoch(start),keyEpoch(rangeStart)),to=Math.min(keyEpoch(end),keyEpoch(rangeEnd));return Math.max(0,Math.round((to-from)/86400000))}
function roomIds(row){return[...new Set([row?.habitacion_id,...(Array.isArray(row?.habitaciones_ids)?row.habitaciones_ids:[])].filter(Boolean).map(Number))]}
function segmentEnd(row,roomId,planned){const released=row?.room_checkout_dates?.[String(roomId)];return released&&String(released)<String(planned)?String(released):String(planned)}
function segmentsFor(row){
  const details=Array.isArray(row?.habitaciones_detalle)?row.habitaciones_detalle:[]
  const detailed=details.filter(detail=>detail?.habitacion_id).map(detail=>{const id=Number(detail.habitacion_id),start=String(detail.fecha_entrada||row.fecha_entrada),planned=String(detail.fecha_salida||row.fecha_salida);return{roomId:id,start,end:segmentEnd(row,id,planned)}}).filter(seg=>seg.start&&seg.end&&seg.end>seg.start)
  if(detailed.length)return detailed
  const ids=roomIds(row)
  if(ids.length)return ids.map(id=>({roomId:id,start:String(row.fecha_entrada),end:segmentEnd(row,id,row.fecha_salida)})).filter(seg=>seg.start&&seg.end&&seg.end>seg.start)
  return row?.fecha_entrada&&row?.fecha_salida&&row.fecha_salida>row.fecha_entrada?[{roomId:`unassigned-${row.id}`,start:String(row.fecha_entrada),end:String(row.fecha_salida)}]:[]
}
function groupedMoney(map){const entries=[...map.entries()].filter(([,value])=>Math.abs(Number(value)||0)>.009);return entries.length?entries.map(([code,value])=>money(value,code)).join(" · "):money(0,"ARS")}
function addCurrency(map,code,value){const key=currency(code);map.set(key,(map.get(key)||0)+(Number(value)||0))}
function formatDay(value){const{d,m}=keyParts(value);return`${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}`}

export default function FinanceDashboard({propertyId}){
  const[period,setPeriod]=useState("30")
  const[rooms,setRooms]=useState([])
  const[reservations,setReservations]=useState([])
  const[payments,setPayments]=useState([])
  const[baseCurrency,setBaseCurrency]=useState("ARS")
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")
  const[recentLimit,setRecentLimit]=useState(RECENT_STEP)

  const load=useCallback(async()=>{
    if(!propertyId)return
    const from=periodStart(period),today=localKey(),end=addDaysKey(today,1)
    setLoading(true);setError("")
    try{
      const[roomRes,resRes,payRes,settingsRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre").eq("property_id",propertyId).eq("activa",true),
        supabase.from("reservas").select("id,nombre_huesped,habitacion_id,habitaciones_ids,habitaciones_detalle,room_checkout_dates,fecha_entrada,fecha_salida,noches,precio_total,moneda,estado,canal_reserva,created_at").eq("property_id",propertyId).gt("fecha_salida",from).lt("fecha_entrada",end).neq("estado","cancelada").neq("estado","fusionada").eq("no_show",false).order("created_at",{ascending:false}),
        supabase.from("pagos").select("id,monto,moneda,estado,created_at,reserva_id,metodo,refunded_amount").eq("property_id",propertyId).gte("created_at",`${from}T00:00:00`).lt("created_at",`${end}T00:00:00`).order("created_at",{ascending:false}),
        supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      ])
      for(const result of[roomRes,resRes,payRes,settingsRes])if(result.error)throw result.error
      setRooms(roomRes.data||[]);setReservations(resRes.data||[]);setPayments(payRes.data||[]);setBaseCurrency(currency(settingsRes.data?.settings?.preferences?.currency||"ARS"))
    }catch(err){setError(err?.message||"No se pudo cargar el resumen financiero.")}
    finally{setLoading(false)}
  },[propertyId,period])
  useEffect(()=>{load()},[load])
  usePmsAutoRefresh(propertyId,load,["reservas","pagos","habitaciones","property_settings"])
  useEffect(()=>{setRecentLimit(RECENT_STEP)},[period,propertyId])

  const report=useMemo(()=>{
    const today=localKey(),from=periodStart(period),end=addDaysKey(today,1),days=Math.max(1,daysBetween(from,end)),availableRoomNights=rooms.length*days
    const bookedByCurrency=new Map(),collectedByCurrency=new Map(),daily=[]
    let roomNights=0,baseRoomNights=0,baseBookedValue=0
    for(const reservation of reservations){
      const segments=segmentsFor(reservation),fullNights=segments.reduce((sum,seg)=>sum+daysBetween(seg.start,seg.end),0),overlap=segments.reduce((sum,seg)=>sum+overlapNights(seg.start,seg.end,from,end),0)
      if(overlap<=0)continue
      roomNights+=overlap
      const prorated=fullNights>0?Number(reservation.precio_total||0)*(overlap/fullNights):0,code=currency(reservation.moneda)
      addCurrency(bookedByCurrency,code,prorated)
      if(code===baseCurrency){baseRoomNights+=overlap;baseBookedValue+=prorated}
    }
    for(const payment of payments){const state=clean(payment.estado).toLowerCase();if(!POSITIVE_PAYMENT_STATES.has(state))continue;const net=Math.max(0,Number(payment.monto||0)-Number(payment.refunded_amount||0));if(net>.009)addCurrency(collectedByCurrency,payment.moneda,net)}
    for(let i=0;i<days;i++){
      const day=addDaysKey(from,i),next=addDaysKey(day,1)
      let sold=0
      for(const reservation of reservations)for(const segment of segmentsFor(reservation))if(overlapNights(segment.start,segment.end,day,next)>0)sold++
      daily.push({day,sold,occupancy:rooms.length?sold/rooms.length*100:0})
    }
    let occupiedNow=0
    const tomorrow=addDaysKey(today,1)
    for(const reservation of reservations)for(const segment of segmentsFor(reservation))if(overlapNights(segment.start,segment.end,today,tomorrow)>0)occupiedNow++
    const arrivals=reservations.filter(row=>String(row.fecha_entrada)===today).length,departures=reservations.filter(row=>String(row.fecha_salida)===today).length
    const occupancy=availableRoomNights?roomNights/availableRoomNights*100:0,adr=baseRoomNights?baseBookedValue/baseRoomNights:0,revpar=availableRoomNights?baseBookedValue/availableRoomNights:0
    return{today,from,end,days,roomNights,occupiedNow,arrivals,departures,bookings:reservations.length,bookedByCurrency,collectedByCurrency,occupancy,adr,revpar,baseBookedValue,baseRoomNights,daily,hasForeign:[...bookedByCurrency.keys()].some(code=>code!==baseCurrency)}
  },[rooms,reservations,payments,period,baseCurrency])

  const recent=reservations.slice(0,recentLimit),hasMoreRecent=recentLimit<reservations.length,showingExpanded=recentLimit>RECENT_STEP
  if(loading)return <div className={s.empty}>Cargando indicadores financieros…</div>
  return <div className={s.financeBody}>
    <div className={s.periods}>{[["today","Hoy"],["7","7 días"],["30","30 días"],["month","Este mes"]].map(([id,label])=><button key={id} className={period===id?s.active:""} onClick={()=>setPeriod(id)}>{label}</button>)}</div>
    {error&&<div className={s.alert}>{error}</div>}
    <div className={s.heroMetrics}><article><span>Ocupación</span><b>{report.occupancy.toFixed(report.occupancy<10?1:0)}%</b><small>{report.roomNights} room-night{report.roomNights===1?"":"s"} / {rooms.length*report.days} disponibles</small></article><article><span>Cobrado</span><b style={{fontSize:report.collectedByCurrency.size>1?20:28}}>{groupedMoney(report.collectedByCurrency)}</b><small>Pagos confirmados, netos de devoluciones</small></article><article><span>Valor del período</span><b style={{fontSize:report.bookedByCurrency.size>1?20:28}}>{groupedMoney(report.bookedByCurrency)}</b><small>Prorrateado por noches dentro del período</small></article><article><span>Reservas</span><b>{report.bookings}</b><small>{report.arrivals} llegadas · {report.departures} salidas hoy</small></article></div>
    <div className={s.analyticsGrid}><article className={s.glass}><header><div><small>REVENUE REAL · {baseCurrency}</small><h2>Indicadores hoteleros</h2><p>ADR y RevPAR usan sólo reservas en {baseCurrency}; no mezclan monedas.</p></div></header><div className={s.kpis}><div><span>ADR · {baseCurrency}</span><b>{money(report.adr,baseCurrency)}</b></div><div><span>RevPAR · {baseCurrency}</span><b>{money(report.revpar,baseCurrency)}</b></div><div><span>Room-nights</span><b>{report.roomNights}</b></div><div><span>Inventario</span><b>{rooms.length}</b></div></div><div className={s.glowChart} style={{gap:report.daily.length>14?4:9,paddingLeft:report.daily.length>14?10:16,paddingRight:report.daily.length>14?10:16}} aria-label="Ocupación diaria real">{report.daily.map(point=><i key={point.day} title={`${formatDay(point.day)} · ${point.sold}/${rooms.length} habitaciones · ${point.occupancy.toFixed(0)}%`} style={{height:`${Math.max(4,Math.min(100,point.occupancy))}%`}}/>)}</div><small style={{display:"block",marginTop:7,color:"var(--muted)",fontSize:10.5}}>Ocupación diaria real · {formatDay(report.from)} → {formatDay(addDaysKey(report.end,-1))}{report.hasForeign?` · Hay reservas en otras monedas, visibles separadas arriba.`:""}</small></article><article className={s.glass}><header><div><small>HOY</small><h2>Snapshot operativo</h2></div></header><div className={s.snapshot}><div><span>→ Llegadas</span><b>{report.arrivals}</b></div><div><span>← Salidas</span><b>{report.departures}</b></div><div><span>● Habitaciones ocupadas</span><b>{report.occupiedNow}</b></div></div></article></div>
    <article className={s.glass}><header><div><small>ÚLTIMAS</small><h2>Reservas del período</h2></div></header>{!recent.length?<div className={s.empty}>No hay reservas en el período seleccionado.</div>:<><div className={s.table}><div className={s.tableHead}><span>Huésped</span><span>Entrada</span><span>Noches</span><span>Canal</span><span>Total reserva</span><span>Estado</span></div>{recent.map(row=><div className={s.tableRow} key={row.id}><b>{row.nombre_huesped}</b><span>{row.fecha_entrada}</span><span>{segmentsFor(row).reduce((sum,seg)=>sum+overlapNights(seg.start,seg.end,report.from,report.end),0)}</span><span>{row.canal_reserva||"Directa"}</span><span>{money(row.precio_total,row.moneda||"ARS")}</span><span className={s.status}>{row.estado}</span></div>)}</div>{reservations.length>RECENT_STEP?<div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,padding:"11px 12px 13px",borderTop:"1px solid var(--line)"}}>{hasMoreRecent?<button type="button" onClick={()=>setRecentLimit(value=>Math.min(reservations.length,value+RECENT_STEP))} style={{height:34,padding:"0 13px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10.5,fontWeight:850,cursor:"pointer"}}>↓ Ver {Math.min(RECENT_STEP,reservations.length-recentLimit)} más</button>:null}{showingExpanded?<button type="button" onClick={()=>setRecentLimit(RECENT_STEP)} style={{height:34,padding:"0 13px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--muted)",font:"inherit",fontSize:10.5,fontWeight:850,cursor:"pointer"}}>↑ Mostrar menos</button>:null}</div>:null}</>}</article>
  </div>
}