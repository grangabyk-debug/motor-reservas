"use client"

import{supabase}from"../../../../lib/supabase"

const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const blockedReservation=item=>item?.estado==="cancelada"||item?.estado==="finalizada"||Boolean(item?.no_show)

export default function ReservationGuestCheckout({item,selectedGuest,saving,onSaving,onRefresh,onReservationChanged,onNotice,onError}){
  const button={height:34,padding:"0 11px",border:"1px solid color-mix(in srgb,var(--accent) 28%,var(--line))",borderRadius:9,background:"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:10,fontWeight:850}

  async function checkoutGuest(){
    const guest=selectedGuest
    if(saving||!guest||guest.checked_out_at||String(guest.id||"").startsWith("new-")||blockedReservation(item))return
    const needsCheckin=item.estado!=="alojado",name=guest.full_name||"este pasajero"
    const message=needsCheckin
      ?`¿Desea hacer check-out de ${name}? La reserva todavía figura como ${item.estado||"confirmada"}. Para registrar una salida real, se hará primero el check-in operativo de la reserva y después el check-out sólo de este pasajero. Los demás pasajeros y la habitación seguirán activos.`
      :`¿Desea hacer check-out de ${name}? La habitación seguirá ocupada hasta realizar el check-out principal de la habitación o del grupo.`
    if(!window.confirm(message))return
    onSaving(true);onError("")
    try{
      if(needsCheckin){const{error:checkinError}=await supabase.rpc("hl_checkin_reservation_atomic",{p_reserva_id:Number(item.id)});if(checkinError)throw checkinError}
      const{data,error}=await supabase.rpc("hl_checkout_reservation_guest_atomic",{p_guest_id:guest.id})
      if(error)throw error
      await onRefresh?.(guest.id)
      await onReservationChanged?.()
      onNotice?.(`Check-out de ${guest.full_name} realizado a las ${fmtDateTime(data?.checked_out_at)}. Los demás pasajeros y la habitación continúan activos.`)
    }catch(err){onError(err?.message||"No se pudo realizar el check-out del pasajero.")}
    finally{onSaving(false)}
  }

  if(selectedGuest?.checked_out_at)return <span style={{padding:"6px 9px",borderRadius:999,background:"color-mix(in srgb,#586577 9%,var(--panelSolid))",color:"var(--muted)",fontSize:9.5,fontWeight:900}}>Check-out · {fmtDateTime(selectedGuest.checked_out_at)}</span>
  return selectedGuest&&!String(selectedGuest.id||"").startsWith("new-")&&!blockedReservation(item)
    ?<button type="button" onClick={checkoutGuest} disabled={saving} style={button}>Hacer check-out pasajero</button>
    :null
}
