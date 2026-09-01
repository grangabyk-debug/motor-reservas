"use client"

import{useEffect,useState}from"react"
import{loadReservationWorkspace}from"../services/reservationWorkspace"

export function useReservationWorkspace(propertyId){
  const[resources,setResources]=useState([])
  const[hotelOps,setHotelOps]=useState({})
  const[error,setError]=useState("")

  useEffect(()=>{
    let active=true
    if(!propertyId){setResources([]);setHotelOps({});setError("");return()=>{active=false}}
    setError("")
    loadReservationWorkspace({propertyId}).then(data=>{
      if(!active)return
      setResources(data.resources)
      setHotelOps(data.hotelOps)
    }).catch(()=>{
      if(!active)return
      setResources([])
      setHotelOps({})
      setError("No pudimos cargar los recursos o la configuración operativa.")
    })
    return()=>{active=false}
  },[propertyId])

  return{resources,hotelOps,error}
}
