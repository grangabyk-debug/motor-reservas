"use client"

import{supabase}from"../../../../lib/supabase"

const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"

export default function ReservationGuestCheckout({item,selectedGuest,saving,onSaving,onRefresh,onNotice,onError}){
  const button={height:34,padding:"0 11px",border:"1px solid color-mix(in srgb,var(--accent) 28%,var(--line))",borderRadius:9,background:"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:10,fontWeight:850}

  async function checkoutGuest(){
    const guest=selectedGuest
    if(saving||!guest||guest.checked_out_at||String(guest.id||"").startsWith("new-"))return
    if(!window.confirm(`¿Desea hacer check-out de ${guest.full_name||"este pasajero"}? La habitación seguirá ocupada hasta realizar el check-out principal de la habitación o del grupo.`))return
    onSaving(true);onError("")
    try{
      const{data,error}=await supabase.rpc("hl_checkout_reservation_guest_atomic",{p_guest_id:guest.id})
      if(error)throw error
      await onRefresh?.(guest.id)
      onNotice?.(`Check-out de ${guest.full_name} realizado a las ${fmtDateTime(data?.checked_out_at)}. La habitación continúa ocupada.`)
    }catch(err){onError(err?.message||"No se pudo realizar el check-out del pasajero.")}
    finally{onSaving(false)}
  }

  return selectedGuest&&!selectedGuest.checked_out_at&&!String(selectedGuest.id||"").startsWith("new-")&&item.estado==="alojado"
    ?<button type="button" onClick={checkoutGuest} disabled={saving} style={button}>Hacer check-out pasajero</button>
    :selectedGuest?.checked_out_at
      ?<span style={{padding:"6px 9px",borderRadius:999,background:"color-mix(in srgb,#586577 9%,var(--panelSolid))",color:"var(--muted)",fontSize:9.5,fontWeight:900}}>Check-out · {fmtDateTime(selectedGuest.checked_out_at)}</span>
      :null
}
