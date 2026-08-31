import{safeJson}from"../../core/formatters"

const isParkingLine=item=>item?.resource_category==="parking"||item?.kind==="parking"
const minutes=value=>{const[m,h]=String(value||"").split(":").map(Number);return Number.isFinite(m)&&Number.isFinite(h)?m*60+h:null}
const validTime=(value,fallback)=>minutes(value)==null?fallback:String(value).slice(0,5)
export function shiftDate(date,days){if(!date)return"";const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+Number(days||0));return d.toISOString().slice(0,10)}
export function dateSpan(start,end){if(!start||!end)return 0;return Math.round((new Date(`${end}T12:00:00Z`)-new Date(`${start}T12:00:00Z`))/86400000)}

export function blankReservation(){
  return{id:null,guest:"",email:"",phone:"",document:"",address:"",province:"",country:"",roomId:"",start:"",end:"",stayType:"overnight",pax:"",channel:"",channelCode:"",rate:"",currency:"ARS",notes:"",partnerId:"",groupId:"",guaranteeType:"",guaranteeBrand:"",guaranteeLast4:"",guaranteeExpiry:"",guaranteeTokenPayload:null,preferredPayment:"",vehicles:"",vehicleType:"",vehiclePlate:"",parking:"",pets:[],extras:[],companions:[],arrivalTime:"",departureTime:"",businessDayCutoff:"05:00",pendingDocuments:[],initialPayments:[]}
}

export function reservationToDraft(r){
  return{id:r.id,guest:r.nombre_huesped||"",email:r.email_huesped||"",phone:r.telefono_huesped||"",document:r.dni_huesped||"",address:r.direccion_huesped||"",province:r.provincia_estado_huesped||"",country:r.pais_huesped||"",roomId:String(r.habitacion_id||""),start:r.fecha_entrada||"",end:r.fecha_salida||"",stayType:r.tipo_estadia||"overnight",pax:r.cantidad_huespedes==null?"":Number(r.cantidad_huespedes),channel:r.canal_reserva||"",channelCode:r.codigo_canal||"",rate:r.tarifa_noche==null?"":Number(r.tarifa_noche),currency:r.moneda||"ARS",notes:r.notas||"",partnerId:r.partner_id||"",groupId:r.group_id||"",guaranteeType:r.garantia_tipo||"",guaranteeBrand:r.garantia_marca||"",guaranteeLast4:r.garantia_ultimos4||"",guaranteeExpiry:r.garantia_vencimiento||"",guaranteeTokenPayload:null,preferredPayment:r.medio_pago_preferido||"",vehicles:r.vehiculos==null?"":Number(r.vehiculos),vehicleType:r.tipo_vehiculo||"",vehiclePlate:r.dominio_vehiculo||"",parking:r.cochera_total==null?"":Number(r.cochera_total),pets:safeJson(r.mascotas,[]),extras:safeJson(r.servicios,[]),companions:safeJson(r.pasajeros,[]),arrivalTime:r.hora_llegada_estimada||"",departureTime:r.hora_salida_estimada||"",businessDayCutoff:"05:00",pendingDocuments:[],initialPayments:[]}
}

export function stayOccupancy(draft={}){
  const stayType=draft.stayType==="day_use"?"day_use":"overnight",start=draft.start||"",end=draft.end||"",arrivalTime=validTime(draft.arrivalTime,"14:00"),departureTime=validTime(draft.departureTime,"10:00"),cutoff=validTime(draft.businessDayCutoff,"05:00")
  if(!start||!end)return{valid:false,message:"Completá fecha y hora de entrada y salida.",stayType,start,end,arrivalTime,departureTime,cutoff,nights:0,billingUnits:0}
  if(end<start)return{valid:false,message:"La salida no puede ser anterior a la entrada.",stayType,start,end,arrivalTime,departureTime,cutoff,nights:0,billingUnits:0}
  if(stayType==="day_use"&&end!==start)return{valid:false,message:"Day Use debe comenzar y terminar el mismo día.",stayType,start,end,arrivalTime,departureTime,cutoff,nights:0,billingUnits:0}
  const startAt=`${start}T${arrivalTime}:00`,endAt=`${end}T${departureTime}:00`
  if(endAt<=startAt)return{valid:false,message:"La hora de salida debe ser posterior a la hora de entrada. Si llega de madrugada y se va por la mañana, usá la misma fecha con los horarios reales.",stayType,start,end,startAt,endAt,arrivalTime,departureTime,cutoff,nights:0,billingUnits:0}
  const businessDate=stayType==="overnight"&&minutes(arrivalTime)<minutes(cutoff)?shiftDate(start,-1):start
  const nights=stayType==="day_use"?0:Math.max(1,dateSpan(businessDate,end)),billingUnits=stayType==="day_use"?1:nights
  return{valid:true,message:"",stayType,start,end,startAt,endAt,arrivalTime,departureTime,cutoff,businessDate,nights,billingUnits}
}

export function stayBillingUnits(draft){return stayOccupancy(draft).billingUnits||0}

export function reservationTotal(draft,room){
  const occupancy=stayOccupancy(draft),rate=draft.rate!==""&&draft.rate!=null?Number(draft.rate||0):Number(room?.precio||0)
  const allExtras=draft.extras||[],parkingLines=allExtras.filter(isParkingLine)
  const extras=allExtras.filter(x=>!isParkingLine(x)).reduce((a,x)=>a+Number(x.total||x.amount||0),0)
  const pets=(draft.pets||[]).reduce((a,x)=>a+Number(x.amount||0),0)
  const parking=parkingLines.length?parkingLines.reduce((a,x)=>a+Number(x.total||x.amount||0),0):Number(draft.parking||0)
  const stay=occupancy.valid?Math.max(0,occupancy.billingUnits*rate):0
  return{...occupancy,rate,extras,pets,parking,stay,total:occupancy.valid?Math.max(0,stay+extras+pets+parking):0}
}