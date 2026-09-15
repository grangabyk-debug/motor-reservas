"use client"

import{useEffect,useState}from"react"
import ReservationRecordBase from"./ReservationRecordBase"
import ReservationGroupCheckoutDialog from"./ReservationGroupCheckoutDialog"
import ReservationInlineOperationsDialog from"./ReservationInlineOperationsDialog"
import ReservationPaymentRequestPanel from"./ReservationPaymentRequestPanel"
import ReservationAttachmentsPanel from"./ReservationAttachmentsPanel"

export default function ReservationRecord(props){
  const{item,rooms=[],propertyId,onPrimaryAction,onNavigate}=props
  const[groupCheckoutOpen,setGroupCheckoutOpen]=useState(false)
  const[operationsMode,setOperationsMode]=useState(null)
  const[paymentRevision,setPaymentRevision]=useState(0)
  useEffect(()=>{setGroupCheckoutOpen(false);setOperationsMode(null);setPaymentRevision(0)},[item?.id])
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
    <ReservationRecordBase key={`${item?.id||"reservation"}:${paymentRevision}`} {...props} onNavigate={navigateFromRecord} onPrimaryAction={primaryAction}/>
    <ReservationAttachmentsPanel item={item} propertyId={propertyId}/>
    <ReservationPaymentRequestPanel item={item} propertyId={propertyId} onChanged={()=>setPaymentRevision(value=>value+1)}/>
    {operationsMode?<ReservationInlineOperationsDialog mode={operationsMode} item={item} rooms={rooms} propertyId={propertyId} onClose={()=>setOperationsMode(null)}/>:null}
    {groupCheckoutOpen?<ReservationGroupCheckoutDialog item={item} rooms={rooms} propertyId={propertyId} onClose={()=>setGroupCheckoutOpen(false)} onCheckoutAll={()=>{setGroupCheckoutOpen(false);onPrimaryAction?.()}}/>:null}
  </>
}
