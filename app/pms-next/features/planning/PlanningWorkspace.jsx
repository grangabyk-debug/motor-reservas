"use client"

import{useMemo,useState}from"react"
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

const ROOMS=Array.from({length:15},(_,index)=>({id:String(101+index),capacity:2,type:index<7?"Standard":index<12?"Superior":"Suite"}))
const INITIAL_RESERVATIONS=[
  {id:"r1",guest:"Elena Petrova",roomId:"101",start:"2026-09-09",end:"2026-09-12",status:"confirmed"},
  {id:"r2",guest:"Omar Haddad",roomId:"101",start:"2026-09-16",end:"2026-09-18",status:"attention"},
  {id:"r3",guest:"María García",roomId:"103",start:"2026-09-05",end:"2026-09-09",status:"attention"},
  {id:"r4",guest:"Fátima Zahra",roomId:"104",start:"2026-09-04",end:"2026-09-08",status:"inhouse"},
  {id:"r5",guest:"Henrik Olsen",roomId:"104",start:"2026-09-10",end:"2026-09-14",status:"confirmed"},
  {id:"r6",guest:"Jean Dupont",roomId:"107",start:"2026-09-05",end:"2026-09-08",status:"attention"},
  {id:"r7",guest:"Noah Brown",roomId:"111",start:"2026-09-09",end:"2026-09-13",status:"attention"},
  {id:"r8",guest:"Yuki Tanaka",roomId:"113",start:"2026-09-08",end:"2026-09-12",status:"attention"},
]

function Reservation({item,days,selected,onSelect,onDragStart}){
  const first=days[0]
  const last=addDays(days.at(-1),1)
  if(item.end<=first||item.start>=last)return null
  const rawStart=diffDays(first,item.start)
  const start=Math.max(0,rawStart)
  const span=Math.max(1,Math.min(diffDays(item.start,item.end),days.length-start))
  return <button draggable type="button" className={`${s.stay} ${s[item.status]||s.confirmed} ${selected?s.selected:""}`} style={{gridColumn:`${start+1} / span ${span}`}} onClick={()=>onSelect(item)} onDragStart={event=>onDragStart(event,item)}><span>{initials(item.guest)}</span><span className={s.stayText}>{item.guest}</span></button>
}

