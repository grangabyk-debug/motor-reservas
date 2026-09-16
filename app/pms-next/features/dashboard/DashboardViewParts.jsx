"use client"

import PmsIcon from"../../components/shell/PmsIcons"
import d from"./frontDesk.module.css"
import a from"./dashboardArrivalList.module.css"

export const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
export const initials=value=>String(value||"H").trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()
export const actualVip=value=>{const normalized=String(value||"").trim();return normalized&&!["standard","normal","none","sin vip","default"].includes(normalized.toLowerCase())?normalized:""}
export const uniqueOccupiedRooms=(rows=[])=>{const ids=new Set();rows.forEach(row=>(row.rooms||[]).forEach(room=>{const id=Number(room?.id);if(id)ids.add(id)}));return ids.size}
export const isPendingArrival=item=>{const state=String(item?.estado||"").trim().toLowerCase();return !item?.no_show&&!["alojado","checkin","en_casa","finalizada","cancelada","cancelado","cancelled"].includes(state)}
export const normalizeOrder=(value,defaults)=>{const source=Array.isArray(value)?value:[];return[...source.filter(id=>defaults.includes(id)),...defaults.filter(id=>!source.includes(id))]}

export function MetricIcon({type}){
  const common={viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.9",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true}
  if(type==="occupancy")return <svg {...common}><path d="M3 17V9h18v8"/><path d="M5 9V6h6a3 3 0 0 1 3 3"/><path d="M3 17v3M21 17v3M3 14h18"/></svg>
  if(type==="arrivals")return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.7L16 9"/></svg>
  if(type==="departures")return <svg {...common}><path d="M10 17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="m14 8 4 4-4 4M18 12H9"/></svg>
  if(type==="inhouse")return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 1-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  if(type==="ready")return <svg {...common}><path d="m4 19 8-8"/><path d="m9 6 9 9"/><path d="M14 3 3 14l7 7L21 10z"/></svg>
  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M16 8.5c-.8-.7-2-1.1-3.2-1.1-1.8 0-3 .8-3 2s1 1.8 3.2 2.3c2.1.5 3.2 1.2 3.2 2.5 0 1.4-1.4 2.4-3.4 2.4-1.4 0-2.8-.5-3.8-1.3M12.8 5.6v12.8"/></svg>
}

export function GuestRow({item,kind,onOpen}){
  const time=kind==="arrival"?item.hora_llegada_estimada:kind==="departure"?item.hora_salida_estimada:null
  const roomLabel=item.roomNames?.length?item.roomNames.join(", "):"Sin habitación",vip=actualVip(item.vipLevel),tags=(item.guestTags||[]).slice(0,2)
  return <button type="button" className={d.guestRow} onClick={onOpen} title={item.guestProfileNotes||undefined}><span className={d.guestAvatar}>{initials(item.nombre_huesped)}</span><span className={d.guestMain}><b>{item.nombre_huesped}</b><small>{roomLabel} · {item.canal_reserva||"Directa"}{time?` · ${time}`:""}</small><span className={d.guestFlags}>{vip?<em data-kind="vip">VIP {vip}</em>:null}{item.guestLanguage?<em data-kind="info">{item.guestLanguage}</em>:null}{tags.map(tag=><em data-kind="info" key={tag}>{tag}</em>)}{item.roomMaintenance?<em data-kind="danger">Mantenimiento</em>:item.roomDirty&&kind==="arrival"?<em data-kind="warn">Habitación sucia</em>:null}{item.balance>0?<em data-kind="money">Saldo {money(item.balance,item.moneda)}</em>:<em data-kind="ok">Pago cubierto</em>}</span></span><span className={d.guestPax}>{item.cantidad_huespedes||1} pax<br/><small><PmsIcon name="chevronRight" size={12}/></small></span></button>
}

export function ReservationPreview({item,onOpen}){
  const state=String(item.estado||"reservada").toLowerCase(),label=state==="confirmada"?"Confirmada":state==="pendiente"?"Pendiente":"Próxima"
  return <button type="button" className={a.row} onClick={onOpen} aria-label={`Abrir reserva de ${item.nombre_huesped||"huésped"}`}><span className={a.avatar}>{initials(item.nombre_huesped)}</span><span className={a.copy}><strong>{item.nombre_huesped||"Huésped"}</strong><small>{item.fecha_entrada} → {item.fecha_salida} · {item.roomNames?.[0]||"Sin habitación"}</small></span><span className={a.status} data-state={state}>{label}</span></button>
}
