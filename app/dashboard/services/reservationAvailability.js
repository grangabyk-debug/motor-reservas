import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"

const roomIds=reservation=>[...new Set([reservation?.habitacion_id,...(Array.isArray(reservation?.habitaciones_ids)?reservation.habitaciones_ids:[])].map(String).filter(Boolean))]
const reservationStart=reservation=>String(reservation?.ocupacion_desde_local||`${reservation?.fecha_entrada||""}T${reservation?.hora_llegada_estimada||"14:00"}:00`).replace(" ","T")
const reservationEnd=reservation=>String(reservation?.ocupacion_hasta_local||`${reservation?.fecha_salida||""}T${reservation?.hora_salida_estimada||"10:00"}:00`).replace(" ","T")

export async function loadUnavailableRoomIds({propertyId,occupancy,excludeReservationId=null}){
  const pid=requirePropertyId(propertyId)
  if(!occupancy?.valid)return{busyIds:[],blockedIds:[]}
  const[reservationResult,blockResult]=await Promise.all([
    supabase.from("reservas").select("id,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,hora_llegada_estimada,hora_salida_estimada,ocupacion_desde_local,ocupacion_hasta_local,estado,no_show").eq("property_id",pid).neq("estado","cancelada").eq("no_show",false).lte("fecha_entrada",occupancy.end).gte("fecha_salida",occupancy.start),
    supabase.from("bloqueos").select("id,habitacion_id,fecha_desde,fecha_hasta,motivo,detalle").eq("property_id",pid).lte("fecha_desde",occupancy.end).gte("fecha_hasta",occupancy.start),
  ])
  if(reservationResult.error)throw reservationResult.error
  if(blockResult.error)throw blockResult.error
  const busyIds=new Set(),blockedIds=new Set()
  ;(reservationResult.data||[]).forEach(reservation=>{
    if(String(reservation.id)===String(excludeReservationId||""))return
    if(reservationStart(reservation)<occupancy.endAt&&reservationEnd(reservation)>occupancy.startAt)roomIds(reservation).forEach(id=>busyIds.add(id))
  })
  ;(blockResult.data||[]).forEach(block=>{
    const from=`${block.fecha_desde}T00:00:00`,to=`${block.fecha_hasta}T00:00:00`
    if(from<occupancy.endAt&&to>occupancy.startAt)blockedIds.add(String(block.habitacion_id))
  })
  return{busyIds:[...busyIds],blockedIds:[...blockedIds]}
}
