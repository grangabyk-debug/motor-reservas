"use client"

import s from"./planning.module.css"
import c from"./planningCanvas.module.css"

const DAY=86400000
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const diffDays=(a,b)=>Math.round((fromKey(b)-fromKey(a))/DAY)
const initials=name=>String(name||"R").trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const STATUS_CLASS={alojado:"inhouse",confirmada:"confirmed",tentativa:"attention",pendiente:"attention",finalizada:"finished"}

export function ReservationBlock({item,days,selected,onSelect,onDragStart,onResizeStart,settings,onPreview}){
  const first=days[0],lastDate=new Date(fromKey(days.at(-1)).getTime()+DAY),last=`${lastDate.getFullYear()}-${String(lastDate.getMonth()+1).padStart(2,"0")}-${String(lastDate.getDate()).padStart(2,"0")}`
  if(item.fecha_salida<=first||item.fecha_entrada>=last)return null
  const visibleStart=item.fecha_entrada<first?first:item.fecha_entrada,visibleEnd=item.fecha_salida>last?last:item.fecha_salida
  const start=Math.max(0,diffDays(first,visibleStart)),span=Math.max(1,diffDays(visibleStart,visibleEnd)),nights=Math.max(1,diffDays(item.fecha_entrada,item.fecha_salida)),kind=STATUS_CLASS[item.estado]||"confirmed"
  const showPreview=event=>onPreview?.(item,event.currentTarget.getBoundingClientRect())
  return <div draggable role="button" tabIndex="0" aria-label={`${item.nombre_huesped}, ${nights} noches`} className={`${c.stay} ${c[kind]} ${selected?c.selected:""}`} style={{left:`calc(${start} * var(--day-width) + 3px)`,width:`calc(${span} * var(--day-width) - 6px)`}} onMouseEnter={showPreview} onMouseLeave={()=>onPreview?.(null)} onFocus={showPreview} onBlur={()=>onPreview?.(null)} onClick={()=>{onPreview?.(null);onSelect(item)}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onPreview?.(null);onSelect(item)}}} onDragStart={event=>{onPreview?.(null);onDragStart(event,item)}}>
    <span className={c.stayContent}><span className={c.avatar}>{initials(item.nombre_huesped)}</span><span className={c.stayText}>{settings.showId&&item.numero_reserva?<small>{item.numero_reserva}</small>:null}<b>{item.nombre_huesped}</b></span>{settings.showPrice?<span className={c.stayPrice}>{money(item.precio_total,item.moneda)}</span>:null}</span>
    <span className={c.resizeHandle} draggable title="Cambiar fecha de salida" aria-label="Cambiar fecha de salida" onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDragStart={event=>{event.stopPropagation();onPreview?.(null);onResizeStart(event,item)}}>↔</span>
  </div>
}

export function PlanningSettingsMenu({settings,onChange,onClose}){
  return <div className={s.settingsMenu}><div className={s.settingsTitle}><b>Vista del Planning</b><button type="button" onClick={onClose}>×</button></div><label className={s.zoomLabel}><span>Zoom</span><input type="range" min="28" max="62" step="2" value={settings.zoom} onChange={event=>onChange("zoom",Number(event.target.value))}/></label><Toggle label="Vista expandida" value={settings.expanded} onChange={value=>onChange("expanded",value)}/><Toggle label="Mostrar disponibilidad" value={settings.showAvailability} onChange={value=>onChange("showAvailability",value)}/><Toggle label="Mostrar ocupación" value={settings.showOccupancy} onChange={value=>onChange("showOccupancy",value)}/><Toggle label="Mostrar precio" value={settings.showPrice} onChange={value=>onChange("showPrice",value)}/><Toggle label="Mostrar ID de reserva" value={settings.showId} onChange={value=>onChange("showId",value)}/><Toggle label="Mostrar filtros" value={settings.showFilters} onChange={value=>onChange("showFilters",value)}/><Toggle label="Sombrear fines de semana" value={settings.shadeWeekends} onChange={value=>onChange("shadeWeekends",value)}/><Toggle label="Bloquear movimientos diagonales" value={settings.blockDiagonal} onChange={value=>onChange("blockDiagonal",value)}/><Toggle label="Ocultar botón de reserva" value={settings.hideNew} onChange={value=>onChange("hideNew",value)}/></div>
}
function Toggle({label,value,onChange}){return <label className={s.settingRow}><span>{label}</span><input type="checkbox" checked={Boolean(value)} onChange={event=>onChange(event.target.checked)}/><i/></label>}
