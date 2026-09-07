"use client"

import{useMemo,useState}from"react"
import{addDays,money,unique}from"./reservationEditUtils"

export default function ReservationAddRoomControl({item,draft,setDraft,allRooms=[],currentIds=[],busy=false,serviceLocked=false,onPreviewMove,onStatus}){
  const[open,setOpen]=useState(false),[roomId,setRoomId]=useState(""),[checking,setChecking]=useState(false),[error,setError]=useState("")
  const ids=unique(draft.roomIds?.length?draft.roomIds:[draft.roomId]),selectionKey=ids.join("|")
  const availableRooms=useMemo(()=>allRooms.filter(room=>room.activa!==false&&!ids.includes(String(room.id))&&!['mantenimiento','fuera_servicio'].includes(String(room.estado||'').toLowerCase())),[allRooms,selectionKey])
  const addedIds=ids.filter(id=>!currentIds.includes(id))
  const selectedRooms=ids.map(id=>allRooms.find(room=>String(room.id)===id)).filter(Boolean)
  const disabled=busy||serviceLocked
  const status=(nextError="",ok="")=>onStatus?.({error:nextError,ok})

  function startAdd(){
    if(disabled)return
    if(!availableRooms.length){status("No hay otras habitaciones activas para añadir a esta reserva.","");return}
    setRoomId("");setError("");setOpen(true)
  }
  async function addRoom(){
    if(checking||!roomId)return
    const room=availableRooms.find(value=>String(value.id)===String(roomId))
    if(!room){setError("Elegí una habitación válida.");return}
    const start=draft.earlyCheckin?addDays(draft.start,-1):draft.start,end=draft.lateCheckout?addDays(draft.end,1):draft.end
    setChecking(true);setError("")
    try{
      const preview=await onPreviewMove({reservationId:item.id,roomId:Number(room.id),start,end})
      if(!preview?.ok){setError(String(preview?.message||"La habitación no está disponible para esas fechas.").replace(/^No se puede aplicar el cambio:\s*/,""));return}
      setDraft(current=>{
        const nextIds=unique([...(current.roomIds?.length?current.roomIds:[current.roomId]),String(room.id)]),assignments={...(current.roomAssignments||{})}
        assignments[String(room.id)]={soldAs:room.tipo||"Habitación",guests:0,matrimonial:0,individual:0,rate:Math.max(0,Number(room.precio)||0)}
        return{...current,roomId:nextIds[0]||String(room.id),roomIds:nextIds,roomAssignments:assignments}
      })
      status("",`Hab. ${room.nombre} añadida a la reserva · revisá huéspedes, Rooming y tarifa antes de guardar.`);setOpen(false);setRoomId("")
    }catch(err){setError(err?.message||"No se pudo comprobar la disponibilidad de la habitación.")}
    finally{setChecking(false)}
  }
  function removeAdded(roomIdToRemove){
    const id=String(roomIdToRemove)
    if(currentIds.includes(id)||disabled)return
    const room=allRooms.find(value=>String(value.id)===id)
    setDraft(current=>{
      const nextIds=unique(current.roomIds?.length?current.roomIds:[current.roomId]).filter(value=>value!==id)
      if(!nextIds.length)return current
      const assignments={...(current.roomAssignments||{})};delete assignments[id]
      return{...current,roomIds:nextIds,roomId:nextIds.includes(String(current.roomId))?String(current.roomId):nextIds[0],roomAssignments:assignments}
    })
    status("",room?`Hab. ${room.nombre} quitada de los cambios pendientes.`:"Habitación quitada de los cambios pendientes.")
  }

  const button={height:36,padding:"0 12px",border:"1px solid color-mix(in srgb,var(--accent) 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--accent) 7%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:10.5,fontWeight:900,cursor:disabled?"not-allowed":"pointer"}
  const overlay={position:"fixed",inset:0,zIndex:260,display:"grid",placeItems:"center",padding:18,background:"rgba(9,16,32,.38)",backdropFilter:"blur(9px) saturate(1.15)",WebkitBackdropFilter:"blur(9px) saturate(1.15)"}
  const shell={width:"min(470px,calc(100vw - 28px))",padding:18,border:"1px solid color-mix(in srgb,#fff 34%,var(--line))",borderRadius:20,background:"color-mix(in srgb,var(--panelSolid) 88%,transparent)",boxShadow:"inset 0 1px color-mix(in srgb,#fff 58%,transparent),0 30px 90px rgba(18,30,58,.28)",backdropFilter:"blur(32px) saturate(1.45)",WebkitBackdropFilter:"blur(32px) saturate(1.45)"}
  const label={display:"grid",gap:5,fontSize:10,fontWeight:850,color:"var(--muted)"}
  const control={height:39,width:"100%",border:"1px solid var(--line)",borderRadius:10,padding:"0 10px",background:"color-mix(in srgb,var(--panelSolid) 82%,transparent)",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:760,outline:"none"}

  return <>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:11,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>{addedIds.length?<><small style={{fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>POR AGREGAR</small>{addedIds.map(id=>{const room=selectedRooms.find(value=>String(value.id)===id);return <button key={id} type="button" disabled={disabled} onClick={()=>removeAdded(id)} title="Quitar esta habitación antes de guardar" style={{height:28,padding:"0 8px",border:"1px solid color-mix(in srgb,var(--accent) 22%,var(--line))",borderRadius:999,background:"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))",color:"var(--text)",font:"inherit",fontSize:9.5,fontWeight:800}}>Hab. {room?.nombre||id} ×</button>})}</>:<small style={{fontSize:9.8,color:"var(--muted)"}}>¿La reserva necesita otra habitación? Se suma al mismo pasajero y a la misma cuenta.</small>}</div>
      <button type="button" disabled={disabled||!availableRooms.length} onClick={startAdd} style={{...button,opacity:disabled||!availableRooms.length?.55:1}} title={!availableRooms.length?"No hay otras habitaciones activas para añadir":"Añadir otra habitación a esta reserva"}>＋ Añadir habitación</button>
    </div>
    {open?<div style={overlay} onMouseDown={event=>event.target===event.currentTarget&&!checking&&setOpen(false)}><section role="dialog" aria-modal="true" aria-label="Añadir habitación a la reserva" style={shell}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14}}><div><small style={{fontSize:9.5,fontWeight:900,letterSpacing:".1em",color:"var(--accent)"}}>MISMA RESERVA</small><h3 style={{margin:"4px 0 0",fontSize:18}}>Añadir habitación</h3><p style={{margin:"5px 0 0",fontSize:10.5,lineHeight:1.45,color:"var(--muted)"}}>Se agregará a la reserva de <b style={{color:"var(--text)"}}>{item.nombre_huesped}</b>, con las mismas fechas {draft.start} → {draft.end}. Disponibilidad y bloqueos se validan contra el Planning.</p></div><button type="button" disabled={checking} onClick={()=>setOpen(false)} style={{width:34,height:34,border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)",color:"var(--text)",fontSize:18}}>×</button></div><label style={{...label,marginTop:15}}>Habitación física<select autoFocus style={control} value={roomId} onChange={event=>{setRoomId(event.target.value);setError("")}}><option value="">Seleccionar habitación…</option>{availableRooms.map(room=><option key={room.id} value={room.id}>Hab. {room.nombre} · {room.tipo||"Sin categoría"} · {money(room.precio,item.moneda)}/noche</option>)}</select></label>{error?<div style={{marginTop:10,padding:"9px 10px",border:"1px solid color-mix(in srgb,var(--red) 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--red) 7%,var(--panelSolid))",color:"var(--red)",fontSize:10.5,fontWeight:800}}>{error}</div>:null}<div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:15,paddingTop:12,borderTop:"1px solid var(--line)"}}><button type="button" disabled={checking} onClick={()=>setOpen(false)} style={{height:38,padding:"0 13px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)",color:"var(--text)",font:"inherit",fontWeight:800}}>Cancelar</button><button type="button" disabled={checking||!roomId} onClick={addRoom} style={{height:38,padding:"0 14px",border:0,borderRadius:10,background:"linear-gradient(145deg,var(--accent),var(--accent2))",color:"#fff",font:"inherit",fontWeight:850,opacity:checking||!roomId?.6:1}}>{checking?"Comprobando…":"Añadir habitación"}</button></div></section></div>:null}
  </>
}
