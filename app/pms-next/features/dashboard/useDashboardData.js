"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"

const dateKey=offset=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+offset);return date.toLocaleDateString("en-CA")}
const validPayment=payment=>!["void","cancelado","anulado","cancelled"].includes(String(payment.estado||"").toLowerCase())
const roomIds=item=>[...new Set([item.habitacion_id,...(item.habitaciones_ids||[])].filter(Boolean).map(Number))]

export default function useDashboardData(propertyId){
  const[rooms,setRooms]=useState([]),[reservations,setReservations]=useState([]),[maintenance,setMaintenance]=useState([]),[housekeeping,setHousekeeping]=useState([]),[paymentsToday,setPaymentsToday]=useState([]),[reservationPayments,setReservationPayments]=useState([]),[guestProfiles,setGuestProfiles]=useState([])
  const[loading,setLoading]=useState(true),[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    const yesterday=dateKey(-1),today=dateKey(0),tomorrow=dateKey(1),dayAfter=dateKey(2)
    try{
      const[roomRes,resRes,maintRes,hkRes,payTodayRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,estado,activa").eq("property_id",propertyId).eq("activa",true),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show,precio_total,moneda,cantidad_huespedes,canal_reserva,hora_llegada_estimada,hora_salida_estimada,notas,guest_profile_id").eq("property_id",propertyId).lte("fecha_entrada",dayAfter).gte("fecha_salida",yesterday).neq("estado","cancelada"),
        supabase.from("hotel_maintenance_tickets").select("id,status,priority,due_at").eq("property_id",propertyId).not("status","in",'(resolved,cancelled)'),
        supabase.from("hotel_housekeeping_tasks").select("id,status,checklist,scheduled_for").eq("property_id",propertyId).gte("scheduled_for",`${today}T00:00:00`).lt("scheduled_for",`${tomorrow}T00:00:00`),
        supabase.from("pagos").select("id,reserva_id,monto,refunded_amount,estado,moneda,created_at").eq("property_id",propertyId).gte("created_at",`${today}T00:00:00`).lt("created_at",`${tomorrow}T00:00:00`),
      ])
      for(const result of[roomRes,resRes,maintRes,hkRes,payTodayRes])if(result.error)throw result.error
      const reservationRows=resRes.data||[],ids=reservationRows.map(row=>row.id),profileIds=[...new Set(reservationRows.map(row=>row.guest_profile_id).filter(Boolean))]
      let allPayments=[],profiles=[]
      if(ids.length){const payRes=await supabase.from("pagos").select("id,reserva_id,monto,refunded_amount,estado,moneda").eq("property_id",propertyId).in("reserva_id",ids);if(payRes.error)throw payRes.error;allPayments=payRes.data||[]}
      if(profileIds.length){const profileRes=await supabase.from("hotel_guest_profiles").select("id,vip_level,tags,language,preferences,notes").eq("property_id",propertyId).in("id",profileIds);if(profileRes.error)throw profileRes.error;profiles=profileRes.data||[]}
      setRooms(roomRes.data||[]);setReservations(reservationRows);setMaintenance(maintRes.data||[]);setHousekeeping(hkRes.data||[]);setPaymentsToday(payTodayRes.data||[]);setReservationPayments(allPayments);setGuestProfiles(profiles)
    }catch(err){setError(err?.message||"No se pudo cargar la operación de recepción.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])
  usePmsAutoRefresh(propertyId,load,["reservas","pagos","habitaciones","hotel_housekeeping_tasks","hotel_maintenance_tickets","hotel_guest_profiles"])

  const paymentByReservation=useMemo(()=>{const map=new Map();for(const payment of reservationPayments){if(!validPayment(payment))continue;const id=Number(payment.reserva_id),net=Math.max(0,Number(payment.monto||0)-Number(payment.refunded_amount||0));map.set(id,(map.get(id)||0)+net)}return map},[reservationPayments])
  const roomById=useMemo(()=>new Map(rooms.map(room=>[Number(room.id),room])),[rooms]),profileById=useMemo(()=>new Map(guestProfiles.map(profile=>[String(profile.id),profile])),[guestProfiles])
  const enrich=useCallback(item=>{const ids=roomIds(item),assigned=ids.map(id=>roomById.get(id)).filter(Boolean),paid=paymentByReservation.get(Number(item.id))||0,total=Number(item.precio_total)||0,profile=item.guest_profile_id?profileById.get(String(item.guest_profile_id)):null;return{...item,rooms:assigned,roomNames:assigned.map(room=>room.nombre),roomDirty:assigned.some(room=>room.estado==="sucia"),roomMaintenance:assigned.some(room=>room.estado==="mantenimiento"),paid,balance:Math.max(0,total-paid),vipLevel:profile?.vip_level||"",guestTags:Array.isArray(profile?.tags)?profile.tags:[],guestLanguage:profile?.language||"",guestPreferences:profile?.preferences||{},guestProfileNotes:profile?.notes||""}},[roomById,paymentByReservation,profileById])

  const operationsByOffset=useMemo(()=>{const result={};for(const offset of[-1,0,1]){const day=dateKey(offset),valid=reservations.filter(r=>!r.no_show),arrivals=valid.filter(r=>r.fecha_entrada===day).map(enrich),departures=valid.filter(r=>r.fecha_salida===day).map(enrich),inhouse=valid.filter(r=>r.fecha_entrada<=day&&r.fecha_salida>day&&r.estado!=="finalizada").map(enrich);result[offset]={day,arrivals,inhouse,departures}}return result},[reservations,enrich])

  const metrics=useMemo(()=>{const today=dateKey(0),valid=reservations.filter(r=>!r.no_show),arrivals=valid.filter(r=>r.fecha_entrada===today).length,departures=valid.filter(r=>r.fecha_salida===today).length,occupiedIds=new Set();for(const reservation of valid.filter(r=>r.fecha_entrada<=today&&r.fecha_salida>today&&r.estado!=="finalizada"))roomIds(reservation).forEach(id=>occupiedIds.add(id));const inhouse=occupiedIds.size,occupancy=rooms.length?Math.min(100,inhouse/rooms.length*100):0;let checkDone=0,checkTotal=0;for(const task of housekeeping){const list=Array.isArray(task.checklist)?task.checklist:[];if(list.length){checkTotal+=list.length;checkDone+=list.filter(item=>item?.done===true).length}else{checkTotal+=1;if(task.status==="done")checkDone+=1}}const collected=paymentsToday.filter(validPayment).reduce((sum,p)=>sum+Math.max(0,Number(p.monto||0)-Number(p.refunded_amount||0)),0);return{arrivals,departures,inhouse,occupancy,maintenance:maintenance.length,urgent:maintenance.filter(t=>t.priority==="urgent").length,checkDone,checkTotal,checkPct:checkTotal?Math.round(checkDone/checkTotal*100):0,collected,dirty:rooms.filter(r=>r.estado==="sucia").length,ready:rooms.filter(r=>["libre","limpia","inspeccionada"].includes(r.estado)).length,totalRooms:rooms.length}},[rooms,reservations,maintenance,housekeeping,paymentsToday])

  return{metrics,operationsByOffset,loading,error,load}
}
