const collator=new Intl.Collator("es",{numeric:true,sensitivity:"base"})

export const ROOM_TYPE_FAMILIES=[
  {key:"single",label:"Single",aliases:["single","singles","individual","individuales","sencilla","sencillas","sencillo","sencillos"]},
  {key:"double",label:"Doble",aliases:["doble","dobles","double","doubles","matrimonial","matrimoniales"]},
  {key:"twin",label:"Twin",aliases:["twin","twins","dos camas","2 camas"]},
  {key:"triple",label:"Triple",aliases:["triple","triples"]},
  {key:"quadruple",label:"Cuádruple",aliases:["cuadruple","cuadruples","quadruple","quadruples","quad"]},
  {key:"quintuple",label:"Quíntuple",aliases:["quintuple","quintuples"]},
  {key:"sextuple",label:"Séxtuple",aliases:["sextuple","sextuples"]},
  {key:"deluxe",label:"Deluxe",aliases:["deluxe","de luxe","luxury","lujo"]},
  {key:"executive",label:"Ejecutiva",aliases:["ejecutiva","ejecutivo","executive"]},
  {key:"premium",label:"Premium",aliases:["premium"]},
  {key:"senior",label:"Senior",aliases:["senior"]},
  {key:"suite",label:"Suite",aliases:["suite","suites"]},
  {key:"presidential",label:"Presidencial",aliases:["presidencial","presidential"]},
  {key:"apartment",label:"Apartamento",aliases:["apartamento","apartamentos","apartment","apartments","departamento","departamentos"]},
]

const FAMILY_BY_CAPACITY={1:"single",2:"double",3:"triple",4:"quadruple",5:"quintuple",6:"sextuple"}
const FAMILY_BY_KEY=new Map(ROOM_TYPE_FAMILIES.map((family,index)=>[family.key,{...family,rank:index}]))
const OTHER_FAMILY={key:"other",label:"Otros",rank:ROOM_TYPE_FAMILIES.length}

export function normalizeRoomType(value=""){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ")
}

function aliasIndex(text,alias){
  const haystack=` ${text} `,needle=` ${alias} `,index=haystack.indexOf(needle)
  return index<0?Number.POSITIVE_INFINITY:index
}

export function roomTypeFamily(value,capacity){
  const source=typeof value==="string"?{name:value,capacity}:value||{}
  const name=source.name??source.tipo??source.type??"",normalized=normalizeRoomType(name)
  let best=null
  for(const family of ROOM_TYPE_FAMILIES){
    for(const rawAlias of family.aliases){
      const index=aliasIndex(normalized,normalizeRoomType(rawAlias)),rank=FAMILY_BY_KEY.get(family.key).rank
      if(Number.isFinite(index)&&(!best||index<best.index||(index===best.index&&rank<best.family.rank)))best={index,family:FAMILY_BY_KEY.get(family.key)}
    }
  }
  if(best)return best.family
  if(normalized)return OTHER_FAMILY
  const numericCapacity=Math.max(0,Number(source.capacity??source.capacidad??capacity)||0),fallbackKey=FAMILY_BY_CAPACITY[numericCapacity]
  return fallbackKey?FAMILY_BY_KEY.get(fallbackKey):OTHER_FAMILY
}

function numericOrder(value){const number=Number(value);return Number.isFinite(number)?number:0}
function typeName(value,typeById){const linked=typeById&&value?.room_type_id?typeById.get(value.room_type_id):null;return linked?.name||value?.tipo||value?.type||""}
function typeCapacity(value,typeById){const linked=typeById&&value?.room_type_id?typeById.get(value.room_type_id):null;return linked?.capacity??value?.capacidad??value?.capacity??0}
function floorData(value,floorById){return floorById&&value?.floor_id?floorById.get(value.floor_id)||null:null}
function floorOrder(value,floorById){const floor=floorData(value,floorById),raw=floor?.sort_order??value?.floor_sort;const number=Number(raw);return Number.isFinite(number)?number:Number.MAX_SAFE_INTEGER}
function floorName(value,floorById){return floorData(value,floorById)?.name||value?.floor_name||""}

export function compareRoomTypes(a,b){
  const familyA=roomTypeFamily(a),familyB=roomTypeFamily(b)
  if(familyA.rank!==familyB.rank)return familyA.rank-familyB.rank
  const order=numericOrder(a?.sort_order)-numericOrder(b?.sort_order)
  if(order)return order
  return collator.compare(a?.name||"",b?.name||"")||collator.compare(String(a?.id||""),String(b?.id||""))
}

export function compareRooms(a,b,typeById,floorById){
  const nameA=typeName(a,typeById),nameB=typeName(b,typeById),familyA=roomTypeFamily(nameA,typeCapacity(a,typeById)),familyB=roomTypeFamily(nameB,typeCapacity(b,typeById))
  if(familyA.rank!==familyB.rank)return familyA.rank-familyB.rank
  const typeOrder=collator.compare(nameA,nameB)
  if(typeOrder)return typeOrder
  const floorDiff=floorOrder(a,floorById)-floorOrder(b,floorById)
  if(floorDiff)return floorDiff
  const floorLabel=collator.compare(floorName(a,floorById),floorName(b,floorById))
  if(floorLabel)return floorLabel
  const roomOrder=numericOrder(a?.sort_order)-numericOrder(b?.sort_order)
  if(roomOrder)return roomOrder
  return collator.compare(a?.nombre||a?.name||"",b?.nombre||b?.name||"")||collator.compare(String(a?.id||""),String(b?.id||""))
}

export const sortRoomTypesByHotelCategory=types=>[...(types||[])].sort(compareRoomTypes)
export const sortRoomsByHotelCategory=(rooms,typeById,floorById)=>[...(rooms||[])].sort((a,b)=>compareRooms(a,b,typeById,floorById))
