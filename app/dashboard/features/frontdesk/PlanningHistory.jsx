"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{shortDate}from"../../core/formatters"
import ph from"./planning-history.module.css"

const LABELS={move:"Reserva movida",resize:"Salida ajustada",change_room:"Cambio de habitación",swap:"Intercambio de habitaciones"}
const roomId=state=>state?.habitacion_id==null?"":String(state.habitacion_id)
const fmtTime=value=>{if(!value)return"";const d=new Date(value);return d.toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).replace(".","")}

export default function PlanningHistory({propertyId,rooms=[]}){
  const[open,setOpen]=useState(false),[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(""),[message,setMessage]=useState("")
  const names=useMemo(()=>new Map(rooms.map(r=>[String(r.id),r.nombre||`Hab. ${r.id}`])),[rooms])
  async function load(){if(!propertyId)return;setLoading(true);const{data,error}=await supabase.from("hotel_planning_operation_log").select("operation_group,action,reservation_id,before_state,after_state,meta,created_at,undone_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(80);if(!error)setRows(data||[]);else setMessage(error.message||"No se pudo cargar el historial.");setLoading(false)}
  useEffect(()=>{if(open)load()},[open,propertyId])
  const operations=useMemo(()=>{const map=new Map();for(const row of rows){if(!map.has(row.operation_group))map.set(row.operation_group,{id:row.operation_group,action:row.action,created_at:row.created_at,undone_at:row.undone_at,rows:[]});const op=map.get(row.operation_group);op.rows.push(row);if(row.undone_at)op.undone_at=row.undone_at}return[...map.values()].slice(0,18)},[rows])
  const roomName=id=>names.get(String(id||""))||(id?`Hab. ${id}`:"Sin habitación")
  function detail(op){if(op.action==="swap"){const guests=op.rows.map(r=>r.meta?.guest).filter(Boolean);return guests.length?guests.join(" ↔ "):"Dos reservas intercambiadas"}const row=op.rows[0],before=row?.before_state||{},after=row?.after_state||{},parts=[];if(roomId(before)!==roomId(after))parts.push(`${roomName(before.habitacion_id)} → ${roomName(after.habitacion_id)}`);if(before.fecha_entrada!==after.fecha_entrada)parts.push(`${shortDate(before.fecha_entrada)} → ${shortDate(after.fecha_entrada)}`);if(before.fecha_salida!==after.fecha_salida)parts.push(`salida ${shortDate(before.fecha_salida)} → ${shortDate(after.fecha_salida)}`);return parts.join(" · ")||row?.meta?.guest||"Cambio operativo"}
  async function undo(op){if(busy)return;setBusy(op.id);setMessage("");const{error}=await supabase.rpc("hl_undo_planning_operation_atomic",{p_operation_group:op.id});if(error)setMessage(error.message||"No se pudo deshacer la operación.");else{setMessage("Operación deshecha. El Planning volvió al estado anterior.");await load()}setBusy("")}
  return <div className={ph.root}><button type="button" className={`${ph.trigger} ${open?ph.active:""}`} onClick={()=>setOpen(v=>!v)}>↶ Historial</button>{open&&<div className={ph.popover}>
    <header><div><small>HISTORIAL DEL PLANNING</small><b>Cambios recientes</b><span>Movimientos, cambios de habitación y swaps con deshacer seguro.</span></div><button type="button" onClick={()=>setOpen(false)}>×</button></header>
    <div className={ph.list}>{loading&&<p className={ph.empty}>Cargando actividad…</p>}{!loading&&!operations.length&&<p className={ph.empty}>Todavía no hay cambios auditados en este Planning.</p>}{operations.map(op=><article key={op.id} data-undone={op.undone_at?"true":"false"}><div className={ph.icon}>{op.action==="swap"?"⇄":op.action==="resize"?"↔":"↗"}</div><div className={ph.copy}><b>{LABELS[op.action]||"Cambio en Planning"}</b><p>{detail(op)}</p><small>{fmtTime(op.created_at)}{op.undone_at?` · deshecho ${fmtTime(op.undone_at)}`:""}</small></div>{op.undone_at?<em>DESHECHO</em>:<button type="button" disabled={busy===op.id} onClick={()=>undo(op)}>{busy===op.id?"Volviendo…":"Deshacer"}</button>}</article>)}</div>
    {message&&<div className={ph.message}>{message}</div>}
    <footer>El deshacer se bloquea si la reserva fue modificada después, para no pisar cambios más nuevos.</footer>
  </div>}</div>
}
