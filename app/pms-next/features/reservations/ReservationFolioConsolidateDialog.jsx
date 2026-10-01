"use client"

import s from"./reservationFolioBilling.module.css"

export default function ReservationFolioConsolidateDialog({open,saving=false,onClose,onConfirm}){
  if(!open)return null
  return <div className={s.overlay} role="dialog" aria-modal="true" aria-label="Consolidar folios" onMouseDown={event=>event.target===event.currentTarget&&!saving&&onClose?.()}>
    <div className={s.modal} style={{width:"min(440px,calc(100vw - 28px))",textAlign:"center"}}>
      <button type="button" className={s.close} onClick={onClose} disabled={saving}>×</button>
      <small>FOLIO MAESTRO</small>
      <h2 style={{margin:"7px 42px 8px"}}>Consolidar folios</h2>
      <p style={{margin:"0 auto",maxWidth:340,fontSize:11,lineHeight:1.55}}>Se moverán al Folio maestro todos los consumos de las habitaciones que todavía no estén facturados.</p>
      <div style={{display:"flex",justifyContent:"center",paddingTop:18}}>
        <button type="button" className={s.primary} onClick={onConfirm} disabled={saving} style={{height:40,minWidth:150,padding:"0 18px",borderRadius:11}}>{saving?"Consolidando…":"Consolidar"}</button>
      </div>
    </div>
  </div>
}
