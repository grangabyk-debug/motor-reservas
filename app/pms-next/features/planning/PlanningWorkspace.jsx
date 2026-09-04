"use client"

import{useEffect,useMemo,useState}from"react"
import usePlanningData from"./usePlanningData"
import{PlanningSettingsMenu,ReservationBlock}from"./PlanningPieces"
import{CreateReservationDrawer,ReservationDetailDrawer}from"./PlanningDrawers"
import s from"./planning.module.css"

const DAY=86400000
const pad=value=>String(value).padStart(2,"0")
const keyFromDate=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const addDays=(value,amount)=>keyFromDate(new Date(fromKey(value).getTime()+amount*DAY))
const diffDays=(a,b)=>Math.round((fromKey(b)-fromKey(a))/DAY)
const dayName=value=>new Intl.DateTimeFormat("es-AR",{weekday:"short"}).format(fromKey(value)).replace(".","")
const shortDate=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(fromKey(value)).replace(".","")
const DEFAULT_SETTINGS={zoom:38,expanded:true,showAvailability:true,showOccupancy:false,showPrice:false,showId:false,showFilters:true,shadeWeekends:true,blockDiagonal:false,hideNew:false}
const roomHas=(item,roomId)=>Number(item.habitacion_id)===Number(roomId)||(item.habitaciones_ids||[]).map(Number).includes(Number(roomId))
const overlaps=(item,start,end)=>item.fecha_entrada<end&&item.fecha_salida>start
const covers=(item,roomId,day)=>roomHas(item,roomId)&&item.fecha_entrada<=day&&item.fecha_salida>day

