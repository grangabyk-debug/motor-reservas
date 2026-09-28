"use client"

import{useSearchParams}from"next/navigation"
import ReservationsWorkspaceBase from"./ReservationsWorkspaceBase"
import ReservationDuplicateWatch from"./ReservationDuplicateWatch"
import ReservationOperationalRules from"./ReservationOperationalRules"
import hotel from"./reservationsHotelOs.module.css"

export default function ReservationsWorkspace(props){
  const searchParams=useSearchParams()
  const urlReservationId=Number(searchParams.get("reservation"))||null
  const recordOpen=Boolean(urlReservationId||props.focusReservationId)
  const effectiveFocusId=props.focusReservationId??urlReservationId
  return <div className={hotel.reservationsOs}>
    {!recordOpen?<>
      <ReservationOperationalRules propertyId={props.propertyId}/>
      <ReservationDuplicateWatch propertyId={props.propertyId} onOpenReservation={reservationId=>props.onNavigate?.("reservations",{reservationId,restoreScroll:false})}/>
    </>:null}
    <ReservationsWorkspaceBase {...props} focusReservationId={effectiveFocusId}/>
  </div>
}
