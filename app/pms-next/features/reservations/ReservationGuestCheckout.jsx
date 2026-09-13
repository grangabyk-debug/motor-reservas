"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const blockedReservation=item=>item?.estado==="cancelada"||item?.estado==="finalizada"||Boolean(item?.no_show)

export default function ReservationGuestCheckout({item,rooms=[],selectedGuest,saving,onSaving,onRefresh,onReservationChanged,onNotice,onError}){
  const[stay,setStay]=useState({roomId:"",from:"",to:""}),[staySaving,setStaySaving]=useState(false)
  useEffect(()=>{setStay({roomId:selectedGuest?.room_id?String(selectedGuest.room_id):String(item?.habitacion_id||""),from:selectedGuest?.stay_from||item?.fecha_entrada||"",to:selectedGuest?.stay_to||item?.fecha_salida||""})},[selectedGuest?.id,selectedGuest?.room_id,selectedGuest?.stay_from,selectedGuest?.stay_to,item?.fecha_entrada,item?.fecha_salida,item?.habitacion_id])
  const button={height:34,padding:"0 11px",border:"1px solid color-mix(in srgb,var(--accent) 28%,var(--line))",borderRadius:9,background:"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:10,fontWeight:850},control={height:34,width:"100%",border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",padding:"0 8px",font:"inherit",fontSize:10,fontWeight:750,boxSizing:"border-box"}

  async function saveStay(){
    const guest=selectedGuest;if(staySaving||saving||!guest||String(guest.id||"").startsWith("new-")||guest.checked_out_at||blockedReservation(item))return
    if(!stay.roomId||!stay.from||!stay.to||stay.to<=stay.from){onError?.("La salida del pasajero debe ser posterior a su entrada.");return}
    setStaySaving(true);onError?.("")
    try{const{data,error}=await supabase.rpc("hl_update_reservation_guest_stay_atomic",{p_guest_id:guest.id,p_room_id:Number(stay.roomId),p_stay_from:stay.from,p_stay_to:stay.to});if(error)throw error;await onRefresh?.(data?.id||guest.id);await onReservationChanged?.();if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(item.id)}}));const extended=stay.to>String(item.fecha_salida||"");onNotice?.(extended?`${guest.full_name} quedó extendido hasta ${stay.to}. La habitación, la tarifa y el folio se actualizaron para el nuevo tramo.`:`Estadía de ${guest.full_name} actualizada: ${stay.from} → ${stay.to}.`) }catch(err){onError?.(err?.message||"No se pudo actualizar la estadía del pasajero.")}finally{setStaySaving(false)}
  }

  async function checkoutGuest(){
    const guest=selectedGuest
    if(saving||staySaving||!guest||guest.checked_out_at||String(guest.id||"").startsWith("new-")||blockedReservation(item))return
    const needsCheckin=item.estado!=="alojado",name=guest.full_name||"este pasajero"
    const message=needsCheckin?`¿Desea hacer check-out de ${name}? La reserva todavía figura como ${item.estado||"confirmada"}. Para registrar una salida real, se hará primero el check-in operativo de la reserva y después el check-out sólo de este pasajero. Los demás pasajeros y la habitación seguirán activos.`:`¿Desea hacer check-out de ${name}? La habitación seguirá ocupada hasta realizar el check-out principal de la habitación o del grupo.`
    if(!window.confirm(message))return
    onSaving(true);onError("")
    try{if(needsCheckin){const{error:checkinError}=await supabase.rpc("hl_checkin_reservation_atomic",{p_reserva_id:Number(item.id)});if(checkinError)throw checkinError}const{data,error}=await supabase.rpc("hl_checkout_reservation_guest_atomic",{p_guest_id:guest.id});if(error)throw error;await onRefresh?.(guest.id);await onReservationChanged?.();if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(item.id)}}));onNotice?.(`Check-out de ${guest.full_name} realizado a las ${fmtDateTime(data?.checked_out_at)}. Los demás pasajeros y la habitación continúan activos.`)}catch(err){onError(err?.message||"No se pudo realizar el check-out del pasajero.")}finally{onSaving(false)}
  }

  if(selectedGuest?.checked_out_at)return <span style={{padding:"6px 9px",borderRadius:999,background:"color-mix(in srgb,#586577 9%,var(--panelSolid))",color:"var(--muted)",fontSize:9.5,fontWeight:900}}>Check-out · {fmtDateTime(selectedGuest.checked_out_at)}</span>
  if(!selectedGuest||String(selectedGuest.id||"").startsWith("new-")||blockedReservation(item))return null
  return <section style={{marginBottom:10,padding:10,border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--bg) 30%,var(--panelSolid))"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8,flexWrap:"wrap"}}><div><b style={{display:"block",fontSize:10.5}}>Estadía de este pasajero</b><small style={{display:"block",marginTop:2,fontSize:9.2,color:"var(--muted)"}}>Puede tener habitación y fechas propias dentro de la reserva grupal.</small></div><button type="button" onClick={checkoutGuest} disabled={saving||staySaving} style={button}>Hacer check-out pasajero</button></div>
    <div style={{display:"grid",gridTemplateColumns:"1.15fr 1fr 1fr auto",gap:7,alignItems:"end"}}><label style={{display:"grid",gap:4,fontSize:9,fontWeight:850,color:"var(--muted)"}}>Habitación<select value={stay.roomId} onChange={e=>setStay(v=>({...v,roomId:e.target.value}))} style={control}>{rooms.map(room=><option key={room.id} value={room.id}>Hab. {room.nombre}</option>)}</select></label><label style={{display:"grid",gap:4,fontSize:9,fontWeight:850,color:"var(--muted)"}}>Entrada<input type="date" value={stay.from} onChange={e=>setStay(v=>({...v,from:e.target.value}))} style={control}/></label><label style={{display:"grid",gap:4,fontSize:9,fontWeight:850,color:"var(--muted)"}}>Salida<input type="date" value={stay.to} onChange={e=>setStay(v=>({...v,to:e.target.value}))} style={control}/></label><button type="button" onClick={saveStay} disabled={saving||staySaving} style={{...button,height:34,whiteSpace:"nowrap"}}>{staySaving?"Guardando…":"Guardar estadía"}</button></div>
    <style>{`@media(max-width:720px){section[style*="grid-template-columns: 1.15fr"]>div{grid-template-columns:1fr!important}}`}</style>
  </section>
}
