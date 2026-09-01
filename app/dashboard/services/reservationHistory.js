import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"

const text=value=>String(value||"").trim()

export async function loadReservationHistory({propertyId=null,reservationId,guestProfileId=null,guestIdentity={}}){
  const rid=Number(reservationId)
  if(!rid)return{events:[],stays:[],payments:[],current:null}
  let current=null,pid=propertyId
  if(!pid||!guestProfileId&&![guestIdentity.document,guestIdentity.email,guestIdentity.phone].some(text)){
    const{data,error}=await supabase.from("reservas").select("id,property_id,guest_profile_id,dni_huesped,email_huesped,telefono_huesped,nombre_huesped").eq("id",rid).single()
    if(error)throw error
    current=data
    pid=pid||data.property_id
    guestProfileId=guestProfileId||data.guest_profile_id||null
    guestIdentity={document:guestIdentity.document||data.dni_huesped,email:guestIdentity.email||data.email_huesped,phone:guestIdentity.phone||data.telefono_huesped}
  }
  pid=requirePropertyId(pid)
  const{data:events,error:eventError}=await supabase.from("hotel_reservation_events").select("id,event_type,title,detail,payload,actor_user_id,actor_name,created_at").eq("property_id",pid).eq("reservation_id",rid).order("created_at",{ascending:false}).limit(120)
  if(eventError)throw eventError

  let stayQuery=supabase.from("reservas").select("id,numero_reserva,guest_profile_id,nombre_huesped,fecha_entrada,fecha_salida,noches,precio_total,moneda,estado,no_show,habitacion_id,canal_reserva,dni_huesped,email_huesped,telefono_huesped").eq("property_id",pid).order("fecha_entrada",{ascending:false}).limit(30)
  if(guestProfileId)stayQuery=stayQuery.eq("guest_profile_id",guestProfileId)
  else if(text(guestIdentity.document))stayQuery=stayQuery.eq("dni_huesped",text(guestIdentity.document))
  else if(text(guestIdentity.email))stayQuery=stayQuery.eq("email_huesped",text(guestIdentity.email))
  else if(text(guestIdentity.phone))stayQuery=stayQuery.eq("telefono_huesped",text(guestIdentity.phone))
  else return{events:events||[],stays:[],payments:[],current}

  const{data:stays,error:stayError}=await stayQuery
  if(stayError)throw stayError
  const ids=(stays||[]).map(row=>Number(row.id)).filter(Boolean)
  if(!ids.length)return{events:events||[],stays:[],payments:[],current}
  const{data:payments,error:paymentError}=await supabase.from("pagos").select("id,reserva_id,monto,moneda,metodo,fecha,created_at").eq("property_id",pid).in("reserva_id",ids)
  if(paymentError)throw paymentError
  return{events:events||[],stays:stays||[],payments:payments||[],current}
}
