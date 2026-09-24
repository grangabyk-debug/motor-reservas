"use client"

import{useEffect,useMemo}from"react"

const relevantTables=new Set(["hotel_folios","hotel_folio_items","hotel_folio_payment_allocations","pagos","hotel_finance_documents","reservas","resume","reconnected"])

export default function useReservationFolioSync({reservation,propertyId,load}){
  const structureKey=useMemo(()=>JSON.stringify({
    primary:Number(reservation?.habitacion_id)||null,
    rooms:[...(reservation?.habitaciones_ids||[])].map(Number).filter(Number.isFinite).sort((a,b)=>a-b),
    details:(Array.isArray(reservation?.habitaciones_detalle)?reservation.habitaciones_detalle:[]).map(row=>[Number(row?.habitacion_id)||null,String(row?.fecha_entrada||""),String(row?.fecha_salida||""),String(row?.segment_role||"")]).sort((a,b)=>(a[0]||0)-(b[0]||0)),
    checkout:Object.entries(reservation?.room_checkout_dates||{}).sort(([a],[b])=>a.localeCompare(b))
  }),[reservation?.habitacion_id,reservation?.habitaciones_ids,reservation?.habitaciones_detalle,reservation?.room_checkout_dates])

  useEffect(()=>{load()},[load,structureKey])
  useEffect(()=>{
    if(typeof window==="undefined")return
    let timer=null
    const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>load(true),80)}
    const refreshData=event=>{
      const detail=event?.detail||{}
      if(detail.propertyId&&String(detail.propertyId)!==String(propertyId))return
      const tables=detail.tables||[]
      if(tables.length&&!tables.some(table=>relevantTables.has(table)))return
      schedule()
    }
    const refreshReservation=event=>{
      const changedId=Number(event?.detail?.reservationId)
      if(changedId&&changedId!==Number(reservation?.id))return
      schedule()
    }
    window.addEventListener("hl:pms-data-updated",refreshData)
    window.addEventListener("hl:pms-reservation-updated",refreshReservation)
    return()=>{if(timer)clearTimeout(timer);window.removeEventListener("hl:pms-data-updated",refreshData);window.removeEventListener("hl:pms-reservation-updated",refreshReservation)}
  },[propertyId,reservation?.id,load])
}
