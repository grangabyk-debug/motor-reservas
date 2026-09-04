"use client"

import{ReservationBlock}from"./PlanningPieces"
import c from"./planningCanvas.module.css"

const DAY=86400000
const pad=value=>String(value).padStart(2,"0")
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const keyFromDate=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const addDays=(value,amount)=>keyFromDate(new Date(fromKey(value).getTime()+amount*DAY))
const dayName=value=>new Intl.DateTimeFormat("es-AR",{weekday:"short"}).format(fromKey(value)).replace(".","")
const roomHas=(item,roomId)=>Number(item.habitacion_id)===Number(roomId)||(item.habitaciones_ids||[]).map(Number).includes(Number(roomId))
const covers=(item,roomId,day)=>roomHas(item,roomId)&&item.fecha_entrada<=day&&item.fecha_salida>day

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
  return <div className={c.timelineBands} style={grid} aria-hidden="true">{days.map(day=>{const weekend=settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay());return <span key={day} className={`${weekend?c.bandWeekend:""} ${day===today?c.bandToday:""}`}/>})}</div>
}

function InventoryStrip({days,rooms,reservations,today,settings,grid}){
  if(!settings.showAvailability&&!settings.showOccupancy)return null
  return <div className={c.inventoryRow}>
    <div className={c.inventoryLabel}><b>Disponibilidad</b><small>{rooms.length} hab.</small></div>
    <div className={c.inventoryDays} style={grid}>{days.map(day=>{
      const occupied=rooms.filter(room=>reservations.some(item=>covers(item,room.id,day))).length
      const available=Math.max(0,rooms.length-occupied),pct=rooms.length?Math.round(occupied/rooms.length*100):0,weekend=settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay())
      return <div key={day} className={`${available===0?c.soldOut:""} ${weekend?c.inventoryWeekend:""} ${day===today?c.inventoryToday:""}`}>{settings.showAvailability?<b>{available}</b>:null}{settings.showOccupancy?<small>{pct}%</small>:null}</div>
    })}</div>
  </div>
}

function RangeActions({days,range,onConfirm,onCancel}){
  if(!range)return null
  const start=Math.max(0,days.indexOf(range.start)),end=Math.max(start+1,days.indexOf(addDays(range.end,-1))+1),center=(start+end)/2
  return <div className={c.rangeActions} style={{left:`calc(${center} * var(--day-width))`}}><button type="button" onClick={onCancel} aria-label="Cancelar rango">×</button><button type="button" className={c.rangeConfirm} onClick={onConfirm} aria-label="Crear reserva en este rango">✓</button></div>
}

function RoomRow({room,days,settings,grid,visibleReservations,selected,dragging,dropCell,rangeSelection,onRoom,onBeginRange,onExtendRange,onFinishRange,onDropCell,onDrop,onSelect,onDrag,onResize,onPreview,onConfirmRange,onCancelRange}){
  const reservations=visibleReservations.filter(item=>roomHas(item,room.id)),ownRange=rangeSelection&&String(rangeSelection.roomId)===String(room.id)?rangeSelection:null
  return <div className={c.roomRow}>
    <button type="button" className={c.room} onClick={()=>onRoom()}><span><b>{room.nombre}</b><small>{room.tipo||"Sin tipo"} · {room.capacidad||1} pax</small></span>{room.estado==="mantenimiento"?<span className={c.maintenance} title="Mantenimiento">!</span>:null}</button>
    <div className={c.timelineRow} style={grid}>
      {days.map(day=>{const key=`${room.id}-${day}`,range=ownRange&&day>=ownRange.start&&day<ownRange.end;return <button type="button" key={day} className={`${c.cell} ${range?c.rangeCell:""} ${dropCell===key?c.dropTarget:""}`} aria-label={`${room.nombre} ${day}`} onMouseDown={event=>onBeginRange(event,room.id,day)} onMouseEnter={()=>onExtendRange(room.id,day)} onMouseUp={event=>onFinishRange(event,room.id)} onDoubleClick={event=>{event.preventDefault();event.stopPropagation();onRoom(day)}} onDragEnter={()=>dragging&&onDropCell(key)} onDragOver={event=>{if(dragging){event.preventDefault();event.dataTransfer.dropEffect="move"}}} onDragLeave={()=>dropCell===key&&onDropCell("")} onDrop={event=>onDrop(event,room.id,day)}/>})}
      {reservations.map(item=><ReservationBlock key={`${room.id}-${item.id}`} item={item} days={days} selected={selected?.id===item.id} settings={settings} onSelect={onSelect} onDragStart={onDrag} onResizeStart={onResize} onPreview={onPreview}/>) }
      {ownRange?<RangeActions days={days} range={ownRange} onConfirm={onConfirmRange} onCancel={onCancelRange}/>:null}
    </div>
  </div>
}

export default function PlanningCalendar({property,days,today,settings,rooms,availabilityReservations,visibleReservations,selected,dragging,dropCell,rangeSelection,onRoom,onBeginRange,onExtendRange,onFinishRange,onDropCell,onDrop,onSelect,onDrag,onResize,onPreview,onConfirmRange,onCancelRange}){
  const grid={gridTemplateColumns:`repeat(${days.length},var(--day-width))`},months=monthSegments(days)
  return <div className={c.calendar}>
    <div className={c.monthRow}><div className={c.corner}><span>{property?.name||"Propiedad activa"}</span></div><div className={c.months} style={grid}>{months.map(segment=><div key={segment.key} style={{gridColumn:`${segment.start+1} / span ${segment.span}`}}>{segment.label}</div>)}</div></div>
    <div className={c.dayRow}><div className={c.roomHead}>Habitación</div><div className={c.days} style={grid}>{days.map(day=>{const weekend=settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay());return <div key={day} className={`${day===today?c.todayHead:""} ${weekend?c.weekendHead:""}`}><small>{dayName(day)}</small><b>{fromKey(day).getDate()}</b></div>})}</div></div>
    <InventoryStrip days={days} rooms={rooms} reservations={availabilityReservations} today={today} settings={settings} grid={grid}/>
    <div className={c.calendarBody} style={{"--timeline-width":`calc(${days.length} * var(--day-width))`}}>
      <TimelineBands days={days} today={today} settings={settings} grid={grid}/>
      {rooms.map(room=><RoomRow key={room.id} room={room} days={days} settings={settings} grid={grid} visibleReservations={visibleReservations} selected={selected} dragging={dragging} dropCell={dropCell} rangeSelection={rangeSelection} onRoom={day=>onRoom(room.id,day||today)} onBeginRange={onBeginRange} onExtendRange={onExtendRange} onFinishRange={onFinishRange} onDropCell={onDropCell} onDrop={onDrop} onSelect={onSelect} onDrag={onDrag} onResize={onResize} onPreview={onPreview} onConfirmRange={onConfirmRange} onCancelRange={onCancelRange}/>) }
      {!rooms.length?<div className={c.noResults}>No hay habitaciones que coincidan con los filtros.</div>:null}
    </div>
  </div>
}
