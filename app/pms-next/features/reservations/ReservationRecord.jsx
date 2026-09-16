"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import ReservationRecordBase from"./ReservationRecordBase"
import ReservationGroupCheckoutDialog from"./ReservationGroupCheckoutDialog"
import ReservationInlineOperationsDialog from"./ReservationInlineOperationsDialog"
import ReservationPaymentRequestPanel from"./ReservationPaymentRequestPanel"
import ReservationAttachmentsPanel from"./ReservationAttachmentsPanel"
import ReservationCommercialAccountPanel from"./ReservationCommercialAccountPanel"
import hotel from"./reservationHotelOs.module.css"

const DAY_MS=86400000
const dateNights=(start,end)=>{
  const from=String(start||"").slice(0,10),to=String(end||"").slice(0,10)
  if(!from||!to)return 0
  return Math.max(0,Math.round((new Date(`${to}T12:00:00`)-new Date(`${from}T12:00:00`))/DAY_MS))
}

export default function ReservationRecord(props){
  const{item,rooms=[],propertyId,onPrimaryAction,onNavigate}=props
  const[groupCheckoutOpen,setGroupCheckoutOpen]=useState(false)
  const[operationsMode,setOperationsMode]=useState(null)
  const[chargeBasis,setChargeBasis]=useState(null)
  const[paymentRevision,setPaymentRevision]=useState(0)
  useEffect(()=>{setGroupCheckoutOpen(false);setOperationsMode(null);setChargeBasis(null);setPaymentRevision(0)},[item?.id])
  useEffect(()=>{
    if(!item?.id||!propertyId||rooms.length<=1){setChargeBasis(null);return}
    let cancelled=false
    ;(async()=>{const{data,error}=await supabase.rpc("hl_get_reservation_charge_basis",{p_reservation_id:Number(item.id)});if(!cancelled&&!error)setChargeBasis(data||null)})()
    return()=>{cancelled=true}
  },[item?.id,item?.precio_total,item?.subtotal,item?.tarifa_noche,item?.habitaciones_detalle,propertyId,rooms.length])
  const isGroupCheckout=item?.estado==="alojado"&&rooms.length>1
  const displayItem=useMemo(()=>{
    const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
    if(rooms.length<=1)return item
    const detailLodging=details.reduce((sum,detail)=>{
      const rate=Math.max(0,Number(detail?.tarifa_noche)||0)
      const explicit=Number(detail?.noches)
      const nights=Number.isFinite(explicit)&&explicit>=0?explicit:dateNights(detail?.fecha_entrada||item?.fecha_entrada,detail?.fecha_salida||item?.fecha_salida)
      return sum+(rate*Math.max(0,nights))
    },0)
    const ledgerValue=Number(chargeBasis?.lodging_net)
    const hasLedger=chargeBasis!==null&&Number.isFinite(ledgerValue)
    const lodgingNet=hasLedger?Math.max(0,ledgerValue):detailLodging
    if(!hasLedger&&!(lodgingNet>0))return item
    const globalNights=Math.max(1,Number(item?.noches)||dateNights(item?.fecha_entrada,item?.fecha_salida)||1)
    return{...item,tarifa_noche:lodgingNet/globalNights}
  },[item,rooms.length,chargeBasis])
  function primaryAction(){
    if(isGroupCheckout){setGroupCheckoutOpen(true);return}
    onPrimaryAction?.()
  }
  function navigateFromRecord(target,options){
    if(["tasks","requests","housekeeping"].includes(target)){setOperationsMode(target);return}
    onNavigate?.(target,options)
  }
  return <div className={hotel.recordLayer}>
    <ReservationRecordBase key={`${item?.id||"reservation"}:${paymentRevision}`} {...props} item={displayItem} onNavigate={navigateFromRecord} onPrimaryAction={primaryAction}/>
    <ReservationCommercialAccountPanel item={item} propertyId={propertyId} onChanged={()=>setPaymentRevision(value=>value+1)}/>
    <ReservationAttachmentsPanel item={item} propertyId={propertyId}/>
    <ReservationPaymentRequestPanel item={item} propertyId={propertyId} onChanged={()=>setPaymentRevision(value=>value+1)}/>
    {operationsMode?<ReservationInlineOperationsDialog mode={operationsMode} item={item} rooms={rooms} propertyId={propertyId} onClose={()=>setOperationsMode(null)}/>:null}
    {groupCheckoutOpen?<ReservationGroupCheckoutDialog item={item} rooms={rooms} propertyId={propertyId} onClose={()=>setGroupCheckoutOpen(false)} onCheckoutAll={()=>{setGroupCheckoutOpen(false);onPrimaryAction?.()}}/>:null}
  </div>
}
