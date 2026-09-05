"use client"

import{useEffect,useMemo,useState}from"react"
import useDashboardData from"./useDashboardData"
import s from"./dashboard.module.css"
import d from"./frontDesk.module.css"

const shortcuts=[{id:"planning",label:"Planning",icon:"▦"},{id:"quotes",label:"Presupuestar",icon:"◇"},{id:"messages",label:"Mensajes",icon:"◌"},{id:"finance",label:"Finanzas",icon:"▤"},{id:"rates",label:"Tarifas y disponibilidad",icon:"↗"}]
const DEFAULT_WIDGETS=["arrivals","departures","occupancy","dirty","maintenance","checks"]
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const initials=value=>String(value||"H").trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()
const actualVip=value=>{const normalized=String(value||"").trim();return normalized&&!['standard','normal','none','sin vip','default'].includes(normalized.toLowerCase())?normalized:""}

function GuestRow({item,kind,onOpen}){
  const time=kind==="arrival"?item.hora_llegada_estimada:kind==="departure"?item.hora_salida_estimada:null,roomLabel=item.roomNames?.length?item.roomNames.join(", "):"Sin habitación",vip=actualVip(item.vipLevel),tags=(item.guestTags||[]).slice(0,2)
  return <button type="button" className={d.guestRow} onClick={onOpen} title={item.guestProfileNotes||undefined}>
    <span className={d.guestAvatar}>{initials(item.nombre_huesped)}</span><span className={d.guestMain}><b>{item.nombre_huesped}</b><small>{roomLabel} · {item.canal_reserva||"Directa"}{time?` · ${time}`:""}</small><span className={d.guestFlags}>{vip?<em data-kind="vip">VIP {vip}</em>:null}{item.guestLanguage?<em data-kind="info">{item.guestLanguage}</em>:null}{tags.map(tag=><em data-kind="info" key={tag}>{tag}</em>)}{item.roomMaintenance?<em data-kind="danger">Mantenimiento</em>:item.roomDirty&&kind==="arrival"?<em data-kind="warn">Habitación sucia</em>:null}{item.balance>0?<em data-kind="money">Saldo {money(item.balance,item.moneda)}</em>:<em data-kind="ok">Pago cubierto</em>}</span></span><span className={d.guestPax}>{item.cantidad_huespedes||1} pax<br/><small>›</small></span>
  </button>
}

function PixelHotel({name}){
  const hour=new Date().getHours(),period=hour<7?"night":hour<11?"morning":hour<17?"day":hour<20?"sunset":"night"
  return <div className={s.pixelHotel} data-period={period} aria-label={`Vista ilustrada de ${name||"hotel"}`}><div className={s.pixelSun}/><div className={s.pixelCloud}/><div className={s.pixelBuilding}><div className={s.pixelSign}>{name||"Hotel"}</div><div className={s.pixelWindows}>{Array.from({length:12},(_,i)=><i key={i} data-lit={period==="night"&&i%3!==1?"1":"0"}/>)}</div><div className={s.pixelDoor}/></div><div className={s.pixelGround}/></div>
}

