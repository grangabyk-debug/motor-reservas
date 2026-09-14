"use client"

import{useEffect,useState}from"react"
import{money}from"../../core/formatters"
import{useHotelSession}from"../../hooks/useHotelSession"
import{supabase}from"../../../../lib/supabase"
import rail from"./dashboard-today-rail.module.css"

const total=r=>Number(r?.precio_total||0)
const roomFor=(rooms,reservation)=>rooms.find(room=>String(room.id)===String(reservation?.habitacion_id))
const todayMMDD=()=>{const d=new Date();return`${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function Metric({label,value,detail,tone,onClick}){return <button type="button" className={rail.metric} data-tone={tone} onClick={onClick} title={detail}><i className={rail.dot}/><span>{label}</span><b>{value}</b><small>{detail}</small></button>}

export default function DashboardTodayRail({arrivals=[],departures=[],inhouse=[],rooms=[],paid=new Map(),occupancy=0,onView,onOpen}){
  const session=useHotelSession(),propertyId=session.propertyId,[occasions,setOccasions]=useState([])
  const due=[...arrivals,...departures].filter(r=>Math.max(0,total(r)-(paid.get(String(r.id))||0))>.01),dueAmount=due.reduce((sum,r)=>sum+Math.max(0,total(r)-(paid.get(String(r.id))||0)),0),dirty=rooms.filter(r=>String(r.estado||"").toLowerCase()==="sucia").length,cleaning=rooms.filter(r=>["limpieza","en_limpieza","inspeccion"].includes(String(r.estado||"").toLowerCase())).length,ready=rooms.filter(r=>["limpia","inspeccionada","disponible"].includes(String(r.estado||"").toLowerCase())).length,nextArrival=[...arrivals].sort((a,b)=>String(a.hora_llegada_estimada||"99:99").localeCompare(String(b.hora_llegada_estimada||"99:99")))[0],nextDeparture=[...departures].sort((a,b)=>String(a.hora_salida_estimada||"99:99").localeCompare(String(b.hora_salida_estimada||"99:99")))[0]
  const arrivalRoom=roomFor(rooms,nextArrival),departureRoom=roomFor(rooms,nextDeparture)
  useEffect(()=>{let cancelled=false;const ids=inhouse.map(r=>Number(r.id)).filter(Boolean);if(!propertyId||!ids.length){setOccasions([]);return}
    ;(async()=>{try{const{data:guests,error}=await supabase.from("hotel_reservation_guests").select("id,reservation_id,room_id,guest_profile_id,full_name,birth_date,checked_out_at").eq("property_id",propertyId).in("reservation_id",ids).is("checked_out_at",null);if(error)throw error;const rows=guests||[],profileIds=[...new Set(rows.map(g=>g.guest_profile_id).filter(Boolean))];let profiles=[];if(profileIds.length){const p=await supabase.from("hotel_guest_profiles").select("id,birth_date,vip_level").eq("property_id",propertyId).in("id",profileIds);if(p.error)throw p.error;profiles=p.data||[]}const byId=new Map(profiles.map(p=>[String(p.id),p])),day=todayMMDD(),hits=rows.filter(g=>String(g.birth_date||byId.get(String(g.guest_profile_id||""))?.birth_date||"").slice(5,10)===day).map(g=>({...g,vip_level:byId.get(String(g.guest_profile_id||""))?.vip_level||"standard"}));if(!cancelled)setOccasions(hits)}catch{if(!cancelled)setOccasions([])}})();return()=>{cancelled=true}},[propertyId,inhouse.map(r=>r.id).join("|")])
  const firstOccasion=occasions[0],occasionRoom=firstOccasion?rooms.find(room=>Number(room.id)===Number(firstOccasion.room_id)):null
  return <section className={rail.shell} aria-label="Operación de hoy"><div className={rail.identity}><i/><span><small>HOY</small><b>Operación</b></span></div><div className={rail.metrics}>
    <Metric label="IN" value={arrivals.length} detail={nextArrival?`${nextArrival.hora_llegada_estimada||"Sin hora"} · ${nextArrival.nombre_huesped||"Huésped"}${arrivalRoom?` · ${arrivalRoom.nombre}`:""}`:"Sin llegadas pendientes"} tone="arrival" onClick={()=>nextArrival?onOpen?.(nextArrival):onView?.("reservations")}/>
    <Metric label="OUT" value={departures.length} detail={nextDeparture?`${nextDeparture.hora_salida_estimada||"Sin hora"} · ${nextDeparture.nombre_huesped||"Huésped"}${departureRoom?` · ${departureRoom.nombre}`:""}`:"Sin salidas pendientes"} tone="departure" onClick={()=>nextDeparture?onOpen?.(nextDeparture):onView?.("reservations")}/>
    <Metric label="IN HOUSE" value={inhouse.length} detail={`${occupancy}% ocupación`} tone="inhouse" onClick={()=>onView?.("reservations")}/>
    <Metric label="COBROS" value={due.length} detail={due.length?money(dueAmount,due.find(r=>r.moneda)?.moneda||"ARS"):"Sin deuda inmediata"} tone={due.length?"payment":"clear"} onClick={()=>onView?.("cash")}/>
    <Metric label="HK" value={dirty?dirty:ready} detail={dirty?`${dirty} sucias · ${cleaning} en proceso`:`${ready} listas`} tone={dirty?"housekeeping":"clear"} onClick={()=>onView?.("housekeeping")}/>
    <Metric label="OCASIONES" value={occasions.length} detail={firstOccasion?`Cumpleaños · ${firstOccasion.full_name||"Huésped"}${occasionRoom?` · ${occasionRoom.nombre}`:""}`:"Sin cumpleaños de huéspedes alojados"} tone={occasions.length?"payment":"clear"} onClick={()=>onView?.("guests")}/>
  </div><div className={rail.actions}><button type="button" onClick={()=>onView?.("calendar")}>Planning</button><button type="button" onClick={()=>onView?.("housekeeping")}>HK</button></div></section>
}
