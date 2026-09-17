"use client"

import{useEffect,useMemo,useState}from"react"
import{createPortal}from"react-dom"
import{supabase}from"../../../../lib/supabase"

const normalizeName=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ")
const normalizeEmail=value=>String(value||"").trim().toLowerCase()
const normalizePhone=value=>String(value||"").replace(/\D/g,"")
const uniqueRoomIds=item=>[...new Set([item?.habitacion_id,...(item?.habitaciones_ids||[])].filter(Boolean).map(Number))]
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"—"
const roomIds=item=>uniqueRoomIds(item)
const overlap=(aStart,aEnd,bStart,bEnd)=>String(aStart||"")<String(bEnd||"")&&String(bStart||"")<String(aEnd||"")
function identityReason(a,b){
  if(a?.guest_profile_id&&String(a.guest_profile_id)===String(b?.guest_profile_id))return"Mismo huésped del CRM"
  const aEmail=normalizeEmail(a?.email_huesped),bEmail=normalizeEmail(b?.email_huesped);if(aEmail&&aEmail===bEmail)return"Mismo email"
  const aPhone=normalizePhone(a?.telefono_huesped),bPhone=normalizePhone(b?.telefono_huesped);if(aPhone.length>=6&&aPhone===bPhone)return"Mismo teléfono"
  const aName=normalizeName(a?.nombre_huesped),bName=normalizeName(b?.nombre_huesped);if(aName&&aName===bName)return"Mismo nombre"
  return""
}
const statusLabel=item=>item?.estado==="alojado"?"En hotel":item?.estado==="finalizada"?"Finalizada":item?.estado==="pendiente"?"Pendiente":"Confirmada"

