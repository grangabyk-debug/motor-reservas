"use client"

import{useEffect,useMemo,useState}from"react"
import{isoDate,money}from"../../core/formatters"
import{Lobby}from"./FrontDeskViews"
import s from"./dashboard-experience.module.css"

const pct=(part,total)=>total?Math.round(part/total*100):0
const activeReservation=r=>r.estado!=="cancelada"&&!r.no_show

function ArgentinaMark(){return <span className={s.argentina}><i aria-hidden="true"><b/></i><span>Hecho en Argentina · pensado para la región</span></span>}

export default function DashboardExperience(props){
  const propertyKey=props.settings?.property_id||props.settings?.hotel_name||"hotel"
  const[mode,setMode]=useState("simple")

  useEffect(()=>{
    try{
      const saved=localStorage.getItem(`hl-dashboard-mode:${propertyKey}`)
      if(saved==="advanced"||saved==="simple")setMode(saved)
    }catch{}
  },[propertyKey])

  useEffect(()=>{
    try{localStorage.setItem(`hl-dashboard-mode:${propertyKey}`,mode)}catch{}
  },[mode,propertyKey])

  return mode==="advanced"
    ?<AdvancedDashboard {...props} onMode={()=>setMode("simple")}/>
    :<SimpleDashboard {...props} onMode={()=>setMode("advanced")}/>
}

function AdvancedDashboard(props){
  const{onMode,...lobbyProps}=props
  return <div className={s.advanced}>
    <div className={s.modeBar}><ArgentinaMark/><button type="button" onClick={onMode}>← Volver a Hoy</button></div>
    <Lobby {...lobbyProps}/>
  </div>
}

