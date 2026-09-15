import{listingIdFor,priceLabsCallbacks,priceLabsFetch,priceLabsPlatformState,updateConnection}from"./pricelabsServer"

const DAY=86400000
const iso=date=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10)
const add=(date,n)=>new Date(date.getTime()+n*DAY)
const activeReservation=row=>!["cancelada","cancelled"].includes(String(row?.estado||"").toLowerCase())&&!row?.no_show
const number=value=>value===null||value===undefined||value===""?null:Number.isFinite(Number(value))?Number(value):null
const bool=value=>value===true||value===1||value==="1"||String(value).toLowerCase()==="true"
const mean=values=>{const safe=values.map(Number).filter(Number.isFinite);return safe.length?Math.round(safe.reduce((sum,value)=>sum+value,0)/safe.length*100)/100:0}
const roomIds=row=>[row?.habitacion_id,...(Array.isArray(row?.habitaciones_ids)?row.habitaciones_ids:[])].filter(Boolean).map(Number)
const dateActive=(day,start,end)=>String(start||"")<=day&&String(end||"")>day
const chunk=(rows,size=500)=>Array.from({length:Math.ceil(rows.length/size)},(_,index)=>rows.slice(index*size,(index+1)*size))

export function priceLabsGoLiveState(){const platform=priceLabsPlatformState(),certified=/^(1|true|yes)$/i.test(String(process.env.PRICELABS_CERTIFIED||""));return{...platform,certified,apply_ready:platform.ready&&certified}}

async function propertyData(db,propertyId,days=730){
  const today=new Date();today.setHours(0,0,0,0);const from=iso(today),to=iso(add(today,Math.max(1,days)-1))
  const[{data:connection,error:connectionError},{data:listings,error:listingsError},{data:types,error:typeError},{data:rooms,error:roomError},{data:rates,error:rateError},{data:reservations,error:reservationError},{data:blocks,error:blockError},{data:settings,error:settingsError}]=await Promise.all([
    db.from("hotel_pricelabs_connections").select("*").eq("property_id",propertyId).maybeSingle(),
    db.from("hotel_pricelabs_listings").select("*").eq("property_id",propertyId).eq("enabled",true),
    db.from("hotel_room_types").select("id,name,code,capacity,adults,children,base_price,active,online_bookable").eq("property_id",propertyId).eq("active",true),
    db.from("habitaciones").select("id,nombre,room_type_id,precio,activa,online_bookable").eq("property_id",propertyId).eq("activa",true),
    db.from("hotel_rate_calendar").select("habitacion_id,stay_date,price,min_stay,stop_sell,closed_to_arrival,closed_to_departure").eq("property_id",propertyId).gte("stay_date",from).lte("stay_date",to),
    db.from("reservas").select("id,numero_reserva,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show,precio_total,subtotal,tarifa_noche,noches,moneda,cantidad_huespedes,created_at").eq("property_id",propertyId).lt("fecha_entrada",iso(add(today,days))).gt("fecha_salida",iso(add(today,-365))),
    db.from("bloqueos").select("id,habitacion_id,fecha_desde,fecha_hasta,motivo,detalle,created_at").eq("property_id",propertyId).lte("fecha_desde",to).gte("fecha_hasta",from),
    db.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
  ]);for(const error of[connectionError,listingsError,typeError,roomError,rateError,reservationError,blockError,settingsError])if(error)throw error
  return{from,to,today,connection,listings:listings||[],types:types||[],rooms:(rooms||[]).filter(row=>row.online_bookable!==false),rates:rates||[],reservations:reservations||[],blocks:blocks||[],currency:settings?.settings?.preferences?.currency||settings?.settings?.pricing?.rate_currency||"ARS"}
}

export async function pushPriceLabsIntegration(origin){const state=priceLabsGoLiveState();if(!state.ready)throw Object.assign(new Error(`Faltan credenciales oficiales de PriceLabs: ${state.missing.join(", ")}.`),{status:503});const callbacks=priceLabsCallbacks(origin);return priceLabsFetch("/integration",{body:{...callbacks,features:{prices:true,min_stay:true,closed_to_arrival:true,closed_to_departure:true,multi_unit:true}}})}

