"use client"

import{useEffect,useMemo,useState}from"react"
import{addDays,isoDate,money,shortDate}from"../../core/formatters"
import{Lobby}from"./FrontDeskViews"
import s from"./dashboard-experience.module.css"

const pct=(part,total)=>total?Math.round(part/total*100):0
const activeReservation=r=>r.estado!=="cancelada"&&!r.no_show
const nights=r=>Math.max(1,Math.round((new Date(`${r.fecha_salida}T12:00:00`)-new Date(`${r.fecha_entrada}T12:00:00`))/86400000))

function Trend({values=[]}){
  const width=900,height=190,padX=8,padY=18,peak=Math.max(0,...values),ceiling=peak>=85?100:Math.min(100,Math.max(30,Math.ceil((peak+10)/10)*10)),step=(width-padX*2)/Math.max(1,values.length-1),y=v=>height-padY-(Math.max(0,v)/ceiling)*(height-padY*2),points=values.map((v,i)=>`${padX+i*step},${y(v)}`).join(" "),area=values.length?`M ${padX} ${height-padY} L ${values.map((v,i)=>`${padX+i*step} ${y(v)}`).join(" L ")} L ${padX+(values.length-1)*step} ${height-padY} Z`:"",guideValues=[.25,.5,.75]
  return <svg className={s.trend} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Proyección de ocupación para los próximos 14 días. Máximo ${peak} por ciento.`}><defs><linearGradient id="hlSimpleFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b67b1" stopOpacity=".18"/><stop offset="1" stopColor="#2b67b1" stopOpacity="0"/></linearGradient></defs>{guideValues.map(value=><line key={value} x1={padX} x2={width-padX} y1={height-padY-(height-padY*2)*value} y2={height-padY-(height-padY*2)*value} stroke="#dfe6ed" strokeWidth="1" strokeDasharray="4 8"/>)}<path d={area} fill="url(#hlSimpleFill)"/><polyline points={points} fill="none" stroke="#2b67b1" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>{values.length>0&&<circle cx={padX} cy={y(values[0])} r="4.5" fill="#fff" stroke="#2b67b1" strokeWidth="3"/>}</svg>
}

function ArgentinaMark(){return <span className={s.argentina}><i aria-hidden="true"><b/></i><span>Hecho en Argentina · pensado para la región</span></span>}

export default function DashboardExperience(props){
  const{settings,rooms=[],reservations=[],payments=[],onView,onOpen,onNewReservation,onMenu,onCommand}=props
  const propertyKey=settings?.property_id||settings?.hotel_name||"hotel",[mode,setMode]=useState("simple"),[clock,setClock]=useState(null)
  useEffect(()=>{try{const saved=localStorage.getItem(`hl-dashboard-mode:${propertyKey}`);if(saved==="advanced"||saved==="simple")setMode(saved)}catch{}},[propertyKey])
  useEffect(()=>{try{localStorage.setItem(`hl-dashboard-mode:${propertyKey}`,mode)}catch{}},[mode,propertyKey])
  useEffect(()=>{const tick=()=>setClock(new Date()),id=setInterval(tick,30000);tick();return()=>clearInterval(id)},[])
  if(mode==="advanced")return <div className={s.advanced}><div className={s.modeBar}><ArgentinaMark/><div><button onClick={()=>setMode("simple")}>Simple</button><button className={s.modeActive}>Avanzada</button></div></div><Lobby {...props}/></div>

  const today=isoDate(),live=reservations.filter(activeReservation),arrivals=live.filter(r=>r.fecha_entrada===today&&r.estado!=="alojado"),departures=live.filter(r=>r.fecha_salida===today&&r.estado!=="finalizada"),inhouse=live.filter(r=>r.fecha_entrada<=today&&r.fecha_salida>today&&r.estado!=="finalizada"),sellable=rooms.filter(r=>r.activa!==false&&!['mantenimiento','fuera_servicio'].includes(String(r.estado||"").toLowerCase())),occupied=new Set(inhouse.map(r=>String(r.habitacion_id))).size,occupancy=pct(occupied,sellable.length),dirty=rooms.filter(r=>String(r.estado||"").toLowerCase()==="sucia").length,cleaning=rooms.filter(r=>["limpieza","en_limpieza","inspeccion"].includes(String(r.estado||"").toLowerCase())).length,ready=rooms.filter(r=>["limpia","inspeccionada","disponible"].includes(String(r.estado||"").toLowerCase())).length
  const paid=useMemo(()=>{const map=new Map();payments.forEach(p=>map.set(String(p.reserva_id),(map.get(String(p.reserva_id))||0)+Number(p.monto||0)));return map},[payments]),due=arrivals.filter(r=>Math.max(0,Number(r.precio_total||0)-(paid.get(String(r.id))||0))>.01),dueAmount=due.reduce((sum,r)=>sum+Math.max(0,Number(r.precio_total||0)-(paid.get(String(r.id))||0)),0)
  const forecast=useMemo(()=>Array.from({length:14},(_,i)=>{const day=addDays(today,i),count=new Set(live.filter(r=>r.fecha_entrada<=day&&r.fecha_salida>day).map(r=>String(r.habitacion_id))).size;return pct(count,sellable.length)}),[today,live,sellable.length]),todayRevenue=live.filter(r=>r.fecha_entrada<=today&&r.fecha_salida>today).reduce((sum,r)=>sum+Number(r.precio_total||0)/nights(r),0)
  const roomName=id=>rooms.find(room=>String(room.id)===String(id))?.nombre||"Sin asignar",nextArrivals=[...arrivals].sort((a,b)=>String(a.hora_llegada_estimada||"99:99").localeCompare(String(b.hora_llegada_estimada||"99:99"))).slice(0,4),attention=[...due.slice(0,2).map(r=>({label:"Cobro pendiente",detail:`${r.nombre_huesped} · ${money(Math.max(0,Number(r.precio_total||0)-(paid.get(String(r.id))||0)),r.moneda||"ARS")}`,view:"cash"})),...(dirty?[{label:"Housekeeping",detail:`${dirty} sucias · ${cleaning} en proceso`,view:"housekeeping"}]:[]),...(departures.length&&arrivals.some(a=>departures.some(d=>String(d.habitacion_id)===String(a.habitacion_id)))?[{label:"Recambio hoy",detail:"Hay habitaciones con salida y nueva llegada el mismo día.",view:"calendar"}]:[])].slice(0,4)
  const dateLabel=clock?new Intl.DateTimeFormat("es-AR",{weekday:"long",day:"numeric",month:"long"}).format(clock):"",timeLabel=clock?new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit"}).format(clock):""

  return <main className={s.simple}>
    <header className={s.header}>
      <div className={s.title}><button className={s.mobileMenu} onClick={onMenu} aria-label="Abrir menú">☰</button><div><small>HABITACIÓN LLENA</small><h1>Panel operativo</h1><p>{settings?.hotel_name||"Hotel"} · {dateLabel}{timeLabel?` · ${timeLabel}`:""}</p></div></div>
      <div className={s.headerActions}><button className={s.search} onClick={onCommand}>⌕ <span>Buscar</span></button><div className={s.modeSwitch} aria-label="Modo del dashboard"><button className={s.modeActive}>Simple</button><button onClick={()=>setMode("advanced")}>Avanzada</button></div>{onNewReservation&&<button className={s.newReservation} onClick={onNewReservation}>＋ Nueva reserva</button>}</div>
    </header>

    <div className={s.nationalLine}><ArgentinaMark/><span>ARS · Mercado Pago · ARCA</span></div>

    <section className={s.metrics} aria-label="Indicadores de hoy">
      <button onClick={()=>onView?.("calendar")}><small>OCUPACIÓN</small><strong>{occupancy}%</strong><span>{occupied} de {sellable.length} habitaciones</span></button>
      <button onClick={()=>onView?.("reservations")}><small>LLEGADAS</small><strong>{arrivals.length}</strong><span>{nextArrivals[0]?`${nextArrivals[0].hora_llegada_estimada||"Sin hora"} · ${nextArrivals[0].nombre_huesped}`:"Sin pendientes"}</span></button>
      <button onClick={()=>onView?.("reservations")}><small>SALIDAS</small><strong>{departures.length}</strong><span>{departures.length?"Movimiento del día":"Sin pendientes"}</span></button>
      <button onClick={()=>onView?.("housekeeping")}><small>HOUSEKEEPING</small><strong>{dirty||ready}</strong><span>{dirty?`${dirty} sucias · ${cleaning} en proceso`:`${ready} listas`}</span></button>
      <button onClick={()=>onView?.("cash")}><small>COBROS HOY</small><strong>{due.length}</strong><span>{due.length?money(dueAmount,due[0]?.moneda||"ARS"):"Sin deuda inmediata"}</span></button>
    </section>

    <section className={s.mainStage}>
      <div className={s.occupancyStage}>
        <div className={s.stageHead}><div><small>PRÓXIMOS 14 DÍAS</small><h2>Ocupación</h2></div><div><b>{occupancy}%</b><span>hoy</span></div></div>
        <Trend values={forecast}/>
        <div className={s.axis}><span>Hoy</span><span>{shortDate(addDays(today,6))}</span><span>{shortDate(addDays(today,13))}</span></div>
        <div className={s.revenueLine}><span><small>Producción estimada · noche actual</small><b>{money(Math.round(todayRevenue),settings?.currency||settings?.moneda||"ARS")}</b></span><button onClick={()=>onView?.("rates")}>Abrir Revenue →</button></div>
      </div>
      <aside className={s.now}>
        <header><small>AHORA</small><h2>Lo que merece atención</h2></header>
        <div className={s.attention}>{attention.length?attention.map((item,index)=><button key={`${item.label}-${index}`} onClick={()=>onView?.(item.view)}><i/><span><b>{item.label}</b><small>{item.detail}</small></span><em>→</em></button>):<div className={s.calm}><i>✓</i><div><b>Sin alertas críticas</b><span>La operación no muestra pendientes urgentes.</span></div></div>}</div>
        <button className={s.planningLink} onClick={()=>onView?.("calendar")}>Abrir Planning <span>→</span></button>
      </aside>
    </section>

    <section className={s.arrivals}>
      <header><div><small>PRÓXIMAS LLEGADAS</small><h2>Recepción</h2></div><button onClick={()=>onView?.("reservations")}>Ver todas →</button></header>
      <div>{nextArrivals.length?nextArrivals.map(r=><button key={r.id} onClick={()=>onOpen?.(r)}><time>{r.hora_llegada_estimada||"--:--"}</time><span><b>{r.nombre_huesped||"Huésped"}</b><small>{roomName(r.habitacion_id)} · {r.numero_reserva||r.id}</small></span><em>Check-in</em></button>):<p>No hay llegadas pendientes para hoy.</p>}</div>
    </section>
  </main>
}
