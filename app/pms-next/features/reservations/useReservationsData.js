"use client"

import{useCallback,useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const PAGE_SIZE=200
const roomIds=item=>[...new Set([item?.habitacion_id,...(item?.habitaciones_ids||[])].filter(Boolean).map(Number))]

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
    const resQuery=supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,habitacion_id,habitaciones_ids,habitaciones_detalle,fecha_entrada,fecha_salida,estado,no_show,no_show_at,no_show_release_date,no_show_penalty_amount,no_show_penalty_status,no_show_note,garantia_tipo,garantia_marca,garantia_ultimos4,canal_reserva,codigo_canal,precio_total,subtotal,descuento_tipo,descuento_valor,descuento_importe,tarifa_noche,noches,moneda,cantidad_huespedes,guest_profile_id,notas,created_at,tipo_estadia,servicios,mascotas_total,cochera_total,extra,extra_descripcion,early_checkin_importe,late_checkout_importe,regimen,hora_llegada_estimada,hora_salida_estimada,pais_huesped,nacionalidad_huesped,tipo_documento_huesped,dni_huesped,cancellation_policy_id,cancellation_policy_snapshot").eq("property_id",propertyId).order("created_at",{ascending:false}).range(from,to)
    const roomQuery=replace?supabase.from("habitaciones").select("id,nombre,tipo,capacidad,precio,estado,activa").eq("property_id",propertyId).order("nombre"):Promise.resolve({data:null,error:null})
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
  useEffect(()=>{if(typeof window==="undefined")return;const refresh=()=>load();window.addEventListener("hl:pms-reservation-updated",refresh);window.addEventListener("hl:pms-payment-updated",refresh);return()=>{window.removeEventListener("hl:pms-reservation-updated",refresh);window.removeEventListener("hl:pms-payment-updated",refresh)}},[load])
  const loadMore=useCallback(async()=>{if(!propertyId||loading||loadingMore||!hasMore)return;setLoadingMore(true);setError("");try{await fetchPage(pageRef.current+1)}catch(err){setError(err?.message||"No se pudo cargar más historial.")}finally{setLoadingMore(false)}},[propertyId,loading,loadingMore,hasMore,fetchPage])

  const paymentByReservation=useMemo(()=>{const map=new Map();for(const payment of payments){if(['anulado','cancelado','void'].includes(String(payment.estado||'').toLowerCase()))continue;const net=Math.max(0,Number(payment.monto||0)-Number(payment.refunded_amount||0));map.set(Number(payment.reserva_id),(map.get(Number(payment.reserva_id))||0)+net)}return map},[payments])
  const notifyUpdate=id=>{if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(id)}}))}
  const updateReservation=useCallback(async(id,patch)=>{const{data,error:updateError}=await supabase.from("reservas").update(patch).eq("id",id).eq("property_id",propertyId).select().single();if(updateError)throw updateError;setReservations(list=>list.map(item=>item.id===data.id?{...item,...data}:item));notifyUpdate(id);return data},[propertyId])
  const previewMove=useCallback(async({reservationId,roomId,start,end})=>{
    const target=rooms.find(room=>Number(room.id)===Number(roomId))
    if(!target||target.activa===false)return{ok:false,message:"La habitación seleccionada ya no está activa."}
    if(["mantenimiento","fuera_servicio"].includes(String(target.estado||"").toLowerCase()))return{ok:false,message:`La habitación ${target.nombre} está fuera de servicio.`}
    if(!start||!end||end<=start)return{ok:false,message:"La fecha de salida tiene que ser posterior a la entrada."}
    const[resRes,blockRes]=await Promise.all([
      supabase.from("reservas").select("id,numero_reserva,nombre_huesped,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show").eq("property_id",propertyId).neq("id",Number(reservationId)).neq("estado","cancelada").eq("no_show",false).lt("fecha_entrada",end).gt("fecha_salida",start),
      supabase.from("bloqueos").select("id,habitacion_id,fecha_desde,fecha_hasta,motivo").eq("property_id",propertyId).eq("habitacion_id",Number(roomId)).lt("fecha_desde",end).gt("fecha_hasta",start),
    ])
    if(resRes.error)throw resRes.error;if(blockRes.error)throw blockRes.error
    const conflict=(resRes.data||[]).find(row=>roomIds(row).includes(Number(roomId)))
    if(conflict)return{ok:false,message:`No se puede aplicar el cambio: la habitación ${target.nombre} está ocupada por ${conflict.nombre_huesped||conflict.numero_reserva||"otra reserva"} entre ${conflict.fecha_entrada} y ${conflict.fecha_salida}.`}
    const block=(blockRes.data||[])[0]
    if(block)return{ok:false,message:`No se puede aplicar el cambio: la habitación ${target.nombre} tiene un bloqueo${block.motivo?` (${block.motivo})`:""} durante esas fechas.`}
    return{ok:true,targetRoom:target}
  },[propertyId,rooms])
  const moveReservation=useCallback(async({reservationId,roomId,start,end,reprice=false})=>{const{data,error:rpcError}=await supabase.rpc("hl_planning_move_reservation_priced_atomic",{p_reserva_id:Number(reservationId),p_habitacion_id:Number(roomId),p_fecha_entrada:start,p_fecha_salida:end,p_reprice:Boolean(reprice)});if(rpcError)throw rpcError;setReservations(list=>list.map(item=>Number(item.id)===Number(data.id)?{...item,...data}:item));notifyUpdate(data.id);return data},[])
  const checkin=useCallback(async id=>{const{data,error:rpcError}=await supabase.rpc("hl_checkin_reservation_atomic",{p_reserva_id:Number(id)});if(rpcError)throw rpcError;setReservations(list=>list.map(item=>item.id===data.id?{...item,...data}:item));notifyUpdate(id);return data},[])
  const checkout=useCallback(async id=>{const{data,error:rpcError}=await supabase.rpc("hl_checkout_reservation_atomic",{p_reserva_id:Number(id)});if(rpcError)throw rpcError;setReservations(list=>list.map(item=>item.id===data.id?{...item,...data}:item));notifyUpdate(id);return data},[])
  const markNoShow=useCallback(async(id,{releaseDate,penaltyAmount=0,penaltyStatus="none",note=""}={})=>{const{data,error:rpcError}=await supabase.rpc("hl_mark_no_show_atomic",{p_reserva_id:Number(id),p_release_date:releaseDate||null,p_penalty_amount:Number(penaltyAmount)||0,p_penalty_status:penaltyStatus||"none",p_note:note||null});if(rpcError)throw rpcError;setReservations(list=>list.map(item=>Number(item.id)===Number(data.id)?{...item,...data}:item));notifyUpdate(id);return data},[])
  const restoreNoShow=useCallback(async(id,note="")=>{const{data,error:rpcError}=await supabase.rpc("hl_restore_no_show_atomic",{p_reserva_id:Number(id),p_note:note||null});if(rpcError)throw rpcError;setReservations(list=>list.map(item=>Number(item.id)===Number(data.id)?{...item,...data}:item));notifyUpdate(id);return data},[])

  return{reservations,rooms,payments,paymentByReservation,loading,loadingMore,hasMore,error,setError,load,loadMore,updateReservation,previewMove,moveReservation,checkin,checkout,markNoShow,restoreNoShow}
}
