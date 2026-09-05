"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import usePlanningData from"./usePlanningData"
import{PlanningSettingsMenu}from"./PlanningPieces"
import PlanningCalendar from"./PlanningCalendar"
import ReservationPreview from"./ReservationPreview"
import{CreateReservationDrawer,ReservationDetailDrawer}from"./PlanningDrawers"
import{planningStage}from"./planningLifecycle"
import PmsIcon from"../../components/shell/PmsIcons"
import s from"./planning.module.css"
import controls from"./planningControls.module.css"

const DAY=86400000
const pad=value=>String(value).padStart(2,"0")
const keyFromDate=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const addDays=(value,amount)=>keyFromDate(new Date(fromKey(value).getTime()+amount*DAY))
const diffDays=(a,b)=>Math.round((fromKey(b)-fromKey(a))/DAY)
const shortDate=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(fromKey(value)).replace(".","")
const DEFAULT_SETTINGS={zoom:38,expanded:true,showAvailability:true,showOccupancy:false,showPrice:false,showId:false,showFilters:true,shadeWeekends:true,blockDiagonal:false}
const roomHas=(item,roomId)=>Number(item.habitacion_id)===Number(roomId)||(item.habitaciones_ids||[]).map(Number).includes(Number(roomId))
const overlaps=(item,start,end)=>item.fecha_entrada<end&&item.fecha_salida>start
const uniqueIds=values=>[...new Set((values||[]).filter(Boolean).map(value=>String(value)))]

