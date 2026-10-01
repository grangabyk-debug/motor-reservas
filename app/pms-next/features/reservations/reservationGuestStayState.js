export function guestsWithStayState({guests=[],roomIdSet=new Set(),checkedRoomIds=new Set(),legacyAllInHouse=false}){
  const today=new Date().toLocaleDateString("en-CA",{timeZone:"America/Argentina/Buenos_Aires"})
  return guests.filter(guest=>!guest.room_id||roomIdSet.has(String(guest.room_id))).map(guest=>{
    const from=String(guest.stay_from||""),to=String(guest.stay_to||""),inside=(!from||from<=today)&&(!to||today<to)
    return{...guest,_in_house:inside&&!guest.checked_out_at&&(legacyAllInHouse||Boolean(guest.room_id&&checkedRoomIds.has(String(guest.room_id))))}
  })
}
