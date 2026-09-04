"use client"

import{useEffect,useMemo,useState}from"react"
import usePlanningData from"./usePlanningData"
import s from"./planning.module.css"

const DAY=86400000
const pad=value=>String(value).padStart(2,"0")
const keyFromDate=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const addDays=(value,amount)=>keyFromDate(new Date(fromKey(value).getTime()+amount*DAY))
const diffDays=(a,b)=>Math.round((fromKey(b)-fromKey(a))/DAY)
const initials=name=>String(name||"R").trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()
const dayName=value=>new Intl.DateTimeFormat("es-AR",{weekday:"short"}).format(fromKey(value)).replace(".","")
const longDate=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(fromKey(value)).replace(".","")
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const STATUS_CLASS={alojado:"inhouse",confirmada:"confirmed",tentativa:"attention",pendiente:"attention",finalizada:"finished"}
const STATUS_LABEL={alojado:"Alojado",confirmada:"Confirmada",tentativa:"Tentativa",pendiente:"Pendiente",finalizada:"Finalizada"}
const DEFAULT_SETTINGS={zoom:38,expanded:true,showAvailability:true,showOccupancy:false,showPrice:false,showId:false,showFilters:true,shadeWeekends:true,blockDiagonal:false,hideNew:false}
const STEPS=["Fecha","Habitación","Titular","Detalles"]

function monthSegments(days){
  const result=[]
  days.forEach((day,index)=>{
    const date=fromKey(day),key=`${date.getFullYear()}-${date.getMonth()}`
    const previous=result.at(-1)
    if(previous?.key===key)previous.span+=1
    else result.push({key,start:index,span:1,label:new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric"}).format(date)})
  })
  return result
}
function roomHasReservation(item,roomId){return Number(item.habitacion_id)===Number(roomId)||(item.habitaciones_ids||[]).map(Number).includes(Number(roomId))}
function overlaps(item,start,end){return item.fecha_entrada<end&&item.fecha_salida>start}
function coversDay(item,roomId,day){return roomHasReservation(item,roomId)&&item.fecha_entrada<=day&&item.fecha_salida>day}

function ReservationBlock({item,days,selected,onSelect,onDragStart,onResizeStart,settings}){
  const first=days[0],last=addDays(days.at(-1),1)
  if(item.fecha_salida<=first||item.fecha_entrada>=last)return null
  const visibleStart=item.fecha_entrada<first?first:item.fecha_entrada
  const visibleEnd=item.fecha_salida>last?last:item.fecha_salida
  const start=Math.max(0,diffDays(first,visibleStart))
  const span=Math.max(1,diffDays(visibleStart,visibleEnd))
  const nights=Math.max(1,diffDays(item.fecha_entrada,item.fecha_salida))
  const kind=STATUS_CLASS[item.estado]||"confirmed"
  return <div draggable role="button" tabIndex="0" aria-label={`${item.nombre_huesped}, ${nights} noches`} className={`${s.stay} ${s[kind]} ${selected?s.selected:""}`} style={{gridColumn:`${start+1} / span ${span}`,gridRow:1}} onClick={()=>onSelect(item)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(item)}}} onDragStart={event=>onDragStart(event,item)}>
    <span className={s.stayContent}><span className={s.avatar}>{initials(item.nombre_huesped)}</span><span className={s.stayText}>{settings.showId&&item.numero_reserva?<small>{item.numero_reserva}</small>:null}<b>{item.nombre_huesped}</b></span>{settings.showPrice?<span className={s.stayPrice}>{money(item.precio_total,item.moneda)}</span>:null}</span>
    <span className={s.resizeHandle} draggable title="Cambiar fecha de salida" aria-label="Cambiar fecha de salida" onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDragStart={event=>{event.stopPropagation();onResizeStart(event,item)}}>↔</span>
    <div className={s.hoverCard} role="tooltip"><div className={s.hoverTop}><b>{item.nombre_huesped}</b><span>{STATUS_LABEL[item.estado]||item.estado}</span></div>{settings.showId||item.numero_reserva?<p><strong>Reserva</strong> {item.numero_reserva||item.id}</p>:null}<p><strong>Canal</strong> {item.canal_reserva||"Directa"}</p>{item.telefono_huesped?<p><strong>Tel.</strong> {item.telefono_huesped}</p>:null}<div className={s.hoverDates}><span><small>Llegada</small><b>{longDate(item.fecha_entrada)}</b></span><span><small>Salida</small><b>{longDate(item.fecha_salida)}</b></span><span><small>Noches</small><b>{nights}</b></span></div><p><strong>Total</strong> {money(item.precio_total,item.moneda)}</p>{item.notas?<p className={s.hoverNote}><strong>Notas</strong> {item.notas}</p>:null}</div>
  </div>
}

