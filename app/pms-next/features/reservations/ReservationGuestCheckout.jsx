"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"

export default function ReservationGuestCheckout({item,rooms=[],guests=[],selectedGuest,propertyId,saving,onSaving,onRefresh,onNotice,onError}){
  const[roomCheckoutDates,setRoomCheckoutDates]=useState(item.room_checkout_dates||{})
  useEffect(()=>setRoomCheckoutDates(item.room_checkout_dates||{}),[item.id,item.room_checkout_dates])
  const assignedRooms=useMemo(()=>{const ids=[...new Set([item.habitacion_id,...(item.habitaciones_ids||[])].filter(Boolean).map(Number))];return ids.map(id=>rooms.find(room=>Number(room.id)===id)||{id,nombre:String(id),tipo:"Habitación"})},[item.habitacion_id,item.habitaciones_ids,rooms])
  const activeRooms=assignedRooms.filter(room=>!roomCheckoutDates[String(room.id)])
  const button={height:34,padding:"0 11px",border:"1px solid color-mix(in srgb,var(--accent) 28%,var(--line))",borderRadius:9,background:"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:10,fontWeight:850}

  async function checkoutGuest(){
    const guest=selectedGuest
    if(saving||!guest||guest.checked_out_at||String(guest.id||"").startsWith("new-"))return
    if(!window.confirm(`Hacer check-out de ${guest.full_name||"este pasajero"}? La habitación seguirá ocupada hasta hacer el check-out de habitación.`))return
    onSaving(true);onError("")
    try{const{data,error}=await supabase.rpc("hl_checkout_reservation_guest_atomic",{p_guest_id:guest.id});if(error)throw error;await onRefresh?.(guest.id);onNotice?.(`Check-out de ${guest.full_name} realizado a las ${fmtDateTime(data?.checked_out_at)}. La habitación no se liberó automáticamente.`)}catch(err){onError(err?.message||"No se pudo realizar el check-out del pasajero.")}finally{onSaving(false)}
  }

  async function checkoutRoom(room){
    if(saving||!room||roomCheckoutDates[String(room.id)])return
    const roomGuests=guests.filter(guest=>Number(guest.room_id)===Number(room.id)&&!guest.checked_out_at),lastActive=activeRooms.length===1
    const suffix=lastActive?" Es la última habitación activa: si la cuenta está saldada, también se finalizará la reserva.":" La reserva grupal seguirá activa con las demás habitaciones."
    if(!window.confirm(`Hacer check-out de la Habitación ${room.nombre}? Se marcarán en salida sus ${roomGuests.length} huésped${roomGuests.length===1?"":"es"} activos y la habitación pasará a limpieza.${suffix}`))return
    onSaving(true);onError("")
    try{const{data,error}=await supabase.rpc("hl_checkout_reservation_room_atomic",{p_reserva_id:Number(item.id),p_room_id:Number(room.id)});if(error)throw error;setRoomCheckoutDates(current=>({...current,[String(room.id)]:data.checkout_date}));await onRefresh?.(selectedGuest?.id);onNotice?.(data.finalized?`Check-out de Habitación ${room.nombre} realizado. Era la última habitación activa y la reserva quedó finalizada.`:`Habitación ${room.nombre} liberada y enviada a limpieza. La reserva continúa con las demás habitaciones.`)}catch(err){onError(err?.message||"No se pudo realizar el check-out de la habitación.")}finally{onSaving(false)}
  }

  return <>
    <section style={{padding:12,border:"1px solid var(--line)",borderRadius:13,background:"color-mix(in srgb,var(--bg) 36%,var(--panelSolid))",marginBottom:10}}><div><h3 style={{margin:0,fontSize:12.5}}>Salida por habitación</h3><p style={{margin:"3px 0 0",fontSize:9.7,color:"var(--muted)"}}>Libera una habitación sin finalizar el resto del grupo. No modifica la tarifa contratada.</p></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:8,marginTop:10}}>{assignedRooms.map(room=>{const checkedDate=roomCheckoutDates[String(room.id)],roomGuests=guests.filter(guest=>Number(guest.room_id)===Number(room.id)),activeGuests=roomGuests.filter(guest=>!guest.checked_out_at);return <div key={room.id} style={{padding:10,border:`1px solid ${checkedDate?"color-mix(in srgb,#2e9b61 28%,var(--line))":"var(--line)"}`,borderRadius:11,background:checkedDate?"color-mix(in srgb,#39a96c 5%,var(--panelSolid))":"var(--panelSolid)"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><span><b style={{fontSize:11}}>Hab. {room.nombre}</b><small style={{display:"block",marginTop:2,color:"var(--muted)",fontSize:9.3}}>{roomGuests.length} huésped{roomGuests.length===1?"":"es"} · {activeGuests.length} activo{activeGuests.length===1?"":"s"}</small></span><span style={{fontSize:9,fontWeight:850,color:checkedDate?"#26794d":"var(--muted)"}}>{checkedDate?"CHECK-OUT":"EN HOTEL"}</span></div>{checkedDate?<small style={{display:"block",marginTop:8,color:"#26794d",fontWeight:800}}>Liberada el {checkedDate} · pendiente de limpieza</small>:<button type="button" disabled={saving||item.estado!=="alojado"} onClick={()=>checkoutRoom(room)} style={{...button,width:"100%",marginTop:8}}>Hacer check-out habitación</button>}</div>})}</div></section>
    {selectedGuest&&!selectedGuest.checked_out_at&&!String(selectedGuest.id||"").startsWith("new-")&&item.estado==="alojado"?<button type="button" onClick={checkoutGuest} disabled={saving} style={button}>Hacer check-out pasajero</button>:selectedGuest?.checked_out_at?<span style={{padding:"6px 9px",borderRadius:999,background:"color-mix(in srgb,#586577 9%,var(--panelSolid))",color:"var(--muted)",fontSize:9.5,fontWeight:900}}>Check-out · {fmtDateTime(selectedGuest.checked_out_at)}</span>:null}
  </>
}