import{isoDate}from"./formatters"

const roomIds=r=>[...new Set([r?.habitacion_id,...(Array.isArray(r?.habitaciones_ids)?r.habitaciones_ids:[])].filter(Boolean).map(String))]
const active=r=>r&&String(r.estado||"").toLowerCase()!=="cancelada"&&!r.no_show
const roomReady=room=>["inspeccionada","inspeccion","disponible","libre"].includes(String(room?.estado||"").toLowerCase())
const roomName=(rooms,id)=>rooms.find(r=>String(r.id)===String(id))?.nombre||"Sin habitación"
const paidFor=(payments,id)=>(payments||[]).filter(p=>String(p.reserva_id)===String(id)&&!["anulado","cancelado","reembolsado"].includes(String(p.estado||"").toLowerCase())).reduce((sum,p)=>sum+Number(p.monto||0),0)
const priorityRank={critical:0,high:1,normal:2,info:3}

export function buildOperationalNotifications({rooms=[],reservations=[],payments=[],automationEvents=[],inboxConversations=[],maintenanceTickets=[]}={}){
  const today=isoDate(),items=[]
  ;(reservations||[]).filter(active).forEach(reservation=>{
    const state=String(reservation.estado||"").toLowerCase(),ids=roomIds(reservation),primary=rooms.find(r=>String(r.id)===ids[0]),due=Math.max(0,Number(reservation.precio_total||0)-paidFor(payments,reservation.id)),guest=reservation.nombre_huesped||"Huésped"
    if(reservation.fecha_entrada===today&&state!=="alojado"&&state!=="finalizada"){
      if(!primary||!roomReady(primary))items.push({id:`room-ready-${reservation.id}`,kind:"operation",priority:"critical",icon:"◇",title:"Habitación no lista para llegada",detail:`${guest} · ${roomName(rooms,ids[0])} · check-in hoy`,reservationId:reservation.id,target:"housekeeping"})
      items.push({id:`checkin-${reservation.id}`,kind:"operation",priority:"high",icon:"IN",title:"Check-in pendiente",detail:`${guest} · ${roomName(rooms,ids[0])}`,reservationId:reservation.id,target:"reservation"})
    }
    if(reservation.fecha_salida===today&&state==="alojado")items.push({id:`checkout-${reservation.id}`,kind:"operation",priority:"high",icon:"OUT",title:"Salida pendiente",detail:`${guest} · ${roomName(rooms,ids[0])}`,reservationId:reservation.id,target:"reservation"})
    if(due>.01&&(state==="alojado"||reservation.fecha_entrada===today||reservation.fecha_salida===today))items.push({id:`balance-${reservation.id}`,kind:"payments",priority:state==="alojado"&&reservation.fecha_salida===today?"critical":"normal",icon:"$",title:"Saldo pendiente",detail:`${guest} · ${new Intl.NumberFormat("es-AR",{style:"currency",currency:reservation.moneda||"ARS",maximumFractionDigits:0}).format(due)}`,reservationId:reservation.id,target:"reservation"})
  })
  ;(automationEvents||[]).filter(e=>!["resolved","done","completed","ignored"].includes(String(e.status||"").toLowerCase())).slice(0,30).forEach(event=>items.push({id:`automation-${event.id}`,kind:"system",priority:/error|fail|rechaz|venc/i.test(`${event.event_type||""} ${event.message||""}`)?"high":"normal",icon:"⚡",title:event.event_type?String(event.event_type).replaceAll("_"," "):"Automatización pendiente",detail:event.message||"Hay una automatización que requiere atención.",reservationId:event.reservation_id||null,roomId:event.room_id||null,target:event.reservation_id?"reservation":"automations",createdAt:event.created_at}))
  ;(inboxConversations||[]).filter(c=>Number(c.unread_count||0)>0).forEach(conversation=>items.push({id:`inbox-${conversation.id}`,kind:"messages",priority:"high",icon:"✉",title:`${Number(conversation.unread_count||0)} mensaje${Number(conversation.unread_count||0)===1?"":"s"} sin leer`,detail:`${conversation.contact_name||conversation.contact_phone||conversation.contact_email||"Huésped"} · ${conversation.last_message_text||conversation.channel||"Nueva conversación"}`,conversation,target:"messages",createdAt:conversation.last_message_at}))
  ;(maintenanceTickets||[]).filter(t=>!["done","resolved","cancelled","canceled"].includes(String(t.status||"").toLowerCase())&&["urgent","critical","high"].includes(String(t.priority||"").toLowerCase())).slice(0,20).forEach(ticket=>items.push({id:`maintenance-${ticket.id}`,kind:"operation",priority:String(ticket.priority||"").toLowerCase()==="urgent"?"critical":"high",icon:"!",title:ticket.title||"Mantenimiento prioritario",detail:`${roomName(rooms,ticket.room_id)}${ticket.description?` · ${ticket.description}`:""}`,roomId:ticket.room_id,target:"maintenance",createdAt:ticket.created_at}))
  return items.sort((a,b)=>(priorityRank[a.priority]??9)-(priorityRank[b.priority]??9)||String(b.createdAt||"").localeCompare(String(a.createdAt||"")))
}

export function notificationCount(data){return buildOperationalNotifications(data).length}