export default function PlanningWorkspace({propertyId,property,onNavigate}){
  const now=new Date(),today=keyFromDate(now)
  const[anchor,setAnchor]=useState(today)
  const[query,setQuery]=useState("")
  const[roomQuery,setRoomQuery]=useState("")
  const[typeFilter,setTypeFilter]=useState("all")
  const[channelFilter,setChannelFilter]=useState("all")
  const[statusFilter,setStatusFilter]=useState("all")
  const[selected,setSelected]=useState(null)
  const[dragging,setDragging]=useState(null)
  const[dropCell,setDropCell]=useState("")
  const[formOpen,setFormOpen]=useState(false)
  const[drawerStep,setDrawerStep]=useState(0)
  const[saving,setSaving]=useState(false)
  const[draft,setDraft]=useState(null)
  const[draftState,setDraftState]=useState("")
  const[hasSavedDraft,setHasSavedDraft]=useState(false)
  const[settings,setSettings]=useState(DEFAULT_SETTINGS)
  const[settingsOpen,setSettingsOpen]=useState(false)
  const[selecting,setSelecting]=useState(false)
  const[rangeSelection,setRangeSelection]=useState(null)

  const days=useMemo(()=>Array.from({length:31},(_,index)=>addDays(anchor,index-2)),[anchor])
  const windowStart=days[0],windowEndExclusive=addDays(days.at(-1),1)
  const data=usePlanningData(propertyId,windowStart,windowEndExclusive)
  const dayWidth=Math.max(28,Math.min(62,Number(settings.zoom)||38))
  const grid={gridTemplateColumns:`repeat(${days.length},${dayWidth}px)`}
  const months=useMemo(()=>monthSegments(days),[days])
  const roomById=useMemo(()=>new Map(data.rooms.map(room=>[Number(room.id),room])),[data.rooms])
  const draftKey=propertyId?`hl:pms-next:reservation-draft:${propertyId}`:""
  const settingsKey=propertyId?`hl:pms-next:planning-settings:${propertyId}`:""
  const roomTypes=useMemo(()=>[...new Set(data.rooms.map(room=>room.tipo||"Sin tipo"))],[data.rooms])
  const channels=useMemo(()=>[...new Set(data.reservations.map(item=>item.canal_reserva||"Directa"))].sort((a,b)=>a.localeCompare(b)),[data.reservations])

  const visibleReservations=useMemo(()=>data.reservations.filter(item=>{
    if(item.no_show)return false
    if(statusFilter!=="all"){
      if(statusFilter==="attention"&&!['tentativa','pendiente'].includes(item.estado))return false
      if(statusFilter!=="attention"&&item.estado!==statusFilter)return false
    }
    if(channelFilter!=="all"&&(item.canal_reserva||"Directa")!==channelFilter)return false
    const term=query.trim().toLowerCase()
    const room=roomById.get(Number(item.habitacion_id))
    return !term||`${item.numero_reserva||item.id} ${item.nombre_huesped} ${room?.nombre||""} ${item.canal_reserva||""}`.toLowerCase().includes(term)
  }),[data.reservations,query,statusFilter,channelFilter,roomById])

  const groups=useMemo(()=>{
    const roomTerm=roomQuery.trim().toLowerCase()
    const filtered=data.rooms.filter(room=>(typeFilter==="all"||(room.tipo||"Sin tipo")===typeFilter)&&(!roomTerm||`${room.nombre} ${room.tipo||""}`.toLowerCase().includes(roomTerm)))
    const map=new Map()
    filtered.forEach(room=>{const type=room.tipo||"Sin tipo";if(!map.has(type))map.set(type,[]);map.get(type).push(room)})
    return[...map.entries()].map(([type,rooms])=>({type,rooms}))
  },[data.rooms,typeFilter,roomQuery])

  useEffect(()=>{
    if(!draftKey)return
    try{setHasSavedDraft(Boolean(window.localStorage.getItem(draftKey)))}catch{}
  },[draftKey])
  useEffect(()=>{
    if(!settingsKey)return
    try{const raw=window.localStorage.getItem(settingsKey);if(raw)setSettings({...DEFAULT_SETTINGS,...JSON.parse(raw)})}catch{}
  },[settingsKey])
  useEffect(()=>{
    if(!settingsKey)return
    try{window.localStorage.setItem(settingsKey,JSON.stringify(settings))}catch{}
  },[settings,settingsKey])
  useEffect(()=>{
    if(!draftKey||!draft)return
    const timer=window.setTimeout(()=>{
      try{window.localStorage.setItem(draftKey,JSON.stringify({...draft,savedAt:new Date().toISOString()}));setHasSavedDraft(true);setDraftState("Borrador guardado automáticamente")}
      catch{setDraftState("No se pudo guardar el borrador en este dispositivo")}
    },220)
    return()=>window.clearTimeout(timer)
  },[draft,draftKey])
  useEffect(()=>{
    if(!selecting)return
    const cancel=()=>{setSelecting(false);setRangeSelection(null)}
    window.addEventListener("mouseup",cancel)
    return()=>window.removeEventListener("mouseup",cancel)
  },[selecting])

  function updateSetting(name,value){setSettings(current=>({...current,[name]:value}))}
  function makeDraft(roomId=data.rooms[0]?.id,start=today,end=addDays(start,1)){
    const room=data.rooms.find(item=>String(item.id)===String(roomId))
    return{firstName:"",lastName:"",email:"",phone:"",roomId:String(roomId||""),start,end,status:"confirmada",guests:1,rate:Number(room?.precio)||0,currency:"ARS",channel:"Directa",notes:""}
  }
  function normalizeDraft(saved){
    const base=makeDraft(saved?.roomId||data.rooms[0]?.id,saved?.start||today,saved?.end||addDays(saved?.start||today,1))
    if(saved?.guest&&!saved.firstName){const parts=String(saved.guest).trim().split(/\s+/);saved={...saved,firstName:parts.shift()||"",lastName:parts.join(" ")}}
    return{...base,...saved}
  }
  function shiftWindow(amount){setAnchor(value=>addDays(value,amount))}
  function jumpToday(){setAnchor(today)}
  function openFreshForm(roomId=data.rooms[0]?.id,start=today,end=addDays(start,1)){
    if(!roomId)return data.setError("Primero configurá al menos una habitación activa.")
    setSelected(null);setDraft(makeDraft(roomId,start,end));setDrawerStep(0);setDraftState("Los cambios se guardan automáticamente en este dispositivo");data.setError("");setFormOpen(true)
  }
  function openNewReservation(){
    if(!data.rooms[0]?.id)return data.setError("Primero configurá al menos una habitación activa.")
    if(draftKey){
      try{const raw=window.localStorage.getItem(draftKey);if(raw){const saved=normalizeDraft(JSON.parse(raw));if(saved?.roomId&&saved?.start&&saved?.end){setDraft(saved);setDrawerStep(0);setDraftState("Borrador recuperado");data.setError("");setFormOpen(true);return}}}catch{}
    }
    openFreshForm()
  }
  function clearDraft(){if(draftKey){try{window.localStorage.removeItem(draftKey)}catch{}}setHasSavedDraft(false);setDraft(null);setDraftState("")}
  function cancelReservation(){clearDraft();setFormOpen(false);setDrawerStep(0);data.setError("")}
  async function saveReservation(){
    const guest=`${draft?.firstName||""} ${draft?.lastName||""}`.trim()
    if(!guest)return data.setError("Ingresá el nombre del huésped.")
    if(draft.end<=draft.start)return data.setError("La salida debe ser posterior a la entrada.")
    setSaving(true)
    try{await data.createReservation({...draft,guest});clearDraft();setFormOpen(false);setDrawerStep(0)}catch(err){data.setError(err?.message||"No se pudo crear la reserva.")}finally{setSaving(false)}
  }
  function nextStep(){
    if(drawerStep===0&&draft.end<=draft.start)return data.setError("La salida debe ser posterior a la entrada.")
    if(drawerStep===1&&!draft.roomId)return data.setError("Elegí una habitación.")
    if(drawerStep===2&&!`${draft.firstName} ${draft.lastName}`.trim())return data.setError("Ingresá el nombre del huésped.")
    data.setError("");setDrawerStep(step=>Math.min(3,step+1))
  }
  function beginDrag(event,item){event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(item.id));setDragging({item,mode:"move"});setSelected(null);setRangeSelection(null)}
  function beginResize(event,item){event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(item.id));setDragging({item,mode:"resize"});setSelected(null);setRangeSelection(null)}
  async function dropReservation(event,roomId,day){
    event.preventDefault();const drag=dragging;if(!drag)return
    const source=drag.item
    let start=day,end,finalRoomId=roomId
    if(drag.mode==="resize"){
      start=source.fecha_entrada;end=addDays(day,1);finalRoomId=source.habitacion_id
      if(end<=start){data.setError("La salida tiene que quedar después de la entrada.");setDragging(null);setDropCell("");return}
    }else{
      const roomChanged=Number(source.habitacion_id)!==Number(roomId),dateChanged=source.fecha_entrada!==day
      if(settings.blockDiagonal&&roomChanged&&dateChanged){data.setError("El movimiento diagonal está bloqueado. Cambiá primero la fecha o la habitación.");setDragging(null);setDropCell("");return}
      const stay=Math.max(1,diffDays(source.fecha_entrada,source.fecha_salida));end=addDays(day,stay)
    }
    setSaving(true);data.setError("")
    try{const updated=await data.moveReservation({reservationId:source.id,roomId:finalRoomId,start,end});setSelected(current=>current?.id===updated.id?updated:current)}
    catch(err){data.setError(err?.message||`No se pudo ${drag.mode==="resize"?"cambiar la duración":"mover la reserva"}.`)}
    finally{setSaving(false);setDragging(null);setDropCell("")}
  }
  function beginRange(event,roomId,day){
    if(event.button!==0||dragging)return
    event.preventDefault();setSelected(null);setRangeSelection({roomId:String(roomId),anchorDay:day,start:day,end:addDays(day,1)});setSelecting(true)
  }
  function extendRange(roomId,day){
    if(!selecting)return
    setRangeSelection(current=>{
      if(!current||String(current.roomId)!==String(roomId))return current
      return day>=current.anchorDay?{...current,start:current.anchorDay,end:addDays(day,1)}:{...current,start:day,end:addDays(current.anchorDay,1)}
    })
  }
  function finishRange(event,roomId){
    if(!selecting||!rangeSelection||String(rangeSelection.roomId)!==String(roomId))return
    event.stopPropagation();const range=rangeSelection;setSelecting(false);setRangeSelection(null);openFreshForm(roomId,range.start,range.end)
  }

  const availableRooms=useMemo(()=>{
    if(!draft)return data.rooms
    return data.rooms.map(room=>({...room,available:!data.reservations.some(item=>roomHasReservation(item,room.id)&&overlaps(item,draft.start,draft.end))}))
  },[data.rooms,data.reservations,draft])
  const nights=draft?Math.max(1,diffDays(draft.start,draft.end)):1
  const total=draft?(Number(draft.rate)||0)*nights:0
  const visibleLabel=`${longDate(days[0])} — ${longDate(days.at(-1))}`

  return <section className={s.page} style={{"--day-width":`${dayWidth}px`,"--room-width":settings.expanded?"190px":"160px"}}>
    <div className={s.toolbar}>
      <div className={s.navCluster}><button className={s.navArrow} onClick={()=>shiftWindow(-7)} aria-label="Semana anterior">‹</button><button className={s.todayButton} onClick={jumpToday}>Hoy</button><button className={s.navArrow} onClick={()=>shiftWindow(7)} aria-label="Semana siguiente">›</button><label className={s.datePicker}><span>{visibleLabel}</span><input type="date" value={anchor} onChange={event=>setAnchor(event.target.value||today)}/></label></div>
      <div className={s.toolbarActions}><label className={s.quickSearch}>⌕<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Huésped o Nº de reserva"/></label><button className={`${s.toolButton} ${settings.showFilters?s.toolActive:""}`} onClick={()=>updateSetting("showFilters",!settings.showFilters)} title="Filtros">▽</button><div className={s.settingsWrap}><button className={`${s.toolButton} ${settingsOpen?s.toolActive:""}`} onClick={()=>setSettingsOpen(value=>!value)} title="Opciones del Planning">⚙</button>{settingsOpen?<div className={s.settingsMenu}><div className={s.settingsTitle}><b>Vista del Planning</b><button onClick={()=>setSettingsOpen(false)}>×</button></div><label className={s.zoomLabel}><span>Zoom</span><input type="range" min="28" max="62" step="2" value={dayWidth} onChange={event=>updateSetting("zoom",Number(event.target.value))}/></label><SettingToggle label="Vista expandida" value={settings.expanded} onChange={value=>updateSetting("expanded",value)}/><SettingToggle label="Mostrar disponibilidad" value={settings.showAvailability} onChange={value=>updateSetting("showAvailability",value)}/><SettingToggle label="Mostrar ocupación" value={settings.showOccupancy} onChange={value=>updateSetting("showOccupancy",value)}/><SettingToggle label="Mostrar precio" value={settings.showPrice} onChange={value=>updateSetting("showPrice",value)}/><SettingToggle label="Mostrar ID de reserva" value={settings.showId} onChange={value=>updateSetting("showId",value)}/><SettingToggle label="Mostrar filtros" value={settings.showFilters} onChange={value=>updateSetting("showFilters",value)}/><SettingToggle label="Sombrear fines de semana" value={settings.shadeWeekends} onChange={value=>updateSetting("shadeWeekends",value)}/><SettingToggle label="Bloquear movimientos diagonales" value={settings.blockDiagonal} onChange={value=>updateSetting("blockDiagonal",value)}/><SettingToggle label="Ocultar botón de reserva" value={settings.hideNew} onChange={value=>updateSetting("hideNew",value)}/></div>:null}</div>{!settings.hideNew?<button className={s.newButton} onClick={openNewReservation}>＋ Nueva reserva{hasSavedDraft?<span className={s.draftDot}/>:null}</button>:null}</div>
    </div>

    {settings.showFilters?<div className={s.filters}><label><span>Habitación</span><input value={roomQuery} onChange={event=>setRoomQuery(event.target.value)} placeholder="Nombre o número"/></label><label><span>Tipo</span><select value={typeFilter} onChange={event=>setTypeFilter(event.target.value)}><option value="all">Todos los tipos</option>{roomTypes.map(type=><option key={type} value={type}>{type}</option>)}</select></label><label><span>Canal</span><select value={channelFilter} onChange={event=>setChannelFilter(event.target.value)}><option value="all">Todos los canales</option>{channels.map(channel=><option key={channel} value={channel}>{channel}</option>)}</select></label><label><span>Estado</span><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="all">Todas las reservas</option><option value="alojado">Alojados</option><option value="confirmada">Confirmadas</option><option value="attention">Pendientes / tentativas</option><option value="finalizada">Finalizadas</option></select></label></div>:null}

    {data.error&&<div className={s.error}>{data.error}</div>}
    {saving&&<div className={s.savingBar}>Guardando cambios…</div>}
    {data.loading?<div className={s.error}>Cargando Planning…</div>:!data.rooms.length?<div className={s.error}>No hay habitaciones activas. Configuralas en Propiedad antes de operar el Planning.</div>:<div className={s.calendar}>
      <div className={s.monthRow}><div className={s.corner}><span>{property?.name||"Propiedad activa"}</span></div><div className={s.months} style={grid}>{months.map(segment=><div key={segment.key} style={{gridColumn:`${segment.start+1} / span ${segment.span}`}}>{segment.label}</div>)}</div></div>
      <div className={s.dayRow}><div className={s.roomHead}>Habitación</div><div className={s.days} style={grid}>{days.map(day=>{const weekend=[0,6].includes(fromKey(day).getDay());return <div key={day} className={`${day===today?s.todayHead:""} ${settings.shadeWeekends&&weekend?s.weekendHead:""}`}><small>{dayName(day)}</small><b>{fromKey(day).getDate()}</b></div>})}</div></div>
      {groups.map(group=><div className={s.group} key={group.type}>
        <div className={s.groupRow}><div className={s.groupTitle}><b>{group.type}</b><small>{group.rooms.length} hab.</small></div><div className={s.availability} style={grid}>{days.map(day=>{const occupied=group.rooms.filter(room=>visibleReservations.some(item=>coversDay(item,room.id,day))).length,available=Math.max(0,group.rooms.length-occupied),pct=group.rooms.length?Math.round(occupied/group.rooms.length*100):0;return <div key={day} className={`${available===0?s.soldOut:""} ${settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay())?s.weekendCell:""}`}>{settings.showAvailability?<b>{available}</b>:null}{settings.showOccupancy?<small>{pct}%</small>:null}</div>})}</div></div>
        {group.rooms.map(room=>{const roomReservations=visibleReservations.filter(item=>roomHasReservation(item,room.id));return <div className={s.roomRow} key={room.id}><button className={s.room} onClick={()=>openFreshForm(room.id,today)}><span><b>{room.nombre}</b><small>{room.capacidad||1} pax</small></span>{room.estado==="mantenimiento"?<span className={s.maintenance}>!</span>:null}</button><div className={s.grid} style={grid}>{days.map(day=>{const dropKey=`${room.id}-${day}`,weekend=settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay()),range=rangeSelection&&String(rangeSelection.roomId)===String(room.id)&&day>=rangeSelection.start&&day<rangeSelection.end;return <button key={day} style={{gridRow:1}} className={`${s.cell} ${day===today?s.todayCell:""} ${weekend?s.weekendCell:""} ${dropCell===dropKey?s.dropTarget:""} ${range?s.rangeCell:""}`} aria-label={`${room.nombre} ${day}`} onMouseDown={event=>beginRange(event,room.id,day)} onMouseEnter={()=>extendRange(room.id,day)} onMouseUp={event=>finishRange(event,room.id)} onDragEnter={()=>dragging&&setDropCell(dropKey)} onDragOver={event=>{if(dragging){event.preventDefault();event.dataTransfer.dropEffect="move"}}} onDragLeave={()=>dropCell===dropKey&&setDropCell("")} onDrop={event=>dropReservation(event,room.id,day)}/>})}{roomReservations.map(item=><ReservationBlock key={`${room.id}-${item.id}`} item={item} days={days} selected={selected?.id===item.id} onSelect={item=>{setFormOpen(false);setSelected(item)}} onDragStart={beginDrag} onResizeStart={beginResize} settings={settings}/>)}</div></div>})}
      </div>)}
      {!groups.length?<div className={s.noResults}>No hay habitaciones que coincidan con los filtros.</div>:null}
    </div>}

    {selected&&!formOpen?<aside className={s.detailDrawer}><header><div><small>{selected.canal_reserva||"Directa"} · {selected.numero_reserva||selected.id}</small><h2>{selected.nombre_huesped}</h2><p>Habitación {roomById.get(Number(selected.habitacion_id))?.nombre||"—"}</p></div><button className={s.close} onClick={()=>setSelected(null)}>×</button></header><div className={s.detailGrid}><div><small>Llegada</small><b>{longDate(selected.fecha_entrada)}</b></div><div><small>Salida</small><b>{longDate(selected.fecha_salida)}</b></div><div><small>Noches</small><b>{Math.max(1,diffDays(selected.fecha_entrada,selected.fecha_salida))}</b></div><div><small>Estado</small><b>{STATUS_LABEL[selected.estado]||selected.estado}</b></div><div><small>Huéspedes</small><b>{selected.cantidad_huespedes||1}</b></div><div><small>Total</small><b>{money(selected.precio_total,selected.moneda)}</b></div></div>{selected.telefono_huesped||selected.email_huesped?<div className={s.contactBlock}>{selected.telefono_huesped?<p><small>Teléfono</small><b>{selected.telefono_huesped}</b></p>:null}{selected.email_huesped?<p><small>Email</small><b>{selected.email_huesped}</b></p>:null}</div>:null}{selected.notas?<div className={s.noteBlock}><small>Notas</small><p>{selected.notas}</p></div>:null}<footer><button onClick={()=>setSelected(null)}>Cerrar</button><button className={s.primary} onClick={()=>onNavigate?.("reservations",{reservationId:selected.id})}>Abrir reserva</button></footer></aside>:null}

    {formOpen&&draft?<div className={s.drawerShade} onMouseDown={event=>event.target===event.currentTarget&&setFormOpen(false)}><aside className={s.createDrawer} role="dialog" aria-modal="true" aria-label="Crear reserva"><header className={s.drawerHeader}><div><small>CREAR RESERVA</small><h2>{drawerStep===0?"Elegí las fechas":drawerStep===1?"Seleccioná habitación":drawerStep===2?"Datos del titular":"Revisá la reserva"}</h2><p>{draftState}</p></div><button className={s.close} onClick={()=>setFormOpen(false)}>×</button></header><nav className={s.stepNav}>{STEPS.map((step,index)=><button key={step} className={index===drawerStep?s.stepActive:index<drawerStep?s.stepDone:""} onClick={()=>index<=drawerStep&&setDrawerStep(index)}><span>{index+1}</span>{step}</button>)}</nav><div className={s.drawerBody}>
      {drawerStep===0?<div className={s.stepPanel}><div className={s.dateSummary}><span><small>Entrada</small><b>{longDate(draft.start)}</b></span><span className={s.nightsBadge}>{nights} noche{nights===1?"":"s"}</span><span><small>Salida</small><b>{longDate(draft.end)}</b></span></div><div className={s.formGrid}><label>Entrada<input type="date" value={draft.start} onChange={event=>setDraft(current=>({...current,start:event.target.value,end:current.end<=event.target.value?addDays(event.target.value,1):current.end}))}/></label><label>Salida<input type="date" min={addDays(draft.start,1)} value={draft.end} onChange={event=>setDraft(current=>({...current,end:event.target.value}))}/></label><label>Huéspedes<input type="number" min="1" value={draft.guests} onChange={event=>setDraft(current=>({...current,guests:Number(event.target.value)||1}))}/></label><label>Moneda<select value={draft.currency} onChange={event=>setDraft(current=>({...current,currency:event.target.value}))}><option value="ARS">ARS</option><option value="USD">USD</option></select></label></div><p className={s.stepHelp}>También podés marcar un rango directamente sobre una fila del Planning: arrastrá desde la entrada hasta la salida.</p></div>:null}
      {drawerStep===1?<div className={s.stepPanel}><div className={s.roomOptions}>{availableRooms.map(room=><button key={room.id} disabled={!room.available||room.estado==="mantenimiento"} className={`${s.roomOption} ${String(draft.roomId)===String(room.id)?s.roomOptionActive:""}`} onClick={()=>setDraft(current=>({...current,roomId:String(room.id),rate:Number(room.precio)||current.rate}))}><span><small>{room.tipo||"Sin tipo"}</small><b>{room.nombre}</b><em>{room.capacidad||1} pax · {room.available?"Disponible":"Ocupada"}</em></span><strong>{money(room.precio,draft.currency)}<small>/ noche</small></strong></button>)}</div><label className={s.rateField}>Tarifa por noche<input type="number" min="0" value={draft.rate} onChange={event=>setDraft(current=>({...current,rate:Number(event.target.value)||0}))}/></label></div>:null}
      {drawerStep===2?<div className={s.stepPanel}><div className={s.formGrid}><label>Nombre<input value={draft.firstName} onChange={event=>setDraft(current=>({...current,firstName:event.target.value}))} autoFocus/></label><label>Apellido<input value={draft.lastName} onChange={event=>setDraft(current=>({...current,lastName:event.target.value}))}/></label><label>Teléfono<input value={draft.phone} onChange={event=>setDraft(current=>({...current,phone:event.target.value}))} placeholder="11 0000 0000"/></label><label>Email<input type="email" value={draft.email} onChange={event=>setDraft(current=>({...current,email:event.target.value}))} placeholder="huesped@email.com"/></label></div></div>:null}
      {drawerStep===3?<div className={s.stepPanel}><div className={s.review}><div><small>Estadía</small><b>{longDate(draft.start)} — {longDate(draft.end)}</b><span>{nights} noche{nights===1?"":"s"}</span></div><div><small>Habitación</small><b>{roomById.get(Number(draft.roomId))?.nombre||"—"}</b><span>{roomById.get(Number(draft.roomId))?.tipo||""}</span></div><div><small>Titular</small><b>{`${draft.firstName} ${draft.lastName}`.trim()||"Sin completar"}</b><span>{draft.phone||draft.email||"Sin contacto"}</span></div><div><small>Total</small><b>{money(total,draft.currency)}</b><span>{money(draft.rate,draft.currency)} × {nights}</span></div></div><div className={s.formGrid}><label>Canal<select value={draft.channel} onChange={event=>setDraft(current=>({...current,channel:event.target.value}))}><option>Directa</option><option>Motor</option><option>Booking.com</option><option>Expedia</option><option>Despegar</option><option>Airbnb</option><option>Agencia</option></select></label><label>Estado<select value={draft.status} onChange={event=>setDraft(current=>({...current,status:event.target.value}))}><option value="confirmada">Confirmada</option><option value="pendiente">Pendiente</option><option value="tentativa">Tentativa</option></select></label><label className={s.fullField}>Notas<textarea rows="4" value={draft.notes} onChange={event=>setDraft(current=>({...current,notes:event.target.value}))} placeholder="Pedidos, observaciones o información interna"/></label></div></div>:null}
    </div><footer className={s.drawerFooter}><div><button className={s.dangerLink} onClick={cancelReservation}>Descartar</button>{drawerStep>0?<button onClick={()=>setDrawerStep(step=>Math.max(0,step-1))}>Atrás</button>:null}</div><div className={s.totalFooter}><span><small>Total</small><b>{money(total,draft.currency)}</b></span>{drawerStep<3?<button className={s.primary} onClick={nextStep}>Continuar</button>:<button className={s.primary} disabled={saving} onClick={saveReservation}>{saving?"Creando…":"Crear reserva"}</button>}</div></footer></aside></div>:null}
  </section>
}

function SettingToggle({label,value,onChange}){return <label className={s.settingRow}><span>{label}</span><input type="checkbox" checked={Boolean(value)} onChange={event=>onChange(event.target.checked)}/><i/></label>}
