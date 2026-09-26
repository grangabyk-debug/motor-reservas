import{supabase}from"../../../../lib/supabase"

const planDetail=(item,roomId)=>(Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]).find(detail=>Number(detail?.habitacion_id)===Number(roomId)&&String(detail?.segment_role||"active_room").toLowerCase()!=="previous_room")||{}
const planNights=(start,end)=>{const a=new Date(`${String(start||"").slice(0,10)}T12:00:00Z`),b=new Date(`${String(end||"").slice(0,10)}T12:00:00Z`),n=Math.round((b-a)/86400000);return Number.isFinite(n)?Math.max(1,n):1}
const plus=(value,delta)=>Number.isFinite(Number(value))?Number(value)+Number(delta||0):value

export function quoteWithRatePlan({item,roomId,quote,start,end}){
  const detail=planDetail(item,roomId)
  if(!detail?.rate_plan_code||!quote)return quote||{}
  const pax=Math.max(0,Number(detail.rate_plan_booked_guests??detail.huespedes)||0),nights=planNights(start,end),bookedNight=(Number(detail.rate_plan_adjustment_booked_per_person)||0)*pax,finalNight=(Number(detail.rate_plan_adjustment_final_per_person)||0)*pax,configuredNight=(Number(detail.rate_plan_adjustment_configured_per_person)||0)*pax
  return{...quote,target_booked_rate:plus(quote.target_booked_rate,bookedNight),target_reservation_final_rate:plus(quote.target_reservation_final_rate,finalNight),target_local_rate:plus(quote.target_local_rate,configuredNight),reservation_delta:plus(quote.reservation_delta,bookedNight*nights),reservation_final_delta:plus(quote.reservation_final_delta,finalNight*nights),local_delta:plus(quote.local_delta,configuredNight*nights),rate_plan_code:detail.rate_plan_code,rate_plan_name:detail.rate_plan_name||detail.rate_plan_regimen||"",rate_plan_preserved:true}
}

export async function quoteRoomChange({item,toRoomId,start,end}){
  const{data,error}=await supabase.rpc("hl_quote_room_upgrade_atomic",{p_reserva_id:Number(item.id),p_from_room_id:Number(item.habitacion_id),p_to_room_id:Number(toRoomId),p_start:start,p_end:end})
  if(error)throw error
  return quoteWithRatePlan({item,roomId:item.habitacion_id,quote:data||{},start,end})
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
