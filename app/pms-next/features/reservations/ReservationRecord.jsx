"use client"

import{useEffect,useState}from"react"
import ReservationRecordBase from"./ReservationRecordBase"
import ReservationGroupCheckoutDialog from"./ReservationGroupCheckoutDialog"
import ReservationInlineOperationsDialog from"./ReservationInlineOperationsDialog"

export default function ReservationRecord(props){
  const{item,rooms=[],propertyId,onPrimaryAction,onNavigate}=props
  const[groupCheckoutOpen,setGroupCheckoutOpen]=useState(false)
  const[operationsMode,setOperationsMode]=useState(null)
  useEffect(()=>{setGroupCheckoutOpen(false);setOperationsMode(null)},[item?.id])
  const isGroupCheckout=item?.estado==="alojado"&&rooms.length>1
  function primaryAction(){
    if(isGroupCheckout){setGroupCheckoutOpen(true);return}
    onPrimaryAction?.()
  }
  function navigateFromRecord(target,options){
    if(["tasks","requests","housekeeping"].includes(target)){setOperationsMode(target);return}
    onNavigate?.(target,options)
  }
  return <>
    <ReservationRecordBase {...props} onNavigate={navigateFromRecord} onPrimaryAction={primaryAction}/>
    {operationsMode?<ReservationInlineOperationsDialog mode={operationsMode} item={item} rooms={rooms} propertyId={propertyId} onClose={()=>setOperationsMode(null)}/>:null}
    {groupCheckoutOpen?<ReservationGroupCheckoutDialog item={item} rooms={rooms} propertyId={propertyId} onClose={()=>setGroupCheckoutOpen(false)} onCheckoutAll={()=>{setGroupCheckoutOpen(false);onPrimaryAction?.()}}/>:null}
  </>
}
