"use client"

import{ReservationBlock}from"./PlanningPieces"
import s from"./planning.module.css"

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
    else result.push({key,start:index,span:1,label:new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric"}).format(date)})
  })
  return result
}

function TimelineBands({days,today,settings,grid}){
  return <div className={s.timelineBands} style={grid} aria-hidden="true">{days.map(day=>{
    const weekend=settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay())
    return <span key={day} className={`${weekend?s.bandWeekend:""} ${day===today?s.bandToday:""}`}/>
  })}</div>
}

function InventoryStrip({days,rooms,reservations,today,settings,grid}){
  if(!settings.showAvailability&&!settings.showOccupancy)return null
  return <div className={s.inventoryRow}>
    <div className={s.inventoryLabel}><b>Disponibilidad</b><small>{rooms.length} habitaciones visibles</small></div>
    <div className={s.inventoryDays} style={grid}>{days.map(day=>{
      const occupied=rooms.filter(room=>reservations.some(item=>covers(item,room.id,day))).length
      const available=Math.max(0,rooms.length-occupied),pct=rooms.length?Math.round(occupied/rooms.length*100):0
      return <div key={day} className={`${available===0?s.soldOut:""} ${day===today?s.inventoryToday:""}`}>
        {settings.showAvailability?<b>{available}</b>:null}
        {settings.showOccupancy?<small>{pct}%</small>:null}
      </div>
    })}</div>
  </div>
}

function RangeActions({days,range,onConfirm,onCancel}){
  if(!range)return null
  const start=Math.max(0,days.indexOf(range.start)),end=Math.max(start+1,days.indexOf(addDays(range.end,-1))+1)
  const center=(start+end)/2
  return <div className={s.rangeActions} style={{left:`calc(${center} * var(--day-width))`}}>
    <button type="button" onClick={onCancel} aria-label="Cancelar rango">×</button>
    <button type="button" className={s.rangeConfirm} onClick={onConfirm} aria-label="Crear reserva en este rango">✓</button>
  </div>
}

function RoomRow({room,days,today,settings,grid,visibleReservations,selected,dragging,dropCell,rangeSelection,onRoom,onBeginRange,onExtendRange,onFinishRange,onDropCell,onDrop,onSelect,onDrag,onResize,onPreview,onConfirmRange,onCancelRange}){
  const reservations=visibleReservations.filter(item=>roomHas(item,room.id))
  const ownRange=rangeSelection&&String(rangeSelection.roomId)===String(room.id)?rangeSelection:null
  return <div className={s.roomRow}>
    <button type="button" className={s.room} onClick={onRoom}>
      <span><b>{room.nombre}</b><small>{room.tipo||"Sin tipo"} · {room.capacidad||1} pax</small></span>
      {room.estado==="mantenimiento"?<span className={s.maintenance} title="Mantenimiento">!</span>:null}
    </button>
    <div className={s.timelineRow} style={grid}>
      {days.map(day=>{
        const key=`${room.id}-${day}`,range=ownRange&&day>=ownRange.start&&day<ownRange.end
        return <button type="button" key={day} className={`${s.cell} ${range?s.rangeCell:""} ${dropCell===key?s.dropTarget:""}`} aria-label={`${room.nombre} ${day}`} onMouseDown={event=>onBeginRange(event,room.id,day)} onMouseEnter={()=>onExtendRange(room.id,day)} onMouseUp={event=>onFinishRange(event,room.id)} onDoubleClick={()=>onRoom(day)} onDragEnter={()=>dragging&&onDropCell(key)} onDragOver={event=>{if(dragging){event.preventDefault();event.dataTransfer.dropEffect="move"}}} onDragLeave={()=>dropCell===key&&onDropCell("")} onDrop={event=>onDrop(event,room.id,day)}/>
      })}
      {reservations.map(item=><ReservationBlock key={`${room.id}-${item.id}`} item={item} days={days} selected={selected?.id===item.id} settings={settings} onSelect={onSelect} onDragStart={onDrag} onResizeStart={onResize} onPreview={onPreview}/>) }
      {ownRange?<RangeActions days={days} range={ownRange} onConfirm={onConfirmRange} onCancel={onCancelRange}/>:null}
    </div>
  </div>
}

export default function PlanningCalendar({property,days,today,settings,rooms,availabilityReservations,visibleReservations,selected,dragging,dropCell,rangeSelection,onRoom,onBeginRange,onExtendRange,onFinishRange,onDropCell,onDrop,onSelect,onDrag,onResize,onPreview,onConfirmRange,onCancelRange}){
  const grid={gridTemplateColumns:`repeat(${days.length},var(--day-width))`},months=monthSegments(days)
  return <div className={s.calendar}>
    <div className={s.monthRow}>
      <div className={s.corner}><span>{property?.name||"Propiedad activa"}</span></div>
      <div className={s.months} style={grid}>{months.map(segment=><div key={segment.key} style={{gridColumn:`${segment.start+1} / span ${segment.span}`}}>{segment.label}</div>)}</div>
    </div>
    <div className={s.dayRow}>
      <div className={s.roomHead}>Habitación</div>
      <div className={s.days} style={grid}>{days.map(day=>{const weekend=settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay());return <div key={day} className={`${day===today?s.todayHead:""} ${weekend?s.weekendHead:""}`}><small>{dayName(day)}</small><b>{fromKey(day).getDate()}</b></div>})}</div>
    </div>
    <InventoryStrip days={days} rooms={rooms} reservations={availabilityReservations} today={today} settings={settings} grid={grid}/>
    <div className={s.calendarBody} style={{"--timeline-width":`calc(${days.length} * var(--day-width))`}}>
      <TimelineBands days={days} today={today} settings={settings} grid={grid}/>
      {rooms.map(room=><RoomRow key={room.id} room={room} days={days} today={today} settings={settings} grid={grid} visibleReservations={visibleReservations} selected={selected} dragging={dragging} dropCell={dropCell} rangeSelection={rangeSelection} onRoom={day=>onRoom(room.id,day||today)} onBeginRange={onBeginRange} onExtendRange={onExtendRange} onFinishRange={onFinishRange} onDropCell={onDropCell} onDrop={onDrop} onSelect={onSelect} onDrag={onDrag} onResize={onResize} onPreview={onPreview} onConfirmRange={onConfirmRange} onCancelRange={onCancelRange}/>) }
      {!rooms.length?<div className={s.noResults}>No hay habitaciones que coincidan con los filtros.</div>:null}
    </div>
  </div>
}
