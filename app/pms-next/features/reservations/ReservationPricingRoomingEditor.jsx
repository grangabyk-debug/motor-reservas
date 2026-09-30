"use client"

import RoomingEditor from"../planning/RoomingEditor"

export default function ReservationPricingRoomingEditor({item,...props}){
  const note=Number(item?.paid||0)>0||item?.estado==="alojado"
  return <>
    <RoomingEditor {...props} editableRate={false} allowRatePlanOverride/>
    {note?<div style={{marginTop:9,padding:"9px 11px",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))",fontSize:10.5,lineHeight:1.45,color:"var(--muted)"}}><b style={{color:"var(--text)"}}>Cambios de régimen y ocupación</b><div style={{marginTop:3}}>Podés modificar plan tarifario y huéspedes aunque la reserva ya esté alojada o tenga pagos. El PMS recalcula cargos, folios y saldo; los pagos existentes se conservan.</div></div>:null}
  </>
}
