"use client"

import{useMemo,useState}from"react"
import s from"./housekeeping.module.css"

const seedRooms=[
  {room:"101",type:"Standard",status:"dirty",occupancy:"Salida hoy",assignee:"Camila",lastDeep:"12 Jun",deepDue:18,notes:"Revisar almohadas"},
  {room:"102",type:"Standard",status:"clean",occupancy:"Libre",assignee:"Lucía",lastDeep:"20 Ago",deepDue:76,notes:""},
  {room:"117",type:"Superior",status:"inspect",occupancy:"Entrada 15:00",assignee:"Camila",lastDeep:"03 Jul",deepDue:39,notes:"Cuna solicitada"},
  {room:"204",type:"Superior",status:"maintenance",occupancy:"Bloqueada",assignee:"—",lastDeep:"11 Ago",deepDue:67,notes:"Pérdida en baño"},
  {room:"242",type:"Suite",status:"dirty",occupancy:"Salida 11:00",assignee:"Lucía",lastDeep:"01 Jun",deepDue:7,notes:"Late checkout 13:00"},
  {room:"305",type:"Suite",status:"clean",occupancy:"Ocupada",assignee:"Nadia",lastDeep:"28 Ago",deepDue:84,notes:"No molestar"},
]

const labels={dirty:"Sucia",clean:"Limpia",inspect:"Para revisar",maintenance:"Mantenimiento"}
const nextStatus={dirty:"clean",clean:"inspect",inspect:"clean",maintenance:"maintenance"}

export default function HousekeepingWorkspace(){
  const[rooms,setRooms]=useState(seedRooms)
  const[filter,setFilter]=useState("all")
  const[query,setQuery]=useState("")
  const[mode,setMode]=useState("daily")
  const[deepCadence,setDeepCadence]=useState(90)

  const visible=useMemo(()=>rooms.filter(room=>(filter==="all"||room.status===filter)&&(!query||`${room.room} ${room.type} ${room.assignee} ${room.occupancy}`.toLowerCase().includes(query.toLowerCase()))),[rooms,filter,query])
  const counts=useMemo(()=>Object.fromEntries(Object.keys(labels).map(key=>[key,rooms.filter(room=>room.status===key).length])),[rooms])

  function advance(roomNumber){setRooms(current=>current.map(room=>room.room===roomNumber?{...room,status:nextStatus[room.status]}:room))}
  function deepClean(roomNumber){setRooms(current=>current.map(room=>room.room===roomNumber?{...room,lastDeep:"Hoy",deepDue:deepCadence}:room))}

  return <section className={s.page}>
    <header className={s.header}>
      <div><small>HOUSEKEEPING</small><h1>Estado de habitaciones</h1><p>Limpieza diaria, inspección y limpieza profunda en una sola vista.</p></div>
      <div className={s.mode}><button className={mode==="daily"?s.active:""} onClick={()=>setMode("daily")}>Operación diaria</button><button className={mode==="deep"?s.active:""} onClick={()=>setMode("deep")}>Limpieza profunda</button></div>
    </header>

    {mode==="daily"?<>
      <div className={s.stats}>{Object.entries(labels).map(([key,label])=><button key={key} className={filter===key?s.selected:""} onClick={()=>setFilter(filter===key?"all":key)}><span>{label}</span><b>{counts[key]}</b></button>)}</div>
      <div className={s.toolbar}><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar habitación o camarera"/></label><button onClick={()=>setFilter("all")}>Todas</button></div>
      <div className={s.roomGrid}>{visible.map(room=><article className={s.roomCard} key={room.room}>
        <div className={s.roomTop}><div><small>{room.type}</small><h2>{room.room}</h2></div><span data-status={room.status}>{labels[room.status]}</span></div>
        <p className={s.occupancy}>{room.occupancy}</p>
        <dl><div><dt>Responsable</dt><dd>{room.assignee}</dd></div><div><dt>Última profunda</dt><dd>{room.lastDeep}</dd></div></dl>
        {room.notes&&<p className={s.note}>{room.notes}</p>}
        <footer><button onClick={()=>advance(room.room)} disabled={room.status==="maintenance"}>{room.status==="dirty"?"Marcar limpia":room.status==="clean"?"Enviar a revisión":room.status==="inspect"?"Aprobar habitación":"Bloqueada"}</button></footer>
      </article>)}</div>
    </>:<>
      <div className={s.deepToolbar}><div><b>Cadencia de limpieza profunda</b><span>Cada <input type="number" min="1" max="365" value={deepCadence} onChange={e=>setDeepCadence(Number(e.target.value)||90)}/> días</span></div><div><strong>{rooms.filter(r=>r.deepDue<=14).length}</strong><span>habitaciones próximas a vencer</span></div></div>
      <div className={s.deepList}>{rooms.map(room=>{const overdue=room.deepDue<=0;const dueSoon=room.deepDue<=14;return <article key={room.room} className={s.deepRow}>
        <div className={s.deepRoom}><b>{room.room}</b><small>{room.type}</small></div><div><small>Última limpieza</small><b>{room.lastDeep}</b></div><div><small>Próxima en</small><b className={overdue?s.overdue:dueSoon?s.soon:""}>{overdue?"Vencida":`${room.deepDue} días`}</b></div><button onClick={()=>deepClean(room.room)}>Registrar profunda</button>
      </article>})}</div>
    </>}
  </section>
}
