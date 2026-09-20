"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./reservationMidStayRoomSplit.module.css"

const DAY=86400000
const pad=value=>String(value).padStart(2,"0")
const dateKey=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const fromKey=value=>{const[y,m,d]=String(value||"").slice(0,10).split("-").map(Number);return new Date(y,m-1,d,12)}
const addDays=(value,amount)=>dateKey(new Date(fromKey(value).getTime()+amount*DAY))
const minDate=(a,b)=>a&&b?(a<b?a:b):a||b
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(fromKey(value)).replaceAll(".",""):"—"
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const confirmedPayment=row=>["confirmado","confirmed","approved","aprobado","paid","completed","completado"].includes(String(row?.estado||"").trim().toLowerCase())
const uniqueIds=values=>[...new Set((values||[]).filter(Boolean).map(Number).filter(Number.isFinite))]
const reservationIds=item=>uniqueIds([item?.habitacion_id,...(item?.habitaciones_ids||[])])
const detailFor=(item,roomId)=>(Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]).find(detail=>Number(detail?.habitacion_id)===Number(roomId))||null
const roomStart=(item,roomId)=>String(detailFor(item,roomId)?.fecha_entrada||item?.fecha_entrada||"").slice(0,10)
const plannedEnd=(item,roomId)=>String(detailFor(item,roomId)?.fecha_salida||item?.fecha_salida||"").slice(0,10)
const effectiveEnd=(item,roomId)=>{const planned=plannedEnd(item,roomId),released=String(item?.room_checkout_dates?.[String(roomId)]||"").slice(0,10);return released&&(!planned||released<planned)?released:planned}
const explicitBool=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key)?String(obj[key]).toLowerCase()==="true":null
const roomEarly=(item,roomId)=>{const detail=detailFor(item,roomId)||{},explicit=explicitBool(detail,"early_checkin_requested"),start=roomStart(item,roomId);return explicit??Boolean(detail.early_checkin_time||Number(detail.early_checkin_net)>0||((Boolean(item?.early_checkin)||Number(item?.early_checkin_importe)>0)&&start===String(item?.fecha_entrada||"").slice(0,10)))}
const roomLate=(item,roomId)=>{const detail=detailFor(item,roomId)||{},explicit=explicitBool(detail,"late_checkout_requested"),planned=plannedEnd(item,roomId),sentinel=String(item?.room_checkout_dates?.[`late:${roomId}`]||"").slice(0,10);return Boolean(sentinel)||(explicit??Boolean(detail.late_checkout_time||Number(detail.late_checkout_net)>0||((Boolean(item?.late_checkout)||Number(item?.late_checkout_importe)>0)&&planned===String(item?.fecha_salida||"").slice(0,10))))}
const inventoryStart=(item,roomId)=>roomEarly(item,roomId)?addDays(roomStart(item,roomId),-1):roomStart(item,roomId)
const inventoryEnd=(item,roomId)=>{const effective=effectiveEnd(item,roomId),planned=plannedEnd(item,roomId),sentinel=String(item?.room_checkout_dates?.[`late:${roomId}`]||"").slice(0,10);if(effective&&planned&&effective<planned)return effective;if(sentinel&&(!planned||sentinel>planned))return sentinel;return roomLate(item,roomId)?addDays(planned,1):planned}
const activeRoomIds=(item,day)=>reservationIds(item).filter(id=>{const start=roomStart(item,id),end=effectiveEnd(item,id);return start&&end&&start<=day&&end>day})
const roomOverlaps=(item,roomId,start,end)=>reservationIds(item).includes(Number(roomId))&&inventoryStart(item,roomId)<end&&inventoryEnd(item,roomId)>start

function emit(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}

