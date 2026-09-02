"use client"

import{money}from"../../core/formatters"
import rail from"./dashboard-today-rail.module.css"

const total=r=>Number(r?.precio_total||0)
const roomFor=(rooms,reservation)=>rooms.find(room=>String(room.id)===String(reservation?.habitacion_id))

function Metric({label,value,detail,tone,onClick}){
  return <button type="button" className={rail.metric} data-tone={tone} onClick={onClick} title={detail}>
    <i className={rail.dot}/><span>{label}</span><b>{value}</b><small>{detail}</small>
  </button>
}

export default function DashboardTodayRail({arrivals=[],departures=[],inhouse=[],rooms=[],paid=new Map(),occupancy=0,onView,onOpen}){
  const due=[...arrivals,...departures].filter(r=>Math.max(0,total(r)-(paid.get(String(r.id))||0))>.01),dueAmount=due.reduce((sum,r)=>sum+Math.max(0,total(r)-(paid.get(String(r.id))||0)),0),dirty=rooms.filter(r=>String(r.estado||"").toLowerCase()==="sucia").length,cleaning=rooms.filter(r=>["limpieza","en_limpieza","inspeccion"].includes(String(r.estado||"").toLowerCase())).length,ready=rooms.filter(r=>["limpia","inspeccionada","disponible"].includes(String(r.estado||"").toLowerCase())).length,nextArrival=[...arrivals].sort((a,b)=>String(a.hora_llegada_estimada||"99:99").localeCompare(String(b.hora_llegada_estimada||"99:99")))[0],nextDeparture=[...departures].sort((a,b)=>String(a.hora_salida_estimada||"99:99").localeCompare(String(b.hora_salida_estimada||"99:99")))[0]
  const arrivalRoom=roomFor(rooms,nextArrival),departureRoom=roomFor(rooms,nextDeparture)
  return <section className={rail.shell} aria-label="Operación de hoy">
    <div className={rail.identity}><i/><span><small>HOY</small><b>Operación</b></span></div>
    <div className={rail.metrics}>
      <Metric label="IN" value={arrivals.length} detail={nextArrival?`${nextArrival.hora_llegada_estimada||"Sin hora"} · ${nextArrival.nombre_huesped||"Huésped"}${arrivalRoom?` · ${arrivalRoom.nombre}`:""}`:"Sin llegadas pendientes"} tone="arrival" onClick={()=>nextArrival?onOpen?.(nextArrival):onView?.("reservations")}/>
      <Metric label="OUT" value={departures.length} detail={nextDeparture?`${nextDeparture.hora_salida_estimada||"Sin hora"} · ${nextDeparture.nombre_huesped||"Huésped"}${departureRoom?` · ${departureRoom.nombre}`:""}`:"Sin salidas pendientes"} tone="departure" onClick={()=>nextDeparture?onOpen?.(nextDeparture):onView?.("reservations")}/>
      <Metric label="IN HOUSE" value={inhouse.length} detail={`${occupancy}% ocupación`} tone="inhouse" onClick={()=>onView?.("reservations")}/>
      <Metric label="COBROS" value={due.length} detail={due.length?money(dueAmount,due.find(r=>r.moneda)?.moneda||"ARS"):"Sin deuda inmediata"} tone={due.length?"payment":"clear"} onClick={()=>onView?.("cash")}/>
      <Metric label="HK" value={dirty?dirty:ready} detail={dirty?`${dirty} sucias · ${cleaning} en proceso`:`${ready} listas`} tone={dirty?"housekeeping":"clear"} onClick={()=>onView?.("housekeeping")}/>
    </div>
    <div className={rail.actions}><button type="button" onClick={()=>onView?.("calendar")}>Planning</button><button type="button" onClick={()=>onView?.("housekeeping")}>HK</button></div>
  </section>
}
