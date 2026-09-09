const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim()
const compact=value=>normalize(value).replace(/\s+/g,"")

const HK_ITEMS=[
  ["sabana",/\b(sabana|sabanas|ropa de cama)\b/],
  ["toalla",/\b(toalla|toallas|toallon|toallones)\b/],
  ["almohada",/\b(almohada|almohadas)\b/],
  ["manta",/\b(manta|mantas|frazada|frazadas)\b/],
  ["cuna",/\b(cuna|cunas)\b/],
  ["papel higiénico",/\b(papel higienico|papel de bano)\b/],
  ["amenities",/\b(amenities|amenity|jabon|jabones|shampoo|champu|acondicionador)\b/],
  ["limpieza",/\b(limpieza|limpiar|repasar|aseo|hacer la habitacion|hacer habitacion)\b/],
  ["recambio de cama",/\b(cambiar la cama|cambio de cama|recambio de cama|cambiar sabanas)\b/],
]

const FAILURE=/\b(perdida|pierde|perdiendo|fuga|gotea|goteando|gotera|filtra|filtracion|humedad|mojado|mojada|rebalsa|rebalse|tapado|tapada|atascado|atascada|roto|rota|rompio|fallando|falla|fallo|averiado|averiada|quemado|quemada|no anda|no funciona|no prende|no enciende|no enfria|no calienta|sin agua|sin luz|sin wifi|sin internet|sin calefaccion|olor a gas|humo|chispa|chispas)\b/
const TECHNICAL=/\b(aire|acondicionado|tv|televisor|television|ducha|canilla|grifo|inodoro|bano|luz|lampara|enchufe|electricidad|cerradura|puerta|ventana|wifi|internet|calefaccion|calefactor|agua caliente|heladera|minibar|secador|telefono|caja fuerte|safe|ascensor)\b/
const HK_NEED=/\b(falta|faltan|necesita|necesitan|sin|manda|mandale|mandales|mandar|envia|enviar|enviale|enviales|lleva|llevale|llevales|llevar|subi|subir|subile|subiles|deja|dejar|dejale|dejales|alcanza|alcanzar|alcanzale|alcanzales|pasa|pasar|pasale|pasales|reponer|repon|cambiar|cambio|agregar|agrega|pone|poner|pedir|pide|piden|quiere|quieren|hace falta|hacen falta)\b/

function isQuestion(value){const q=normalize(value);return String(value||"").includes("?")||/^(como|que|cual|cuanto|cuanta|cuantos|cuantas|por que|deberia|conviene|puedo|podemos|sabes|sabemos)\b/.test(q)}
function roomKey(value){return compact(value).replace(/^(habitacion|hab|cuarto|room)/,"")}
function roomMatches(room,ref){const a=roomKey(room?.nombre),b=roomKey(ref);return !!a&&!!b&&a===b}

function roomCandidates(question,rooms=[]){
  const q=normalize(question),refs=[]
  const explicit=[...q.matchAll(/\b(?:habitacion|hab|cuarto|room)\s*(?:n|numero)?\s*([a-z0-9-]+)\b/g)].map(m=>m[1])
  refs.push(...explicit)
  for(const m of q.matchAll(/\b(?:a la|al|en la|en el|en|la|el|para la|para el|de la|del)\s+([a-z0-9-]+)\b/g))refs.push(m[1])
  const direct=[]
  for(const room of rooms){
    const key=roomKey(room?.nombre)
    if(!key)continue
    const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")
    if(new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(q))direct.push(key)
  }
  refs.push(...direct)
  const matched=[]
  for(const ref of refs){for(const room of rooms){if(roomMatches(room,ref)&&!matched.some(x=>Number(x.id)===Number(room.id)))matched.push(room)}}
  return matched
}

function activeReservation(context,roomId){
  const today=String(context?.hoy||"").slice(0,10)
  if(!today)return null
  const rows=(context?.reservas||[]).filter(r=>{
    if(String(r?.estado||"").toLowerCase()==="cancelada")return false
    const ids=[r?.habitacion_id,...(Array.isArray(r?.habitaciones_ids)?r.habitaciones_ids:[])].map(Number)
    return ids.includes(Number(roomId))&&String(r?.entrada||"")<=today&&String(r?.salida||"")>today
  })
  return rows.length===1?rows[0]:null
}

function maintenanceTitle(q,roomName){
  if(/\b(perdida|pierde|fuga|gotea|gotera|filtra|filtracion|humedad)\b/.test(q))return`Pérdida o filtración · Habitación ${roomName}`
  if(/\b(aire|acondicionado)\b/.test(q))return`Aire acondicionado con falla · Habitación ${roomName}`
  if(/\b(tv|televisor|television)\b/.test(q))return`Televisor con falla · Habitación ${roomName}`
  if(/\b(caja fuerte|safe)\b/.test(q))return`Caja fuerte con inconveniente · Habitación ${roomName}`
  if(/\b(ducha|canilla|grifo|inodoro|bano|agua caliente)\b/.test(q))return`Problema de baño o agua · Habitación ${roomName}`
  if(/\b(luz|lampara|enchufe|electricidad)\b/.test(q))return`Problema eléctrico · Habitación ${roomName}`
  if(/\b(cerradura|puerta|ventana)\b/.test(q))return`Problema de acceso o abertura · Habitación ${roomName}`
  if(/\b(wifi|internet)\b/.test(q))return`Problema de Wi‑Fi · Habitación ${roomName}`
  return`Incidencia técnica · Habitación ${roomName}`
}

