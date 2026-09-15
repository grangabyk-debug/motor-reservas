import{NextResponse}from"next/server"
import{adminSupabase,extractListingIds,logPriceLabsEvent,resolvePriceLabsListings,updateConnection,verifyPriceLabsSignature}from"../../../../lib/pricelabsServer"
import{applyPriceLabsUpdates,extractPriceLabsUpdates,priceLabsGoLiveState,pushPriceLabsCalendar}from"../../../../lib/pricelabsSync"

const messageFromPayload=payload=>String(payload?.message||payload?.error||payload?.detail||payload?.reason||"").slice(0,1000)
const eventPatch=(status,detail={})=>({status,processed_at:new Date().toISOString(),detail})

export async function handlePriceLabsCallback(request,eventKind){
  const rawBody=await request.text(),db=adminSupabase();let signature
  try{signature=verifyPriceLabsSignature(request,rawBody)}catch(error){return NextResponse.json({error:error?.message||"Firma inválida."},{status:error?.status||401})}
  let payload={};try{payload=rawBody?JSON.parse(rawBody):{}}catch{return NextResponse.json({error:"PriceLabs envió un JSON inválido."},{status:400})}
  try{
    const listingIds=extractListingIds(payload),mappings=await resolvePriceLabsListings(db,listingIds),propertyIds=[...new Set(mappings.map(row=>row.property_id).filter(Boolean))],propertyId=propertyIds.length===1?propertyIds[0]:null,listingId=listingIds.length===1?listingIds[0]:null
    const logged=await logPriceLabsEvent(db,{propertyId,listingId,requestId:signature.requestId,eventKind,signatureValid:true,rawBody,status:"received",detail:{source:signature.source,listing_ids:listingIds,properties:propertyIds,payload_keys:Object.keys(payload||{}).slice(0,30)}})
    if(logged.duplicate)return NextResponse.json({ok:true,duplicate:true,request_id:signature.requestId})
    if(eventKind==="hook"){
      const message=messageFromPayload(payload)||"PriceLabs reportó una novedad de integración.",looksError=Boolean(payload?.error||payload?.errors||String(payload?.status||"").toLowerCase()==="error");for(const id of propertyIds)await updateConnection(db,id,{last_hook_at:new Date().toISOString(),last_error:looksError?message:null});await db.from("hotel_pricelabs_events").update(eventPatch("processed",{source:signature.source,listing_ids:listingIds,message,looks_error:looksError})).eq("request_id",signature.requestId);return NextResponse.json({ok:true,received:true})
    }
    if(!propertyIds.length){await db.from("hotel_pricelabs_events").update(eventPatch("unmapped",{source:signature.source,listing_ids:listingIds})).eq("request_id",signature.requestId);return NextResponse.json({ok:true,received:true,unmapped:true})}
    if(eventKind==="calendar_trigger"){
      const state=priceLabsGoLiveState();if(!state.ready){await db.from("hotel_pricelabs_events").update(eventPatch("waiting_partner_credentials",{source:signature.source,listing_ids:listingIds,missing:state.missing})).eq("request_id",signature.requestId);return NextResponse.json({ok:true,received:true,pushed:false,reason:"partner_credentials_missing"})}
      let pushed=0;for(const id of propertyIds){const ids=mappings.filter(row=>row.property_id===id).map(row=>row.listing_id);const result=await pushPriceLabsCalendar(db,id,{days:730,listingIds:ids});pushed+=Number(result.count||0)}await db.from("hotel_pricelabs_events").update(eventPatch("processed",{source:signature.source,listing_ids:listingIds,calendar_listings_pushed:pushed})).eq("request_id",signature.requestId);return NextResponse.json({ok:true,received:true,pushed})
    }
    const connections=await db.from("hotel_pricelabs_connections").select("property_id,status,sync_enabled").in("property_id",propertyIds);if(connections.error)throw connections.error
    const enabled=(connections.data||[]).filter(row=>row.sync_enabled===true&&row.status==="ready");if(!enabled.length){for(const id of propertyIds)await updateConnection(db,id,{last_price_sync_at:new Date().toISOString()});await db.from("hotel_pricelabs_events").update(eventPatch("ignored_sync_disabled",{source:signature.source,listing_ids:listingIds,note:"La propiedad no habilitó la aplicación automática de tarifas."})).eq("request_id",signature.requestId);return NextResponse.json({ok:true,received:true,sync_enabled:false})}
    const state=priceLabsGoLiveState();if(!state.apply_ready){await db.from("hotel_pricelabs_events").update(eventPatch("pending_certification",{source:signature.source,listing_ids:listingIds,note:"Callback autenticado. La aplicación queda bloqueada hasta certificación oficial de PriceLabs."})).eq("request_id",signature.requestId);return NextResponse.json({ok:true,received:true,applied:false,certified:false})}
    const updates=extractPriceLabsUpdates(payload);if(!updates.length){await db.from("hotel_pricelabs_events").update(eventPatch("no_prices",{source:signature.source,listing_ids:listingIds,note:"El callback no contenía filas de precio aplicables."})).eq("request_id",signature.requestId);return NextResponse.json({ok:true,received:true,applied:0})}
    let applied=0;for(const connection of enabled){const ids=new Set(mappings.filter(row=>row.property_id===connection.property_id).map(row=>String(row.listing_id))),scoped=updates.filter(row=>ids.has(String(row.listing_id)));if(!scoped.length)continue;const result=await applyPriceLabsUpdates(db,{updates:scoped});applied+=Number(result.applied||0)}await db.from("hotel_pricelabs_events").update(eventPatch("processed",{source:signature.source,listing_ids:listingIds,updates_received:updates.length,room_date_rows_applied:applied})).eq("request_id",signature.requestId);return NextResponse.json({ok:true,received:true,applied})
  }catch(error){console.error(`PriceLabs ${eventKind} callback error`,error);await db.from("hotel_pricelabs_events").update(eventPatch("failed",{error:error?.message||"Error interno"})).eq("request_id",signature?.requestId||"").catch?.(()=>{});return NextResponse.json({error:error?.message||"No se pudo procesar el callback de PriceLabs."},{status:error?.status||500})}
}
