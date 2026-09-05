"use client"

import s from"./planning.module.css"
import c from"./planningCanvas.module.css"
import g from"./planningGroup.module.css"
import l from"./planningLifecycle.module.css"
import p from"./planningPayment.module.css"
import{planningStage,planningStageLabel}from"./planningLifecycle"
import{paymentState}from"./planningPayment"

const DAY=86400000
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const diffDays=(a,b)=>Math.round((fromKey(b)-fromKey(a))/DAY)
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const isDayUse=item=>["day_use","dayuse","day-use"].includes(String(item.tipo_estadia||"").toLowerCase())
const roomCount=item=>new Set([item.habitacion_id,...(item.habitaciones_ids||[])].filter(Boolean).map(Number)).size
const channelMeta=value=>{const raw=String(value||"Walk-in"),key=raw.toLowerCase();if(key.includes("booking"))return{code:"B",label:"Booking.com",bg:"#003580",fg:"#fff"};if(key.includes("airbnb"))return{code:"A",label:"Airbnb",bg:"#ff385c",fg:"#fff"};if(key.includes("expedia"))return{code:"E",label:"Expedia",bg:"#f7c500",fg:"#17233d"};if(key.includes("despegar"))return{code:"D",label:"Despegar",bg:"#6b2fd0",fg:"#fff"};if(key.includes("whatsapp"))return{code:"W",label:"WhatsApp",bg:"#24a85a",fg:"#fff"};if(key.includes("telef"))return{code:"T",label:"Telefónica",bg:"#4f6f8f",fg:"#fff"};if(key.includes("motor"))return{code:"M",label:"Motor de reservas",bg:"#4c5bd4",fg:"#fff"};if(key.includes("agencia"))return{code:"AG",label:"Agencia",bg:"#60758b",fg:"#fff"};if(key.includes("walk")||key.includes("direct"))return{code:"↪",label:"Walk-in",bg:"#425466",fg:"#fff"};return{code:"•",label:raw,bg:"#667085",fg:"#fff"}}

export function ReservationBlock({item,days,selected,onSelect,onDragStart,onResizeStart,settings,onPreview}){
  const first=days[0],dayUse=isDayUse(item),entryOffset=diffDays(first,item.fecha_entrada),rooms=roomCount(item),group=rooms>1,pax=Math.max(1,Number(item.cantidad_huespedes)||1),channel=channelMeta(item.canal_reserva)
  const rawStart=dayUse?entryOffset+.08:entryOffset+.5
  const rawEnd=dayUse?entryOffset+.92:diffDays(first,item.fecha_salida)+.5
  const start=Math.max(0,rawStart),end=Math.min(days.length,rawEnd)
  if(end<=0||start>=days.length||end<=start)return null
  const span=Math.max(.5,end-start),nights=Math.max(1,diffDays(item.fecha_entrada,item.fecha_salida)),kind=planningStage(item),stageLabel=planningStageLabel(item),payment=paymentState(item)
  const showPreview=event=>onPreview?.(item,event.currentTarget.getBoundingClientRect())
  const stayLabel=dayUse?`${item.nombre_huesped}, ${pax} pasajeros, ${channel.label}, ${stageLabel}, ${payment.label}, day use`:group?`${item.nombre_huesped}, ${pax} pasajeros, ${channel.label}, ${stageLabel}, ${payment.label}, ${rooms} habitaciones, ${nights} noches`:`${item.nombre_huesped}, ${pax} pasajeros, ${channel.label}, ${stageLabel}, ${payment.label}, ${nights} noches`
  const paxStyle={height:20,minWidth:26,padding:"0 5px",flex:"0 0 auto",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:2,borderRadius:5,background:"color-mix(in srgb,currentColor 14%,transparent)",fontSize:9,fontWeight:900,lineHeight:1}
  const channelStyle={height:20,minWidth:20,padding:"0 5px",flex:"0 0 auto",display:"inline-flex",alignItems:"center",justifyContent:"center",borderRadius:5,background:channel.bg,color:channel.fg,fontSize:9,fontWeight:950,lineHeight:1,boxShadow:"inset 0 0 0 1px rgba(255,255,255,.18)"}
  return <div draggable={!group} role="button" tabIndex="0" aria-label={stayLabel} title={`${channel.label} · ${pax} pax · ${stageLabel} · ${payment.label}`} className={`${c.stay} ${l.stageBar} ${l[kind]} ${selected?c.selected:""}`} style={{left:`calc(${start} * var(--day-width) + 3px)`,width:`calc(${span} * var(--day-width) - 6px)`}} onMouseEnter={showPreview} onMouseLeave={()=>onPreview?.(null)} onFocus={showPreview} onBlur={()=>onPreview?.(null)} onClick={()=>{onPreview?.(null);onSelect(item)}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onPreview?.(null);onSelect(item)}}} onDragStart={event=>{onPreview?.(null);onDragStart(event,item)}}>
    <span className={c.stayContent}><span style={paxStyle} title={`${pax} pasajero${pax===1?"":"s"}`}>{pax===1?"👤":"👥"}{pax}</span><span style={channelStyle} title={channel.label}>{channel.code}</span><span className={c.stayText}>{settings.showId&&item.numero_reserva?<small>{item.numero_reserva}</small>:null}<b>{item.nombre_huesped}</b></span>{group?<span className={g.barGroupBadge}>{rooms} hab.</span>:settings.showPrice?<span className={c.stayPrice}>{money(item.precio_total,item.moneda)}</span>:null}</span>
    <span className={`${p.paymentStripe} ${p[payment.key]}`} aria-hidden="true"/>
    {!group?<span className={c.resizeHandle} draggable title="Cambiar fecha de salida" aria-label="Cambiar fecha de salida" onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDragStart={event=>{event.stopPropagation();onPreview?.(null);onResizeStart(event,item)}}>↔</span>:null}
  </div>
}

export function PlanningSettingsMenu({settings,onChange,onClose}){
  return <div className={s.settingsMenu}><div className={s.settingsTitle}><b>Vista del Planning</b><button type="button" onClick={onClose}>×</button></div><label className={s.zoomLabel}><span>Zoom</span><input type="range" min="28" max="62" step="2" value={settings.zoom} onChange={event=>onChange("zoom",Number(event.target.value))}/></label><Toggle label="Vista expandida" value={settings.expanded} onChange={value=>onChange("expanded",value)}/><Toggle label="Mostrar disponibilidad" value={settings.showAvailability} onChange={value=>onChange("showAvailability",value)}/><Toggle label="Mostrar ocupación" value={settings.showOccupancy} onChange={value=>onChange("showOccupancy",value)}/><Toggle label="Mostrar precio" value={settings.showPrice} onChange={value=>onChange("showPrice",value)}/><Toggle label="Mostrar ID de reserva" value={settings.showId} onChange={value=>onChange("showId",value)}/><Toggle label="Mostrar filtros" value={settings.showFilters} onChange={value=>onChange("showFilters",value)}/><Toggle label="Sombrear fines de semana" value={settings.shadeWeekends} onChange={value=>onChange("shadeWeekends",value)}/><Toggle label="Bloquear movimientos diagonales" value={settings.blockDiagonal} onChange={value=>onChange("blockDiagonal",value)}/></div>
}
function Toggle({label,value,onChange}){return <label className={s.settingRow}><span>{label}</span><input type="checkbox" checked={Boolean(value)} onChange={event=>onChange(event.target.checked)}/><i/></label>}
