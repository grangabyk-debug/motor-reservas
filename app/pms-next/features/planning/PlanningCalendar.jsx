"use client"

import{useEffect,useState}from"react"
import{ReservationBlock}from"./PlanningPieces"
import{PLANNING_STAGES}from"./planningLifecycle"
import{PAYMENT_STATES}from"./planningPayment"
import c from"./planningCanvas.module.css"
import t from"./planningToday.module.css"
import l from"./planningLifecycle.module.css"
import p from"./planningPayment.module.css"

const DAY=86400000
const pad=value=>String(value).padStart(2,"0")
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const keyFromDate=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const addDays=(value,amount)=>keyFromDate(new Date(fromKey(value).getTime()+amount*DAY))
const diffDays=(a,b)=>Math.round((fromKey(b)-fromKey(a))/DAY)
const dayName=value=>new Intl.DateTimeFormat("es-AR",{weekday:"short"}).format(fromKey(value)).replace(".","")
const selectionDate=value=>new Intl.DateTimeFormat("es-AR",{weekday:"short",day:"2-digit",month:"short"}).format(fromKey(value)).replaceAll(".","")
const roomHas=(item,roomId)=>Number(item.habitacion_id)===Number(roomId)||(item.habitaciones_ids||[]).map(Number).includes(Number(roomId))
const covers=(item,roomId,day)=>roomHas(item,roomId)&&item.fecha_entrada<=day&&item.fecha_salida>day
const coversDay=(item,day)=>item.fecha_entrada<=day&&item.fecha_salida>day
const overlaps=(item,start,end)=>item.fecha_entrada<end&&item.fecha_salida>start
const assignedIds=item=>new Set([item.habitacion_id,...(item.habitaciones_ids||[])].filter(Boolean).map(Number))
const dayDivider={borderRight:"1px solid color-mix(in srgb,var(--muted) 48%,var(--line))"}
function toast(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}

