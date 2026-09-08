"use client"

import{useEffect,useState}from"react"
import ReservationRecordBase from"./ReservationRecordBase"
import ReservationGroupCheckoutDialog from"./ReservationGroupCheckoutDialog"

export default function ReservationRecord(props){
  const{item,rooms=[],propertyId,onPrimaryAction}=props
  const[groupCheckoutOpen,setGroupCheckoutOpen]=useState(false)
  useEffect(()=>setGroupCheckoutOpen(false),[item?.id])
  const isGroupCheckout=item?.estado==="alojado"&&rooms.length>1
  function primaryAction(){
    if(isGroupCheckout){setGroupCheckoutOpen(true);return}
    onPrimaryAction?.()
  }
  return <>
    <ReservationRecordBase {...props} onPrimaryAction={primaryAction}/>
    {groupCheckoutOpen?<ReservationGroupCheckoutDialog item={item} rooms={rooms} propertyId={propertyId} onClose={()=>setGroupCheckoutOpen(false)} onCheckoutAll={()=>{setGroupCheckoutOpen(false);onPrimaryAction?.()}}/>:null}
  </>
}
