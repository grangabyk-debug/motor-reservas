"use client"

import{useMemo,useState}from"react"
import usePlanningData from"./usePlanningData"
import s from"./planning.module.css"

const DAY=86400000
const pad=value=>String(value).padStart(2,"0")
const keyFromDate=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const fromKey=value=>{const[y,m,d]=value.split("-").map(Number);return new Date(y,m-1,d,12)}
const addDays=(value,amount)=>keyFromDate(new Date(fromKey(value).getTime()+amount*DAY))
const diffDays=(a,b)=>Math.round((fromKey(b)-fromKey(a))/DAY)
const initials=name=>String(name||"R").trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()
const labelDate=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(fromKey(value)).replace(".","")
const dayName=value=>new Intl.DateTimeFormat("es-AR",{weekday:"short"}).format(fromKey(value)).replace(".","")
const MONTHS=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
const STATUS_CLASS={alojado:"inhouse",confirmada:"confirmed",tentativa:"attention",pendiente:"attention"}
const STATUS_LABEL={alojado:"En hotel",confirmada:"Confirmada",tentativa:"Tentativa",pendiente:"Pendiente",finalizada:"Finalizada"}

function ReservationBlock({item,days,selected,onSelect,onDragStart}){
  const first=days[0],last=addDays(days.at(-1),1)
  if(item.fecha_salida<=first||item.fecha_entrada>=last)return null
  const start=Math.max(0,diffDays(first,item.fecha_entrada))
  const span=Math.max(1,Math.min(diffDays(item.fecha_entrada,item.fecha_salida),days.length-start))
  const kind=STATUS_CLASS[item.estado]||"confirmed"
  return <button draggable type="button" className={`${s.stay} ${s[kind]} ${selected?s.selected:""}`} style={{gridColumn:`${start+1} / span ${span}`}} onClick={()=>onSelect(item)} onDragStart={event=>onDragStart(event,item)}><span>{initials(item.nombre_huesped)}</span><span className={s.stayText}>{item.nombre_huesped}</span></button>
}