export async function pushPriceLabsListings(db,propertyId){
  const data=await propertyData(db,propertyId,1);if(!data.connection?.user_email)throw Object.assign(new Error("Primero guardá el email registrado en PriceLabs."),{status:409})
  const typeById=new Map(data.types.map(type=>[String(type.id),type])),roomCount=new Map();for(const room of data.rooms){const key=String(room.room_type_id||"");roomCount.set(key,(roomCount.get(key)||0)+1)}
  const prepared=data.listings.filter(row=>row.enabled!==false).map(row=>{const type=typeById.get(String(row.room_type_id));return{listing_id:row.listing_id||listingIdFor(propertyId,row.room_type_id),listing_name:type?.name||row.metadata?.room_type_name||"Habitación",property_name:data.connection?.metadata?.property_name||"Habitación Llena",currency:data.currency,room_count:roomCount.get(String(row.room_type_id))||1,bedrooms:1,capacity:Number(type?.capacity||type?.adults||1)}})
  if(!prepared.length)throw Object.assign(new Error("No hay tipos de habitación preparados para PriceLabs."),{status:409})
  const response=await priceLabsFetch("/listings",{body:{user_token:data.connection.user_email,listings:prepared}}),now=new Date().toISOString()
  for(const row of data.listings)await db.from("hotel_pricelabs_listings").update({status:"listed",last_error:null,updated_at:now}).eq("id",row.id)
  await updateConnection(db,propertyId,{status:"listed",last_listing_sync_at:now,last_error:null})
  return{response,count:prepared.length}
}

export async function buildPriceLabsCalendar(db,propertyId,{days=730,listingIds=null}={}){
  const data=await propertyData(db,propertyId,days),typeById=new Map(data.types.map(type=>[String(type.id),type])),roomsByType=new Map(),ratesByRoomDate=new Map(),reservationsByRoom=new Map(),blocksByRoom=new Map()
  for(const room of data.rooms){const key=String(room.room_type_id||"");if(!roomsByType.has(key))roomsByType.set(key,[]);roomsByType.get(key).push(room)}
  for(const row of data.rates)ratesByRoomDate.set(`${Number(row.habitacion_id)}:${row.stay_date}`,row)
  for(const reservation of data.reservations.filter(activeReservation))for(const id of roomIds(reservation)){if(!reservationsByRoom.has(id))reservationsByRoom.set(id,[]);reservationsByRoom.get(id).push(reservation)}
  for(const block of data.blocks){const id=Number(block.habitacion_id);if(!blocksByRoom.has(id))blocksByRoom.set(id,[]);blocksByRoom.get(id).push(block)}
  const allowed=listingIds?.length?new Set(listingIds.map(String)):null,listings=[]
  for(const listing of data.listings){if(allowed&&!allowed.has(String(listing.listing_id)))continue;const type=typeById.get(String(listing.room_type_id)),rooms=roomsByType.get(String(listing.room_type_id))||[];if(!rooms.length)continue;const calendar=[]
    for(let index=0;index<days;index++){const day=iso(add(data.today,index)),prices=[],minStays=[],availableRooms=[];let cta=false,ctd=false
      for(const room of rooms){const rate=ratesByRoomDate.get(`${Number(room.id)}:${day}`),occupied=(reservationsByRoom.get(Number(room.id))||[]).some(row=>dateActive(day,row.fecha_entrada,row.fecha_salida)),blocked=(blocksByRoom.get(Number(room.id))||[]).some(row=>dateActive(day,row.fecha_desde,row.fecha_hasta)),stopped=rate?.stop_sell===true;if(!occupied&&!blocked&&!stopped)availableRooms.push(room.id);const base=number(rate?.price)??number(room.precio)??number(type?.base_price)??0;if(base>0)prices.push(base);minStays.push(Math.max(1,Number(rate?.min_stay||1)));cta=cta||rate?.closed_to_arrival===true;ctd=ctd||rate?.closed_to_departure===true}
      calendar.push({date:day,price:mean(prices),availability:availableRooms.length,min_stay:Math.max(1,...minStays),closed_to_arrival:cta,closed_to_departure:ctd})
    }
    listings.push({listing_id:listing.listing_id,currency:data.currency,calendar})
  }
  return{from:data.from,to:data.to,listings}
}

