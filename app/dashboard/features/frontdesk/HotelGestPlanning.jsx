"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import{addDays,isoDate,money,shortDate}from"../../core/formatters"
import s from"./hotelgest-planning.module.css"

const ids=r=>[...new Set([r?.habitacion_id,...(Array.isArray(r?.habitaciones_ids)?r.habitaciones_ids:[])].filter(Boolean).map(String))]
const uses=(r,roomId)=>ids(r).includes(String(roomId))
const span=r=>Math.max(1,Math.round((new Date(`${r.fecha_salida}T12:00:00Z`)-new Date(`${r.fecha_entrada}T12:00:00Z`))/86400000))
const active=r=>r&&String(r.estado||"").toLowerCase()!=="cancelada"&&!r.no_show
const overlap=(aStart,aEnd,bStart,bEnd)=>aStart<bEnd&&aEnd>bStart
const compactDate=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit"}).format(new Date(`${value}T12:00:00`))
const dayName=value=>new Intl.DateTimeFormat("es-AR",{weekday:"short"}).format(new Date(`${value}T12:00:00`)).replace(".","")
const monthName=value=>new Intl.DateTimeFormat("es-AR",{month:"short"}).format(new Date(`${value}T12:00:00`)).replace(".","")
const channelColor=value=>{const v=String(value||"").toLowerCase();if(v.includes("booking"))return"#2f58bf";if(v.includes("airbnb"))return"#dc6170";if(v.includes("expedia"))return"#cf991d";if(v.includes("agencia"))return"#765cc2";if(v.includes("motor"))return"#1f9fae";if(v.includes("whatsapp"))return"#39a66b";return"#48a76b"}
const roomStateLabel=value=>{const v=String(value||"").toLowerCase();if(["mantenimiento","fuera_servicio"].includes(v))return"Fuera de servicio";if(v==="sucia")return"Sucia";if(v==="limpia")return"Limpia";if(["inspeccionada","disponible","libre"].includes(v))return"Lista";return value||"Disponible"}
const sellableRoom=r=>r?.activa!==false&&!["mantenimiento","fuera_servicio"].includes(String(r?.estado||"").toLowerCase())
const paidFor=(reservation,payments)=>(payments||[]).filter(p=>String(p.reserva_id)===String(reservation.id)&&!["anulado","cancelado","reembolsado"].includes(String(p.estado||"").toLowerCase())).reduce((sum,p)=>sum+Number(p.monto||0),0)
const payMeta=(reservation,payments)=>{const total=Number(reservation.precio_total||0),paid=paidFor(reservation,payments),due=Math.max(0,total-paid);if(total>0&&due<=.01)return{due,code:"✓",label:"Pagado"};if(paid>0)return{due,code:"◐",label:"Parcial"};return{due,code:"$",label:"Pendiente"}}
const occupancyFor=(day,roomList,reservations)=>{const sellable=roomList.filter(sellableRoom),occupied=sellable.filter(room=>(reservations||[]).some(r=>active(r)&&uses(r,room.id)&&overlap(day,addDays(day,1),r.fecha_entrada,r.fecha_salida))).length,capacity=sellable.length,pct=capacity?Math.round(occupied/capacity*100):0;return{occupied,capacity,pct}}

function validateTarget({kind,reservation,room,day,reservations,blocks,grabOffset=0}){
  if(!reservation||!room||!day)return{ok:false,reason:"Destino inválido"}
  if(ids(reservation).length>1)return{ok:false,reason:"Esta reserva ocupa varias habitaciones. Movela desde la ficha grupal."}
  const roomState=String(room.estado||"").toLowerCase(),dayUse=String(reservation.tipo_estadia||"")==="day_use"
  if(room.activa===false)return{ok:false,reason:"La habitación está inactiva."}
  if(["mantenimiento","fuera_servicio"].includes(roomState))return{ok:false,reason:"La habitación está fuera de servicio."}
  if(kind==="resize"&&dayUse)return{ok:false,reason:"El Day Use se modifica desde la ficha porque depende de horarios."}
  const targetStart=kind==="resize"?reservation.fecha_entrada:addDays(day,-Math.max(0,grabOffset||0))
  const targetEnd=kind==="resize"?addDays(day,1):(dayUse?targetStart:addDays(targetStart,span(reservation)))
  if(!dayUse&&targetEnd<=targetStart)return{ok:false,reason:"La salida tiene que quedar después de la entrada."}
  const intervalEnd=dayUse?addDays(targetStart,1):targetEnd
  const blocked=(blocks||[]).find(b=>String(b.habitacion_id)===String(room.id)&&overlap(targetStart,intervalEnd,b.fecha_desde,b.fecha_hasta))
  if(blocked)return{ok:false,reason:`Bloqueada: ${blocked.motivo||blocked.detalle||"bloqueo operativo"}`}
  const conflict=(reservations||[]).find(r=>active(r)&&String(r.id)!==String(reservation.id)&&uses(r,room.id)&&overlap(targetStart,intervalEnd,r.fecha_entrada,r.fecha_salida))
  if(conflict)return{ok:false,reason:`Ocupada por ${conflict.nombre_huesped||"otra reserva"} (${compactDate(conflict.fecha_entrada)}–${compactDate(conflict.fecha_salida)})`}
  return{ok:true,targetStart,targetEnd,reason:kind==="resize"?`Nueva salida ${compactDate(targetEnd)}`:`Mover a ${room.nombre} · ${compactDate(targetStart)}`}
}

