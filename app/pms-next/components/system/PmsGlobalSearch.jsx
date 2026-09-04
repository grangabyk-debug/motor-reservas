"use client"

import{useEffect,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./pms-global-search.module.css"

export default function PmsGlobalSearch({open,onClose,propertyId,onNavigate}){
  const[q,setQ]=useState(""),[results,setResults]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState("")
  const inputRef=useRef(null)
  useEffect(()=>{if(open){setTimeout(()=>inputRef.current?.focus(),30)}else{setQ("");setResults([]);setError("")}},[open])
  useEffect(()=>{if(!open)return;const handler=e=>{if(e.key==="Escape")onClose()};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)},[open,onClose])
  useEffect(()=>{
    if(!open||!propertyId||q.trim().length<2){setResults([]);return}
    const timer=setTimeout(async()=>{
      setLoading(true);setError("");const term=q.trim().replaceAll(","," ")
      try{
        const[resRes,guestRes,roomRes]=await Promise.all([
          supabase.from("reservas").select("id,numero_reserva,nombre_huesped,fecha_entrada,fecha_salida,estado").eq("property_id",propertyId).or(`nombre_huesped.ilike.%${term}%,numero_reserva.ilike.%${term}%`).order("fecha_entrada",{ascending:false}).limit(8),
          supabase.from("hotel_guest_profiles").select("id,full_name,email,phone,country").eq("property_id",propertyId).or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`).limit(8),
          supabase.from("habitaciones").select("id,nombre,tipo,estado").eq("property_id",propertyId).eq("activa",true).or(`nombre.ilike.%${term}%,tipo.ilike.%${term}%`).limit(8),
        ])
        for(const result of[resRes,guestRes,roomRes])if(result.error)throw result.error
        setResults([
          ...(resRes.data||[]).map(item=>({kind:"reservation",id:item.id,title:item.nombre_huesped||`Reserva #${item.numero_reserva||item.id}`,meta:`Reserva ${item.numero_reserva||item.id} · ${item.fecha_entrada} → ${item.fecha_salida} · ${item.estado||""}`})),
          ...(guestRes.data||[]).map(item=>({kind:"guest",id:item.id,title:item.full_name||item.email||"Huésped",meta:[item.email,item.phone,item.country].filter(Boolean).join(" · ")})),
          ...(roomRes.data||[]).map(item=>({kind:"room",id:item.id,title:`Habitación ${item.nombre}`,meta:[item.tipo,item.estado].filter(Boolean).join(" · ")})),
        ])
      }catch(err){setError(err?.message||"No se pudo buscar.")}
      finally{setLoading(false)}
    },220)
    return()=>clearTimeout(timer)
  },[q,open,propertyId])

  function choose(result){
    onClose()
    if(result.kind==="reservation")onNavigate("reservations",{reservationId:result.id})
    else if(result.kind==="guest")onNavigate("guests")
    else onNavigate("planning")
  }

  if(!open)return null
  return <div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className={s.panel} role="dialog" aria-modal="true" aria-label="Búsqueda global">
    <header><span>⌕</span><input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar huésped, reserva o habitación…"/><kbd>ESC</kbd></header>
    <div className={s.body}>{q.trim().length<2?<div className={s.hint}>Escribí al menos 2 caracteres. Busca únicamente dentro de la propiedad activa.</div>:loading?<div className={s.hint}>Buscando…</div>:error?<div className={s.error}>{error}</div>:results.length?<div className={s.results}>{results.map((item,index)=><button key={`${item.kind}-${item.id}-${index}`} onClick={()=>choose(item)}><span className={s.kind}>{item.kind==="reservation"?"RESERVA":item.kind==="guest"?"HUÉSPED":"HABITACIÓN"}</span><b>{item.title}</b><small>{item.meta}</small></button>)}</div>:<div className={s.hint}>No encontramos coincidencias.</div>}</div>
  </section></div>
}
