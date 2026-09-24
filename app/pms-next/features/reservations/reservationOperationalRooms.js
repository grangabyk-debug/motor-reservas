const numeric=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:null}

function addId(set,value){const id=numeric(value);if(id)set.add(id)}

export function operationalRoomIds(item,rooms=[]){
  const ids=new Set()
  for(const room of rooms)addId(ids,room?.id)
  addId(ids,item?.habitacion_id)
  for(const id of item?.habitaciones_ids||[])addId(ids,id)
  for(const detail of Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]){
    addId(ids,detail?.habitacion_id)
    addId(ids,detail?.moved_from_room_id)
    addId(ids,detail?.moved_to_room_id)
    for(const movement of Array.isArray(detail?.movement_history)?detail.movement_history:[])addId(ids,movement?.habitacion_id)
  }
  for(const key of Object.keys(item?.room_checkout_dates||{}))if(/^\\d+$/.test(key))addId(ids,key)
  return[...ids]
}

export function sortOperationalRooms(rooms=[],activeRoomIds=new Set()){
  return[...rooms].sort((a,b)=>{
    const activeDiff=Number(activeRoomIds.has(Number(b?.id)))-Number(activeRoomIds.has(Number(a?.id)))
    if(activeDiff)return activeDiff
    return String(a?.nombre||"").localeCompare(String(b?.nombre||""),"es",{numeric:true})
  })
}

export function operationalRoomLabel(room,activeRoomIds=new Set()){
  const active=activeRoomIds.has(Number(room?.id))
  return `${room?.nombre||room?.id||"—"} · ${room?.tipo||"Habitación"}${active?"":" · anterior"}`
}
