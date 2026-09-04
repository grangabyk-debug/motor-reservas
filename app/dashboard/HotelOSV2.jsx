"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import HotelSidebar from"./components/shell/HotelSidebar"
import HotelTopbar from"./components/shell/HotelTopbar"
import NotificationCenter from"./components/shell/NotificationCenter"
import CommandPalette from"./components/shell/CommandPalette"
import HotelViewRouter from"./components/shell/HotelViewRouter"
import IntelligenceConcierge from"./components/intelligence/IntelligenceConcierge"
import{useHotelSession}from"./hooks/useHotelSession"
import{useHotelData}from"./hooks/useHotelData"
import{can}from"./core/permissions"
import{VIEW_META}from"./core/navigation"
import{buildOperationalNotifications}from"./core/operationalNotifications"
import{addDays,money,shortDate}from"./core/formatters"
import ReservationDrawer from"./features/frontdesk/ReservationDrawer"
import ReservationCreateWizard from"./features/frontdesk/ReservationCreateWizard"
import{blankReservation,reservationToDraft}from"./features/frontdesk/reservationModel"
import{saveReservation,moveReservation,checkinReservation,checkoutReservation,savePayment}from"./services/reservations"
import{saveBlock}from"./services/operations"
import{setReservationTentative}from"./services/tentatives"
import{prepareKey,createWebCheckin,sendReservationEmail,askIntelligence}from"./services/hotel"
import ui from"./v2.module.css"
import loadingUi from"./loading-screen.module.css"

const TITLES={lobby:"Dashboard",calendar:"Planning",reservations:"Reservas",guests:"Huéspedes",messages:"Mensajes",keys:"Puertas",rooms:"Habitaciones",housekeeping:"Rack de limpiezas",maintenance:"Última actividad",resources:"Recursos",twin:"Digital Twin",rates:"Tarifas",packages:"Packs & Promos",partners:"Empresas & Agencias",groups:"Grupos",upselling:"Upselling",distribution:"Distribución",cash:"Caja & Folios",billing:"Facturación",reports:"Informes",team:"Equipo & Roles",automations:"Automatizaciones",intelligence:"Llena Intelligence",integrations:"Integraciones",settings:"Configuración",support:"Ayuda"}
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))

