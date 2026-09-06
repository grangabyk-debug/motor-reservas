"use client"

import{useRef,useState}from"react"
import s from"./planning.module.css"
import c from"./planningCanvas.module.css"
import g from"./planningGroup.module.css"
import l from"./planningLifecycle.module.css"
import p from"./planningPayment.module.css"
import ReservationChannelLogo,{channelMeta}from"./ReservationChannelLogo"
import{planningStage,planningStageLabel}from"./planningLifecycle"
import{paymentState}from"./planningPayment"

const DAY=86400000
const pad=value=>String(value).padStart(2,"0")
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const keyFromDate=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const addDays=(value,amount)=>keyFromDate(new Date(fromKey(value).getTime()+amount*DAY))
const diffDays=(a,b)=>Math.round((fromKey(b)-fromKey(a))/DAY)
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const isDayUse=item=>["day_use","dayuse","day-use"].includes(String(item.tipo_estadia||"").toLowerCase())
const roomCount=item=>new Set([item.habitacion_id,...(item.habitaciones_ids||[])].filter(Boolean).map(Number)).size

export function ReservationBlock({item,days,selected,onSelect,onDragStart,onResizeStart,settings,onPreview}){
  const[resizeEnd,setResizeEnd]=useState(null),[resizing,setResizing]=useState(false),resizeValue=useRef(null)
  const first=days[0],dayUse=isDayUse(item),noShow=Boolean(item.no_show),effectiveEnd=resizeEnd||item.fecha_salida,markerDay=noShow?(item.no_show_release_date||item.fecha_entrada):item.fecha_entrada,entryOffset=diffDays(first,noShow?markerDay:item.fecha_entrada),rooms=roomCount(item),group=rooms>1,pax=Math.max(1,Number(item.cantidad_huespedes)||1),channel=channelMeta(item.canal_reserva)
  const rawStart=noShow?entryOffset+.04:dayUse?entryOffset+.08:entryOffset+.5
  const rawEnd=noShow?rawStart+.28:dayUse?entryOffset+.92:diffDays(first,effectiveEnd)+.5
  const start=Math.max(0,rawStart),end=Math.min(days.length,rawEnd)
  if(end<=0||start>=days.length||end<=start)return null
  const span=Math.max(noShow ? 0.28 : 0.5,end-start),nights=Math.max(1,diffDays(item.fecha_entrada,effectiveEnd)),kind=planningStage(item),stageLabel=planningStageLabel(item),payment=paymentState(item)
  const showPreview=event=>{if(!resizing)onPreview?.(item,event.currentTarget.getBoundingClientRect())}
  const stayLabel=noShow?`${item.nombre_huesped}, No Show, estadía original ${item.fecha_entrada} a ${item.fecha_salida}`:dayUse?`${item.nombre_huesped}, ${pax} pasajeros, ${channel.label}, ${stageLabel}, ${payment.label}, day use`:group?`${item.nombre_huesped}, ${pax} pasajeros, ${channel.label}, ${stageLabel}, ${payment.label}, ${rooms} habitaciones, ${nights} noches`:`${item.nombre_huesped}, ${pax} pasajeros, ${channel.label}, ${stageLabel}, ${payment.label}, ${nights} noches`
  const paxStyle={height:20,minWidth:26,padding:"0 5px",flex:"0 0 auto",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:2,borderRadius:5,background:"color-mix(in srgb,currentColor 14%,transparent)",fontSize:9,fontWeight:900,lineHeight:1}
  function resizeCandidate(clientX,rowRect,dayWidth){
    const width=Math.max(1,Number(dayWidth)||rowRect.width/days.length),local=clientX-rowRect.left,index=Math.max(0,Math.min(days.length-1,Math.floor(local/width))),candidate=addDays(days[index],1),minimum=addDays(item.fecha_entrada,1)
    return candidate<minimum?minimum:candidate
  }
  function startResize(event){
    if(group||noShow)return
    event.preventDefault();event.stopPropagation();onPreview?.(null)
    const handle=event.currentTarget,stay=handle.parentElement,row=stay?.parentElement,rowRect=row?.getBoundingClientRect?.()
    if(!rowRect)return
    const cssWidth=typeof window!=="undefined"?parseFloat(getComputedStyle(row).getPropertyValue("--day-width")):0,dayWidth=Number.isFinite(cssWidth)&&cssWidth>0?cssWidth:rowRect.width/days.length
    const previousDraggable=stay?.draggable
    if(stay)stay.draggable=false
    try{handle.setPointerCapture?.(event.pointerId)}catch{}
    setResizing(true);resizeValue.current=item.fecha_salida
    const move=pointerEvent=>{const next=resizeCandidate(pointerEvent.clientX,rowRect,dayWidth);resizeValue.current=next;setResizeEnd(next)}
    const cleanup=()=>{
      window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",cancel);window.removeEventListener("blur",cancel)
      if(stay)stay.draggable=Boolean(previousDraggable)
      try{if(handle.hasPointerCapture?.(event.pointerId))handle.releasePointerCapture?.(event.pointerId)}catch{}
    }
    const finish=pointerEvent=>{
      move(pointerEvent);cleanup()
      const next=resizeValue.current;setResizeEnd(null);setResizing(false);resizeValue.current=null
      if(next&&next!==item.fecha_salida)onResizeStart?.(item,next)
    }
    const cancel=()=>{cleanup();setResizeEnd(null);setResizing(false);resizeValue.current=null}
    window.addEventListener("pointermove",move,{passive:true});window.addEventListener("pointerup",finish);window.addEventListener("pointercancel",cancel);window.addEventListener("blur",cancel,{once:true})
  }
  return <div draggable={!group&&!resizing&&!noShow} role="button" tabIndex="0" aria-label={stayLabel} title={noShow?`No Show · estadía original ${item.fecha_entrada} → ${item.fecha_salida} · ${money(item.precio_total,item.moneda)}`:`${channel.label} · ${pax} pax · ${stageLabel} · ${payment.label}`} className={`${c.stay} ${l.stageBar} ${l[kind]} ${selected?c.selected:""}`} style={{left:`calc(${start} * var(--day-width) + 3px)`,width:`calc(${span} * var(--day-width) - 6px)`,minWidth:noShow?8:undefined,transition:resizing?"none":undefined,zIndex:noShow?3:undefined}} onMouseEnter={showPreview} onMouseLeave={()=>onPreview?.(null)} onFocus={showPreview} onBlur={()=>onPreview?.(null)} onClick={()=>{if(resizing)return;onPreview?.(null);onSelect(item)}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onPreview?.(null);onSelect(item)}}} onDragStart={event=>{if(resizing||noShow){event.preventDefault();return}onPreview?.(null);onDragStart(event,item)}}>
    <span className={c.stayContent}>{noShow?<span style={{fontSize:7.5,fontWeight:950,letterSpacing:"-.02em",whiteSpace:"nowrap"}}>NS</span>:<><span style={paxStyle} title={`${pax} pasajero${pax===1?"":"s"}`}>{pax===1?"👤":"👥"}{pax}</span><ReservationChannelLogo value={item.canal_reserva}/><span className={c.stayText}>{settings.showId&&item.numero_reserva?<small>{item.numero_reserva}</small>:null}<b>{item.nombre_huesped}</b></span>{group?<span className={g.barGroupBadge}>{rooms} hab.</span>:settings.showPrice?<span className={c.stayPrice}>{money(item.precio_total,item.moneda)}</span>:null}</>}</span>
    <span className={`${p.paymentStripe} ${p[payment.key]}`} aria-hidden="true"/>
    {!group&&!noShow?<span className={c.resizeHandle} title={resizing?`${nights} noche${nights===1?"":"s"}`:"Cambiar fecha de salida"} aria-label="Cambiar fecha de salida: arrastrá para alargar o acortar" onPointerDown={startResize} onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}>↔</span>:null}
  </div>
}