function rangeAvailable({roomId,start,end,reservations,blocks}){
  const block=(blocks||[]).find(b=>String(b.habitacion_id)===String(roomId)&&overlap(start,end,b.fecha_desde,b.fecha_hasta))
  if(block)return{ok:false,reason:`Bloqueada: ${block.motivo||block.detalle||"bloqueo operativo"}`}
  const conflict=(reservations||[]).find(r=>active(r)&&uses(r,roomId)&&overlap(start,end,r.fecha_entrada,r.fecha_salida))
  if(conflict)return{ok:false,reason:`Ocupada por ${conflict.nombre_huesped||"otra reserva"}`}
  return{ok:true,reason:"Disponible"}
}

function OccupancyRow({label,rooms,reservations,days,grid,total=false}){return <div className={s.occupancyRow}><div className={s.occupancyLabel}>{total&&<span>{rooms.filter(sellableRoom).length}</span>}{label}</div><div className={s.occupancyGrid} style={grid}>{days.map(day=>{const o=occupancyFor(day,rooms,reservations);return <div key={day} data-hot={o.pct>=85||undefined} data-mid={o.pct>=65&&o.pct<85||undefined} title={`${o.occupied}/${o.capacity} habitaciones ocupadas`}><b>{o.pct}%</b><small>{o.occupied}/{o.capacity}</small></div>})}</div></div>}

function ReservationBlock({r,days,payments,onSelect,onDragStart,onResizeStart,onDragEnd,selected}){
  const windowStart=days[0],windowEnd=addDays(days.at(-1),1)
  if(r.fecha_salida<=windowStart||r.fecha_entrada>=windowEnd)return null
  const startIndex=Math.max(0,days.findIndex(d=>d>=r.fecha_entrada)),rawEnd=days.findIndex(d=>d>=r.fecha_salida),endIndex=rawEnd<0?days.length:Math.max(startIndex+1,rawEnd),startLine=startIndex+1,endLine=endIndex+1,pay=payMeta(r,payments)
  return <div role="button" tabIndex={0} draggable onDragStart={e=>onDragStart(e,r)} onDragEnd={onDragEnd} onClick={e=>{e.stopPropagation();onSelect(r)}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect(r)}}} data-state={String(r.estado||"").toLowerCase()} className={`${s.stay} ${selected?s.staySelected:""}`} style={{gridColumn:`${startLine}/${Math.max(startLine+1,endLine)}`,"--channel":channelColor(r.canal_reserva)}} title={`${r.nombre_huesped||"Reserva"} · ${shortDate(r.fecha_entrada)} → ${shortDate(r.fecha_salida)} · ${pay.label}${pay.due?` · ${money(pay.due,r.moneda||"ARS")} pendiente`:""}`}>
    <span><b>{r.nombre_huesped||"Reserva"}</b><small>{r.canal_reserva||"Directa"} · {pay.label}</small></span><em title={pay.label}>{pay.code}</em><i draggable onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onDragStart={e=>onResizeStart(e,r)} onDragEnd={onDragEnd} title="Arrastrar para cambiar la salida" aria-label="Cambiar fecha de salida"/>
  </div>
}

