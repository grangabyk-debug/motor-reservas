"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./reports.module.css"

const DAY=86400000
const dateKey=date=>date.toLocaleDateString("en-CA")
const startOfDay=value=>new Date(`${value}T00:00:00`)
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))
function nightsOverlap(reservation,from,to){const a=startOfDay(reservation.fecha_entrada);const b=startOfDay(reservation.fecha_salida);const start=Math.max(a,startOfDay(from));const end=Math.min(b,new Date(startOfDay(to).getTime()+DAY));return Math.max(0,Math.round((end-start)/DAY))}
function fmtMoney(value,currency){return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)}
function preset(days){const to=new Date();const from=new Date(to);from.setDate(to.getDate()-(days-1));return{from:dateKey(from),to:dateKey(to)}}

export default function ReportsWorkspace({propertyId,property}){
  const initial=preset(30)
  const[from,setFrom]=useState(initial.from)
  const[to,setTo]=useState(initial.to)
  const[rooms,setRooms]=useState([])
  const[reservations,setReservations]=useState([])
  const[payments,setPayments]=useState([])
  const[settings,setSettings]=useState({})
  const[loading,setLoading]=useState(false)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId||!from||!to)return
    setLoading(true);setError("")
    try{
      const[roomRes,resRes,payRes,setRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,activa").eq("property_id",propertyId).eq("activa",true),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,fecha_entrada,fecha_salida,estado,tarifa_noche,precio_total,moneda,canal_reserva,cantidad_huespedes,no_show").eq("property_id",propertyId).lt("fecha_entrada",dateKey(new Date(startOfDay(to).getTime()+DAY))).gt("fecha_salida",from).order("fecha_entrada"),
        supabase.from("pagos").select("id,monto,moneda,metodo,estado,created_at,reserva_id").eq("property_id",propertyId).gte("created_at",`${from}T00:00:00`).lt("created_at",`${dateKey(new Date(startOfDay(to).getTime()+DAY))}T00:00:00`).order("created_at",{ascending:false}),
        supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      ])
      for(const result of[roomRes,resRes,payRes,setRes])if(result.error)throw result.error
      setRooms(roomRes.data||[]);setReservations(resRes.data||[]);setPayments(payRes.data||[]);setSettings(setRes.data?.settings||{})
    }catch(err){setError(err?.message||"No se pudieron cargar los informes.")}
    finally{setLoading(false)}
  },[propertyId,from,to])

  useEffect(()=>{load()},[load])

  const currency=settings?.preferences?.currency||"ARS"
  const report=useMemo(()=>{
    const days=Math.max(1,Math.round((startOfDay(to)-startOfDay(from))/DAY)+1)
    const valid=reservations.filter(r=>!r.no_show&&!['cancelada','cancelled'].includes(String(r.estado||'').toLowerCase()))
    let soldNights=0,roomRevenue=0,arrivals=0,departures=0,guests=0
    const channels={}
    const rows=valid.map(r=>{
      const nights=nightsOverlap(r,from,to);const revenue=nights*(Number(r.tarifa_noche)||0);soldNights+=nights;roomRevenue+=revenue
      if(r.fecha_entrada>=from&&r.fecha_entrada<=to)arrivals++
      if(r.fecha_salida>=from&&r.fecha_salida<=to)departures++
      guests+=Number(r.cantidad_huespedes)||0
      const channel=r.canal_reserva||"Directo";channels[channel]=(channels[channel]||0)+1
      return{...r,nights,revenue}
    })
    const available=Math.max(0,rooms.length*days);const occupancy=available?soldNights/available*100:0;const adr=soldNights?roomRevenue/soldNights:0;const revpar=available?roomRevenue/available:0
    const collected=payments.filter(p=>!['anulado','cancelado','refunded','void'].includes(String(p.estado||'').toLowerCase())).reduce((sum,p)=>sum+Number(p.monto||0),0)
    const channelRows=Object.entries(channels).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count,pct:valid.length?count/valid.length*100:0}))
    return{days,soldNights,roomRevenue,available,occupancy,adr,revpar,arrivals,departures,guests,collected,bookings:valid.length,channelRows,rows}
  },[reservations,payments,rooms,from,to])

  function setPreset(days){const range=preset(days);setFrom(range.from);setTo(range.to)}
  function exportCsv(){
    const lines=[["Reserva","Huésped","Entrada","Salida","Noches en período","Canal","Estado","Ingreso alojamiento"],...report.rows.map(r=>[r.numero_reserva||r.id,r.nombre_huesped,r.fecha_entrada,r.fecha_salida,r.nights,r.canal_reserva||"Directo",r.estado,r.revenue])]
    const csv=lines.map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(",")).join("\n")
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`habitacion-llena-${from}-${to}.csv`;a.click();URL.revokeObjectURL(url)
  }

  return <section className={s.page}>
    <header className={s.header}><div><small>INFORMES</small><h1>Rendimiento hotelero</h1><p>{property?.name||"Propiedad activa"} · métricas calculadas con reservas y pagos reales.</p></div><button className={s.export} onClick={exportCsv}>Exportar CSV</button></header>
    <div className={s.filters}><div className={s.presets}><button onClick={()=>setPreset(1)}>Hoy</button><button onClick={()=>setPreset(7)}>7 días</button><button onClick={()=>setPreset(30)}>30 días</button><button onClick={()=>setPreset(90)}>90 días</button></div><label>Desde<input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label></div>
    {error&&<div className={s.notice}>{error}</div>}{loading&&<div className={s.notice}>Actualizando métricas…</div>}
    <div className={s.metrics}><Metric label="Ocupación" value={`${clamp(report.occupancy,0,999).toFixed(1)}%`} note={`${report.soldNights} noches vendidas`}/><Metric label="ADR" value={fmtMoney(report.adr,currency)} note="Promedio por noche vendida"/><Metric label="RevPAR" value={fmtMoney(report.revpar,currency)} note="Ingreso por habitación disponible"/><Metric label="Ingresos alojamiento" value={fmtMoney(report.roomRevenue,currency)} note={`${report.days} días seleccionados`}/><Metric label="Cobrado" value={fmtMoney(report.collected,currency)} note="Pagos registrados en el período"/><Metric label="Reservas" value={report.bookings} note={`${report.arrivals} entradas · ${report.departures} salidas`}/></div>
    <div className={s.columns}><article className={s.panel}><header><div><small>ORIGEN</small><h2>Reservas por canal</h2></div></header>{report.channelRows.length?<div className={s.channels}>{report.channelRows.map(row=><div key={row.name}><span><b>{row.name}</b><em>{row.count}</em></span><div><i style={{width:`${clamp(row.pct,0,100)}%`}}/></div></div>)}</div>:<p className={s.empty}>No hay reservas en el período.</p>}</article><article className={s.panel}><header><div><small>OPERACIÓN</small><h2>Resumen del período</h2></div></header><div className={s.snapshot}><div><span>Habitaciones activas</span><b>{rooms.length}</b></div><div><span>Noches disponibles</span><b>{report.available}</b></div><div><span>Huéspedes en reservas</span><b>{report.guests}</b></div><div><span>Entradas</span><b>{report.arrivals}</b></div><div><span>Salidas</span><b>{report.departures}</b></div></div></article></div>
    <div className={s.panel}><header><div><small>DETALLE</small><h2>Reservas del período</h2></div></header><div className={s.table}><div className={s.head}><span>Reserva</span><span>Huésped</span><span>Estadía</span><span>Canal</span><span>Noches</span><span>Ingreso</span></div>{report.rows.slice(0,100).map(row=><div className={s.row} key={row.id}><span>#{row.numero_reserva||row.id}</span><b>{row.nombre_huesped}</b><span>{row.fecha_entrada} → {row.fecha_salida}</span><span>{row.canal_reserva||"Directo"}</span><span>{row.nights}</span><strong>{fmtMoney(row.revenue,currency)}</strong></div>)}</div></div>
  </section>
}

function Metric({label,value,note}){return <article className={s.metric}><span>{label}</span><b>{value}</b><small>{note}</small></article>}
