"use client"

import{useSearchParams}from"next/navigation"
import ReservationsWorkspaceBase from"./ReservationsWorkspaceBase"
import ReservationDuplicateWatch from"./ReservationDuplicateWatch"
import GuestAttentionPanel from"./GuestAttentionPanel"
import GuestDuplicateWatch from"./GuestDuplicateWatch"

export default function ReservationsWorkspace(props){
  const searchParams=useSearchParams(),recordOpen=Boolean(searchParams.get("reservation"))
  return <>
    {!recordOpen?<>
      <GuestAttentionPanel propertyId={props.propertyId}/>
      <GuestDuplicateWatch propertyId={props.propertyId}/>
      <ReservationDuplicateWatch propertyId={props.propertyId}/>
    </>:null}
    <ReservationsWorkspaceBase {...props}/>
  </>
}
