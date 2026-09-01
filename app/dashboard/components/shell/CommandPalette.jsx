"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import{HOTEL_NAVIGATION}from"../../core/navigation"
import styles from"./command-palette.module.css"

const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()
const initials=name=>String(name||"H").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"H"

export default function CommandPalette({open,onClose,reservations=[],rooms=[],guests=[],onNavigate,onOpenReservation,onNewReservation}){
  const[query,setQuery]=useState(""),[active,setActive]=useState(0),inputRef=useRef(null)
  const roomMap=useMemo(()=>new Map(rooms.map(room=>[String(room.id),room])),[rooms])
  const navigation=useMemo(()=>HOTEL_NAVIGATION.flatMap(group=>group.items.map(([id,label,icon])=>({id:`view:${id}`,kind:"Módulo",title:label,subtitle:group.label,icon,run:()=>onNavigate?.(id)}))),[onNavigate])
  const fixed=useMemo(()=>[
    {id:"action:new",kind:"Acción",title:"Nueva reserva",subtitle:"Crear una estadía",icon:"＋",run:()=>onNewReservation?.()},
    {id:"action:planning",kind:"Acción",title:"Abrir Planning",subtitle:"Calendario, ocupación y disponibilidad",icon:"▦",run:()=>onNavigate?.("calendar")},
    {id:"action:housekeeping",kind:"Acción",title:"Abrir Housekeeping",subtitle:"Limpieza y estado de habitaciones",icon:"◇",run:()=>onNavigate?.("housekeeping")},
    {id:"action:billing",kind:"Acción",title:"Facturación y ARCA",subtitle:"Folios y comprobantes",icon:"▧",run:()=>onNavigate?.("billing")},
  ],[onNavigate,onNewReservation])
  const reservationItems=useMemo(()=>reservations.slice(0,600).map(r=>{const room=roomMap.get(String(r.habitacion_id));return{id:`reservation:${r.id}`,kind:"Reserva",title:r.nombre_huesped||"Huésped",subtitle:`${r.numero_reserva||r.id} · ${room?.nombre||"Sin habitación"} · ${r.fecha_entrada||""} → ${r.fecha_salida||""}`,icon:initials(r.nombre_huesped),run:()=>onOpenReservation?.(r)}}),[reservations,roomMap,onOpenReservation])
  const roomItems=useMemo(()=>rooms.map(room=>({id:`room:${room.id}`,kind:"Habitación",title:`Habitación ${room.nombre}`,subtitle:`${room.tipo||"Habitación"} · ${room.estado||"sin estado"}`,icon:"▤",run:()=>onNavigate?.("rooms")})),[rooms,onNavigate])
  const guestItems=useMemo(()=>guests.slice(0,400).map(guest=>({id:`guest:${guest.id}`,kind:"Huésped",title:guest.full_name||guest.nombre||guest.name||guest.email||"Huésped",subtitle:guest.email||guest.phone||guest.telefono||"Perfil de huésped",icon:initials(guest.full_name||guest.nombre||guest.name),run:()=>onNavigate?.("guests")})),[guests,onNavigate])
  const results=useMemo(()=>{const all=[...fixed,...navigation,...reservationItems,...roomItems,...guestItems],q=normalize(query);if(!q)return all.slice(0,16);return all.map(item=>{const hay=normalize(`${item.title} ${item.subtitle} ${item.kind}`),terms=q.split(/\s+/).filter(Boolean),score=terms.reduce((sum,term)=>sum+(hay.startsWith(term)?6:hay.includes(term)?2:-5),0)+(normalize(item.title).startsWith(q)?12:0);return{...item,score}}).filter(item=>item.score>=0).sort((a,b)=>b.score-a.score).slice(0,20)},[query,fixed,navigation,reservationItems,roomItems,guestItems])

  useEffect(()=>{if(!open)return;setQuery("");setActive(0);const timer=setTimeout(()=>inputRef.current?.focus(),30);return()=>clearTimeout(timer)},[open])
  useEffect(()=>setActive(current=>Math.min(current,Math.max(0,results.length-1))),[results.length])
  if(!open)return null
  const execute=item=>{if(!item)return;onClose?.();setTimeout(()=>item.run?.(),0)}
  return <div className={styles.shade} onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}>
    <section className={styles.palette} role="dialog" aria-modal="true" aria-label="Búsqueda global">
      <header className={styles.searchRow}><span>⌕</span><input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="ArrowDown"){e.preventDefault();setActive(x=>Math.min(results.length-1,x+1))}if(e.key==="ArrowUp"){e.preventDefault();setActive(x=>Math.max(0,x-1))}if(e.key==="Enter"){e.preventDefault();execute(results[active])}if(e.key==="Escape")onClose?.()}} placeholder="Buscar huésped, reserva, habitación, informe o acción…"/><kbd>ESC</kbd></header>
      <div className={styles.results}>{results.length?results.map((item,index)=><button key={item.id} className={index===active?styles.active:""} onMouseEnter={()=>setActive(index)} onClick={()=>execute(item)}><i>{item.icon}</i><span><b>{item.title}</b><small>{item.subtitle}</small></span><em>{item.kind}</em></button>):<div className={styles.empty}><b>Sin resultados</b><span>Probá con un huésped, número de reserva, habitación o módulo.</span></div>}</div>
      <footer><span>↑ ↓ navegar</span><span>↵ abrir</span><span><b>⌘/Ctrl K</b> buscar desde cualquier pantalla</span></footer>
    </section>
  </div>
}
