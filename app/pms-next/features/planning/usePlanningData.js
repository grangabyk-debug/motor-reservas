"use client"

import{useCallback,useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"

export default function usePlanningData(propertyId){
  const[rooms,setRooms]=useState([])
  const[reservations,setReservations]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[roomRes,resRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,capacidad,precio,estado,activa,sort_order,housekeeping_zone").eq("property_id",propertyId).eq("activa",true).order("sort_order").order("nombre"),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,tarifa_noche,precio_total,moneda,canal_reserva,cantidad_huespedes,no_show,tipo_estadia,notas").eq("property_id",propertyId).neq("estado","cancelada").order("fecha_entrada"),
      ])
      if(roomRes.error)throw roomRes.error
      if(resRes.error)throw resRes.error
      setRooms(roomRes.data||[])
      setReservations(resRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar el Planning.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])

  const moveReservation=useCallback(async({reservationId,roomId,start,end})=>{
    const{data,error:rpcError}=await supabase.rpc("hl_planning_move_reservation_atomic",{p_reserva_id:Number(reservationId),p_habitacion_id:Number(roomId),p_fecha_entrada:start,p_fecha_salida:end})
    if(rpcError)throw rpcError
    setReservations(list=>list.map(item=>item.id===data.id?data:item))
    return data
  },[])

  const createReservation=useCallback(async draft=>{
    const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
    const nights=Math.max(1,Math.round((new Date(`${draft.end}T12:00:00`)-new Date(`${draft.start}T12:00:00`))/86400000))
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
    setReservations(list=>[...list,data])
    return data
  },[propertyId,rooms])

  return{rooms,reservations,loading,error,setError,load,moveReservation,createReservation}
}
