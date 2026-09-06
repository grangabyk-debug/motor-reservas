"use client"

import{useCallback,useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{attachPayments}from"./planningPayment"

const DAY=86400000
const nightsBetween=(start,end)=>Math.max(1,Math.round((new Date(`${end}T12:00:00`)-new Date(`${start}T12:00:00`))/DAY))
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
function toast(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}
const uniqueNumeric=values=>[...new Set((values||[]).map(Number).filter(Number.isFinite))]
const reservationRooms=item=>uniqueNumeric([item.habitacion_id,...(item.habitaciones_ids||[])])
const policySnapshot=policy=>policy?{id:policy.id,code:policy.code,name:policy.name,description:policy.description,policy_type:policy.policy_type,language:policy.language,currency:policy.currency,cancellation_rules:policy.cancellation_rules||[],no_show_rule:policy.no_show_rule||{charge_type:"none",value:0},early_checkout_rule:policy.early_checkout_rule||{charge_type:"none",value:0},prepayment_required:Boolean(policy.prepayment_required),prepayment_percent:Number(policy.prepayment_percent)||0,captured_at:new Date().toISOString()}:{}
const DISCOUNT_REASON_LABELS={group:"Grupo / varias habitaciones",long_stay:"Estadía prolongada",promotion:"Promoción comercial",commercial:"Acuerdo comercial",loyalty:"Fidelización",courtesy:"Cortesía",other:"Otro"}

export default function usePlanningData(propertyId,windowStart,windowEndExclusive){
  const[rooms,setRooms]=useState([])
  const[reservations,setReservations]=useState([])
  const[cancellationPolicies,setCancellationPolicies]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async(silent=false)=>{
    if(!propertyId||!windowStart||!windowEndExclusive)return
    if(!silent)setLoading(true)
    setError("")
    try{
      const[roomRes,resRes,floorRes,paymentRes,policyRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,capacidad,precio,estado,activa,sort_order,housekeeping_zone,floor_id").eq("property_id",propertyId).eq("activa",true),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,habitacion_id,habitaciones_ids,habitaciones_detalle,fecha_entrada,fecha_salida,estado,tarifa_noche,precio_total,moneda,canal_reserva,cantidad_huespedes,no_show,tipo_estadia,notas,cancellation_policy_id,cancellation_policy_snapshot").eq("property_id",propertyId).neq("estado","cancelada").lt("fecha_entrada",windowEndExclusive).gte("fecha_salida",windowStart).order("fecha_entrada"),
        supabase.from("hotel_floors").select("id,name,sort_order,active").eq("property_id",propertyId).eq("active",true).order("sort_order"),
        supabase.from("pagos").select("id,reserva_id,monto,moneda,estado,created_at").eq("property_id",propertyId).eq("estado","confirmado"),
        supabase.from("hotel_cancellation_policies").select("id,code,name,description,policy_type,language,currency,cancellation_rules,no_show_rule,early_checkout_rule,prepayment_required,prepayment_percent,active,is_default").eq("property_id",propertyId).eq("active",true).order("is_default",{ascending:false}).order("name"),
      ])
      if(roomRes.error)throw roomRes.error
      if(resRes.error)throw resRes.error
      if(floorRes.error)throw floorRes.error
      if(policyRes.error)throw policyRes.error
      const floorById=new Map((floorRes.data||[]).map(floor=>[String(floor.id),floor]))
      const roomRows=(roomRes.data||[]).map(room=>{const floor=floorById.get(String(room.floor_id||""));return{...room,floor_name:floor?.name||"Sin piso",floor_sort:Number(floor?.sort_order??999)}}).sort((a,b)=>a.floor_sort-b.floor_sort||Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.nombre).localeCompare(String(b.nombre),"es",{numeric:true}))
      const enriched=attachPayments(resRes.data||[],paymentRes.error?[]:paymentRes.data||[])
      setRooms(roomRows);setReservations(enriched);setCancellationPolicies(policyRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar el Planning.")}
    finally{if(!silent)setLoading(false)}
  },[propertyId,windowStart,windowEndExclusive])

  useEffect(()=>{load()},[load])
  useEffect(()=>{if(typeof window==="undefined")return;const refresh=()=>load(true);window.addEventListener("hl:pms-payment-updated",refresh);window.addEventListener("hl:pms-reservation-updated",refresh);window.addEventListener("hl:pms-cancellation-policies-updated",refresh);return()=>{window.removeEventListener("hl:pms-payment-updated",refresh);window.removeEventListener("hl:pms-reservation-updated",refresh);window.removeEventListener("hl:pms-cancellation-policies-updated",refresh)}},[load])
  useEffect(()=>{
    if(!propertyId)return
    let timer=null
    const refresh=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>load(true),70)}
    const channel=supabase.channel(`hl-planning-live-${propertyId}`).on("postgres_changes",{event:"*",schema:"public",table:"reservas",filter:`property_id=eq.${propertyId}`},refresh).on("postgres_changes",{event:"*",schema:"public",table:"pagos",filter:`property_id=eq.${propertyId}`},refresh).on("postgres_changes",{event:"*",schema:"public",table:"hotel_cancellation_policies",filter:`property_id=eq.${propertyId}`},refresh).subscribe()
    return()=>{if(timer)clearTimeout(timer);supabase.removeChannel(channel)}
  },[propertyId,load])

  const moveReservation=useCallback(async({reservationId,roomId,start,end,reprice=false})=>{
    const numericId=Number(reservationId),numericRoom=Number(roomId)
    const previous=reservations.find(item=>Number(item.id)===numericId)
    if(!previous)throw new Error("No encontramos la reserva en el Planning actual.")
    const oldNights=nightsBetween(previous.fecha_entrada,previous.fecha_salida),newNights=nightsBetween(start,end)
    const optimistic={...previous,habitacion_id:numericRoom,habitaciones_ids:[numericRoom],fecha_entrada:start,fecha_salida:end,noches:newNights}
    setReservations(list=>list.map(item=>Number(item.id)===numericId?optimistic:item).filter(item=>item.fecha_entrada<windowEndExclusive&&item.fecha_salida>=windowStart))
    setError("")
    try{
      const{data,error:rpcError}=await supabase.rpc("hl_planning_move_reservation_priced_atomic",{p_reserva_id:numericId,p_habitacion_id:numericRoom,p_fecha_entrada:start,p_fecha_salida:end,p_reprice:Boolean(reprice)})
      if(rpcError)throw rpcError
      setReservations(list=>list.map(item=>Number(item.id)===Number(data.id)?{...data,payment_paid:item.payment_paid||0,payment_foreign_count:item.payment_foreign_count||0,payment_last_id:item.payment_last_id||null,payment_last_at:item.payment_last_at||null}:item).filter(item=>item.fecha_entrada<windowEndExclusive&&item.fecha_salida>=windowStart))
      const oldRoomData=rooms.find(room=>Number(room.id)===Number(previous.habitacion_id)),newRoomData=rooms.find(room=>Number(room.id)===numericRoom)
      const oldRoom=oldRoomData?.nombre||previous.habitacion_id,newRoom=newRoomData?.nombre||numericRoom
      const roomChanged=Number(previous.habitacion_id)!==numericRoom,startChanged=previous.fecha_entrada!==start,durationChanged=oldNights!==newNights
      const categoryChanged=roomChanged&&String(oldRoomData?.tipo||"")!==String(newRoomData?.tipo||"")
      const oldRate=Number(previous.tarifa_noche)||0,newRate=Number(data?.tarifa_noche)||0,currency=data?.moneda||previous.moneda||"ARS"
      const direction=Number(newRoomData?.precio||0)>Number(oldRoomData?.precio||0)?"Upgrade":Number(newRoomData?.precio||0)<Number(oldRoomData?.precio||0)?"Downgrade":"Cambio de categoría"
      let message="Cambio guardado en el Planning."
      if(categoryChanged)message=`${direction}: ${oldRoom} (${oldRoomData?.tipo||"sin categoría"}) → ${newRoom} (${newRoomData?.tipo||"sin categoría"}) · ${reprice&&oldRate!==newRate?`tarifa ${money(oldRate,currency)} → ${money(newRate,currency)}`:"tarifa original mantenida"}.`
      else if(roomChanged&&startChanged)message=`Habitación ${oldRoom} → ${newRoom} · nueva entrada ${start}${reprice&&oldRate!==newRate?` · tarifa ${money(oldRate,currency)} → ${money(newRate,currency)}`:""}.`
      else if(roomChanged)message=`Habitación ${oldRoom} → ${newRoom}${reprice&&oldRate!==newRate?` · tarifa ${money(oldRate,currency)} → ${money(newRate,currency)}`:""}.`
      else if(startChanged)message=`Reserva movida a ${start}.`
      if(!(durationChanged&&!roomChanged&&!startChanged))toast({title:"Planning actualizado",message})
      if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:numericId}}))
      return data
    }catch(err){
      setReservations(list=>{const withoutOptimistic=list.filter(item=>Number(item.id)!==numericId);return previous.fecha_entrada<windowEndExclusive&&previous.fecha_salida>=windowStart?[...withoutOptimistic,previous]:withoutOptimistic})
      toast({tone:"error",title:"Cambio revertido",message:"El servidor no pudo confirmar el movimiento y el Planning volvió al estado anterior.",duration:4200});throw err
    }
  },[reservations,rooms,windowStart,windowEndExclusive])

  const createReservation=useCallback(async draft=>{
    const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
    const roomIds=uniqueNumeric(draft.roomIds?.length?draft.roomIds:[draft.roomId])
    if(!roomIds.length)throw new Error("Elegí al menos una habitación.")
    const selectedRooms=roomIds.map(id=>rooms.find(room=>Number(room.id)===id)).filter(Boolean)
    if(selectedRooms.length!==roomIds.length)throw new Error("Hay una habitación seleccionada que ya no está disponible en esta propiedad.")
    const policy=cancellationPolicies.find(row=>String(row.id)===String(draft.cancellationPolicyId))||cancellationPolicies.find(row=>row.is_default)||cancellationPolicies[0]
    if(!policy)throw new Error("Configurá una política de cancelación antes de crear la reserva.")

    const{data:conflicts,error:conflictError}=await supabase.from("reservas").select("id,numero_reserva,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show").eq("property_id",propertyId).neq("estado","cancelada").eq("no_show",false).lt("fecha_entrada",draft.end).gt("fecha_salida",draft.start)
    if(conflictError)throw conflictError
    const conflict=(conflicts||[]).find(item=>reservationRooms(item).some(id=>roomIds.includes(id)))
    if(conflict){const conflictRoom=selectedRooms.find(room=>reservationRooms(conflict).includes(Number(room.id)));throw new Error(`La habitación ${conflictRoom?.nombre||"seleccionada"} ya tiene una reserva que se superpone con esas fechas.`)}

    const roomAssignments=draft.roomAssignments||{},requestedGuests=Math.max(1,Number(draft.guests)||1)
    const details=selectedRooms.map(room=>{const assignment=roomAssignments[String(room.id)]||{};return{habitacion_id:Number(room.id),nombre:room.nombre,categoria_asignada:room.tipo||"Habitación",categoria_vendida:assignment.soldAs||room.tipo||"Habitación",huespedes:Math.max(0,Number(assignment.guests)||0),tarifa_noche:Math.max(0,Number(assignment.rate??room.precio)||0),rooming:{matrimonial:Math.max(0,Number(assignment.matrimonial)||0),individual:Math.max(0,Number(assignment.individual)||0)}}})
    const assignedGuests=details.reduce((sum,item)=>sum+item.huespedes,0)
    if(assignedGuests!==requestedGuests)throw new Error(`Distribuí los ${requestedGuests} huésped${requestedGuests===1?"":"es"} entre las habitaciones seleccionadas antes de crear la reserva.`)
    const totalGuests=requestedGuests,defaultRate=details.reduce((sum,item)=>sum+item.tarifa_noche,0),nights=nightsBetween(draft.start,draft.end),rate=Number(draft.rate||defaultRate||0),subtotal=rate*nights
    const discountType=draft.discountType||"none",discountValue=Math.max(0,Number(draft.discountValue)||0)
    const discountAmount=discountType==="percent"?Math.min(subtotal,subtotal*Math.min(100,discountValue)/100):discountType==="amount"?Math.min(subtotal,discountValue):0,total=Math.max(0,subtotal-discountAmount)
    const reasonKey=String(draft.discountReason||"").trim(),reasonDetail=String(draft.discountReasonDetail||"").trim()
    if(discountAmount>0&&!reasonKey)throw new Error("Indicá el motivo del descuento antes de crear la reserva.")
    if(discountAmount>0&&reasonKey==="other"&&!reasonDetail)throw new Error("Especificá el motivo del descuento.")
    const reasonLabel=DISCOUNT_REASON_LABELS[reasonKey]||reasonKey,discountReason=discountAmount>0?`${reasonLabel}${reasonDetail?` · ${reasonDetail}`:""}`:null
    const payload={
      property_id:propertyId,user_id:userData?.user?.id||null,habitacion_id:roomIds[0],habitaciones_ids:roomIds,
      habitaciones_detalle:details,
      fecha_entrada:draft.start,fecha_salida:draft.end,tipo_estadia:"overnight",nombre_huesped:draft.guest.trim(),email_huesped:draft.email?.trim()||null,telefono_huesped:draft.phone?.trim()||null,pais_huesped:draft.country?.trim()||null,
      cantidad_huespedes:totalGuests,canal_reserva:draft.channel||"Walk-in",codigo_canal:draft.voucher?.trim()||null,tarifa_noche:rate,noches:nights,subtotal,descuento_tipo:discountAmount>0?discountType:"none",descuento_valor:discountAmount>0?discountValue:0,descuento_importe:discountAmount,descuento_motivo:discountReason,descuento_origen:discountAmount>0?"manual":null,precio_total:total,moneda:draft.currency||"ARS",notas:draft.notes?.trim()||null,
      cancellation_policy_id:policy.id,cancellation_policy_snapshot:policySnapshot(policy),
      mascotas:[],mascotas_total:0,servicios:[],pasajeros:[],vehiculos:0,cochera_total:0,estado:draft.status||"confirmada",no_show:false,
    }
    const{data,error:rpcError}=await supabase.rpc("hl_create_reservation_atomic",{p_reservation:payload,p_payments:[]})
    if(rpcError)throw rpcError
    const created={...data,payment_paid:0,payment_foreign_count:0,payment_last_id:null,payment_last_at:null}
    if(data.fecha_entrada<windowEndExclusive&&data.fecha_salida>=windowStart)setReservations(list=>[...list,created])
    const names=selectedRooms.map(room=>room.nombre).join(", ")
    toast({title:roomIds.length>1?"Reserva grupal creada":"Reserva creada",message:`${draft.guest.trim()} · ${roomIds.length>1?`${roomIds.length} habitaciones (${names})`:`Habitación ${names}`} · ${nights} noche${nights===1?"":"s"}${discountAmount>0?` · descuento ${discountType==="percent"?`${discountValue}%`:money(discountAmount,draft.currency)} (${reasonLabel})`:""} · ${policy.name}.`})
    if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:data.id}}))
    return created
  },[propertyId,rooms,cancellationPolicies,windowStart,windowEndExclusive])

  return{rooms,reservations,cancellationPolicies,loading,error,setError,load,moveReservation,createReservation}
}
