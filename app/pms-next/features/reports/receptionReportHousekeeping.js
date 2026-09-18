const collator=new Intl.Collator("es",{numeric:true,sensitivity:"base"})

const clean=value=>String(value||"").trim()
const normalize=value=>clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
const capacity=room=>Math.max(1,Number(room?.capacidad)||1)

function roomingText(rooming){
  const matrimonial=Math.max(0,Number(rooming?.matrimonial)||0),individual=Math.max(0,Number(rooming?.individual)||0),parts=[]
  if(matrimonial)parts.push(`${matrimonial} matrimonial${matrimonial===1?"":"es"}`)
  if(individual)parts.push(`${individual} individual${individual===1?"":"es"} / twin`)
  return parts.join(" + ")
}

function configuredBedText(room){
  const raw=clean(room?.bed_configuration),text=normalize(raw)
  if(!text)return"—"
  const sum=regex=>{let total=0;for(const match of text.matchAll(regex))total+=Math.max(0,Number(match[1])||0);return total}
  let matrimonial=sum(/(\d+)\s*(?:camas?\s*)?(?:matrimoniales?|dobles?|queens?|kings?)/g)
  let individual=sum(/(\d+)\s*(?:camas?\s*)?(?:individual(?:es)?|twins?|singles?)/g)
  const hasMatrimonial=/(?:matrimonial|doble|queen|king)/.test(text),hasIndividual=/(?:individual|twin|single)/.test(text)
  if(!matrimonial&&!individual){
    if(hasIndividual&&!hasMatrimonial)individual=capacity(room)
    else if(hasMatrimonial&&!hasIndividual)matrimonial=1
  }
  return roomingText({matrimonial,individual})||raw
}

function detailForRoom(reservation,roomId){
  return(Array.isArray(reservation?.habitaciones_detalle)?reservation.habitaciones_detalle:[]).find(detail=>Number(detail?.habitacion_id)===Number(roomId))||null
}

function reservationContext(stays,day){
  const arrivals=stays.filter(row=>row.fecha_entrada===day),continuing=stays.filter(row=>row.fecha_entrada<day&&row.fecha_salida>day),departures=stays.filter(row=>row.fecha_salida===day)
  return{
    display:arrivals[0]||continuing[0]||departures[0]||stays[0]||null,
    bed:arrivals[0]||continuing[0]||null,
    operation:arrivals.length&&departures.length?"Salida + llegada":departures.length?"Salida":arrivals.length?"Llegada":continuing.length?"Permanencia":"Libre",
  }
}

function floorRank(room,floorById){
  const floor=floorById.get(room.floor_id),rank=Number(floor?.sort_order)
  return Number.isFinite(rank)?rank:Number.MAX_SAFE_INTEGER
}

export function buildHousekeepingRows({rooms,floors,reservationsByRoom,taskByRoom,profiles,day}){
  const floorById=new Map((floors||[]).map(floor=>[floor.id,floor])),ordered=[...(rooms||[])].sort((a,b)=>{
    const diff=floorRank(a,floorById)-floorRank(b,floorById)
    if(diff)return diff
    return collator.compare(clean(a.nombre),clean(b.nombre))||Number(a.sort_order||0)-Number(b.sort_order||0)
  })
  return ordered.map(room=>{
    const stays=reservationsByRoom.get(Number(room.id))||[],context=reservationContext(stays,day),task=taskByRoom.get(Number(room.id)),bedDetail=context.bed?detailForRoom(context.bed,room.id):null,specific=roomingText(bedDetail?.rooming),bedSetup=specific||configuredBedText(room)
    return{
      id:`room-${room.id}`,
      room:room.nombre,
      reservation:context.display?.numero_reserva||"—",
      guest:context.display?.nombre_huesped||"—",
      type:room.tipo||"—",
      bedSetup,
      bedSetupSource:specific?(context.bed?.numero_reserva?`Reserva ${context.bed.numero_reserva}`:"Reserva"):(bedSetup!=="—"?"Configuración fija de la habitación":"Sin configurar"),
      roomStatus:room.estado||"—",
      operation:context.operation,
      task:task?.task_type?.replaceAll("_"," ")||"—",
      taskStatus:task?.status||"—",
      responsible:task?.assigned_to?profiles.get(task.assigned_to)||"Asignado":"—",
      note:task?.notes||"",
    }
  })
}

export function reportDateLabel(value){
  const[y,m,d]=String(value||"").split("-")
  return y&&m&&d?`${d}/${m}/${y}`:String(value||"")
}
