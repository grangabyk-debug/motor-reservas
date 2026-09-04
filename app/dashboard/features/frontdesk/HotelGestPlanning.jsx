"use client"

import{useMemo,useState}from"react"
import{addDays,isoDate,money,shortDate}from"../../core/formatters"
import s from"./hotelgest-planning.module.css"

const ids=r=>[...new Set([r?.habitacion_id,...(Array.isArray(r?.habitaciones_ids)?r.habitaciones_ids:[])].filter(Boolean).map(String))]
const uses=(r,roomId)=>ids(r).includes(String(roomId))
const span=r=>Math.max(0,Math.round((new Date(`${r.fecha_salida}T12:00:00`)-new Date(`${r.fecha_entrada}T12:00:00`))/86400000))
const active=r=>r&&r.estado!=="cancelada"&&!r.no_show
const overlap=(aStart,aEnd,bStart,bEnd)=>aStart<bEnd&&aEnd>bStart
const channelColor=value=>{const v=String(value||"").toLowerCase();if(v.includes("booking"))return"#3e64d8";if(v.includes("airbnb"))return"#e85f6a";if(v.includes("expedia"))return"#e0a321";if(v.includes("agencia"))return"#755fc4";return"#48b76b"}
const compactDate=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit"}).format(new Date(`${value}T12:00:00`))
const dayName=value=>new Intl.DateTimeFormat("es-AR",{weekday:"short"}).format(new Date(`${value}T12:00:00`)).replace(".","")
const monthName=value=>new Intl.DateTimeFormat("es-AR",{month:"short"}).format(new Date(`${value}T12:00:00`)).replace(".","")

function validateTarget({kind,reservation,room,day,reservations,blocks}){
  if(!reservation||!room||!day)return{ok:false,reason:"Destino inválido"}
  if(ids(reservation).length>1)return{ok:false,reason:"Esta reserva ocupa varias habitaciones. Movela desde la ficha grupal."}
  const roomState=String(room.estado||"").toLowerCase(),dayUse=String(reservation.tipo_estadia||"")==="day_use"
  if(room.activa===false)return{ok:false,reason:"La habitación está inactiva."}
  if(["mantenimiento","fuera_servicio"].includes(roomState))return{ok:false,reason:"La habitación está fuera de servicio."}
  if(kind==="resize"&&dayUse)return{ok:false,reason:"El Day Use no se estira por noches. Editá sus horarios desde la reserva."}
  const targetStart=kind==="resize"?reservation.fecha_entrada:day
  const targetEnd=kind==="resize"?addDays(day,1):(dayUse?day:addDays(day,span(reservation)))
  if(!dayUse&&targetEnd<=targetStart)return{ok:false,reason:"La salida tiene que quedar después de la entrada."}
  const intervalEnd=dayUse?addDays(targetEnd,1):targetEnd
  const blocked=(blocks||[]).find(b=>String(b.habitacion_id)===String(room.id)&&overlap(targetStart,intervalEnd,b.fecha_desde,b.fecha_hasta))
  if(blocked)return{ok:false,reason:`Bloqueada: ${blocked.motivo||blocked.detalle||"bloqueo operativo"}`}
  const conflict=(reservations||[]).find(r=>active(r)&&String(r.id)!==String(reservation.id)&&uses(r,room.id)&&overlap(targetStart,intervalEnd,r.fecha_entrada,r.fecha_salida))
  if(conflict)return{ok:false,reason:`Ocupada por ${conflict.nombre_huesped||"otra reserva"} (${compactDate(conflict.fecha_entrada)}–${compactDate(conflict.fecha_salida)})`}
  return{ok:true,targetStart,targetEnd,reason:kind==="resize"?`Nueva salida ${compactDate(targetEnd)}`:`Mover a ${room.nombre} · ${compactDate(targetStart)}`}
}

function ReservationBlock({r,room,days,onSelect,onDragStart,onResizeStart,onDragEnd,selected}){
  const startIndex=Math.max(0,days.findIndex(d=>d>=r.fecha_entrada)),rawEnd=days.findIndex(d=>d>=r.fecha_salida),endIndex=rawEnd<0?days.length:Math.max(startIndex+1,rawEnd),startLine=startIndex+1,endLine=endIndex+1
  if(r.fecha_salida<=days[0]||r.fecha_entrada>days.at(-1))return null
  return <button type="button" draggable onDragStart={e=>onDragStart(e,r)} onDragEnd={onDragEnd} onClick={()=>onSelect(r)} className={`${s.stay} ${selected?s.staySelected:""}`} style={{gridColumn:`${startLine}/${Math.max(startLine+1,endLine)}`,"--channel":channelColor(r.canal_reserva)}} title={`${r.nombre_huesped||"Reserva"} · ${shortDate(r.fecha_entrada)} → ${shortDate(r.fecha_salida)}`}>
    <span><b>{r.nombre_huesped||"Reserva"}</b><small>{r.canal_reserva||"Directa"}</small></span><i draggable onDragStart={e=>onResizeStart(e,r)} onDragEnd={onDragEnd} title="Arrastrar para cambiar la salida" aria-label="Cambiar fecha de salida"/>
  </button>
}