function SimpleDashboard({settings,rooms=[],reservations=[],payments=[],onView,onOpen,onNewReservation,onMenu,onCommand,onMode}){
  const[clock,setClock]=useState(null)
  useEffect(()=>{const tick=()=>setClock(new Date()),id=setInterval(tick,30000);tick();return()=>clearInterval(id)},[])

  const today=isoDate(),live=reservations.filter(activeReservation),arrivals=live.filter(r=>r.fecha_entrada===today&&r.estado!=="alojado"),departures=live.filter(r=>r.fecha_salida===today&&r.estado!=="finalizada"),inhouse=live.filter(r=>r.fecha_entrada<=today&&r.fecha_salida>today&&r.estado!=="finalizada"),sellable=rooms.filter(r=>r.activa!==false&&!['mantenimiento','fuera_servicio'].includes(String(r.estado||"").toLowerCase())),occupied=new Set(inhouse.map(r=>String(r.habitacion_id))).size,occupancy=pct(occupied,sellable.length),dirty=rooms.filter(r=>String(r.estado||"").toLowerCase()==="sucia").length,working=rooms.filter(r=>["limpieza","en_limpieza","inspeccion"].includes(String(r.estado||"").toLowerCase())).length
  const paid=useMemo(()=>{const map=new Map();payments.forEach(p=>map.set(String(p.reserva_id),(map.get(String(p.reserva_id))||0)+Number(p.monto||0)));return map},[payments]),due=arrivals.filter(r=>Math.max(0,Number(r.precio_total||0)-(paid.get(String(r.id))||0))>.01),dueAmount=due.reduce((sum,r)=>sum+Math.max(0,Number(r.precio_total||0)-(paid.get(String(r.id))||0)),0)
  const roomName=id=>rooms.find(room=>String(room.id)===String(id))?.nombre||"Sin asignar",nextArrivals=[...arrivals].sort((a,b)=>String(a.hora_llegada_estimada||"99:99").localeCompare(String(b.hora_llegada_estimada||"99:99"))).slice(0,6)
  const turnover=arrivals.filter(a=>departures.some(d=>String(d.habitacion_id)===String(a.habitacion_id))).length
  const attention=[
    ...(due.length?[{label:"Cobros pendientes",detail:`${due.length} llegada${due.length===1?"":"s"} · ${money(dueAmount,due[0]?.moneda||"ARS")}`,view:"cash",tone:"warn"}]:[]),
    ...(dirty?[{label:"Habitaciones por preparar",detail:`${dirty} sucia${dirty===1?"":"s"}${working?` · ${working} en proceso`:""}`,view:"housekeeping",tone:"warn"}]:[]),
    ...(turnover?[{label:"Recambios hoy",detail:`${turnover} habitación${turnover===1?"":"es"} con salida y nueva llegada`,view:"housekeeping",tone:"info"}]:[]),
  ].slice(0,4)
  const dateLabel=clock?new Intl.DateTimeFormat("es-AR",{weekday:"long",day:"numeric",month:"long"}).format(clock):"",timeLabel=clock?new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit"}).format(clock):""

  return <main className={s.simple}>
    <header className={s.header}>
      <div className={s.title}><button type="button" className={s.mobileMenu} onClick={onMenu} aria-label="Abrir menú">☰</button><div><h1>Hoy</h1><p>{settings?.hotel_name||"Hotel"} · {dateLabel}{timeLabel?` · ${timeLabel}`:""}</p></div></div>
      <div className={s.headerActions}><button type="button" className={s.search} onClick={onCommand} aria-label="Buscar">⌕</button><button type="button" className={s.more} onClick={onMode} title="Abrir vista avanzada">•••</button>{onNewReservation&&<button type="button" className={s.newReservation} onClick={onNewReservation}>＋ Reserva</button>}</div>
    </header>

    <section className={s.metrics} aria-label="Resumen de hoy">
      <button type="button" className={s.metricWidget} onClick={()=>onView?.("reservations")}><small>LLEGADAS</small><strong>{arrivals.length}</strong><span>{nextArrivals[0]?`${nextArrivals[0].hora_llegada_estimada||"Sin hora"} · ${nextArrivals[0].nombre_huesped}`:"Sin pendientes"}</span></button>
      <button type="button" className={s.metricWidget} onClick={()=>onView?.("reservations")}><small>SALIDAS</small><strong>{departures.length}</strong><span>{departures.length?"Movimiento del día":"Sin pendientes"}</span></button>
      <button type="button" className={s.metricWidget} onClick={()=>onView?.("calendar")}><small>EN CASA</small><strong>{inhouse.length}</strong><span>{occupancy}% de ocupación</span></button>
      <button type="button" className={s.metricWidget} onClick={()=>onView?.("housekeeping")}><small>POR PREPARAR</small><strong>{dirty}</strong><span>{working?`${working} en proceso`:"Housekeeping al día"}</span></button>
    </section>

    <section className={s.mainStage}>
      <aside className={`${s.widget} ${s.now}`}>
        <header><div><h2>Atención</h2><small>Solo lo que necesita una acción</small></div><button type="button" onClick={()=>onView?.("calendar")}>Planning →</button></header>
        <div className={s.attention}>{attention.length?attention.map((item,index)=><button type="button" key={`${item.label}-${index}`} data-tone={item.tone} onClick={()=>onView?.(item.view)}><i/><span><b>{item.label}</b><small>{item.detail}</small></span><em>›</em></button>):<div className={s.calm}><i>✓</i><div><b>Todo tranquilo</b><span>No hay pendientes urgentes.</span></div></div>}</div>
      </aside>

      <section className={`${s.widget} ${s.arrivals}`}>
        <header><div><h2>Próximas llegadas</h2><small>{arrivals.length?`${arrivals.length} para hoy`:"Sin llegadas pendientes"}</small></div><button type="button" onClick={()=>onView?.("reservations")}>Ver todas →</button></header>
        <div>{nextArrivals.length?nextArrivals.map(r=><button type="button" key={r.id} onClick={()=>onOpen?.(r)}><time>{r.hora_llegada_estimada||"--:--"}</time><span><b>{r.nombre_huesped||"Huésped"}</b><small>{roomName(r.habitacion_id)} · {r.numero_reserva||r.id}</small></span><em>›</em></button>):<p>No hay llegadas pendientes para hoy.</p>}</div>
      </section>
    </section>
  </main>
}
