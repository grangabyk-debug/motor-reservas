"use client"

import{money}from"../../core/formatters"
import rail from"./dashboard-today-rail.module.css"

const total=r=>Number(r?.precio_total||0)
const roomFor=(rooms,reservation)=>rooms.find(room=>String(room.id)===String(reservation?.habitacion_id))

function Metric({eyebrow,value,label,detail,tone,onClick}){
  return <button type="button" className={rail.metric} data-tone={tone} onClick={onClick}>
    <span className={rail.metricGlow}/>
    <small>{eyebrow}</small>
    <div><b>{value}</b><span>{label}</span></div>
    <em>{detail}</em>
  </button>
}

export default function DashboardTodayRail({arrivals=[],departures=[],inhouse=[],rooms=[],paid=new Map(),occupancy=0,onView,onOpen,onNewReservation}){
  const due=[...arrivals,...departures].filter(r=>Math.max(0,total(r)-(paid.get(String(r.id))||0))>.01),dueAmount=due.reduce((sum,r)=>sum+Math.max(0,total(r)-(paid.get(String(r.id))||0)),0),dirty=rooms.filter(r=>String(r.estado||"").toLowerCase()==="sucia").length,cleaning=rooms.filter(r=>["limpieza","en_limpieza","inspeccion"].includes(String(r.estado||"").toLowerCase())).length,ready=rooms.filter(r=>["limpia","inspeccionada","disponible"].includes(String(r.estado||"").toLowerCase())).length,nextArrival=[...arrivals].sort((a,b)=>String(a.hora_llegada_estimada||"99:99").localeCompare(String(b.hora_llegada_estimada||"99:99")))[0],nextDeparture=[...departures].sort((a,b)=>String(a.hora_salida_estimada||"99:99").localeCompare(String(b.hora_salida_estimada||"99:99")))[0]
  const arrivalRoom=roomFor(rooms,nextArrival),departureRoom=roomFor(rooms,nextDeparture)
  return <section className={rail.shell} aria-label="Operación de hoy">
    <header className={rail.head}>
      <div><small>OPERACIÓN DE HOY</small><b>Lo importante del turno, siempre visible.</b><span>Recepción, caja y habitaciones en una sola línea operativa.</span></div>
      <div className={rail.quickActions}><button type="button" onClick={()=>onView?.("calendar")}>Planning</button><button type="button" onClick={()=>onView?.("housekeeping")}>Housekeeping</button>{onNewReservation&&<button type="button" className={rail.primary} onClick={onNewReservation}>＋ Nueva reserva</button>}</div>
    </header>
    <div className={rail.metrics}>
      <Metric eyebrow="CHECK-IN" value={arrivals.length} label="llegadas" detail={nextArrival?`${nextArrival.hora_llegada_estimada||"Sin hora"} · ${nextArrival.nombre_huesped||"Huésped"}${arrivalRoom?` · ${arrivalRoom.nombre}`:""}`:"Sin llegadas pendientes"} tone="arrival" onClick={()=>nextArrival?onOpen?.(nextArrival):onView?.("reservations")}/>
      <Metric eyebrow="CHECK-OUT" value={departures.length} label="salidas" detail={nextDeparture?`${nextDeparture.hora_salida_estimada||"Sin hora"} · ${nextDeparture.nombre_huesped||"Huésped"}${departureRoom?` · ${departureRoom.nombre}`:""}`:"Sin salidas pendientes"} tone="departure" onClick={()=>nextDeparture?onOpen?.(nextDeparture):onView?.("reservations")}/>
      <Metric eyebrow="IN HOUSE" value={inhouse.length} label="en casa" detail={`${occupancy}% de ocupación actual`} tone="inhouse" onClick={()=>onView?.("reservations")}/>
      <Metric eyebrow="COBROS" value={due.length} label="pendientes" detail={due.length?money(dueAmount,due.find(r=>r.moneda)?.moneda||"ARS"):"Turno sin deuda inmediata"} tone={due.length?"payment":"clear"} onClick={()=>onView?.("cash")}/>
      <Metric eyebrow="HOUSEKEEPING" value={ready} label="listas" detail={`${dirty} sucias · ${cleaning} en proceso`} tone={dirty?"housekeeping":"clear"} onClick={()=>onView?.("housekeeping")}/>
    </div>
  </section>
}
