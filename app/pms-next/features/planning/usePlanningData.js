"use client"

import{useCallback,useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const DAY=86400000
const nightsBetween=(start,end)=>Math.max(1,Math.round((new Date(`${end}T12:00:00`)-new Date(`${start}T12:00:00`))/DAY))
function toast(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}

export default function usePlanningData(propertyId,windowStart,windowEndExclusive){
  const[rooms,setRooms]=useState([])
  const[reservations,setReservations]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId||!windowStart||!windowEndExclusive)return
    setLoading(true);setError("")
    try{
      const[roomRes,resRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,capacidad,precio,estado,activa,sort_order,housekeeping_zone").eq("property_id",propertyId).eq("activa",true).order("sort_order").order("nombre"),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,tarifa_noche,precio_total,moneda,canal_reserva,cantidad_huespedes,no_show,tipo_estadia,notas").eq("property_id",propertyId).neq("estado","cancelada").lt("fecha_entrada",windowEndExclusive).gte("fecha_salida",windowStart).order("fecha_entrada"),
      ])
      if(roomRes.error)throw roomRes.error
      if(resRes.error)throw resRes.error
      setRooms(roomRes.data||[])
      setReservations(resRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar el Planning.")}
    finally{setLoading(false)}
  },[propertyId,windowStart,windowEndExclusive])

  useEffect(()=>{load()},[load])

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
      setReservations(list=>list.map(item=>Number(item.id)===Number(data.id)?data:item).filter(item=>item.fecha_entrada<windowEndExclusive&&item.fecha_salida>=windowStart))
      const oldRoom=rooms.find(room=>Number(room.id)===Number(previous.habitacion_id))?.nombre||previous.habitacion_id
      const newRoom=rooms.find(room=>Number(room.id)===numericRoom)?.nombre||numericRoom
      const roomChanged=Number(previous.habitacion_id)!==numericRoom
      const startChanged=previous.fecha_entrada!==start
      const durationChanged=oldNights!==newNights
      let message="Cambio guardado en el Planning."
      if(roomChanged&&startChanged)message=`Habitación ${oldRoom} → ${newRoom} · nueva entrada ${start}.`
      else if(roomChanged)message=`Habitación ${oldRoom} → ${newRoom}.`
      else if(durationChanged)message=`Estadía ${newNights>oldNights?"ampliada":"reducida"}: ${oldNights} → ${newNights} noches.`
      else if(startChanged)message=`Reserva movida a ${start}.`
      toast({title:"Planning actualizado",message})
      return data
    }catch(err){
      setReservations(list=>{
        const withoutOptimistic=list.filter(item=>Number(item.id)!==numericId)
        return previous.fecha_entrada<windowEndExclusive&&previous.fecha_salida>=windowStart?[...withoutOptimistic,previous]:withoutOptimistic
      })
      toast({tone:"error",title:"Cambio revertido",message:"El servidor no pudo confirmar el movimiento y el Planning volvió al estado anterior.",duration:4200})
      throw err
    }
  },[reservations,rooms,windowStart,windowEndExclusive])

  const createReservation=useCallback(async draft=>{
    const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
    const nights=nightsBetween(draft.start,draft.end)
    const room=rooms.find(item=>String(item.id)===String(draft.roomId))
    const rate=Number(draft.rate||room?.precio||0)
    const payload={
      property_id:propertyId,user_id:userData?.user?.id||null,habitacion_id:Number(draft.roomId),habitaciones_ids:[Number(draft.roomId)],habitaciones_detalle:[],
      fecha_entrada:draft.start,fecha_salida:draft.end,tipo_estadia:"overnight",nombre_huesped:draft.guest.trim(),email_huesped:draft.email?.trim()||null,telefono_huesped:draft.phone?.trim()||null,
      cantidad_huespedes:Number(draft.guests)||1,canal_reserva:draft.channel||"Directa",tarifa_noche:rate,noches:nights,precio_total:rate*nights,moneda:draft.currency||"ARS",notas:draft.notes?.trim()||null,
      mascotas:[],mascotas_total:0,servicios:[],pasajeros:[],vehiculos:0,cochera_total:0,estado:draft.status||"confirmada",no_show:false,
    }
    const{data,error:rpcError}=await supabase.rpc("hl_create_reservation_atomic",{p_reservation:payload,p_payments:[]})
    if(rpcError)throw rpcError
    if(data.fecha_entrada<windowEndExclusive&&data.fecha_salida>=windowStart)setReservations(list=>[...list,data])
    toast({title:"Reserva creada",message:`${draft.guest.trim()} · Habitación ${room?.nombre||draft.roomId} · ${nights} noche${nights===1?"":"s"}.`})
    return data
  },[propertyId,rooms,windowStart,windowEndExclusive])

  return{rooms,reservations,loading,error,setError,load,moveReservation,createReservation}
}