export default function PlanningWorkspace({onNavigate}){
  const now=new Date()
  const today=keyFromDate(now)
  const[year,setYear]=useState(now.getFullYear())
  const[month,setMonth]=useState(now.getMonth())
  const[query,setQuery]=useState("")
  const[attentionOnly,setAttentionOnly]=useState(false)
  const[reservations,setReservations]=useState(INITIAL_RESERVATIONS)
  const[selected,setSelected]=useState(null)
  const[dragging,setDragging]=useState(null)
  const[dropCell,setDropCell]=useState("")
  const[formOpen,setFormOpen]=useState(false)
  const[error,setError]=useState("")
  const[draft,setDraft]=useState({guest:"",roomId:ROOMS[0].id,start:today,end:addDays(today,1),status:"confirmed"})

  const monthStart=keyFromDate(new Date(year,month,1,12))
  const days=useMemo(()=>Array.from({length:35},(_,index)=>addDays(monthStart,index-1)),[monthStart])
  const grid={gridTemplateColumns:`repeat(${days.length},minmax(44px,1fr))`}
  const visibleReservations=useMemo(()=>reservations.filter(item=>{
    const term=query.trim().toLowerCase()
    if(attentionOnly&&item.status!=="attention")return false
    if(!term)return true
    return `${item.guest} ${item.roomId}`.toLowerCase().includes(term)
  }),[reservations,query,attentionOnly])

  function jumpToday(){setYear(now.getFullYear());setMonth(now.getMonth())}
  function shiftYear(amount){setYear(value=>value+amount)}
  function openForm(roomId=ROOMS[0].id,start=today){setDraft({guest:"",roomId,start,end:addDays(start,1),status:"confirmed"});setError("");setFormOpen(true)}
  function saveReservation(){
    if(!draft.guest.trim())return setError("Ingresá el nombre del huésped.")
    if(draft.end<=draft.start)return setError("La salida debe ser posterior a la entrada.")
    setReservations(items=>[...items,{...draft,guest:draft.guest.trim(),id:`r${Date.now()}`}])
    setFormOpen(false)
  }
  function beginDrag(event,item){event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",item.id);setDragging(item.id);setSelected(null)}
  function dropReservation(event,roomId,day){
    event.preventDefault()
    const id=event.dataTransfer.getData("text/plain")||dragging
    const source=reservations.find(item=>item.id===id)
    if(!source)return
    const stay=Math.max(1,diffDays(source.start,source.end))
    setReservations(items=>items.map(item=>item.id===id?{...item,roomId,start:day,end:addDays(day,stay)}:item))
    setDragging(null);setDropCell("")
  }

  return <section className={s.page}>
    <div className={s.toolbar}>
      <div className={s.toolbarLeft}>
        <button type="button" className={s.todayButton} onClick={jumpToday}>Hoy</button>
        <div className={s.yearNav}><button type="button" onClick={()=>shiftYear(-1)}>‹</button><b>{year}</b><button type="button" onClick={()=>shiftYear(1)}>›</button></div>
        <div className={s.monthStrip}>{MONTHS.map((name,index)=><button type="button" key={name} className={`${s.monthButton} ${month===index?s.monthButtonActive:""}`} onClick={()=>setMonth(index)}>{name}</button>)}</div>
      </div>
      <div className={s.toolbarRight}>
        <label className={s.search}>⌕<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Huésped o habitación"/></label>
        <button type="button" className={`${s.iconButton} ${attentionOnly?s.iconButtonActive:""}`} onClick={()=>setAttentionOnly(value=>!value)} title="Filtrar reservas con atención">⌁</button>
        <button type="button" className={s.iconButton} onClick={()=>onNavigate?.("rates")} title="Tarifas y disponibilidad">$</button>
        <button type="button" className={s.newButton} onClick={()=>openForm()}>＋ Nueva reserva</button>
      </div>
    </div>

    <div className={s.calendar}>
      <div className={s.head}><div className={s.roomHead}>Habitación</div><div className={s.days} style={grid}>{days.map(day=><div key={day} className={day===today?s.todayHead:""}><small>{dayName(day)}</small><b>{fromKey(day).getDate()}</b></div>)}</div></div>
      <div className={s.propertyHeader}><span>HL</span> HOTEL DEMO</div>
      {ROOMS.map(room=>{
        const roomReservations=visibleReservations.filter(item=>item.roomId===room.id)
        return <div className={s.row} key={room.id}>
          <button type="button" className={s.room} onClick={()=>openForm(room.id,today)}><span><b>{room.id}</b><small>{room.type} · {room.capacity} pax</small></span><span className={s.alert}>△4</span></button>
          <div className={s.grid} style={grid}>
            {days.map(day=>{const dropKey=`${room.id}-${day}`;return <button type="button" key={day} className={`${s.cell} ${day===today?s.todayCell:""} ${dropCell===dropKey?s.dropTarget:""}`} aria-label={`${room.id} ${day}`} onDoubleClick={()=>openForm(room.id,day)} onDragEnter={()=>dragging&&setDropCell(dropKey)} onDragOver={event=>{if(dragging){event.preventDefault();event.dataTransfer.dropEffect="move"}}} onDragLeave={()=>dropCell===dropKey&&setDropCell("")} onDrop={event=>dropReservation(event,room.id,day)}/>})}
            {roomReservations.map(item=><Reservation key={item.id} item={item} days={days} selected={selected?.id===item.id} onSelect={setSelected} onDragStart={beginDrag}/>) }
          </div>
        </div>
      })}
    </div>

    {selected&&<aside className={s.inspector}><header><div><small>RESERVA</small><b>{selected.guest}</b><span>Habitación {selected.roomId}</span></div><button className={s.close} onClick={()=>setSelected(null)}>×</button></header><div className={s.details}><div><small>Entrada</small><b>{labelDate(selected.start)}</b></div><div><small>Salida</small><b>{labelDate(selected.end)}</b></div><div><small>Noches</small><b>{diffDays(selected.start,selected.end)}</b></div><div><small>Estado</small><b>{selected.status==="inhouse"?"En hotel":selected.status==="attention"?"Revisar":"Confirmada"}</b></div></div><footer><button onClick={()=>setSelected(null)}>Cerrar</button><button onClick={()=>{setDraft({...selected});setFormOpen(true);setSelected(null)}}>Editar</button></footer></aside>}

    {formOpen&&<div className={s.modalShade} onMouseDown={event=>event.target===event.currentTarget&&setFormOpen(false)}><div className={s.modal}><header><h2>{draft.id?"Editar reserva":"Nueva reserva"}</h2><button className={s.close} onClick={()=>setFormOpen(false)}>×</button></header><div className={s.form}><label>Huésped<input value={draft.guest} onChange={event=>setDraft(value=>({...value,guest:event.target.value}))} autoFocus/></label><label>Habitación<select value={draft.roomId} onChange={event=>setDraft(value=>({...value,roomId:event.target.value}))}>{ROOMS.map(room=><option key={room.id} value={room.id}>{room.id} · {room.type}</option>)}</select></label><label>Estado<select value={draft.status} onChange={event=>setDraft(value=>({...value,status:event.target.value}))}><option value="confirmed">Confirmada</option><option value="attention">Revisar</option><option value="inhouse">En hotel</option></select></label><label>Entrada<input type="date" value={draft.start} onChange={event=>setDraft(value=>({...value,start:event.target.value}))}/></label><label>Salida<input type="date" value={draft.end} onChange={event=>setDraft(value=>({...value,end:event.target.value}))}/></label></div>{error&&<div className={s.error}>{error}</div>}<footer><button onClick={()=>setFormOpen(false)}>Cancelar</button><button onClick={()=>{
      if(draft.id){
        if(!draft.guest.trim())return setError("Ingresá el nombre del huésped.")
        if(draft.end<=draft.start)return setError("La salida debe ser posterior a la entrada.")
        setReservations(items=>items.map(item=>item.id===draft.id?{...draft,guest:draft.guest.trim()}:item));setFormOpen(false)
      }else saveReservation()
    }}>Guardar</button></footer></div></div>}
  </section>
}
