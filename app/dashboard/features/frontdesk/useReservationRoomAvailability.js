"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{stayOccupancy}from"./reservationModel"

const roomIds=r=>[...new Set([r?.habitacion_id,...(Array.isArray(r?.habitaciones_ids)?r.habitaciones_ids:[])].map(String).filter(Boolean))]
const usesRoom=(r,id)=>roomIds(r).includes(String(id))
const reservationStart=r=>String(r?.ocupacion_desde_local||`${r?.fecha_entrada||""}T${r?.hora_llegada_estimada||"14:00"}:00`).replace(" ","T")
const reservationEnd=r=>String(r?.ocupacion_hasta_local||`${r?.fecha_salida||""}T${r?.hora_salida_estimada||"10:00"}:00`).replace(" ","T")
const isRoomOperational=room=>room?.activa!==false&&!["mantenimiento","fuera_servicio","fuera_de_servicio"].includes(String(room?.estado||"").trim().toLowerCase())

export default function useReservationRoomAvailability({propertyId,draft,rooms=[],excludeReservationId=null}){
  const occupancy=useMemo(()=>stayOccupancy(draft||{}),[draft?.start,draft?.end,draft?.stayType,draft?.arrivalTime,draft?.departureTime,draft?.businessDayCutoff])
  const[state,setState]=useState({ready:false,loading:false,error:"",busyIds:new Set(),blockedIds:new Set()})

  useEffect(()=>{
    let alive=true
    if(!propertyId||!occupancy.valid){setState({ready:false,loading:false,error:"",busyIds:new Set(),blockedIds:new Set()});return()=>{alive=false}}
    setState(current=>({...current,ready:false,loading:true,error:""}))
    Promise.all([
      supabase.from("reservas").select("id,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,hora_llegada_estimada,hora_salida_estimada,ocupacion_desde_local,ocupacion_hasta_local,estado,no_show").eq("property_id",propertyId).neq("estado","cancelada").eq("no_show",false).lte("fecha_entrada",occupancy.end).gte("fecha_salida",occupancy.start),
      supabase.from("bloqueos").select("id,habitacion_id,fecha_desde,fecha_hasta,motivo,detalle").eq("property_id",propertyId).lte("fecha_desde",occupancy.end).gte("fecha_hasta",occupancy.start),
    ]).then(([reservationResult,blockResult])=>{
      if(!alive)return
      if(reservationResult.error)throw reservationResult.error
      if(blockResult.error)throw blockResult.error
      const busyIds=new Set(),blockedIds=new Set()
      ;(reservationResult.data||[]).forEach(reservation=>{
        if(String(reservation.id)===String(excludeReservationId||""))return
        if(reservationStart(reservation)<occupancy.endAt&&reservationEnd(reservation)>occupancy.startAt){roomIds(reservation).forEach(id=>busyIds.add(id))}
      })
      ;(blockResult.data||[]).forEach(block=>{
        const from=`${block.fecha_desde}T00:00:00`,to=`${block.fecha_hasta}T00:00:00`
        if(from<occupancy.endAt&&to>occupancy.startAt)blockedIds.add(String(block.habitacion_id))
      })
      setState({ready:true,loading:false,error:"",busyIds,blockedIds})
    }).catch(error=>{if(alive)setState({ready:false,loading:false,error:error?.message||"No pudimos verificar la disponibilidad.",busyIds:new Set(),blockedIds:new Set()})})
    return()=>{alive=false}
  },[propertyId,occupancy.valid,occupancy.start,occupancy.end,occupancy.startAt,occupancy.endAt,excludeReservationId])

  const availableRooms=useMemo(()=>{
    if(!state.ready)return[]
    return rooms.filter(room=>isRoomOperational(room)&&!state.busyIds.has(String(room.id))&&!state.blockedIds.has(String(room.id))).sort((a,b)=>String(a.tipo||"").localeCompare(String(b.tipo||""),"es")||String(a.nombre||"").localeCompare(String(b.nombre||""),"es",{numeric:true}))
  },[rooms,state.ready,state.busyIds,state.blockedIds])
  const signature=useMemo(()=>availableRooms.map(room=>String(room.id)).join("|"),[availableRooms])
  return{...state,rooms:availableRooms,signature,occupancy}
}
