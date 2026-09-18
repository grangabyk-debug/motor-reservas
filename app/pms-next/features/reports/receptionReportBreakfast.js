import{activeReservationRoomIds}from"../reservations/reservationEditUtils"

const clean=value=>String(value||"").trim()
const normalized=value=>clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()

function activeDetails(reservation){
  const released=new Set(Object.keys(reservation?.room_checkout_dates||{}).map(String))
  return(Array.isArray(reservation?.habitaciones_detalle)?reservation.habitaciones_detalle:[]).filter(detail=>{
    const id=String(detail?.habitacion_id||""),role=normalized(detail?.segment_role)
    return id&&!released.has(id)&&role!=="previous_room"&&role!=="transient_room"
  })
}

function fallbackCapacity(reservation,roomMap){
  const ids=activeReservationRoomIds(reservation).map(Number)
  const total=ids.reduce((sum,id)=>{
    const room=roomMap.get(id),stored=Number(room?.capacidad)
    if(Number.isFinite(stored)&&stored>0)return sum+stored
    const type=normalized(room?.tipo)
    if(type.includes("cuadru"))return sum+4
    if(type.includes("triple"))return sum+3
    if(type.includes("doble")||type.includes("suite"))return sum+2
    return sum+1
  },0)
  return Math.max(1,total||1)
}

function guestKey(guest){
  return clean(guest?.guest_profile_id)||[
    normalized(guest?.full_name),String(guest?.room_id||""),String(guest?.birth_date||"")
  ].join("|")
}

function relevantGuests(guests,day){
  const map=new Map()
  for(const guest of guests||[]){
    if(guest?.stay_from&&guest.stay_from>day)continue
    if(guest?.stay_to&&guest.stay_to<day)continue
    const key=guestKey(guest)
    if(key&&!map.has(key))map.set(key,guest)
  }
  return[...map.values()]
}

function ageAt(birthDate,day){
  if(!birthDate||!day)return null
  const birth=new Date(`${birthDate}T12:00:00`),target=new Date(`${day}T12:00:00`)
  if(Number.isNaN(birth.getTime())||Number.isNaN(target.getTime()))return null
  let age=target.getFullYear()-birth.getFullYear()
  const beforeBirthday=target.getMonth()<birth.getMonth()||(target.getMonth()===birth.getMonth()&&target.getDate()<birth.getDate())
  if(beforeBirthday)age-=1
  return age>=0?age:null
}

const label=(count,singular,plural)=>`${count} ${count===1?singular:plural}`

export function breakfastOccupancy({reservation,day,roomMap,guests=[]}){
  const details=activeDetails(reservation),detailPax=details.reduce((sum,detail)=>sum+Math.max(0,Number(detail?.huespedes)||0),0),storedPax=Math.max(0,Number(reservation?.cantidad_huespedes)||0)
  const pax=detailPax>0?detailPax:storedPax>0?storedPax:fallbackCapacity(reservation,roomMap)
  const source=detailPax>0?"Distribución cargada en la reserva":storedPax>0?"Cantidad de huéspedes de la ficha":"Capacidad predeterminada de la habitación"
  const registered=relevantGuests(guests,day)
  let adults=0,minors=0,unknownBirth=0
  for(const guest of registered){
    const age=ageAt(guest.birth_date,day)
    if(age===null)unknownBirth+=1
    else if(age<18)minors+=1
    else adults+=1
  }
  const missing=Math.max(0,pax-registered.length),unknown=Math.max(0,unknownBirth+missing)
  const parts=[]
  if(adults)parts.push(label(adults,"adulto","adultos"))
  if(minors)parts.push(label(minors,"menor","menores"))
  if(unknown)parts.push(`${unknown} s/d edad`)
  if(!parts.length)parts.push(label(pax,"pasajero","pasajeros"))
  return{pax,adults,minors,unknown,composition:parts.join(" · "),source}
}