export default function ReservationMidStayRoomSplitControl({item,rooms=[],propertyId}){
  const today=dateKey(new Date())
  const initialActive=useMemo(()=>activeRoomIds(item,today),[item,today])
  const canRender=String(item?.estado||"").toLowerCase()==="alojado"&&!item?.no_show&&initialActive.length===1
  const initialSourceId=initialActive[0]||Number(item?.habitacion_id)||null
  const initialSource=rooms.find(room=>Number(room.id)===Number(initialSourceId))

  const[open,setOpen]=useState(false)
  const[fresh,setFresh]=useState(null)
  const[allRooms,setAllRooms]=useState([])
  const[effectiveDate,setEffectiveDate]=useState("")
  const[targetId,setTargetId]=useState("")
  const[reason,setReason]=useState("")
  const[reprice,setReprice]=useState(false)
  const[rateQuote,setRateQuote]=useState(null)
  const[quoteLoading,setQuoteLoading]=useState(false)
  const[availability,setAvailability]=useState(new Map())
  const[loading,setLoading]=useState(false)
  const[checking,setChecking]=useState(false)
  const[saving,setSaving]=useState(false)
  const[paidTotal,setPaidTotal]=useState(0)
  const[error,setError]=useState("")

  useEffect(()=>{setOpen(false);setFresh(null);setTargetId("");setReason("");setRateQuote(null);setQuoteLoading(false);setError("")},[item?.id])

  const sourceId=useMemo(()=>{const active=fresh?activeRoomIds(fresh,today):initialActive;return active[0]||Number(fresh?.habitacion_id||initialSourceId)||null},[fresh,today,initialActive,initialSourceId])
  const sourceRoom=allRooms.find(room=>Number(room.id)===Number(sourceId))||rooms.find(room=>Number(room.id)===Number(sourceId))||initialSource||null
  const sourceDetail=fresh?detailFor(fresh,sourceId):detailFor(item,sourceId)
  const sourceStart=fresh?roomStart(fresh,sourceId):roomStart(item,sourceId)
  const sourceEnd=fresh?plannedEnd(fresh,sourceId):plannedEnd(item,sourceId)
  const usedIds=useMemo(()=>new Set(reservationIds(fresh||item)),[fresh,item])
  const target=allRooms.find(room=>String(room.id)===String(targetId))||null
  const remainingNights=effectiveDate&&sourceEnd?Math.max(1,Math.round((fromKey(sourceEnd)-fromKey(effectiveDate))/DAY)):0
  const hasRateDifference=rateQuote?Math.abs(Number(rateQuote.local_delta)||0)>.005:false
  const reservationTotal=Math.max(0,Number(fresh?.precio_total??item?.precio_total)||0)
  const finalAdjustment=reprice&&rateQuote?Number(rateQuote.reservation_final_delta)||0:0
  const resultingTotal=Math.max(0,reservationTotal+finalAdjustment)
  const resultingBalance=Math.max(0,resultingTotal-paidTotal)
  const segmentPrepaid=Boolean(rateQuote?.segment_has_prepaid_amount)
  const segmentFullyPrepaid=Boolean(rateQuote?.segment_fully_prepaid)
  const paidToSegment=Math.max(0,Number(rateQuote?.paid_to_segment)||0)
  const sourceSegmentTotal=Math.max(0,Number(rateQuote?.source_reservation_final_total)||0)
  const targetSegmentTotal=Math.max(0,Number(rateQuote?.target_reservation_final_total)||0)
  const sourceSegmentRate=Math.max(0,Number(rateQuote?.source_reservation_final_rate)||0)
  const targetSegmentRate=Math.max(0,Number(rateQuote?.target_reservation_final_rate)||0)
  const targetSegmentBalance=Math.max(0,targetSegmentTotal-paidToSegment)
  const categoryDifference=Math.max(0,targetSegmentTotal-sourceSegmentTotal)
  const minSplitDate=sourceStart?addDays(sourceStart,1):""
  const maxSplitDate=sourceEnd?addDays(sourceEnd,-1):today
  const scheduled=Boolean(effectiveDate&&effectiveDate>today)
  const movementLocked=String(sourceDetail?.movement_locked||"").toLowerCase()==="true"||sourceDetail?.movement_locked===true
  const movementLockReason=String(sourceDetail?.movement_lock_reason||"").trim()

  const targetRooms=useMemo(()=>allRooms.filter(room=>{
    if(room.activa===false||usedIds.has(Number(room.id)))return false
    return !["mantenimiento","fuera_servicio"].includes(String(room.estado||"").toLowerCase())
  }).sort((a,b)=>String(a.tipo||"").localeCompare(String(b.tipo||""),"es")||String(a.nombre||"").localeCompare(String(b.nombre||""),"es",{numeric:true})),[allRooms,usedIds])

  async function loadBase(){
    if(!propertyId||!item?.id)return
    setLoading(true);setError("")
    try{
      const[reservationRes,roomRes,paymentRes]=await Promise.all([
        supabase.from("reservas").select("id,property_id,habitacion_id,habitaciones_ids,habitaciones_detalle,room_checkout_dates,fecha_entrada,fecha_salida,estado,no_show,tarifa_noche,moneda,precio_total").eq("property_id",propertyId).eq("id",Number(item.id)).single(),
        supabase.from("habitaciones").select("id,nombre,tipo,precio,estado,activa,sort_order").eq("property_id",propertyId).eq("activa",true).order("sort_order").order("nombre"),
        supabase.from("pagos").select("monto,estado,refunded_amount").eq("reserva_id",Number(item.id))
      ])
      if(reservationRes.error)throw reservationRes.error
      if(roomRes.error)throw roomRes.error
      if(paymentRes.error)throw paymentRes.error
      const row=reservationRes.data,active=activeRoomIds(row,today)
      if(String(row.estado||"").toLowerCase()!=="alojado")throw new Error("La reserva ya no está alojada.")
      if(active.length!==1)throw new Error(active.length>1?"Esta reserva tiene varias habitaciones activas. Cambiá la habitación desde el rooming del grupo.":"No encontramos una habitación activa para dividir.")
      const source=active[0],start=roomStart(row,source),end=plannedEnd(row,source),minimum=addDays(start,1),maximum=addDays(end,-1),suggested=today<minimum?minimum:today>maximum?maximum:today
      if(!minimum||!maximum||maximum<minimum)throw new Error("Todavía no hay un corte de noche válido para dividir esta estadía. Si el cambio ocurre el mismo día del ingreso, usá el cambio de habitación normal.")
      const detail=detailFor(row,source)
      if(String(detail?.movement_locked||"").toLowerCase()==="true"||detail?.movement_locked===true)throw new Error(`El movimiento de esta habitación está bloqueado${detail?.movement_lock_reason?`: ${detail.movement_lock_reason}`:""}.`)
      const paid=(paymentRes.data||[]).filter(confirmedPayment).reduce((sum,payment)=>sum+Math.max(0,(Number(payment.monto)||0)-(Number(payment.refunded_amount)||0)),0)
      setPaidTotal(paid);setFresh(row);setAllRooms(roomRes.data||[]);setEffectiveDate(suggested);setTargetId("");setReason("");setReprice(false);setRateQuote(null);setQuoteLoading(false);setOpen(true)
    }catch(err){emit({tone:"error",title:"No se puede dividir la reserva",message:err?.message||"No se pudo preparar el cambio de habitación.",duration:4800})}
    finally{setLoading(false)}
  }

  useEffect(()=>{
    if(!open||!fresh||!effectiveDate||!sourceEnd||!propertyId)return
    let cancelled=false
    async function check(){
      setChecking(true);setError("")
      try{
        const[reservationRes,blockRes]=await Promise.all([
          supabase.from("reservas").select("id,habitacion_id,habitaciones_ids,habitaciones_detalle,room_checkout_dates,fecha_entrada,fecha_salida,estado,no_show,early_checkin,early_checkin_importe,late_checkout,late_checkout_importe").eq("property_id",propertyId).neq("id",Number(item.id)).neq("estado","cancelada").eq("no_show",false).lt("fecha_entrada",addDays(sourceEnd,1)).gt("fecha_salida",addDays(effectiveDate,-1)),
          supabase.from("bloqueos").select("id,habitacion_id,fecha_desde,fecha_hasta,motivo").eq("property_id",propertyId).lt("fecha_desde",sourceEnd).gt("fecha_hasta",effectiveDate)
        ])
        if(reservationRes.error)throw reservationRes.error
        if(blockRes.error)throw blockRes.error
        const next=new Map()
        for(const room of allRooms){
          const id=Number(room.id)
          if(usedIds.has(id)){next.set(id,"Ya fue utilizada en esta reserva");continue}
          if(["mantenimiento","fuera_servicio"].includes(String(room.estado||"").toLowerCase())){next.set(id,"Fuera de servicio");continue}
          const conflict=(reservationRes.data||[]).find(row=>roomOverlaps(row,id,effectiveDate,sourceEnd))
          if(conflict){next.set(id,"Ocupada durante el tramo");continue}
          const block=(blockRes.data||[]).find(row=>Number(row.habitacion_id)===id&&row.fecha_desde<sourceEnd&&row.fecha_hasta>effectiveDate)
          if(block){next.set(id,block.motivo?`Bloqueada: ${block.motivo}`:"Bloqueada");continue}
          next.set(id,"")
        }
        if(cancelled)return
        setAvailability(next)
        setTargetId(current=>current&&!next.get(Number(current))?current:"")
      }catch(err){if(!cancelled)setError(err?.message||"No se pudo comprobar la disponibilidad de habitaciones.")}
      finally{if(!cancelled)setChecking(false)}
    }
    check()
    return()=>{cancelled=true}
  },[open,fresh,effectiveDate,sourceEnd,propertyId,item.id,allRooms,usedIds])

  useEffect(()=>{
    if(!open||!fresh||!targetId||!effectiveDate||!sourceEnd||!sourceId){setRateQuote(null);setQuoteLoading(false);return}
    let cancelled=false
    setQuoteLoading(true)
    ;(async()=>{
      const{data,error:quoteError}=await supabase.rpc("hl_quote_room_upgrade_atomic",{
        p_reserva_id:Number(item.id),
        p_from_room_id:Number(sourceId),
        p_to_room_id:Number(targetId),
        p_start:effectiveDate,
        p_end:sourceEnd
      })
      if(cancelled)return
      if(quoteError){setRateQuote(null);setError(quoteError.message||"No se pudo calcular la diferencia de tarifa.");setQuoteLoading(false);return}
      const quote=data||null
      setRateQuote(quote)
      setReprice(!quote?.segment_has_prepaid_amount)
      setQuoteLoading(false)
    })()
    return()=>{cancelled=true}
  },[open,fresh?.id,targetId,effectiveDate,sourceEnd,sourceId,item.id])

  async function confirm(){
    if(saving)return
    if(!targetId)return setError("Elegí la habitación de destino.")
    if(!reason.trim())return setError("Escribí el motivo del cambio de habitación.")
    if(availability.get(Number(targetId)))return setError("La habitación elegida ya no está disponible para todo el tramo.")
    if(reprice&&quoteLoading)return setError("Esperá a que termine el cálculo de la diferencia de tarifa.")
    if(reprice&&!rateQuote)return setError("No se pudo calcular una diferencia de tarifa segura. Volvé a elegir la habitación o mantené la tarifa actual.")
    setSaving(true);setError("")
    try{
      const{data,error:rpcError}=await supabase.rpc("hl_move_inhouse_room_segment_atomic",{
        p_reserva_id:Number(item.id),
        p_from_room_id:Number(sourceId),
        p_to_room_id:Number(targetId),
        p_effective_date:effectiveDate,
        p_reprice:Boolean(reprice),
        p_reason:reason.trim()
      })
      if(rpcError)throw rpcError
      setOpen(false)
      if(typeof window!=="undefined"){
        window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(item.id),propertyId}}))
        window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:["reservas","habitaciones","hotel_folios","hotel_folio_items","hotel_reservation_events"]}}))
      }
      emit({title:scheduled?"Cambio de habitación programado":"Reserva dividida",message:`Habitación ${sourceRoom?.nombre||sourceId} hasta ${fmtDate(effectiveDate)} · Habitación ${target?.nombre||targetId} desde esa fecha. ${scheduled?"La habitación actual sigue operativa hasta el día del cambio.":"Se conservaron dos folios separados."}`,duration:5200})
      setFresh(data||null)
    }catch(err){setError(err?.message||"No se pudo dividir la reserva.")}
    finally{setSaving(false)}
  }

  if(!canRender)return null

  return <>
    <section className={s.actionBar}>
      <div className={s.actionIcon}>⇄</div>
      <div className={s.actionCopy}><small>CAMBIO DURANTE LA ESTADÍA</small><b>¿El huésped cambia de habitación?</b><span>Dividí la reserva y conservá el historial de la habitación anterior.</span></div>
      <div className={s.sourcePill}><small>AHORA</small><b>Hab. {initialSource?.nombre||initialSourceId}</b></div>
      <button type="button" className={s.actionButton} disabled={loading||movementLocked} onClick={loadBase}>{loading?"Preparando…":"Dividir a otra habitación"}</button>
    </section>
    {movementLocked?<div className={s.locked}>🔒 Movimiento bloqueado{movementLockReason?` · ${movementLockReason}`:""}</div>:null}

    {open?<div className={s.overlay} onMouseDown={event=>event.target===event.currentTarget&&!saving&&setOpen(false)}>
      <section className={s.dialog} role="dialog" aria-modal="true" aria-label="Dividir reserva y cambiar de habitación">
        <header className={s.header}>
          <div><small>DIVIDIR RESERVA</small><h2>Cambiar de habitación a mitad de la estadía</h2><p>La reserva sigue siendo la misma, pero queda separada en dos tramos operativos y dos folios de habitación.</p></div>
          <button type="button" className={s.close} disabled={saving} onClick={()=>setOpen(false)}>×</button>
        </header>

        {error?<div className={s.error}>{error}</div>:null}

        <div className={s.route}>
          <article><small>HABITACIÓN ANTERIOR</small><b>Hab. {sourceRoom?.nombre||sourceId}</b><span>{sourceRoom?.tipo||"Habitación"}</span><em>Hasta {fmtDate(effectiveDate)}</em></article>
          <div className={s.arrow}>→</div>
          <article data-target="true"><small>NUEVA HABITACIÓN</small><b>{target?`Hab. ${target.nombre}`:"Elegir habitación"}</b><span>{target?.tipo||"Disponible para el tramo restante"}</span><em>Desde {fmtDate(effectiveDate)}</em></article>
        </div>

        <div className={s.formGrid}>
          <label><span>Fecha del cambio</span><input type="date" min={minSplitDate} max={maxSplitDate} value={effectiveDate} disabled={saving} onChange={event=>{setEffectiveDate(event.target.value);setTargetId("");setReprice(false);setRateQuote(null)}}/><small>{scheduled?"Cambio programado: la habitación actual sigue vigente hasta esa fecha y el nuevo tramo queda reservado desde ese día.":"El tramo anterior termina ese día y el nuevo empieza desde esa misma fecha."}</small></label>
          <label><span>Habitación de destino</span><select value={targetId} disabled={saving||checking} onChange={event=>{setTargetId(event.target.value);setReprice(false);setRateQuote(null);setError("")}}><option value="">{checking?"Comprobando disponibilidad…":"Seleccionar habitación"}</option>{targetRooms.map(room=>{const unavailable=availability.get(Number(room.id));return <option key={room.id} value={room.id} disabled={Boolean(unavailable)}>Hab. {room.nombre} · {room.tipo||"Habitación"}{unavailable?` · ${unavailable}`:room.estado&&!["limpia","inspeccionada","libre"].includes(String(room.estado).toLowerCase())?` · ${room.estado}`:""}</option>})}</select><small>Solo aparecen como elegibles habitaciones libres durante todo el tramo restante.</small></label>
        </div>

        <label className={s.reason}><span>Motivo del cambio <b>*</b></span><textarea maxLength={500} value={reason} disabled={saving} placeholder="Ej.: problema de mantenimiento, pedido del huésped, upgrade operativo…" onChange={event=>setReason(event.target.value)}/><small>{reason.length}/500 · Queda registrado en el historial de la reserva.</small></label>

        {target?<section className={s.rateBox}>
          <div><small>{segmentPrepaid?"CAMBIO DE CATEGORÍA SOBRE UN TRAMO CON PAGOS":"NUEVO TRAMO"} · {remainingNights} noche{remainingNights===1?"":"s"} · IVA INCLUIDO</small><b>{quoteLoading?"Calculando tarifa final…":rateQuote?<>Hab. {target?.nombre||targetId} · {money(targetSegmentRate,rateQuote.reservation_currency)}/noche × {remainingNights} = {money(targetSegmentTotal,rateQuote.reservation_currency)}</>:<>Tarifa no disponible</>}</b>{rateQuote&&String(rateQuote.property_currency)!==String(rateQuote.reservation_currency)?<small style={{display:"block",marginTop:4}}>La reserva está en {rateQuote.reservation_currency}. La conversión usa TC {Number(rateQuote.fx_rate||0).toLocaleString("es-AR")} ({rateQuote.fx_source||"cotización configurada"}).</small>:null}</div>
          {quoteLoading?<span className={s.sameRate}>Consultando las tarifas finales vigentes para esas noches…</span>:rateQuote&&hasRateDifference?segmentPrepaid?<><div className={s.rateOptions}><label><input type="radio" name="split-rate" checked={!reprice} onChange={()=>setReprice(false)}/><span><b>Mantener lo ya acordado</b><small>{money(sourceSegmentRate,rateQuote.reservation_currency)} final/noche × {remainingNights} = {money(sourceSegmentTotal,rateQuote.reservation_currency)} para este tramo</small></span></label><label><input type="radio" name="split-rate" checked={reprice} onChange={()=>setReprice(true)}/><span><b>Aplicar tarifa de la nueva habitación</b><small>{money(targetSegmentRate,rateQuote.reservation_currency)} final/noche × {remainingNights} = {money(targetSegmentTotal,rateQuote.reservation_currency)}{segmentFullyPrepaid?<> · ya abonado {money(paidToSegment,rateQuote.reservation_currency)} · diferencia a cobrar {money(categoryDifference,rateQuote.reservation_currency)}</>:<> · ya abonado sobre este tramo {money(paidToSegment,rateQuote.reservation_currency)} · saldo del nuevo tramo {money(targetSegmentBalance,rateQuote.reservation_currency)}</>}</small></span></label></div><div className={s.sameRate} style={{marginTop:9}}>Ya cobrado en la reserva: <b>{money(paidTotal,rateQuote.reservation_currency)}</b> · Total de estadía con esta opción: <b>{money(resultingTotal,rateQuote.reservation_currency)}</b> · Saldo: <b>{money(resultingBalance,rateQuote.reservation_currency)}</b>.</div></>:<><div className={s.rateOptions}><label><input type="radio" name="split-rate" checked={reprice} onChange={()=>setReprice(true)}/><span><b>Cobrar tarifa de la nueva habitación</b><small>{money(targetSegmentRate,rateQuote.reservation_currency)} final/noche × {remainingNights} = {money(targetSegmentTotal,rateQuote.reservation_currency)}</small></span></label><label><input type="radio" name="split-rate" checked={!reprice} onChange={()=>setReprice(false)}/><span><b>Mantener tarifa anterior por cortesía</b><small>{money(sourceSegmentRate,rateQuote.reservation_currency)} final/noche × {remainingNights} = {money(sourceSegmentTotal,rateQuote.reservation_currency)}</small></span></label></div><div className={s.sameRate} style={{marginTop:9}}>Este tramo todavía no tiene pagos aplicados. Ya cobrado en la reserva: <b>{money(paidTotal,rateQuote.reservation_currency)}</b> · Total de estadía con esta opción: <b>{money(resultingTotal,rateQuote.reservation_currency)}</b> · Saldo: <b>{money(resultingBalance,rateQuote.reservation_currency)}</b>. No se muestra una “diferencia” porque el tramo nuevo se cobra por su propia tarifa.</div></>:rateQuote?<><span className={s.sameRate}>La habitación nueva tiene la misma tarifa final para este tramo.</span><div className={s.sameRate} style={{marginTop:9}}>Ya cobrado: <b>{money(paidTotal,rateQuote.reservation_currency)}</b> · Saldo: <b>{money(Math.max(0,reservationTotal-paidTotal),rateQuote.reservation_currency)}</b>.</div></>:<span className={s.sameRate}>No se pudo obtener una cotización final segura. Volvé a elegir la habitación.</span>}
        </section>:null}

        <section className={s.folios}>
          <div className={s.folioHeading}><span>▣</span><div><b>Así quedan los folios</b><small>No se crea otra reserva ni se duplican los pagos.</small></div></div>
          <div className={s.folioGrid}>
            <article><small>FOLIO 1 · TRAMO ANTERIOR</small><b>Hab. {sourceRoom?.nombre||sourceId}</b><span>{fmtDate(sourceStart)} → {fmtDate(effectiveDate)}</span></article>
            <article><small>FOLIO 2 · NUEVO TRAMO</small><b>{target?`Hab. ${target.nombre}`:"Nueva habitación"}</b><span>{fmtDate(effectiveDate)} → {fmtDate(sourceEnd)}</span></article>
          </div>
          <p>{segmentPrepaid?<>Si el tramo futuro ya tenía pagos aplicados, el sistema conserva ese importe y calcula solamente lo que falta para la nueva habitación.</>:<>Como el nuevo tramo todavía no tiene pagos aplicados, se cobra directamente su tarifa desde {fmtDate(effectiveDate)}. No se descuenta ni se vuelve a cobrar la noche anterior.</>}</p>
        </section>

        <footer className={s.footer}><button type="button" className={s.cancel} disabled={saving} onClick={()=>setOpen(false)}>Cancelar</button><button type="button" className={s.confirm} disabled={saving||checking||quoteLoading||!targetId||!reason.trim()||(reprice&&!rateQuote)} onClick={confirm}>{saving?"Guardando…":quoteLoading?"Calculando tarifa…":scheduled?"Programar cambio":"Confirmar división"}</button></footer>
      </section>
    </div>:null}
  </>
}