export default function DashboardWorkspace({propertyId,property,onNavigate,allowedViews=[]}){
  const data=useDashboardData(propertyId),m=data.metrics
  const[opsDay,setOpsDay]=useState(0),[opsQuery,setOpsQuery]=useState(""),[widgetOrder,setWidgetOrder]=useState(DEFAULT_WIDGETS),[dragging,setDragging]=useState("")
  const allowed=useMemo(()=>new Set(allowedViews),[allowedViews]),can=id=>allowed.size===0||allowed.has(id)
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(`hl:dashboard-widgets:${propertyId}`)||"null");if(Array.isArray(saved)&&saved.length)setWidgetOrder([...saved.filter(id=>DEFAULT_WIDGETS.includes(id)),...DEFAULT_WIDGETS.filter(id=>!saved.includes(id))])}catch{}},[propertyId])
  function saveOrder(next){setWidgetOrder(next);try{localStorage.setItem(`hl:dashboard-widgets:${propertyId}`,JSON.stringify(next))}catch{}}
  function dropOn(target){if(!dragging||dragging===target)return;const next=widgetOrder.filter(id=>id!==dragging),index=next.indexOf(target);next.splice(index,0,dragging);saveOrder(next);setDragging("")}
  const quickLinks=shortcuts.filter(item=>can(item.id)),ops=data.operationsByOffset?.[opsDay]||{arrivals:[],inhouse:[],departures:[]}
  const filterRows=rows=>{const term=opsQuery.trim().toLowerCase();return term?rows.filter(item=>`${item.nombre_huesped} ${item.numero_reserva||""} ${(item.roomNames||[]).join(" ")} ${item.canal_reserva||""} ${actualVip(item.vipLevel)} ${(item.guestTags||[]).join(" ")}`.toLowerCase().includes(term)):rows}
  const columns=[{key:"arrivals",title:"Llegadas",kind:"arrival"},{key:"inhouse",title:"En casa",kind:"inhouse"},{key:"departures",title:"Salidas",kind:"departure"}]
  const openReservation=item=>onNavigate?.("reservations",{reservationId:item.id})
  const widgets={
    arrivals:{label:"Llegadas",value:m.arrivals,note:"hoy",view:"reservations",tone:"blue"},
    departures:{label:"Salidas",value:m.departures,note:"hoy",view:"reservations",tone:"violet"},
    occupancy:{label:"Ocupación",value:`${m.occupancy.toFixed(0)}%`,note:`${m.inhouse}/${m.totalRooms} habitaciones`,view:"planning",tone:"green"},
    dirty:{label:"Habitaciones sucias",value:m.dirty,note:`${m.ready} listas`,view:"housekeeping",tone:m.dirty?"amber":"green"},
    maintenance:{label:"Mantenimiento",value:m.maintenance,note:`${m.urgent} urgentes`,view:"maintenance",tone:m.urgent?"red":"neutral"},
    checks:{label:"Check-lists",value:`${m.checkPct}%`,note:`${m.checkDone}/${m.checkTotal} pasos`,view:"tasks",tone:"cyan"},
  }
  const visibleWidgets=widgetOrder.filter(id=>widgets[id]&&can(widgets[id].view))
  return <section className={s.page}>
    <header className={s.intro}><div><small>OPERACIÓN DE HOY</small><h1>Hoy</h1><p>Entradas, salidas, ocupación y tareas que requieren atención.</p></div><div className={s.introTools}><button className={s.resetWidgets} type="button" onClick={()=>saveOrder(DEFAULT_WIDGETS)}>Restablecer widgets</button><button className={s.statusPill} onClick={data.load}>{data.loading?"Actualizando…":"Datos en vivo"}</button></div></header>
    {data.error&&<div className={s.notice}>{data.error}</div>}
    <div className={s.topStrip}><div><b>{new Intl.DateTimeFormat("es-AR",{weekday:"long",day:"numeric",month:"long"}).format(new Date())}</b><span>{m.totalRooms} habitaciones activas · arrastrá los widgets para ordenarlos</span></div><PixelHotel name={property?.name}/></div>
    <div className={s.todayGrid}>{visibleWidgets.map(id=>{const w=widgets[id];return <button key={id} draggable onDragStart={()=>setDragging(id)} onDragEnd={()=>setDragging("")} onDragOver={e=>e.preventDefault()} onDrop={()=>dropOn(id)} data-tone={w.tone} className={dragging===id?s.dragging:""} onClick={()=>onNavigate?.(w.view)}><i className={s.dragHandle}>⋮⋮</i><small>{w.label}</small><b>{w.value}</b><span>{w.note}</span></button>})}</div>
    {can("reservations")&&<section className={d.frontDesk}><header className={d.frontDeskHead}><div><small>RECEPCIÓN</small><h2>Movimiento del hotel</h2><p>Entradas, huéspedes alojados y salidas con alertas operativas.</p></div><div className={d.frontDeskTools}><div className={d.dayTabs}>{[[-1,"Ayer"],[0,"Hoy"],[1,"Mañana"]].map(([value,label])=><button type="button" key={value} className={opsDay===value?d.dayActive:""} onClick={()=>setOpsDay(value)}>{label}</button>)}</div><label className={d.deskSearch}>⌕<input value={opsQuery} onChange={event=>setOpsQuery(event.target.value)} placeholder="Huésped, habitación o reserva"/></label></div></header><div className={d.frontDeskGrid}>{columns.map(column=>{const rows=filterRows(ops[column.key]||[]);return <article className={d.deskColumn} key={column.key}><header><b>{column.title}</b><span>{rows.length}</span></header><div className={d.guestList}>{rows.length?rows.map(item=><GuestRow key={`${column.key}-${item.id}`} item={item} kind={column.kind} onOpen={()=>openReservation(item)}/>):<div className={d.emptyOps}>Sin movimientos para esta vista.</div>}</div></article>})}</div></section>}
    {quickLinks.length>0&&<div className={s.quickGrid}>{quickLinks.map(item=><button key={item.id} className={s.quickLink} type="button" onClick={()=>onNavigate?.(item.id)}><span>{item.icon}</span>{item.label}</button>)}</div>}
  </section>
}
