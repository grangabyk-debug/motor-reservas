"use client"

import{useMemo,useState}from"react"
import useReservationsData from"./useReservationsData"
import s from"./reservations.module.css"

const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"—"
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)

function paymentState(item,paid){
  const total=Number(item.precio_total)||0
  if(total<=0)return"paid"
  if(paid<=0)return"due"
  if(paid>=total)return"paid"
  return"pending"
}
const paymentLabel=value=>value==="paid"?"Pagado":value==="pending"?"Parcial":"Pendiente"
const statusLabel=item=>item.no_show?"No-show":item.estado==="alojado"?"En hotel":item.estado==="finalizada"?"Finalizada":item.estado==="cancelada"?"Cancelada":item.estado==="tentativa"?"Tentativa":item.estado==="pendiente"?"Pendiente":"Confirmada"

export default function ReservationsWorkspace({propertyId,onNavigate}){
  const data=useReservationsData(propertyId)
  const[query,setQuery]=useState("")
  const[mode,setMode]=useState("active")
  const[filterOpen,setFilterOpen]=useState(false)
  const[paymentFilter,setPaymentFilter]=useState("all")
  const[selected,setSelected]=useState(null)
  const[saving,setSaving]=useState("")
  const roomById=useMemo(()=>new Map(data.rooms.map(room=>[Number(room.id),room])),[data.rooms])

  const items=useMemo(()=>data.reservations.map(item=>{
    const paid=data.paymentByReservation.get(Number(item.id))||0
    return{...item,paid,payment:paymentState(item,paid),room:roomById.get(Number(item.habitacion_id))}
  }),[data.reservations,data.paymentByReservation,roomById])

  const visible=useMemo(()=>items.filter(item=>{
    if(mode==="trash"&&item.estado!=="cancelada")return false
    if(mode==="noshow"&&!item.no_show)return false
    if(mode==="active"&&(item.estado==="cancelada"||item.no_show))return false
    if(paymentFilter!=="all"&&item.payment!==paymentFilter)return false
    const term=query.trim().toLowerCase()
    return !term||`${item.numero_reserva||item.id} ${item.nombre_huesped} ${item.room?.nombre||""} ${item.canal_reserva||""}`.toLowerCase().includes(term)
  }),[items,mode,paymentFilter,query])

  async function patch(item,changes,label){
    setSaving(String(item.id));data.setError("")
    try{const updated=await data.updateReservation(item.id,changes);if(selected?.id===item.id)setSelected({...selected,...updated});return true}
    catch(err){data.setError(err?.message||`No se pudo ${label}.`);return false}
    finally{setSaving("")}
  }
  async function checkIn(item){await patch(item,{estado:item.estado==="alojado"?"confirmada":"alojado"},item.estado==="alojado"?"deshacer el check-in":"hacer el check-in")}
  async function checkout(item){setSaving(String(item.id));data.setError("");try{const updated=await data.checkout(item.id);if(selected?.id===item.id)setSelected({...selected,...updated})}catch(err){data.setError(err?.message||"No se pudo realizar el check-out.")}finally{setSaving("")}}
  async function cancel(item){if(!window.confirm(`Cancelar la reserva ${item.numero_reserva||item.id} de ${item.nombre_huesped}?`))return;const ok=await patch(item,{estado:"cancelada"},"cancelar la reserva");if(ok&&selected?.id===item.id)setSelected(null)}
  async function restore(item){await patch(item,{estado:"confirmada",no_show:false},"restaurar la reserva")}
  async function toggleNoShow(item){await patch(item,{no_show:!item.no_show},item.no_show?"quitar el no-show":"marcar no-show")}

  return <section className={s.page}>
    <header className={s.heading}><div><small>RESERVAS</small><h1>Reservas</h1><p>{items.filter(item=>item.estado!=="cancelada").length} reservas cargadas de la propiedad activa.</p></div><div className={s.tools}><label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar reserva, huésped o habitación"/></label><button type="button" className={`${s.tool} ${mode==="noshow"?s.toolActive:""}`} onClick={()=>setMode(v=>v==="noshow"?"active":"noshow")}>⊘ No-show</button><button type="button" className={`${s.tool} ${mode==="trash"?s.toolActive:""}`} onClick={()=>setMode(v=>v==="trash"?"active":"trash")}>♲ Canceladas</button><button type="button" className={`${s.tool} ${filterOpen?s.toolActive:""}`} onClick={()=>setFilterOpen(v=>!v)}>≡ Filtrar</button><button type="button" className={s.primary} onClick={()=>onNavigate?.("planning")}>＋ Nueva reserva</button></div></header>
    {data.error&&<div className={s.empty}>{data.error}</div>}
    {filterOpen&&<div className={s.filterPanel}><span>Pago</span>{[["all","Todos"],["paid","Pagado"],["pending","Parcial"],["due","Pendiente"]].map(([value,label])=><button type="button" key={value} className={paymentFilter===value?s.selectedFilter:""} onClick={()=>setPaymentFilter(value)}>{label}</button>)}</div>}
    <div className={s.tableWrap}><table className={s.table}><thead><tr><th>ID</th><th>Cliente</th><th>Habitación</th><th>Llegada</th><th>Salida</th><th>Pago</th><th>Acciones</th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td className={s.id}>{item.numero_reserva||item.id}</td><td className={s.client}><b>{item.nombre_huesped}</b><small>{item.canal_reserva||"Directa"}</small></td><td><span className={s.room}><span className={s.roomBadge}>{item.room?.nombre||"—"}</span><i className={s.roomDot}/></span></td><td>{fmtDate(item.fecha_entrada)}</td><td>{fmtDate(item.fecha_salida)}</td><td><span className={`${s.payment} ${item.payment==="pending"?s.paymentPending:item.payment==="due"?s.paymentDue:""}`}>{paymentLabel(item.payment)}</span></td><td><div className={s.actions}>{mode==="trash"?<button type="button" className={s.actionButton} disabled={saving===String(item.id)} onClick={()=>restore(item)}>↺ Restaurar</button>:<><button type="button" className={`${s.actionButton} ${s.checkin} ${item.estado==="alojado"?s.checked:""}`} disabled={saving===String(item.id)||item.estado==="finalizada"} onClick={()=>item.estado==="alojado"?checkout(item):checkIn(item)}>{item.estado==="alojado"?"← Check-out":"→ Check-in"}</button><button type="button" className={s.actionButton} onClick={()=>setSelected(item)} title="Ver detalle">◉</button><button type="button" className={s.actionButton} disabled={saving===String(item.id)} onClick={()=>toggleNoShow(item)} title="No-show">⊘</button><button type="button" className={s.actionButton} disabled={saving===String(item.id)} onClick={()=>cancel(item)} title="Cancelar">⌫</button></>}</div></td></tr>)}</tbody></table>{data.loading?<div className={s.empty}>Cargando reservas…</div>:!visible.length&&<div className={s.empty}>No hay reservas que coincidan con esta vista.</div>}</div>
    <div className={s.footer}><span>Mostrando {visible.length} de {items.length} cargadas</span><span>{data.hasMore?"Hay más historial disponible.":"Historial cargado hasta el último registro disponible."}</span>{data.hasMore&&<button type="button" className={s.tool} disabled={data.loadingMore} onClick={data.loadMore}>{data.loadingMore?"Cargando…":"Cargar 200 más"}</button>}</div>
    {selected&&<div className={s.drawerShade} onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}><aside className={s.drawer}><header><div><small>RESERVA {selected.numero_reserva||selected.id}</small><h2>{selected.nombre_huesped}</h2><p>{selected.canal_reserva||"Directa"} · Habitación {selected.room?.nombre||"—"}</p></div><button className={s.close} onClick={()=>setSelected(null)}>×</button></header><div className={s.summary}><div><small>Llegada</small><b>{fmtDate(selected.fecha_entrada)}</b></div><div><small>Salida</small><b>{fmtDate(selected.fecha_salida)}</b></div><div><small>Pago</small><b>{paymentLabel(selected.payment)}</b></div><div><small>Estado</small><b>{statusLabel(selected)}</b></div></div><section className={s.drawerSection}><small>HUÉSPED</small><h3>Contacto</h3><div className={s.metaList}><div><span>Email</span><b>{selected.email_huesped||"—"}</b></div><div><span>Teléfono</span><b>{selected.telefono_huesped||"—"}</b></div><div><span>Canal</span><b>{selected.canal_reserva||"Directa"}</b></div></div></section><section className={s.drawerSection}><small>CUENTA</small><h3>Estadía</h3><div className={s.metaList}><div><span>Total</span><b>{money(selected.precio_total,selected.moneda)}</b></div><div><span>Cobrado</span><b>{money(selected.paid,selected.moneda)}</b></div><div><span>Saldo</span><b>{money(Math.max(0,Number(selected.precio_total||0)-selected.paid),selected.moneda)}</b></div></div></section><div className={s.drawerActions}><button onClick={()=>setSelected(null)}>Cerrar</button><button className={s.mainAction} disabled={saving===String(selected.id)||selected.estado==="finalizada"} onClick={()=>selected.estado==="alojado"?checkout(selected):checkIn(selected)}>{selected.estado==="alojado"?"Hacer check-out":"Hacer check-in"}</button></div></aside></div>}
  </section>
}
