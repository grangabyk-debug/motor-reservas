"use client"

import{useSearchParams}from"next/navigation"
import ReservationsWorkspaceBase from"./ReservationsWorkspaceBase"
import ReservationDuplicateWatch from"./ReservationDuplicateWatch"
import GuestAttentionPanel from"./GuestAttentionPanel"
import GuestDuplicateWatch from"./GuestDuplicateWatch"
import hotel from"./reservationsHotelOs.module.css"

export default function ReservationsWorkspace(props){
  const searchParams=useSearchParams(),recordOpen=Boolean(searchParams.get("reservation"))
  return <div className={hotel.reservationsOs}>
    {!recordOpen?<>
      <GuestAttentionPanel propertyId={props.propertyId}/>
      <GuestDuplicateWatch propertyId={props.propertyId}/>
      <ReservationDuplicateWatch propertyId={props.propertyId}/>
    </>:null}
    <ReservationsWorkspaceBase {...props}/>
  </div>
}