function Inspector({reservation,room,payments,onClose,onOpen,onOpenExternal,onMoveMode}){
  if(!reservation)return null
  const paid=paidFor(reservation,payments),due=Math.max(0,Number(reservation.precio_total||0)-paid),phone=String(reservation.telefono_huesped||"").replace(/\D/g,"")
  return <aside className={s.inspector}><header><div><small>RESERVA {reservation.numero_reserva||reservation.id}</small><h3>{reservation.nombre_huesped||"Sin titular"}</h3><p>{room?.nombre||"Sin habitación"} · {reservation.canal_reserva||"Directa"}</p></div><button type="button" onClick={onClose}>×</button></header><div className={s.inspectorInfo}><span><small>Entrada</small><b>{shortDate(reservation.fecha_entrada)}</b></span><span><small>Salida</small><b>{shortDate(reservation.fecha_salida)}</b></span><span><small>Pagado</small><b>{money(paid,reservation.moneda||"ARS")}</b></span><span><small>Pendiente</small><b className={due>0?s.due:""}>{money(due,reservation.moneda||"ARS")}</b></span></div><div className={s.inspectorActions}><button type="button" className={s.primaryAction} onClick={onOpen}>Ver reserva</button><button type="button" onClick={onMoveMode}>Mover</button>{phone?<button type="button" onClick={()=>window.open(`https://wa.me/${phone}`,"_blank","noopener,noreferrer")}>WhatsApp</button>:onOpenExternal?<button type="button" onClick={onOpenExternal}>Abrir</button>:null}</div></aside>
}

function RangeBar({selection,rooms,onClose,onReservation,onTentative,onBlock}){
  if(!selection)return null
  const names=selection.roomIds.map(id=>rooms.find(r=>String(r.id)===String(id))?.nombre).filter(Boolean)
  return <div className={s.rangeBar}><div><small>SELECCIÓN</small><b>{compactDate(selection.start)} → {compactDate(selection.end)} · {names.join(", ")}</b></div><div><button onClick={onReservation} className={s.rangePrimary}>Crear reserva</button><button onClick={onTentative}>Tentativa</button><button onClick={onBlock}>Bloquear</button><button onClick={onClose}>×</button></div></div>
}