function Inspector({reservation,room,payments,onClose,onOpen,onMoveMode}){
  if(!reservation)return null
  const paid=(payments||[]).filter(p=>String(p.reserva_id)===String(reservation.id)).reduce((a,p)=>a+Number(p.monto||0),0),due=Math.max(0,Number(reservation.precio_total||0)-paid),phone=String(reservation.telefono_huesped||"").replace(/\D/g,"")
  return <aside className={s.inspector}><header><div><small>RESERVA {reservation.numero_reserva||reservation.id}</small><h3>{reservation.nombre_huesped||"Sin titular"}</h3><p>{room?.nombre||"Sin habitación"} · {reservation.canal_reserva||"Directa"}</p></div><button type="button" onClick={onClose}>×</button></header><div className={s.inspectorInfo}><span><small>Entrada</small><b>{shortDate(reservation.fecha_entrada)}</b></span><span><small>Salida</small><b>{shortDate(reservation.fecha_salida)}</b></span><span><small>Total</small><b>{money(reservation.precio_total||0,reservation.moneda||"ARS")}</b></span><span><small>Pendiente</small><b className={due>0?s.due:""}>{money(due,reservation.moneda||"ARS")}</b></span></div><div className={s.inspectorActions}><button type="button" className={s.primaryAction} onClick={onOpen}>Ver reserva</button><button type="button" onClick={onMoveMode}>Mover</button>{phone&&<button type="button" onClick={()=>window.open(`https://wa.me/${phone}`,"_blank","noopener,noreferrer")}>WhatsApp</button>}</div></aside>
}

