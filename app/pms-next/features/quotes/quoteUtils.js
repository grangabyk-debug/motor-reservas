const DAY=86400000
const pad=v=>String(v).padStart(2,"0")
export const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
export const addDays=(value,n)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+n);return dateKey(d)}
export const nights=(a,b)=>Math.max(1,Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/DAY))
export const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)
export const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[char])

export function freshForm(currency="ARS"){
  const start=dateKey(new Date())
  return{name:"",email:"",phone:"",start,end:addDays(start,1),pax:2,currency,validUntil:addDays(dateKey(new Date()),7),terms:"Tarifas sujetas a disponibilidad al momento de confirmar.",notes:"",selection:{}}
}
const roomCapacity=room=>Math.max(1,Number(room?.capacidad)||1)
function distributeGuests(picks,total){
  const result=new Map(picks.map(pick=>[String(pick.room.id),0])),remaining={value:Math.max(0,Number(total)||0)}
  for(const pick of picks){if(remaining.value<=0)break;const id=String(pick.room.id);if(roomCapacity(pick.room)>0){result.set(id,1);remaining.value--}}
  while(remaining.value>0){let moved=false;for(const pick of picks){if(remaining.value<=0)break;const id=String(pick.room.id),current=result.get(id)||0,space=roomCapacity(pick.room)-current;if(space>0){result.set(id,current+1);remaining.value--;moved=true}}if(!moved)break}
  return{distribution:result,remaining:remaining.value}
}
function defaultBeds(room,guests){
  const g=Math.max(0,Math.min(roomCapacity(room),Number(guests)||0)),type=String(room?.tipo||"").toLowerCase()
  if(!g)return{matrimonial:0,individual:0}
  if(type.includes("twin")||type.includes("individual")||type.includes("single"))return{matrimonial:0,individual:g}
  if(g===1)return{matrimonial:0,individual:1}
  return{matrimonial:1,individual:Math.max(0,g-2)}
}
export function picksFromSelection(selection,types){
  const picks=[]
  for(const[typeName,rawQty]of Object.entries(selection||{})){
    const qty=Math.max(0,Math.round(Number(rawQty)||0));if(!qty)continue
    const bucket=types.find(type=>type.name===typeName)
    if(!bucket||bucket.available<qty)throw new Error(`Ya no hay ${qty} ${typeName} disponibles para esas fechas.`)
    const candidates=bucket.freeRooms.slice(bucket.reserved,bucket.reserved+qty)
    if(candidates.length<qty)throw new Error(`No pudimos asignar las habitaciones de ${typeName}.`)
    candidates.forEach(room=>picks.push({room,soldAs:typeName,rate:Number(bucket.basePrice)||Number(room.precio)||0}))
  }
  return picks
}
export function selectionFromLines(quoteLines){
  const selection={}
  for(const line of quoteLines||[]){if(line.category!=="room")continue;const type=line.metadata?.room_type||line.description,qty=Math.max(1,Math.round(Number(line.quantity)||1));selection[type]=(selection[type]||0)+qty}
  return selection
}
export function roomingDetails(picks,totalGuests){
  const totalCapacity=picks.reduce((sum,pick)=>sum+roomCapacity(pick.room),0),requested=Math.max(1,Number(totalGuests)||1)
  if(requested>totalCapacity)throw new Error(`Las habitaciones seleccionadas tienen capacidad para ${totalCapacity} huésped${totalCapacity===1?"":"es"}, pero el presupuesto indica ${requested}.`)
  const{distribution,remaining}=distributeGuests(picks,requested)
  if(remaining>0)throw new Error("No pudimos distribuir todos los huéspedes entre las habitaciones seleccionadas.")
  return picks.map(pick=>{const guests=distribution.get(String(pick.room.id))||0,beds=defaultBeds(pick.room,guests);return{habitacion_id:Number(pick.room.id),nombre:pick.room.nombre,categoria_asignada:pick.room.tipo||"Habitación",categoria_vendida:pick.soldAs||pick.room.tipo||"Habitación",huespedes:guests,tarifa_noche:Math.max(0,Number(pick.rate)||0),rooming:{matrimonial:beds.matrimonial,individual:beds.individual}}})
}
export function buildQuoteText({quote,group,quoteLines,propertyName}){
  const concepts=(quoteLines||[]).filter(line=>line.category==="room").map(line=>`${Number(line.quantity)||1} × ${line.description}: ${money(line.total||line.unit_price,quote.currency)}`).join("\n")
  return`Hola ${group?.contact_name||group?.name||""},\n\nTe compartimos el presupuesto ${quote.quote_number} de ${propertyName||"Hotel"}.\n\nEstadía: ${group?.arrival_date||"—"} al ${group?.departure_date||"—"}\nHuéspedes: ${group?.estimated_pax||0}\n${concepts?`${concepts}\n`:""}Total: ${money(quote.total,quote.currency)}\nVálido hasta: ${quote.valid_until||"—"}\n\n${quote.terms||"Tarifas sujetas a disponibilidad al momento de confirmar."}\n\nSi querés avanzar con la reserva, respondé este mensaje y la confirmamos.`
}