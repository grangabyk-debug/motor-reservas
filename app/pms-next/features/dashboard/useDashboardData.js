"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const todayKey=()=>new Date().toLocaleDateString("en-CA")

export default function useDashboardData(propertyId){
  const[rooms,setRooms]=useState([])
  const[reservations,setReservations]=useState([])
  const[maintenance,setMaintenance]=useState([])
  const[housekeeping,setHousekeeping]=useState([])
  const[payments,setPayments]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    const today=todayKey(),tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const tomorrowKey=tomorrow.toLocaleDateString("en-CA")
    try{
      const[roomRes,resRes,maintRes,hkRes,payRes]=await Promise.all([
        supabase.from("habitaciones").select("id,estado,activa").eq("property_id",propertyId).eq("activa",true),
        supabase.from("reservas").select("id,fecha_entrada,fecha_salida,estado,no_show,precio_total,moneda").eq("property_id",propertyId).lte("fecha_entrada",tomorrowKey).gte("fecha_salida",today).neq("estado","cancelada"),
        supabase.from("hotel_maintenance_tickets").select("id,status,priority,due_at").eq("property_id",propertyId).not("status","in",'(resolved,cancelled)'),
        supabase.from("hotel_housekeeping_tasks").select("id,status,checklist,scheduled_for").eq("property_id",propertyId).gte("scheduled_for",`${today}T00:00:00`).lt("scheduled_for",`${tomorrowKey}T00:00:00`),
        supabase.from("pagos").select("id,monto,refunded_amount,estado,moneda,created_at").eq("property_id",propertyId).gte("created_at",`${today}T00:00:00`).lt("created_at",`${tomorrowKey}T00:00:00`),
      ])
      for(const result of[roomRes,resRes,maintRes,hkRes,payRes])if(result.error)throw result.error
      setRooms(roomRes.data||[]);setReservations(resRes.data||[]);setMaintenance(maintRes.data||[]);setHousekeeping(hkRes.data||[]);setPayments(payRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar la operación de hoy.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])

  const metrics=useMemo(()=>{
    const today=todayKey()
    const valid=reservations.filter(r=>!r.no_show)
    const arrivals=valid.filter(r=>r.fecha_entrada===today).length
    const departures=valid.filter(r=>r.fecha_salida===today).length
    const inhouse=valid.filter(r=>r.estado==="alojado"||(r.fecha_entrada<=today&&r.fecha_salida>today&&r.estado!=="finalizada")).length
    const occupancy=rooms.length?Math.min(100,inhouse/rooms.length*100):0
    let checkDone=0,checkTotal=0
    for(const task of housekeeping){const list=Array.isArray(task.checklist)?task.checklist:[];if(list.length){checkTotal+=list.length;checkDone+=list.filter(item=>item?.done===true).length}else{checkTotal+=1;if(task.status==="done")checkDone+=1}}
    const collected=payments.filter(p=>!['void','cancelado','anulado'].includes(String(p.estado||'').toLowerCase())).reduce((sum,p)=>sum+Math.max(0,Number(p.monto||0)-Number(p.refunded_amount||0)),0)
    return{arrivals,departures,inhouse,occupancy,maintenance:maintenance.length,urgent:maintenance.filter(t=>t.priority==="urgent").length,checkDone,checkTotal,checkPct:checkTotal?Math.round(checkDone/checkTotal*100):0,collected,dirty:rooms.filter(r=>r.estado==="sucia").length,ready:rooms.filter(r=>['libre','limpia','inspeccionada'].includes(r.estado)).length,totalRooms:rooms.length}
  },[rooms,reservations,maintenance,housekeeping,payments])

  return{metrics,loading,error,load}
}
