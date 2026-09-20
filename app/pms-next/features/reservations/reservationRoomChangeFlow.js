import{supabase}from"../../../../lib/supabase"

export async function quoteRoomChange({item,toRoomId,start,end}){
  const{data,error}=await supabase.rpc("hl_quote_room_upgrade_atomic",{p_reserva_id:Number(item.id),p_from_room_id:Number(item.habitacion_id),p_to_room_id:Number(toRoomId),p_start:start,p_end:end})
  if(error)throw error
  return data||{}
}

export async function prepareRoomSelection({item,currentRoom,nextRoom,start,end,onPreviewMove}){
  const preview=await onPreviewMove({reservationId:item.id,roomId:Number(nextRoom.id),start,end})
  if(!preview?.ok)throw new Error(preview?.message||"La habitación no está disponible para ese cambio.")
  const quote=await quoteRoomChange({item,toRoomId:nextRoom.id,start,end})
  return{kind:"room-selection",roomId:Number(nextRoom.id),sourceRoom:currentRoom,targetRoom:nextRoom,currentRate:Number(quote.source_reservation_final_rate)||0,targetRate:Number(quote.target_reservation_final_rate)||0,currency:quote.reservation_currency||item.moneda||"ARS",pricingQuote:quote}
}

export function buildRoomDecision({pending,draft,item,currentRoom,reprice}){
  const id=String(pending.roomId),room=pending.targetRoom,previous=draft.roomAssignments?.[String(draft.roomId)]||{}
  const rate=Number(reprice?pending.pricingQuote?.target_booked_rate:pending.pricingQuote?.current_booked_rate)||Number(item.tarifa_noche)||0
  return{id,name:room?.nombre||id,assignment:{...previous,soldAs:previous.soldAs||currentRoom?.tipo||room?.tipo||"Habitación",rate},decision:{key:`${id}|${draft.start}|${draft.end}`,reprice:Boolean(reprice),quote:pending.pricingQuote}}
}

export function roomDecisionMatches(decision,draft,quote){
  if(!decision||decision.key!==`${String(draft.roomId)}|${draft.start}|${draft.end}`||!decision.quote)return false
  return Math.abs((Number(decision.quote.source_reservation_final_rate)||0)-(Number(quote.source_reservation_final_rate)||0))<=.005&&Math.abs((Number(decision.quote.target_reservation_final_rate)||0)-(Number(quote.target_reservation_final_rate)||0))<=.005
}
