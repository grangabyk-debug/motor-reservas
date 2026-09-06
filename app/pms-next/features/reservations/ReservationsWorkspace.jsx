"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import useReservationsData from"./useReservationsData"
import ReservationRecord from"./ReservationRecord"
import ReservationEditPanel from"./ReservationEditPanel"
import ReservationActionBar from"./ReservationActionBar"
import ReservationCheckinDialog from"./ReservationCheckinDialog"
import ReservationNoShowDialog from"./ReservationNoShowDialog"
import s from"./reservations.module.css"

const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"—"
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const roomIds=item=>[...new Set([item.habitacion_id,...(item.habitaciones_ids||[])].filter(Boolean).map(Number))]
const dateKey=date=>{const value=date instanceof Date?date:new Date(date);return`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`}
function paymentState(item,paid){const total=Number(item.precio_total)||0;if(total<=0)return"paid";if(paid<=0)return"due";if(paid>=total)return"paid";return"pending"}
const paymentLabel=value=>value==="paid"?"Pagado":value==="pending"?"Parcial":"Pendiente"
const reservationStatusLabel=value=>value==="alojado"?"En hotel":value==="finalizada"?"Finalizada":value==="cancelada"?"Cancelada":value==="tentativa"?"Tentativa":value==="pendiente"?"Pendiente":"Confirmada"
const RECORD_SELECT="id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,habitacion_id,habitaciones_ids,habitaciones_detalle,fecha_entrada,fecha_salida,estado,no_show,no_show_at,no_show_release_date,no_show_penalty_amount,no_show_penalty_status,no_show_note,garantia_tipo,garantia_marca,garantia_ultimos4,canal_reserva,codigo_canal,precio_total,subtotal,descuento_tipo,descuento_valor,descuento_importe,tarifa_noche,noches,moneda,cantidad_huespedes,guest_profile_id,notas,created_at,tipo_estadia,servicios,mascotas_total,cochera_total,extra,extra_descripcion,early_checkin_importe,late_checkout_importe,regimen,hora_llegada_estimada,hora_salida_estimada,pais_huesped,nacionalidad_huesped,tipo_documento_huesped,dni_huesped"

function CheckoutBalanceDialog({item,onClose,onPay,onConfirm,saving}){
  if(!item)return null
  const total=Math.max(0,Number(item.precio_total)||0),paid=Math.max(0,Number(item.paid)||0),balance=Math.max(0,total-paid),currency=item.moneda||"ARS"
  const overlay={position:"fixed",inset:0,zIndex:260,display:"grid",placeItems:"center",padding:18,background:"rgba(19,28,46,.34)",backdropFilter:"blur(12px) saturate(1.08)"}
  const panel={width:"min(560px,calc(100vw - 28px))",border:"1px solid color-mix(in srgb,var(--line) 82%,#fff)",borderRadius:22,background:"color-mix(in srgb,var(--panelSolid) 96%,transparent)",boxShadow:"0 28px 80px rgba(17,28,52,.28)",overflow:"hidden"}
  const button={height:40,padding:"0 14px",border:"1px solid var(--line)",borderRadius:11,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:850,cursor:saving?"wait":"pointer"}
  return <div style={overlay} role="dialog" aria-modal="true" aria-label="Confirmar check-out con saldo pendiente">
    <section style={panel}>
      <header style={{display:"flex",justifyContent:"space-between",gap:16,padding:"18px 20px 14px",borderBottom:"1px solid var(--line)"}}><div><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".12em",color:"var(--accent)",marginBottom:5}}>CHECK-OUT · SALDO PENDIENTE</small><h2 style={{margin:0,fontSize:20}}>¿Finalizar estadía con deuda?</h2><p style={{margin:"6px 0 0",fontSize:11,color:"var(--muted)"}}>{item.nombre_huesped} · Reserva {item.numero_reserva||item.id}</p></div><button type="button" onClick={onClose} disabled={saving} style={{...button,width:38,padding:0}}>×</button></header>
      <div style={{padding:"18px 20px"}}>
        <p style={{margin:"0 0 14px",fontSize:12,lineHeight:1.55,color:"var(--text)"}}>La reserva todavía tiene saldo pendiente. Podés cobrarlo ahora o, si corresponde, confirmar igualmente el check-out dejando la deuda registrada.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}><article style={{padding:12,border:"1px solid var(--line)",borderRadius:12,background:"var(--panelSolid)"}}><small style={{fontSize:10,color:"var(--muted)"}}>TOTAL</small><b style={{display:"block",marginTop:5,fontSize:15}}>{money(total,currency)}</b></article><article style={{padding:12,border:"1px solid color-mix(in srgb,#d9a528 30%,var(--line))",borderRadius:12,background:"color-mix(in srgb,#f0bd35 5%,var(--panelSolid))"}}><small style={{fontSize:10,color:"var(--muted)"}}>PAGADO</small><b style={{display:"block",marginTop:5,fontSize:15,color:"#c28b13"}}>{money(paid,currency)}</b></article><article style={{padding:12,border:"1px solid color-mix(in srgb,#e45c70 34%,var(--line))",borderRadius:12,background:"color-mix(in srgb,#ef6579 6%,var(--panelSolid))"}}><small style={{fontSize:10,color:"var(--muted)"}}>PENDIENTE</small><b style={{display:"block",marginTop:5,fontSize:15,color:"#e05267"}}>{money(balance,currency)}</b></article></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,flexWrap:"wrap",marginTop:18,paddingTop:14,borderTop:"1px solid var(--line)"}}><button type="button" onClick={onClose} disabled={saving} style={button}>Cancelar</button><button type="button" onClick={onConfirm} disabled={saving} style={{...button,borderColor:"color-mix(in srgb,#e45c70 38%,var(--line))",color:"#d84960",background:"color-mix(in srgb,#ef6579 6%,var(--panelSolid))"}}>{saving?"Finalizando…":"Hacer check-out con saldo pendiente"}</button><button type="button" onClick={onPay} disabled={saving} style={{...button,borderColor:"var(--accent)",background:"var(--accent)",color:"#fff"}}>Cobrar ahora</button></div>
      </div>
    </section>
  </div>
}

