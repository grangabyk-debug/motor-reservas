"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./receptionReports.module.css"

const dateKey=date=>date.toLocaleDateString("en-CA")
const nextDay=value=>{const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+1);return dateKey(date)}
const normalize=value=>String(value||"").trim().toLowerCase()
const cancelled=row=>["cancelada","cancelled","anulada","anulado"].includes(normalize(row?.estado))
const roomIds=row=>[...new Set([row?.habitacion_id,...(row?.habitaciones_ids||[])].filter(Boolean).map(Number))]
const csvCell=value=>`"${String(value??"").replaceAll('"','""')}"`
function downloadCsv(name,header,rows){const csv=[header,...rows].map(row=>row.map(csvCell).join(",")).join("\n");const blob=new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function hasBreakfast(value){const key=normalize(value);return key.includes("desay")||key.includes("breakfast")||key.includes("media pens")||key.includes("pensión completa")||key.includes("pension completa")||key.includes("all inclusive")}

export default function ReceptionReportsWorkspace({propertyId,property}){
  const[day,setDay]=useState(()=>dateKey(new Date()))
  const[rooms,setRooms]=useState([]),[reservations,setReservations]=useState([]),[tasks,setTasks]=useState([]),[profiles,setProfiles]=useState(new Map())
  const[loading,setLoading]=useState(true),[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const tomorrow=nextDay(day)
      const[roomRes,reservationRes,taskRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,estado,sort_order").eq("property_id",propertyId).eq("activa",true).order("sort_order").order("nombre"),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,telefono_huesped,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show,cantidad_huespedes,regimen,hora_llegada_estimada,hora_salida_estimada,notas").eq("property_id",propertyId).lte("fecha_entrada",day).gte("fecha_salida",day).order("fecha_entrada"),
        supabase.from("hotel_housekeeping_tasks").select("id,room_id,task_type,status,assigned_to,scheduled_for,notes,updated_at").eq("property_id",propertyId).gte("scheduled_for",`${day}T00:00:00`).lt("scheduled_for",`${tomorrow}T00:00:00`).order("updated_at",{ascending:false}),
      ])
      for(const result of[roomRes,reservationRes,taskRes])if(result.error)throw result.error
      const taskRows=taskRes.data||[],profileIds=[...new Set(taskRows.map(row=>row.assigned_to).filter(Boolean))]
      const profileRes=profileIds.length?await supabase.from("profiles").select("id,full_name").in("id",profileIds):{data:[],error:null}
      if(profileRes.error)throw profileRes.error
      setRooms(roomRes.data||[]);setReservations(reservationRes.data||[]);setTasks(taskRows);setProfiles(new Map((profileRes.data||[]).map(row=>[row.id,row.full_name])))
    }catch(err){setError(err?.message||"No se pudieron cargar los reportes de recepción.")}
    finally{setLoading(false)}
  },[propertyId,day])
  useEffect(()=>{load()},[load])

  const roomMap=useMemo(()=>new Map(rooms.map(room=>[Number(room.id),room])),[rooms])
  const activeReservations=useMemo(()=>reservations.filter(row=>!cancelled(row)),[reservations])
  const roomLabel=useCallback(row=>roomIds(row).map(id=>roomMap.get(id)?.nombre).filter(Boolean).join(", ")||"Sin asignar",[roomMap])
  const arrivals=useMemo(()=>activeReservations.filter(row=>row.fecha_entrada===day),[activeReservations,day])
  const departures=useMemo(()=>activeReservations.filter(row=>row.fecha_salida===day),[activeReservations,day])
  const breakfasts=useMemo(()=>activeReservations.filter(row=>row.fecha_entrada<day&&row.fecha_salida>=day&&hasBreakfast(row.regimen)),[activeReservations,day])
  const reservationsByRoom=useMemo(()=>{const map=new Map();for(const reservation of activeReservations){for(const id of roomIds(reservation)){if(!map.has(id))map.set(id,[]);map.get(id).push(reservation)}}return map},[activeReservations])
  const taskByRoom=useMemo(()=>{const map=new Map();for(const task of tasks){const id=Number(task.room_id);if(id&&!map.has(id))map.set(id,task)}return map},[tasks])
  const housekeeping=useMemo(()=>rooms.map(room=>{
    const stays=reservationsByRoom.get(Number(room.id))||[],task=taskByRoom.get(Number(room.id))
    const arrival=stays.some(row=>row.fecha_entrada===day),departure=stays.some(row=>row.fecha_salida===day),inHouse=stays.some(row=>row.fecha_entrada<day&&row.fecha_salida>day)
    const operation=arrival&&departure?"Salida + llegada":departure?"Salida":arrival?"Llegada":inHouse?"Permanencia":"Libre"
    return{...room,operation,task,responsible:task?.assigned_to?profiles.get(task.assigned_to)||"Asignado":"—"}
  }),[rooms,reservationsByRoom,taskByRoom,profiles,day])

  const exports={
    arrivals:()=>downloadCsv(`recepcion-llegadas-${day}.csv`,["Reserva","Huésped","Habitación","Huéspedes","Hora estimada","Teléfono","Estado","Notas"],arrivals.map(row=>[row.numero_reserva||row.id,row.nombre_huesped,roomLabel(row),row.cantidad_huespedes||1,row.hora_llegada_estimada||"",row.telefono_huesped||"",row.no_show?"No-show":row.estado||"",row.notas||""])),
    departures:()=>downloadCsv(`recepcion-salidas-${day}.csv`,["Reserva","Huésped","Habitación","Huéspedes","Hora estimada","Estado","Notas"],departures.map(row=>[row.numero_reserva||row.id,row.nombre_huesped,roomLabel(row),row.cantidad_huespedes||1,row.hora_salida_estimada||"",row.estado||"",row.notas||""])),
    breakfasts:()=>downloadCsv(`recepcion-desayuno-${day}.csv`,["Huésped","Habitación","Huéspedes","Régimen","Observaciones"],breakfasts.map(row=>[row.nombre_huesped,roomLabel(row),row.cantidad_huespedes||1,row.regimen||"Desayuno",row.notas||""])),
    housekeeping:()=>downloadCsv(`recepcion-housekeeping-${day}.csv`,["Habitación","Tipo","Estado habitación","Operación","Tarea","Estado tarea","Responsable","Notas"],housekeeping.map(row=>[row.nombre,row.tipo||"",row.estado||"",row.operation,row.task?.task_type?.replaceAll("_"," ")||"",row.task?.status||"",row.responsible,row.task?.notes||""])),
  }

  return <section className={s.page}>
    <header className={s.header}><div><small>RECEPCIÓN · REPORTES</small><h1>Planillas operativas</h1><p>{property?.name||"Propiedad activa"} · reportes diarios listos para revisar, imprimir o descargar.</p></div><div className={s.actions}><input type="date" value={day} onChange={event=>setDay(event.target.value)}/><button type="button" onClick={load}>↻ Actualizar</button><button type="button" className={s.primary} onClick={()=>window.print()}>Imprimir / PDF</button></div></header>
    {error?<div className={s.notice}>{error}</div>:null}{loading?<div className={s.notice}>Actualizando planillas…</div>:null}
    <div className={s.metrics}><Metric label="Llegadas" value={arrivals.length} note="Check-in previstos"/><Metric label="Salidas" value={departures.length} note="Check-out previstos"/><Metric label="Desayunos" value={breakfasts.reduce((sum,row)=>sum+(Number(row.cantidad_huespedes)||1),0)} note={`${breakfasts.length} habitación${breakfasts.length===1?"":"es"}`}/><Metric label="Housekeeping" value={housekeeping.length} note={`${tasks.length} tarea${tasks.length===1?"":"s"} programada${tasks.length===1?"":"s"}`}/></div>
    <div className={s.grid}>
      <Report title="Llegadas / check-in" subtitle="Quién llega, a qué habitación y a qué hora." count={arrivals.length} onDownload={exports.arrivals} columns={["Reserva","Huésped","Habitación","Pax","Hora"]} rows={arrivals.map(row=>[row.numero_reserva||row.id,row.nombre_huesped,roomLabel(row),row.cantidad_huespedes||1,row.hora_llegada_estimada||"—"])}/>
      <Report title="Salidas / check-out" subtitle="Salidas previstas y horario estimado." count={departures.length} onDownload={exports.departures} columns={["Reserva","Huésped","Habitación","Pax","Hora"]} rows={departures.map(row=>[row.numero_reserva||row.id,row.nombre_huesped,roomLabel(row),row.cantidad_huespedes||1,row.hora_salida_estimada||"—"])}/>
      <Report title="Planilla de desayuno" subtitle="Huéspedes alojados con desayuno incluido." count={breakfasts.length} onDownload={exports.breakfasts} columns={["Huésped","Habitación","Pax","Régimen"]} rows={breakfasts.map(row=>[row.nombre_huesped,roomLabel(row),row.cantidad_huespedes||1,row.regimen||"Desayuno"])}/>
      <Report title="Planilla de housekeeping" subtitle="Estado de habitaciones, rotación y tareas del día." count={housekeeping.length} onDownload={exports.housekeeping} columns={["Habitación","Estado","Operación","Tarea"]} rows={housekeeping.map(row=>[row.nombre,row.estado||"—",row.operation,row.task?.task_type?.replaceAll("_"," ")||"—"])}/>
    </div>
  </section>
}

function Metric({label,value,note}){return <article className={s.metric}><span>{label}</span><b>{value}</b><small>{note}</small></article>}
function Report({title,subtitle,count,onDownload,columns,rows}){return <article className={s.report}><header><div><small>PLANILLA</small><h2>{title}</h2><p>{subtitle}</p></div><span className={s.count}>{count}</span></header><div className={s.table}><div className={s.head}>{columns.map(column=><span key={column}>{column}</span>)}</div>{rows.length?rows.slice(0,8).map((row,index)=><div className={s.row} key={index}>{row.map((value,cell)=><span key={cell}>{value}</span>)}</div>):<div className={s.empty}>No hay datos para esta fecha.</div>}</div><footer><span>{rows.length>8?`Vista previa de 8 · ${rows.length} filas en total`: `${rows.length} fila${rows.length===1?"":"s"}`}</span><button type="button" onClick={onDownload}>↓ Descargar CSV</button></footer></article>}
