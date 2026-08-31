import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"
import{reservationTotal}from"../features/frontdesk/reservationModel"
import{uploadReservationDocuments}from"./reservationDocuments"

const text=v=>String(v??"").trim()
function payload(draft,room,propertyId,userId){
  if(!draft.start||!draft.end)throw new Error("Elegí fecha de entrada y salida.")
  if(draft.end<=draft.start)throw new Error("La salida tiene que ser posterior a la entrada.")
  const totals=reservationTotal(draft,room)
  return{property_id:requirePropertyId(propertyId),user_id:userId,alojamiento_id:room.alojamiento_id||null,habitacion_id:Number(room.id),habitaciones_ids:[Number(room.id)],fecha_entrada:draft.start,fecha_salida:draft.end,nombre_huesped:text(draft.guest),email_huesped:text(draft.email)||null,telefono_huesped:text(draft.phone)||null,dni_huesped:text(draft.document)||null,direccion_huesped:text(draft.address)||null,provincia_estado_huesped:text(draft.province)||null,pais_huesped:text(draft.country)||null,cantidad_huespedes:Math.max(1,Number(draft.pax||1)),canal_reserva:text(draft.channel)||"Directa",codigo_canal:text(draft.channelCode)||null,tarifa_noche:totals.rate,noches:totals.nights,precio_total:totals.total,moneda:draft.currency||"ARS",notas:text(draft.notes)||null,partner_id:draft.partnerId||null,group_id:draft.groupId||null,garantia_tipo:text(draft.guaranteeType)||null,garantia_marca:text(draft.guaranteeBrand)||null,garantia_ultimos4:text(draft.guaranteeLast4)||null,garantia_vencimiento:text(draft.guaranteeExpiry)||null,medio_pago_preferido:text(draft.preferredPayment)||null,vehiculos:Math.max(0,Number(draft.vehicles||0)),tipo_vehiculo:text(draft.vehicleType)||null,dominio_vehiculo:text(draft.vehiclePlate)||null,cochera_total:totals.parking,mascotas:draft.pets||[],mascotas_total:totals.pets,servicios:draft.extras||[],pasajeros:draft.companions||[],hora_llegada_estimada:text(draft.arrivalTime)||null}
}
async function saveStagedGuarantee(reservationId,tokenPayload){
  if(!tokenPayload?.token)return null
  const{data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("La reserva se creó, pero la sesión venció antes de guardar la tarjeta de garantía.")
  const response=await fetch("/api/hotel/mercadopago/guarantee",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({reservation_id:Number(reservationId),action:"save_card",...tokenPayload})}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||"No se pudo guardar la tarjeta de garantía.");return data
}
export async function moveReservation({reservationId,roomId,start,end}){const{data,error}=await supabase.rpc("hl_move_reservation_atomic",{p_reserva_id:Number(reservationId),p_habitacion_id:Number(roomId),p_fecha_entrada:start,p_fecha_salida:end||null});if(error)throw error;return Array.isArray(data)?data[0]:data}
export async function checkoutReservation(id){
  const{data:reservation,error:reservationError}=await supabase.from("reservas").select("id,property_id,precio_total").eq("id",Number(id)).single();if(reservationError)throw reservationError
  const{data:paymentRows,error:paymentsError}=await supabase.from("pagos").select("monto").eq("reserva_id",Number(id)).eq("property_id",reservation.property_id);if(paymentsError)throw paymentsError
  const paid=(paymentRows||[]).reduce((sum,row)=>sum+Number(row.monto||0),0),balance=Math.max(0,Number(reservation.precio_total||0)-paid)
  if(balance>.01)throw new Error(`No se puede hacer check-out: queda un saldo pendiente de $ ${balance.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}.`)
  const{data,error}=await supabase.rpc("hl_checkout_reservation_atomic",{p_reserva_id:Number(id)});if(error)throw error;return Array.isArray(data)?data[0]:data
}
export async function checkinReservation({id,propertyId}){const{error}=await supabase.from("reservas").update({estado:"alojado",checkin_real_at:new Date().toISOString()}).eq("id",id).eq("property_id",requirePropertyId(propertyId));if(error)throw error}
export async function saveReservation({draft,room,propertyId,userId,original}){
  const data=payload(draft,room,propertyId,userId),pending=draft.pendingDocuments||[],stagedPayments=draft.id?[]:(draft.initialPayments||[]).filter(item=>Number(item.amount)>0&&text(item.method)),stagedGuarantee=draft.id?null:draft.guaranteeTokenPayload,pid=requirePropertyId(propertyId);let saved
  if(draft.id){
    if(String(original?.habitacion_id)!==String(room.id)||original?.fecha_entrada!==draft.start||original?.fecha_salida!==draft.end)await moveReservation({reservationId:draft.id,roomId:room.id,start:draft.start,end:draft.end})
    ;["property_id","user_id","alojamiento_id","habitacion_id","habitaciones_ids","fecha_entrada","fecha_salida"].forEach(k=>delete data[k])
    const{data:updated,error}=await supabase.from("reservas").update(data).eq("id",draft.id).eq("property_id",pid).select("*").single();if(error)throw error;saved=updated
  }else{
    data.estado="confirmada";data.no_show=false
    const{data:created,error}=await supabase.from("reservas").insert(data).select("*").single();if(error)throw error;saved=created
    if(stagedPayments.length){
      const rows=stagedPayments.map(item=>({property_id:pid,user_id:userId,reserva_id:Number(saved.id),monto:Number(item.amount),metodo:text(item.method),moneda:item.currency||draft.currency||"ARS",nota:text(item.note)||null}))
      const{error:paymentError}=await supabase.from("pagos").insert(rows);if(paymentError)throw paymentError
    }
  }
  if(pending.length)await uploadReservationDocuments({propertyId:pid,reservationId:saved.id,userId,items:pending})
  if(stagedGuarantee?.token){try{await saveStagedGuarantee(saved.id,stagedGuarantee)}catch(error){saved={...saved,guarantee_warning:error?.message||"La tarjeta de garantía quedó pendiente de vincular."}}}
  return saved
}
export async function savePayment({propertyId,userId,reservationId,amount,method,currency="ARS",note=""}){const{error}=await supabase.from("pagos").insert({property_id:requirePropertyId(propertyId),user_id:userId,reserva_id:Number(reservationId),monto:Number(amount),metodo:method,moneda:currency,nota:note||null});if(error)throw error}