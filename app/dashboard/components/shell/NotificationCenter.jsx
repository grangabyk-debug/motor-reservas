"use client"

import{useMemo,useState}from"react"
import{buildOperationalNotifications}from"../../core/operationalNotifications"
import s from"./notification-center.module.css"

const FILTERS=[["all","Todas"],["operation","Operación"],["payments","Cobros"],["messages","Mensajes"],["system","Sistema"]]
const label={critical:"Urgente",high:"Importante",normal:"Pendiente",info:"Info"}

export default function NotificationCenter({open,onClose,data,onOpenReservation,onView,onOpenMessages}){
  const[filter,setFilter]=useState("all"),items=useMemo(()=>buildOperationalNotifications({rooms:data.rooms,reservations:data.reservations,payments:data.payments,automationEvents:data.automationEvents,inboxConversations:data.inboxConversations,maintenanceTickets:data.maintenanceTickets}),[data.rooms,data.reservations,data.payments,data.automationEvents,data.inboxConversations,data.maintenanceTickets]),visible=filter==="all"?items:items.filter(item=>item.kind===filter)
  if(!open)return null
  function act(item){
    if(item.target==="reservation"&&item.reservationId){const reservation=data.reservations.find(r=>String(r.id)===String(item.reservationId));if(reservation)onOpenReservation?.(reservation)}
    else if(item.target==="housekeeping")onView?.("housekeeping")
    else if(item.target==="maintenance")onView?.("maintenance")
    else if(item.target==="automations")onView?.("automations")
    else if(item.target==="messages")onOpenMessages?.(item.conversation)
    onClose?.()
  }
  const urgent=items.filter(x=>x.priority==="critical").length
  return <div className={s.shade} onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}>
    <aside className={s.panel}>
      <header className={s.header}><div><small>CENTRO OPERATIVO</small><h2>Notificaciones</h2><p>{items.length?`${items.length} asunto${items.length===1?"":"s"} requieren atención${urgent?` · ${urgent} urgente${urgent===1?"":"s"}`:""}.`:"El turno está al día."}</p></div><button type="button" onClick={onClose} aria-label="Cerrar">×</button></header>
      <nav className={s.filters}>{FILTERS.map(([id,text])=>{const count=id==="all"?items.length:items.filter(x=>x.kind===id).length;return <button type="button" key={id} className={filter===id?s.active:""} onClick={()=>setFilter(id)}><span>{text}</span>{count>0&&<b>{count}</b>}</button>})}</nav>
      <div className={s.list}>{visible.length?visible.map(item=><button type="button" key={item.id} className={`${s.item} ${s[item.priority]||""}`} onClick={()=>act(item)}><span className={s.icon}>{item.icon}</span><span className={s.copy}><span><b>{item.title}</b><em>{label[item.priority]||"Pendiente"}</em></span><small>{item.detail}</small></span><span className={s.arrow}>›</span></button>):<div className={s.empty}><span>✓</span><b>Sin pendientes en esta vista</b><p>Las alertas desaparecen cuando resolvés la causa real en el PMS.</p></div>}</div>
      <footer><span>Actualización en tiempo real</span><button type="button" onClick={()=>onView?.("automations")}>Ver automatizaciones</button></footer>
    </aside>
  </div>
}