function priorityFor(q){
  if(/\b(urgente|emergencia|olor a gas|humo|chispa|chispas|inundado|inundada|inundacion)\b/.test(q))return"urgent"
  if(/\b(perdida|fuga|gotea|gotera|roto|rota|no funciona|no anda|no prende|no enciende|no enfria|no calienta|sin agua|sin luz)\b/.test(q))return"high"
  return"normal"
}

function housekeepingItem(q){for(const [label,re] of HK_ITEMS)if(re.test(q))return label;return null}
function quantityText(q,item){
  const aliases=item==="sabana"?"saban(?:a|as)":item==="toalla"?"toall(?:a|as|on|ones)":item==="almohada"?"almohad(?:a|as)":null
  if(!aliases)return null
  const m=q.match(new RegExp(`\\b(\\d+)\\s+${aliases}\\b`))
  return m?`${m[1]} ${item}${Number(m[1])===1?"":"s"}`:null
}

export function interpretHotelOperation(question,context={}){
  const q=normalize(question),rooms=Array.isArray(context?.habitaciones)?context.habitaciones:[]
  if(!q||isQuestion(question))return null
  const hkItem=housekeepingItem(q),maintenanceIntent=FAILURE.test(q)||(TECHNICAL.test(q)&&/\b(revisar|revisa|arreglar|arregla|tecnico|mantenimiento)\b/.test(q)),hkIntent=!!hkItem&&(HK_NEED.test(q)||/\b(limpieza|limpiar|repasar|aseo)\b/.test(q))
  if(!maintenanceIntent&&!hkIntent)return null
  const matches=roomCandidates(question,rooms)
  if(!matches.length)return{handled:true,answer:"Sí, entendí el pedido. ¿De qué habitación estamos hablando?",action:null}
  if(matches.length>1)return{handled:true,answer:`Entendí el pedido, pero veo más de una habitación posible (${matches.map(r=>r.nombre).join(", ")}). Decime cuál es y lo preparo.`,action:null}
  const room=matches[0],roomName=String(room?.nombre||"").trim(),reservation=activeReservation(context,room.id)
  if(maintenanceIntent){
    const summary=maintenanceTitle(q,roomName).split(" · ")[0].toLowerCase()
    return{handled:true,answer:`Dale, entendí: ${summary} en la habitación ${roomName}. Te dejo mantenimiento preparado para que lo apruebes.`,action:{type:"create_maintenance_ticket",title:maintenanceTitle(q,roomName),detail:String(question).trim(),priority:priorityFor(q),assigned_area:"maintenance",requested_by:"reception",reservation_id:reservation?.id||null,room_id:room.id}}
  }
  const qty=quantityText(q,hkItem),label=qty||hkItem
  return{handled:true,answer:`Dale. Entendí ${label} para la habitación ${roomName}. Te dejo el pedido preparado para Housekeeping.`,action:{type:"create_guest_request",title:`${label.charAt(0).toUpperCase()+label.slice(1)} · Habitación ${roomName}`,detail:String(question).trim(),priority:"normal",assigned_area:"housekeeping",requested_by:"reception",reservation_id:reservation?.id||null,room_id:room.id}}
}

export function fallbackPmsHelp(question){
  const q=normalize(question)
  if(/\b(planning|calendario)\b/.test(q))return"El Planning es el centro operativo: ahí ves ocupación, estados, pagos, bloqueos y podés crear o mover reservas directamente sobre las habitaciones y fechas."
  if(/\b(tarifa|tarifas|disponibilidad|precio|precios)\b/.test(q))return"En Tarifas y disponibilidad elegís fechas y categorías para cambiar precios, estadía mínima y abrir o cerrar venta. Los cambios impactan en la disponibilidad que usa el PMS y el motor de reservas."
  if(/\b(pago|pagos|cobro|cobros|caja|folio|factura)\b/.test(q))return"Desde la reserva podés registrar pagos, dividir medios de pago, revisar saldo y trabajar con folios. Caja diaria concentra después los movimientos de la operación."
  if(/\b(mensaje|mensajes|portal del huesped|portal huesped)\b/.test(q))return"Mensajes centraliza las conversaciones vinculadas a cada reserva. El Portal del huésped permite que el pasajero escriba a Recepción, haga pedidos y siga su estado desde el celular."
  if(/\b(housekeeping|hkp|limpieza)\b/.test(q))return"Housekeeping recibe pedidos y estados de habitaciones vinculados a la operación. También puedo prepararte pedidos concretos si me decís la habitación y qué necesita."
  if(/\b(mantenimiento|reparacion|reparar|falla)\b/.test(q))return"Mantenimiento concentra incidencias por habitación. Podés escribirme algo simple como “la 205 pierde agua” y te preparo la incidencia para aprobarla."
  if(/\b(checkout|check out|checkin|check in)\b/.test(q))return"Los check-in y check-out se gestionan desde la reserva y el Planning. Antes de cerrar una estadía el PMS puede mostrar saldos, pagos y situaciones pendientes para evitar olvidos."
  return null
}
