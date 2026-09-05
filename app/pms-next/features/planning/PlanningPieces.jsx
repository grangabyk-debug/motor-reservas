"use client"

import s from"./planning.module.css"
import c from"./planningCanvas.module.css"
import g from"./planningGroup.module.css"

const DAY=86400000
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const diffDays=(a,b)=>Math.round((fromKey(b)-fromKey(a))/DAY)
const initials=name=>String(name||"R").trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const STATUS_CLASS={alojado:"inhouse",confirmada:"confirmed",tentativa:"attention",pendiente:"attention",finalizada:"finished"}
const isDayUse=item=>["day_use","dayuse","day-use"].includes(String(item.tipo_estadia||"").toLowerCase())
const roomCount=item=>new Set([item.habitacion_id,...(item.habitaciones_ids||[])].filter(Boolean).map(Number)).size

export function ReservationBlock({item,days,selected,onSelect,onDragStart,onResizeStart,settings,onPreview}){
  const first=days[0],dayUse=isDayUse(item),entryOffset=diffDays(first,item.fecha_entrada),rooms=roomCount(item),group=rooms>1
  const rawStart=dayUse?entryOffset+.08:entryOffset+.5
  const rawEnd=dayUse?entryOffset+.92:diffDays(first,item.fecha_salida)+.5
  const start=Math.max(0,rawStart),end=Math.min(days.length,rawEnd)
  if(end<=0||start>=days.length||end<=start)return null
  const span=Math.max(.5,end-start),nights=Math.max(1,diffDays(item.fecha_entrada,item.fecha_salida)),kind=STATUS_CLASS[item.estado]||"confirmed"
  const showPreview=event=>onPreview?.(item,event.currentTarget.getBoundingClientRect())
  const stayLabel=dayUse?`${item.nombre_huesped}, day use`:group?`${item.nombre_huesped}, ${rooms} habitaciones, ${nights} noches`:`${item.nombre_huesped}, ${nights} noches`
  return <div draggable={!group} role="button" tabIndex="0" aria-label={stayLabel} className={`${c.stay} ${c[kind]} ${selected?c.selected:""}`} style={{left:`calc(${start} * var(--day-width) + 3px)`,width:`calc(${span} * var(--day-width) - 6px)`}} onMouseEnter={showPreview} onMouseLeave={()=>onPreview?.(null)} onFocus={showPreview} onBlur={()=>onPreview?.(null)} onClick={()=>{onPreview?.(null);onSelect(item)}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onPreview?.(null);onSelect(item)}}} onDragStart={event=>{onPreview?.(null);onDragStart(event,item)}}>
    <span className={c.stayContent}><span className={c.avatar}>{initials(item.nombre_huesped)}</span><span className={c.stayText}>{settings.showId&&item.numero_reserva?<small>{item.numero_reserva}</small>:null}<b>{item.nombre_huesped}</b></span>{group?<span className={g.barGroupBadge}>{rooms} hab.</span>:settings.showPrice?<span className={c.stayPrice}>{money(item.precio_total,item.moneda)}</span>:null}</span>
    {!group?<span className={c.resizeHandle} draggable title="Cambiar fecha de salida" aria-label="Cambiar fecha de salida" onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDragStart={event=>{event.stopPropagation();onPreview?.(null);onResizeStart(event,item)}}>↔</span>:null}
  </div>
}

export function PlanningSettingsMenu({settings,onChange,onClose}){
  return <div className={s.settingsMenu}><div className={s.settingsTitle}><b>Vista del Planning</b><button type="button" onClick={onClose}>×</button></div><label className={s.zoomLabel}><span>Zoom</span><input type="range" min="28" max="62" step="2" value={settings.zoom} onChange={event=>onChange("zoom",Number(event.target.value))}/></label><Toggle label="Vista expandida" value={settings.expanded} onChange={value=>onChange("expanded",value)}/><Toggle label="Mostrar disponibilidad" value={settings.showAvailability} onChange={value=>onChange("showAvailability",value)}/><Toggle label="Mostrar ocupación" value={settings.showOccupancy} onChange={value=>onChange("showOccupancy",value)}/><Toggle label="Mostrar precio" value={settings.showPrice} onChange={value=>onChange("showPrice",value)}/><Toggle label="Mostrar ID de reserva" value={settings.showId} onChange={value=>onChange("showId",value)}/><Toggle label="Mostrar filtros" value={settings.showFilters} onChange={value=>onChange("showFilters",value)}/><Toggle label="Sombrear fines de semana" value={settings.shadeWeekends} onChange={value=>onChange("shadeWeekends",value)}/><Toggle label="Bloquear movimientos diagonales" value={settings.blockDiagonal} onChange={value=>onChange("blockDiagonal",value)}/></div>
}
function Toggle({label,value,onChange}){return <label className={s.settingRow}><span>{label}</span><input type="checkbox" checked={Boolean(value)} onChange={event=>onChange(event.target.checked)}/><i/></label>}