function monthSegments(days){const result=[];days.forEach((day,index)=>{const date=fromKey(day),key=`${date.getFullYear()}-${date.getMonth()}`,previous=result.at(-1);if(previous?.key===key)previous.span++;else result.push({key,start:index,span:1,label:new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric"}).format(date)})});return result}

export default function PlanningWorkspace({propertyId,property,onNavigate}){
  const today=keyFromDate(new Date())
  const[anchor,setAnchor]=useState(today),[query,setQuery]=useState(""),[roomQuery,setRoomQuery]=useState(""),[typeFilter,setTypeFilter]=useState("all"),[channelFilter,setChannelFilter]=useState("all"),[statusFilter,setStatusFilter]=useState("all")
  const[selected,setSelected]=useState(null),[dragging,setDragging]=useState(null),[dropCell,setDropCell]=useState(""),[saving,setSaving]=useState(false)
  const[formOpen,setFormOpen]=useState(false),[drawerStep,setDrawerStep]=useState(0),[draft,setDraft]=useState(null),[draftState,setDraftState]=useState(""),[hasSavedDraft,setHasSavedDraft]=useState(false)
  const[settings,setSettings]=useState(DEFAULT_SETTINGS),[settingsOpen,setSettingsOpen]=useState(false),[selecting,setSelecting]=useState(false),[rangeSelection,setRangeSelection]=useState(null)

  const days=useMemo(()=>Array.from({length:31},(_,index)=>addDays(anchor,index-2)),[anchor]),windowStart=days[0],windowEndExclusive=addDays(days.at(-1),1)
  const data=usePlanningData(propertyId,windowStart,windowEndExclusive),dayWidth=Math.max(28,Math.min(62,Number(settings.zoom)||38)),grid={gridTemplateColumns:`repeat(${days.length},${dayWidth}px)`}
  const months=useMemo(()=>monthSegments(days),[days]),roomById=useMemo(()=>new Map(data.rooms.map(room=>[Number(room.id),room])),[data.rooms])
  const draftKey=propertyId?`hl:pms-next:reservation-draft:${propertyId}`:"",settingsKey=propertyId?`hl:pms-next:planning-settings:${propertyId}`:""
  const roomTypes=useMemo(()=>[...new Set(data.rooms.map(room=>room.tipo||"Sin tipo"))],[data.rooms]),channels=useMemo(()=>[...new Set(data.reservations.map(item=>item.canal_reserva||"Directa"))].sort(),[data.reservations])
  const availabilityReservations=useMemo(()=>data.reservations.filter(item=>!item.no_show),[data.reservations])

  const visibleReservations=useMemo(()=>data.reservations.filter(item=>{
    if(item.no_show)return false
    if(statusFilter!=="all"&&!(statusFilter==="attention"?['tentativa','pendiente'].includes(item.estado):item.estado===statusFilter))return false
    if(channelFilter!=="all"&&(item.canal_reserva||"Directa")!==channelFilter)return false
    const term=query.trim().toLowerCase(),room=roomById.get(Number(item.habitacion_id))
    return !term||`${item.numero_reserva||item.id} ${item.nombre_huesped} ${room?.nombre||""} ${item.canal_reserva||""}`.toLowerCase().includes(term)
  }),[data.reservations,statusFilter,channelFilter,query,roomById])

  const groups=useMemo(()=>{
    const term=roomQuery.trim().toLowerCase(),map=new Map()
    data.rooms.filter(room=>(typeFilter==="all"||(room.tipo||"Sin tipo")===typeFilter)&&(!term||`${room.nombre} ${room.tipo||""}`.toLowerCase().includes(term))).forEach(room=>{const type=room.tipo||"Sin tipo";if(!map.has(type))map.set(type,[]);map.get(type).push(room)})
    return[...map.entries()].map(([type,rooms])=>({type,rooms}))
  },[data.rooms,typeFilter,roomQuery])

  useEffect(()=>{if(draftKey)try{setHasSavedDraft(Boolean(localStorage.getItem(draftKey)))}catch{}},[draftKey])
  useEffect(()=>{if(settingsKey)try{const raw=localStorage.getItem(settingsKey);if(raw)setSettings({...DEFAULT_SETTINGS,...JSON.parse(raw)})}catch{}},[settingsKey])
  useEffect(()=>{if(settingsKey)try{localStorage.setItem(settingsKey,JSON.stringify(settings))}catch{}},[settings,settingsKey])
  useEffect(()=>{if(!draftKey||!draft)return;const timer=setTimeout(()=>{try{localStorage.setItem(draftKey,JSON.stringify({...draft,savedAt:new Date().toISOString()}));setHasSavedDraft(true);setDraftState("Borrador guardado automáticamente")}catch{setDraftState("No se pudo guardar el borrador")}},220);return()=>clearTimeout(timer)},[draft,draftKey])

  function changeSetting(name,value){setSettings(current=>({...current,[name]:value}))}
  function makeDraft(roomId=data.rooms[0]?.id,start=today,end=addDays(start,1)){const room=data.rooms.find(item=>String(item.id)===String(roomId));return{firstName:"",lastName:"",email:"",phone:"",roomId:String(roomId||""),start,end,status:"confirmada",guests:1,rate:Number(room?.precio)||0,currency:"ARS",channel:"Directa",notes:""}}
  function normalizeDraft(saved){const base=makeDraft(saved?.roomId||data.rooms[0]?.id,saved?.start||today,saved?.end||addDays(saved?.start||today,1));if(saved?.guest&&!saved.firstName){const parts=String(saved.guest).trim().split(/\s+/);saved={...saved,firstName:parts.shift()||"",lastName:parts.join(" ")}}return{...base,...saved}}
  function openFreshForm(roomId=data.rooms[0]?.id,start=today,end=addDays(start,1)){if(!roomId)return data.setError("Primero configurá una habitación activa.");setSelected(null);setRangeSelection(null);setDraft(makeDraft(roomId,start,end));setDrawerStep(0);setDraftState("Los cambios se guardan automáticamente en este dispositivo");data.setError("");setFormOpen(true)}
  function openNewReservation(){if(!data.rooms[0]?.id)return data.setError("Primero configurá una habitación activa.");if(draftKey)try{const raw=localStorage.getItem(draftKey);if(raw){const saved=normalizeDraft(JSON.parse(raw));if(saved.roomId&&saved.start&&saved.end){setDraft(saved);setDrawerStep(0);setDraftState("Borrador recuperado");setFormOpen(true);return}}}catch{}openFreshForm()}
  function clearDraft(){if(draftKey)try{localStorage.removeItem(draftKey)}catch{}setHasSavedDraft(false);setDraft(null);setDraftState("")}
  function discardDraft(){clearDraft();setFormOpen(false);setDrawerStep(0);data.setError("")}
  function nextStep(){if(drawerStep===0&&draft.end<=draft.start)return data.setError("La salida debe ser posterior a la entrada.");if(drawerStep===1&&!draft.roomId)return data.setError("Elegí una habitación.");if(drawerStep===2&&!`${draft.firstName} ${draft.lastName}`.trim())return data.setError("Ingresá el nombre del huésped.");data.setError("");setDrawerStep(step=>Math.min(3,step+1))}
  async function saveReservation(){const guest=`${draft?.firstName||""} ${draft?.lastName||""}`.trim();if(!guest)return data.setError("Ingresá el nombre del huésped.");setSaving(true);try{await data.createReservation({...draft,guest});clearDraft();setFormOpen(false);setDrawerStep(0)}catch(err){data.setError(err?.message||"No se pudo crear la reserva.")}finally{setSaving(false)}}

  function beginDrag(event,item){event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(item.id));setDragging({item,mode:"move"});setSelected(null);setRangeSelection(null)}
  function beginResize(event,item){event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(item.id));setDragging({item,mode:"resize"});setSelected(null);setRangeSelection(null)}
  async function dropReservation(event,roomId,day){
    event.preventDefault();if(!dragging)return
    const source=dragging.item;let start=day,end,finalRoomId=roomId
    if(dragging.mode==="resize"){start=source.fecha_entrada;end=addDays(day,1);finalRoomId=source.habitacion_id;if(end<=start){data.setError("La salida tiene que quedar después de la entrada.");setDragging(null);setDropCell("");return}}
    else{const roomChanged=Number(source.habitacion_id)!==Number(roomId),dateChanged=source.fecha_entrada!==day;if(settings.blockDiagonal&&roomChanged&&dateChanged){data.setError("El movimiento diagonal está bloqueado. Cambiá primero fecha o habitación.");setDragging(null);setDropCell("");return}end=addDays(day,Math.max(1,diffDays(source.fecha_entrada,source.fecha_salida)))}
    setSaving(true);data.setError("");try{await data.moveReservation({reservationId:source.id,roomId:finalRoomId,start,end})}catch(err){data.setError(err?.message||"No se pudo mover la reserva.")}finally{setSaving(false);setDragging(null);setDropCell("")}
  }
  function beginRange(event,roomId,day){if(event.button!==0||dragging)return;event.preventDefault();setSelected(null);setRangeSelection({roomId:String(roomId),anchorDay:day,start:day,end:addDays(day,1)});setSelecting(true)}
  function extendRange(roomId,day){if(!selecting)return;setRangeSelection(current=>!current||String(current.roomId)!==String(roomId)?current:day>=current.anchorDay?{...current,start:current.anchorDay,end:addDays(day,1)}:{...current,start:day,end:addDays(current.anchorDay,1)})}
  function finishRange(event,roomId){if(!selecting||!rangeSelection||String(rangeSelection.roomId)!==String(roomId))return;event.stopPropagation();setSelecting(false)}
  function confirmRange(){if(!rangeSelection)return;const{roomId,start,end}=rangeSelection;openFreshForm(roomId,start,end)}
  function cancelRange(){setSelecting(false);setRangeSelection(null)}

  const availableRooms=useMemo(()=>draft?data.rooms.map(room=>({...room,available:!availabilityReservations.some(item=>roomHas(item,room.id)&&overlaps(item,draft.start,draft.end))})):data.rooms,[data.rooms,availabilityReservations,draft])
  const nights=draft?Math.max(1,diffDays(draft.start,draft.end)):1,total=draft?(Number(draft.rate)||0)*nights:0,visibleLabel=`${shortDate(days[0])} — ${shortDate(days.at(-1))}`

  return <section className={s.page} style={{"--day-width":`${dayWidth}px`,"--room-width":settings.expanded?"190px":"160px"}}>
    <div className={s.toolbar}><div className={s.navCluster}><button className={s.navArrow} onClick={()=>setAnchor(value=>addDays(value,-7))}>‹</button><button className={s.todayButton} onClick={()=>setAnchor(today)}>Hoy</button><button className={s.navArrow} onClick={()=>setAnchor(value=>addDays(value,7))}>›</button><label className={s.datePicker}><span>{visibleLabel}</span><input type="date" value={anchor} onChange={event=>setAnchor(event.target.value||today)}/></label></div><div className={s.toolbarActions}><label className={s.quickSearch}>⌕<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Huésped o Nº de reserva"/></label><button className={`${s.toolButton} ${settings.showFilters?s.toolActive:""}`} onClick={()=>changeSetting("showFilters",!settings.showFilters)} title="Filtros">▽</button><div className={s.settingsWrap}><button className={`${s.toolButton} ${settingsOpen?s.toolActive:""}`} onClick={()=>setSettingsOpen(value=>!value)}>⚙</button>{settingsOpen?<PlanningSettingsMenu settings={settings} onChange={changeSetting} onClose={()=>setSettingsOpen(false)}/>:null}</div>{!settings.hideNew?<button className={s.newButton} onClick={openNewReservation}>＋ Nueva reserva{hasSavedDraft?<span className={s.draftDot}/>:null}</button>:null}</div></div>
    {settings.showFilters?<div className={s.filters}><label><span>Habitación</span><input value={roomQuery} onChange={event=>setRoomQuery(event.target.value)} placeholder="Nombre o número"/></label><label><span>Tipo</span><select value={typeFilter} onChange={event=>setTypeFilter(event.target.value)}><option value="all">Todos los tipos</option>{roomTypes.map(type=><option key={type}>{type}</option>)}</select></label><label><span>Canal</span><select value={channelFilter} onChange={event=>setChannelFilter(event.target.value)}><option value="all">Todos los canales</option>{channels.map(channel=><option key={channel}>{channel}</option>)}</select></label><label><span>Estado</span><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="all">Todas</option><option value="alojado">Alojados</option><option value="confirmada">Confirmadas</option><option value="attention">Pendientes / tentativas</option><option value="finalizada">Finalizadas</option></select></label></div>:null}
    {data.error?<div className={s.error}>{data.error}</div>:null}{saving?<div className={s.savingBar}>Guardando cambios…</div>:null}
    {data.loading?<div className={s.error}>Cargando Planning…</div>:!data.rooms.length?<div className={s.error}>No hay habitaciones activas.</div>:<div className={s.calendar}><div className={s.monthRow}><div className={s.corner}><span>{property?.name||"Propiedad activa"}</span></div><div className={s.months} style={grid}>{months.map(segment=><div key={segment.key} style={{gridColumn:`${segment.start+1} / span ${segment.span}`}}>{segment.label}</div>)}</div></div><div className={s.dayRow}><div className={s.roomHead}>Habitación</div><div className={s.days} style={grid}>{days.map(day=>{const weekend=[0,6].includes(fromKey(day).getDay());return <div key={day} className={`${day===today?s.todayHead:""} ${settings.shadeWeekends&&weekend?s.weekendHead:""}`}><small>{dayName(day)}</small><b>{fromKey(day).getDate()}</b></div>})}</div></div>
      {groups.map(group=><div className={s.group} key={group.type}><div className={s.groupRow}><div className={s.groupTitle}><b>{group.type}</b><small>{group.rooms.length} hab.</small></div><div className={s.availability} style={grid}>{days.map(day=>{const occupied=group.rooms.filter(room=>availabilityReservations.some(item=>covers(item,room.id,day))).length,available=Math.max(0,group.rooms.length-occupied),pct=group.rooms.length?Math.round(occupied/group.rooms.length*100):0;return <div key={day} className={`${available===0?s.soldOut:""} ${settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay())?s.weekendCell:""}`}>{settings.showAvailability?<b>{available}</b>:null}{settings.showOccupancy?<small>{pct}%</small>:null}</div>})}</div></div>{group.rooms.map(room=><RoomRow key={room.id} room={room} days={days} grid={grid} today={today} settings={settings} visibleReservations={visibleReservations} dragging={dragging} dropCell={dropCell} rangeSelection={rangeSelection} selected={selected} onRoom={()=>openFreshForm(room.id,today)} onBeginRange={beginRange} onExtendRange={extendRange} onFinishRange={finishRange} onConfirmRange={confirmRange} onCancelRange={cancelRange} onDropCell={setDropCell} onDrop={dropReservation} onSelect={item=>{setFormOpen(false);setSelected(item)}} onDrag={beginDrag} onResize={beginResize}/>)}</div>)}{!groups.length?<div className={s.noResults}>No hay habitaciones que coincidan con los filtros.</div>:null}</div>}
    {selected&&!formOpen?<ReservationDetailDrawer selected={selected} room={roomById.get(Number(selected.habitacion_id))} onClose={()=>setSelected(null)} onOpen={()=>onNavigate?.("reservations",{reservationId:selected.id})}/>:null}
    {formOpen&&draft?<CreateReservationDrawer draft={draft} setDraft={setDraft} drawerStep={drawerStep} setDrawerStep={setDrawerStep} draftState={draftState} availableRooms={availableRooms} roomById={roomById} nights={nights} total={total} saving={saving} onClose={()=>setFormOpen(false)} onDiscard={discardDraft} onNext={nextStep} onSave={saveReservation}/>:null}
  </section>
}

function RoomRow({room,days,grid,today,settings,visibleReservations,dragging,dropCell,rangeSelection,selected,onRoom,onBeginRange,onExtendRange,onFinishRange,onConfirmRange,onCancelRange,onDropCell,onDrop,onSelect,onDrag,onResize}){
  const reservations=visibleReservations.filter(item=>roomHas(item,room.id)),activeRange=rangeSelection&&String(rangeSelection.roomId)===String(room.id)
  const lastSelected=activeRange?addDays(rangeSelection.end,-1):null,actionColumn=lastSelected?Math.max(1,days.indexOf(lastSelected)+1):1
  return <div className={s.roomRow}><button className={s.room} onClick={onRoom}><span><b>{room.nombre}</b><small>{room.capacidad||1} pax</small></span>{room.estado==="mantenimiento"?<span className={s.maintenance}>!</span>:null}</button><div className={s.grid} style={grid}>{days.map(day=>{const key=`${room.id}-${day}`,weekend=settings.shadeWeekends&&[0,6].includes(fromKey(day).getDay()),range=activeRange&&day>=rangeSelection.start&&day<rangeSelection.end;return <button key={day} style={{gridRow:1}} className={`${s.cell} ${day===today?s.todayCell:""} ${weekend?s.weekendCell:""} ${dropCell===key?s.dropTarget:""} ${range?s.rangeCell:""}`} onMouseDown={event=>onBeginRange(event,room.id,day)} onMouseEnter={()=>onExtendRange(room.id,day)} onMouseUp={event=>onFinishRange(event,room.id)} onDragEnter={()=>dragging&&onDropCell(key)} onDragOver={event=>{if(dragging){event.preventDefault();event.dataTransfer.dropEffect="move"}}} onDragLeave={()=>dropCell===key&&onDropCell("")} onDrop={event=>onDrop(event,room.id,day)}/>})}{reservations.map(item=><ReservationBlock key={`${room.id}-${item.id}`} item={item} days={days} selected={selected?.id===item.id} onSelect={onSelect} onDragStart={onDrag} onResizeStart={onResize} settings={settings}/>)}{activeRange&&!selecting?<div style={{gridColumn:actionColumn,gridRow:1,zIndex:32,alignSelf:"center",justifySelf:"end",display:"flex",gap:4,transform:"translateX(30px)"}}><button type="button" title="Cancelar selección" onClick={event=>{event.stopPropagation();onCancelRange()}} style={{width:27,height:27,border:0,borderRadius:6,background:"#d94f61",color:"#fff",fontWeight:900,cursor:"pointer",boxShadow:"0 5px 14px rgba(0,0,0,.16)"}}>×</button><button type="button" title="Crear reserva en este rango" onClick={event=>{event.stopPropagation();onConfirmRange()}} style={{width:32,height:27,border:0,borderRadius:6,background:"#35b86b",color:"#fff",fontWeight:900,cursor:"pointer",boxShadow:"0 5px 14px rgba(0,0,0,.16)"}}>✓</button></div>:null}</div></div>
}
