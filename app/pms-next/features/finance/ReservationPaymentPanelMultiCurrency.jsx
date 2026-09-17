"use client"

import ReservationPaymentPanelMultiCurrencyV2 from"../../../pms-shared/features/finance/ReservationPaymentPanelMultiCurrencyV2"

export default function ReservationPaymentPanelMultiCurrency(props){
  function closePayment(){
    const url=typeof window!=="undefined"?new URL(window.location.href):null
    const openedFromReservation=Boolean(url?.searchParams.get("cash_reservation"))
    props.onClose?.()
    if(openedFromReservation&&typeof window!=="undefined")requestAnimationFrame(()=>window.history.back())
  }

  return <ReservationPaymentPanelMultiCurrencyV2 {...props} onClose={closePayment}/>
}
