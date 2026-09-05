"use client"

import{useEffect,useMemo,useState}from"react"
import useReservationsData from"./useReservationsData"
import ReservationRecord from"./ReservationRecord"
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

export default function ReservationsWorkspace({propertyId,onNavigate,focusReservationId,onFocusHandled}){
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

  function syncRecordUrl(id){
    if(typeof window==="undefined")return
    const url=new URL(window.location.href)
    if(id==null)url.searchParams.delete("reservation")
    else url.searchParams.set("reservation",String(id))
    window.history.replaceState({pmsView:"reservations",reservationId:id??null},"",url)
  }
  function openRecord(item){setSelected(item);syncRecordUrl(item.id)}
  function closeRecord(){setSelected(null);syncRecordUrl(null)}

  useEffect(()=>{if(!focusReservationId)return;const target=items.find(item=>Number(item.id)===Number(focusReservationId));if(target){setMode(target.estado==="cancelada"?"trash":target.no_show?"noshow":"active");setSelected(target);syncRecordUrl(target.id);onFocusHandled?.()}},[focusReservationId,items,onFocusHandled])
  useEffect(()=>{if(focusReservationId||selected||typeof window==="undefined")return;const requested=Number(new URL(window.location.href).searchParams.get("reservation"));if(!requested)return;const target=items.find(item=>Number(item.id)===requested);if(target){setMode(target.estado==="cancelada"?"trash":target.no_show?"noshow":"active");setSelected(target)}},[focusReservationId,items,selected])
  useEffect(()=>{if(!selected)return;const fresh=items.find(item=>Number(item.id)===Number(selected.id));if(fresh&&fresh!==selected)setSelected(fresh)},[items,selected])

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
    try{const updated=await data.updateReservation(item.id,changes);if(selected?.id===item.id)setSelected(current=>({...current,...updated}));return true}
    catch(err){data.setError(err?.message||`No se pudo ${label}.`);return false}
    finally{setSaving("")}
  }
  async function checkIn(item){await patch(item,{estado:item.estado==="alojado"?"confirmada":"alojado"},item.estado==="alojado"?"deshacer el check-in":"hacer el check-in")}
  async function checkout(item){setSaving(String(item.id));data.setError("");try{const updated=await data.checkout(item.id);if(selected?.id===item.id)setSelected(current=>({...current,...updated}))}catch(err){data.setError(err?.message||"No se pudo realizar el check-out.")}finally{setSaving("")}}
  async function cancel(item){if(!window.confirm(`Cancelar la reserva ${item.numero_reserva||item.id} de ${item.nombre_huesped}?`))return;const ok=await patch(item,{estado:"cancelada"},"cancelar la reserva");if(ok&&selected?.id===item.id)closeRecord()}
  async function restore(item){await patch(item,{estado:"confirmada",no_show:false},"restaurar la reserva")}
  async function toggleNoShow(item){await patch(item,{no_show:!item.no_show},item.no_show?"quitar el no-show":"marcar no-show")}

  if(selected)return <ReservationRecord item={selected} room={selected.room} payments={data.payments} propertyId={propertyId} onBack={closeRecord} onNavigate={onNavigate} saving={saving===String(selected.id)} onPrimaryAction={()=>selected.estado==="alojado"?checkout(selected):checkIn(selected)}/>

  return <section className={s.page}>
    <header className={s.heading}><div><small>RESERVAS</small><h1>Reservas</h1><p>{items.filter(item=>item.estado!=="cancelada").length} reservas cargadas de la propiedad activa.</p></div><div className={s.tools}><label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar reserva, huésped o habitación"/></label><button type="button" className={`${s.tool} ${mode==="noshow"?s.toolActive:""}`} onClick={()=>setMode(v=>v==="noshow"?"active":"noshow")}>⊘ No-show</button><button type="button" className={`${s.tool} ${mode==="trash"?s.toolActive:""}`} onClick={()=>setMode(v=>v==="trash"?"active":"trash")}>♲ Canceladas</button><button type="button" className={`${s.tool} ${filterOpen?s.toolActive:""}`} onClick={()=>setFilterOpen(v=>!v)}>≡ Filtrar</button></div></header>
    {data.error&&<div className={s.empty}>{data.error}</div>}
    {filterOpen&&<div className={s.filterPanel}><span>Pago</span>{[["all","Todos"],["paid","Pagado"],["pending","Parcial"],["due","Pendiente"]].map(([value,label])=><button type="button" key={value} className={paymentFilter===value?s.selectedFilter:""} onClick={()=>setPaymentFilter(value)}>{label}</button>)}</div>}
    <div className={s.tableWrap}><table className={s.table}><thead><tr><th>ID</th><th>Cliente</th><th>Habitación</th><th>Llegada</th><th>Salida</th><th>Pago</th><th>Acciones</th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td className={s.id}>{item.numero_reserva||item.id}</td><td className={s.client}><b>{item.nombre_huesped}</b><small>{item.canal_reserva||"Directa"}</small></td><td><span className={s.room}><span className={s.roomBadge}>{item.room?.nombre||"—"}</span><i className={s.roomDot}/></span></td><td>{fmtDate(item.fecha_entrada)}</td><td>{fmtDate(item.fecha_salida)}</td><td><span className={`${s.payment} ${item.payment==="pending"?s.paymentPending:item.payment==="due"?s.paymentDue:""}`}>{paymentLabel(item.payment)}</span></td><td><div className={s.actions}>{mode==="trash"?<button type="button" className={s.actionButton} disabled={saving===String(item.id)} onClick={()=>restore(item)}>↺ Restaurar</button>:<><button type="button" className={`${s.actionButton} ${s.checkin} ${item.estado==="alojado"?s.checked:""}`} disabled={saving===String(item.id)||item.estado==="finalizada"} onClick={()=>item.estado==="alojado"?checkout(item):checkIn(item)}>{item.estado==="alojado"?"← Check-out":"→ Check-in"}</button><button type="button" className={s.actionButton} onClick={()=>openRecord(item)} title="Abrir ficha completa">◉</button><button type="button" className={s.actionButton} disabled={saving===String(item.id)} onClick={()=>toggleNoShow(item)} title="No-show">⊘</button><button type="button" className={s.actionButton} disabled={saving===String(item.id)} onClick={()=>cancel(item)} title="Cancelar">⌫</button></>}</div></td></tr>)}</tbody></table>{data.loading?<div className={s.empty}>Cargando reservas…</div>:!visible.length&&<div className={s.empty}>No hay reservas que coincidan con esta vista.</div>}</div>
    <div className={s.footer}><span>Mostrando {visible.length} de {items.length} cargadas</span><span>{data.hasMore?"Hay más historial disponible.":"Historial cargado hasta el último registro disponible."}</span>{data.hasMore&&<button type="button" className={s.tool} disabled={data.loadingMore} onClick={data.loadMore}>{data.loadingMore?"Cargando…":"Cargar 200 más"}</button>}</div>
  </section>
}