export default function HotelOSV2(){
  const session=useHotelSession(),[view,setView]=useState("lobby"),[search,setSearch]=useState(""),[mobile,setMobile]=useState(false),[drawer,setDrawer]=useState(null),[blockDraft,setBlockDraft]=useState(null),[busy,setBusy]=useState(false),[toast,setToast]=useState(""),[commandOpen,setCommandOpen]=useState(false),[notificationsOpen,setNotificationsOpen]=useState(false),deepLinkHandled=useRef(false)
  const data=useHotelData(session.propertyId,view),permissions=data.hotel?.permissions||[],role=session.role,live=useMemo(()=>data.reservations.filter(r=>r.estado!=="cancelada"&&!r.no_show),[data.reservations]),committed=useMemo(()=>live.filter(r=>String(r.estado||"").toLowerCase()!=="tentativa"),[live]),activeRooms=data.rooms.filter(r=>r.activa!==false),currentProperty=session.properties.find(p=>String(p.id)===String(session.propertyId))
  const settings=data.settings||{hotel_name:currentProperty?.hotel_name||currentProperty?.name||"Hotel",motto:"La hospitalidad se siente en cada detalle.",logo_data_url:currentProperty?.logo_data_url||""},allowed=permission=>can(role,permission,permissions),ops=settings.operational_settings&&typeof settings.operational_settings==="object"?settings.operational_settings:{},packages=data.packages?.length?data.packages:(data.commercial?.packages||[])
  const notificationItems=useMemo(()=>buildOperationalNotifications({rooms:data.rooms,reservations:data.reservations,payments:data.payments,automationEvents:data.automationEvents,inboxConversations:data.inboxConversations,maintenanceTickets:data.maintenanceTickets}),[data.rooms,data.reservations,data.payments,data.automationEvents,data.inboxConversations,data.maintenanceTickets]),notificationCount=notificationItems.length
  const notify=message=>{setToast(String(message));setTimeout(()=>setToast(""),3400)},changeView=id=>{setView(id);setMobile(false);setNotificationsOpen(false)}
  useEffect(()=>{const handler=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setCommandOpen(v=>!v)}else if(e.key==="Escape"){setCommandOpen(false);setNotificationsOpen(false)}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)},[])
  useEffect(()=>{if(deepLinkHandled.current||typeof window==="undefined"||!data.reservations.length)return;const id=new URLSearchParams(window.location.search).get("reservation");if(!id)return;const reservation=data.reservations.find(r=>String(r.id)===String(id));deepLinkHandled.current=true;if(!reservation)return;setView("calendar");setDrawer(reservationToDraft(reservation));const url=new URL(window.location.href);url.searchParams.delete("reservation");window.history.replaceState({},"",`${url.pathname}${url.search}${url.hash}`)},[data.reservations])
  async function action(fn,success){try{setBusy(true);const result=await fn();await data.reload();if(success)notify(typeof success==="function"?success(result):success);return result}catch(error){notify(error?.message||"No se pudo completar la operación.");return null}finally{setBusy(false)}}
  function openReservation(r,tab=""){const draft=reservationToDraft(r);if(tab)draft._initialTab=tab;setDrawer(draft)}
  function openReservationTab(r){if(typeof window!=="undefined"&&r?.id)window.open(`/dashboard?reservation=${encodeURIComponent(r.id)}`,"_blank","noopener,noreferrer")}
  function newReservation(input="",start="",options={}){
    const opts=typeof input==="object"&&input!==null?input:{roomId:input,start,...options},draft=blankReservation(),roomIds=[...new Set([...(opts.roomIds||[]),opts.roomId].map(String).filter(Boolean))]
    if(opts.start)draft.start=opts.start
    if(opts.end)draft.end=opts.end
    else if(opts.start)draft.end=addDays(opts.start,1)
    if(roomIds.length){const primary=data.rooms.find(r=>String(r.id)===roomIds[0]);draft.roomId=roomIds[0];draft.rate=Number(primary?.precio||0);draft.additionalRooms=roomIds.slice(1).map(id=>{const room=data.rooms.find(r=>String(r.id)===id);return{roomId:id,rate:Number(room?.precio||0),name:room?.nombre||"",type:room?.tipo||"Habitación"}})}
    if(opts.tentative){draft._tentative=true;draft._tentativeExpiresAt=opts.expiresAt||new Date(Date.now()+24*3600000).toISOString();draft._tentativeNote=opts.note||"Creada como tentativa desde Planning"}
    setDrawer(draft)
  }
  async function persistReservation(draft,{autosave=false}={}){
    const room=data.rooms.find(r=>String(r.id)===String(draft.roomId)),original=draft.id?data.reservations.find(r=>String(r.id)===String(draft.id)):null
    if(!room){if(!autosave)notify("Elegí una habitación.");return null}
    if(!draft.guest?.trim()){if(!autosave)notify("Falta el nombre del huésped.");return null}
    if(autosave){const saved=await saveReservation({draft,room,rooms:data.rooms,propertyId:session.propertyId,userId:session.user.id,original});await data.reload();return saved}
    return action(async()=>{let saved=await saveReservation({draft,room,rooms:data.rooms,propertyId:session.propertyId,userId:session.user.id,original});if(!draft.id&&draft._tentative&&saved?.id)saved=await setReservationTentative({propertyId:session.propertyId,reservationId:saved.id,expiresAt:draft._tentativeExpiresAt||new Date(Date.now()+24*3600000).toISOString(),note:draft._tentativeNote||"Creada como tentativa desde Planning"});setDrawer(null);return saved},draft.id?"Reserva actualizada.":draft._tentative?"Reserva tentativa creada.":"Reserva creada.")
  }
  async function move(id,roomId,start){const r=data.reservations.find(x=>String(x.id)===String(id));if(!r)return null;return action(()=>moveReservation({reservationId:r.id,roomId,start,end:null}),result=>result?`Reserva movida a ${start}.`:"Reserva movida.")}
  async function resize(id,end){const r=data.reservations.find(x=>String(x.id)===String(id));if(!r)return null;return action(()=>moveReservation({reservationId:r.id,roomId:r.habitacion_id,start:r.fecha_entrada,end}),result=>result?`Salida actualizada al ${end}.`:"Fecha de salida actualizada.")}
  async function quickCheckin(reservation){if(!reservation?.id)return null;return action(()=>checkinReservation({id:reservation.id,propertyId:session.propertyId}),"Check-in realizado.")}
  async function quickCheckout(reservation){if(!reservation?.id)return null;return action(()=>checkoutReservation(reservation.id),"Check-out realizado. La habitación pasó a limpieza.")}
  async function blockRange({roomIds=[],start,end,reason="Bloqueo operativo",detail=""}){const ids=[...new Set(roomIds.map(String).filter(Boolean))];if(!ids.length)return null;return action(async()=>{for(const roomId of ids)await saveBlock({propertyId:session.propertyId,userId:session.user.id,draft:{roomId,start,end,reason,detail}});return ids.length},count=>`${count} ${count===1?"habitación bloqueada":"habitaciones bloqueadas"}.`)}
  async function pay(payment){if(drawer?.id)await action(()=>savePayment({propertyId:session.propertyId,userId:session.user.id,reservationId:drawer.id,amount:payment.amount,method:payment.method,currency:payment.currency||"ARS",note:payment.note||""}),"Pago registrado.")}
  async function checkin(){if(drawer?.id)await action(async()=>{await checkinReservation({id:drawer.id,propertyId:session.propertyId});setDrawer(null)},"Check-in realizado.")}
  async function checkout(){if(drawer?.id)await action(async()=>{await checkoutReservation(drawer.id);setDrawer(null)},"Check-out realizado. La habitación pasó a limpieza.")}
  async function webCheckin(options={}){if(!drawer?.id)return"";const url=await action(()=>createWebCheckin({propertyId:session.propertyId,reservationId:drawer.id}),null);if(!url)return"";if(options?.copy===false){notify("Web Check-in generado para enviar al huésped.");return url}try{await navigator.clipboard.writeText(url);notify("Web Check-in generado y enlace copiado.")}catch{notify(`Web Check-in generado: ${url}`)}return url}
  async function emailCurrent(){if(drawer?.id)await action(()=>sendReservationEmail({reservationId:drawer.id}),r=>r?.mode==="sent"?"Email enviado.":"Correo preparado en el dispositivo.")}
  const original=drawer?.id?data.reservations.find(r=>String(r.id)===String(drawer.id)):null
  async function keyCurrent(){if(!original)return;const room=data.rooms.find(r=>String(r.id)===String(original.habitacion_id));await action(()=>prepareKey({propertyId:session.propertyId,userId:session.user.id,reservation:original,room,encoder:ops.key_encoder||{},count:Number(ops.key_encoder?.default_key_count||2)}),r=>r?.physical?"Llave codificada.":"Emisión registrada; falta confirmación física.")}
  function printCurrent(){if(!original)return;const room=data.rooms.find(r=>String(r.id)===String(original.habitacion_id)),paid=data.payments.filter(p=>String(p.reserva_id)===String(original.id)).reduce((a,p)=>a+Number(p.monto||0),0),w=window.open("","_blank","width=900,height=720");if(!w)return notify("El navegador bloqueó la impresión.");w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reserva ${esc(original.numero_reserva||original.id)}</title><style>body{font-family:Arial;color:#222;padding:34px}table{border-collapse:collapse;width:100%}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><small>${esc(settings.hotel_name)}</small><h1>Reserva ${esc(original.numero_reserva||original.id)}</h1><p><b>${esc(original.nombre_huesped)}</b><br>${esc(original.email_huesped||"")} · ${esc(original.telefono_huesped||"")}</p><table><tr><th>Habitación</th><td>${esc(room?.nombre||original.habitacion_id)}</td></tr><tr><th>Estadía</th><td>${esc(shortDate(original.fecha_entrada))} → ${esc(shortDate(original.fecha_salida))}</td></tr><tr><th>Total</th><td>${esc(money(original.precio_total,original.moneda))}</td></tr><tr><th>Pagado</th><td>${esc(money(paid,original.moneda))}</td></tr></table><script>onload=()=>print()</script></body></html>`);w.document.close()}
  if(session.loading)return <LoadingScreen/>
  if(!session.properties.length)return <LoadingScreen title="No encontramos un hotel asociado" message="Revisá la cuenta o volvé a iniciar sesión para continuar." idle/>
  const hotelName=settings.hotel_name||currentProperty?.hotel_name||currentProperty?.name||"Hotel",hotelLogo=settings.logo_data_url||currentProperty?.logo_data_url||"",newReservationAction=allowed("frontdesk.reservations.edit")?()=>newReservation():null
  return <div className={ui.shell}>
    <HotelSidebar view={view} onView={changeView} hotelName={hotelName} hotelLogo={hotelLogo} role={role} properties={session.properties} propertyId={session.propertyId} onPropertyChange={session.setPropertyId} onLogout={session.logout} onNewReservation={newReservationAction} mobileOpen={mobile}/>
    <main className={ui.work}>
      {view!=="lobby"&&<HotelTopbar view={view} title={TITLES[view]||VIEW_META[view]?.label||"Hotel"} onNewReservation={view==="support"?null:newReservationAction} onMenu={()=>setMobile(v=>!v)} onCommand={()=>setCommandOpen(true)} onNotifications={()=>setNotificationsOpen(true)} notificationCount={notificationCount} onSupport={()=>changeView("support")} onSettings={()=>changeView("settings")}/>} 
      {data.error&&<div className={ui.notice}>{data.error}</div>}
      <HotelViewRouter view={view} data={data} session={session} settings={settings} permissions={permissions} role={role} live={live} committed={committed} activeRooms={activeRooms} packages={packages} search={search} setSearch={setSearch} allowed={allowed} action={action} changeView={changeView} openReservation={openReservation} openReservationTab={openReservationTab} newReservation={newReservation} newReservationAction={newReservationAction} move={move} resize={resize} quickCheckin={quickCheckin} quickCheckout={quickCheckout} blockRange={blockRange} setBlockDraft={setBlockDraft} onMenu={()=>setMobile(v=>!v)} onCommand={()=>setCommandOpen(true)} onNotifications={()=>setNotificationsOpen(true)} notificationCount={notificationCount} hotelName={hotelName}/>
    </main>
    {drawer&&!drawer.id&&<ReservationCreateWizard initial={drawer} rooms={activeRooms} busy={busy} onClose={()=>setDrawer(null)} onSave={persistReservation}/>} 
    {drawer?.id&&<ReservationDrawer initial={drawer} original={original} rooms={activeRooms} partners={data.commercial.partners||[]} groups={data.commercial.groups||[]} charges={data.charges} payments={data.payments} busy={busy} onClose={()=>setDrawer(null)} onSave={persistReservation} onCheckin={checkin} onCheckout={checkout} onPayment={pay} onPrint={printCurrent} onEmail={emailCurrent} onKey={keyCurrent} onWebCheckin={webCheckin}/>} 
    {blockDraft&&<BlockModal draft={blockDraft} setDraft={setBlockDraft} rooms={activeRooms} busy={busy} onClose={()=>setBlockDraft(null)} onSave={()=>action(async()=>{await saveBlock({propertyId:session.propertyId,userId:session.user.id,draft:blockDraft});setBlockDraft(null)},"Habitación bloqueada.")}/>} 
    <NotificationCenter open={notificationsOpen} onClose={()=>setNotificationsOpen(false)} data={data} onOpenReservation={openReservation} onView={changeView} onOpenMessages={()=>changeView("messages")}/>
    <CommandPalette open={commandOpen} onClose={()=>setCommandOpen(false)} reservations={data.reservations} rooms={activeRooms} guests={data.guests} onNavigate={changeView} onOpenReservation={openReservation} onNewReservation={newReservationAction}/>
    <IntelligenceConcierge settings={settings} rooms={activeRooms} reservations={live} payments={data.payments} onAsk={(question,context)=>askIntelligence({question,context})} onNavigate={changeView}/>
    {toast&&<div className={ui.toast}>{toast}</div>}
  </div>
}

function LoadingScreen({title="Preparando tu hotel",message="Sincronizando operación, reservas y disponibilidad.",idle=false}){return <div className={loadingUi.screen}><div className={loadingUi.inner}><div className={loadingUi.visual}><span className={loadingUi.orbit}/><span className={loadingUi.mark}>HL</span></div><p className={loadingUi.eyebrow}>HABITACIÓN LLENA</p><h1 className={loadingUi.title}>{title}</h1><p className={loadingUi.message}>{message}</p>{!idle&&<div className={loadingUi.progress} aria-label="Cargando"><i/><i/><i/></div>}</div></div>}

function BlockModal({draft,setDraft,rooms,busy,onClose,onSave}){return <div className={ui.shade} onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className={ui.modal} onSubmit={e=>{e.preventDefault();onSave()}}><header><h3>Bloquear habitación</h3><button type="button" onClick={onClose}>×</button></header><div className={ui.fieldGrid}><label><span>Habitación</span><select value={draft.roomId} onChange={e=>setDraft(x=>({...x,roomId:e.target.value}))}>{rooms.map(r=><option key={r.id} value={r.id}>{r.nombre}</option>)}</select></label><label><span>Motivo</span><select value={draft.reason} onChange={e=>setDraft(x=>({...x,reason:e.target.value}))}><option>Mantenimiento</option><option>Fuera de servicio</option><option>Uso interno</option><option>Bloqueo operativo</option><option>Otro</option></select></label><label><span>Desde</span><input type="date" value={draft.start} onChange={e=>setDraft(x=>({...x,start:e.target.value}))}/></label><label><span>Hasta</span><input type="date" value={draft.end} onChange={e=>setDraft(x=>({...x,end:e.target.value}))}/></label><label className={ui.wide}><span>Detalle</span><textarea value={draft.detail||""} onChange={e=>setDraft(x=>({...x,detail:e.target.value}))}/></label></div><footer><button type="button" onClick={onClose}>Cancelar</button><button disabled={busy}>Crear bloqueo</button></footer></form></div>}
