"use client"

import{useEffect,useMemo,useState}from"react"
import{stayOccupancy}from"./reservationModel"
import{loadUnavailableRoomIds}from"../../services/reservationAvailability"

const isRoomOperational=room=>room?.activa!==false&&!["mantenimiento","fuera_servicio","fuera_de_servicio"].includes(String(room?.estado||"").trim().toLowerCase())

export default function useReservationRoomAvailability({propertyId,draft,rooms=[],excludeReservationId=null}){
  const occupancy=useMemo(()=>stayOccupancy(draft||{}),[draft?.start,draft?.end,draft?.stayType,draft?.arrivalTime,draft?.departureTime,draft?.businessDayCutoff])
  const[state,setState]=useState({ready:false,loading:false,error:"",busyIds:new Set(),blockedIds:new Set()})

  useEffect(()=>{
    let alive=true
    if(!propertyId||!occupancy.valid){setState({ready:false,loading:false,error:"",busyIds:new Set(),blockedIds:new Set()});return()=>{alive=false}}
    setState(current=>({...current,ready:false,loading:true,error:""}))
    loadUnavailableRoomIds({propertyId,occupancy,excludeReservationId}).then(result=>{
      if(!alive)return
      setState({ready:true,loading:false,error:"",busyIds:new Set(result.busyIds||[]),blockedIds:new Set(result.blockedIds||[])})
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
