"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

export default function useReservationsData(propertyId){
  const[reservations,setReservations]=useState([])
  const[rooms,setRooms]=useState([])
  const[payments,setPayments]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[resRes,roomRes,payRes]=await Promise.all([
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show,canal_reserva,precio_total,moneda,cantidad_huespedes,guest_profile_id,notas,created_at").eq("property_id",propertyId).order("fecha_entrada",{ascending:false}).limit(1000),
        supabase.from("habitaciones").select("id,nombre,tipo").eq("property_id",propertyId),
        supabase.from("pagos").select("id,reserva_id,monto,estado,refunded_amount,moneda,created_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(5000),
      ])
      if(resRes.error)throw resRes.error;if(roomRes.error)throw roomRes.error;if(payRes.error)throw payRes.error
      setReservations(resRes.data||[]);setRooms(roomRes.data||[]);setPayments(payRes.data||[])
    }catch(err){setError(err?.message||"No se pudieron cargar las reservas.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])

  const paymentByReservation=useMemo(()=>{
    const map=new Map()
    for(const payment of payments){
      if(['anulado','cancelado','void'].includes(String(payment.estado||'').toLowerCase()))continue
      const net=Math.max(0,Number(payment.monto||0)-Number(payment.refunded_amount||0))
      map.set(Number(payment.reserva_id),(map.get(Number(payment.reserva_id))||0)+net)
    }
    return map
  },[payments])

  const updateReservation=useCallback(async(id,patch)=>{
    const{data,error:updateError}=await supabase.from("reservas").update(patch).eq("id",id).eq("property_id",propertyId).select().single()
    if(updateError)throw updateError
    setReservations(list=>list.map(item=>item.id===data.id?data:item));return data
  },[propertyId])

  const checkout=useCallback(async id=>{
    const{data,error:rpcError}=await supabase.rpc("hl_checkout_reservation_atomic",{p_reserva_id:Number(id)})
    if(rpcError)throw rpcError
    setReservations(list=>list.map(item=>item.id===data.id?data:item));return data
  },[])

  return{reservations,rooms,paymentByReservation,loading,error,setError,load,updateReservation,checkout}
}
