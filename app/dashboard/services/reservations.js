import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"
import{reservationTotal}from"../features/frontdesk/reservationModel"
import{uploadReservationDocuments}from"./reservationDocuments"

const text=v=>String(v??"").trim()
const roomInReservation=(reservation,roomId)=>String(reservation?.habitacion_id??"")===String(roomId)||(reservation?.habitaciones_ids||[]).some(id=>String(id)===String(roomId))
function payload(draft,room,propertyId,userId){
  if(!draft.start||!draft.end)throw new Error("Elegí fecha de entrada y salida.")
  if(draft.end<=draft.start)throw new Error("La salida tiene que ser posterior a la entrada.")
  const totals=reservationTotal(draft,room)
  return{property_id:requirePropertyId(propertyId),user_id:userId,alojamiento_id:room.alojamiento_id||null,habitacion_id:Number(room.id),habitaciones_ids:[Number(room.id)],fecha_entrada:draft.start,fecha_salida:draft.end,nombre_huesped:text(draft.guest),email_huesped:text(draft.email)||null,telefono_huesped:text(draft.phone)||null,dni_huesped:text(draft.document)||null,direccion_huesped:text(draft.address)||null,provincia_estado_huesped:text(draft.province)||null,pais_huesped:text(draft.country)||null,cantidad_huespedes:Math.max(1,Number(draft.pax||1)),canal_reserva:text(draft.channel)||"Directa",codigo_canal:text(draft.channelCode)||null,tarifa_noche:totals.rate,noches:totals.nights,precio_total:totals.total,moneda:draft.currency||"ARS",notas:text(draft.notes)||null,partner_id:draft.partnerId||null,group_id:draft.groupId||null,garantia_tipo:text(draft.guaranteeType)||null,garantia_marca:text(draft.guaranteeBrand)||null,garantia_ultimos4:text(draft.guaranteeLast4)||null,garantia_vencimiento:text(draft.guaranteeExpiry)||null,medio_pago_preferido:text(draft.preferredPayment)||null,vehiculos:Math.max(0,Number(draft.vehicles||0)),tipo_vehiculo:text(draft.vehicleType)||null,dominio_vehiculo:text(draft.vehiclePlate)||null,cochera_total:totals.parking,mascotas:draft.pets||[],mascotas_total:totals.pets,servicios:draft.extras||[],pasajeros:draft.companions||[],hora_llegada_estimada:text(draft.arrivalTime)||null}
}
export async function checkReservationAvailability({propertyId,roomId,start,end,excludeReservationId=null}){
  const pid=requirePropertyId(propertyId),rid=Number(roomId)
  if(!rid||!start||!end||end<=start)return{available:false,type:"invalid",message:"Elegí una habitación y un período válido antes de guardar."}
  const[{data:reservations,error:reservationError},{data:blocks,error:blockError}]=await Promise.all([
    supabase.from("reservas").select("id,numero_reserva,nombre_huesped,fecha_entrada,fecha_salida,habitacion_id,habitaciones_ids,estado,no_show").eq("property_id",pid).neq("estado","cancelada").eq("no_show",false).lt("fecha_entrada",end).gt("fecha_salida",start),
    supabase.from("bloqueos").select("id,habitacion_id,fecha_desde,fecha_hasta,motivo,detalle").eq("property_id",pid).eq("habitacion_id",rid).lt("fecha_desde",end).gt("fecha_hasta",start),
  ])
  if(reservationError)throw reservationError
  if(blockError)throw blockError
  const conflict=(reservations||[]).find(r=>String(r.id)!==String(excludeReservationId||"")&&roomInReservation(r,rid))
  if(conflict){const who=text(conflict.nombre_huesped)||"otro huésped",code=conflict.numero_reserva?` · ${conflict.numero_reserva}`:"";return{available:false,type:"reservation",reservation:conflict,message:`Esa habitación ya está ocupada del ${conflict.fecha_entrada} al ${conflict.fecha_salida} por ${who}${code}. Cambiá la habitación o las fechas antes de guardar.`}}
  const block=(blocks||[])[0]
  if(block){const reason=text(block.motivo||block.detalle)||"bloqueo operativo";return{available:false,type:"block",block,message:`Esa habitación está bloqueada del ${block.fecha_desde} al ${block.fecha_hasta} (${reason}). Cambiá la habitación o las fechas antes de guardar.`}}
  return{available:true,type:"free",message:"Disponible"}
}
async function saveStagedGuarantee(reservationId,tokenPayload){if(!tokenPayload?.token)return null;const{data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("La reserva se creó, pero la sesión venció antes de guardar la tarjeta de garantía.");const response=await fetch("/api/hotel/mercadopago/guarantee",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({reservation_id:Number(reservationId),action:"save_card",...tokenPayload})}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||"No se pudo guardar la tarjeta de garantía.");return data}
export async function moveReservation({reservationId,roomId,start,end}){const{data,error}=await supabase.rpc("hl_move_reservation_atomic",{p_reserva_id:Number(reservationId),p_habitacion_id:Number(roomId),p_fecha_entrada:start,p_fecha_salida:end||null});if(error)throw error;return Array.isArray(data)?data[0]:data}
export async function checkoutReservation(id){
  const{data:reservation,error:reservationError}=await supabase.from("reservas").select("id,property_id,precio_total").eq("id",Number(id)).single();if(reservationError)throw reservationError
  const[{data:paymentRows,error:paymentsError},{data:guarantee,error:guaranteeError}]=await Promise.all([supabase.from("pagos").select("monto").eq("reserva_id",Number(id)).eq("property_id",reservation.property_id),supabase.from("hotel_guarantees").select("status,authorized_amount,authorization_expires_at").eq("reserva_id",Number(id)).eq("property_id",reservation.property_id).maybeSingle()]);if(paymentsError)throw paymentsError;if(guaranteeError)throw guaranteeError
  const paid=(paymentRows||[]).reduce((sum,row)=>sum+Number(row.monto||0),0),balance=Math.max(0,Number(reservation.precio_total||0)-paid)
  if(balance>.01)throw new Error(`No se puede hacer check-out: queda un saldo pendiente de $ ${balance.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}.`)
  const guaranteeActive=guarantee?.status==="authorized"&&(!guarantee.authorization_expires_at||new Date(guarantee.authorization_expires_at).getTime()>Date.now());if(guaranteeActive)throw new Error(`Antes del check-out resolvé la garantía activa de $ ${Number(guarantee.authorized_amount||0).toLocaleString("es-AR")}: liberala si no hubo daños o registrá el cargo correspondiente.`)
  const{data,error}=await supabase.rpc("hl_checkout_reservation_atomic",{p_reserva_id:Number(id)});if(error)throw error;return Array.isArray(data)?data[0]:data
}
export async function checkinReservation({id,propertyId}){const{error}=await supabase.from("reservas").update({estado:"alojado",checkin_real_at:new Date().toISOString()}).eq("id",id).eq("property_id",requirePropertyId(propertyId));if(error)throw error}
export async function saveReservation({draft,room,propertyId,userId,original}){
  const data=payload(draft,room,propertyId,userId),pending=draft.pendingDocuments||[],stagedPayments=draft.id?[]:(draft.initialPayments||[]).filter(item=>Number(item.amount)>0&&text(item.method)),stagedGuarantee=draft.id?null:draft.guaranteeTokenPayload,pid=requirePropertyId(propertyId);let saved
  const availability=await checkReservationAvailability({propertyId:pid,roomId:room.id,start:draft.start,end:draft.end,excludeReservationId:draft.id||null})
  if(!availability.available)throw new Error(availability.message)
  if(draft.id){if(String(original?.habitacion_id)!==String(room.id)||original?.fecha_entrada!==draft.start||original?.fecha_salida!==draft.end)await moveReservation({reservationId:draft.id,roomId:room.id,start:draft.start,end:draft.end});["property_id","user_id","alojamiento_id","habitacion_id","habitaciones_ids","fecha_entrada","fecha_salida"].forEach(k=>delete data[k]);const{data:updated,error}=await supabase.from("reservas").update(data).eq("id",draft.id).eq("property_id",pid).select("*").single();if(error)throw error;saved=updated}else{data.estado="confirmada";data.no_show=false;const rows=stagedPayments.map(item=>({property_id:pid,user_id:userId,monto:Number(item.amount),metodo:text(item.method),moneda:item.currency||draft.currency||"ARS",nota:text(item.note)||null})),{data:created,error}=await supabase.rpc("hl_create_reservation_atomic",{p_reservation:data,p_payments:rows});if(error)throw error;saved=Array.isArray(created)?created[0]:created;if(!saved?.id)throw new Error("La reserva no devolvió una confirmación válida. No se registró ningún pago parcial fuera de la transacción.")}
  if(pending.length){try{await uploadReservationDocuments({propertyId:pid,reservationId:saved.id,userId,items:pending})}catch(error){saved={...saved,document_warning:error?.message||"La reserva quedó creada, pero uno o más documentos quedaron pendientes de subir."};console.warn("Habitación Llena: documentos pendientes",error)}}
  if(stagedGuarantee?.token){try{await saveStagedGuarantee(saved.id,stagedGuarantee)}catch(error){saved={...saved,guarantee_warning:error?.message||"La tarjeta de garantía quedó pendiente de vincular."};console.warn("Habitación Llena: garantía pendiente",error)}}
  return saved
}
export async function savePayment({propertyId,userId,reservationId,amount,method,currency="ARS",note=""}){const{error}=await supabase.from("pagos").insert({property_id:requirePropertyId(propertyId),user_id:userId,reserva_id:Number(reservationId),monto:Number(amount),metodo:method,moneda:currency,nota:note||null});if(error)throw error}