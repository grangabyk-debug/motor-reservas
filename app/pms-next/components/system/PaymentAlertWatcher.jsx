"use client"

import{useEffect,useRef}from"react"
import{supabase}from"../../../../lib/supabase"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const emit=detail=>window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))
const LIVE_TABLES=["reservas","pagos","habitaciones","bloqueos","hotel_housekeeping_tasks","hotel_housekeeping_history","hotel_maintenance_tickets","hotel_guest_requests","hotel_guest_profiles","hotel_no_show_history","hotel_cancellation_policies","hotel_guarantees","hotel_reservation_events","hotel_cash_movements","hotel_finance_documents","hotel_cash_sessions"]

export default function PaymentAlertWatcher({propertyId}){
  const known=useRef(new Set()),primed=useRef(false),syncTimer=useRef(null),pendingTables=useRef(new Set())
  useEffect(()=>{
    known.current=new Set();primed.current=false
    if(!propertyId)return
    let cancelled=false,timer=null
    async function check(){
      const{data,error}=await supabase.from("pagos").select("id,reserva_id,monto,moneda,metodo,estado,created_at,reservas(nombre_huesped,numero_reserva,precio_total,moneda)").eq("property_id",propertyId).eq("estado","confirmado").order("created_at",{ascending:false}).limit(500)
      if(cancelled||error)return
      const rows=data||[],ids=new Set(rows.map(row=>String(row.id)))
      if(!primed.current){known.current=ids;primed.current=true;return}
      const fresh=rows.filter(row=>!known.current.has(String(row.id)))
      known.current=ids
      if(!fresh.length)return
      const totals=new Map()
      for(const row of rows){
        if(row.reserva_id==null)continue
        const reservation=Array.isArray(row.reservas)?row.reservas[0]:row.reservas,currency=String(reservation?.moneda||row.moneda||"ARS").toUpperCase()
        if(String(row.moneda||currency).toUpperCase()!==currency)continue
        totals.set(Number(row.reserva_id),(totals.get(Number(row.reserva_id))||0)+(Number(row.monto)||0))
      }
      const latest=fresh[0],reservation=Array.isArray(latest.reservas)?latest.reservas[0]:latest.reservas,total=Number(reservation?.precio_total)||0,paid=totals.get(Number(latest.reserva_id))||0,currency=reservation?.moneda||latest.moneda||"ARS"
      if(fresh.length>1)emit({tone:"success",title:`${fresh.length} pagos recibidos`,message:`Último: ${reservation?.nombre_huesped||reservation?.numero_reserva||"Reserva"} · ${money(latest.monto,latest.moneda||currency)}.`,duration:6500})
      else emit({tone:"success",title:total>0&&paid>=total?"Reserva totalmente abonada":"Pago recibido",message:`${reservation?.nombre_huesped||reservation?.numero_reserva||"Reserva"} · ${money(latest.monto,latest.moneda||currency)}${latest.metodo?` · ${latest.metodo}`:""}.`,duration:6500})
    }
    check();timer=window.setInterval(check,20000)
    return()=>{cancelled=true;if(timer)window.clearInterval(timer)}
  },[propertyId])

  useEffect(()=>{
    if(!propertyId)return
    const flush=()=>{syncTimer.current=null;const tables=[...pendingTables.current];pendingTables.current.clear();window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables,at:Date.now()}}))}
    const queue=table=>{if(table)pendingTables.current.add(table);if(syncTimer.current)clearTimeout(syncTimer.current);syncTimer.current=setTimeout(flush,80)}
    const changed=(table,payload)=>{
      queue(table)
      const detail={propertyId,table,eventType:payload?.eventType||"*",new:payload?.new||null,old:payload?.old||null}
      if(table==="reservas")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail}))
      if(table==="pagos")window.dispatchEvent(new CustomEvent("hl:pms-payment-updated",{detail}))
      if(table==="hotel_cancellation_policies")window.dispatchEvent(new CustomEvent("hl:pms-cancellation-policies-updated",{detail}))
    }
    let channel=supabase.channel(`hl-pms-sync-${propertyId}`)
    for(const table of LIVE_TABLES)channel=channel.on("postgres_changes",{event:"*",schema:"public",table,filter:`property_id=eq.${propertyId}`},payload=>changed(table,payload))
    channel.subscribe(status=>{if(status==="SUBSCRIBED")queue("reconnected")})
    const resume=()=>queue("resume"),visible=()=>{if(document.visibilityState==="visible")resume()}
    window.addEventListener("focus",resume);document.addEventListener("visibilitychange",visible)
    return()=>{if(syncTimer.current)clearTimeout(syncTimer.current);pendingTables.current.clear();window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",visible);supabase.removeChannel(channel)}
  },[propertyId])
  return null
}