export async function pushPriceLabsCalendar(db,propertyId,{days=730,listingIds=null}={}){const payload=await buildPriceLabsCalendar(db,propertyId,{days,listingIds});if(!payload.listings.length)throw Object.assign(new Error("No hay listings habilitados para enviar calendario."),{status:409});const response=await priceLabsFetch("/calendar",{body:{listings:payload.listings}}),now=new Date().toISOString(),ids=payload.listings.map(row=>row.listing_id);await db.from("hotel_pricelabs_listings").update({status:"calendar_ready",last_calendar_at:now,last_error:null,updated_at:now}).in("listing_id",ids);await updateConnection(db,propertyId,{status:"calendar_ready",last_calendar_push_at:now,last_error:null});return{response,count:payload.listings.length,days,from:payload.from,to:payload.to}}

export async function buildPriceLabsReservations(db,propertyId){
  const data=await propertyData(db,propertyId,730),roomById=new Map(data.rooms.map(row=>[Number(row.id),row])),listingByType=new Map(data.listings.map(row=>[String(row.room_type_id),row])),rows=[]
  for(const reservation of data.reservations){const assigned=roomIds(reservation),share=Math.max(1,assigned.length),total=number(reservation.precio_total)??0,nightRate=number(reservation.tarifa_noche),rental=number(reservation.subtotal)??(nightRate!=null?nightRate*Math.max(1,Number(reservation.noches||1)):total)
    for(const roomId of assigned){const room=roomById.get(roomId),listing=listingByType.get(String(room?.room_type_id||""));if(!listing)continue;rows.push({listing_id:listing.listing_id,reservation_id:`${reservation.id}:${roomId}`,start_date:reservation.fecha_entrada,end_date:reservation.fecha_salida,total_cost:Math.round(total/share*100)/100,rental_revenue:Math.round(rental/share*100)/100,currency:reservation.moneda||data.currency,pl_status:reservation.estado==="cancelada"||reservation.no_show?"cancelled":"booked",booked_time:reservation.created_at||new Date().toISOString(),guest_count:Math.max(1,Math.ceil(Number(reservation.cantidad_huespedes||1)/share))})}
  }
  for(const block of data.blocks){const room=roomById.get(Number(block.habitacion_id)),listing=listingByType.get(String(room?.room_type_id||""));if(!listing)continue;rows.push({listing_id:listing.listing_id,reservation_id:`block:${block.id}`,start_date:block.fecha_desde,end_date:block.fecha_hasta,total_cost:0,rental_revenue:0,currency:data.currency,pl_status:"blocked",booked_time:block.created_at||new Date().toISOString()})}
  return rows
}

export async function pushPriceLabsReservations(db,propertyId){const reservations=await buildPriceLabsReservations(db,propertyId);if(!reservations.length)throw Object.assign(new Error("No hay reservas ni bloqueos para enviar a PriceLabs."),{status:409});const response=await priceLabsFetch("/reservations",{body:{reservations}}),now=new Date().toISOString();await db.from("hotel_pricelabs_listings").update({last_reservations_at:now,last_error:null,updated_at:now}).eq("property_id",propertyId).eq("enabled",true);await updateConnection(db,propertyId,{last_reservation_sync_at:now,last_error:null});return{response,count:reservations.length}}

function pick(obj,keys){for(const key of keys)if(obj&&obj[key]!==undefined&&obj[key]!==null)return obj[key];return undefined}
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||""))}
export function extractPriceLabsUpdates(payload){const updates=[],visit=(node,context={})=>{if(!node)return;if(Array.isArray(node)){node.forEach(item=>visit(item,context));return}if(typeof node!=="object")return;const listingId=pick(node,["listing_id","listingId","id"])||context.listingId,date=pick(node,["date","stay_date","stayDate","night"]),price=pick(node,["price","rate","recommended_price","recommendedPrice","nightly_rate","nightlyRate"]),minStay=pick(node,["min_stay","minStay","minimum_stay","minimumStay","min_nights"]),cta=pick(node,["closed_to_arrival","closedToArrival","cta"]),ctd=pick(node,["closed_to_departure","closedToDeparture","ctd"]),numericPrice=number(price);if(listingId&&validDate(date)&&numericPrice!=null&&numericPrice>0)updates.push({listing_id:String(listingId),date:String(date),price:numericPrice,min_stay:minStay==null?null:Math.max(1,Number(minStay)||1),closed_to_arrival:cta==null?null:bool(cta),closed_to_departure:ctd==null?null:bool(ctd)});const next={listingId:listingId||context.listingId};for(const value of Object.values(node))if(value&&typeof value==="object")visit(value,next)};visit(payload);const deduped=new Map();for(const row of updates)deduped.set(`${row.listing_id}:${row.date}`,row);return[...deduped.values()]}

