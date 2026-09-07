"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./reservationGroupCheckout.module.css"

const roomIds=item=>[...new Set([item?.habitacion_id,...(item?.habitaciones_ids||[])].filter(Boolean).map(Number))]

export default function ReservationGroupCheckoutDialog({item,rooms=[],propertyId,onClose,onCheckoutAll}){
  const[guests,setGuests]=useState([]),[loading,setLoading]=useState(true),[working,setWorking]=useState(false),[error,setError]=useState(""),[confirmTarget,setConfirmTarget]=useState(null)
  const assigned=useMemo(()=>roomIds(item).map(id=>rooms.find(room=>Number(room.id)===id)||{id,nombre:String(id),tipo:"Habitación"}),[item,rooms])
  const checkoutDates=item?.room_checkout_dates||{}
  const activeRooms=assigned.filter(room=>!checkoutDates[String(room.id)])

  useEffect(()=>{
    let cancelled=false
    async function loadGuests(){
      setLoading(true)
      const{data,error:loadError}=await supabase.from("hotel_reservation_guests").select("id,room_id,checked_out_at").eq("property_id",propertyId).eq("reservation_id",Number(item.id))
      if(cancelled)return
      if(loadError)setError(loadError.message||"No se pudieron cargar los pasajeros por habitación.")
      else setGuests(data||[])
      setLoading(false)
    }
    loadGuests()
    return()=>{cancelled=true}
  },[item.id,propertyId])

  function roomStats(room){
    const all=guests.filter(guest=>Number(guest.room_id)===Number(room.id))
    const active=all.filter(guest=>!guest.checked_out_at)
    return{all:all.length,active:active.length}
  }

  async function confirmCheckout(){
    if(!confirmTarget||working)return
    if(confirmTarget.kind==="all"||(confirmTarget.kind==="room"&&activeRooms.length===1)){
      onClose?.()
      onCheckoutAll?.()
      return
    }
    const room=confirmTarget.room
    setWorking(true);setError("")
    try{
      const{data,error:rpcError}=await supabase.rpc("hl_checkout_reservation_room_atomic",{p_reserva_id:Number(item.id),p_room_id:Number(room.id)})
      if(rpcError)throw rpcError
      if(typeof window!=="undefined"){
        window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(item.id)}}))
        window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:`Check-out Hab. ${room.nombre}`,message:data?.finalized?"La última habitación quedó liberada y la estadía se finalizó.":`Habitación ${room.nombre} liberada. La reserva grupal continúa con las demás habitaciones.`}}))
      }
      onClose?.()
    }catch(err){setError(err?.message||`No se pudo hacer el check-out de la Habitación ${room.nombre}.`)}
    finally{setWorking(false)}
  }

  const confirmation=confirmTarget?(
    <div className={s.confirmPane}>
      <span className={s.warningIcon}>!</span>
      <small>CONFIRMAR CHECK-OUT</small>
      <h3>{confirmTarget.kind==="all"?"Vas a hacer check-out de todas las habitaciones":`Vas a hacer check-out de la Habitación ${confirmTarget.room.nombre}`}</h3>
      <p>{confirmTarget.kind==="all"
        ?`Se liberarán las ${activeRooms.length} habitaciones que todavía están en hotel y la estadía quedará finalizada.`
        :activeRooms.length===1
          ?"Es la última habitación activa: al confirmarla se finalizará la estadía completa."
          :"Se liberará únicamente esta habitación. Las demás habitaciones del grupo seguirán activas."}</p>
      <div className={s.confirmWarning}>Esta acción cambia el estado operativo de la habitación y no debe ejecutarse por error.</div>
      <div className={s.confirmActions}>
        <button type="button" className={s.secondary} disabled={working} onClick={()=>setConfirmTarget(null)}>No, volver</button>
        <button type="button" className={s.primary} disabled={working} onClick={confirmCheckout}>{working?"Procesando…":"Sí, confirmar check-out"}</button>
      </div>
    </div>
  ):null

  return <div className={s.overlay} onMouseDown={event=>event.target===event.currentTarget&&!working&&onClose?.()}>
    <section className={s.dialog} role="dialog" aria-modal="true" aria-label="Check-out de reserva grupal">
      <header className={s.header}>
        <div><small>CHECK-OUT DE GRUPO</small><h2>{item.nombre_huesped}</h2><p>Elegí qué habitación querés liberar. El check-out general sigue siendo la acción principal.</p></div>
        <button type="button" className={s.close} disabled={working} onClick={onClose}>×</button>
      </header>
      {error?<div className={s.error}>{error}</div>:null}
      {confirmation||<>
        <div className={s.summary}><b>{activeRooms.length} de {assigned.length}</b><span>habitaciones todavía en hotel</span></div>
        <div className={s.grid}>
          {assigned.map(room=>{
            const checkedDate=checkoutDates[String(room.id)],stats=roomStats(room)
            return <article key={room.id} className={`${s.roomCard} ${checkedDate?s.checked:""}`}>
              <div className={s.roomHead}><div><b>Hab. {room.nombre}</b><small>{room.tipo||"Habitación"}</small></div><span>{checkedDate?"CHECK-OUT":"EN HOTEL"}</span></div>
              <p>{loading?"Cargando pasajeros…":`${stats.all} huésped${stats.all===1?"":"es"} · ${stats.active} activo${stats.active===1?"":"s"}`}</p>
              {checkedDate?<div className={s.done}>Liberada el {checkedDate}</div>:<button type="button" disabled={working||item.estado!=="alojado"} onClick={()=>setConfirmTarget({kind:"room",room})}>Hacer check-out Hab. {room.nombre}</button>}
            </article>
          })}
        </div>
        <div className={s.allSection}>
          <div><b>Finalizar toda la reserva</b><small>Libera todas las habitaciones activas en una sola acción.</small></div>
          <button type="button" className={s.allButton} disabled={working||!activeRooms.length||item.estado!=="alojado"} onClick={()=>setConfirmTarget({kind:"all"})}>Hacer check-out a todas las habitaciones</button>
        </div>
      </>}
    </section>
  </div>
}