export default function HotelGestPlanning({rooms=[],reservations=[],payments=[],blocks=[],floors=[],onMove,onResize,onOpen,onOpenExternal,onNew,onNewRange,onBlockRange,onBlock}){
  const today=isoDate(),[start,setStart]=useState(today),[count,setCount]=useState(21),[query,setQuery]=useState(""),[type,setType]=useState(""),[selectedId,setSelectedId]=useState(""),[drag,setDrag]=useState(null),[hover,setHover]=useState(null),[notice,setNotice]=useState(null),[moveMode,setMoveMode]=useState(""),[range,setRange]=useState(null),[selecting,setSelecting]=useState(null),pointerDown=useRef(false)
  const days=useMemo(()=>Array.from({length:count},(_,i)=>addDays(start,i)),[start,count]),activeRooms=useMemo(()=>rooms.filter(r=>r.activa!==false),[rooms]),types=useMemo(()=>[...new Set(activeRooms.map(r=>r.tipo||"Habitación"))].sort(),[activeRooms]),filtered=useMemo(()=>{const q=query.trim().toLowerCase();return activeRooms.filter(r=>{if(type&&String(r.tipo||"Habitación")!==type)return false;if(!q)return true;const related=(reservations||[]).filter(x=>uses(x,r.id)).some(x=>`${x.nombre_huesped||""} ${x.numero_reserva||""} ${x.canal_reserva||""}`.toLowerCase().includes(q));return `${r.nombre||""} ${r.tipo||""}`.toLowerCase().includes(q)||related})},[activeRooms,type,query,reservations]),grouped=useMemo(()=>{const m=new Map();filtered.forEach(r=>{const k=r.tipo||"Habitación";if(!m.has(k))m.set(k,[]);m.get(k).push(r)});return[...m.entries()]},[filtered]),selected=reservations.find(r=>String(r.id)===String(selectedId))||null,selectedRoom=selected?activeRooms.find(r=>String(r.id)===String(selected.habitacion_id)):null
  const grid={gridTemplateColumns:`repeat(${count},minmax(47px,1fr))`}
  useEffect(()=>{const up=()=>{pointerDown.current=false;if(selecting)finishSelection(selecting)};window.addEventListener("mouseup",up);return()=>window.removeEventListener("mouseup",up)},[selecting])
  function flash(kind,text){setNotice({kind,text});window.setTimeout(()=>setNotice(null),3600)}
  function beginMove(e,r){const rect=e.currentTarget.getBoundingClientRect(),nights=span(r),unit=Math.max(1,rect.width/nights),grabOffset=Math.max(0,Math.min(nights-1,Math.floor((e.clientX-rect.left)/unit)));e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(r.id));setRange(null);setDrag({kind:"move",reservation:r,grabOffset});setHover(null)}
  function beginResize(e,r){e.stopPropagation();e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(r.id));setRange(null);setDrag({kind:"resize",reservation:r,grabOffset:0});setHover(null)}
  function endDrag(){if(hover&&!hover.ok)flash("error",hover.reason);setDrag(null);setHover(null)}
  function targetFor(room,day){return validateTarget({kind:drag?.kind,reservation:drag?.reservation,room,day,reservations,blocks,grabOffset:drag?.grabOffset||0})}
  function enterTarget(room,day){if(!drag)return;setHover({roomId:String(room.id),day,...targetFor(room,day)})}
  function overTarget(e,room,day){if(!drag)return;const result=targetFor(room,day);if(result.ok){e.preventDefault();e.dataTransfer.dropEffect="move"}else e.dataTransfer.dropEffect="none"}
  async function dropTarget(e,room,day){if(!drag)return;const current=drag,result=targetFor(room,day);setHover(null);if(!result.ok){flash("error",result.reason);setDrag(null);return}e.preventDefault();const saved=current.kind==="resize"?await onResize?.(current.reservation.id,result.targetEnd):await onMove?.(current.reservation.id,room.id,result.targetStart);if(saved)flash("success",current.kind==="resize"?`Salida actualizada al ${compactDate(result.targetEnd)}.`:`${current.reservation.nombre_huesped||"Reserva"} movida a ${room.nombre} · ${compactDate(result.targetStart)}.`);setDrag(null)}
  async function tapTarget(room,day){if(!moveMode)return;const r=reservations.find(x=>String(x.id)===String(moveMode));if(!r)return;const result=validateTarget({kind:"move",reservation:r,room,day,reservations,blocks});if(!result.ok){flash("error",result.reason);return}const saved=await onMove?.(r.id,room.id,result.targetStart);if(saved){setMoveMode("");flash("success",`${r.nombre_huesped||"Reserva"} movida a ${room.nombre}.`)}}
  function beginSelection(room,day,e){if(e.button!==0||drag||moveMode)return;const availability=rangeAvailable({roomId:room.id,start:day,end:addDays(day,1),reservations,blocks});if(!availability.ok)return;pointerDown.current=true;setSelectedId("");setRange(null);setSelecting({anchorRoomId:String(room.id),roomIds:[String(room.id)],start:day,end:addDays(day,1),lastDay:day})}
  function extendSelection(room,day){if(!pointerDown.current||!selecting||String(room.id)!==selecting.anchorRoomId)return;const from=day<selecting.start?day:selecting.start,to=day<selecting.start?addDays(selecting.start,1):addDays(day,1);setSelecting({...selecting,start:from,end:to,lastDay:day})}
  function finishSelection(sel){if(!sel)return;const check=rangeAvailable({roomId:sel.anchorRoomId,start:sel.start,end:sel.end,reservations,blocks});if(!check.ok){flash("error",check.reason);setSelecting(null);return}setRange({roomIds:[sel.anchorRoomId],start:sel.start,end:sel.end});setSelecting(null)}
  function toggleSelectionRoom(roomId){if(!range)return;const id=String(roomId),has=range.roomIds.includes(id);if(has&&range.roomIds.length===1)return;const check=rangeAvailable({roomId:id,start:range.start,end:range.end,reservations,blocks});if(!has&&!check.ok){flash("error",check.reason);return}setRange({...range,roomIds:has?range.roomIds.filter(x=>x!==id):[...range.roomIds,id]})}
  function cellSelected(roomId,day){const source=selecting||range;if(!source)return false;return source.roomIds.includes(String(roomId))&&day>=source.start&&day<source.end}
  return <section className={s.page}>
    <header className={s.toolbar}><div className={s.navDate}><button type="button" onClick={()=>setStart(addDays(start,-7))}>‹</button><button type="button" className={s.today} onClick={()=>setStart(today)}>Hoy</button><button type="button" onClick={()=>setStart(addDays(start,7))}>›</button><b>{compactDate(days[0])} — {compactDate(days.at(-1))}</b></div><div className={s.filters}><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Huésped, reserva o habitación"/></label><select value={type} onChange={e=>setType(e.target.value)}><option value="">Todas las tipologías</option>{types.map(t=><option key={t}>{t}</option>)}</select><div className={s.rangeSwitch}><button className={count===7?s.active:""} onClick={()=>setCount(7)}>7d</button><button className={count===21?s.active:""} onClick={()=>setCount(21)}>21d</button><button className={count===30?s.active:""} onClick={()=>setCount(30)}>30d</button></div></div></header>
    {notice&&<div className={`${s.notice} ${notice.kind==="error"?s.noticeError:s.noticeSuccess}`}>{notice.kind==="error"?"⛔":"✓"} {notice.text}</div>}
    {moveMode&&<div className={s.moveBanner}>Mover <b>{reservations.find(r=>String(r.id)===String(moveMode))?.nombre_huesped||"reserva"}</b>: tocá una celda disponible. <button onClick={()=>setMoveMode("")}>Cancelar</button></div>}
    <RangeBar selection={range} rooms={activeRooms} onClose={()=>setRange(null)} onReservation={()=>onNewRange?.({...range,tentative:false})} onTentative={()=>onNewRange?.({...range,tentative:true})} onBlock={async()=>{const ok=await onBlockRange?.({roomIds:range.roomIds,start:range.start,end:range.end,reason:"Bloqueo operativo",detail:"Creado desde selección del Planning"});if(ok)setRange(null)}}/>
    <div className={s.calendar}>
      <div className={s.head}><div className={s.roomHead}>Tipología / habitación</div><div className={s.days} style={grid}>{days.map(d=><div key={d} className={d===today?s.todayHead:""}><small>{dayName(d)}</small><b>{new Date(`${d}T12:00:00`).getDate()}</b><em>{monthName(d)}</em></div>)}</div></div>
      <OccupancyRow total label="Ocup. total" rooms={activeRooms} reservations={reservations} days={days} grid={grid}/>
      {grouped.map(([group,groupRooms])=><section className={s.group} key={group}><div className={s.groupTitle}><b>{group}</b><small>{groupRooms.length} habitaciones</small><em>{occupancyFor(today,groupRooms,reservations).pct}% hoy</em></div><OccupancyRow label="Ocupación" rooms={groupRooms} reservations={reservations} days={days} grid={grid}/>{groupRooms.map(room=>{const roomReservations=reservations.filter(r=>active(r)&&uses(r,room.id)),canJoin=range&&!range.roomIds.includes(String(room.id))&&rangeAvailable({roomId:room.id,start:range.start,end:range.end,reservations,blocks}).ok;return <div className={s.row} key={room.id}><button type="button" className={`${s.room} ${range?.roomIds.includes(String(room.id))?s.roomSelected:""}`} onClick={()=>range?toggleSelectionRoom(room.id):onNew?.(room,today)}><span><b>{room.nombre}</b><small>{room.tipo||"Habitación"}</small></span><em>{range?(range.roomIds.includes(String(room.id))?"✓":canJoin?"＋":"×"):roomStateLabel(room.estado)}</em></button><div className={s.dayGrid} style={grid}>{days.map(day=>{const blocked=(blocks||[]).some(b=>String(b.habitacion_id)===String(room.id)&&overlap(day,addDays(day,1),b.fecha_desde,b.fecha_hasta)),hovered=hover&&hover.roomId===String(room.id)&&hover.day===day,chosen=cellSelected(room.id,day);return <div key={day} data-date={day} className={`${s.cell} ${day===today?s.todayCell:""} ${blocked?s.blocked:""} ${chosen?s.rangeCell:""} ${hovered?(hover.ok?s.validTarget:s.invalidTarget):""}`} onDoubleClick={()=>!moveMode&&!blocked&&!range&&onNew?.(room,day)} onContextMenu={e=>{e.preventDefault();if(!moveMode&&!range)onBlock?.(room,day)}} onClick={()=>tapTarget(room,day)} onPointerUp={e=>{if(e.pointerType!=="mouse"&&!moveMode&&!blocked&&!drag){setSelectedId("");setRange({roomIds:[String(room.id)],start:day,end:addDays(day,1)})}} onMouseDown={e=>beginSelection(room,day,e)} onMouseEnter={()=>extendSelection(room,day)} onDragEnter={()=>enterTarget(room,day)} onDragOver={e=>overTarget(e,room,day)} onDrop={e=>dropTarget(e,room,day)}>{hovered&&<span className={s.dropHint}>{hover.reason}</span>}</div>})}{roomReservations.map(r=><ReservationBlock key={`${r.id}-${room.id}`} r={r} days={days} payments={payments} selected={String(r.id)===String(selectedId)} onSelect={x=>{setRange(null);setSelectedId(String(x.id))}} onDragStart={beginMove} onResizeStart={beginResize} onDragEnd={endDrag}/>)}</div></div>})}</section>)}
    </div>
    <Inspector reservation={selected} room={selectedRoom} payments={payments} onClose={()=>setSelectedId("")} onOpen={()=>onOpen?.(selected)} onOpenExternal={()=>onOpenExternal?.(selected)} onMoveMode={()=>{setMoveMode(String(selected.id));setSelectedId("")}}/>
  </section>
}
