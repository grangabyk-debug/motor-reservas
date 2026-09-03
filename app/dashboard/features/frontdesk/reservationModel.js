import{safeJson}from"../../core/formatters"

const isParkingLine=item=>item?.resource_category==="parking"||item?.kind==="parking"
const minutes=value=>{const[m,h]=String(value||"").split(":").map(Number);return Number.isFinite(m)&&Number.isFinite(h)?m*60+h:null}
const validTime=(value,fallback)=>minutes(value)==null?fallback:String(value).slice(0,5)
const uniqueRoomIds=(primary,additional=[])=>[...new Set([primary,...additional.map(item=>item?.roomId)].map(String).filter(Boolean))]
const inferVehicleType=name=>String(name||"").replace(/^cochera\s*/i,"").trim()
export function shiftDate(date,days){if(!date)return"";const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+Number(days||0));return d.toISOString().slice(0,10)}
export function dateSpan(start,end){if(!start||!end)return 0;return Math.round((new Date(`${end}T12:00:00Z`)-new Date(`${start}T12:00:00Z`))/86400000)}

export function blankReservation(){
  return{id:null,guest:"",email:"",phone:"",documentType:"",document:"",birthDate:"",nationality:"",language:"",address:"",city:"",province:"",country:"",roomId:"",additionalRooms:[],start:"",end:"",stayType:"overnight",pax:"",channel:"",channelCode:"",rate:"",currency:"ARS",notes:"",partnerId:"",groupId:"",guaranteeType:"",guaranteeBrand:"",guaranteeLast4:"",guaranteeExpiry:"",guaranteeTokenPayload:null,preferredPayment:"",vehicles:"",vehicleDetails:[],vehicleType:"",vehiclePlate:"",parking:"",pets:[],extras:[],companions:[],arrivalTime:"",departureTime:"",businessDayCutoff:"05:00",pendingDocuments:[],initialPayments:[]}
}

export function reservationToDraft(r){
  const primary=String(r.habitacion_id||""),details=safeJson(r.habitaciones_detalle,[]),ids=[...new Set([...(Array.isArray(r.habitaciones_ids)?r.habitaciones_ids:[]),r.habitacion_id].map(String).filter(Boolean))],detailMap=new Map((Array.isArray(details)?details:[]).map(item=>[String(item?.habitacion_id||item?.roomId||""),item])),services=safeJson(r.servicios,[]),parkingLines=(Array.isArray(services)?services:[]).filter(isParkingLine)
  const additionalRooms=ids.filter(id=>id!==primary).map(id=>{const item=detailMap.get(id)||{};return{roomId:id,rate:item.tarifa_noche==null?"":Number(item.tarifa_noche),name:item.nombre||"",type:item.tipo||""}}),vehicleCount=Math.max(Number(r.vehiculos||0),parkingLines.length),vehicleDetails=Array.from({length:vehicleCount},(_,index)=>{const line=parkingLines[index]||{},quantity=Math.max(0,Number(line.quantity||0)),unitPrice=line.unit_price!=null?Number(line.unit_price||0):(quantity?Number(line.total||0)/quantity:0);return{key:line.vehicle_key||`vehicle-${r.id||"reservation"}-${index+1}`,resourceId:String(line.resource_id||""),parkingName:line.name||"",type:line.vehicle_type||(index===0?r.tipo_vehiculo:"")||inferVehicleType(line.name),plate:line.vehicle_plate||(index===0?r.dominio_vehiculo:"")||"",days:quantity,unitPrice:Math.max(0,unitPrice),total:Math.max(0,Number(line.total||quantity*unitPrice)),manualDays:Boolean(line.vehicle_manual_days)}})
  return{id:r.id,guest:r.nombre_huesped||"",email:r.email_huesped||"",phone:r.telefono_huesped||"",documentType:r.tipo_documento_huesped||"",document:r.dni_huesped||"",birthDate:r.fecha_nacimiento_huesped||"",nationality:r.nacionalidad_huesped||"",language:r.idioma_huesped||"",address:r.direccion_huesped||"",city:r.ciudad_huesped||"",province:r.provincia_estado_huesped||"",country:r.pais_huesped||"",roomId:primary,additionalRooms,start:r.fecha_entrada||"",end:r.fecha_salida||"",stayType:r.tipo_estadia||"overnight",pax:r.cantidad_huespedes==null?"":Number(r.cantidad_huespedes),channel:r.canal_reserva||"",channelCode:r.codigo_canal||"",rate:r.tarifa_noche==null?"":Number(r.tarifa_noche),currency:r.moneda||"ARS",notes:r.notas||"",partnerId:r.partner_id||"",groupId:r.group_id||"",guaranteeType:r.garantia_tipo||"",guaranteeBrand:r.garantia_marca||"",guaranteeLast4:r.garantia_ultimos4||"",guaranteeExpiry:r.garantia_vencimiento||"",guaranteeTokenPayload:null,preferredPayment:r.medio_pago_preferido||"",vehicles:vehicleCount||"",vehicleDetails,vehicleType:r.tipo_vehiculo||vehicleDetails.map(item=>item.type).filter(Boolean).join(" + "),vehiclePlate:r.dominio_vehiculo||vehicleDetails.map(item=>item.plate).filter(Boolean).join(" + "),parking:r.cochera_total==null?"":Number(r.cochera_total),pets:safeJson(r.mascotas,[]),extras:Array.isArray(services)?services:[],companions:safeJson(r.pasajeros,[]),arrivalTime:r.hora_llegada_estimada||"",departureTime:r.hora_salida_estimada||"",businessDayCutoff:"05:00",pendingDocuments:[],initialPayments:[]}
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
  const occupancy=stayOccupancy(draft),rate=draft.rate!==""&&draft.rate!=null?Number(draft.rate||0):Number(room?.precio||0),additional=(draft.additionalRooms||[]).filter(item=>item?.roomId&&String(item.roomId)!==String(draft.roomId)),allExtras=draft.extras||[],parkingLines=allExtras.filter(isParkingLine)
  const extras=allExtras.filter(x=>!isParkingLine(x)).reduce((a,x)=>a+Number(x.total||x.amount||0),0)
  const pets=(draft.pets||[]).reduce((a,x)=>a+Number(x.amount||0),0)
  const parking=parkingLines.length?parkingLines.reduce((a,x)=>a+Number(x.total||x.amount||0),0):Number(draft.parking||0)
  const primaryStay=occupancy.valid?Math.max(0,occupancy.billingUnits*rate):0,additionalStay=occupancy.valid?additional.reduce((sum,item)=>sum+Math.max(0,occupancy.billingUnits*Number(item.rate||0)),0):0,stay=primaryStay+additionalStay,roomIds=uniqueRoomIds(draft.roomId,additional)
  return{...occupancy,rate,extras,pets,parking,primaryStay,additionalStay,stay,roomCount:roomIds.length,roomIds,total:occupancy.valid?Math.max(0,stay+extras+pets+parking):0}
}
