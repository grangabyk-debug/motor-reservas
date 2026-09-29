import{supabase}from"../../../lib/supabase"

const cleanIds=values=>[...new Set((values||[]).map(Number).filter(Number.isFinite))]
const transientFetchError=error=>/failed to fetch|networkerror|load failed/i.test(String(error?.message||error||""))
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))

export async function resolvePricingQuote({propertyId,start,end,roomIds=null,reservationCurrency=null,usdArsRate=null}){
  if(!propertyId||!start||!end||end<=start)return{rooms:[],nights:0,pricing_version:2}
  const ids=cleanIds(roomIds),params={p_property_id:propertyId,p_start:start,p_end:end,p_room_ids:ids.length?ids:null,p_reservation_currency:reservationCurrency||null,p_usd_ars_rate:Number(usdArsRate)>0?Number(usdArsRate):null}
  let lastError=null
  for(let attempt=0;attempt<2;attempt++){
    try{
      const{data,error}=await supabase.rpc("hl_resolve_pricing_quote",params)
      if(!error)return data||{rooms:[],nights:0,pricing_version:2}
      lastError=error
      if(!transientFetchError(error)||attempt===1)throw error
    }catch(error){
      lastError=error
      if(!transientFetchError(error)||attempt===1)throw error
    }
    await wait(180)
  }
  throw lastError||new Error("No se pudieron resolver las tarifas.")
}
export function pricingRoomsById(pricing){return new Map((pricing?.rooms||[]).map(room=>[Number(room.room_id),room]))}
export function nightlyPricingByRoomDate(pricing){const map=new Map();for(const room of pricing?.rooms||[])for(const night of room.nightly_rates||[])map.set(`${Number(room.room_id)}:${night.stay_date}`,night);return map}
