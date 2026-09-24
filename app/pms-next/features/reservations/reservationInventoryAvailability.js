const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))
const truthy=value=>["true","t","1","yes","on"].includes(String(value??"").toLowerCase())
const dateShift=(value,days)=>{if(!validDate(value))return"";const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
const details=item=>Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
export const reservationRoomDetail=(item,roomId)=>details(item).find(row=>Number(row?.habitacion_id)===Number(roomId))||{}
export const reservationRoomStart=(item,roomId)=>{const value=reservationRoomDetail(item,roomId)?.fecha_entrada;return validDate(value)?String(value):String(item?.fecha_entrada||"")}
export const reservationRoomPlannedEnd=(item,roomId)=>{const value=reservationRoomDetail(item,roomId)?.fecha_salida;return validDate(value)?String(value):String(item?.fecha_salida||"")}
const checkoutDate=(item,roomId)=>{const value=item?.room_checkout_dates?.[String(roomId)];return validDate(value)?String(value):""}
const earlyEnabled=(item,roomId,start)=>{const detail=reservationRoomDetail(item,roomId);if(Object.prototype.hasOwnProperty.call(detail,"early_checkin_requested"))return truthy(detail.early_checkin_requested);if(detail?.early_checkin_time||Number(detail?.early_checkin_net)>0)return true;return Boolean(item?.early_checkin)&&start===String(item?.fecha_entrada||"")}
const lateEnabled=(item,roomId,end)=>{const detail=reservationRoomDetail(item,roomId),lateDate=item?.room_checkout_dates?.[`late:${roomId}`];if(validDate(lateDate))return true;if(Object.prototype.hasOwnProperty.call(detail,"late_checkout_requested"))return truthy(detail.late_checkout_requested);if(detail?.late_checkout_time||Number(detail?.late_checkout_net)>0)return true;return Boolean(item?.late_checkout)&&end===String(item?.fecha_salida||"")}
export function reservationRoomInventoryWindow(item,roomId){
  const start=reservationRoomStart(item,roomId),plannedEnd=reservationRoomPlannedEnd(item,roomId),released=checkoutDate(item,roomId),lateDate=item?.room_checkout_dates?.[`late:${roomId}`]
  const inventoryStart=earlyEnabled(item,roomId,start)?dateShift(start,-1):start
  let inventoryEnd=plannedEnd
  if(released&&released<plannedEnd)inventoryEnd=released
  else if(validDate(lateDate)&&String(lateDate)>plannedEnd)inventoryEnd=String(lateDate)
  else if(lateEnabled(item,roomId,plannedEnd))inventoryEnd=dateShift(plannedEnd,1)
  return{start:inventoryStart,end:inventoryEnd,plannedStart:start,plannedEnd}
}
export const reservationRoomInventoryOverlaps=(item,roomId,start,end)=>{const window=reservationRoomInventoryWindow(item,roomId);return Boolean(window.start&&window.end&&window.start<end&&window.end>start)}
export const expandedReservationSearchWindow=(start,end)=>({start:dateShift(start,-1)||start,end:dateShift(end,1)||end})
