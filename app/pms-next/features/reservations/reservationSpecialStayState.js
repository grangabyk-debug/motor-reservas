const truthy=value=>["true","t","1","yes","on"].includes(String(value??"").toLowerCase())
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))
const historyRoles=new Set(["previous_room","transient_room","cancelled_room","no_show_room"])

const detailsFor=item=>Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
export function reservationRoomDetail(item,id){
  const rows=detailsFor(item).filter(row=>Number(row?.habitacion_id)===Number(id))
  return rows.find(row=>!historyRoles.has(String(row?.segment_role||"").toLowerCase()))||rows[0]||{}
}
const roomStart=(item,id)=>String(reservationRoomDetail(item,id)?.fecha_entrada||item?.fecha_entrada||"").slice(0,10)
const roomEnd=(item,id)=>String(reservationRoomDetail(item,id)?.fecha_salida||item?.fecha_salida||"").slice(0,10)

export function roomSpecialStayEnabled(item,id,kind){
  const detail=reservationRoomDetail(item,id)
  if(kind==="late"&&validDate(item?.room_checkout_dates?.[`late:${id}`]))return true
  const explicit=`${kind}_${kind==="early"?"checkin":"checkout"}_requested`
  if(Object.prototype.hasOwnProperty.call(detail,explicit))return truthy(detail[explicit])
  const timeKey=kind==="early"?"early_checkin_time":"late_checkout_time"
  const netKey=kind==="early"?"early_checkin_net":"late_checkout_net"
  if(detail?.[timeKey]||Number(detail?.[netKey])>0)return true
  return kind==="early"
    ?Boolean(item?.early_checkin)&&roomStart(item,id)===String(item?.fecha_entrada||"").slice(0,10)
    :Boolean(item?.late_checkout)&&roomEnd(item,id)===String(item?.fecha_salida||"").slice(0,10)
}