export function PlanningSettingsMenu({settings,onChange,onClose}){
  return <div className={s.settingsMenu}><div className={s.settingsTitle}><b>Vista del Planning</b><button type="button" onClick={onClose}>×</button></div><label className={s.zoomLabel}><span>Zoom</span><input type="range" min="28" max="62" step="2" value={settings.zoom} onChange={event=>onChange("zoom",Number(event.target.value))}/></label><Toggle label="Vista expandida" value={settings.expanded} onChange={value=>onChange("expanded",value)}/><Toggle label="Mostrar disponibilidad" value={settings.showAvailability} onChange={value=>onChange("showAvailability",value)}/><Toggle label="Mostrar ocupación" value={settings.showOccupancy} onChange={value=>onChange("showOccupancy",value)}/><Toggle label="Mostrar precio" value={settings.showPrice} onChange={value=>onChange("showPrice",value)}/><Toggle label="Mostrar ID de reserva" value={settings.showId} onChange={value=>onChange("showId",value)}/><Toggle label="Mostrar filtros" value={settings.showFilters} onChange={value=>onChange("showFilters",value)}/><Toggle label="Sombrear fines de semana" value={settings.shadeWeekends} onChange={value=>onChange("shadeWeekends",value)}/><Toggle label="Bloquear movimientos diagonales" value={settings.blockDiagonal} onChange={value=>onChange("blockDiagonal",value)}/></div>
}
function Toggle({label,value,onChange}){return <label className={s.settingRow}><span>{label}</span><input type="checkbox" checked={Boolean(value)} onChange={event=>onChange(event.target.checked)}/><i/></label>}
