import{nightsBetween,safeJson}from"../../core/formatters"

export function blankReservation(){
  return{id:null,guest:"",email:"",phone:"",document:"",address:"",province:"",country:"",roomId:"",start:"",end:"",pax:"",channel:"",channelCode:"",rate:"",currency:"ARS",notes:"",partnerId:"",groupId:"",guaranteeType:"",guaranteeBrand:"",guaranteeLast4:"",guaranteeExpiry:"",preferredPayment:"",vehicles:"",vehicleType:"",vehiclePlate:"",parking:"",pets:[],extras:[],companions:[],arrivalTime:"",pendingDocuments:[]}
}

export function reservationToDraft(r){
  return{id:r.id,guest:r.nombre_huesped||"",email:r.email_huesped||"",phone:r.telefono_huesped||"",document:r.dni_huesped||"",address:r.direccion_huesped||"",province:r.provincia_estado_huesped||"",country:r.pais_huesped||"",roomId:String(r.habitacion_id||""),start:r.fecha_entrada||"",end:r.fecha_salida||"",pax:r.cantidad_huespedes==null?"":Number(r.cantidad_huespedes),channel:r.canal_reserva||"",channelCode:r.codigo_canal||"",rate:r.tarifa_noche==null?"":Number(r.tarifa_noche),currency:r.moneda||"ARS",notes:r.notas||"",partnerId:r.partner_id||"",groupId:r.group_id||"",guaranteeType:r.garantia_tipo||"",guaranteeBrand:r.garantia_marca||"",guaranteeLast4:r.garantia_ultimos4||"",guaranteeExpiry:r.garantia_vencimiento||"",preferredPayment:r.medio_pago_preferido||"",vehicles:r.vehiculos==null?"":Number(r.vehiculos),vehicleType:r.tipo_vehiculo||"",vehiclePlate:r.dominio_vehiculo||"",parking:r.cochera_total==null?"":Number(r.cochera_total),pets:safeJson(r.mascotas,[]),extras:safeJson(r.servicios,[]),companions:safeJson(r.pasajeros,[]),arrivalTime:r.hora_llegada_estimada||"",pendingDocuments:[]}
}

export function reservationTotal(draft,room){
  const nights=draft.start&&draft.end?nightsBetween(draft.start,draft.end):0
  const rate=draft.rate!==""&&draft.rate!=null?Number(draft.rate||0):Number(room?.precio||0)
  const extras=(draft.extras||[]).reduce((a,x)=>a+Number(x.total||x.amount||0),0)
  const pets=(draft.pets||[]).reduce((a,x)=>a+Number(x.amount||0),0)
  const parking=Number(draft.parking||0)
  return{nights,rate,total:nights?Math.max(0,nights*rate+extras+pets+parking):0}
}
