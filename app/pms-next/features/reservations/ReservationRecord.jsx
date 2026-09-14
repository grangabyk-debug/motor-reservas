"use client"

import{useEffect,useMemo,useState}from"react"
import ReservationRecordBase from"./ReservationRecordBase"
import ReservationGroupCheckoutDialog from"./ReservationGroupCheckoutDialog"
import ReservationInlineOperationsDialog from"./ReservationInlineOperationsDialog"

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
  useEffect(()=>{setGroupCheckoutOpen(false);setOperationsMode(null)},[item?.id])
  const isGroupCheckout=item?.estado==="alojado"&&rooms.length>1
  const displayItem=useMemo(()=>{
    const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
    if(rooms.length<=1||!details.length)return item
    const lodgingNet=details.reduce((sum,detail)=>{
      const rate=Math.max(0,Number(detail?.tarifa_noche)||0)
      const explicit=Number(detail?.noches)
      const nights=Number.isFinite(explicit)&&explicit>=0?explicit:dateNights(detail?.fecha_entrada||item?.fecha_entrada,detail?.fecha_salida||item?.fecha_salida)
      return sum+(rate*Math.max(0,nights))
    },0)
    if(!(lodgingNet>0))return item
    const globalNights=Math.max(1,Number(item?.noches)||dateNights(item?.fecha_entrada,item?.fecha_salida)||1)
    return{...item,tarifa_noche:lodgingNet/globalNights}
  },[item,rooms.length])
  function primaryAction(){
    if(isGroupCheckout){setGroupCheckoutOpen(true);return}
    onPrimaryAction?.()
  }
  function navigateFromRecord(target,options){
    if(["tasks","requests","housekeeping"].includes(target)){setOperationsMode(target);return}
    onNavigate?.(target,options)
  }
  return <>
    <ReservationRecordBase {...props} item={displayItem} onNavigate={navigateFromRecord} onPrimaryAction={primaryAction}/>
    {operationsMode?<ReservationInlineOperationsDialog mode={operationsMode} item={item} rooms={rooms} propertyId={propertyId} onClose={()=>setOperationsMode(null)}/>:null}
    {groupCheckoutOpen?<ReservationGroupCheckoutDialog item={item} rooms={rooms} propertyId={propertyId} onClose={()=>setGroupCheckoutOpen(false)} onCheckoutAll={()=>{setGroupCheckoutOpen(false);onPrimaryAction?.()}}/>:null}
  </>
}