export default function ReservationsWorkspace({propertyId,onNavigate,focusReservationId,onFocusHandled}){
  const data=useReservationsData(propertyId)
  const[query,setQuery]=useState(""),[mode,setMode]=useState("active"),[filterOpen,setFilterOpen]=useState(false),[paymentFilter,setPaymentFilter]=useState("all"),[createdFilter,setCreatedFilter]=useState("all"),[sortMode,setSortMode]=useState("created-desc"),[selected,setSelected]=useState(null),[saving,setSaving]=useState(""),[editOpen,setEditOpen]=useState(false),[checkoutConfirm,setCheckoutConfirm]=useState(null),[checkinConfirm,setCheckinConfirm]=useState(null),[checkinError,setCheckinError]=useState(""),[noShowConfirm,setNoShowConfirm]=useState(null),[noShowError,setNoShowError]=useState("")
  const focusReloadRef=useRef(null)
  const roomById=useMemo(()=>new Map(data.rooms.map(room=>[Number(room.id),room])),[data.rooms])
  const items=useMemo(()=>data.reservations.map(item=>{const paid=data.paymentByReservation.get(Number(item.id))||0,rooms=roomIds(item).map(id=>roomById.get(id)).filter(Boolean);return{...item,property_id:propertyId,paid,payment:paymentState(item,paid),room:rooms[0]||roomById.get(Number(item.habitacion_id)),rooms}}),[data.reservations,data.paymentByReservation,roomById,propertyId])

  function syncRecordUrl(id){if(typeof window==="undefined")return;const url=new URL(window.location.href);if(id==null)url.searchParams.delete("reservation");else url.searchParams.set("reservation",String(id));window.history.replaceState({pmsView:"reservations",reservationId:id??null},"",url)}
  function enrichRecord(item){const paid=data.paymentByReservation.get(Number(item.id))||0,rooms=roomIds(item).map(id=>roomById.get(id)).filter(Boolean);return{...item,property_id:propertyId,paid,payment:paymentState(item,paid),room:rooms[0]||roomById.get(Number(item.habitacion_id)),rooms}}
  function openRecord(item){setEditOpen(false);setSelected(item);syncRecordUrl(item.id)}
  function closeRecord(){setEditOpen(false);setSelected(null);setCheckoutConfirm(null);setCheckinConfirm(null);setCheckinError("");setNoShowConfirm(null);setNoShowError("");syncRecordUrl(null)}

  useEffect(()=>{
    if(!focusReservationId){focusReloadRef.current=null;return}
    const wanted=Number(focusReservationId)
    let cancelled=false
    syncRecordUrl(wanted)
    setEditOpen(false)
    if(selected&&Number(selected.id)!==wanted)setSelected(null)
    const target=items.find(item=>Number(item.id)===wanted)
    if(target){focusReloadRef.current=null;setMode(target.estado==="cancelada"?"trash":target.no_show?"noshow":"active");setSelected(target);onFocusHandled?.();return}
    if(focusReloadRef.current===String(wanted))return
    focusReloadRef.current=String(wanted)
    ;(async()=>{
      try{
        const{data:row,error:rowError}=await supabase.from("reservas").select(RECORD_SELECT).eq("property_id",propertyId).eq("id",wanted).single()
        if(rowError)throw rowError
        if(cancelled)return
        const record=enrichRecord(row)
        setMode(record.estado==="cancelada"?"trash":record.no_show?"noshow":"active")
        setSelected(record)
        onFocusHandled?.()
        data.load()
      }catch{
        if(cancelled)return
        focusReloadRef.current=null
        data.load()
      }
    })()
    return()=>{cancelled=true}
  },[focusReservationId,items,onFocusHandled,propertyId,roomById,data.paymentByReservation])
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
  function requestCheckIn(item){setCheckinError("");setCheckinConfirm(item)}
  async function performCheckIn(item){if(!item)return;setSaving(String(item.id));data.setError("");setCheckinError("");try{const updated=await data.checkin(item.id);if(selected?.id===item.id)setSelected(current=>({...current,...updated}));setCheckinConfirm(null);if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:"Check-in realizado",message:`${item.nombre_huesped} · la reserva cambió de ${reservationStatusLabel(item.estado)} a En hotel.`}}))}catch(err){const message=err?.message||"No se pudo realizar el check-in.";setCheckinError(message);data.setError(message)}finally{setSaving("")}}
  async function performCheckout(item,{withBalance=false}={}){setSaving(String(item.id));data.setError("");try{const total=Math.max(0,Number(item.precio_total)||0),paid=Math.max(0,Number(item.paid)||0),balance=Math.max(0,total-paid);const updated=await data.checkout(item.id);if(withBalance&&balance>0.01){const{error:eventError}=await supabase.from("hotel_reservation_events").insert({property_id:propertyId,reservation_id:Number(item.id),event_type:"checkout_with_balance",title:"Check-out con saldo pendiente",detail:`Se realizó el check-out con ${money(balance,item.moneda||"ARS")} pendiente de pago.`,payload:{total,paid,balance,currency:item.moneda||"ARS",manual_confirmation:true}});if(eventError)console.warn("No se pudo registrar el evento de saldo pendiente",eventError)}if(selected?.id===item.id)setSelected(current=>({...current,...updated}));setCheckoutConfirm(null);if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:withBalance&&balance>0.01?"Check-out con saldo pendiente":"Check-out realizado",message:withBalance&&balance>0.01?`${item.nombre_huesped} · queda pendiente ${money(balance,item.moneda||"ARS")}.`:`${item.nombre_huesped} · estadía finalizada.`}}))}catch(err){data.setError(err?.message||"No se pudo realizar el check-out.")}finally{setSaving("")}}
  function checkout(item){const total=Math.max(0,Number(item.precio_total)||0),paid=Math.max(0,Number(item.paid)||0),balance=Math.max(0,total-paid);if(balance>0.01){setCheckoutConfirm({...item,paid});return}performCheckout(item)}
  function payBeforeCheckout(item){setCheckoutConfirm(null);onNavigate?.("dailycash",{cashReservationId:Number(item.id),restoreScroll:false})}
  function openHousekeepingFromCheckin(){setCheckinConfirm(null);setCheckinError("");onNavigate?.("housekeeping")}
  async function requestNoShow(item){
    if(item.no_show){if(!window.confirm(`Reabrir la reserva ${item.numero_reserva||item.id} de ${item.nombre_huesped}? Volverá a bloquear disponibilidad si sus fechas se superponen con el Planning.`))return;setSaving(String(item.id));data.setError("");try{const updated=await data.restoreNoShow(item.id,"Reabierto manualmente desde Reservas");if(selected?.id===item.id)setSelected(current=>({...current,...updated}));setMode("active");if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:"No Show reabierto",message:`${item.nombre_huesped} volvió a reservas activas. Revisá disponibilidad antes de confirmar cambios.`}}))}catch(err){data.setError(err?.message||"No se pudo reabrir el No Show.")}finally{setSaving("")}return}
    setNoShowError("");setNoShowConfirm(item)
  }
  async function performNoShow(item,options){if(!item)return;setSaving(String(item.id));data.setError("");setNoShowError("");try{const updated=await data.markNoShow(item.id,options);if(selected?.id===item.id)setSelected(current=>({...current,...updated}));setNoShowConfirm(null);setMode("noshow");if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:"No Show registrado",message:`${item.nombre_huesped} · disponibilidad liberada y estadía original guardada en historial.`}}))}catch(err){const message=err?.message||"No se pudo registrar el No Show.";setNoShowError(message);data.setError(message)}finally{setSaving("")}}
  function payBeforeNoShow(item){setNoShowConfirm(null);setNoShowError("");onNavigate?.("dailycash",{cashReservationId:Number(item.id),restoreScroll:false})}
  async function cancel(item){if(!window.confirm(`Cancelar la reserva ${item.numero_reserva||item.id} de ${item.nombre_huesped}?`))return;const ok=await patch(item,{estado:"cancelada"},"cancelar la reserva");if(ok&&selected?.id===item.id)closeRecord()}
  async function restore(item){await patch(item,{estado:"confirmada",no_show:false},"restaurar la reserva")}

  const checkoutDialog=<CheckoutBalanceDialog item={checkoutConfirm} saving={saving===String(checkoutConfirm?.id)} onClose={()=>setCheckoutConfirm(null)} onPay={()=>payBeforeCheckout(checkoutConfirm)} onConfirm={()=>performCheckout(checkoutConfirm,{withBalance:true})}/>
  const checkinDialog=<ReservationCheckinDialog item={checkinConfirm} saving={saving===String(checkinConfirm?.id)} error={checkinError} onClose={()=>{setCheckinConfirm(null);setCheckinError("")}} onHousekeeping={openHousekeepingFromCheckin} onConfirm={()=>performCheckIn(checkinConfirm)}/>
  const noShowDialog=<ReservationNoShowDialog item={noShowConfirm} saving={saving===String(noShowConfirm?.id)} error={noShowError} onClose={()=>{setNoShowConfirm(null);setNoShowError("")}} onPay={()=>payBeforeNoShow(noShowConfirm)} onConfirm={options=>performNoShow(noShowConfirm,options)}/>

  if(selected)return <>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",margin:"0 0 8px",padding:"0 2px"}}><ReservationActionBar item={selected} rooms={selected.rooms} propertyId={propertyId} onRefresh={data.load}/><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><button type="button" onClick={()=>requestNoShow(selected)} disabled={saving===String(selected.id)||selected.estado==="alojado"||selected.estado==="finalizada"||selected.estado==="cancelada"} style={{height:38,padding:"0 14px",border:"1px solid color-mix(in srgb,#30343b 24%,var(--line))",borderRadius:11,background:selected.no_show?"#30343b":"color-mix(in srgb,#30343b 6%,var(--panelSolid))",color:selected.no_show?"#fff":"var(--text)",font:"inherit",fontSize:11,fontWeight:850,cursor:"pointer"}}>{selected.no_show?"↺ Reabrir No Show":"⊘ Marcar No Show"}</button><button type="button" onClick={()=>setEditOpen(true)} style={{height:38,padding:"0 14px",border:"1px solid color-mix(in srgb,var(--accent) 24%,var(--line))",borderRadius:11,background:"color-mix(in srgb,var(--accent) 7%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:11,fontWeight:850,boxShadow:"inset 0 1px color-mix(in srgb,#fff 45%,transparent)",cursor:"pointer"}}>✎ Editar reserva</button></div></div>
    <ReservationRecord item={selected} room={selected.room} rooms={selected.rooms} payments={data.payments} propertyId={propertyId} onBack={closeRecord} onNavigate={onNavigate} saving={saving===String(selected.id)||selected.no_show} onPrimaryAction={()=>selected.estado==="alojado"?checkout(selected):requestCheckIn(selected)}/>
    {editOpen?<ReservationEditPanel item={selected} assignedRooms={selected.rooms} allRooms={data.rooms} saving={saving===String(selected.id)} onCancel={()=>setEditOpen(false)} onPreviewMove={data.previewMove} onMove={data.moveReservation} onUpdate={data.updateReservation} onSaved={()=>{setEditOpen(false);data.load()}}/>:null}
    {checkinDialog}
    {noShowDialog}
    {checkoutDialog}
  </>

  return <>
    <section className={s.page}>
      <header className={s.heading}><div><small>RESERVAS</small><h1>Reservas</h1><p>{items.filter(item=>item.estado!=="cancelada").length} reservas cargadas de la propiedad activa.</p></div><div className={s.tools}><label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar reserva, huésped o habitación"/></label><select className={s.tool} value={sortMode} onChange={event=>setSortMode(event.target.value)} aria-label="Ordenar reservas"><option value="created-desc">Últimas creadas</option><option value="created-asc">Primeras creadas</option><option value="arrival-next">Próximas llegadas</option><option value="arrival-desc">Llegadas más lejanas</option></select><button type="button" className={`${s.tool} ${mode==="noshow"?s.toolActive:""}`} onClick={()=>setMode(v=>v==="noshow"?"active":"noshow")}>⊘ No-show</button><button type="button" className={`${s.tool} ${mode==="trash"?s.toolActive:""}`} onClick={()=>setMode(v=>v==="trash"?"active":"trash")}>♲ Canceladas</button><button type="button" className={`${s.tool} ${filterOpen?s.toolActive:""}`} onClick={()=>setFilterOpen(v=>!v)}>≡ Filtrar</button></div></header>
      {data.error&&<div className={s.empty}>{data.error}</div>}
      {filterOpen&&<div className={s.filterPanel}><span>Pago</span>{[["all","Todos"],["paid","Pagado"],["pending","Parcial"],["due","Pendiente"]].map(([value,label])=><button type="button" key={value} className={paymentFilter===value?s.selectedFilter:""} onClick={()=>setPaymentFilter(value)}>{label}</button>)}<span style={{marginLeft:8}}>Creación</span><button type="button" className={createdFilter==="all"?s.selectedFilter:""} onClick={()=>setCreatedFilter("all")}>Todas</button><button type="button" className={createdFilter==="today"?s.selectedFilter:""} onClick={()=>setCreatedFilter("today")}>Creadas hoy</button></div>}
      <div className={s.tableWrap}><table className={s.table}><thead><tr><th>ID</th><th>Cliente</th><th>Habitación</th><th>Llegada</th><th>Salida</th><th>Pago</th><th>Acciones</th></tr></thead><tbody>{visible.map(item=>{const names=(item.rooms||[]).map(room=>room.nombre);return <tr key={item.id}><td className={s.id}>{item.numero_reserva||item.id}</td><td className={s.client}><b>{item.nombre_huesped}</b><small>{item.canal_reserva||"Directa"}</small></td><td><span className={s.room}><span className={s.roomBadge}>{names[0]||"—"}{names.length>1?` +${names.length-1}`:""}</span><i className={s.roomDot}/></span></td><td>{fmtDate(item.fecha_entrada)}</td><td>{fmtDate(item.fecha_salida)}</td><td><span className={`${s.payment} ${item.payment==="pending"?s.paymentPending:item.payment==="due"?s.paymentDue:""}`}>{paymentLabel(item.payment)}</span></td><td><div className={s.actions}>{mode==="trash"?<button type="button" className={s.actionButton} disabled={saving===String(item.id)} onClick={()=>restore(item)}>↺ Restaurar</button>:<><button type="button" className={`${s.actionButton} ${s.checkin} ${item.estado==="alojado"?s.checked:""}`} disabled={saving===String(item.id)||item.estado==="finalizada"||item.no_show} onClick={()=>item.estado==="alojado"?checkout(item):requestCheckIn(item)}>{item.estado==="alojado"?"← Check-out":"→ Check-in"}</button><button type="button" className={s.actionButton} onClick={()=>openRecord(item)} title="Abrir ficha completa">◉</button><button type="button" className={s.actionButton} disabled={saving===String(item.id)||item.estado==="alojado"||item.estado==="finalizada"} onClick={()=>requestNoShow(item)} title={item.no_show?"Reabrir No Show":"Marcar No Show"}>{item.no_show?"↺":"⊘"}</button><button type="button" className={s.actionButton} disabled={saving===String(item.id)} onClick={()=>cancel(item)} title="Cancelar">⌫</button></>}</div></td></tr>})}</tbody></table>{data.loading?<div className={s.empty}>Cargando reservas…</div>:!visible.length&&<div className={s.empty}>No hay reservas que coincidan con esta vista.</div>}</div>
      <div className={s.footer}><span>Mostrando {visible.length} de {items.length} cargadas</span><span>{data.hasMore?"Hay más historial disponible.":"Historial cargado hasta el último registro disponible."}</span>{data.hasMore&&<button type="button" className={s.tool} disabled={data.loadingMore} onClick={data.loadMore}>{data.loadingMore?"Cargando…":"Cargar 200 más"}</button>}</div>
    </section>
    {checkinDialog}
    {noShowDialog}
    {checkoutDialog}
  </>
}
