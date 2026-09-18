"use client"

import ReservationPaymentPanelMultiCurrencyV2 from"../../../pms-shared/features/finance/ReservationPaymentPanelMultiCurrencyV2"

export default function ReservationPaymentPanelMultiCurrency(props){
  function reservationOrigin(){
    if(typeof window==="undefined")return null
    const url=new URL(window.location.href),raw=url.searchParams.get("cash_reservation")
    const id=Number(raw)
    return raw&&Number.isFinite(id)&&id>0?id:null
  }

  function returnToReservation(result){
    const reservationId=reservationOrigin()||Number(result?.reservation?.id)||null
    if(!reservationOrigin()||typeof window==="undefined")return
    requestAnimationFrame(()=>{
      window.history.back()
      window.setTimeout(()=>{
        window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{
          title:"Pago registrado",
          message:`${result?.reservation?.nombre_huesped||"La reserva"} · el movimiento quedó guardado en Caja diaria y volvimos a la ficha.`,
          actionLabel:"Ver en Caja",
          onAction:()=>props.onNavigate?.("dailycash",{restoreScroll:false}),
          duration:5200,
        }}))
      },120)
    })
  }

  function closePayment(){
    const openedFromReservation=Boolean(reservationOrigin())
    props.onClose?.()
    if(openedFromReservation&&typeof window!=="undefined")requestAnimationFrame(()=>window.history.back())
  }

  function savedPayment(result){
    const openedFromReservation=Boolean(reservationOrigin())
    props.onSaved?.(result)
    if(openedFromReservation)returnToReservation(result)
  }

  return <ReservationPaymentPanelMultiCurrencyV2 {...props} onClose={closePayment} onSaved={savedPayment}/>
}
