import{NextResponse}from"next/server"
import{requirePriceLabsRole,updateConnection}from"../../../../../lib/pricelabsServer"
import{priceLabsGoLiveState,pushPriceLabsCalendar,pushPriceLabsIntegration,pushPriceLabsListings,pushPriceLabsReservations}from"../../../../../lib/pricelabsSync"

export const runtime="nodejs"

export async function POST(request){
  try{
    const body=await request.json().catch(()=>({})),propertyId=body?.property_id,action=String(body?.action||"");if(!propertyId)return NextResponse.json({error:"Falta property_id."},{status:400})
    const auth=await requirePriceLabsRole(request,propertyId),state=priceLabsGoLiveState();let result=null
    if(action==="integration")result=await pushPriceLabsIntegration(new URL(request.url).origin)
    else if(action==="listings")result=await pushPriceLabsListings(auth.db,propertyId)
    else if(action==="calendar")result=await pushPriceLabsCalendar(auth.db,propertyId,{days:730})
    else if(action==="reservations")result=await pushPriceLabsReservations(auth.db,propertyId)
    else if(action==="enable"){
      if(!state.apply_ready)return NextResponse.json({error:state.ready?"PriceLabs todavía no certificó esta integración para aplicar tarifas en producción.":`Faltan credenciales oficiales de PriceLabs: ${state.missing.join(", ")}.`},{status:409})
      const listings=await auth.db.from("hotel_pricelabs_listings").select("id,last_calendar_at,status").eq("property_id",propertyId).eq("enabled",true);if(listings.error)throw listings.error;if(!(listings.data||[]).length||(listings.data||[]).some(row=>!row.last_calendar_at))return NextResponse.json({error:"Antes de activar, enviá los tipos de habitación y el calendario inicial de 730 días."},{status:409})
      result=await updateConnection(auth.db,propertyId,{status:"ready",sync_enabled:true,last_error:null})
    }else if(action==="pause")result=await updateConnection(auth.db,propertyId,{status:"paused",sync_enabled:false})
    else return NextResponse.json({error:"Acción de PriceLabs no reconocida."},{status:400})
    return NextResponse.json({ok:true,action,result,platform:{ready:state.ready,certified:state.certified,apply_ready:state.apply_ready,missing:state.missing}})
  }catch(error){console.error("PriceLabs action error",error);return NextResponse.json({error:error?.message||"No se pudo completar la acción de PriceLabs.",detail:error?.detail||undefined},{status:error?.status||500})}
}
