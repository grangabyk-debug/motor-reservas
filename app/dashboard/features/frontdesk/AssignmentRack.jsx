"use client"

import{useMemo,useState}from"react"
import{isoDate,shortDate}from"../../core/formatters"
import styles from"./assignment-rack.module.css"

const active=r=>r&&r.estado!=="cancelada"&&!r.no_show&&r.estado!=="finalizada"
const overlaps=(aStart,aEnd,bStart,bEnd)=>String(aStart||"")<String(bEnd||"")&&String(aEnd||"")>String(bStart||"")
const cleanState=value=>String(value||"").trim().toLowerCase().replace(/\s+/g,"_")
const initials=name=>String(name||"H").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"H"

export default function AssignmentRack({rooms=[],reservations=[],blocks=[],floors=[],onMove,onOpen,onClose}){
  const[date,setDate]=useState(isoDate()),[selectedId,setSelectedId]=useState(""),[allowUpgrade,setAllowUpgrade]=useState(true),[busy,setBusy]=useState(false)
  const arrivals=useMemo(()=>reservations.filter(r=>active(r)&&String(r.fecha_entrada)===date).sort((a,b)=>String(a.hora_llegada_estimada||"99:99").localeCompare(String(b.hora_llegada_estimada||"99:99"))),[reservations,date])
  const selected=arrivals.find(r=>String(r.id)===String(selectedId))||arrivals[0]||null
  const currentRoom=selected?rooms.find(r=>String(r.id)===String(selected.habitacion_id)):null
  const desiredType=String(currentRoom?.tipo||selected?.tipo_habitacion||selected?.habitaciones_detalle?.[0]?.tipo||"").trim()
  const floorRows=useMemo(()=>{
    const activeFloors=floors.filter(f=>f.active!==false).map(f=>({id:String(f.id),name:f.name||`Piso ${f.sort_order||""}`})),known=new Set(activeFloors.map(f=>f.id)),result=activeFloors.map(f=>({...f,rooms:rooms.filter(r=>r.activa!==false&&String(r.floor_id||"")===f.id)})).filter(f=>f.rooms.length)
    const orphan=rooms.filter(r=>r.activa!==false&&!known.has(String(r.floor_id||"")));if(orphan.length)result.push({id:"none",name:"Sin piso",rooms:orphan});return result
  },[rooms,floors])

  function roomState(room){
    if(!selected)return{disabled:true,tone:"neutral",label:"—"}
    const roomId=String(room.id),thirdParty=reservations.find(r=>active(r)&&String(r.id)!==String(selected.id)&&String(r.habitacion_id)===roomId&&overlaps(selected.fecha_entrada,selected.fecha_salida,r.fecha_entrada,r.fecha_salida)),block=blocks.find(b=>String(b.habitacion_id)===roomId&&String(b.fecha_desde||"")<String(selected.fecha_salida||"")&&String(b.fecha_hasta||"")>String(selected.fecha_entrada||"")),state=cleanState(room.estado)
    if(thirdParty)return{disabled:true,tone:"occupied",label:"Ocupada",detail:thirdParty.nombre_huesped||"Otra reserva"}
    if(block||["mantenimiento","fuera_servicio","fuera_de_servicio"].includes(state))return{disabled:true,tone:"blocked",label:"Bloqueada",detail:block?.motivo||block?.detalle||room.estado||"Fuera de servicio"}
    if(["sucia","limpieza","en_limpieza","inspeccion"].includes(state))return{disabled:true,tone:"dirty",label:state==="sucia"?"Sucia":"Limpieza",detail:"Housekeeping pendiente"}
    if(!allowUpgrade&&desiredType&&String(room.tipo||"").trim()!==desiredType)return{disabled:true,tone:"other",label:"Otra tipología",detail:desiredType}
    if(String(room.id)===String(selected.habitacion_id))return{disabled:true,tone:"current",label:"Actual",detail:"Ya asignada"}
    return{disabled:false,tone:"ready",label:"Lista",detail:room.tipo||"Habitación"}
  }

  async function assign(room){if(!selected||busy)return;setBusy(true);try{await onMove?.(selected.id,room.id,selected.fecha_entrada)}finally{setBusy(false)}}

  return <section className={styles.wrap}>
    <header><div><small>RACK DE ASIGNACIONES</small><h3>Colocá las llegadas en su habitación</h3><p>Elegí una llegada y después una habitación. Respeta ocupación, bloqueos y housekeeping.</p></div><div className={styles.headerActions}><label><span>Fecha</span><input type="date" value={date} onChange={e=>{setDate(e.target.value);setSelectedId("")}}/></label><button type="button" className={allowUpgrade?styles.toggleOn:""} onClick={()=>setAllowUpgrade(v=>!v)}><i/>{allowUpgrade?"Upgrade permitido":"Misma tipología"}</button><button type="button" className={styles.close} onClick={onClose}>×</button></div></header>
    <div className={styles.body}>
      <aside className={styles.arrivals}><div className={styles.sectionTitle}><b>Llegadas</b><span>{arrivals.length}</span></div>{arrivals.length?arrivals.map(r=>{const room=rooms.find(x=>String(x.id)===String(r.habitacion_id));return <button type="button" key={r.id} className={String(selected?.id)===String(r.id)?styles.arrivalSelected:""} onClick={()=>setSelectedId(String(r.id))} onDoubleClick={()=>onOpen?.(r)}><i>{initials(r.nombre_huesped)}</i><span><b>{r.nombre_huesped||"Sin nombre"}</b><small>{r.cantidad_huespedes||1} pax · {r.hora_llegada_estimada||"Horario pendiente"}</small><em>{room?`${room.nombre} · ${room.tipo||""}`:"Sin habitación"}</em></span></button>}):<div className={styles.empty}>No hay llegadas para {shortDate(date)}.</div>}</aside>
      <main className={styles.map}><div className={styles.mapHead}><div><b>{selected?.nombre_huesped||"Seleccioná una llegada"}</b><small>{selected?`${shortDate(selected.fecha_entrada)} → ${shortDate(selected.fecha_salida)}${desiredType?` · ${desiredType}`:""}`:"Después elegí una habitación disponible"}</small></div><div className={styles.legend}><span><i data-tone="ready"/>Lista</span><span><i data-tone="dirty"/>Sucia</span><span><i data-tone="occupied"/>Ocupada</span><span><i data-tone="blocked"/>Bloqueada</span></div></div>
        <div className={styles.floors}>{floorRows.map(floor=><section key={floor.id}><header><b>{floor.name}</b><small>{floor.rooms.length} habitaciones</small></header><div>{floor.rooms.map(room=>{const state=roomState(room);return <button type="button" key={room.id} data-tone={state.tone} disabled={state.disabled||busy} title={state.detail||state.label} onClick={()=>assign(room)}><b>{room.nombre}</b><small>{room.tipo||"Habitación"}</small><em>{state.label}</em></button>})}</div></section>)}</div>
      </main>
    </div>
  </section>
}
