"use client"

import{useMemo,useState}from"react"
import s from"../../pms-next.module.css"

const DAY=86400000
const iso=value=>new Date(value).toISOString().slice(0,10)
const shift=(date,amount)=>iso(new Date(`${date}T12:00:00`).getTime()+amount*DAY)
const short=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit"}).format(new Date(`${value}T12:00:00`))
const dayName=value=>new Intl.DateTimeFormat("es-AR",{weekday:"short"}).format(new Date(`${value}T12:00:00`)).replace(".","")

const rooms=[
  {id:"101",type:"Standard"},{id:"102",type:"Standard"},{id:"201",type:"Superior"},{id:"202",type:"Superior"},{id:"301",type:"Suite"},
]

export default function PlanningWorkspace(){
  const today=iso(Date.now())
  const[start,setStart]=useState(today)
  const[count,setCount]=useState(14)
  const days=useMemo(()=>Array.from({length:count},(_,index)=>shift(start,index)),[start,count])
  const groups=useMemo(()=>[...new Set(rooms.map(room=>room.type))],[])

  return <section className={s.planningPage}>
    <div className={s.planningToolbar}>
      <div className={s.dateNav}><button onClick={()=>setStart(shift(start,-7))}>‹</button><button onClick={()=>setStart(today)}>Hoy</button><button onClick={()=>setStart(shift(start,7))}>›</button><b>{short(days[0])} — {short(days.at(-1))}</b></div>
      <div className={s.toolbarRight}><label className={s.planningSearch}>⌕ <input placeholder="Buscar huésped, reserva o habitación"/></label><div className={s.segmented}>{[7,14,21].map(value=><button key={value} className={count===value?s.segmentActive:""} onClick={()=>setCount(value)}>{value}d</button>)}</div></div>
    </div>
    <div className={s.planningSurface}>
      <div className={s.planningHead}><div className={s.roomColumnHead}>Tipología / Habitación</div><div className={s.dayColumns} style={{gridTemplateColumns:`repeat(${count},minmax(58px,1fr))`}}>{days.map(day=><div key={day} className={day===today?s.todayHead:""}><small>{dayName(day)}</small><b>{new Date(`${day}T12:00:00`).getDate()}</b></div>)}</div></div>
      {groups.map(group=><div className={s.roomGroup} key={group}><div className={s.groupHeader}><b>{group}</b><small>{rooms.filter(room=>room.type===group).length} habitaciones</small></div>{rooms.filter(room=>room.type===group).map(room=><div className={s.planningRow} key={room.id}><button className={s.roomMeta}><span><b>{room.id}</b><small>{room.type}</small></span><em>Lista</em></button><div className={s.rowGrid} style={{gridTemplateColumns:`repeat(${count},minmax(58px,1fr))`}}>{days.map(day=><button className={`${s.dayCell} ${day===today?s.todayCell:""}`} key={day} aria-label={`${room.id} ${day}`}/>)}</div></div>)}</div>)}
    </div>
  </section>
}
