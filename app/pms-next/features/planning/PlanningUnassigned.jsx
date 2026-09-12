"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./planningUnassigned.module.css"

const assignedIds=item=>new Set([item?.habitacion_id,...(item?.habitaciones_ids||[])].filter(Boolean).map(Number))
const roomHas=(item,roomId)=>Number(item?.habitacion_id)===Number(roomId)||(item?.habitaciones_ids||[]).map(Number).includes(Number(roomId))
const overlaps=(item,start,end)=>item?.fecha_entrada<end&&item?.fecha_salida>start
const normalize=value=>String(value||"").trim().toLocaleLowerCase("es")
const formatDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${value}T12:00:00`)).replace(".",""):"—"
function toast(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}

export default function PlanningUnassigned({propertyId,days,reservations=[],rooms=[],availabilityItems=[],grid}){
  const[channelStates,setChannelStates]=useState([]),[channelRooms,setChannelRooms]=useState([]),[open,setOpen]=useState(false),[loading,setLoading]=useState(false),[assigning,setAssigning]=useState(""),[choices,setChoices]=useState({}),[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const{data:states,error:stateError}=await supabase.from("hotel_channel_booking_state").select("id,reservation_id,assignment_status,overbooked,conflict_state,ota_name,room_count,updated_at").eq("property_id",propertyId).not("reservation_id","is",null)
      if(stateError)throw stateError
      const ids=(states||[]).map(row=>row.id)
      let units=[]
      if(ids.length){
        const{data,error:roomError}=await supabase.from("hotel_channel_booking_rooms").select("id,booking_state_id,room_index,local_room_type_id,local_room_type,local_room_id,arrival_date,departure_date,guests,assignment_status").in("booking_state_id",ids)
        if(roomError)throw roomError
        units=data||[]
      }
      setChannelStates(states||[]);setChannelRooms(units)
    }catch(err){setError(err?.message||"No se pudieron revisar las reservas pendientes de asignación.")}finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])
  useEffect(()=>{if(!propertyId)return;let timer=null;const refresh=()=>{if(timer)clearTimeout(timer);timer=setTimeout(load,100)},channel=supabase.channel(`hl-planning-unassigned-${propertyId}`).on("postgres_changes",{event:"*",schema:"public",table:"hotel_channel_booking_state",filter:`property_id=eq.${propertyId}`},refresh).subscribe();return()=>{if(timer)clearTimeout(timer);supabase.removeChannel(channel)}},[propertyId,load])

  const reservationById=useMemo(()=>{const map=new Map();for(const reservation of reservations)if(!map.has(Number(reservation.id)))map.set(Number(reservation.id),reservation);return map},[reservations])
  const stateById=useMemo(()=>new Map(channelStates.map(row=>[row.id,row])),[channelStates])
  const stateByReservation=useMemo(()=>new Map(channelStates.map(row=>[Number(row.reservation_id),row])),[channelStates])
  const pending=useMemo(()=>{
    const channelPending=channelRooms.flatMap(unit=>{
      const state=stateById.get(unit.booking_state_id),reservation=state?reservationById.get(Number(state.reservation_id)):null
      if(!state||!reservation||reservation.estado==="finalizada"||state.conflict_state==="mapping_required"||!unit.local_room_type_id||unit.local_room_id||!["overbooked","unassigned"].includes(unit.assignment_status))return[]
      return[{key:`channel-${unit.id}`,kind:"channel",bookingRoomId:unit.id,reservationId:reservation.id,reservation,arrival:unit.arrival_date||reservation.fecha_entrada,departure:unit.departure_date||reservation.fecha_salida,roomTypeId:unit.local_room_type_id,roomType:unit.local_room_type||"Categoría OTA",guests:unit.guests||reservation.cantidad_huespedes||1,ota:state.ota_name||reservation.canal_reserva||"OTA",overbooked:unit.assignment_status==="overbooked"||Boolean(state.overbooked)}]
    })
    const genericPending=[]
    const seen=new Set()
    for(const reservation of reservations){
      const id=Number(reservation.id);if(seen.has(id))continue;seen.add(id)
      if(reservation.estado==="finalizada"||assignedIds(reservation).size>0||stateByReservation.has(id))continue
      genericPending.push({key:`reservation-${id}`,kind:"reservation",reservationId:id,reservation,arrival:reservation.fecha_entrada,departure:reservation.fecha_salida,roomType:null,guests:reservation.cantidad_huespedes||1,ota:reservation.canal_reserva||"Directa",overbooked:false})
    }
    return[...channelPending,...genericPending]
  },[channelRooms,stateById,stateByReservation,reservationById,reservations])

  useEffect(()=>{if(open&&!loading&&!pending.length)setOpen(false)},[open,loading,pending.length])

  const availableRooms=useCallback(item=>rooms.filter(room=>{
    if(room.activa===false||["mantenimiento","fuera_servicio"].includes(String(room.estado||"").toLowerCase()))return false
    if(item.roomType&&normalize(room.tipo)!==normalize(item.roomType))return false
    return !availabilityItems.some(existing=>Number(existing.id)!==Number(item.reservationId)&&roomHas(existing,room.id)&&overlaps(existing,item.arrival,item.departure))
  }).sort((a,b)=>String(a.nombre||"").localeCompare(String(b.nombre||""),"es",{numeric:true})),[rooms,availabilityItems])

  async function assign(item){
    const roomId=Number(choices[item.key]);if(!roomId)return
    setAssigning(item.key);setError("")
    try{
      if(item.kind==="channel"){
        const{error:rpcError}=await supabase.rpc("hl_assign_channel_booking_room_atomic",{p_booking_room_id:item.bookingRoomId,p_habitacion_id:roomId});if(rpcError)throw rpcError
      }else{
        const{error:rpcError}=await supabase.rpc("hl_planning_move_reservation_priced_atomic",{p_reserva_id:item.reservationId,p_habitacion_id:roomId,p_fecha_entrada:item.arrival,p_fecha_salida:item.departure,p_reprice:false});if(rpcError)throw rpcError
      }
      setChoices(current=>{const next={...current};delete next[item.key];return next})
      await load()
      if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:item.reservationId}}))
      toast({tone:"success",title:"Habitación asignada",message:`La reserva de ${item.reservation?.nombre_huesped||"huésped"} quedó asignada manualmente.`})
    }catch(err){setError(err?.message||"No se pudo asignar la habitación.")}finally{setAssigning("")}
  }

  if(!pending.length)return null
  const counts=days.map(day=>pending.filter(item=>item.arrival<=day&&item.departure>day).length)
  return <>
    <div className={s.row}>
      <button type="button" className={s.label} onClick={()=>setOpen(true)} title="Abrir pendientes de asignación"><b>Sin asignar</b><small>{pending.length}</small></button>
      <div className={s.days} style={grid}>{days.map((day,index)=><button type="button" key={day} style={{borderRight:"1px solid color-mix(in srgb,var(--muted) 48%,var(--line))"}} data-active={counts[index]>0?"true":"false"} onClick={()=>counts[index]>0&&setOpen(true)} aria-label={counts[index]>0?`${counts[index]} pendiente${counts[index]===1?"":"s"} de asignación el ${day}`:`Sin pendientes el ${day}`}>{counts[index]||"·"}</button>)}</div>
    </div>
    {open?<div className={s.backdrop} onMouseDown={event=>event.target===event.currentTarget&&setOpen(false)}><section className={s.dialog} role="dialog" aria-modal="true" aria-label="Pendientes de asignación"><header><div><small>PLANNING · ACCIÓN REQUERIDA</small><h2>Pendientes de asignación</h2><p>Acá aparecen únicamente reservas que sí necesitan una habitación física. Los conflictos de mapeo del Channel Manager no cuentan como overbooking.</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar">×</button></header>{error?<div className={s.error}>{error}</div>:null}<div className={s.list}>{pending.map(item=>{const candidates=availableRooms(item),choice=choices[item.key]||"";return <article key={item.key} className={s.card} data-overbooked={item.overbooked?"true":"false"}><div className={s.cardTop}><div><span className={item.overbooked?s.danger:s.pending}>{item.overbooked?"Overbooking real":"Sin habitación"}</span><h3>{item.reservation?.nombre_huesped||"Huésped"}</h3><p>{item.ota} · {formatDate(item.arrival)} → {formatDate(item.departure)} · {item.guests} pax</p></div><strong>{item.roomType||"Asignación manual"}</strong></div><div className={s.assignRow}>{candidates.length?<><select value={choice} onChange={event=>setChoices(current=>({...current,[item.key]:event.target.value}))} aria-label={`Habitación para ${item.reservation?.nombre_huesped||"la reserva"}`}><option value="">Elegir habitación libre…</option>{candidates.map(room=><option key={room.id} value={room.id}>{room.nombre} · {room.tipo||"Habitación"}</option>)}</select><button type="button" onClick={()=>assign(item)} disabled={!choice||assigning===item.key}>{assigning===item.key?"Asignando…":"Asignar habitación"}</button></>:<div className={s.noRoom}>No hay una habitación libre compatible para esas fechas. El pendiente queda visible hasta que se libere o cambie el inventario.</div>}</div></article>})}</div><footer><span>{pending.length} unidad{pending.length===1?"":"es"} pendiente{pending.length===1?"":"s"}</span><button type="button" onClick={load} disabled={loading}>{loading?"Actualizando…":"Actualizar"}</button></footer></section></div>:null}
  </>
}