export async function applyPriceLabsUpdates(db,payload){
  const updates=extractPriceLabsUpdates(payload);if(!updates.length)return{applied:0,listings:[]}
  const listingIds=[...new Set(updates.map(row=>row.listing_id))],mapping=await db.from("hotel_pricelabs_listings").select("property_id,room_type_id,listing_id,enabled").in("listing_id",listingIds);if(mapping.error)throw mapping.error;const mapped=(mapping.data||[]).filter(row=>row.enabled!==false),properties=[...new Set(mapped.map(row=>row.property_id))];if(properties.length!==1)throw new Error("El lote de PriceLabs mezcla propiedades o contiene listings desconocidos.")
  const propertyId=properties[0],roomTypes=[...new Set(mapped.map(row=>row.room_type_id))];if(!roomTypes.length)return{applied:0,listings:[]};const roomResult=await db.from("habitaciones").select("id,room_type_id").eq("property_id",propertyId).eq("activa",true).in("room_type_id",roomTypes);if(roomResult.error)throw roomResult.error;const roomsByType=new Map();for(const room of roomResult.data||[]){const key=String(room.room_type_id);if(!roomsByType.has(key))roomsByType.set(key,[]);roomsByType.get(key).push(Number(room.id))}
  const mappingByListing=new Map(mapped.map(row=>[String(row.listing_id),row])),dates=[...new Set(updates.map(row=>row.date))].sort(),roomIdsFlat=[...new Set((roomResult.data||[]).map(row=>Number(row.id)))],existingResult=roomIdsFlat.length&&dates.length?await db.from("hotel_rate_calendar").select("property_id,habitacion_id,stay_date,price,min_stay,stop_sell,closed_to_arrival,closed_to_departure,notes").eq("property_id",propertyId).in("habitacion_id",roomIdsFlat).gte("stay_date",dates[0]).lte("stay_date",dates[dates.length-1]):{data:[],error:null};if(existingResult.error)throw existingResult.error;const wantedDates=new Set(dates),existing=new Map((existingResult.data||[]).filter(row=>wantedDates.has(row.stay_date)).map(row=>[`${Number(row.habitacion_id)}:${row.stay_date}`,row])),rows=[]
  for(const update of updates){const map=mappingByListing.get(update.listing_id);if(!map)continue;for(const roomId of roomsByType.get(String(map.room_type_id))||[]){const current=existing.get(`${roomId}:${update.date}`)||{};rows.push({property_id:propertyId,habitacion_id:roomId,stay_date:update.date,price:update.price,min_stay:update.min_stay??current.min_stay??1,stop_sell:current.stop_sell===true,closed_to_arrival:update.closed_to_arrival??current.closed_to_arrival??false,closed_to_departure:update.closed_to_departure??current.closed_to_departure??false,notes:current.notes||"Tarifa dinámica aplicada desde PriceLabs",updated_at:new Date().toISOString()})}}
  for(const part of chunk(rows)){const saved=await db.from("hotel_rate_calendar").upsert(part,{onConflict:"property_id,habitacion_id,stay_date"});if(saved.error)throw saved.error}
  const now=new Date().toISOString();await db.from("hotel_pricelabs_listings").update({status:"synced",last_price_sync_at:now,last_error:null,updated_at:now}).in("listing_id",listingIds);await updateConnection(db,propertyId,{status:"ready",last_price_sync_at:now,last_error:null});return{applied:rows.length,listings:listingIds,property_id:propertyId}
}
