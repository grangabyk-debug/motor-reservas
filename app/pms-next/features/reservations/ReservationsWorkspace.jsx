"use client"

import{useSearchParams}from"next/navigation"
import ReservationsWorkspaceBase from"./ReservationsWorkspaceBase"
import ReservationDuplicateWatch from"./ReservationDuplicateWatch"
import GuestAttentionPanel from"./GuestAttentionPanel"
import GuestDuplicateWatch from"./GuestDuplicateWatch"
import hotel from"./reservationsHotelOs.module.css"

export default function ReservationsWorkspace(props){
  const searchParams=useSearchParams(),recordOpen=Boolean(searchParams.get("reservation"))
  return <div className={`${hotel.reservationsOs} hlReservationsCompact`}>
    <style>{`
      .hlReservationsCompact [class*="tools"] > label[class*="search"]{display:none!important}
      .hlReservationsCompact [class*="tools"] > button:last-child:after{content:"Pago"!important}
      .hlReservationsCompact [class*="filterPanel"] > span:nth-of-type(2),
      .hlReservationsCompact [class*="filterPanel"] > button:nth-last-child(-n+2){display:none!important}
      .hlReservationsCompact [class*="filterPanel"]{width:max-content;max-width:100%;margin-left:auto!important;padding:7px 8px!important;gap:5px!important}
      .hlReservationsCompact [class*="filterPanel"] > span:first-child{margin-right:2px!important}
      .hlReservationsCompact [class*="tools"] > select{min-width:154px!important}
      @media(max-width:1180px){
        .hlReservationsCompact [class*="tools"]{overflow:visible!important;flex-wrap:wrap!important}
        .hlReservationsCompact [class*="filterPanel"]{margin-left:0!important}
      }
      @media(max-width:640px){
        .hlReservationsCompact [class*="tools"] > button,
        .hlReservationsCompact [class*="tools"] > select{flex:1 1 auto!important;min-width:0!important}
        .hlReservationsCompact [class*="filterPanel"]{width:100%!important;overflow:auto!important;justify-content:flex-start!important}
      }
    `}</style>
    {!recordOpen?<>
      <GuestAttentionPanel propertyId={props.propertyId}/>
      <GuestDuplicateWatch propertyId={props.propertyId}/>
      <ReservationDuplicateWatch propertyId={props.propertyId}/>
    </>:null}
    <ReservationsWorkspaceBase {...props}/>
  </div>
}
