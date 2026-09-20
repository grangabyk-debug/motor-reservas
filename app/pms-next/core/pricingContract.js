import{supabase}from"../../../lib/supabase"

const cleanIds=values=>[...new Set((values||[]).map(Number).filter(Number.isFinite))]

export async function resolvePricingQuote({propertyId,start,end,roomIds=null,reservationCurrency=null,usdArsRate=null}){
  if(!propertyId||!start||!end||end<=start)return{rooms:[],nights:0,pricing_version:2}
  const ids=cleanIds(roomIds)
  const{data,error}=await supabase.rpc("hl_resolve_pricing_quote",{
    p_property_id:propertyId,p_start:start,p_end:end,p_room_ids:ids.length?ids:null,
    p_reservation_currency:reservationCurrency||null,p_usd_ars_rate:Number(usdArsRate)>0?Number(usdArsRate):null,
  })
  if(error)throw error
  return data||{rooms:[],nights:0,pricing_version:2}
}
export function pricingRoomsById(pricing){return new Map((pricing?.rooms||[]).map(room=>[Number(room.room_id),room]))}
export function nightlyPricingByRoomDate(pricing){const map=new Map();for(const room of pricing?.rooms||[])for(const night of room.nightly_rates||[])map.set(`${Number(room.room_id)}:${night.stay_date}`,night);return map}
