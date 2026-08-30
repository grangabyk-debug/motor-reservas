"use client"
import{useMemo,useState}from"react"
import{isoDate,money}from"../../core/formatters"
import s from"./intelligence-concierge.module.css"

function buildSignals({rooms,reservations,payments}){
  const today=isoDate(),live=reservations.filter(r=>r.estado!=="cancelada"&&!r.no_show),paid=new Map();payments.forEach(p=>paid.set(String(p.reserva_id),(paid.get(String(p.reserva_id))||0)+Number(p.monto||0)))
  const arrivals=live.filter(r=>r.fecha_entrada===today&&r.estado!=="alojado"),departures=live.filter(r=>r.fecha_salida===today&&r.estado!=="finalizada"),activeRooms=rooms.filter(r=>r.activa!==false),inhouse=live.filter(r=>r.fecha_entrada<=today&&r.fecha_salida>today&&r.estado!=="finalizada"),roomById=new Map(rooms.map(r=>[String(r.id),r])),signals=[]
  for(const arrival of arrivals){const room=roomById.get(String(arrival.habitacion_id)),departure=departures.find(d=>String(d.habitacion_id)===String(arrival.habitacion_id)),status=String(room?.estado||"").toLowerCase();if(departure||["sucia","inspeccion","mantenimiento"].includes(status)){signals.push({level:"urgent",title:`Priorizar ${room?.nombre||`Hab. ${arrival.habitacion_id}`}`,text:departure?`Hay una salida y una nueva llegada el mismo día. ${arrival.nombre_huesped||"El próximo huésped"} entra hoy.`:`La habitación figura ${status||"pendiente"} y tiene una llegada hoy.`,action:"housekeeping",actionLabel:"Abrir Housekeeping"});break}}
  const arrivalsWithBalance=arrivals.map(r=>({...r,balance:Math.max(0,Number(r.precio_total||0)-(paid.get(String(r.id))||0))})).filter(r=>r.balance>.01),balance=arrivalsWithBalance.reduce((a,r)=>a+r.balance,0);if(balance>0)signals.push({level:"attention",title:"Cobros antes de la llegada",text:`${arrivalsWithBalance.length} llegada(s) de hoy tienen ${money(balance)} pendientes.`,action:"reservations",actionLabel:"Ver reservas"})
  if(departures.length)signals.push({level:"info",title:"Rotación de habitaciones",text:`Hay ${departures.length} salida(s) hoy. Conviene coordinar prioridades con Housekeeping para liberar inventario a tiempo.`,action:"housekeeping",actionLabel:"Organizar limpieza"})
  const occupancy=activeRooms.length?Math.round(new Set(inhouse.map(r=>r.habitacion_id)).size/activeRooms.length*100):0;if(occupancy>=80)signals.push({level:"revenue",title:"Ocupación alta",text:`La ocupación de hoy está en ${occupancy}%. Revisá tarifa y disponibilidad antes de vender las últimas habitaciones.`,action:"rates",actionLabel:"Abrir Revenue"})
  if(!signals.length)signals.push({level:"calm",title:"Operación estable",text:"No detecté una urgencia evidente con los datos actuales. Podés preguntarme por reservas, ocupación, housekeeping o ingresos.",action:"calendar",actionLabel:"Ver Command Center"})
  return signals.slice(0,4)
}

export default function IntelligenceConcierge({settings,rooms=[],reservations=[],payments=[],onAsk,onNavigate}){
  const[open,setOpen]=useState(false),[dismissed,setDismissed]=useState(false),[question,setQuestion]=useState(""),[busy,setBusy]=useState(false),[messages,setMessages]=useState([]),signals=useMemo(()=>buildSignals({rooms,reservations,payments}),[rooms,reservations,payments]),primary=signals[0]
  const context=useMemo(()=>({plataforma:"Habitación Llena Hospitality OS",hoy:isoDate(),hotel:settings?.hotel_name||"Hotel",metricas:{reservas:reservations.length,habitaciones:rooms.filter(r=>r.activa!==false).length},habitaciones:rooms.map(r=>({id:r.id,nombre:r.nombre,estado:r.estado,activa:r.activa})),reservas:reservations.slice(-500).map(r=>({id:r.id,nombre:r.nombre_huesped,entrada:r.fecha_entrada,salida:r.fecha_salida,estado:r.estado,total:r.precio_total,habitacion_id:r.habitacion_id}))}),[settings?.hotel_name,rooms,reservations])
  async function send(e,preset){e?.preventDefault();const q=String(preset||question).trim();if(!q||busy)return;setMessages(x=>[...x,{role:"user",text:q}]);setQuestion("");setBusy(true);try{const result=await onAsk(q,context);setMessages(x=>[...x,{role:"assistant",text:result?.answer||"No pude responder en este momento."}])}catch(err){setMessages(x=>[...x,{role:"assistant",text:err?.message||"No pude responder en este momento."}])}finally{setBusy(false)}}
  return <>
    {!open&&!dismissed&&primary&&<aside className={s.signal}><button className={s.signalClose} onClick={()=>setDismissed(true)}>×</button><small>✦ LLENA INTELLIGENCE</small><h4>{primary.title}</h4><p>{primary.text}</p><footer><button onClick={()=>onNavigate?.(primary.action)}>{primary.actionLabel}</button><button onClick={()=>setOpen(true)}>Ver por qué →</button></footer></aside>}
    <button className={`${s.orb} ${open?s.orbOpen:""}`} aria-label="Abrir Llena Intelligence" onClick={()=>setOpen(v=>!v)}><span>✦</span><i/></button>
    {open&&<section className={s.panel}>
      <header><div className={s.identity}><span>✦</span><div><small>LLENA INTELLIGENCE</small><b>Concierge operativo</b></div></div><button onClick={()=>setOpen(false)}>×</button></header>
      <div className={s.signalList}>{signals.map((item,i)=><article key={`${item.title}-${i}`} data-level={item.level}><small>{i===0?"AHORA":"DESPUÉS"}</small><b>{item.title}</b><p>{item.text}</p><button onClick={()=>onNavigate?.(item.action)}>{item.actionLabel} →</button></article>)}</div>
      <div className={s.chat}>{!messages.length&&<div className={s.welcome}>Podés hablar conmigo mientras operás. Leo únicamente el contexto del hotel autenticado y, cuando una respuesta es una recomendación, la presento como tal.</div>}{messages.map((m,i)=><div key={i} className={`${s.message} ${m.role==="user"?s.user:s.assistant}`}>{m.text}</div>)}{busy&&<div className={`${s.message} ${s.assistant}`}>Analizando la operación…</div>}</div>
      <div className={s.chips}>{["¿Qué necesita atención ahora?","¿Cómo está la ocupación hoy?","¿Hay llegadas con saldo pendiente?"].map(q=><button key={q} onClick={()=>send(null,q)} disabled={busy}>{q}</button>)}</div>
      <form className={s.composer} onSubmit={send}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Preguntá sobre la operación…"/><button disabled={busy||!question.trim()}>Enviar</button></form>
    </section>}
  </>
}
