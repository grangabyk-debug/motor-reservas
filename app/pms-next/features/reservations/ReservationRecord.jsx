"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
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
  const[chargeBasis,setChargeBasis]=useState(null)
  useEffect(()=>{setGroupCheckoutOpen(false);setOperationsMode(null);setChargeBasis(null)},[item?.id])
  useEffect(()=>{
    const needsBasis=rooms.length>1||String(item?.estado||"").toLowerCase()==="cancelada"
    if(!item?.id||!propertyId||!needsBasis){setChargeBasis(null);return}
    let cancelled=false
    ;(async()=>{const{data,error}=await supabase.rpc("hl_get_reservation_charge_basis",{p_reservation_id:Number(item.id)});if(!cancelled&&!error)setChargeBasis(data||null)})()
    return()=>{cancelled=true}
  },[item?.id,item?.estado,item?.precio_total,item?.subtotal,item?.tarifa_noche,item?.habitaciones_detalle,propertyId,rooms.length])
  const isGroupCheckout=item?.estado==="alojado"&&rooms.length>1
  const displayItem=useMemo(()=>{
    const cancelledReservation=String(item?.estado||"").toLowerCase()==="cancelada"
    if(cancelledReservation){
      const penaltyGross=Math.max(0,Number(item?.cancellation_penalty_amount)||0)
      const charged=String(item?.cancellation_penalty_status||"").toLowerCase()==="charged"
      const waived=String(item?.cancellation_penalty_status||"").toLowerCase()==="waived"
      const penaltyNet=charged?Math.max(0,Number(chargeBasis?.charges_net??item?.precio_sin_impuestos_nacionales??item?.subtotal)||0):0
      const cancellationService=penaltyGross>0?{
        id:"cancellation-penalty-display",
        nombre:waived?"Penalidad eximida":"Penalidad por cancelación",
        categoria:"fee",
        cantidad:1,
        precio:penaltyNet,
        total:penaltyNet,
        detalle:waived?"La política preveía una penalidad, pero fue eximida.":`Obligación final por cancelación · ${item?.cancellation_note||"según política del establecimiento"}`
      }:null
      return{
        ...item,
        tarifa_noche:0,
        subtotal:0.0000001,
        regimen:"Cancelada · alojamiento liberado",
        servicios:cancellationService?[cancellationService]:[],
        cochera_total:0,
        mascotas_total:0,
        early_checkin_importe:0,
        late_checkout_importe:0,
        extra:0,
        descuento_importe:0
      }
    }
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
  return <>
    <ReservationRecordBase {...props} item={displayItem} onNavigate={navigateFromRecord} onPrimaryAction={primaryAction}/>
    {operationsMode?<ReservationInlineOperationsDialog mode={operationsMode} item={item} rooms={rooms} propertyId={propertyId} onClose={()=>setOperationsMode(null)}/>:null}
    {groupCheckoutOpen?<ReservationGroupCheckoutDialog item={item} rooms={rooms} propertyId={propertyId} onClose={()=>setGroupCheckoutOpen(false)} onCheckoutAll={()=>{setGroupCheckoutOpen(false);onPrimaryAction?.()}}/>:null}
  </>
}