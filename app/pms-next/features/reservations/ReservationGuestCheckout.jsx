"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const blockedReservation=item=>item?.estado==="cancelada"||item?.estado==="finalizada"||Boolean(item?.no_show)

export default function ReservationGuestCheckout({item,rooms=[],selectedGuest,saving,onSaving,onRefresh,onReservationChanged,onNotice,onError}){
  const[stay,setStay]=useState({roomId:"",from:"",to:""}),[staySaving,setStaySaving]=useState(false),[checkoutConfirm,setCheckoutConfirm]=useState(null)
  useEffect(()=>{setStay({roomId:selectedGuest?.room_id?String(selectedGuest.room_id):String(item?.habitacion_id||""),from:selectedGuest?.stay_from||item?.fecha_entrada||"",to:selectedGuest?.stay_to||item?.fecha_salida||""});setCheckoutConfirm(null)},[selectedGuest?.id,selectedGuest?.room_id,selectedGuest?.stay_from,selectedGuest?.stay_to,item?.fecha_entrada,item?.fecha_salida,item?.habitacion_id])
  const button={height:34,padding:"0 11px",border:"1px solid color-mix(in srgb,var(--accent) 28%,var(--line))",borderRadius:9,background:"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:10,fontWeight:850},control={height:34,width:"100%",border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",padding:"0 8px",font:"inherit",fontSize:10,fontWeight:750,boxSizing:"border-box"}

  async function saveStay(){
    const guest=selectedGuest;if(staySaving||saving||!guest||String(guest.id||"").startsWith("new-")||guest.checked_out_at||blockedReservation(item))return
    if(!stay.roomId||!stay.from||!stay.to||stay.to<=stay.from){onError?.("La salida del pasajero debe ser posterior a su entrada.");return}
    setStaySaving(true);onError?.("")
    try{const{data,error}=await supabase.rpc("hl_update_reservation_guest_stay_atomic",{p_guest_id:guest.id,p_room_id:Number(stay.roomId),p_stay_from:stay.from,p_stay_to:stay.to});if(error)throw error;await onRefresh?.(data?.id||guest.id);await onReservationChanged?.();if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(item.id)}}));const extended=stay.to>String(item.fecha_salida||"");onNotice?.(extended?`${guest.full_name} quedó extendido hasta ${stay.to}. La habitación, la tarifa y el folio se actualizaron para el nuevo tramo.`:`Estadía de ${guest.full_name} actualizada: ${stay.from} → ${stay.to}.`) }catch(err){onError?.(err?.message||"No se pudo actualizar la estadía del pasajero.")}finally{setStaySaving(false)}
  }

  function requestCheckout(){
    const guest=selectedGuest
    if(saving||staySaving||!guest||guest.checked_out_at||String(guest.id||"").startsWith("new-")||blockedReservation(item))return
    setCheckoutConfirm({guest,needsCheckin:item.estado!=="alojado"})
  }

  async function confirmCheckout(){
    const guest=checkoutConfirm?.guest,needsCheckin=checkoutConfirm?.needsCheckin
    if(!guest||saving||staySaving)return
    setCheckoutConfirm(null);onSaving(true);onError("")
    try{if(needsCheckin){const roomId=Number(guest.room_id),rpc=Number.isFinite(roomId)?"hl_checkin_reservation_rooms_atomic":"hl_checkin_reservation_atomic",params=Number.isFinite(roomId)?{p_reserva_id:Number(item.id),p_room_ids:[roomId]}:{p_reserva_id:Number(item.id)},{error:checkinError}=await supabase.rpc(rpc,params);if(checkinError)throw checkinError}const{data,error}=await supabase.rpc("hl_checkout_reservation_guest_atomic",{p_guest_id:guest.id});if(error)throw error;await onRefresh?.(guest.id);await onReservationChanged?.();if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(item.id)}}));onNotice?.(`Check-out de ${guest.full_name} realizado a las ${fmtDateTime(data?.checked_out_at)}. Los demás pasajeros y la habitación continúan activos.`)}catch(err){onError(err?.message||"No se pudo realizar el check-out del pasajero.")}finally{onSaving(false)}
  }

  if(selectedGuest?.checked_out_at)return <span style={{padding:"6px 9px",borderRadius:999,background:"color-mix(in srgb,#586577 9%,var(--panelSolid))",color:"var(--muted)",fontSize:9.5,fontWeight:900}}>Check-out · {fmtDateTime(selectedGuest.checked_out_at)}</span>
  if(!selectedGuest||String(selectedGuest.id||"").startsWith("new-")||blockedReservation(item))return null
  const guestName=checkoutConfirm?.guest?.full_name||selectedGuest.full_name||"este pasajero",roomName=rooms.find(room=>Number(room.id)===Number(checkoutConfirm?.guest?.room_id||selectedGuest.room_id))?.nombre||checkoutConfirm?.guest?.room_id||selectedGuest.room_id||"—"
  return <>
    <section style={{marginBottom:10,padding:10,border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--bg) 30%,var(--panelSolid))"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8,flexWrap:"wrap"}}><div><b style={{display:"block",fontSize:10.5}}>Estadía de este pasajero</b><small style={{display:"block",marginTop:2,fontSize:9.2,color:"var(--muted)"}}>Puede tener habitación y fechas propias dentro de la reserva grupal.</small></div><button type="button" onClick={requestCheckout} disabled={saving||staySaving} style={button}>Hacer check-out pasajero</button></div>
      <div style={{display:"grid",gridTemplateColumns:"1.15fr 1fr 1fr auto",gap:7,alignItems:"end"}}><label style={{display:"grid",gap:4,fontSize:9,fontWeight:850,color:"var(--muted)"}}>Habitación<select value={stay.roomId} onChange={e=>setStay(v=>({...v,roomId:e.target.value}))} style={control}>{rooms.map(room=><option key={room.id} value={room.id}>Hab. {room.nombre}</option>)}</select></label><label style={{display:"grid",gap:4,fontSize:9,fontWeight:850,color:"var(--muted)"}}>Entrada<input type="date" value={stay.from} onChange={e=>setStay(v=>({...v,from:e.target.value}))} style={control}/></label><label style={{display:"grid",gap:4,fontSize:9,fontWeight:850,color:"var(--muted)"}}>Salida<input type="date" value={stay.to} onChange={e=>setStay(v=>({...v,to:e.target.value}))} style={control}/></label><button type="button" onClick={saveStay} disabled={saving||staySaving} style={{...button,height:34,whiteSpace:"nowrap"}}>{staySaving?"Guardando…":"Guardar estadía"}</button></div>
      <style>{`@media(max-width:720px){section[style*="grid-template-columns: 1.15fr"]>div{grid-template-columns:1fr!important}}`}</style>
    </section>
    {checkoutConfirm?<div role="presentation" onMouseDown={event=>event.target===event.currentTarget&&setCheckoutConfirm(null)} style={{position:"fixed",inset:0,zIndex:360,display:"grid",placeItems:"center",padding:16,background:"rgba(12,20,38,.34)",backdropFilter:"blur(11px) saturate(1.08)",WebkitBackdropFilter:"blur(11px) saturate(1.08)"}}>
      <section role="dialog" aria-modal="true" aria-label="Confirmar check-out del pasajero" style={{width:"min(430px,calc(100vw - 28px))",padding:18,border:"1px solid color-mix(in srgb,#fff 38%,var(--line))",borderRadius:22,background:"color-mix(in srgb,var(--panelSolid) 94%,transparent)",boxShadow:"0 28px 85px rgba(18,30,58,.32),inset 0 1px color-mix(in srgb,#fff 60%,transparent)",backdropFilter:"blur(30px) saturate(1.35)"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}><span style={{width:42,height:42,flex:"0 0 42px",display:"grid",placeItems:"center",borderRadius:13,background:"color-mix(in srgb,var(--accent) 11%,var(--panelSolid))",color:"var(--accent)",fontSize:19,fontWeight:900}}>↗</span><div style={{minWidth:0}}><small style={{display:"block",fontSize:9,fontWeight:900,letterSpacing:".09em",color:"var(--accent)"}}>CHECK-OUT DE PASAJERO</small><h3 style={{margin:"4px 0 0",fontSize:18,lineHeight:1.2}}>Confirmar salida de {guestName}</h3><p style={{margin:"7px 0 0",fontSize:10.5,lineHeight:1.5,color:"var(--muted)"}}>Habitación {roomName}. {checkoutConfirm.needsCheckin?"La reserva todavía no figura alojada: el sistema hará primero el check-in operativo y luego registrará únicamente la salida de este pasajero.":"La habitación y los demás pasajeros seguirán activos después de esta salida."}</p></div></div>
        <div style={{marginTop:14,padding:"10px 11px",border:"1px solid color-mix(in srgb,#d99b2b 20%,var(--line))",borderRadius:12,background:"color-mix(in srgb,#d99b2b 7%,var(--panelSolid))",fontSize:10,lineHeight:1.45,color:"var(--muted)"}}><b style={{color:"var(--text)"}}>Sólo se hará check-out de este pasajero.</b> No finaliza la habitación ni la reserva grupal.</div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><button type="button" onClick={()=>setCheckoutConfirm(null)} style={{height:40,padding:"0 14px",border:"1px solid var(--line)",borderRadius:11,background:"var(--panel)",color:"var(--text)",font:"inherit",fontSize:10.5,fontWeight:820,cursor:"pointer"}}>Cancelar</button><button type="button" onClick={confirmCheckout} style={{height:40,padding:"0 15px",border:0,borderRadius:11,background:"linear-gradient(145deg,var(--accent),var(--accent2))",color:"#fff",font:"inherit",fontSize:10.5,fontWeight:900,cursor:"pointer",boxShadow:"0 9px 22px color-mix(in srgb,var(--accent) 20%,transparent)"}}>Confirmar check-out</button></div>
      </section>
    </div>:null}
  </>
}
