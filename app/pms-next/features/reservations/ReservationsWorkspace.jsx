"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import useReservationsData from"./useReservationsData"
import ReservationRecord from"./ReservationRecord"
import ReservationEditPanel from"./ReservationEditPanel"
import ReservationActionBar from"./ReservationActionBar"
import s from"./reservations.module.css"

const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"—"
const roomIds=item=>[...new Set([item.habitacion_id,...(item.habitaciones_ids||[])].filter(Boolean).map(Number))]
const dateKey=date=>{const value=date instanceof Date?date:new Date(date);return`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`}
function paymentState(item,paid){const total=Number(item.precio_total)||0;if(total<=0)return"paid";if(paid<=0)return"due";if(paid>=total)return"paid";return"pending"}
const paymentLabel=value=>value==="paid"?"Pagado":value==="pending"?"Parcial":"Pendiente"

export default function ReservationsWorkspace({propertyId,onNavigate,focusReservationId,onFocusHandled}){
  const data=useReservationsData(propertyId)
  const[query,setQuery]=useState(""),[mode,setMode]=useState("active"),[filterOpen,setFilterOpen]=useState(false),[paymentFilter,setPaymentFilter]=useState("all"),[createdFilter,setCreatedFilter]=useState("all"),[sortMode,setSortMode]=useState("created-desc"),[selected,setSelected]=useState(null),[saving,setSaving]=useState(""),[editOpen,setEditOpen]=useState(false)
  const focusReloadRef=useRef(null)
  const roomById=useMemo(()=>new Map(data.rooms.map(room=>[Number(room.id),room])),[data.rooms])
  const items=useMemo(()=>data.reservations.map(item=>{const paid=data.paymentByReservation.get(Number(item.id))||0,rooms=roomIds(item).map(id=>roomById.get(id)).filter(Boolean);return{...item,paid,payment:paymentState(item,paid),room:rooms[0]||roomById.get(Number(item.habitacion_id)),rooms}}),[data.reservations,data.paymentByReservation,roomById])

  function syncRecordUrl(id){if(typeof window==="undefined")return;const url=new URL(window.location.href);if(id==null)url.searchParams.delete("reservation");else url.searchParams.set("reservation",String(id));window.history.replaceState({pmsView:"reservations",reservationId:id??null},"",url)}
  function openRecord(item){setEditOpen(false);setSelected(item);syncRecordUrl(item.id)}
  function closeRecord(){setEditOpen(false);setSelected(null);syncRecordUrl(null)}

  useEffect(()=>{if(!focusReservationId){focusReloadRef.current=null;return}const target=items.find(item=>Number(item.id)===Number(focusReservationId));if(target){focusReloadRef.current=null;setMode(target.estado==="cancelada"?"trash":target.no_show?"noshow":"active");setSelected(target);syncRecordUrl(target.id);onFocusHandled?.();return}if(!data.loading&&focusReloadRef.current!==String(focusReservationId)){focusReloadRef.current=String(focusReservationId);data.load()}},[focusReservationId,items,onFocusHandled,data.loading,data.load])
  useEffect(()=>{if(focusReservationId||selected||typeof window==="undefined")return;const requested=Number(new URL(window.location.href).searchParams.get("reservation"));if(!requested)return;const target=items.find(item=>Number(item.id)===requested);if(target){setMode(target.estado==="cancelada"?"trash":target.no_show?"noshow":"active");setSelected(target)}},[focusReservationId,items,selected])
  useEffect(()=>{if(!selected)return;const fresh=items.find(item=>Number(item.id)===Number(selected.id));if(fresh&&fresh!==selected)setSelected(fresh)},[items,selected])

  const visible=useMemo(()=>{
    const today=dateKey(new Date()),term=query.trim().toLowerCase()
    const filtered=items.filter(item=>{if(mode==="trash"&&item.estado!=="cancelada")return false;if(mode==="noshow"&&!item.no_show)return false;if(mode==="active"&&(item.estado==="cancelada"||item.no_show))return false;if(paymentFilter!=="all"&&item.payment!==paymentFilter)return false;if(createdFilter==="today"&&(!item.created_at||dateKey(item.created_at)!==today))return false;const roomText=(item.rooms||[]).map(room=>room.nombre).join(" ");return !term||`${item.numero_reserva||item.id} ${item.nombre_huesped} ${roomText} ${item.canal_reserva||""}`.toLowerCase().includes(term)})
    return[...filtered].sort((a,b)=>{
      if(sortMode==="created-asc")return new Date(a.created_at||0)-new Date(b.created_at||0)
      if(sortMode==="arrival-next"){
        const aFuture=String(a.fecha_entrada||"")>=today,bFuture=String(b.fecha_entrada||"")>=today
        if(aFuture!==bFuture)return aFuture?-1:1
        return aFuture?String(a.fecha_entrada||"").localeCompare(String(b.fecha_entrada||"")):String(b.fecha_entrada||"").localeCompare(String(a.fecha_entrada||""))
      }
      if(sortMode==="arrival-desc")return String(b.fecha_entrada||"").localeCompare(String(a.fecha_entrada||""))
      return new Date(b.created_at||0)-new Date(a.created_at||0)
    })
  },[items,mode,paymentFilter,createdFilter,query,sortMode])

  async function patch(item,changes,label){setSaving(String(item.id));data.setError("");try{const updated=await data.updateReservation(item.id,changes);if(selected?.id===item.id)setSelected(current=>({...current,...updated}));return true}catch(err){data.setError(err?.message||`No se pudo ${label}.`);return false}finally{setSaving("")}}
  async function checkIn(item){setSaving(String(item.id));data.setError("");try{const updated=await data.checkin(item.id);if(selected?.id===item.id)setSelected(current=>({...current,...updated}))}catch(err){data.setError(err?.message||"No se pudo realizar el check-in.")}finally{setSaving("")}}
  async function checkout(item){setSaving(String(item.id));data.setError("");try{const updated=await data.checkout(item.id);if(selected?.id===item.id)setSelected(current=>({...current,...updated}))}catch(err){data.setError(err?.message||"No se pudo realizar el check-out.")}finally{setSaving("")}}
  async function cancel(item){if(!window.confirm(`Cancelar la reserva ${item.numero_reserva||item.id} de ${item.nombre_huesped}?`))return;const ok=await patch(item,{estado:"cancelada"},"cancelar la reserva");if(ok&&selected?.id===item.id)closeRecord()}
  async function restore(item){await patch(item,{estado:"confirmada",no_show:false},"restaurar la reserva")}
  async function toggleNoShow(item){await patch(item,{no_show:!item.no_show},item.no_show?"quitar el no-show":"marcar no-show")}

  if(selected)return <>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",margin:"0 0 8px",padding:"0 2px"}}><ReservationActionBar item={selected} rooms={selected.rooms} propertyId={propertyId} onRefresh={data.load}/><button type="button" onClick={()=>setEditOpen(true)} style={{height:38,padding:"0 14px",border:"1px solid color-mix(in srgb,var(--accent) 24%,var(--line))",borderRadius:11,background:"color-mix(in srgb,var(--accent) 7%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:11,fontWeight:850,boxShadow:"inset 0 1px color-mix(in srgb,#fff 45%,transparent)",cursor:"pointer"}}>✎ Editar reserva</button></div>
    <ReservationRecord item={selected} room={selected.room} rooms={selected.rooms} payments={data.payments} propertyId={propertyId} onBack={closeRecord} onNavigate={onNavigate} saving={saving===String(selected.id)} onPrimaryAction={()=>selected.estado==="alojado"?checkout(selected):checkIn(selected)}/>
    {editOpen?<ReservationEditPanel item={selected} assignedRooms={selected.rooms} allRooms={data.rooms} saving={saving===String(selected.id)} onCancel={()=>setEditOpen(false)} onPreviewMove={data.previewMove} onMove={data.moveReservation} onUpdate={data.updateReservation} onSaved={()=>{setEditOpen(false);data.load()}}/>:null}
  </>

  return <section className={s.page}>
    <header className={s.heading}><div><small>RESERVAS</small><h1>Reservas</h1><p>{items.filter(item=>item.estado!=="cancelada").length} reservas cargadas de la propiedad activa.</p></div><div className={s.tools}><label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar reserva, huésped o habitación"/></label><select className={s.tool} value={sortMode} onChange={event=>setSortMode(event.target.value)} aria-label="Ordenar reservas"><option value="created-desc">Últimas creadas</option><option value="created-asc">Primeras creadas</option><option value="arrival-next">Próximas llegadas</option><option value="arrival-desc">Llegadas más lejanas</option></select><button type="button" className={`${s.tool} ${mode==="noshow"?s.toolActive:""}`} onClick={()=>setMode(v=>v==="noshow"?"active":"noshow")}>⊘ No-show</button><button type="button" className={`${s.tool} ${mode==="trash"?s.toolActive:""}`} onClick={()=>setMode(v=>v==="trash"?"active":"trash")}>♲ Canceladas</button><button type="button" className={`${s.tool} ${filterOpen?s.toolActive:""}`} onClick={()=>setFilterOpen(v=>!v)}>≡ Filtrar</button></div></header>
    {data.error&&<div className={s.empty}>{data.error}</div>}
    {filterOpen&&<div className={s.filterPanel}><span>Pago</span>{[["all","Todos"],["paid","Pagado"],["pending","Parcial"],["due","Pendiente"]].map(([value,label])=><button type="button" key={value} className={paymentFilter===value?s.selectedFilter:""} onClick={()=>setPaymentFilter(value)}>{label}</button>)}<span style={{marginLeft:8}}>Creación</span><button type="button" className={createdFilter==="all"?s.selectedFilter:""} onClick={()=>setCreatedFilter("all")}>Todas</button><button type="button" className={createdFilter==="today"?s.selectedFilter:""} onClick={()=>setCreatedFilter("today")}>Creadas hoy</button></div>}
    <div className={s.tableWrap}><table className={s.table}><thead><tr><th>ID</th><th>Cliente</th><th>Habitación</th><th>Llegada</th><th>Salida</th><th>Pago</th><th>Acciones</th></tr></thead><tbody>{visible.map(item=>{const names=(item.rooms||[]).map(room=>room.nombre);return <tr key={item.id}><td className={s.id}>{item.numero_reserva||item.id}</td><td className={s.client}><b>{item.nombre_huesped}</b><small>{item.canal_reserva||"Directa"}</small></td><td><span className={s.room}><span className={s.roomBadge}>{names[0]||"—"}{names.length>1?` +${names.length-1}`:""}</span><i className={s.roomDot}/></span></td><td>{fmtDate(item.fecha_entrada)}</td><td>{fmtDate(item.fecha_salida)}</td><td><span className={`${s.payment} ${item.payment==="pending"?s.paymentPending:item.payment==="due"?s.paymentDue:""}`}>{paymentLabel(item.payment)}</span></td><td><div className={s.actions}>{mode==="trash"?<button type="button" className={s.actionButton} disabled={saving===String(item.id)} onClick={()=>restore(item)}>↺ Restaurar</button>:<><button type="button" className={`${s.actionButton} ${s.checkin} ${item.estado==="alojado"?s.checked:""}`} disabled={saving===String(item.id)||item.estado==="finalizada"} onClick={()=>item.estado==="alojado"?checkout(item):checkIn(item)}>{item.estado==="alojado"?"← Check-out":"→ Check-in"}</button><button type="button" className={s.actionButton} onClick={()=>openRecord(item)} title="Abrir ficha completa">◉</button><button type="button" className={s.actionButton} disabled={saving===String(item.id)} onClick={()=>toggleNoShow(item)} title="No-show">⊘</button><button type="button" className={s.actionButton} disabled={saving===String(item.id)} onClick={()=>cancel(item)} title="Cancelar">⌫</button></>}</div></td></tr>})}</tbody></table>{data.loading?<div className={s.empty}>Cargando reservas…</div>:!visible.length&&<div className={s.empty}>No hay reservas que coincidan con esta vista.</div>}</div>
    <div className={s.footer}><span>Mostrando {visible.length} de {items.length} cargadas</span><span>{data.hasMore?"Hay más historial disponible.":"Historial cargado hasta el último registro disponible."}</span>{data.hasMore&&<button type="button" className={s.tool} disabled={data.loadingMore} onClick={data.loadMore}>{data.loadingMore?"Cargando…":"Cargar 200 más"}</button>}</div>
  </section>
}
