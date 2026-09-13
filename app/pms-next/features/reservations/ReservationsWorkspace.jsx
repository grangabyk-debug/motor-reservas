"use client"

import ReservationsWorkspaceBase from"./ReservationsWorkspaceBase"
import ReservationDuplicateWatch from"./ReservationDuplicateWatch"

export default function ReservationsWorkspace(props){
  return <><ReservationDuplicateWatch propertyId={props.propertyId}/><ReservationsWorkspaceBase {...props}/></>
}
