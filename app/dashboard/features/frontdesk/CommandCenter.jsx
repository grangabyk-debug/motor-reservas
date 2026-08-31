"use client"
import{useMemo,useState}from"react"
import{addDays,isoDate,shortDate}from"../../core/formatters"
import ui from"../../v2.module.css"
import cc from"./command-center.module.css"

function localNowKey(){const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0"),h=String(d.getHours()).padStart(2,"0"),min=String(d.getMinutes()).padStart(2,"0");return`${y}-${m}-${day}T${h}:${min}:00`}
function occupancyStart(r){return String(r?.ocupacion_desde_local||`${r?.fecha_entrada||""}T${r?.hora_llegada_estimada||"14:00"}:00`).replace(" ","T")}
function occupancyEnd(r){return String(r?.ocupacion_hasta_local||`${r?.fecha_salida||""}T${r?.hora_salida_estimada||"10:00"}:00`).replace(" ","T")}
function parts(value){const raw=String(value||"").replace(" ","T"),[date,time="00:00:00"]=raw.split("T");return{date,time:time.slice(0,5)}}
function tone(r,now){
  if(r.estado==="finalizada")return"out"
  if(r.estado==="alojado")return"in"
  const start=occupancyStart(r),end=occupancyEnd(r)
  if(end&&now>=end)return"out"
  if(start&&end&&now>=start&&now<end)return"in"
  return"future"
}
function statusLabel(r,now){
  if(r?.no_show)return"NO SHOW"
  const status=String(r?.estado||"").toLowerCase()
  if(status==="cancelada")return"CANCELADA"
  if(status==="finalizada")return"OUT"
  if(status==="alojado")return"IN"
  const t=tone(r,now)
  if(t==="in")return"IN"
  if(t==="out")return"OUT"
  return"FUTURA"
}
function channelLabel(value){
  const raw=String(value||"Directa").trim(),channel=raw.toLowerCase()
  if(channel.includes("booking"))return"OTA · BOOKING.COM"
  if(channel.includes("expedia"))return"OTA · EXPEDIA"
  if(channel.includes("airbnb"))return"OTA · AIRBNB"
  if(channel.includes("motor"))return"MOTOR"
  if(channel.includes("agencia"))return"AGENCIA"
  if(channel==="directa")return"DIRECTA"
  if(channel.includes("teléfono")||channel.includes("telefono")||channel.includes("whatsapp")||channel.includes("walk-in"))return`DIRECTA · ${raw.toUpperCase()}`
  return raw.toUpperCase()
}
function dayName(d){return new Date(`${d}T12:00:00`).toLocaleDateString("es-AR",{weekday:"short"})}
function halfRange(r,days){
  const first=days[0],lastExclusive=addDays(days.at(-1),1),maxLine=days.length*2+1,start=parts(occupancyStart(r)),end=parts(occupancyEnd(r))
  let startLine
  if(start.date<first)startLine=1
  else{const i=days.indexOf(start.date);startLine=i<0?1:i*2+(start.time<"12:00"?1:2)}
  let endLine
  if(end.date>=lastExclusive)endLine=maxLine
  else{const i=days.indexOf(end.date);endLine=i<0?maxLine:i*2+(end.time<="12:00"?2:3)}
  startLine=Math.max(1,Math.min(maxLine-1,startLine));endLine=Math.max(startLine+1,Math.min(maxLine,endLine))
  return{startLine,endLine}
}
function stayKind(r){return r?.tipo_estadia==="day_use"?"DAY USE":"NOCHE HOTELERA"}

export default function CommandCenter({rooms,reservations,blocks,floors,onMove,onResize,onOpen,onNew,onBlock}){
  const today=isoDate(),now=localNowKey(),[start,setStart]=useState(today),[dayCount,setDayCount]=useState(15),[type,setType]=useState(""),[floor,setFloor]=useState(""),[roomQuery,setRoomQuery]=useState("")
  const days=useMemo(()=>Array.from({length:dayCount},(_,i)=>addDays(start,i)),[start,dayCount])
  const floorMap=useMemo(()=>new Map(floors.map(f=>[String(f.id),f.name])),[floors])
  const types=useMemo(()=>[...new Set(rooms.map(r=>String(r.tipo||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[rooms])
  const filteredRooms=useMemo(()=>rooms.filter(room=>{
    if(type&&String(room.tipo||"")!==type)return false
    if(floor&&String(room.floor_id||"")!==floor)return false
    const q=roomQuery.trim().toLowerCase();if(q&&!`${room.nombre||""} ${room.tipo||""}`.toLowerCase().includes(q))return false
    return true
  }),[rooms,type,floor,roomQuery])
  const tracks={gridTemplateColumns:`repeat(${dayCount*2},minmax(31px,1fr))`}
  const timeline={"--timeline-min":`${Math.max(620,dayCount*64)}px`},windowStart=`${days[0]}T00:00:00`,windowEnd=`${addDays(days.at(-1),1)}T00:00:00`
  return <section className={`${ui.content} ${cc.commandPage}`}>
    <div className={cc.toolbar}>
      <div className={cc.rangeBlock}><small>ROOM DIARY</small><strong>{shortDate(days[0])} — {shortDate(days.at(-1))}</strong></div>
      <div className={cc.filters}>
        <input aria-label="Filtrar habitación" value={roomQuery} onChange={e=>setRoomQuery(e.target.value)} placeholder="Habitación…"/>
        <select aria-label="Tipo de habitación" value={type} onChange={e=>setType(e.target.value)}><option value="">Todos los tipos</option>{types.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Piso" value={floor} onChange={e=>setFloor(e.target.value)}><option value="">Todos los pisos</option>{floors.filter(f=>f.active!==false).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
        <input className={cc.dateInput} aria-label="Ir a fecha" type="date" value={start} onChange={e=>e.target.value&&setStart(e.target.value)}/>
        <select aria-label="Días visibles" value={dayCount} onChange={e=>setDayCount(Number(e.target.value))}><option value="7">7 días</option><option value="10">10 días</option><option value="15">15 días</option><option value="21">21 días</option></select>
      </div>
      <div className={cc.navActions}>
        <button onClick={()=>setStart(addDays(start,-Math.min(7,dayCount)))} aria-label="Fechas anteriores">←</button><button onClick={()=>setStart(today)}>Hoy</button><button onClick={()=>setStart(addDays(start,Math.min(7,dayCount)))} aria-label="Fechas siguientes">→</button>
        <span className={cc.help}><button aria-label="Ayuda del calendario">i</button><span className={cc.tooltip}><b>Cómo leer y usar el calendario</b><em><i className={cc.inDot}/>IN / ocupada</em><em><i className={cc.outDot}/>OUT</em><em><i className={cc.futureDot}/>FUTURA</em><em><i className={cc.blockDot}/>Bloqueo</em><p>Cada día tiene mitad AM y PM. Así una llegada de madrugada, un check-out por la mañana y un Day Use posterior pueden convivir sin perder la hora real. Arrastrá una reserva para moverla y su borde derecho para cambiar la salida.</p></span></span>
      </div>
    </div>
    <div className={cc.resultMeta}>{filteredRooms.length} de {rooms.length} habitaciones visibles</div>
    <div className={`${ui.calendar} ${cc.calendar}`} style={timeline}>
      <div className={cc.calHead}><div className={ui.roomHead}><b>Habitación</b><small>Piso · tipo</small></div><div className={cc.days} style={tracks}>{days.map((d,i)=><div key={d} style={{gridColumn:`${i*2+1} / span 2`}} className={d===today?cc.todayHeader:""}><small>{dayName(d)}</small><b>{new Date(`${d}T12:00:00`).getDate()}</b></div>)}</div></div>
      {filteredRooms.map(room=>{const list=reservations.filter(r=>String(r.habitacion_id)===String(room.id)&&occupancyEnd(r)>windowStart&&occupancyStart(r)<windowEnd);return <div className={cc.calRow} key={room.id}><button className={ui.roomName}><b>{room.nombre}</b><small>{floorMap.get(String(room.floor_id))||"Sin piso"} · {room.tipo||"Habitación"}</small></button><div className={cc.dayGrid} style={tracks}>{days.map((day,i)=>{const blocked=blocks.some(b=>String(b.habitacion_id)===String(room.id)&&day<b.fecha_hasta&&addDays(day,1)>b.fecha_desde);return <div key={day} style={{gridColumn:`${i*2+1} / span 2`}} className={`${cc.dayCell} ${day===today?cc.todayCell:""} ${blocked?ui.blocked:""}`} onDoubleClick={()=>!blocked&&onNew(room,day)} onContextMenu={e=>{e.preventDefault();onBlock(room,day)}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const resize=e.dataTransfer.getData("application/x-hl-resize"),move=e.dataTransfer.getData("application/x-hl-move");if(resize)onResize(resize,addDays(day,1));else if(move)onMove(move,room.id,day)}}/>})}{list.map(r=>{const{startLine,endLine}=halfRange(r,days),t=tone(r,now),status=statusLabel(r,now),channel=channelLabel(r.canal_reserva),from=parts(occupancyStart(r)),to=parts(occupancyEnd(r));return <button key={r.id} draggable onDragStart={e=>e.dataTransfer.setData("application/x-hl-move",String(r.id))} onClick={()=>onOpen(r)} className={`${ui.stay} ${cc.stay} ${t==="in"?ui.stayIn:t==="out"?ui.stayOut:ui.stayFuture}`} style={{gridColumn:`${startLine} / ${endLine}`}} title={`${r.numero_reserva||"Reserva"} · ${r.nombre_huesped||"Huésped"} · ${stayKind(r)} · ${from.date} ${from.time} → ${to.date} ${to.time} · ${status} · ${channel}`}><span><b>{r.nombre_huesped}</b><small>{status} · {r.tipo_estadia==="day_use"?"DAY USE":channel}</small></span><i draggable onDragStart={e=>{e.stopPropagation();e.dataTransfer.setData("application/x-hl-resize",String(r.id))}} title="Arrastrar para cambiar salida"/></button>})}</div></div>})}
      {!filteredRooms.length&&<div className={cc.empty}>No hay habitaciones para estos filtros.</div>}
    </div>
  </section>
}