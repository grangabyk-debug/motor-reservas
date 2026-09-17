"use client"

import{useSearchParams}from"next/navigation"
import ReservationsWorkspaceBase from"./ReservationsWorkspaceBase"
import ReservationDuplicateWatch from"./ReservationDuplicateWatch"
import GuestAttentionPanel from"./GuestAttentionPanel"
import GuestDuplicateWatch from"./GuestDuplicateWatch"
import hotel from"./reservationsHotelOs.module.css"

export default function ReservationsWorkspace(props){
  const searchParams=useSearchParams()
  const urlReservationId=Number(searchParams.get("reservation"))||null
  const recordOpen=Boolean(urlReservationId)
  const effectiveFocusId=props.focusReservationId??urlReservationId
  return <div className={hotel.reservationsOs}>
    {!recordOpen?<>
      <GuestAttentionPanel propertyId={props.propertyId}/>
      <GuestDuplicateWatch propertyId={props.propertyId}/>
      <ReservationDuplicateWatch propertyId={props.propertyId}/>
    </>:null}
    <ReservationsWorkspaceBase {...props} focusReservationId={effectiveFocusId}/>
  </div>
}