export default function ReservationRestoreCancelledDialog({item,rooms=[],reservations=[],saving=false,error="",onClose,onConfirm}){
  const[portalRoot,setPortalRoot]=useState(null)
  const[start,setStart]=useState(item?.fecha_entrada||"")
  const[end,setEnd]=useState(item?.fecha_salida||"")
  const[selectedRooms,setSelectedRooms]=useState(()=>uniqueRoomIds(item))
  const[blocks,setBlocks]=useState([])
  const[ackDuplicate,setAckDuplicate]=useState(false)
  const[loadingBlocks,setLoadingBlocks]=useState(false)

  useEffect(()=>{if(!item||typeof document==="undefined"){setPortalRoot(null);return}setPortalRoot(document.querySelector("[data-theme]")||document.body)},[item])
  useEffect(()=>{if(!item)return;setStart(item.fecha_entrada||"");setEnd(item.fecha_salida||"");setSelectedRooms(uniqueRoomIds(item));setAckDuplicate(false)},[item?.id])
  useEffect(()=>{
    if(!item?.property_id||!start||!end||end<=start){setBlocks([]);return}
    let cancelled=false
    setLoadingBlocks(true)
    ;(async()=>{const{data}=await supabase.from("bloqueos").select("id,habitacion_id,fecha_desde,fecha_hasta,motivo").eq("property_id",item.property_id).lt("fecha_desde",end).gt("fecha_hasta",start);if(!cancelled)setBlocks(data||[]);setLoadingBlocks(false)})()
    return()=>{cancelled=true}
  },[item?.property_id,start,end])

  const oldRoomIds=useMemo(()=>uniqueRoomIds(item),[item])
  const roomCount=Math.max(1,oldRoomIds.length)
  const activeRooms=useMemo(()=>rooms.filter(room=>room?.activa!==false&&!['mantenimiento','fuera_servicio'].includes(String(room?.estado||"").toLowerCase())),[rooms])
  const similar=useMemo(()=>reservations.filter(row=>Number(row.id)!==Number(item?.id)&&row.estado!=="cancelada"&&row.estado!=="fusionada"&&!row.no_show&&overlap(start,end,row.fecha_entrada,row.fecha_salida)).map(row=>({row,reason:identityReason(item,row)})).filter(entry=>entry.reason),[reservations,item,start,end])
  const occupiedByRoom=useMemo(()=>{const map=new Map();for(const row of reservations){if(Number(row.id)===Number(item?.id)||row.estado==="cancelada"||row.estado==="fusionada"||row.no_show||!overlap(start,end,row.fecha_entrada,row.fecha_salida))continue;for(const id of roomIds(row))if(!map.has(id))map.set(id,row)}return map},[reservations,item,start,end])
  const blockByRoom=useMemo(()=>{const map=new Map();for(const block of blocks){const id=Number(block.habitacion_id);if(!map.has(id))map.set(id,block)}return map},[blocks])
  const selectedSet=new Set(selectedRooms.map(Number))
  const duplicateRoom=selectedRooms.length!==selectedSet.size
  const invalidDates=!start||!end||end<=start
  const roomProblems=selectedRooms.map(id=>({id:Number(id),reservation:occupiedByRoom.get(Number(id)),block:blockByRoom.get(Number(id))})).filter(problem=>problem.reservation||problem.block)
  const selectionComplete=selectedRooms.length===roomCount&&selectedRooms.every(Boolean)
  const requiresAck=similar.length>0
  const canRestore=!saving&&!invalidDates&&selectionComplete&&!duplicateRoom&&!roomProblems.length&&(!requiresAck||ackDuplicate)
  const roomName=id=>rooms.find(room=>Number(room.id)===Number(id))?.nombre||`Hab. ${id}`
  const originalChanged=start!==item?.fecha_entrada||end!==item?.fecha_salida||selectedRooms.some((id,index)=>Number(id)!==Number(oldRoomIds[index]))

  function setRoom(index,value){setSelectedRooms(current=>{const next=[...current];next[index]=Number(value)||0;return next})}
  if(!item||!portalRoot)return null

  const card={border:"1px solid var(--line)",borderRadius:14,background:"color-mix(in srgb,var(--panelSolid) 92%,transparent)"}
  const field={height:42,border:"1px solid var(--line)",borderRadius:11,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:12,padding:"0 11px",width:"100%"}
  const button={height:38,border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11.5,fontWeight:850,padding:"0 13px",cursor:"pointer"}
  const dialog=<div role="dialog" aria-modal="true" aria-label="Restaurar reserva cancelada" style={{position:"fixed",inset:0,zIndex:120,display:"grid",placeItems:"center",padding:18,background:"rgba(9,14,25,.48)",backdropFilter:"blur(10px)"}}>
    <div style={{width:"min(860px,calc(100vw - 32px))",maxHeight:"calc(100dvh - 36px)",overflow:"auto",border:"1px solid color-mix(in srgb,var(--accent) 20%,var(--line))",borderRadius:22,background:"color-mix(in srgb,var(--panelSolid) 97%,transparent)",boxShadow:"0 28px 90px rgba(0,0,0,.28)",color:"var(--text)"}}>
      <header style={{position:"sticky",top:0,zIndex:3,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"20px 22px 16px",borderBottom:"1px solid var(--line)",background:"color-mix(in srgb,var(--panelSolid) 96%,transparent)",backdropFilter:"blur(18px)"}}>
        <div><small style={{display:"block",fontSize:10,letterSpacing:".1em",fontWeight:900,color:"var(--accent)"}}>RESTAURAR RESERVA</small><h2 style={{margin:"4px 0 3px",fontSize:23,letterSpacing:"-.025em"}}>{item.nombre_huesped||"Reserva cancelada"}</h2><p style={{margin:0,fontSize:11.5,color:"var(--muted)"}}>{item.numero_reserva||`Reserva ${item.id}`} · Restaurar vuelve a activar esta misma reserva, conservando pagos, folios e historial.</p></div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar" style={{...button,width:38,padding:0,fontSize:18}}>×</button>
      </header>
      <div style={{padding:20,display:"grid",gap:14}}>
        <section style={{...card,padding:14,display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:12}}>
          <div><small style={{display:"block",fontSize:9.5,fontWeight:900,color:"var(--muted)",letterSpacing:".07em"}}>RESERVA ORIGINAL</small><b style={{display:"block",marginTop:4,fontSize:13}}>{fmtDate(item.fecha_entrada)} → {fmtDate(item.fecha_salida)}</b><span style={{display:"block",marginTop:3,fontSize:11,color:"var(--muted)"}}>{oldRoomIds.map(roomName).join(" · ")||"Sin habitación"}</span></div>
          <div><small style={{display:"block",fontSize:9.5,fontWeight:900,color:"var(--muted)",letterSpacing:".07em"}}>ANTES DE RESTAURAR</small><b style={{display:"block",marginTop:4,fontSize:13}}>Confirmá fechas y habitación</b><span style={{display:"block",marginTop:3,fontSize:11,color:"var(--muted)"}}>El sistema vuelve a validar disponibilidad en el momento de guardar.</span></div>
        </section>

        {similar.length?<section style={{...card,padding:14,borderColor:"color-mix(in srgb,#d79320 42%,var(--line))",background:"color-mix(in srgb,#d79320 7%,var(--panelSolid))"}}><small style={{display:"block",fontSize:9.5,fontWeight:900,letterSpacing:".08em",color:"#b87917"}}>POSIBLE RESERVA DUPLICADA</small><b style={{display:"block",marginTop:3,fontSize:13}}>Ya existe {similar.length===1?"una reserva similar":"más de una reserva similar"} para esas fechas.</b><div style={{display:"grid",gap:7,marginTop:10}}>{similar.slice(0,4).map(({row,reason})=><div key={row.id} style={{padding:"9px 10px",border:"1px solid color-mix(in srgb,#d79320 25%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--panelSolid) 90%,transparent)"}}><div style={{display:"flex",justifyContent:"space-between",gap:10}}><b style={{fontSize:11.5}}>{row.nombre_huesped||"Huésped"}</b><span style={{fontSize:9.5,fontWeight:900,color:"#b87917"}}>{reason}</span></div><small style={{display:"block",marginTop:3,fontSize:10.5,color:"var(--muted)"}}>{row.numero_reserva||row.id} · {statusLabel(row)} · {fmtDate(row.fecha_entrada)} → {fmtDate(row.fecha_salida)} · {roomIds(row).map(roomName).join(", ")||"Sin habitación"}</small></div>)}</div><label style={{display:"flex",alignItems:"flex-start",gap:9,marginTop:11,padding:"10px 11px",borderRadius:10,background:"color-mix(in srgb,var(--panelSolid) 82%,transparent)",fontSize:11.5,fontWeight:750,cursor:"pointer"}}><input type="checkbox" checked={ackDuplicate} onChange={event=>setAckDuplicate(event.target.checked)} style={{marginTop:2}}/><span>Entiendo que ya existe una reserva similar y quiero restaurar esta igualmente.</span></label></section>:null}

        <section style={{...card,padding:14}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"baseline",flexWrap:"wrap"}}><div><small style={{display:"block",fontSize:9.5,fontWeight:900,letterSpacing:".08em",color:"var(--accent)"}}>NUEVA VIGENCIA</small><b style={{display:"block",marginTop:3,fontSize:13}}>Fechas a reactivar</b></div>{originalChanged?<span style={{fontSize:10.5,color:"#b87917",fontWeight:800}}>Se modificó respecto de la reserva original</span>:<span style={{fontSize:10.5,color:"var(--muted)"}}>Se mantienen las fechas originales</span>}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:11}}><label style={{display:"grid",gap:5,fontSize:10.5,fontWeight:800}}>Llegada<input type="date" value={start} onChange={event=>{setStart(event.target.value);setAckDuplicate(false)}} style={field}/></label><label style={{display:"grid",gap:5,fontSize:10.5,fontWeight:800}}>Salida<input type="date" value={end} min={start||undefined} onChange={event=>{setEnd(event.target.value);setAckDuplicate(false)}} style={field}/></label></div>{invalidDates?<div style={{marginTop:8,fontSize:10.5,color:"var(--red)",fontWeight:800}}>La salida tiene que ser posterior a la llegada.</div>:null}</section>

        <section style={{...card,padding:14}}><small style={{display:"block",fontSize:9.5,fontWeight:900,letterSpacing:".08em",color:"var(--accent)"}}>ASIGNACIÓN</small><b style={{display:"block",marginTop:3,fontSize:13}}>{roomCount===1?"Elegí la habitación":"Elegí las habitaciones del grupo"}</b><span style={{display:"block",marginTop:3,fontSize:10.5,color:"var(--muted)"}}>Aunque la habitación original siga libre, la confirmás acá antes de volver al Planning.</span><div style={{display:"grid",gap:9,marginTop:11}}>{Array.from({length:roomCount}).map((_,index)=>{const currentId=Number(selectedRooms[index]||0),reservation=occupiedByRoom.get(currentId),block=blockByRoom.get(currentId),problem=reservation||block;return <div key={index} style={{display:"grid",gridTemplateColumns:"110px minmax(0,1fr) 170px",gap:9,alignItems:"center"}}><div><small style={{display:"block",fontSize:9.5,color:"var(--muted)"}}>Habitación {index+1}</small><b style={{fontSize:11}}>{oldRoomIds[index]?`Original: ${roomName(oldRoomIds[index])}`:"Asignación"}</b></div><select value={currentId||""} onChange={event=>setRoom(index,event.target.value)} style={field}><option value="">Seleccionar habitación</option>{activeRooms.map(room=>{const id=Number(room.id),usedElsewhere=selectedRooms.some((selected,selectedIndex)=>selectedIndex!==index&&Number(selected)===id),occupied=occupiedByRoom.get(id),blocked=blockByRoom.get(id),suffix=occupied?` · ocupada por ${occupied.nombre_huesped||occupied.numero_reserva||"otra reserva"}`:blocked?` · bloqueada${blocked.motivo?` (${blocked.motivo})`:""}`:usedElsewhere?" · ya elegida":" · disponible";return <option key={id} value={id} disabled={usedElsewhere||Boolean(occupied)||Boolean(blocked)}>{room.nombre||`Hab. ${id}`}{suffix}</option>})}</select><div style={{fontSize:10.5,fontWeight:850,color:problem?"var(--red)":"var(--green)"}}>{problem?reservation?`Ocupada · ${reservation.numero_reserva||reservation.id}`:`Bloqueada${block?.motivo?` · ${block.motivo}`:""}`:currentId?"Disponible":"Elegí una habitación"}</div></div>})}</div>{loadingBlocks?<small style={{display:"block",marginTop:8,fontSize:10,color:"var(--muted)"}}>Comprobando bloqueos…</small>:null}{duplicateRoom?<div style={{marginTop:8,fontSize:10.5,color:"var(--red)",fontWeight:800}}>No podés usar la misma habitación más de una vez.</div>:null}{roomProblems.length?<div style={{marginTop:8,fontSize:10.5,color:"var(--red)",fontWeight:800}}>Cambiá las habitaciones marcadas como ocupadas o bloqueadas para poder restaurar.</div>:null}</section>

        {Number(item.cancellation_penalty_amount||0)>0?<div style={{...card,padding:"11px 13px",borderColor:"color-mix(in srgb,#d79320 32%,var(--line))",fontSize:10.5,color:"var(--muted)"}}><b style={{color:"var(--text)"}}>Atención con la penalidad de cancelación.</b> Esta reserva registra un importe de cancelación. La restauración no borra movimientos financieros ni comprobantes: revisá el folio después de reactivarla.</div>:null}
        {error?<div style={{...card,padding:"11px 13px",borderColor:"color-mix(in srgb,var(--red) 35%,var(--line))",background:"color-mix(in srgb,var(--red) 6%,var(--panelSolid))",fontSize:11,color:"var(--red)",fontWeight:800}}>{error}</div>:null}
      </div>
      <footer style={{position:"sticky",bottom:0,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"13px 20px",borderTop:"1px solid var(--line)",background:"color-mix(in srgb,var(--panelSolid) 96%,transparent)",backdropFilter:"blur(18px)"}}><span style={{fontSize:10.5,color:"var(--muted)"}}>No se reactiva nada hasta confirmar. La validación final vuelve a ejecutarse en base de datos.</span><div style={{display:"flex",gap:8}}><button type="button" onClick={onClose} disabled={saving} style={button}>Cancelar</button><button type="button" disabled={!canRestore} onClick={()=>onConfirm?.({start,end,roomIds:selectedRooms.map(Number),confirmDuplicate:ackDuplicate})} style={{...button,borderColor:"transparent",background:"linear-gradient(145deg,var(--accent),var(--accent2))",color:"#fff",opacity:canRestore?1:.45,cursor:canRestore?"pointer":"not-allowed",minWidth:145}}>{saving?"Restaurando…":"Restaurar reserva"}</button></div></footer>
    </div>
  </div>
  return createPortal(dialog,portalRoot)
}
