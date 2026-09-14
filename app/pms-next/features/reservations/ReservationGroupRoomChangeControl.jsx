"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))
const normalize=value=>String(value||"").trim().toLowerCase()
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const roomIds=item=>[...new Set([item?.habitacion_id,...(item?.habitaciones_ids||[])].filter(Boolean).map(Number))]
const detailFor=(item,roomId)=>(Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]).find(row=>Number(row?.habitacion_id)===Number(roomId))||{}
const roomStart=(item,roomId)=>{const value=detailFor(item,roomId)?.fecha_entrada;return validDate(value)?String(value):item?.fecha_entrada}
const roomPlannedEnd=(item,roomId)=>{const value=detailFor(item,roomId)?.fecha_salida;return validDate(value)?String(value):item?.fecha_salida}
const roomEnd=(item,roomId)=>{const planned=roomPlannedEnd(item,roomId),release=item?.room_checkout_dates?.[String(roomId)];return validDate(release)&&String(release)<planned?String(release):planned}
const round=value=>Math.round((Number(value)||0)*100)/100
const pad=value=>String(value).padStart(2,"0")
const todayKey=()=>{const date=new Date();return`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
const prettyDate=value=>{if(!validDate(value))return value||"—";const[y,m,d]=String(value).split("-");return`${d}/${m}/${y}`}
const inHouseState=value=>["alojado","inhouse","in_house","in house"].includes(normalize(value))

export default function ReservationGroupRoomChangeControl({item,allRooms=[],busy=false,onMoved}){
  const[localItem,setLocalItem]=useState(item),[sourceId,setSourceId]=useState(null),[options,setOptions]=useState([]),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(""),[query,setQuery]=useState(""),[mode,setMode]=useState("available"),[pending,setPending]=useState(null),[lockOpen,setLockOpen]=useState(false),[lockReason,setLockReason]=useState("")
  useEffect(()=>setLocalItem(item),[item.id,JSON.stringify(item.habitaciones_detalle||[]),JSON.stringify(item.habitaciones_ids||[]),JSON.stringify(item.room_checkout_dates||{})])
  const current=localItem||item,ids=useMemo(()=>roomIds(current),[current?.habitacion_id,JSON.stringify(current?.habitaciones_ids||[])]),currency=current.moneda||"ARS",today=todayKey(),isInHouse=inHouseState(current.estado)
  const vatRate=current.impuestos_desglosados?Math.max(0,Number(current.iva_porcentaje)||0):0,displayRate=value=>round((Number(value)||0)*(1+vatRate/100))
  const rows=ids.map(id=>{const room=allRooms.find(value=>Number(value.id)===id),detail=detailFor(current,id),start=roomStart(current,id),end=roomPlannedEnd(current,id),release=current?.room_checkout_dates?.[String(id)],released=validDate(release),midStay=isInHouse&&!released&&validDate(start)&&validDate(end)&&today>start&&today<end;return{id,room,detail,start,end,released,release,midStay,moveStart:midStay?today:start,locked:Boolean(detail.movement_locked),rate:Math.max(0,Number(detail.tarifa_noche??room?.precio)||0)}})
  const activeRows=rows.filter(row=>!row.released),activeIdSet=useMemo(()=>new Set(activeRows.map(row=>row.id)),[activeRows.map(row=>row.id).join("|")]),anyLocked=activeRows.some(row=>row.locked),allLocked=activeRows.length>0&&activeRows.every(row=>row.locked),source=rows.find(row=>row.id===Number(sourceId))||null
  const filtered=useMemo(()=>{const term=query.trim().toLowerCase();return options.filter(option=>(mode==="all"||option.available||option.current)&&(!term||`${option.room.nombre} ${option.room.tipo||""} ${option.reason||""}`.toLowerCase().includes(term)))},[options,query,mode])
  const availableCount=options.filter(option=>option.available&&!option.current).length,unavailableCount=options.filter(option=>!option.available&&!option.current).length

  async function openMove(row){
    if(busy||saving)return
    if(row.locked){setError(`La Hab. ${row.room?.nombre||row.id} tiene bloqueado el movimiento. Desbloqueá el grupo antes de reasignarla.`);return}
    if(row.released){setError(`La Hab. ${row.room?.nombre||row.id} corresponde a un tramo ya cerrado y no se puede volver a mover.`);return}
    const availabilityStart=row.moveStart
    setSourceId(row.id);setOptions([]);setQuery("");setMode("available");setError("");setLoading(true)
    try{
      const[resRes,blockRes]=await Promise.all([
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,habitacion_id,habitaciones_ids,habitaciones_detalle,room_checkout_dates,fecha_entrada,fecha_salida,estado,no_show").eq("property_id",current.property_id).neq("id",Number(current.id)).neq("estado","cancelada").eq("no_show",false).lt("fecha_entrada",row.end).gt("fecha_salida",availabilityStart),
        supabase.from("bloqueos").select("id,habitacion_id,fecha_desde,fecha_hasta,motivo").eq("property_id",current.property_id).lt("fecha_desde",row.end).gt("fecha_hasta",availabilityStart),
      ])
      if(resRes.error)throw resRes.error;if(blockRes.error)throw blockRes.error
      const reservations=resRes.data||[],blocks=blockRes.data||[],sourceCategory=normalize(row.room?.tipo||row.detail.categoria_asignada),sourceRate=row.rate
      const next=allRooms.map(room=>{
        const id=Number(room.id),currentRoom=id===row.id,inGroup=activeIdSet.has(id)&&!currentRoom,roomState=normalize(room.estado),conflict=reservations.find(res=>roomIds(res).includes(id)&&roomStart(res,id)<row.end&&roomEnd(res,id)>availabilityStart),block=blocks.find(entry=>Number(entry.habitacion_id)===id&&entry.fecha_desde<row.end&&entry.fecha_hasta>availabilityStart),sameCategory=normalize(room.tipo)===sourceCategory
        let available=true,reason=row.midStay?`Disponible desde hoy ${prettyDate(availabilityStart)} hasta ${prettyDate(row.end)}`:"Disponible para toda la estadía"
        if(inGroup){available=false;reason="Ya pertenece al tramo activo de esta reserva grupal"}
        else if(room.activa===false){available=false;reason="Habitación inactiva"}
        else if(["mantenimiento","fuera_servicio"].includes(roomState)){available=false;reason="Fuera de servicio / mantenimiento"}
        else if(conflict){available=false;reason=`Ocupada por ${conflict.nombre_huesped||conflict.numero_reserva||"otra reserva"} · ${roomStart(conflict,id)} → ${roomEnd(conflict,id)}`}
        else if(block){available=false;reason=`Bloqueada${block.motivo?` · ${block.motivo}`:""} · ${block.fecha_desde} → ${block.fecha_hasta}`}
        if(currentRoom){available=true;reason="Habitación actual de este tramo"}
        return{room,current:currentRoom,available,reason,sameCategory,rateDiff:Number(room.precio||0)-sourceRate}
      }).sort((a,b)=>Number(b.current)-Number(a.current)||Number(b.available&&b.sameCategory)-Number(a.available&&a.sameCategory)||Number(b.available)-Number(a.available)||(Number(a.room.precio)||0)-(Number(b.room.precio)||0)||String(a.room.nombre||"").localeCompare(String(b.room.nombre||""),"es",{numeric:true}))
      setOptions(next)
    }catch(err){setError(err?.message||"No se pudo consultar disponibilidad para esa habitación.")}
    finally{setLoading(false)}
  }

  function choose(option){
    if(!source||saving||loading||!option.available||option.current)return
    const target=option.room,sourceRoom=source.room,categoryChanged=normalize(target.tipo)!==normalize(sourceRoom?.tipo||source.detail.categoria_asignada),rateChanged=Math.abs(Number(target.precio||0)-source.rate)>.005
    if(rateChanged){setPending({source,target,categoryChanged});return}
    applyMove(false,target)
  }

  async function applyMove(reprice,targetOverride=null){
    const target=targetOverride||pending?.target;if(!source||!target||saving)return
    setSaving(true);setError("")
    try{
      const rpcName=source.midStay?"hl_move_inhouse_group_room_segment_atomic":"hl_change_group_reservation_room_atomic"
      const params=source.midStay?{p_reserva_id:Number(current.id),p_from_room_id:Number(source.id),p_to_room_id:Number(target.id),p_effective_date:source.moveStart,p_reprice:Boolean(reprice)}:{p_reserva_id:Number(current.id),p_from_room_id:Number(source.id),p_to_room_id:Number(target.id),p_reprice:Boolean(reprice)}
      const{data,error:rpcError}=await supabase.rpc(rpcName,params)
      if(rpcError)throw rpcError
      setLocalItem(data);setPending(null);setSourceId(null);setOptions([])
      const oldFinal=displayRate(source.rate),newFinal=displayRate(Number(target.precio)||0),priceText=reprice&&Math.abs(newFinal-oldFinal)>.01?` · tarifa ${money(oldFinal,currency)} → ${money(newFinal,currency)}`:" · tarifa original mantenida"
      if(typeof window!=="undefined"){
        const message=source.midStay?`Hab. ${source.room?.nombre||source.id} queda en el Planning hasta ${prettyDate(source.moveStart)} y Hab. ${target.nombre} empieza desde ${prettyDate(source.moveStart)} hasta ${prettyDate(source.end)}${priceText}.`:`Hab. ${source.room?.nombre||source.id} → Hab. ${target.nombre}${priceText}. Planning y cuenta actualizados.`
        window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:source.midStay?"Estadía dividida y habitación cambiada":"Habitación del grupo reasignada",message}}))
        window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(current.id)}}))
        window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId:current.property_id,tables:["reservas","hotel_folios","hotel_folio_items","hotel_reservation_guests","habitaciones"]}}))
      }
      onMoved?.(data)
    }catch(err){setError(String(err?.message||"No se pudo reasignar la habitación.").replace(/^No se puede aplicar el cambio:\s*/,""))}
    finally{setSaving(false)}
  }

  async function toggleGroupLock(){
    if(saving||busy)return
    setSaving(true);setError("")
    try{
      const nextLocked=!anyLocked
      const{data,error:rpcError}=await supabase.rpc("hl_set_reservation_room_movement_lock",{p_reserva_id:Number(current.id),p_habitacion_id:null,p_locked:nextLocked,p_reason:nextLocked?(lockReason.trim()||null):null})
      if(rpcError)throw rpcError
      setLocalItem(data||current);setLockOpen(false);setLockReason("")
      if(typeof window!=="undefined"){
        window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:nextLocked?"Grupo fijado":"Grupo desbloqueado",message:nextLocked?"Las habitaciones activas del grupo no podrán moverse hasta quitar el bloqueo.":"Las habitaciones del grupo vuelven a permitir reasignaciones."}}))
        window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(current.id)}}))
      }
    }catch(err){setError(err?.message||"No se pudo cambiar el bloqueo del grupo.")}
    finally{setSaving(false)}
  }

  const card={marginTop:12,border:"1px solid color-mix(in srgb,var(--accent) 20%,var(--line))",borderRadius:14,overflow:"hidden",background:"color-mix(in srgb,var(--panelSolid) 88%,transparent)"}
  const button={height:34,padding:"0 11px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:850,cursor:"pointer"}
  const primary={...button,borderColor:"color-mix(in srgb,var(--accent) 32%,var(--line))",background:"color-mix(in srgb,var(--accent) 7%,var(--panelSolid))",color:"var(--accent)"}
  const overlay={position:"fixed",inset:0,zIndex:278,display:"grid",placeItems:"center",padding:16,background:"rgba(10,18,34,.34)",backdropFilter:"blur(10px) saturate(1.14)"}
  const shell={width:"min(700px,calc(100vw - 28px))",maxHeight:"88vh",overflow:"hidden",display:"grid",gridTemplateRows:"auto auto 1fr",border:"1px solid color-mix(in srgb,#fff 34%,var(--line))",borderRadius:20,background:"color-mix(in srgb,var(--panelSolid) 91%,transparent)",boxShadow:"0 30px 90px rgba(15,27,50,.3)",backdropFilter:"blur(30px) saturate(1.4)"}

  return <><section style={card} aria-label="Reasignar habitación de reserva grupal">
    <header style={{padding:"11px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",borderBottom:"1px solid var(--line)",background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))"}}><div><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".1em",color:"var(--accent)"}}>RESERVA GRUPAL · REASIGNACIÓN FÍSICA</small><b style={{display:"block",marginTop:2,fontSize:12}}>Cambiar una habitación sin tocar el resto del grupo</b></div><button type="button" disabled={busy||saving||!activeRows.length} onClick={()=>{setLockReason("");setLockOpen(true)}} style={{...button,color:anyLocked?"#111827":"var(--muted)",opacity:activeRows.length?1:.5}}>{allLocked?"🔒 Desbloquear grupo":anyLocked?"🔒 Gestionar bloqueo":"🔓 Bloquear grupo"}</button></header>
    {error?<div style={{margin:"9px 10px 0",padding:"8px 9px",border:"1px solid color-mix(in srgb,var(--red) 30%,var(--line))",borderRadius:9,background:"color-mix(in srgb,var(--red) 6%,var(--panelSolid))",color:"var(--red)",fontSize:10,fontWeight:780,display:"flex",justifyContent:"space-between",gap:8}}><span>{error}</span><button type="button" onClick={()=>setError("")} style={{border:0,background:"transparent",color:"inherit",fontWeight:900}}>×</button></div>:null}
    <div style={{display:"grid"}}>{rows.map(row=>{const historical=row.released&&row.detail?.segment_role==="previous_room";return <article key={row.id} style={{padding:"10px 12px",display:"grid",gridTemplateColumns:"1fr auto",alignItems:"center",gap:12,borderTop:"1px solid color-mix(in srgb,var(--line) 72%,transparent)",opacity:row.released?.72:1}}><div style={{minWidth:0}}><b style={{fontSize:11.5}}>Hab. {row.room?.nombre||row.detail.nombre||row.id} · {row.room?.tipo||row.detail.categoria_asignada||"Habitación"}{historical?" · tramo anterior":""}</b><small style={{display:"block",marginTop:3,fontSize:10,color:"var(--muted)"}}>{prettyDate(row.start)} → {prettyDate(row.end)} · Vendida como {row.detail.categoria_vendida||row.room?.tipo||"Habitación"} · {money(displayRate(row.rate),currency)}/noche{vatRate?` · IVA ${vatRate}% incluido`:""}</small>{row.midStay?<small style={{display:"block",marginTop:3,fontSize:10,color:"var(--accent)",fontWeight:800}}>Alojado · si lo movés, se corta hoy {prettyDate(row.moveStart)} y el tramo anterior queda guardado en el Planning.</small>:null}</div><button type="button" disabled={busy||saving||row.locked||row.released} onClick={()=>openMove(row)} style={{...primary,opacity:busy||saving||row.locked||row.released?.5:1,cursor:busy||saving||row.locked||row.released?"not-allowed":"pointer"}}>{historical?"Tramo anterior":row.released?"Salida realizada":row.locked?"🔒 Fija":"Cambiar habitación"}</button></article>})}</div>
  </section>

  {sourceId?<div style={overlay} onMouseDown={event=>event.target===event.currentTarget&&!loading&&!saving&&setSourceId(null)}><section style={shell} role="dialog" aria-modal="true" aria-label="Cambiar una habitación del grupo"><header style={{padding:"15px 16px",display:"flex",justifyContent:"space-between",gap:14,borderBottom:"1px solid var(--line)"}}><div><small style={{fontSize:10,fontWeight:900,letterSpacing:".09em",color:"var(--accent)"}}>{source?.midStay?"CAMBIO DURANTE LA ESTADÍA":"REASIGNACIÓN INDIVIDUAL DEL GRUPO"}</small><h3 style={{margin:"4px 0 0",fontSize:18}}>Hab. {source?.room?.nombre||source?.id} → elegir destino</h3><p style={{margin:"5px 0 0",fontSize:10.5,lineHeight:1.5,color:"var(--muted)"}}>{source?.midStay?<>El huésped ya está alojado. La Hab. {source?.room?.nombre||source?.id} queda registrada del {prettyDate(source?.start)} al {prettyDate(source?.moveStart)} y la nueva habitación se usará del <b>{prettyDate(source?.moveStart)}</b> al {prettyDate(source?.end)}.</>:<>{prettyDate(source?.start)} → {prettyDate(source?.end)} · se modifica esta habitación para toda la estadía; las demás quedan intactas.</>}</p></div><button type="button" disabled={loading||saving} onClick={()=>setSourceId(null)} style={{...button,width:36,padding:0,fontSize:18}}>×</button></header>
    <div style={{padding:"10px 12px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",borderBottom:"1px solid var(--line)"}}><label style={{flex:"1 1 240px",height:36,display:"flex",alignItems:"center",gap:7,padding:"0 10px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)"}}>⌕<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar habitación o categoría" style={{width:"100%",border:0,outline:0,background:"transparent",color:"var(--text)",font:"inherit",fontSize:10.5}}/></label><button type="button" onClick={()=>setMode("available")} style={{...button,color:mode==="available"?"var(--accent)":"var(--text)"}}>Disponibles · {availableCount}</button><button type="button" onClick={()=>setMode("all")} style={{...button,color:mode==="all"?"var(--accent)":"var(--text)"}}>Todas · {options.length}</button></div>
    <div style={{padding:12,overflow:"auto"}}>{loading?<div style={{padding:30,textAlign:"center",color:"var(--muted)",fontSize:11}}>Comprobando ocupación y bloqueos{source?.midStay?" desde hoy":""}…</div>:<><div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:9,fontSize:10,color:"var(--muted)"}}><span>{availableCount} disponibles · {unavailableCount} no disponibles</span><span>{source?.midStay?`Disponibilidad ${prettyDate(source.moveStart)} → ${prettyDate(source.end)}`:"Misma categoría primero"}</span></div><div style={{display:"grid",gap:7}}>{filtered.map(option=>{const target=option.room,diff=option.rateDiff,kind=diff>0?"upgrade":diff<0?"downgrade":"same",tone=!option.available?"var(--red)":kind==="upgrade"?"#2c8855":kind==="downgrade"?"#a36f25":"var(--accent)";return <button key={target.id} type="button" disabled={saving||!option.available||option.current} onClick={()=>choose(option)} style={{padding:"10px 11px",display:"grid",gridTemplateColumns:"1fr auto",gap:12,textAlign:"left",border:`1px solid ${option.current?"color-mix(in srgb,var(--accent) 30%,var(--line))":"var(--line)"}`,borderRadius:11,background:option.current?"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))":"var(--panelSolid)",color:"var(--text)",font:"inherit",cursor:option.available&&!option.current?"pointer":"not-allowed",opacity:option.available||option.current?1:.66}}><span><b style={{display:"block",fontSize:11.5}}>Hab. {target.nombre} · {target.tipo||"Sin categoría"}</b><small style={{display:"block",marginTop:3,fontSize:10,color:option.available?"var(--muted)":"var(--red)"}}>{option.reason}</small></span><span style={{textAlign:"right"}}><b style={{display:"block",fontSize:10.5,color:tone}}>{option.current?"ACTUAL":!option.available?"NO DISPONIBLE":option.sameCategory?"MISMA CATEGORÍA":kind==="upgrade"?"↑ UPGRADE":kind==="downgrade"?"↓ DOWNGRADE":"OTRA CATEGORÍA"}</b><small style={{display:"block",marginTop:3,fontSize:10,color:"var(--muted)"}}>{money(displayRate(target.precio),currency)}/noche{vatRate?" · IVA incluido":""}</small></span></button>})}{!filtered.length?<div style={{padding:24,textAlign:"center",color:"var(--muted)",fontSize:10.5}}>No hay habitaciones que coincidan con esta vista.</div>:null}</div></>}</div></section></div>:null}

  {pending?<div style={{...overlay,zIndex:282}}><section style={{width:"min(520px,calc(100vw - 28px))",border:"1px solid color-mix(in srgb,#fff 34%,var(--line))",borderRadius:18,background:"var(--panelSolid)",boxShadow:"0 28px 80px rgba(15,27,50,.3)",overflow:"hidden"}} role="dialog" aria-modal="true"><header style={{padding:"15px 16px",borderBottom:"1px solid var(--line)"}}><small style={{fontSize:10,fontWeight:900,letterSpacing:".09em",color:"var(--accent)"}}>{Number(pending.target.precio)>pending.source.rate?"↑ UPGRADE":Number(pending.target.precio)<pending.source.rate?"↓ DOWNGRADE":"CAMBIO DE CATEGORÍA"}</small><h3 style={{margin:"4px 0 0",fontSize:17}}>Hab. {pending.source.room?.nombre} → Hab. {pending.target.nombre}</h3><p style={{margin:"6px 0 0",fontSize:10.5,lineHeight:1.5,color:"var(--muted)"}}>Tarifa actual {money(displayRate(pending.source.rate),currency)}/noche · tarifa destino {money(displayRate(pending.target.precio),currency)}/noche. {pending.source.midStay?`El cambio de tarifa, si lo elegís, se aplicará solamente al nuevo tramo desde ${prettyDate(pending.source.moveStart)} hasta ${prettyDate(pending.source.end)}.`:"Elegí cómo querés tratar la tarifa de esta habitación."}</p>{Number(current.paid)>0&&Number(pending.target.precio)>pending.source.rate?<p style={{margin:"7px 0 0",fontSize:10.5,color:"#956718"}}>Los pagos ya realizados se conservan. Si actualizás la tarifa, la diferencia quedará como saldo pendiente.</p>:null}</header><div style={{padding:14,display:"flex",justifyContent:"flex-end",gap:8,flexWrap:"wrap"}}><button type="button" disabled={saving} onClick={()=>setPending(null)} style={button}>Cancelar</button><button type="button" disabled={saving} onClick={()=>applyMove(false)} style={button}>{saving?"Guardando…":"Mantener tarifa actual"}</button><button type="button" disabled={saving} onClick={()=>applyMove(true)} style={primary}>{saving?"Guardando…":"Actualizar a tarifa destino"}</button></div></section></div>:null}

  {lockOpen?<div style={{...overlay,zIndex:284}} onMouseDown={event=>event.target===event.currentTarget&&!saving&&setLockOpen(false)}><section style={{width:"min(470px,calc(100vw - 28px))",border:"1px solid color-mix(in srgb,#fff 34%,var(--line))",borderRadius:18,background:"var(--panelSolid)",boxShadow:"0 28px 80px rgba(15,27,50,.3)",overflow:"hidden"}} role="dialog" aria-modal="true"><header style={{padding:"15px 16px",borderBottom:"1px solid var(--line)"}}><small style={{fontSize:10,fontWeight:900,letterSpacing:".09em",color:"var(--accent)"}}>{anyLocked?"DESBLOQUEAR GRUPO":"FIJAR GRUPO"}</small><h3 style={{margin:"4px 0 0",fontSize:17}}>{anyLocked?"Permitir movimientos nuevamente":"Bloquear movimiento de las habitaciones"}</h3><p style={{margin:"5px 0 0",fontSize:10.5,color:"var(--muted)",lineHeight:1.45}}>{anyLocked?"Se quitará el bloqueo de las habitaciones del grupo.":"Las habitaciones activas quedarán fijas y no podrán moverse desde la ficha ni el Planning."}</p></header><div style={{padding:16}}>{!anyLocked?<label style={{display:"grid",gap:6,fontSize:10,fontWeight:850,color:"var(--muted)"}}>Motivo opcional<textarea value={lockReason} maxLength={240} onChange={event=>setLockReason(event.target.value)} placeholder="Ej.: grupo VIP, habitaciones contiguas, pedido expreso…" style={{width:"100%",minHeight:72,boxSizing:"border-box",resize:"vertical",border:"1px solid var(--line)",borderRadius:10,padding:"10px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit"}}/></label>:null}<div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}><button type="button" disabled={saving} onClick={()=>setLockOpen(false)} style={button}>Cancelar</button><button type="button" disabled={saving} onClick={toggleGroupLock} style={{...primary,color:"#fff",background:anyLocked?"#111827":"linear-gradient(145deg,var(--accent),var(--accent2))"}}>{saving?"Guardando…":anyLocked?"Desbloquear todas":"🔒 Bloquear grupo"}</button></div></div></section></div>:null}
  </>
}
