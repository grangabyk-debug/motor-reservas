"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./planningUnassigned.module.css"

const ACTIONABLE_STATE=new Set(["overbooked","partial","unassigned"])
const ACTIONABLE_UNIT=new Set(["overbooked","unassigned"])
const CLOSED_RESERVATION=new Set(["cancelada","cancelled","anulada","canceled","finalizada"])
const CLOSED_REVISION=new Set(["cancelled","canceled","anulada","cancelada"])
const assignedIds=item=>new Set([item?.habitacion_id,...(item?.habitaciones_ids||[])].filter(Boolean).map(Number))
const roomHas=(item,roomId)=>Number(item?.habitacion_id)===Number(roomId)||(item?.habitaciones_ids||[]).map(Number).includes(Number(roomId))
const overlaps=(item,start,end)=>item?.fecha_entrada<end&&item?.fecha_salida>start
const normalize=value=>String(value||"").trim().toLocaleLowerCase("es")
const formatDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${value}T12:00:00`)).replace(".",""):"—"
function toast(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}
function pendingReason({unitStatus,stateStatus}){
  if(unitStatus==="overbooked"&&stateStatus==="partial")return"La OTA vendió una categoría válida. Otras unidades de la reserva ya están asignadas, pero esta quedó sin habitación física disponible."
  if(unitStatus==="overbooked")return"La OTA vendió una categoría válida, pero no quedó ninguna habitación física compatible disponible para esas fechas."
  if(stateStatus==="partial")return"La reserva tiene varias habitaciones y esta unidad sigue pendiente de asignación manual."
  return"La unidad está correctamente mapeada y necesita una habitación física antes de quedar resuelta."
}

export default function PlanningUnassigned({propertyId,days,reservations=[],rooms=[],availabilityItems=[],grid}){
  const[channelStates,setChannelStates]=useState([]),[channelRooms,setChannelRooms]=useState([]),[open,setOpen]=useState(false),[loading,setLoading]=useState(false),[assigning,setAssigning]=useState(""),[choices,setChoices]=useState({}),[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId){setChannelStates([]);setChannelRooms([]);return}
    setLoading(true);setError("")
    try{
      const{data:states,error:stateError}=await supabase.from("hotel_channel_booking_state").select("id,reservation_id,booking_id,ota_reservation_code,channel_code,ota_name,room_count,assignment_status,overbooked,conflict_state,last_revision_status,updated_at").eq("property_id",propertyId).not("reservation_id","is",null).in("assignment_status",["overbooked","partial","unassigned"])
      if(stateError)throw stateError
      const actionable=(states||[]).filter(row=>ACTIONABLE_STATE.has(normalize(row.assignment_status))&&normalize(row.conflict_state)!=="mapping_required"&&!CLOSED_REVISION.has(normalize(row.last_revision_status)))
      const ids=actionable.map(row=>row.id)
      let units=[]
      if(ids.length){
        const{data,error:roomError}=await supabase.from("hotel_channel_booking_rooms").select("id,booking_state_id,room_index,ota_unique_id,external_room_type_id,external_rate_plan_id,local_room_type_id,local_room_type,local_room_id,arrival_date,departure_date,guests,assignment_status").in("booking_state_id",ids)
        if(roomError)throw roomError
        units=data||[]
      }
      setChannelStates(actionable);setChannelRooms(units)
    }catch(err){setError(err?.message||"No se pudieron revisar las reservas pendientes de asignación.")}finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])
  useEffect(()=>{if(!propertyId)return;let timer=null;const refresh=()=>{if(timer)clearTimeout(timer);timer=setTimeout(load,100)},channel=supabase.channel(`hl-planning-unassigned-${propertyId}`).on("postgres_changes",{event:"*",schema:"public",table:"hotel_channel_booking_state",filter:`property_id=eq.${propertyId}`},refresh).subscribe();return()=>{if(timer)clearTimeout(timer);supabase.removeChannel(channel)}},[propertyId,load])

  const reservationById=useMemo(()=>{const map=new Map();for(const reservation of reservations)if(!map.has(Number(reservation.id)))map.set(Number(reservation.id),reservation);return map},[reservations])
  const stateById=useMemo(()=>new Map(channelStates.map(row=>[row.id,row])),[channelStates])
  const pending=useMemo(()=>channelRooms.flatMap(unit=>{
    const state=stateById.get(unit.booking_state_id),reservation=state?reservationById.get(Number(state.reservation_id)):null,stateStatus=normalize(state?.assignment_status),unitStatus=normalize(unit.assignment_status)
    if(!state||!reservation||CLOSED_RESERVATION.has(normalize(reservation.estado))||reservation.no_show||!ACTIONABLE_STATE.has(stateStatus)||normalize(state.conflict_state)==="mapping_required"||CLOSED_REVISION.has(normalize(state.last_revision_status))||!unit.local_room_type_id||unit.local_room_id||!ACTIONABLE_UNIT.has(unitStatus))return[]
    const overbooked=unitStatus==="overbooked",bookingCode=state.ota_reservation_code||state.booking_id||reservation.numero_reserva||reservation.id
    return[{key:`channel-${unit.id}`,kind:"channel",bookingRoomId:unit.id,reservationId:reservation.id,reservation,arrival:unit.arrival_date||reservation.fecha_entrada,departure:unit.departure_date||reservation.fecha_salida,roomTypeId:unit.local_room_type_id,roomType:unit.local_room_type||"Categoría OTA",guests:unit.guests||reservation.cantidad_huespedes||1,ota:state.ota_name||reservation.canal_reserva||"OTA",bookingCode,roomIndex:unit.room_index,stateStatus,unitStatus,overbooked,reason:pendingReason({unitStatus,stateStatus})}]
  }),[channelRooms,stateById,reservationById])

  useEffect(()=>{if(open&&!loading&&!pending.length)setOpen(false)},[open,loading,pending.length])

  const availableRooms=useCallback(item=>{
    const alreadyAssigned=assignedIds(item.reservation)
    return rooms.filter(room=>{
      if(room.activa===false||["mantenimiento","fuera_servicio"].includes(normalize(room.estado))||alreadyAssigned.has(Number(room.id)))return false
      if(item.roomType&&normalize(room.tipo)!==normalize(item.roomType))return false
      return !availabilityItems.some(existing=>Number(existing.id)!==Number(item.reservationId)&&roomHas(existing,room.id)&&overlaps(existing,item.arrival,item.departure))
    }).sort((a,b)=>String(a.nombre||"").localeCompare(String(b.nombre||""),"es",{numeric:true}))
  },[rooms,availabilityItems])

  async function assign(item){
    const roomId=Number(choices[item.key]);if(!roomId)return
    setAssigning(item.key);setError("")
    try{
      const{data:result,error:rpcError}=await supabase.rpc("hl_assign_channel_booking_room_atomic",{p_booking_room_id:item.bookingRoomId,p_habitacion_id:roomId});if(rpcError)throw rpcError
      setChoices(current=>{const next={...current};delete next[item.key];return next})
      await load()
      if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:item.reservationId}}))
      const remaining=Number(result?.remaining_pending)||0
      toast({tone:"success",title:remaining?"Unidad asignada":"Overbooking resuelto",message:remaining?`La habitación quedó asignada. La reserva todavía tiene ${remaining} unidad${remaining===1?"":"es"} pendiente${remaining===1?"":"s"}.`:`La reserva de ${item.reservation?.nombre_huesped||"huésped"} quedó completamente asignada.`})
    }catch(err){setError(err?.message||"No se pudo asignar la habitación. El Planning no fue modificado.")}finally{setAssigning("")}
  }

  if(!pending.length)return null
  const counts=days.map(day=>pending.filter(item=>item.arrival<=day&&item.departure>day).length)
  return <>
    <div className={s.row}>
      <button type="button" className={s.label} onClick={()=>setOpen(true)} title="Abrir pendientes reales de asignación"><b>Sin asignar</b><small>{pending.length}</small></button>
      <div className={s.days} style={grid}>{days.map((day,index)=><button type="button" key={day} style={{borderRight:"1px solid color-mix(in srgb,var(--muted) 48%,var(--line))"}} data-active={counts[index]>0?"true":"false"} onClick={()=>counts[index]>0&&setOpen(true)} aria-label={counts[index]>0?`${counts[index]} pendiente${counts[index]===1?"":"s"} de asignación el ${day}`:`Sin pendientes el ${day}`}>{counts[index]||"·"}</button>)}</div>
    </div>
    {open?<div className={s.backdrop} onMouseDown={event=>event.target===event.currentTarget&&setOpen(false)}><section className={s.dialog} role="dialog" aria-modal="true" aria-label="Pendientes de asignación"><header><div><small>PLANNING · ACCIÓN REQUERIDA</small><h2>Pendientes de asignación</h2><p>Acá aparecen únicamente unidades OTA que tienen una categoría válida y todavía necesitan una habitación física. Los conflictos de mapeo se resuelven en Channel Manager y no se muestran como overbooking.</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar">×</button></header>{error?<div className={s.error}>{error}</div>:null}<div className={s.list}>{pending.map(item=>{const candidates=availableRooms(item),choice=choices[item.key]||"",badge=item.overbooked?(item.stateStatus==="partial"?"Overbooking · parcial":"Overbooking real"):(item.stateStatus==="partial"?"Asignación parcial":"Sin asignar");return <article key={item.key} className={s.card} data-overbooked={item.overbooked?"true":"false"}><div className={s.cardTop}><div><span className={item.overbooked?s.danger:s.pending}>{badge}</span><h3>{item.reservation?.nombre_huesped||"Huésped"}</h3><p>{item.ota} · Reserva {item.bookingCode} · {formatDate(item.arrival)} → {formatDate(item.departure)} · {item.guests} pax</p></div><strong>{item.roomType}</strong></div><div style={{marginTop:10,padding:"9px 10px",borderRadius:11,background:"color-mix(in srgb,var(--muted) 6%,var(--panelSolid))",fontSize:12,lineHeight:1.45,color:"var(--muted)"}}><b style={{color:"var(--text)"}}>Motivo:</b> {item.reason}</div><div className={s.assignRow}>{candidates.length?<><select value={choice} onChange={event=>setChoices(current=>({...current,[item.key]:event.target.value}))} aria-label={`Habitación para ${item.reservation?.nombre_huesped||"la reserva"}`}><option value="">Elegir habitación compatible libre…</option>{candidates.map(room=><option key={room.id} value={room.id}>{room.nombre} · {room.tipo||"Habitación"}</option>)}</select><button type="button" onClick={()=>assign(item)} disabled={!choice||assigning===item.key}>{assigning===item.key?"Comprobando y asignando…":"Asignar habitación"}</button></>:<div className={s.noRoom}>No hay una habitación libre compatible para esas fechas. El pendiente queda visible hasta que se libere una unidad válida o cambie el inventario.</div>}</div></article>})}</div><footer><span>{pending.length} unidad{pending.length===1?"":"es"} pendiente{pending.length===1?"":"s"}</span><button type="button" onClick={load} disabled={loading}>{loading?"Actualizando…":"Actualizar"}</button></footer></section></div>:null}
  </>
}
