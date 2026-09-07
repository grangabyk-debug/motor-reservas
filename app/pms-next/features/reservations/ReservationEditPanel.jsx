"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import RoomingEditor from"../planning/RoomingEditor"
import PlanningRateChangeDialog from"../planning/PlanningRateChangeDialog"

const DAY=86400000
const pad=value=>String(value).padStart(2,"0")
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const dateKey=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const addDays=(value,amount)=>dateKey(new Date(fromKey(value).getTime()+amount*DAY))
const diffDays=(a,b)=>Math.max(1,Math.round((fromKey(b)-fromKey(a))/DAY))
const unique=values=>[...new Set((values||[]).filter(Boolean).map(value=>String(value)))]
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const capacity=room=>Math.max(1,Number(room?.capacidad)||1)
const roundMoney=value=>Math.round((Number(value)||0)*100)/100

function initialDraft(item,assigned){
  const ids=unique([item.habitacion_id,...(item.habitaciones_ids||[])]),details=Array.isArray(item.habitaciones_detalle)?item.habitaciones_detalle:[],roomAssignments={}
  for(const id of ids){const room=assigned.find(value=>String(value.id)===id),detail=details.find(value=>String(value?.habitacion_id)===id)||{},beds=detail.rooming||{};roomAssignments[id]={soldAs:detail.categoria_vendida||room?.tipo||"Habitación",guests:Math.max(0,Number(detail.huespedes)||0),matrimonial:Math.max(0,Number(beds.matrimonial)||0),individual:Math.max(0,Number(beds.individual)||0),rate:Number(detail.tarifa_noche)||Number(room?.precio)||Number(item.tarifa_noche)||0}}
  const earlyAmount=Math.max(0,Number(item.early_checkin_importe)||0),lateAmount=Math.max(0,Number(item.late_checkout_importe)||0)
  return{start:item.fecha_entrada,end:item.fecha_salida,guests:Math.max(1,Number(item.cantidad_huespedes)||1),phone:item.telefono_huesped||"",regimen:item.regimen||"Alojamiento",roomId:ids[0]||"",roomIds:ids,roomAssignments,rate:Number(item.tarifa_noche)||0,currency:item.moneda||"ARS",earlyCheckin:Boolean(item.early_checkin)||earlyAmount>0,lateCheckout:Boolean(item.late_checkout)||lateAmount>0,originalEarlyAmount:earlyAmount,originalLateAmount:lateAmount}
}

