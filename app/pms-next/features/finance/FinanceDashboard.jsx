"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./finance.module.css"

function iso(date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function money(value,currency="ARS"){return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value||0))}
function startFor(period){const now=new Date();now.setHours(0,0,0,0);if(period==="today")return now;if(period==="7")return new Date(now.getTime()-6*86400000);if(period==="month")return new Date(now.getFullYear(),now.getMonth(),1);return new Date(now.getTime()-29*86400000)}

export default function FinanceDashboard({propertyId}){
  const[period,setPeriod]=useState("30")
  const[rooms,setRooms]=useState([])
  const[reservations,setReservations]=useState([])
  const[payments,setPayments]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    const from=iso(startFor(period));const today=iso(new Date())
    setLoading(true);setError("")
    try{
      const[roomRes,resRes,payRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre").eq("property_id",propertyId).eq("activa",true),
        supabase.from("reservas").select("id,nombre_huesped,habitacion_id,fecha_entrada,fecha_salida,noches,precio_total,moneda,estado,canal_reserva,created_at").eq("property_id",propertyId).gte("fecha_salida",from).lte("fecha_entrada",today).neq("estado","cancelada").order("created_at",{ascending:false}),
        supabase.from("pagos").select("id,monto,moneda,estado,created_at,reserva_id,metodo,refunded_amount").eq("property_id",propertyId).gte("created_at",`${from}T00:00:00`).order("created_at",{ascending:false}),
      ])
      if(roomRes.error)throw roomRes.error;if(resRes.error)throw resRes.error;if(payRes.error)throw payRes.error
      setRooms(roomRes.data||[]);setReservations(resRes.data||[]);setPayments(payRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar el resumen financiero.")}
    finally{setLoading(false)}
  },[propertyId,period])
  useEffect(()=>{load()},[load])

  const metrics=useMemo(()=>{
    const today=iso(new Date());const from=startFor(period);const days=Math.max(1,Math.round((new Date(`${today}T12:00:00`)-from)/86400000)+1)
    const occupied=reservations.filter(r=>r.fecha_entrada<=today&&r.fecha_salida>today).length
    const arrivals=reservations.filter(r=>r.fecha_entrada===today).length
    const departures=reservations.filter(r=>r.fecha_salida===today).length
    const bookings=reservations.length
    const roomNights=reservations.reduce((sum,r)=>sum+Math.max(0,Number(r.noches)||0),0)
    const bookedValue=reservations.reduce((sum,r)=>sum+Number(r.precio_total||0),0)
    const collected=payments.filter(p=>p.estado==="confirmado").reduce((sum,p)=>sum+Math.max(0,Number(p.monto||0)-Number(p.refunded_amount||0)),0)
    const occupancy=rooms.length?Math.min(100,Math.round(roomNights/(rooms.length*days)*100)):0
    const adr=roomNights?bookedValue/roomNights:0
    const revpar=rooms.length?bookedValue/(rooms.length*days):0
    return{occupied,arrivals,departures,bookings,roomNights,bookedValue,collected,occupancy,adr,revpar}
  },[rooms,reservations,payments,period])

  const recent=reservations.slice(0,8)
  if(loading)return <div className={s.empty}>Cargando indicadores financieros…</div>
  return <div className={s.financeBody}>
    <div className={s.periods}>{[["today","Hoy"],["7","7 días"],["30","30 días"],["month","Este mes"]].map(([id,label])=><button key={id} className={period===id?s.active:""} onClick={()=>setPeriod(id)}>{label}</button>)}</div>
    {error&&<div className={s.alert}>{error}</div>}
    <div className={s.heroMetrics}><article><span>Ocupación</span><b>{metrics.occupancy}%</b><small>{metrics.occupied} habitaciones ocupadas ahora</small></article><article><span>Cobrado</span><b>{money(metrics.collected)}</b><small>Pagos confirmados del período</small></article><article><span>Valor de reservas</span><b>{money(metrics.bookedValue)}</b><small>Reservas no canceladas del período</small></article><article><span>Reservas</span><b>{metrics.bookings}</b><small>{metrics.arrivals} llegadas · {metrics.departures} salidas hoy</small></article></div>
    <div className={s.analyticsGrid}><article className={s.glass}><header><div><small>REVENUE</small><h2>Indicadores hoteleros</h2></div></header><div className={s.kpis}><div><span>ADR</span><b>{money(metrics.adr)}</b></div><div><span>RevPAR</span><b>{money(metrics.revpar)}</b></div><div><span>Noches vendidas</span><b>{metrics.roomNights}</b></div><div><span>Habitaciones</span><b>{rooms.length}</b></div></div><div className={s.glowChart}><i style={{height:`${Math.max(8,metrics.occupancy)}%`}}/><i style={{height:`${Math.max(12,Math.min(92,metrics.occupancy+18))}%`}}/><i style={{height:`${Math.max(10,Math.min(86,metrics.occupancy+9))}%`}}/><i style={{height:`${Math.max(15,Math.min(96,metrics.occupancy+26))}%`}}/><i style={{height:`${Math.max(8,Math.min(90,metrics.occupancy+4))}%`}}/><i style={{height:`${Math.max(10,Math.min(98,metrics.occupancy+31))}%`}}/></div></article><article className={s.glass}><header><div><small>HOY</small><h2>Snapshot operativo</h2></div></header><div className={s.snapshot}><div><span>→ Llegadas</span><b>{metrics.arrivals}</b></div><div><span>← Salidas</span><b>{metrics.departures}</b></div><div><span>● Alojados</span><b>{metrics.occupied}</b></div></div></article></div>
    <article className={s.glass}><header><div><small>ÚLTIMAS</small><h2>Reservas recientes</h2></div></header>{!recent.length?<div className={s.empty}>No hay reservas en el período seleccionado.</div>:<div className={s.table}><div className={s.tableHead}><span>Huésped</span><span>Entrada</span><span>Noches</span><span>Canal</span><span>Total</span><span>Estado</span></div>{recent.map(row=><div className={s.tableRow} key={row.id}><b>{row.nombre_huesped}</b><span>{row.fecha_entrada}</span><span>{row.noches||0}</span><span>{row.canal_reserva||"Directa"}</span><span>{money(row.precio_total,row.moneda||"ARS")}</span><span className={s.status}>{row.estado}</span></div>)}</div>}</article>
  </div>
}
