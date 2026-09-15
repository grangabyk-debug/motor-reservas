import{NextResponse}from"next/server"
import{listingIdFor,priceLabsCallbacks,priceLabsPlatformState,requirePriceLabsRole}from"../../../../../lib/pricelabsServer"

export const runtime="nodejs"

async function snapshot(db,propertyId,origin){
  const[{data:connection,error:connectionError},{data:roomTypes,error:typeError},{data:rooms,error:roomError},{data:listings,error:listingError}]=await Promise.all([
    db.from("hotel_pricelabs_connections").select("*").eq("property_id",propertyId).maybeSingle(),
    db.from("hotel_room_types").select("id,name,code,capacity,adults,children,base_price,active,online_bookable,sort_order").eq("property_id",propertyId).eq("active",true).order("sort_order"),
    db.from("habitaciones").select("id,room_type_id,activa,online_bookable").eq("property_id",propertyId).eq("activa",true),
    db.from("hotel_pricelabs_listings").select("id,room_type_id,listing_id,status,enabled,last_calendar_at,last_reservations_at,last_price_sync_at,last_error,metadata,updated_at").eq("property_id",propertyId),
  ]);for(const error of[connectionError,typeError,roomError,listingError])if(error)throw error
  const listingByType=new Map((listings||[]).map(row=>[String(row.room_type_id),row])),platform=priceLabsPlatformState(),callbacks=priceLabsCallbacks(origin)
  const types=(roomTypes||[]).map(type=>{const localRooms=(rooms||[]).filter(room=>String(room.room_type_id||"")===String(type.id)&&room.online_bookable!==false),listing=listingByType.get(String(type.id));return{...type,units:localRooms.length,listing:listing||null,listing_id:listing?.listing_id||listingIdFor(propertyId,type.id),eligible:type.online_bookable!==false&&localRooms.length>0}})
  return{platform_ready:platform.ready,missing_platform_env:platform.missing,callbacks,connection:connection?{id:connection.id,user_email:connection.user_email,status:connection.status,sync_enabled:connection.sync_enabled,features:connection.features,last_listing_sync_at:connection.last_listing_sync_at,last_calendar_push_at:connection.last_calendar_push_at,last_price_sync_at:connection.last_price_sync_at,last_reservation_sync_at:connection.last_reservation_sync_at,last_hook_at:connection.last_hook_at,last_error:connection.last_error,updated_at:connection.updated_at}:null,room_types:types}
}

export async function GET(request){try{const url=new URL(request.url),propertyId=url.searchParams.get("property_id");if(!propertyId)return NextResponse.json({error:"Falta property_id."},{status:400});const auth=await requirePriceLabsRole(request,propertyId);return NextResponse.json(await snapshot(auth.db,propertyId,url.origin))}catch(error){return NextResponse.json({error:error?.message||"No se pudo cargar PriceLabs."},{status:error?.status||500})}}

export async function POST(request){
  try{
    const body=await request.json().catch(()=>({})),propertyId=body?.property_id,action=String(body?.action||"save");if(!propertyId)return NextResponse.json({error:"Falta property_id."},{status:400});const auth=await requirePriceLabsRole(request,propertyId),db=auth.db,now=new Date().toISOString()
    if(action==="save"){
      const email=String(body?.user_email||"").trim().toLowerCase();if(!email||!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:"Ingresá el email registrado en PriceLabs."},{status:400})
      const existing=await db.from("hotel_pricelabs_connections").select("id,status,sync_enabled,metadata").eq("property_id",propertyId).maybeSingle();if(existing.error)throw existing.error
      const payload={property_id:propertyId,user_email:email,status:existing.data?.status&&existing.data.status!=="setup"?existing.data.status:"setup",sync_enabled:existing.data?.sync_enabled===true,metadata:{...(existing.data?.metadata||{}),configured_from:"revenue",email_saved_at:now},created_by:auth.user.id,updated_at:now}
      const result=existing.data?await db.from("hotel_pricelabs_connections").update(payload).eq("id",existing.data.id):await db.from("hotel_pricelabs_connections").insert(payload);if(result.error)throw result.error
    }else if(action==="prepare"){
      const connection=await db.from("hotel_pricelabs_connections").select("*").eq("property_id",propertyId).maybeSingle();if(connection.error)throw connection.error;if(!connection.data?.user_email)return NextResponse.json({error:"Primero guardá el email registrado en PriceLabs."},{status:409})
      const[{data:types,error:typeError},{data:rooms,error:roomError}]=await Promise.all([db.from("hotel_room_types").select("id,name,code,base_price,active,online_bookable").eq("property_id",propertyId).eq("active",true),db.from("habitaciones").select("id,room_type_id,activa,online_bookable").eq("property_id",propertyId).eq("activa",true)]);if(typeError)throw typeError;if(roomError)throw roomError
      let prepared=0;for(const type of types||[]){const units=(rooms||[]).filter(room=>String(room.room_type_id||"")===String(type.id)&&room.online_bookable!==false).length;if(type.online_bookable===false||!units)continue;const listingId=listingIdFor(propertyId,type.id),row={property_id:propertyId,room_type_id:type.id,listing_id:listingId,status:"prepared",enabled:true,metadata:{room_type_name:type.name,room_type_code:type.code,units,base_price:Number(type.base_price||0),user_email:connection.data.user_email,prepared_at:now},updated_at:now};const saved=await db.from("hotel_pricelabs_listings").upsert(row,{onConflict:"property_id,room_type_id"});if(saved.error)throw saved.error;prepared++}
      const platform=priceLabsPlatformState(),nextStatus=platform.ready?"prepared":"pending_partner",updated=await db.from("hotel_pricelabs_connections").update({status:nextStatus,sync_enabled:false,last_error:null,metadata:{...(connection.data.metadata||{}),prepared_types:prepared,prepared_at:now,partner_credentials_ready:platform.ready},updated_at:now}).eq("property_id",propertyId);if(updated.error)throw updated.error
    }else if(action==="disable"){
      const result=await db.from("hotel_pricelabs_connections").update({status:"disabled",sync_enabled:false,updated_at:now}).eq("property_id",propertyId);if(result.error)throw result.error
    }else return NextResponse.json({error:"Acción de PriceLabs no reconocida."},{status:400})
    return NextResponse.json({ok:true,...await snapshot(db,propertyId,new URL(request.url).origin)})
  }catch(error){return NextResponse.json({error:error?.message||"No se pudo guardar PriceLabs."},{status:error?.status||500})}
}
