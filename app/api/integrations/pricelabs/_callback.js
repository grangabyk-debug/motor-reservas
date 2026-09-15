import{NextResponse}from"next/server"
import{adminSupabase,extractListingIds,logPriceLabsEvent,resolvePriceLabsListings,updateConnection,verifyPriceLabsSignature}from"../../../../lib/pricelabsServer"

const messageFromPayload=payload=>String(payload?.message||payload?.error||payload?.detail||payload?.reason||"").slice(0,1000)

export async function handlePriceLabsCallback(request,eventKind){
  const rawBody=await request.text(),db=adminSupabase();let signature
  try{signature=verifyPriceLabsSignature(request,rawBody)}catch(error){return NextResponse.json({error:error?.message||"Firma inválida."},{status:error?.status||401})}
  let payload={};try{payload=rawBody?JSON.parse(rawBody):{}}catch{return NextResponse.json({error:"PriceLabs envió un JSON inválido."},{status:400})}
  try{
    const listingIds=extractListingIds(payload),mappings=await resolvePriceLabsListings(db,listingIds),propertyIds=[...new Set(mappings.map(row=>row.property_id).filter(Boolean))],propertyId=propertyIds.length===1?propertyIds[0]:null,listingId=listingIds.length===1?listingIds[0]:null
    const logged=await logPriceLabsEvent(db,{propertyId,listingId,requestId:signature.requestId,eventKind,signatureValid:true,rawBody,status:"received",detail:{source:signature.source,listing_ids:listingIds,properties:propertyIds,payload_keys:Object.keys(payload||{}).slice(0,30)}})
    if(logged.duplicate)return NextResponse.json({ok:true,duplicate:true,request_id:signature.requestId})
    if(eventKind==="hook"){
      const message=messageFromPayload(payload)||"PriceLabs reportó una novedad de integración.";for(const id of propertyIds)await updateConnection(db,id,{last_hook_at:new Date().toISOString(),last_error:message,status:"error"});await db.from("hotel_pricelabs_events").update({status:"processed",processed_at:new Date().toISOString(),detail:{source:signature.source,listing_ids:listingIds,message}}).eq("request_id",signature.requestId);return NextResponse.json({ok:true,received:true})
    }
    if(!propertyIds.length){await db.from("hotel_pricelabs_events").update({status:"unmapped",processed_at:new Date().toISOString()}).eq("request_id",signature.requestId);return NextResponse.json({ok:true,received:true,unmapped:true})}
    const connections=await db.from("hotel_pricelabs_connections").select("property_id,status,sync_enabled").in("property_id",propertyIds);if(connections.error)throw connections.error
    const enabled=(connections.data||[]).filter(row=>row.sync_enabled===true&&row.status==="ready")
    if(!enabled.length){for(const id of propertyIds)await updateConnection(db,id,eventKind==="sync"?{last_price_sync_at:new Date().toISOString()}:{last_calendar_push_at:new Date().toISOString()});await db.from("hotel_pricelabs_events").update({status:"ignored_sync_disabled",processed_at:new Date().toISOString(),detail:{source:signature.source,listing_ids:listingIds,note:"La propiedad todavía no habilitó sincronización automática."}}).eq("request_id",signature.requestId);return NextResponse.json({ok:true,received:true,sync_enabled:false})}
    await db.from("hotel_pricelabs_events").update({status:"pending_certification",processed_at:new Date().toISOString(),detail:{source:signature.source,listing_ids:listingIds,note:"Callback autenticado; la aplicación de payload queda bloqueada hasta cerrar certificación IAPI."}}).eq("request_id",signature.requestId)
    return NextResponse.json({error:"La sincronización PriceLabs todavía no está certificada para aplicar cambios."},{status:409})
  }catch(error){console.error(`PriceLabs ${eventKind} callback error`,error);return NextResponse.json({error:error?.message||"No se pudo procesar el callback de PriceLabs."},{status:500})}
}
