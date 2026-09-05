"use client"

import{useCallback,useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{attachPayments}from"./planningPayment"

const DAY=86400000
const nightsBetween=(start,end)=>Math.max(1,Math.round((new Date(`${end}T12:00:00`)-new Date(`${start}T12:00:00`))/DAY))
function toast(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}
const uniqueNumeric=values=>[...new Set((values||[]).map(Number).filter(Number.isFinite))]
const reservationRooms=item=>uniqueNumeric([item.habitacion_id,...(item.habitaciones_ids||[])])

export default function usePlanningData(propertyId,windowStart,windowEndExclusive){
  const[rooms,setRooms]=useState([])
  const[reservations,setReservations]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async(silent=false)=>{
    if(!propertyId||!windowStart||!windowEndExclusive)return
    if(!silent)setLoading(true)
    setError("")
    try{
      const[roomRes,resRes,floorRes,paymentRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,capacidad,precio,estado,activa,sort_order,housekeeping_zone,floor_id").eq("property_id",propertyId).eq("activa",true),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,tarifa_noche,precio_total,moneda,canal_reserva,cantidad_huespedes,no_show,tipo_estadia,notas").eq("property_id",propertyId).neq("estado","cancelada").lt("fecha_entrada",windowEndExclusive).gte("fecha_salida",windowStart).order("fecha_entrada"),
        supabase.from("hotel_floors").select("id,name,sort_order,active").eq("property_id",propertyId).eq("active",true).order("sort_order"),
        supabase.from("pagos").select("id,reserva_id,monto,moneda,estado,created_at").eq("property_id",propertyId).eq("estado","confirmado"),
      ])
      if(roomRes.error)throw roomRes.error
      if(resRes.error)throw resRes.error
      if(floorRes.error)throw floorRes.error
      const floorById=new Map((floorRes.data||[]).map(floor=>[String(floor.id),floor]))
      const roomRows=(roomRes.data||[]).map(room=>{const floor=floorById.get(String(room.floor_id||""));return{...room,floor_name:floor?.name||"Sin piso",floor_sort:Number(floor?.sort_order??999)}}).sort((a,b)=>a.floor_sort-b.floor_sort||Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.nombre).localeCompare(String(b.nombre),"es",{numeric:true}))
      const enriched=attachPayments(resRes.data||[],paymentRes.error?[]:paymentRes.data||[])
      setRooms(roomRows);setReservations(enriched)
    }catch(err){setError(err?.message||"No se pudo cargar el Planning.")}
    finally{if(!silent)setLoading(false)}
  },[propertyId,windowStart,windowEndExclusive])

  useEffect(()=>{load()},[load])
  useEffect(()=>{if(typeof window==="undefined")return;const refresh=()=>load(true);window.addEventListener("hl:pms-payment-updated",refresh);return()=>window.removeEventListener("hl:pms-payment-updated",refresh)},[load])

  const moveReservation=useCallback(async({reservationId,roomId,start,end})=>{
    const numericId=Number(reservationId),numericRoom=Number(roomId)
    const previous=reservations.find(item=>Number(item.id)===numericId)
    if(!previous)throw new Error("No encontramos la reserva en el Planning actual.")
    const oldNights=nightsBetween(previous.fecha_entrada,previous.fecha_salida),newNights=nightsBetween(start,end)
    const optimistic={...previous,habitacion_id:numericRoom,habitaciones_ids:[numericRoom],fecha_entrada:start,fecha_salida:end,noches:newNights}
    setReservations(list=>list.map(item=>Number(item.id)===numericId?optimistic:item).filter(item=>item.fecha_entrada<windowEndExclusive&&item.fecha_salida>=windowStart))
    setError("")
    try{
      const{data,error:rpcError}=await supabase.rpc("hl_planning_move_reservation_atomic",{p_reserva_id:numericId,p_habitacion_id:numericRoom,p_fecha_entrada:start,p_fecha_salida:end})
      if(rpcError)throw rpcError
      setReservations(list=>list.map(item=>Number(item.id)===Number(data.id)?{...data,payment_paid:item.payment_paid||0,payment_foreign_count:item.payment_foreign_count||0,payment_last_id:item.payment_last_id||null,payment_last_at:item.payment_last_at||null}:item).filter(item=>item.fecha_entrada<windowEndExclusive&&item.fecha_salida>=windowStart))
      const oldRoom=rooms.find(room=>Number(room.id)===Number(previous.habitacion_id))?.nombre||previous.habitacion_id,newRoom=rooms.find(room=>Number(room.id)===numericRoom)?.nombre||numericRoom
      const roomChanged=Number(previous.habitacion_id)!==numericRoom,startChanged=previous.fecha_entrada!==start,durationChanged=oldNights!==newNights
      let message="Cambio guardado en el Planning."
      if(roomChanged&&startChanged)message=`Habitación ${oldRoom} → ${newRoom} · nueva entrada ${start}.`
      else if(roomChanged)message=`Habitación ${oldRoom} → ${newRoom}.`
      else if(durationChanged)message=`Estadía ${newNights>oldNights?"ampliada":"reducida"}: ${oldNights} → ${newNights} noches.`
      else if(startChanged)message=`Reserva movida a ${start}.`
      toast({title:"Planning actualizado",message});return data
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

    const{data:conflicts,error:conflictError}=await supabase.from("reservas").select("id,numero_reserva,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show").eq("property_id",propertyId).neq("estado","cancelada").eq("no_show",false).lt("fecha_entrada",draft.end).gt("fecha_salida",draft.start)
    if(conflictError)throw conflictError
    const conflict=(conflicts||[]).find(item=>reservationRooms(item).some(id=>roomIds.includes(id)))
    if(conflict){const conflictRoom=selectedRooms.find(room=>reservationRooms(conflict).includes(Number(room.id)));throw new Error(`La habitación ${conflictRoom?.nombre||"seleccionada"} ya tiene una reserva que se superpone con esas fechas.`)}

    const nights=nightsBetween(draft.start,draft.end),defaultRate=selectedRooms.reduce((sum,room)=>sum+(Number(room.precio)||0),0),rate=Number(draft.rate||defaultRate||0),subtotal=rate*nights
    const discountType=draft.discountType||"none",discountValue=Math.max(0,Number(draft.discountValue)||0)
    const discountAmount=discountType==="percent"?Math.min(subtotal,subtotal*Math.min(100,discountValue)/100):discountType==="amount"?Math.min(subtotal,discountValue):0,total=Math.max(0,subtotal-discountAmount)
    const payload={
      property_id:propertyId,user_id:userData?.user?.id||null,habitacion_id:roomIds[0],habitaciones_ids:roomIds,
      habitaciones_detalle:selectedRooms.map(room=>({habitacion_id:Number(room.id),nombre:room.nombre,tipo:room.tipo||null,tarifa_noche:Number(room.precio)||0})),
      fecha_entrada:draft.start,fecha_salida:draft.end,tipo_estadia:"overnight",nombre_huesped:draft.guest.trim(),email_huesped:draft.email?.trim()||null,telefono_huesped:draft.phone?.trim()||null,pais_huesped:draft.country?.trim()||null,
      cantidad_huespedes:Number(draft.guests)||1,canal_reserva:draft.channel||"Walk-in",codigo_canal:draft.voucher?.trim()||null,tarifa_noche:rate,noches:nights,subtotal,descuento_tipo:discountType==="none"?null:discountType,descuento_valor:discountType==="none"?0:discountValue,descuento_importe:discountAmount,precio_total:total,moneda:draft.currency||"ARS",notas:draft.notes?.trim()||null,
      mascotas:[],mascotas_total:0,servicios:[],pasajeros:[],vehiculos:0,cochera_total:0,estado:draft.status||"confirmada",no_show:false,
    }
    const{data,error:rpcError}=await supabase.rpc("hl_create_reservation_atomic",{p_reservation:payload,p_payments:[]})
    if(rpcError)throw rpcError
    const created={...data,payment_paid:0,payment_foreign_count:0,payment_last_id:null,payment_last_at:null}
    if(data.fecha_entrada<windowEndExclusive&&data.fecha_salida>=windowStart)setReservations(list=>[...list,created])
    const names=selectedRooms.map(room=>room.nombre).join(", ")
    toast({title:roomIds.length>1?"Reserva grupal creada":"Reserva creada",message:`${draft.guest.trim()} · ${roomIds.length>1?`${roomIds.length} habitaciones (${names})`:`Habitación ${names}`} · ${nights} noche${nights===1?"":"s"}.`})
    return created
  },[propertyId,rooms,windowStart,windowEndExclusive])

  return{rooms,reservations,loading,error,setError,load,moveReservation,createReservation}
}