export default function HotelGestPlanning({rooms=[],reservations=[],payments=[],blocks=[],floors=[],onMove,onResize,onOpen,onOpenExternal,onNew,onBlock}){
  const today=isoDate(),[start,setStart]=useState(today),[count,setCount]=useState(21),[query,setQuery]=useState(""),[type,setType]=useState(""),[selectedId,setSelectedId]=useState(""),[drag,setDrag]=useState(null),[hover,setHover]=useState(null),[notice,setNotice]=useState(null),[moveMode,setMoveMode]=useState("")
  const days=useMemo(()=>Array.from({length:count},(_,i)=>addDays(start,i)),[start,count]),activeRooms=useMemo(()=>rooms.filter(r=>r.activa!==false),[rooms]),types=useMemo(()=>[...new Set(activeRooms.map(r=>r.tipo||"Habitación"))].sort(),[activeRooms]),filtered=useMemo(()=>activeRooms.filter(r=>(!type||String(r.tipo||"Habitación")===type)&&(!query.trim()||`${r.nombre||""} ${r.tipo||""}`.toLowerCase().includes(query.trim().toLowerCase()))),[activeRooms,type,query]),grouped=useMemo(()=>{const m=new Map();filtered.forEach(r=>{const k=r.tipo||"Habitación";if(!m.has(k))m.set(k,[]);m.get(k).push(r)});return[...m.entries()]},[filtered]),selected=reservations.find(r=>String(r.id)===String(selectedId))||null,selectedRoom=selected?activeRooms.find(r=>String(r.id)===String(selected.habitacion_id)):null
  const grid={gridTemplateColumns:`repeat(${count},minmax(47px,1fr))`}
  function flash(kind,text){setNotice({kind,text});setTimeout(()=>setNotice(null),3600)}
  function beginMove(e,r){e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(r.id));setDrag({kind:"move",reservation:r});setHover(null)}
  function beginResize(e,r){e.stopPropagation();e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(r.id));setDrag({kind:"resize",reservation:r});setHover(null)}
  function endDrag(){if(hover&&!hover.ok)flash("error",hover.reason);setDrag(null);setHover(null)}
  function targetFor(room,day){return validateTarget({kind:drag?.kind,reservation:drag?.reservation,room,day,reservations,blocks})}
  function enterTarget(room,day){if(!drag)return;setHover({roomId:String(room.id),day,...targetFor(room,day)})}
  function overTarget(e,room,day){if(!drag)return;const result=targetFor(room,day);if(result.ok){e.preventDefault();e.dataTransfer.dropEffect="move"}else e.dataTransfer.dropEffect="none"}
  async function dropTarget(e,room,day){if(!drag)return;const current=drag,result=targetFor(room,day);setHover(null);if(!result.ok){flash("error",result.reason);setDrag(null);return}e.preventDefault();try{const saved=current.kind==="resize"?await onResize?.(current.reservation.id,result.targetEnd):await onMove?.(current.reservation.id,room.id,result.targetStart);if(saved)flash("success",current.kind==="resize"?`Salida actualizada al ${compactDate(result.targetEnd)}.`:`${current.reservation.nombre_huesped||"Reserva"} movida a ${room.nombre}.`)}catch(error){flash("error",error?.message||"No se pudo completar el movimiento.")}finally{setDrag(null)}}
  async function tapTarget(room,day){if(!moveMode)return;const r=reservations.find(x=>String(x.id)===String(moveMode));if(!r)return;const result=validateTarget({kind:"move",reservation:r,room,day,reservations,blocks});if(!result.ok){flash("error",result.reason);return}try{const saved=await onMove?.(r.id,room.id,result.targetStart);if(saved){setMoveMode("");flash("success",`${r.nombre_huesped||"Reserva"} movida a ${room.nombre}.`)}}catch(error){flash("error",error?.message||"No se pudo mover la reserva.")}}
  return <section className={s.page}>
    <header className={s.toolbar}><div className={s.navDate}><button type="button" onClick={()=>setStart(addDays(start,-7))}>‹</button><button type="button" className={s.today} onClick={()=>setStart(today)}>Hoy</button><button type="button" onClick={()=>setStart(addDays(start,7))}>›</button><b>{compactDate(days[0])} — {compactDate(days.at(-1))}</b></div><div className={s.filters}><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar habitación"/></label><select value={type} onChange={e=>setType(e.target.value)}><option value="">Todas las tipologías</option>{types.map(t=><option key={t}>{t}</option>)}</select><div className={s.rangeSwitch}><button className={count===7?s.active:""} onClick={()=>setCount(7)}>7d</button><button className={count===21?s.active:""} onClick={()=>setCount(21)}>21d</button><button className={count===30?s.active:""} onClick={()=>setCount(30)}>30d</button></div></div></header>
    {notice&&<div className={`${s.notice} ${notice.kind==="error"?s.noticeError:s.noticeSuccess}`}>{notice.kind==="error"?"⛔":"✓"} {notice.text}</div>}
    {moveMode&&<div className={s.moveBanner}>Mover <b>{reservations.find(r=>String(r.id)===String(moveMode))?.nombre_huesped||"reserva"}</b>: tocá una celda disponible. <button onClick={()=>setMoveMode("")}>Cancelar</button></div>}
    <div className={s.calendar}>
      <div className={s.head}><div className={s.roomHead}>Habitación</div><div className={s.days} style={grid}>{days.map(d=><div key={d} className={d===today?s.todayHead:""}><small>{dayName(d)}</small><b>{new Date(`${d}T12:00:00`).getDate()}</b><em>{monthName(d)}</em></div>)}</div></div>
      {grouped.map(([group,groupRooms])=><section className={s.group} key={group}><div className={s.groupTitle}><b>{group}</b><small>{groupRooms.length} habitaciones</small></div>{groupRooms.map(room=>{const roomReservations=reservations.filter(r=>active(r)&&uses(r,room.id));return <div className={s.row} key={room.id}><button type="button" className={s.room} onClick={()=>onNew?.(room,today)}><b>{room.nombre}</b><small>{room.tipo||"Habitación"}</small></button><div className={s.dayGrid} style={grid}>{days.map(day=>{const blocked=(blocks||[]).some(b=>String(b.habitacion_id)===String(room.id)&&overlap(day,addDays(day,1),b.fecha_desde,b.fecha_hasta)),hovered=hover&&hover.roomId===String(room.id)&&hover.day===day;return <div key={day} data-date={day} className={`${s.cell} ${day===today?s.todayCell:""} ${blocked?s.blocked:""} ${hovered?(hover.ok?s.validTarget:s.invalidTarget):""}`} onDoubleClick={()=>!moveMode&&!blocked&&onNew?.(room,day)} onContextMenu={e=>{e.preventDefault();if(!moveMode)onBlock?.(room,day)}} onClick={()=>tapTarget(room,day)} onDragEnter={()=>enterTarget(room,day)} onDragOver={e=>overTarget(e,room,day)} onDrop={e=>dropTarget(e,room,day)}>{hovered&&<span className={s.dropHint}>{hover.reason}</span>}</div>})}{roomReservations.map(r=><ReservationBlock key={`${r.id}-${room.id}`} r={r} room={room} days={days} selected={String(r.id)===String(selectedId)} onSelect={setSelectedId} onDragStart={beginMove} onResizeStart={beginResize} onDragEnd={endDrag}/>)}</div></div>})}</section>)}
    </div>
    <Inspector reservation={selected} room={selectedRoom} payments={payments} onClose={()=>setSelectedId("")} onOpen={()=>onOpen?.(selected)} onMoveMode={()=>{setMoveMode(String(selected.id));setSelectedId("")}}/>
  </section>
}