function monthSegments(days){
  const result=[]
  days.forEach((day,index)=>{
    const date=fromKey(day),key=`${date.getFullYear()}-${date.getMonth()}`,previous=result.at(-1)
    if(previous?.key===key)previous.span++
    else result.push({key,start:index,span:1,date})
  })
  return result.map(segment=>({...segment,label:segment.span<4?new Intl.DateTimeFormat("es-AR",{month:"short"}).format(segment.date).replace(".",""):new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric"}).format(segment.date)}))
}

function TimelineBands({days,today,settings,grid}){
  return <div className={c.timelineBands} style={grid} aria-hidden="true">{days.map(day=>{const weekend=settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay());return <span key={day} style={dayDivider} className={`${weekend?c.bandWeekend:""} ${day===today?`${c.bandToday} ${t.todayBand}`:""}`}/>})}</div>
}

function InventoryStrip({days,rooms,reservations,today,settings,grid}){
  if(!settings.showAvailability&&!settings.showOccupancy)return null
  return <div className={c.inventoryRow}>
    <div className={c.inventoryLabel}><b>Disponibilidad</b><small>{rooms.length} hab.</small></div>
    <div className={c.inventoryDays} style={grid}>{days.map(day=>{
      const occupied=rooms.filter(room=>reservations.some(item=>covers(item,room.id,day))).length
      const available=Math.max(0,rooms.length-occupied),pct=rooms.length?Math.round(occupied/rooms.length*100):0,weekend=settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay())
      return <div key={day} style={dayDivider} className={`${available===0?c.soldOut:""} ${weekend?c.inventoryWeekend:""} ${day===today?`${c.inventoryToday} ${t.todayInventory}`:""}`}>{settings.showAvailability?<b>{available}</b>:null}{settings.showOccupancy?<small>{pct}%</small>:null}</div>
    })}</div>
  </div>
}

function UnassignedStrip({days,reservations,grid}){
  const unassigned=reservations.filter(item=>item.estado!=="finalizada"&&assignedIds(item).size===0)
  if(!unassigned.length)return null
  const counts=days.map(day=>unassigned.filter(item=>coversDay(item,day)).length),total=new Set(unassigned.map(item=>item.id)).size
  return <div className={l.unassignedRow}>
    <div className={l.unassignedLabel}><b>Sin asignar</b><small>{total}</small></div>
    <div className={l.unassignedDays} style={grid}>{days.map((day,index)=><div key={day} style={dayDivider} data-active={counts[index]>0?"true":"false"}>{counts[index]||"·"}</div>)}</div>
  </div>
}

function PlanningReference({onClose}){
  return <aside className={c.referencePopover} style={{maxHeight:"calc(100dvh - 110px)",overflow:"auto"}} role="dialog" aria-label="Referencia del Planning">
    <header><div><small>REFERENCIA</small><b>Cómo leer el Planning</b></div><button type="button" onClick={onClose} aria-label="Cerrar referencia">×</button></header>
    <div className={c.referenceRows}>
      {PLANNING_STAGES.map(stage=><div key={stage.key}><i className={`${l.legendSwatch} ${l[stage.key]}`}/><span><b>{stage.label}</b><small>{stage.description}</small></span></div>)}
      <div><i className={`${c.legendSwatch} ${c.legendToday}`}/><span><b>Hoy</b><small>Columna celeste del día actual</small></span></div>
      <div><i className={l.weekendLegend}/><span><b>Fin de semana</b><small>Sábado y domingo con fondo gris suave</small></span></div>
      <div><i className={c.middaySample}/><span><b>Mediodía</b><small>Línea punteada: referencia de check-in / check-out</small></span></div>
    </div>
    <div className={p.referenceSection}><small>ESTADO DE PAGO · LÍNEA INFERIOR</small></div>
    <div className={c.referenceRows}>{PAYMENT_STATES.map(state=><div key={state.key}><i className={`${p.paymentLegend} ${p[state.key]}`}/><span><b>{state.label}</b><small>{state.description}</small></span></div>)}</div>
    <p>El color grande siempre representa el momento operativo de la estadía. La línea inferior es independiente y muestra únicamente el cobro, para no mezclar una reserva confirmada con una reserva pagada.</p>
  </aside>
}

function rangeGeometry(days,range){
  const startIndex=days.indexOf(range?.start),endIndex=days.indexOf(range?.end)
  if(startIndex<0||endIndex<0||endIndex<=startIndex)return null
  const left=startIndex+.5,right=endIndex+.5
  return{left,width:right-left,center:(left+right)/2}
}

function RangeHighlight({days,range,blocked}){
  const geometry=rangeGeometry(days,range)
  if(!geometry)return null
  return <div className={`${c.rangeHighlight} ${blocked?c.rangeHighlightBlocked:""}`} style={{left:`calc(${geometry.left} * var(--day-width) + 2px)`,width:`calc(${geometry.width} * var(--day-width) - 4px)`}} aria-hidden="true"/>
}

function RangeActions({days,range,onConfirm,onCancel,blocked,blockedMessage}){
  if(!range)return null
  const geometry=rangeGeometry(days,range)
  if(!geometry)return null
  function confirm(){if(blocked){toast({tone:"error",title:"Habitación ocupada",message:blockedMessage||"Ese rango contiene una habitación ocupada. Elegí otro rango.",duration:4200});return}onConfirm()}
  return <div className={c.rangeActions} style={{left:`calc(${geometry.center} * var(--day-width))`}}><button type="button" onClick={onCancel} aria-label="Cancelar rango">×</button><button type="button" className={c.rangeConfirm} onClick={confirm} aria-disabled={blocked?"true":"false"} title={blocked?blockedMessage:"Crear reserva en este rango"} style={blocked?{opacity:.48,cursor:"not-allowed"}:undefined} aria-label={blocked?"Rango no disponible":"Crear reserva en este rango"}>✓</button></div>
}

function SelectionGuide({range,rooms,pointer,blocked}){
  if(!range||!pointer?.active)return null
  const ids=new Set((range.roomIds||[]).map(String)),selectedRooms=rooms.filter(room=>ids.has(String(room.id))),nights=Math.max(1,diffDays(range.start,range.end)),names=selectedRooms.map(room=>room.nombre)
  const roomSummary=names.length<=3?names.join(", "):`${names.slice(0,3).join(", ")} +${names.length-3}`
  const width=274,left=typeof window==="undefined"?pointer.x+16:Math.max(12,Math.min(pointer.x+16,window.innerWidth-width-12)),top=typeof window==="undefined"?pointer.y+16:Math.max(12,Math.min(pointer.y+16,window.innerHeight-154))
  const shell={position:"fixed",left,top,zIndex:190,width,padding:"11px 12px",border:`1px solid ${blocked?"color-mix(in srgb, var(--red) 55%, var(--line))":"color-mix(in srgb, var(--accent) 34%, var(--line))"}`,borderRadius:12,background:"color-mix(in srgb, var(--panelSolid) 96%, transparent)",color:"var(--text)",boxShadow:"0 16px 40px rgba(18,31,55,.22)",backdropFilter:"blur(18px) saturate(1.15)",pointerEvents:"none"}
  const label={fontSize:10,fontWeight:900,letterSpacing:".08em",color:blocked?"var(--red)":"var(--accent)",textTransform:"uppercase"}
  const dates={display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:8,marginTop:6,padding:"7px 8px",borderRadius:9,background:"color-mix(in srgb, var(--accent) 5%, var(--panelSolid))"}
  return <div style={shell} role="status" aria-live="polite"><div style={label}>{blocked?"Selección con conflicto":"Seleccionando reserva"}</div><div style={dates}><span><small style={{display:"block",fontSize:9,color:"var(--muted)"}}>Entrada</small><b style={{fontSize:11}}>{selectionDate(range.start)}</b></span><strong style={{padding:"4px 7px",borderRadius:999,background:"color-mix(in srgb, var(--accent) 10%, var(--panelSolid))",fontSize:10,color:"var(--accent)"}}>{nights} noche{nights===1?"":"s"}</strong><span style={{textAlign:"right"}}><small style={{display:"block",fontSize:9,color:"var(--muted)"}}>Salida</small><b style={{fontSize:11}}>{selectionDate(range.end)}</b></span></div><div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:8,fontSize:10}}><span style={{color:"var(--muted)"}}>{names.length} habitación{names.length===1?"":"es"}</span><b style={{maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{roomSummary||"—"}</b></div>{blocked?<div style={{marginTop:6,fontSize:10,color:"var(--red)",fontWeight:750}}>Hay una ocupación dentro del rango.</div>:null}</div>
}

function RoomRow({room,days,today,settings,grid,availabilityReservations,visibleReservations,selected,dragging,dropCell,rangeSelection,rangeBlocked,rangeBlockedMessage,rangeDragging,onRoom,onBeginRange,onExtendRange,onFinishRange,onSelectionStart,onSelectionMove,onSelectionEnd,onDropCell,onDrop,onSelect,onDrag,onResize,onPreview,onConfirmRange,onCancelRange}){
  const reservations=visibleReservations.filter(item=>roomHas(item,room.id))
  const selectedRooms=(rangeSelection?.roomIds||[]).map(String),ownRange=rangeSelection&&selectedRooms.includes(String(room.id))?rangeSelection:null,showRangeActions=ownRange&&!rangeDragging&&String(selectedRooms[0])===String(room.id)
  const meta=[room.floor_name,room.tipo||"Sin tipo",`${room.capacidad||1} pax`].filter(Boolean).join(" · ")
  const occupied=(start,end)=>availabilityReservations.some(item=>roomHas(item,room.id)&&overlaps(item,start,end))
  function occupiedNotice(start,end){toast({tone:"error",title:`Habitación ${room.nombre} ocupada`,message:`No se puede iniciar una estadía el ${start}: la habitación está ocupada después del mediodía.`,duration:4200})}
  const todayBlocked=occupied(today,addDays(today,1))
  return <div className={c.roomRow}>
    <button type="button" className={c.room} onClick={()=>{if(todayBlocked){occupiedNotice(today,addDays(today,1));return}onRoom(today)}}><span><b>{room.nombre}</b><small>{meta}</small></span>{room.estado==="mantenimiento"?<span className={c.maintenance} title="Mantenimiento">!</span>:null}</button>
    <div className={c.timelineRow} style={grid}>
      {days.map(day=>{const key=`${room.id}-${day}`,startBlocked=occupied(day,addDays(day,1));return <button type="button" key={day} className={`${c.cell} ${dropCell===key?c.dropTarget:""}`} aria-label={`${room.nombre} ${day}${startBlocked?" · ocupada para ingreso":""}`} aria-disabled={startBlocked?"true":"false"} title={startBlocked?`No se puede iniciar una reserva en ${room.nombre} este día`:"Ingreso desde el mediodía"} style={startBlocked?{cursor:"not-allowed"}:undefined} onMouseDown={event=>{if(startBlocked){event.preventDefault();event.stopPropagation();occupiedNotice(day,addDays(day,1));return}onSelectionStart(event);onBeginRange(event,room.id,day)}} onMouseEnter={event=>{if((event.buttons&1)===1){onSelectionMove(event);onExtendRange(room.id,day)}}} onMouseMove={event=>{if((event.buttons&1)===1)onSelectionMove(event)}} onMouseUp={event=>{onSelectionEnd();onFinishRange(event,room.id)}} onDoubleClick={event=>{event.preventDefault();event.stopPropagation();if(startBlocked){occupiedNotice(day,addDays(day,1));return}onRoom(day)}} onDragEnter={()=>dragging&&onDropCell(key)} onDragOver={event=>{if(dragging){event.preventDefault();event.dataTransfer.dropEffect="move"}}} onDragLeave={()=>dropCell===key&&onDropCell("")} onDrop={event=>onDrop(event,room.id,day)}/>})}
      {ownRange?<RangeHighlight days={days} range={ownRange} blocked={rangeBlocked}/>:null}
      {reservations.map(item=><ReservationBlock key={`${room.id}-${item.id}`} item={item} days={days} selected={selected?.id===item.id} settings={settings} onSelect={onSelect} onDragStart={onDrag} onResizeStart={onResize} onPreview={onPreview}/>) }
      {showRangeActions?<RangeActions days={days} range={ownRange} blocked={rangeBlocked} blockedMessage={rangeBlockedMessage} onConfirm={onConfirmRange} onCancel={onCancelRange}/>:null}
    </div>
  </div>
}

export default function PlanningCalendar({property,days,today,settings,rooms,availabilityReservations,visibleReservations,selected,dragging,dropCell,rangeSelection,onRoom,onBeginRange,onExtendRange,onFinishRange,onDropCell,onDrop,onSelect,onDrag,onResize,onPreview,onConfirmRange,onCancelRange}){
  const[referenceOpen,setReferenceOpen]=useState(false),[selectionPointer,setSelectionPointer]=useState({active:false,x:0,y:0})
  const grid={gridTemplateColumns:`repeat(${days.length},var(--day-width))`},months=monthSegments(days)
  const selectedRangeIds=new Set((rangeSelection?.roomIds||[]).map(String))
  const rangeConflictRooms=rangeSelection?rooms.filter(room=>selectedRangeIds.has(String(room.id))&&availabilityReservations.some(item=>roomHas(item,room.id)&&overlaps(item,rangeSelection.start,rangeSelection.end))):[]
  const rangeBlocked=rangeConflictRooms.length>0,rangeBlockedMessage=rangeBlocked?`${rangeConflictRooms.length===1?`La habitación ${rangeConflictRooms[0].nombre} ya está ocupada`:`Las habitaciones ${rangeConflictRooms.slice(0,3).map(room=>room.nombre).join(", ")}${rangeConflictRooms.length>3?"…":""} ya están ocupadas`} en parte de ese rango. Elegí fechas o habitaciones disponibles.`:""
  function startSelection(event){setSelectionPointer({active:true,x:event.clientX,y:event.clientY})}
  function moveSelection(event){if((event.buttons&1)!==1){setSelectionPointer(current=>current.active?{...current,active:false}:current);return}setSelectionPointer({active:true,x:event.clientX,y:event.clientY})}
  function endSelection(){setSelectionPointer(current=>current.active?{...current,active:false}:current)}
  useEffect(()=>{const stop=event=>{endSelection();onFinishRange?.(event)};window.addEventListener("mouseup",stop);window.addEventListener("blur",stop);return()=>{window.removeEventListener("mouseup",stop);window.removeEventListener("blur",stop)}},[onFinishRange])
  return <div className={c.calendarShell}>
    <div className={c.calendar}>
      <div className={c.monthRow}><div className={c.corner}><span>{property?.name||"Propiedad activa"}</span><button type="button" className={c.referenceButton} onClick={()=>setReferenceOpen(value=>!value)} aria-label="Ver referencia del Planning" title="Referencia de colores, pagos y horarios">i</button></div><div className={c.months} style={grid}>{months.map(segment=><div key={segment.key} style={{gridColumn:`${segment.start+1} / span ${segment.span}`}}>{segment.label}</div>)}</div></div>
      <div className={c.dayRow}><div className={c.roomHead}>Habitación</div><div className={c.days} style={grid}>{days.map(day=>{const weekend=settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay());return <div key={day} style={dayDivider} className={`${day===today?`${c.todayHead} ${t.todayHeader}`:""} ${weekend?c.weekendHead:""}`}><small>{dayName(day)}</small><b>{fromKey(day).getDate()}</b></div>})}</div></div>
      <InventoryStrip days={days} rooms={rooms} reservations={availabilityReservations} today={today} settings={settings} grid={grid}/>
      <UnassignedStrip days={days} reservations={availabilityReservations} grid={grid}/>
      <div className={c.calendarBody} style={{"--timeline-width":`calc(${days.length} * var(--day-width))`}}>
        <TimelineBands days={days} today={today} settings={settings} grid={grid}/>
        {rooms.map(room=><RoomRow key={room.id} room={room} days={days} today={today} settings={settings} grid={grid} availabilityReservations={availabilityReservations} visibleReservations={visibleReservations} selected={selected} dragging={dragging} dropCell={dropCell} rangeSelection={rangeSelection} rangeBlocked={rangeBlocked} rangeBlockedMessage={rangeBlockedMessage} rangeDragging={selectionPointer.active} onRoom={day=>onRoom(room.id,day||today)} onBeginRange={onBeginRange} onExtendRange={onExtendRange} onFinishRange={onFinishRange} onSelectionStart={startSelection} onSelectionMove={moveSelection} onSelectionEnd={endSelection} onDropCell={onDropCell} onDrop={onDrop} onSelect={onSelect} onDrag={onDrag} onResize={onResize} onPreview={onPreview} onConfirmRange={onConfirmRange} onCancelRange={onCancelRange}/>) }
        {!rooms.length?<div className={c.noResults}>No hay habitaciones que coincidan con los filtros.</div>:null}
      </div>
    </div>
    <SelectionGuide range={rangeSelection} rooms={rooms} pointer={selectionPointer} blocked={rangeBlocked}/>
    {referenceOpen?<PlanningReference onClose={()=>setReferenceOpen(false)}/>:null}
  </div>
}
