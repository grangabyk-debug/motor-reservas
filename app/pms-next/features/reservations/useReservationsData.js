"use client"

import{useCallback,useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const PAGE_SIZE=200

export default function useReservationsData(propertyId){
  const[reservations,setReservations]=useState([])
  const[rooms,setRooms]=useState([])
  const[payments,setPayments]=useState([])
  const[loading,setLoading]=useState(true)
  const[loadingMore,setLoadingMore]=useState(false)
  const[hasMore,setHasMore]=useState(false)
  const[error,setError]=useState("")
  const pageRef=useRef(0)

  const fetchPage=useCallback(async(page,{replace=false}={})=>{
    if(!propertyId)return
    const from=page*PAGE_SIZE,to=from+PAGE_SIZE-1
    const resQuery=supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,habitacion_id,habitaciones_ids,habitaciones_detalle,fecha_entrada,fecha_salida,estado,no_show,canal_reserva,codigo_canal,precio_total,subtotal,descuento_tipo,descuento_valor,descuento_importe,tarifa_noche,noches,moneda,cantidad_huespedes,guest_profile_id,notas,created_at,tipo_estadia,tipo_cama,servicios,mascotas_total,cochera_total,extra,extra_descripcion,early_checkin_importe,late_checkout_importe,regimen,hora_llegada_estimada,hora_salida_estimada,pais_huesped,nacionalidad_huesped,tipo_documento_huesped,dni_huesped").eq("property_id",propertyId).order("fecha_entrada",{ascending:false}).range(from,to)
    const roomQuery=replace?supabase.from("habitaciones").select("id,nombre,tipo,capacidad,precio,estado,activa").eq("property_id",propertyId):Promise.resolve({data:null,error:null})
    const[resRes,roomRes]=await Promise.all([resQuery,roomQuery])
    if(resRes.error)throw resRes.error
    if(roomRes.error)throw roomRes.error
    const pageReservations=resRes.data||[],ids=pageReservations.map(item=>item.id)
    let pagePayments=[]
    if(ids.length){const payRes=await supabase.from("pagos").select("id,reserva_id,monto,estado,refunded_amount,moneda,metodo,nota,source,referencia,created_at").eq("property_id",propertyId).in("reserva_id",ids).order("created_at",{ascending:false});if(payRes.error)throw payRes.error;pagePayments=payRes.data||[]}
    setReservations(current=>replace?pageReservations:[...current,...pageReservations]);setPayments(current=>replace?pagePayments:[...current,...pagePayments]);if(replace)setRooms(roomRes.data||[]);setHasMore(pageReservations.length===PAGE_SIZE);pageRef.current=page
  },[propertyId])

  const load=useCallback(async()=>{if(!propertyId)return;setLoading(true);setError("");pageRef.current=0;try{await fetchPage(0,{replace:true})}catch(err){setError(err?.message||"No se pudieron cargar las reservas.")}finally{setLoading(false)}},[propertyId,fetchPage])
  useEffect(()=>{load()},[load])
  const loadMore=useCallback(async()=>{if(!propertyId||loading||loadingMore||!hasMore)return;setLoadingMore(true);setError("");try{await fetchPage(pageRef.current+1)}catch(err){setError(err?.message||"No se pudo cargar más historial.")}finally{setLoadingMore(false)}},[propertyId,loading,loadingMore,hasMore,fetchPage])

  const paymentByReservation=useMemo(()=>{const map=new Map();for(const payment of payments){if(['anulado','cancelado','void'].includes(String(payment.estado||'').toLowerCase()))continue;const net=Math.max(0,Number(payment.monto||0)-Number(payment.refunded_amount||0));map.set(Number(payment.reserva_id),(map.get(Number(payment.reserva_id))||0)+net)}return map},[payments])
  const updateReservation=useCallback(async(id,patch)=>{const{data,error:updateError}=await supabase.from("reservas").update(patch).eq("id",id).eq("property_id",propertyId).select().single();if(updateError)throw updateError;setReservations(list=>list.map(item=>item.id===data.id?{...item,...data}:item));return data},[propertyId])
  const checkin=useCallback(async id=>{const{data,error:rpcError}=await supabase.rpc("hl_checkin_reservation_atomic",{p_reserva_id:Number(id)});if(rpcError)throw rpcError;setReservations(list=>list.map(item=>item.id===data.id?{...item,...data}:item));return data},[])
  const checkout=useCallback(async id=>{const{data,error:rpcError}=await supabase.rpc("hl_checkout_reservation_atomic",{p_reserva_id:Number(id)});if(rpcError)throw rpcError;setReservations(list=>list.map(item=>item.id===data.id?{...item,...data}:item));return data},[])

  return{reservations,rooms,payments,paymentByReservation,loading,loadingMore,hasMore,error,setError,load,loadMore,updateReservation,checkin,checkout}
}