export default function ReservationEditPanel({item,assignedRooms=[],allRooms=[],saving=false,onCancel,onPreviewMove,onMove,onUpdate,onSaved}){
  const[draft,setDraft]=useState(()=>initialDraft(item,assignedRooms)),[error,setError]=useState(""),[availabilityError,setAvailabilityError]=useState(""),[availabilityOk,setAvailabilityOk]=useState(""),[checkingAvailability,setCheckingAvailability]=useState(false),[pending,setPending]=useState(null),[working,setWorking]=useState(false),[stayFees,setStayFees]=useState({early_checkin_percent:35,late_checkout_percent:35,early_checkin_time:"08:00",late_checkout_time:"18:00"}),[addRoomOpen,setAddRoomOpen]=useState(false),[addRoomId,setAddRoomId]=useState(""),[addRoomError,setAddRoomError]=useState("")
  const validationSeq=useRef(0)
  const ids=unique(draft.roomIds?.length?draft.roomIds:[draft.roomId]),isGroup=ids.length>1,currentIds=unique([item.habitacion_id,...(item.habitaciones_ids||[])])
  const addedRoomIds=ids.filter(id=>!currentIds.includes(id)),removedCurrentIds=currentIds.filter(id=>!ids.includes(id)),hasRoomAdditions=addedRoomIds.length>0&&removedCurrentIds.length===0
  const selectedRooms=ids.map(id=>allRooms.find(room=>String(room.id)===id)||assignedRooms.find(room=>String(room.id)===id)).filter(Boolean)
  const currentRoom=allRooms.find(room=>Number(room.id)===Number(item.habitacion_id))||assignedRooms[0],targetRoom=selectedRooms[0]
  const commercialCategories=useMemo(()=>[...new Set(allRooms.map(room=>String(room.tipo||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[allRooms])
  const roomSelectionKey=ids.join("|")
  const availableAddRooms=useMemo(()=>allRooms.filter(room=>room.activa!==false&&!ids.includes(String(room.id))&&!['mantenimiento','fuera_servicio'].includes(String(room.estado||'').toLowerCase())),[allRooms,roomSelectionKey])
  const oldNights=Math.max(1,Number(item.noches)||diffDays(item.fecha_entrada,item.fecha_salida)),newNights=diffDays(draft.start,draft.end),roomChanged=!isGroup&&String(item.habitacion_id)!==String(draft.roomId),datesChanged=item.fecha_entrada!==draft.start||item.fecha_salida!==draft.end,durationChanged=oldNights!==newNights
  const assignedGuests=ids.reduce((sum,id)=>sum+Math.max(0,Number(draft.roomAssignments?.[id]?.guests)||0),0)
  const totalCapacity=selectedRooms.reduce((sum,room)=>sum+capacity(room),0)
  const nightlyStayRate=ids.reduce((sum,id)=>sum+(Number(draft.roomAssignments?.[id]?.rate)||0),0)||Number(item.tarifa_noche)||0
  const originalDetails=Array.isArray(item.habitaciones_detalle)?item.habitaciones_detalle:[]
  const originalNightlyStayRate=currentIds.reduce((sum,id)=>{const detail=originalDetails.find(value=>String(value?.habitacion_id)===id);return sum+(Math.max(0,Number(detail?.tarifa_noche)||0))},0)||Number(item.tarifa_noche)||0
  const previousStayTotal=originalNightlyStayRate*oldNights,newStayTotal=nightlyStayRate*newNights,stayDelta=newStayTotal-previousStayTotal
  const earlyPercent=Math.max(0,Math.min(100,Number(stayFees.early_checkin_percent)||35)),latePercent=Math.max(0,Math.min(100,Number(stayFees.late_checkout_percent)||35)),earlyTime=stayFees.early_checkin_time||"08:00",lateTime=stayFees.late_checkout_time||"18:00"
  const earlyAmount=draft.earlyCheckin?(draft.originalEarlyAmount>0?draft.originalEarlyAmount:roundMoney(nightlyStayRate*earlyPercent/100)):0
  const lateAmount=draft.lateCheckout?(draft.originalLateAmount>0?draft.originalLateAmount:roundMoney(nightlyStayRate*latePercent/100)):0
  const busy=working||saving||checkingAvailability
  const serviceLocked=item.estado==="finalizada"||item.estado==="cancelada"||item.no_show
  const originalEarly=Boolean(item.early_checkin)||Number(item.early_checkin_importe)>0,originalLate=Boolean(item.late_checkout)||Number(item.late_checkout_importe)>0

  useEffect(()=>{
    let cancelled=false
    async function loadFees(){
      const propertyId=item.property_id
      if(!propertyId)return
      const{data}=await supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle()
      if(cancelled)return
      const prefs=data?.settings?.preferences||{}
      setStayFees({early_checkin_percent:prefs.early_checkin_percent??35,late_checkout_percent:prefs.late_checkout_percent??35,early_checkin_time:prefs.early_checkin_time||"08:00",late_checkout_time:prefs.late_checkout_time||"18:00"})
    }
    loadFees().catch(()=>{})
    return()=>{cancelled=true}
  },[item.property_id])

  async function validateCandidate({start,end,roomId,apply}){
    if(!start||!end||end<=start){setAvailabilityOk("");setAvailabilityError("La salida debe ser posterior a la entrada.");return false}
    if(isGroup&&(start!==draft.start||end!==draft.end)){setAvailabilityOk("");setAvailabilityError("Las fechas de una reserva grupal se editan por habitación para validar todo el conjunto.");return false}
    const seq=++validationSeq.current
    setCheckingAvailability(true);setAvailabilityError("");setAvailabilityOk("")
    try{
      const preview=await onPreviewMove({reservationId:item.id,roomId:Number(roomId),start,end})
      if(seq!==validationSeq.current)return false
      if(!preview?.ok){setAvailabilityError(preview?.message||"La habitación no está disponible para ese cambio.");return false}
      apply?.()
      const target=allRooms.find(room=>Number(room.id)===Number(roomId))||currentRoom
      setAvailabilityOk(`Disponible · Hab. ${target?.nombre||"—"} · ${diffDays(start,end)} noche${diffDays(start,end)===1?"":"s"}.`)
      return true
    }catch(err){if(seq===validationSeq.current)setAvailabilityError(err?.message||"No se pudo comprobar la disponibilidad.");return false}
    finally{if(seq===validationSeq.current)setCheckingAvailability(false)}
  }
  async function specialAvailability(nextEarly,nextLate){
    const start=nextEarly?addDays(draft.start,-1):draft.start,end=nextLate?addDays(draft.end,1):draft.end
    for(const id of ids){const preview=await onPreviewMove({reservationId:item.id,roomId:Number(id),start,end});if(!preview?.ok)return{ok:false,message:String(preview?.message||"La habitación no está disponible.").replace(/^No se puede aplicar el cambio:\s*/,"")}}
    return{ok:true}
  }
  async function toggleSpecial(kind){
    const key=kind==="early"?"earlyCheckin":"lateCheckout",label=kind==="early"?"Early check-in":"Late check-out",next=!draft[key]
    if(!next){setDraft(current=>({...current,[key]:false}));setAvailabilityError("");setAvailabilityOk("");return}
    const seq=++validationSeq.current;setCheckingAvailability(true);setAvailabilityError("");setAvailabilityOk("")
    try{const result=await specialAvailability(kind==="early"?true:draft.earlyCheckin,kind==="late"?true:draft.lateCheckout);if(seq!==validationSeq.current)return;if(!result.ok){setAvailabilityError(`No se puede habilitar ${label}: ${result.message}`);return}setDraft(current=>({...current,[key]:true}));setAvailabilityOk(`${label} disponible · se protege el turno de la habitación en el Planning.`)}catch(err){if(seq===validationSeq.current)setAvailabilityError(`No se puede habilitar ${label}: ${err?.message||"no se pudo comprobar la disponibilidad."}`)}finally{if(seq===validationSeq.current)setCheckingAvailability(false)}
  }

  async function changeStart(nextStart){
    if(!nextStart)return
    const nextEnd=draft.end<=nextStart?addDays(nextStart,1):draft.end
    await validateCandidate({start:nextStart,end:nextEnd,roomId:draft.roomId,apply:()=>setDraft(current=>({...current,start:nextStart,end:nextEnd}))})
  }
  async function changeEnd(nextEnd){
    if(!nextEnd)return
    await validateCandidate({start:draft.start,end:nextEnd,roomId:draft.roomId,apply:()=>setDraft(current=>({...current,end:nextEnd}))})
  }
  async function changeNights(value){
    const count=Math.max(1,Number(value)||1),nextEnd=addDays(draft.start,count)
    await validateCandidate({start:draft.start,end:nextEnd,roomId:draft.roomId,apply:()=>setDraft(current=>({...current,end:nextEnd}))})
  }
  async function changeRoom(nextId){
    if(isGroup){setAvailabilityOk("");return setAvailabilityError("Para una reserva grupal, la reasignación física se hace por habitación para no romper el conjunto.")}
    const oldId=String(draft.roomId),nextRoom=allRooms.find(room=>String(room.id)===String(nextId));if(!nextRoom)return
    const previous=draft.roomAssignments?.[oldId]||{},nextAssignment={...previous,soldAs:previous.soldAs||currentRoom?.tipo||nextRoom.tipo||"Habitación",rate:Number(previous.rate)||Number(item.tarifa_noche)||Number(nextRoom.precio)||0}
    await validateCandidate({start:draft.start,end:draft.end,roomId:nextId,apply:()=>{setError("");setDraft(current=>({...current,roomId:String(nextId),roomIds:[String(nextId)],roomAssignments:{[String(nextId)]:nextAssignment}}))}})
  }
  function changeGuests(value){const guests=Math.max(1,Number(value)||1);setDraft(current=>({...current,guests}))}
  function openAddRoom(){
    if(busy||serviceLocked)return
    if(!availableAddRooms.length){setAvailabilityOk("");setAvailabilityError("No hay otras habitaciones activas para añadir a esta reserva.");return}
    setAddRoomId("");setAddRoomError("");setAddRoomOpen(true)
  }
  async function addRoom(){
    if(checkingAvailability||!addRoomId)return
    const nextRoom=availableAddRooms.find(room=>String(room.id)===String(addRoomId))
    if(!nextRoom){setAddRoomError("Elegí una habitación válida.");return}
    const start=draft.earlyCheckin?addDays(draft.start,-1):draft.start,end=draft.lateCheckout?addDays(draft.end,1):draft.end
    setCheckingAvailability(true);setAddRoomError("")
    try{
      const preview=await onPreviewMove({reservationId:item.id,roomId:Number(nextRoom.id),start,end})
      if(!preview?.ok){setAddRoomError(String(preview?.message||"La habitación no está disponible para esas fechas.").replace(/^No se puede aplicar el cambio:\s*/,""));return}
      setDraft(current=>{
        const roomIds=unique([...(current.roomIds?.length?current.roomIds:[current.roomId]),String(nextRoom.id)]),assignments={...(current.roomAssignments||{})}
        assignments[String(nextRoom.id)]={soldAs:nextRoom.tipo||"Habitación",guests:0,matrimonial:0,individual:0,rate:Math.max(0,Number(nextRoom.precio)||0)}
        return{...current,roomId:roomIds[0]||String(nextRoom.id),roomIds,roomAssignments:assignments}
      })
      setAvailabilityError("");setAvailabilityOk(`Hab. ${nextRoom.nombre} añadida a la reserva · revisá huéspedes, Rooming y tarifa antes de guardar.`);setAddRoomOpen(false);setAddRoomId("")
    }catch(err){setAddRoomError(err?.message||"No se pudo comprobar la disponibilidad de la habitación.")}
    finally{setCheckingAvailability(false)}
  }
  function removeAddedRoom(roomId){
    const id=String(roomId)
    if(currentIds.includes(id)||busy)return
    const room=allRooms.find(value=>String(value.id)===id)
    setDraft(current=>{
      const roomIds=unique(current.roomIds?.length?current.roomIds:[current.roomId]).filter(value=>value!==id)
      if(!roomIds.length)return current
      const assignments={...(current.roomAssignments||{})};delete assignments[id]
      return{...current,roomIds,roomId:roomIds.includes(String(current.roomId))?String(current.roomId):roomIds[0],roomAssignments:assignments}
    })
    setAvailabilityError("");setAvailabilityOk(room?`Hab. ${room.nombre} quitada de los cambios pendientes.`:"Habitación quitada de los cambios pendientes.")
  }
  function detailsFor(rateOverride=null){return selectedRooms.map(room=>{const id=String(room.id),assignment=draft.roomAssignments?.[id]||{},rooming={matrimonial:Math.max(0,Number(assignment.matrimonial)||0),individual:Math.max(0,Number(assignment.individual)||0)};return{habitacion_id:Number(room.id),nombre:room.nombre,categoria_asignada:room.tipo||"Habitación",categoria_vendida:assignment.soldAs||room.tipo||"Habitación",huespedes:Math.max(0,Number(assignment.guests)||0),tarifa_noche:rateOverride!=null&&selectedRooms.length===1?Number(rateOverride):Math.max(0,Number(assignment.rate)||Number(room.precio)||0),rooming}})}
  async function saveMetadata(baseItem=item,rateOverride=null){
    const details=detailsFor(rateOverride),effectiveNightly=details.reduce((sum,detail)=>sum+Math.max(0,Number(detail.tarifa_noche)||0),0)||Number(rateOverride)||Number(baseItem.tarifa_noche)||nightlyStayRate
    const addedNightly=hasRoomAdditions?details.filter(detail=>addedRoomIds.includes(String(detail.habitacion_id))).reduce((sum,detail)=>sum+Math.max(0,Number(detail.tarifa_noche)||0),0):0,addedStayAmount=roundMoney(addedNightly*newNights)
    const oldEarly=Math.max(0,Number(baseItem.early_checkin_importe)||0),oldLate=Math.max(0,Number(baseItem.late_checkout_importe)||0)
    const nextEarly=draft.earlyCheckin?(draft.originalEarlyAmount>0?draft.originalEarlyAmount:roundMoney(effectiveNightly*earlyPercent/100)):0
    const nextLate=draft.lateCheckout?(draft.originalLateAmount>0?draft.originalLateAmount:roundMoney(effectiveNightly*latePercent/100)):0
    const taxEnabled=Boolean(baseItem.impuestos_desglosados),vatRate=taxEnabled?Math.max(0,Number(baseItem.iva_porcentaje)||0):0
    const totalNow=Math.max(0,Number(baseItem.precio_total)||0),vatNow=Math.max(0,Number(baseItem.iva_importe)||0)
    const storedNet=Math.max(0,Number(baseItem.precio_sin_impuestos_nacionales)||Number(baseItem.subtotal)||0)
    const currentNet=storedNet>0?storedNet:taxEnabled?Math.max(0,totalNow-vatNow):totalNow
    const baseNet=Math.max(0,currentNet-oldEarly-oldLate),nextNet=roundMoney(baseNet+addedStayAmount+nextEarly+nextLate),nextVat=taxEnabled?roundMoney(nextNet*vatRate/100):0,nextTotal=roundMoney(nextNet+nextVat)
    const patch={habitacion_id:Number(ids[0]),habitaciones_ids:ids.map(Number),telefono_huesped:draft.phone.trim()||null,regimen:draft.regimen.trim()||null,cantidad_huespedes:Math.max(1,Number(draft.guests)||1),habitaciones_detalle:details,tarifa_noche:effectiveNightly,noches:newNights,early_checkin:Boolean(draft.earlyCheckin),early_checkin_importe:nextEarly,late_checkout:Boolean(draft.lateCheckout),late_checkout_importe:nextLate,subtotal:nextNet,precio_sin_impuestos_nacionales:nextNet,iva_importe:nextVat,precio_total:nextTotal}
    const updated=await onUpdate(baseItem.id,patch);onSaved?.({...baseItem,...updated});return updated
  }
  async function preflight(){
    if(draft.end<=draft.start)throw new Error("La salida debe ser posterior a la entrada.")
    if(!selectedRooms.length)throw new Error("Elegí una habitación activa.")
    if(Number(draft.guests)>totalCapacity)throw new Error(`La capacidad seleccionada es de ${totalCapacity} huésped${totalCapacity===1?"":"es"}.`)
    if(assignedGuests!==Number(draft.guests))throw new Error(`Distribuí los ${draft.guests} huésped${Number(draft.guests)===1?"":"es"} en el Rooming antes de guardar.`)
    if(removedCurrentIds.length)throw new Error("Para quitar una habitación que ya forma parte de la reserva usá el flujo operativo correspondiente. Desde acá sólo podés descartar habitaciones nuevas antes de guardar.")
    if(addedRoomIds.length&&datesChanged)throw new Error("Para añadir otra habitación, guardá primero el cambio de fechas y después volvé a Editar reserva. Así validamos la nueva habitación sobre la estadía definitiva.")
    if(currentIds.length>1&&datesChanged)throw new Error("Las fechas de una reserva grupal se editan por habitación para validar todo el conjunto.")
    for(const id of addedRoomIds){const preview=await onPreviewMove({reservationId:item.id,roomId:Number(id),start:draft.start,end:draft.end});if(!preview?.ok)throw new Error(preview?.message||"Una de las habitaciones añadidas ya no está disponible.")}
    if(datesChanged||roomChanged){const preview=await onPreviewMove({reservationId:item.id,roomId:Number(draft.roomId),start:draft.start,end:draft.end});if(!preview?.ok)throw new Error(preview?.message||"La habitación no está disponible para ese cambio.")}
    if(draft.earlyCheckin!==originalEarly||draft.lateCheckout!==originalLate||(addedRoomIds.length&&(draft.earlyCheckin||draft.lateCheckout))){const special=await specialAvailability(draft.earlyCheckin,draft.lateCheckout);if(!special.ok)throw new Error(`No se pueden guardar los horarios especiales: ${special.message}`)}
  }
  async function commitMove(reprice=false){
    setWorking(true);setError("")
    try{const moved=await onMove({reservationId:item.id,roomId:Number(draft.roomId),start:draft.start,end:draft.end,reprice});const effectiveRate=roomChanged&&reprice?Number(targetRoom?.precio)||Number(moved.tarifa_noche)||0:Number(moved.tarifa_noche)||Number(item.tarifa_noche)||0;await saveMetadata(moved,effectiveRate);setPending(null)}catch(err){setError(err?.message||"No se pudo aplicar el cambio.")}finally{setWorking(false)}
  }
  async function requestSave(){
    if(busy)return;setWorking(true);setError("")
    try{
      await preflight()
      if(roomChanged&&Number(targetRoom?.precio||0)!==Number(item.tarifa_noche||0)){setPending({reservationId:item.id,roomId:Number(draft.roomId),start:draft.start,end:draft.end,sourceRoom:currentRoom,targetRoom,currentRate:Number(item.tarifa_noche)||0,targetRate:Number(targetRoom?.precio)||0,currency:item.moneda||"ARS"});return}
      if(durationChanged){setPending({kind:"duration",reservationId:item.id,roomId:Number(draft.roomId),start:draft.start,end:draft.end,oldStart:item.fecha_entrada,oldEnd:item.fecha_salida,oldNights,newNights,sourceRoom:currentRoom,targetRoom:targetRoom||currentRoom,currentRate:Number(item.tarifa_noche)||0,targetRate:Number(item.tarifa_noche)||0,currency:item.moneda||"ARS"});return}
      if(datesChanged||roomChanged){const moved=await onMove({reservationId:item.id,roomId:Number(draft.roomId),start:draft.start,end:draft.end,reprice:false});await saveMetadata(moved,Number(moved.tarifa_noche)||Number(item.tarifa_noche)||0)}else await saveMetadata(item)
    }catch(err){setError(err?.message||"No se pudo guardar la reserva.")}finally{setWorking(false)}
  }

  const overlay={position:"fixed",inset:0,zIndex:240,display:"grid",placeItems:"center",padding:18,background:"rgba(9,16,32,.28)",backdropFilter:"blur(9px) saturate(1.15)",WebkitBackdropFilter:"blur(9px) saturate(1.15)"}
  const shell={width:"min(880px,calc(100vw - 28px))",maxHeight:"90vh",overflow:"auto",padding:18,border:"1px solid color-mix(in srgb,#fff 34%,var(--line))",borderRadius:22,background:"color-mix(in srgb,var(--panelSolid) 82%,transparent)",boxShadow:"inset 0 1px color-mix(in srgb,#fff 58%,transparent),0 30px 90px rgba(18,30,58,.28)",backdropFilter:"blur(32px) saturate(1.45)",WebkitBackdropFilter:"blur(32px) saturate(1.45)"}
  const grid={display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:9,marginTop:14}
  const label={display:"grid",gap:5,fontSize:10,fontWeight:850,color:"var(--muted)"}
  const control={height:39,width:"100%",border:"1px solid var(--line)",borderRadius:10,padding:"0 10px",background:"color-mix(in srgb,var(--panelSolid) 82%,transparent)",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:760,outline:"none"}
  const availabilityStyle=availabilityError?{border:"1px solid color-mix(in srgb,var(--red) 30%,var(--line))",background:"color-mix(in srgb,var(--red) 7%,var(--panelSolid))",color:"var(--red)"}:checkingAvailability?{border:"1px solid color-mix(in srgb,#c68b24 28%,var(--line))",background:"color-mix(in srgb,#e4a52f 8%,var(--panelSolid))",color:"#956718"}:{border:"1px solid color-mix(in srgb,#2f9b61 26%,var(--line))",background:"color-mix(in srgb,#37a96a 7%,var(--panelSolid))",color:"#26794d"}
  const serviceButton=active=>({display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 13px",border:`1px solid ${active?"color-mix(in srgb,var(--accent) 38%,var(--line))":"var(--line)"}`,borderRadius:12,background:active?"color-mix(in srgb,var(--accent) 7%,var(--panelSolid))":"var(--panelSolid)",color:"var(--text)",font:"inherit",textAlign:"left",cursor:serviceLocked||busy?"not-allowed":"pointer",opacity:serviceLocked?.58:1})
  const addButton={height:36,padding:"0 12px",border:"1px solid color-mix(in srgb,var(--accent) 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--accent) 7%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:10.5,fontWeight:900,cursor:busy||serviceLocked?"not-allowed":"pointer"}
  return <>
    <div style={overlay} onMouseDown={event=>event.target===event.currentTarget&&!busy&&onCancel?.()}>
      <section style={shell} role="dialog" aria-modal="true" aria-label="Editar reserva">
        <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start"}}><div><small style={{fontSize:10,fontWeight:900,letterSpacing:".1em",color:"var(--accent)"}}>EDITAR RESERVA</small><h2 style={{margin:"4px 0 0",fontSize:20}}>{item.nombre_huesped}</h2><p style={{margin:"5px 0 0",fontSize:11,color:"var(--muted)"}}>Fechas y habitación usan la misma validación del Planning. Los cambios de duración o categoría se confirman antes de guardar.</p></div><button type="button" disabled={busy} onClick={onCancel} style={{width:38,height:38,border:"1px solid var(--line)",borderRadius:11,background:"var(--panel)",color:"var(--text)",fontSize:20}}>×</button></div>
        {error?<div style={{marginTop:12,padding:"10px 12px",border:"1px solid color-mix(in srgb,var(--red) 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--red) 7%,var(--panelSolid))",color:"var(--red)",fontSize:11,fontWeight:800}}>{error}</div>:null}
        <div style={grid}>
          <label style={label}>Llegada<input style={control} type="date" value={draft.start} onChange={event=>changeStart(event.target.value)}/></label>
          <label style={label}>Salida<input style={control} type="date" min={addDays(draft.start,1)} value={draft.end} onChange={event=>changeEnd(event.target.value)}/></label>
          <label style={label}>Noches<input style={control} type="number" min="1" value={newNights} onChange={event=>changeNights(event.target.value)}/></label>
          <label style={label}>Huéspedes<input style={control} type="number" min="1" max={Math.max(1,totalCapacity)} value={draft.guests} onChange={event=>changeGuests(event.target.value)}/></label>
          <label style={{...label,gridColumn:"span 2"}}>Habitación física<select style={control} value={draft.roomId} disabled={isGroup} onChange={event=>changeRoom(event.target.value)}>{allRooms.filter(room=>room.activa!==false).map(room=><option key={room.id} value={room.id}>Hab. {room.nombre} · {room.tipo||"Sin categoría"} · {money(room.precio,item.moneda)}/noche</option>)}</select></label>
          <label style={label}>Teléfono<input style={control} value={draft.phone} onChange={event=>setDraft(current=>({...current,phone:event.target.value}))} placeholder="11 0000-0000"/></label>
          <label style={label}>Régimen<select style={control} value={draft.regimen} onChange={event=>setDraft(current=>({...current,regimen:event.target.value}))}><option>Alojamiento</option><option>Solo alojamiento</option><option>Desayuno incluido</option><option>Media pensión</option><option>Pensión completa</option><option>Todo incluido</option></select></label>
        </div>
        {(checkingAvailability||availabilityError||availabilityOk)?<div style={{...availabilityStyle,marginTop:10,padding:"9px 11px",borderRadius:10,fontSize:10.5,fontWeight:800}}>{checkingAvailability?"Comprobando disponibilidad en el Planning…":availabilityError||`✓ ${availabilityOk}`}</div>:null}
        <div style={{marginTop:12,padding:"12px",border:"1px solid var(--line)",borderRadius:13,background:"color-mix(in srgb,var(--bg) 34%,var(--panelSolid))"}}><div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:10,marginBottom:9}}><div><b style={{fontSize:12}}>Horarios especiales</b><small style={{display:"block",marginTop:3,fontSize:9.8,color:"var(--muted)"}}>El recargo se calcula sobre la tarifa de una noche y bloquea el turno operativo en el Planning.</small></div><small style={{fontSize:9.5,color:"var(--muted)"}}>Configuración del hotel</small></div><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}><button type="button" disabled={serviceLocked||busy} onClick={()=>toggleSpecial("early")} style={serviceButton(draft.earlyCheckin)}><span><b style={{display:"block",fontSize:11.5}}>{draft.earlyCheckin?"✓ ":""}Early check-in</b><small style={{display:"block",marginTop:3,color:"var(--muted)"}}>{earlyPercent}% de la tarifa · desde {earlyTime}</small></span><strong style={{fontSize:12,color:draft.earlyCheckin?"var(--accent)":"var(--muted)"}}>{draft.earlyCheckin?`+ ${money(earlyAmount,item.moneda)}`:"Agregar"}</strong></button><button type="button" disabled={serviceLocked||busy} onClick={()=>toggleSpecial("late")} style={serviceButton(draft.lateCheckout)}><span><b style={{display:"block",fontSize:11.5}}>{draft.lateCheckout?"✓ ":""}Late check-out</b><small style={{display:"block",marginTop:3,color:"var(--muted)"}}>{latePercent}% de la tarifa · hasta {lateTime}</small></span><strong style={{fontSize:12,color:draft.lateCheckout?"var(--accent)":"var(--muted)"}}>{draft.lateCheckout?`+ ${money(lateAmount,item.moneda)}`:"Agregar"}</strong></button></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:14,alignItems:"center",marginTop:11,padding:"11px 12px",border:"1px solid color-mix(in srgb,var(--accent) 16%,var(--line))",borderRadius:12,background:"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))"}}><div><small style={{display:"block",fontSize:9.5,color:"var(--muted)",fontWeight:800}}>ALOJAMIENTO ACTUALIZADO</small><b style={{display:"block",marginTop:3,fontSize:13}}>{newNights} noche{newNights===1?"":"s"} × {money(nightlyStayRate,item.moneda)}/noche</b><small style={{display:"block",marginTop:3,fontSize:10,color:"var(--muted)"}}>{stayDelta===0?"Sin cambio en el valor del alojamiento":`${stayDelta>0?"+":"−"}${money(Math.abs(stayDelta),item.moneda)} respecto de la estadía actual`}{earlyAmount||lateAmount?` · Servicios horarios +${money(earlyAmount+lateAmount,item.moneda)}`:""}</small></div><strong style={{fontSize:20,color:"var(--accent)",whiteSpace:"nowrap"}}>{money(newStayTotal+earlyAmount+lateAmount,item.moneda)}</strong></div>
        {isGroup?<p style={{margin:"9px 0 0",fontSize:10,color:"var(--muted)"}}>Reserva con varias habitaciones: podés editar el Rooming de cada una desde acá. Todas quedan dentro de la misma reserva, huésped principal y saldo.</p>:null}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:11,flexWrap:"wrap"}}><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>{addedRoomIds.length?<><small style={{fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>POR AGREGAR</small>{addedRoomIds.map(id=>{const room=selectedRooms.find(value=>String(value.id)===id);return <button key={id} type="button" disabled={busy} onClick={()=>removeAddedRoom(id)} title="Quitar esta habitación antes de guardar" style={{height:28,padding:"0 8px",border:"1px solid color-mix(in srgb,var(--accent) 22%,var(--line))",borderRadius:999,background:"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))",color:"var(--text)",font:"inherit",fontSize:9.5,fontWeight:800}}>Hab. {room?.nombre||id} ×</button>})}</>:<small style={{fontSize:9.8,color:"var(--muted)"}}>¿La reserva necesita otra habitación? Se suma al mismo pasajero y a la misma cuenta.</small>}</div><button type="button" disabled={busy||serviceLocked||!availableAddRooms.length} onClick={openAddRoom} style={{...addButton,opacity:busy||serviceLocked||!availableAddRooms.length?.55:1}} title={!availableAddRooms.length?"No hay otras habitaciones activas para añadir":"Añadir otra habitación a esta reserva"}>＋ Añadir habitación</button></div>
        <RoomingEditor draft={draft} setDraft={setDraft} rooms={selectedRooms} categories={commercialCategories} currency={item.moneda||"ARS"} editableRate={false}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginTop:14,paddingTop:13,borderTop:"1px solid var(--line)"}}><span style={{fontSize:10,color:"var(--muted)"}}>Tarifa actual: <b style={{color:"var(--text)"}}>{money(item.tarifa_noche,item.moneda)}/noche</b>{durationChanged?` · ${oldNights} → ${newNights} noches`:""}</span><div style={{display:"flex",gap:8}}><button type="button" disabled={busy} onClick={onCancel} style={{height:40,padding:"0 14px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)",color:"var(--text)",font:"inherit",fontWeight:800}}>Cancelar</button><button type="button" disabled={busy||Boolean(availabilityError)} onClick={requestSave} style={{height:40,padding:"0 16px",border:0,borderRadius:10,background:"linear-gradient(145deg,var(--accent),var(--accent2))",color:"#fff",font:"inherit",fontWeight:850,boxShadow:"0 9px 22px color-mix(in srgb,var(--accent) 22%,transparent)",opacity:busy||availabilityError?.length?0.62:1}}>{busy?"Validando…":"Guardar cambios"}</button></div></div>
        <style>{`@media(max-width:760px){[aria-label="Editar reserva"]>div:nth-of-type(3){grid-template-columns:1fr 1fr!important}}`}</style>
      </section>
    </div>
    {addRoomOpen?<div style={{...overlay,zIndex:260,background:"rgba(9,16,32,.38)"}} onMouseDown={event=>event.target===event.currentTarget&&!checkingAvailability&&setAddRoomOpen(false)}><section role="dialog" aria-modal="true" aria-label="Añadir habitación a la reserva" style={{...shell,width:"min(470px,calc(100vw - 28px))",maxHeight:"none",overflow:"visible"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14}}><div><small style={{fontSize:9.5,fontWeight:900,letterSpacing:".1em",color:"var(--accent)"}}>MISMA RESERVA</small><h3 style={{margin:"4px 0 0",fontSize:18}}>Añadir habitación</h3><p style={{margin:"5px 0 0",fontSize:10.5,lineHeight:1.45,color:"var(--muted)"}}>Se agregará a la reserva de <b style={{color:"var(--text)"}}>{item.nombre_huesped}</b>, con las mismas fechas {draft.start} → {draft.end}. Disponibilidad y bloqueos se validan contra el Planning antes de sumarla.</p></div><button type="button" disabled={checkingAvailability} onClick={()=>setAddRoomOpen(false)} style={{width:34,height:34,border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)",color:"var(--text)",fontSize:18}}>×</button></div><label style={{...label,marginTop:15}}>Habitación física<select autoFocus style={control} value={addRoomId} onChange={event=>{setAddRoomId(event.target.value);setAddRoomError("")}}><option value="">Seleccionar habitación…</option>{availableAddRooms.map(room=><option key={room.id} value={room.id}>Hab. {room.nombre} · {room.tipo||"Sin categoría"} · {money(room.precio,item.moneda)}/noche</option>)}</select></label>{addRoomError?<div style={{marginTop:10,padding:"9px 10px",border:"1px solid color-mix(in srgb,var(--red) 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--red) 7%,var(--panelSolid))",color:"var(--red)",fontSize:10.5,fontWeight:800}}>{addRoomError}</div>:null}<div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:15,paddingTop:12,borderTop:"1px solid var(--line)"}}><button type="button" disabled={checkingAvailability} onClick={()=>setAddRoomOpen(false)} style={{height:38,padding:"0 13px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)",color:"var(--text)",font:"inherit",fontWeight:800}}>Cancelar</button><button type="button" disabled={checkingAvailability||!addRoomId} onClick={addRoom} style={{height:38,padding:"0 14px",border:0,borderRadius:10,background:"linear-gradient(145deg,var(--accent),var(--accent2))",color:"#fff",font:"inherit",fontWeight:850,opacity:checkingAvailability||!addRoomId?.6:1}}>{checkingAvailability?"Comprobando…":"Añadir habitación"}</button></div></section></div>:null}
    <PlanningRateChangeDialog change={pending} saving={busy} onKeep={()=>commitMove(false)} onReprice={()=>commitMove(true)} onCancel={()=>!busy&&setPending(null)}/>
  </>
}
