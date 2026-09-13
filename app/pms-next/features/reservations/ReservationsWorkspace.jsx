"use client"

import ReservationsWorkspaceBase from"./ReservationsWorkspaceBase"
import ReservationDuplicateWatch from"./ReservationDuplicateWatch"
import GuestAttentionPanel from"./GuestAttentionPanel"
import GuestDuplicateWatch from"./GuestDuplicateWatch"

export default function ReservationsWorkspace(props){
  return <>
    <GuestAttentionPanel propertyId={props.propertyId}/>
    <GuestDuplicateWatch propertyId={props.propertyId}/>
    <ReservationDuplicateWatch propertyId={props.propertyId}/>
    <ReservationsWorkspaceBase {...props}/>
  </>
}