export default function PlanningWorkspace({propertyId,property,onNavigate,newReservationRequest=0}){
  const today=keyFromDate(new Date())
  const[anchor,setAnchor]=useState(today),[query,setQuery]=useState(""),[roomQuery,setRoomQuery]=useState(""),[typeFilter,setTypeFilter]=useState("all"),[channelFilter,setChannelFilter]=useState("all"),[statusFilter,setStatusFilter]=useState("all")
  const[selected,setSelected]=useState(null),[preview,setPreview]=useState(null),[dragging,setDragging]=useState(null),[dropCell,setDropCell]=useState(""),[saving,setSaving]=useState(false)
  const[formOpen,setFormOpen]=useState(false),[drawerStep,setDrawerStep]=useState(0),[draft,setDraft]=useState(null),[draftState,setDraftState]=useState(""),[,setHasSavedDraft]=useState(false),[formError,setFormError]=useState("")
  const[settings,setSettings]=useState(DEFAULT_SETTINGS),[settingsOpen,setSettingsOpen]=useState(false),[selecting,setSelecting]=useState(false),[rangeSelection,setRangeSelection]=useState(null)
  const lastNewReservationRequest=useRef(0),formErrorTimer=useRef(null)

  const days=useMemo(()=>Array.from({length:31},(_,index)=>addDays(anchor,index-2)),[anchor]),windowStart=days[0],windowEndExclusive=addDays(days.at(-1),1)
  const data=usePlanningData(propertyId,windowStart,windowEndExclusive),dayWidth=Math.max(28,Math.min(62,Number(settings.zoom)||38))
  const roomById=useMemo(()=>new Map(data.rooms.map(room=>[Number(room.id),room])),[data.rooms])
  const draftKey=propertyId?`hl:pms-next:reservation-draft:${propertyId}`:"",settingsKey=propertyId?`hl:pms-next:planning-settings:${propertyId}`:""
  const roomTypes=useMemo(()=>[...new Set(data.rooms.map(room=>room.tipo||"Sin tipo"))].sort(),[data.rooms]),channels=useMemo(()=>[...new Set(data.reservations.map(item=>item.canal_reserva||"Walk-in"))].sort(),[data.reservations])
  const availabilityReservations=useMemo(()=>data.reservations.filter(item=>!item.no_show),[data.reservations])

  const visibleRooms=useMemo(()=>{
    const term=roomQuery.trim().toLowerCase()
    return data.rooms.filter(room=>(typeFilter==="all"||(room.tipo||"Sin tipo")===typeFilter)&&(!term||`${room.nombre} ${room.tipo||""} ${room.floor_name||""}`.toLowerCase().includes(term)))
  },[data.rooms,typeFilter,roomQuery])

  const visibleReservations=useMemo(()=>data.reservations.filter(item=>{
    if(statusFilter!=="all"&&planningStage(item,today)!==statusFilter)return false
    if(channelFilter!=="all"&&(item.canal_reserva||"Walk-in")!==channelFilter)return false
    const term=query.trim().toLowerCase(),room=roomById.get(Number(item.habitacion_id))
    return !term||`${item.numero_reserva||item.id} ${item.nombre_huesped} ${room?.nombre||""} ${item.canal_reserva||""}`.toLowerCase().includes(term)
  }),[data.reservations,statusFilter,channelFilter,query,roomById,today])

  useEffect(()=>{if(draftKey)try{setHasSavedDraft(Boolean(localStorage.getItem(draftKey)))}catch{}},[draftKey])
  useEffect(()=>{if(settingsKey)try{const raw=localStorage.getItem(settingsKey);if(raw)setSettings({...DEFAULT_SETTINGS,...JSON.parse(raw)})}catch{}},[settingsKey])
  useEffect(()=>{if(settingsKey)try{localStorage.setItem(settingsKey,JSON.stringify(settings))}catch{}},[settings,settingsKey])
  useEffect(()=>{if(!draftKey||!draft)return;const timer=setTimeout(()=>{try{localStorage.setItem(draftKey,JSON.stringify({...draft,savedAt:new Date().toISOString()}));setHasSavedDraft(true);setDraftState("Borrador guardado automáticamente")}catch{setDraftState("No se pudo guardar el borrador")}},220);return()=>clearTimeout(timer)},[draft,draftKey])
  useEffect(()=>()=>{if(formErrorTimer.current)clearTimeout(formErrorTimer.current)},[])

  function showFormError(message){setFormError(message);if(formErrorTimer.current)clearTimeout(formErrorTimer.current);formErrorTimer.current=setTimeout(()=>setFormError(""),4200)}
  function changeSetting(name,value){setSettings(current=>({...current,[name]:value}))}
  function roomRate(roomIds){return uniqueIds(roomIds).reduce((sum,id)=>sum+(Number(data.rooms.find(room=>String(room.id)===id)?.precio)||0),0)}
  function makeDraft(roomId=data.rooms[0]?.id,start=today,end=addDays(start,1),roomIds=[roomId]){
    const ids=uniqueIds(roomIds.length?roomIds:[roomId])
    return{firstName:"",lastName:"",email:"",phone:"",country:"",roomId:ids[0]||"",roomIds:ids,start,end,status:"confirmada",guests:1,rate:roomRate(ids),currency:"ARS",channel:"Walk-in",voucher:"",discountType:"none",discountValue:0,notes:""}
  }
  function openFreshForm(roomId=data.rooms[0]?.id,start=today,end=addDays(start,1),roomIds=[roomId]){
    if(!roomId)return data.setError("Primero configurá una habitación activa.")
    setPreview(null);setSelected(null);setRangeSelection(null);setSelecting(false);setDraft(makeDraft(roomId,start,end,roomIds));setDrawerStep(0);setDraftState("Los cambios se guardan automáticamente en este dispositivo");setFormError("");data.setError("");setFormOpen(true)
  }
  function openNewReservation(){if(!data.rooms[0]?.id)return data.setError("Primero configurá una habitación activa.");if(draftKey)try{localStorage.removeItem(draftKey)}catch{}setHasSavedDraft(false);openFreshForm()}
  useEffect(()=>{if(!newReservationRequest||!data.rooms.length||lastNewReservationRequest.current===newReservationRequest)return;lastNewReservationRequest.current=newReservationRequest;openNewReservation()},[newReservationRequest,data.rooms.length])
  function clearDraft(){if(draftKey)try{localStorage.removeItem(draftKey)}catch{}setHasSavedDraft(false);setDraft(null);setDraftState("");setFormError("")}
  function discardDraft(){clearDraft();setFormOpen(false);setDrawerStep(0);data.setError("")}
  function nextStep(){if(drawerStep===0&&draft.end<=draft.start)return showFormError("La salida debe ser posterior a la entrada.");if(drawerStep===1&&!uniqueIds(draft.roomIds).length)return showFormError("Elegí al menos una habitación.");if(drawerStep===2&&(!String(draft.firstName||"").trim()||!String(draft.lastName||"").trim()))return showFormError("Completá nombre y apellido para continuar.");setFormError("");data.setError("");setDrawerStep(step=>Math.min(3,step+1))}
  async function saveReservation(){if(saving)return;const guest=`${draft?.firstName||""} ${draft?.lastName||""}`.trim();if(!String(draft?.firstName||"").trim()||!String(draft?.lastName||"").trim())return showFormError("Completá nombre y apellido para crear la reserva.");setSaving(true);setFormError("");try{await data.createReservation({...draft,guest});clearDraft();setFormOpen(false);setDrawerStep(0)}catch(err){showFormError(err?.message||"No se pudo crear la reserva.")}finally{setSaving(false)}}

  function showPreview(item,rect){if(!item||!rect){setPreview(null);return}const width=330,height=245,gap=8;let x=Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),y=rect.bottom+gap;if(y+height>window.innerHeight-12)y=Math.max(12,rect.top-height-gap);setPreview({item,x,y})}
  function selectReservation(item){setPreview(null);setFormOpen(false);setFormError("");setRangeSelection(null);setSelected(item)}
  function isGroup(item){return uniqueIds([item.habitacion_id,...(item.habitaciones_ids||[])]).length>1}
  function beginDrag(event,item){if(isGroup(item)){event.preventDefault();data.setError("Las reservas grupales se modifican desde su ficha para conservar todas las habitaciones asignadas.");return}event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(item.id));setPreview(null);setDragging({item,mode:"move"});setSelected(null);setRangeSelection(null)}
  function beginResize(event,item){if(isGroup(item)){event.preventDefault();data.setError("Las reservas grupales se modifican desde su ficha para conservar todas las habitaciones asignadas.");return}event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(item.id));setPreview(null);setDragging({item,mode:"resize"});setSelected(null);setRangeSelection(null)}
  async function dropReservation(event,roomId,day){
    event.preventDefault();if(!dragging)return
    const source=dragging.item;let start=day,end,finalRoomId=roomId
    if(dragging.mode==="resize"){start=source.fecha_entrada;end=addDays(day,1);finalRoomId=source.habitacion_id;if(end<=start){data.setError("La salida tiene que quedar después de la entrada.");setDragging(null);setDropCell("");return}}
    else{const roomChanged=Number(source.habitacion_id)!==Number(roomId),dateChanged=source.fecha_entrada!==day;if(settings.blockDiagonal&&roomChanged&&dateChanged){data.setError("El movimiento diagonal está bloqueado. Cambiá primero fecha o habitación.");setDragging(null);setDropCell("");return}end=addDays(day,Math.max(1,diffDays(source.fecha_entrada,source.fecha_salida)))}
    setSaving(true);data.setError("");try{await data.moveReservation({reservationId:source.id,roomId:finalRoomId,start,end})}catch(err){data.setError(err?.message||"No se pudo mover la reserva.")}finally{setSaving(false);setDragging(null);setDropCell("")}
  }
  function roomsBetween(anchorRoomId,currentRoomId){
    const a=visibleRooms.findIndex(room=>String(room.id)===String(anchorRoomId)),b=visibleRooms.findIndex(room=>String(room.id)===String(currentRoomId))
    if(a<0||b<0)return[String(anchorRoomId)]
    return visibleRooms.slice(Math.min(a,b),Math.max(a,b)+1).map(room=>String(room.id))
  }
  function beginRange(event,roomId,day){if(event.button!==0||dragging||event.detail>1)return;event.preventDefault();setPreview(null);setSelected(null);setRangeSelection({anchorRoomId:String(roomId),roomIds:[String(roomId)],anchorDay:day,start:day,end:addDays(day,1)});setSelecting(true)}
  function extendRange(roomId,day){if(!selecting)return;setRangeSelection(current=>{if(!current)return current;const roomIds=roomsBetween(current.anchorRoomId,roomId);if(day===current.anchorDay)return{...current,roomIds,start:current.anchorDay,end:addDays(current.anchorDay,1)};return day>current.anchorDay?{...current,roomIds,start:current.anchorDay,end:day}:{...current,roomIds,start:day,end:current.anchorDay}})}
  function finishRange(event){if(!selecting)return;event.stopPropagation();setSelecting(false)}
  function confirmRange(){if(!rangeSelection)return;const ids=uniqueIds(rangeSelection.roomIds);openFreshForm(ids[0],rangeSelection.start,rangeSelection.end,ids)}
  function cancelRange(){setSelecting(false);setRangeSelection(null)}

  const availableRooms=useMemo(()=>draft?data.rooms.map(room=>({...room,available:!availabilityReservations.some(item=>roomHas(item,room.id)&&overlaps(item,draft.start,draft.end))})):data.rooms,[data.rooms,availabilityReservations,draft])
  const selectedRooms=useMemo(()=>selected?uniqueIds([selected.habitacion_id,...(selected.habitaciones_ids||[])]).map(id=>roomById.get(Number(id))).filter(Boolean):[],[selected,roomById])
  const nights=draft?Math.max(1,diffDays(draft.start,draft.end)):1,total=draft?(Number(draft.rate)||0)*nights:0,visibleLabel=`${shortDate(days[0])} — ${shortDate(days.at(-1))}`

  return <section className={s.page} style={{"--day-width":`${dayWidth}px`,"--room-width":settings.expanded?"190px":"160px"}}>
    <div className={s.toolbar}><div className={s.navCluster}><button type="button" className={s.navArrow} onClick={()=>setAnchor(value=>addDays(value,-7))}>‹</button><button type="button" className={s.todayButton} onClick={()=>setAnchor(today)}>Hoy</button><button type="button" className={s.navArrow} onClick={()=>setAnchor(value=>addDays(value,7))}>›</button><label className={s.datePicker}><span>{visibleLabel}</span><input type="date" value={anchor} onChange={event=>setAnchor(event.target.value||today)}/></label></div><div className={s.toolbarActions}><label className={s.quickSearch}>⌕<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Huésped o Nº de reserva"/></label><div className={controls.planningToolGroup} aria-label="Herramientas del Planning"><button type="button" className={`${s.toolButton} ${controls.tool} ${settings.showFilters?controls.toolActive:""}`} data-kind="filter" data-tooltip={settings.showFilters?"Ocultar filtros":"Filtrar Planning"} onClick={()=>changeSetting("showFilters",!settings.showFilters)} title={settings.showFilters?"Ocultar filtros":"Filtrar Planning"} aria-label={settings.showFilters?"Ocultar filtros del Planning":"Mostrar filtros del Planning"}><PmsIcon name="filter"/></button><button type="button" className={`${s.toolButton} ${controls.tool}`} data-kind="refresh" data-tooltip="Actualizar ocupación" onClick={data.load} title="Actualizar ocupación y reservas" aria-label="Actualizar Planning"><PmsIcon name="refresh"/></button><div className={`${s.settingsWrap} ${controls.settingsHost}`}><button type="button" className={`${s.toolButton} ${controls.tool} ${settingsOpen?controls.toolActive:""}`} data-kind="view" data-tooltip="Vista del Planning" onClick={()=>setSettingsOpen(value=>!value)} title="Configurar vista del Planning" aria-label="Configurar vista del Planning" aria-expanded={settingsOpen}><PmsIcon name="sliders"/></button>{settingsOpen?<PlanningSettingsMenu settings={settings} onChange={changeSetting} onClose={()=>setSettingsOpen(false)}/>:null}</div></div></div></div>
    {settings.showFilters?<div className={s.filters}><label><span>Habitación</span><input value={roomQuery} onChange={event=>setRoomQuery(event.target.value)} placeholder="Nombre o número"/></label><label><span>Tipo</span><select value={typeFilter} onChange={event=>setTypeFilter(event.target.value)}><option value="all">Todos los tipos</option>{roomTypes.map(type=><option key={type}>{type}</option>)}</select></label><label><span>Canal</span><select value={channelFilter} onChange={event=>setChannelFilter(event.target.value)}><option value="all">Todos los canales</option>{channels.map(channel=><option key={channel}>{channel}</option>)}</select></label><label><span>Estado en Planning</span><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="all">Todos</option><option value="preventa">Preventa</option><option value="venta">Venta</option><option value="checkin">Check-in</option><option value="inhouse">In-house</option><option value="checkout">Check-out</option><option value="postventa">Postventa</option><option value="noshow">No-show</option></select></label></div>:null}
    {data.error&&!formOpen?<div className={s.error}>{data.error}</div>:null}{saving&&!formOpen?<div className={s.savingBar}>Guardando cambios…</div>:null}
    {data.loading?<div className={s.error}>Cargando Planning…</div>:!data.rooms.length?<div className={s.error}>No hay habitaciones activas.</div>:<PlanningCalendar property={property} days={days} today={today} settings={settings} rooms={visibleRooms} availabilityReservations={availabilityReservations} visibleReservations={visibleReservations} selected={selected} dragging={dragging} dropCell={dropCell} rangeSelection={rangeSelection} onRoom={openFreshForm} onBeginRange={beginRange} onExtendRange={extendRange} onFinishRange={finishRange} onDropCell={setDropCell} onDrop={dropReservation} onSelect={selectReservation} onDrag={beginDrag} onResize={beginResize} onPreview={showPreview} onConfirmRange={confirmRange} onCancelRange={cancelRange}/>} 
    <ReservationPreview preview={preview}/>
    {selected&&!formOpen?<ReservationDetailDrawer selected={selected} room={roomById.get(Number(selected.habitacion_id))} rooms={selectedRooms} onClose={()=>setSelected(null)} onOpen={()=>onNavigate?.("reservations",{reservationId:selected.id})}/>:null}
    {formOpen&&draft?<CreateReservationDrawer draft={draft} setDraft={setDraft} drawerStep={drawerStep} setDrawerStep={setDrawerStep} draftState={draftState} externalError={formError} availableRooms={availableRooms} roomById={roomById} nights={nights} total={total} saving={saving} onClose={()=>{setFormOpen(false);setFormError("")}} onDiscard={discardDraft} onNext={nextStep} onSave={saveReservation}/>:null}
  </section>
}