export default function PlanningWorkspace({propertyId,property,onNavigate}){
  const now=new Date(),today=keyFromDate(now)
  const[year,setYear]=useState(now.getFullYear())
  const[month,setMonth]=useState(now.getMonth())
  const[query,setQuery]=useState("")
  const[attentionOnly,setAttentionOnly]=useState(false)
  const[selected,setSelected]=useState(null)
  const[dragging,setDragging]=useState(null)
  const[dropCell,setDropCell]=useState("")
  const[formOpen,setFormOpen]=useState(false)
  const[saving,setSaving]=useState(false)
  const[draft,setDraft]=useState(null)
  const data=usePlanningData(propertyId)

  const monthStart=keyFromDate(new Date(year,month,1,12))
  const days=useMemo(()=>Array.from({length:35},(_,index)=>addDays(monthStart,index-1)),[monthStart])
  const grid={gridTemplateColumns:`repeat(${days.length},minmax(44px,1fr))`}
  const roomById=useMemo(()=>new Map(data.rooms.map(room=>[Number(room.id),room])),[data.rooms])
  const visibleReservations=useMemo(()=>data.reservations.filter(item=>{
    if(item.no_show)return false
    if(attentionOnly&&!['tentativa','pendiente'].includes(item.estado))return false
    const term=query.trim().toLowerCase()
    const room=roomById.get(Number(item.habitacion_id))
    return !term||`${item.numero_reserva||item.id} ${item.nombre_huesped} ${room?.nombre||""}`.toLowerCase().includes(term)
  }),[data.reservations,query,attentionOnly,roomById])

  function jumpToday(){setYear(now.getFullYear());setMonth(now.getMonth())}
  function shiftYear(amount){setYear(value=>value+amount)}
  function openForm(roomId=data.rooms[0]?.id,start=today){
    if(!roomId)return data.setError("Primero configurá al menos una habitación activa.")
    const room=data.rooms.find(item=>String(item.id)===String(roomId))
    setDraft({guest:"",email:"",phone:"",roomId:String(roomId),start,end:addDays(start,1),status:"confirmada",guests:1,rate:Number(room?.precio)||0,currency:"ARS",channel:"Directa",notes:""})
    data.setError("");setFormOpen(true)
  }
  async function saveReservation(){
    if(!draft?.guest.trim())return data.setError("Ingresá el nombre del huésped.")
    if(draft.end<=draft.start)return data.setError("La salida debe ser posterior a la entrada.")
    setSaving(true)
    try{await data.createReservation(draft);setFormOpen(false)}catch(err){data.setError(err?.message||"No se pudo crear la reserva.")}finally{setSaving(false)}
  }
  function beginDrag(event,item){event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(item.id));setDragging(item);setSelected(null)}
  async function dropReservation(event,roomId,day){
    event.preventDefault();const source=dragging;if(!source)return
    const stay=Math.max(1,diffDays(source.fecha_entrada,source.fecha_salida)),end=addDays(day,stay)
    setSaving(true);data.setError("")
    try{await data.moveReservation({reservationId:source.id,roomId,start:day,end})}
    catch(err){data.setError(err?.message||"No se pudo mover la reserva.")}
    finally{setSaving(false);setDragging(null);setDropCell("")}
  }

  return <section className={s.page}>
    <div className={s.toolbar}>
      <div className={s.toolbarLeft}><button type="button" className={s.todayButton} onClick={jumpToday}>Hoy</button><div className={s.yearNav}><button type="button" onClick={()=>shiftYear(-1)}>‹</button><b>{year}</b><button type="button" onClick={()=>shiftYear(1)}>›</button></div><div className={s.monthStrip}>{MONTHS.map((name,index)=><button type="button" key={name} className={`${s.monthButton} ${month===index?s.monthButtonActive:""}`} onClick={()=>setMonth(index)}>{name}</button>)}</div></div>
      <div className={s.toolbarRight}><label className={s.search}>⌕<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Huésped, reserva o habitación"/></label><button type="button" className={`${s.iconButton} ${attentionOnly?s.iconButtonActive:""}`} onClick={()=>setAttentionOnly(value=>!value)} title="Pendientes y tentativas">⌁</button><button type="button" className={s.iconButton} onClick={()=>onNavigate?.("rates")} title="Tarifas y disponibilidad">$</button><button type="button" className={s.newButton} onClick={()=>openForm()}>＋ Nueva reserva</button></div>
    </div>
    {data.error&&<div className={s.error}>{data.error}</div>}
    {data.loading?<div className={s.error}>Cargando Planning…</div>:!data.rooms.length?<div className={s.error}>No hay habitaciones activas. Configuralas en Propiedad antes de operar el Planning.</div>:<div className={s.calendar}>
      <div className={s.head}><div className={s.roomHead}>Habitación</div><div className={s.days} style={grid}>{days.map(day=><div key={day} className={day===today?s.todayHead:""}><small>{dayName(day)}</small><b>{fromKey(day).getDate()}</b></div>)}</div></div>
      <div className={s.propertyHeader}><span>HL</span> {property?.name||"Propiedad activa"}</div>
      {data.rooms.map(room=>{const roomReservations=visibleReservations.filter(item=>Number(item.habitacion_id)===Number(room.id)||(item.habitaciones_ids||[]).map(Number).includes(Number(room.id)));return <div className={s.row} key={room.id}><button type="button" className={s.room} onClick={()=>openForm(room.id,today)}><span><b>{room.nombre}</b><small>{room.tipo||"Sin tipo"} · {room.capacidad||1} pax</small></span><span className={s.alert} title={room.estado}>{room.estado==="mantenimiento"?"⚠":""}</span></button><div className={s.grid} style={grid}>{days.map(day=>{const dropKey=`${room.id}-${day}`;return <button type="button" key={day} className={`${s.cell} ${day===today?s.todayCell:""} ${dropCell===dropKey?s.dropTarget:""}`} aria-label={`${room.nombre} ${day}`} onDoubleClick={()=>openForm(room.id,day)} onDragEnter={()=>dragging&&setDropCell(dropKey)} onDragOver={event=>{if(dragging){event.preventDefault();event.dataTransfer.dropEffect="move"}}} onDragLeave={()=>dropCell===dropKey&&setDropCell("")} onDrop={event=>dropReservation(event,room.id,day)}/>})}{roomReservations.map(item=><ReservationBlock key={`${room.id}-${item.id}`} item={item} days={days} selected={selected?.id===item.id} onSelect={setSelected} onDragStart={beginDrag}/>)}</div></div>})}
    </div>}

    {selected&&<aside className={s.inspector}><header><div><small>RESERVA {selected.numero_reserva||selected.id}</small><b>{selected.nombre_huesped}</b><span>Habitación {roomById.get(Number(selected.habitacion_id))?.nombre||"—"}</span></div><button className={s.close} onClick={()=>setSelected(null)}>×</button></header><div className={s.details}><div><small>Entrada</small><b>{labelDate(selected.fecha_entrada)}</b></div><div><small>Salida</small><b>{labelDate(selected.fecha_salida)}</b></div><div><small>Noches</small><b>{diffDays(selected.fecha_entrada,selected.fecha_salida)}</b></div><div><small>Estado</small><b>{STATUS_LABEL[selected.estado]||selected.estado}</b></div></div><footer><button onClick={()=>setSelected(null)}>Cerrar</button><button onClick={()=>onNavigate?.("reservations")}>Abrir reserva</button></footer></aside>}

    {formOpen&&draft&&<div className={s.modalShade} onMouseDown={event=>event.target===event.currentTarget&&setFormOpen(false)}><div className={s.modal}><header><h2>Nueva reserva</h2><button className={s.close} onClick={()=>setFormOpen(false)}>×</button></header><div className={s.form}><label>Huésped<input value={draft.guest} onChange={e=>setDraft(v=>({...v,guest:e.target.value}))} autoFocus/></label><label>Habitación<select value={draft.roomId} onChange={e=>{const room=data.rooms.find(r=>String(r.id)===e.target.value);setDraft(v=>({...v,roomId:e.target.value,rate:Number(room?.precio)||v.rate}))}}>{data.rooms.map(room=><option key={room.id} value={room.id}>{room.nombre} · {room.tipo||"Sin tipo"}</option>)}</select></label><label>Email<input type="email" value={draft.email} onChange={e=>setDraft(v=>({...v,email:e.target.value}))}/></label><label>Teléfono<input value={draft.phone} onChange={e=>setDraft(v=>({...v,phone:e.target.value}))}/></label><label>Entrada<input type="date" value={draft.start} onChange={e=>setDraft(v=>({...v,start:e.target.value}))}/></label><label>Salida<input type="date" value={draft.end} onChange={e=>setDraft(v=>({...v,end:e.target.value}))}/></label><label>Huéspedes<input type="number" min="1" value={draft.guests} onChange={e=>setDraft(v=>({...v,guests:e.target.value}))}/></label><label>Tarifa por noche<input type="number" min="0" value={draft.rate} onChange={e=>setDraft(v=>({...v,rate:e.target.value}))}/></label><label>Canal<select value={draft.channel} onChange={e=>setDraft(v=>({...v,channel:e.target.value}))}><option>Directa</option><option>Motor</option><option>Booking.com</option><option>Expedia</option><option>Agencia</option><option>Walk-in</option></select></label><label>Estado<select value={draft.status} onChange={e=>setDraft(v=>({...v,status:e.target.value}))}><option value="confirmada">Confirmada</option><option value="tentativa">Tentativa</option><option value="pendiente">Pendiente</option></select></label></div>{data.error&&<div className={s.error}>{data.error}</div>}<footer><button onClick={()=>setFormOpen(false)}>Cancelar</button><button disabled={saving} onClick={saveReservation}>{saving?"Guardando…":"Guardar reserva"}</button></footer></div></div>}
  </section>
}
