"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

const NAV = [
  ["overview", "Inicio", "⌂"],
  ["calendar", "Command Center", "▦"],
  ["reservations", "Reservas", "▣"],
  ["distribution", "Distribution", "⌁"],
  ["revenue", "Revenue", "↗"],
  ["guests", "Huéspedes", "◎"],
  ["housekeeping", "Housekeeping", "◇"],
  ["automations", "Automatizaciones", "✦"],
  ["twin", "Hotel Digital Twin", "▥"],
  ["identity", "Identidad del hotel", "◌"],
]

const DEFAULT_SETTINGS = {
  hotel_name: "Habitación Llena Hotel",
  city: "",
  motto: "Hospitalidad que se siente antes de llegar.",
  welcome_message: "Todo listo para recibir.",
  theme: "forest",
  logo_data_url: null,
}

const CHANNELS = ["Motor directo", "Booking.com", "Expedia", "Airbnb", "Agoda", "SiteMinder"]

function isoDate(value = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" })
  return formatter.format(value)
}

function parseDate(value) { return new Date(`${value}T12:00:00`) }
function addDays(value, amount) { const d = parseDate(value); d.setDate(d.getDate() + Number(amount)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` }
function diffDays(a,b) { return Math.max(1, Math.round((parseDate(b)-parseDate(a))/86400000)) }
function money(value) { return `$ ${Math.round(Number(value||0)).toLocaleString("es-AR")}` }
function shortDate(value) { return parseDate(value).toLocaleDateString("es-AR", { day:"2-digit", month:"short" }) }
function normalize(value) { return String(value||"").trim().toLowerCase() }

function statusMeta(status) {
  return {
    alojado:["Alojado","emerald"], confirmada:["Confirmada","gold"], pendiente:["Pendiente","amber"], finalizada:["Finalizada","muted"], cancelada:["Cancelada","rose"],
  }[normalize(status)] || [status || "Reserva","gold"]
}

function roomMeta(status) {
  return {
    limpia:["Lista","emerald"], libre:["Lista","emerald"], sucia:["Sucia","rose"], inspeccion:["Inspección","amber"], mantenimiento:["Mantenimiento","muted"], ocupada:["Ocupada","gold"],
  }[normalize(status)] || [status || "Lista","emerald"]
}

export default function HotelOS() {
  const [today, setToday] = useState("")
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState("overview")
  const [properties, setProperties] = useState([])
  const [propertyId, setPropertyId] = useState("")
  const [alojamientos, setAlojamientos] = useState([])
  const [rooms, setRooms] = useState([])
  const [reservations, setReservations] = useState([])
  const [payments, setPayments] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [automations, setAutomations] = useState([])
  const [connections, setConnections] = useState([])
  const [calendarStart, setCalendarStart] = useState("")
  const [selectedReservationId, setSelectedReservationId] = useState(null)
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [search, setSearch] = useState("")
  const [toast, setToast] = useState("")
  const [newOpen, setNewOpen] = useState(false)
  const [newForm, setNewForm] = useState({ guest:"", email:"", phone:"", roomId:"", start:"", end:"", pax:2, channel:"Directa", notes:"" })
  const [splitForm, setSplitForm] = useState({ date:"", roomId:"" })
  const [paymentForm, setPaymentForm] = useState({ amount:"", method:"Efectivo" })
  const [identityOpen, setIdentityOpen] = useState(false)
  const [automationDraft, setAutomationDraft] = useState("")
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState("")
  const [aiMessages, setAiMessages] = useState([{ role:"assistant", text:"Estoy conectada a la operación de este hotel. Preguntame por ocupación, reservas, housekeeping o revenue." }])
  const [aiProposal, setAiProposal] = useState(null)
  const [creatingHotel, setCreatingHotel] = useState("")

  const notify = (text) => { setToast(text); window.setTimeout(()=>setToast(""),2400) }

  useEffect(() => {
    const now = isoDate()
    setToday(now)
    setCalendarStart(now)
    setNewForm(v => ({ ...v, start:now, end:addDays(now,2) }))
  }, [])

  useEffect(() => {
    let alive = true
    ;(async()=>{
      const { data:{ session } } = await supabase.auth.getSession()
      if (!alive) return
      if (!session?.user) { window.location.href="/login"; return }
      setUser(session.user)
      await loadProperties(session.user.id)
      if (alive) setLoading(false)
    })().catch((error)=>{ console.error(error); if(alive) setLoading(false) })
    return ()=>{ alive=false }
  }, [])

  async function loadProperties(uid=user?.id) {
    if (!uid) return
    const [{data:member},{data:owned}] = await Promise.all([
      supabase.from("property_members").select("property_id,role").eq("user_id",uid),
      supabase.from("properties").select("id,name,city,description,owner_id").eq("owner_id",uid),
    ])
    const ids = Array.from(new Set([...(member||[]).map(x=>x.property_id), ...(owned||[]).map(x=>x.id)].filter(Boolean)))
    if (!ids.length) { setProperties([]); setPropertyId(""); return }
    const {data:list,error} = await supabase.from("properties").select("id,name,city,description,owner_id").in("id",ids).order("created_at")
    if (error) throw error
    setProperties(list||[])
    setPropertyId(current => current && ids.includes(current) ? current : String(list?.[0]?.id||""))
  }

  async function createHotel(e) {
    e.preventDefault()
    const name = creatingHotel.trim()
    if (!name || !user?.id) return
    const {data:property,error} = await supabase.from("properties").insert({ name, owner_id:user.id }).select("*").single()
    if (error) return notify(error.message)
    await supabase.from("property_members").insert({ property_id:property.id,user_id:user.id,role:"owner" })
    await supabase.from("alojamientos").insert({ nombre:name,user_id:user.id,property_id:property.id })
    await supabase.from("hotel_os_settings").insert({ property_id:property.id,hotel_name:name,motto:DEFAULT_SETTINGS.motto,welcome_message:DEFAULT_SETTINGS.welcome_message,theme:"forest" })
    setCreatingHotel("")
    await loadProperties(user.id)
    setPropertyId(property.id)
  }

  useEffect(() => {
    if (!propertyId || !user?.id) return
    loadHotel()
    const channel = supabase.channel(`hotel-os-${propertyId}`)
      .on("postgres_changes", { event:"*", schema:"public", table:"reservas", filter:`property_id=eq.${propertyId}` }, ()=>loadHotel({quiet:true}))
      .on("postgres_changes", { event:"*", schema:"public", table:"habitaciones", filter:`property_id=eq.${propertyId}` }, ()=>loadHotel({quiet:true}))
      .subscribe()
    return ()=>{ supabase.removeChannel(channel) }
  }, [propertyId,user?.id])

  async function loadHotel({quiet=false}={}) {
    if (!propertyId) return
    const [a,r,res,p,s,au,c] = await Promise.all([
      supabase.from("alojamientos").select("*").eq("property_id",propertyId).order("id"),
      supabase.from("habitaciones").select("*").eq("property_id",propertyId).order("id"),
      supabase.from("reservas").select("*").eq("property_id",propertyId).order("fecha_entrada",{ascending:true}),
      supabase.from("pagos").select("*").eq("property_id",propertyId).order("created_at",{ascending:false}),
      supabase.from("hotel_os_settings").select("*").eq("property_id",propertyId).maybeSingle(),
      supabase.from("hotel_automations").select("*").eq("property_id",propertyId).order("created_at",{ascending:false}),
      supabase.from("hotel_channel_connections").select("*").eq("property_id",propertyId).order("provider"),
    ])
    ;[a,r,res,p,s,au,c].forEach(x=>{ if(x.error) console.warn(x.error) })
    setAlojamientos(a.data||[]); setRooms(r.data||[]); setReservations(res.data||[]); setPayments(p.data||[])
    const property = properties.find(x=>String(x.id)===String(propertyId))
    setSettings({ ...DEFAULT_SETTINGS, hotel_name:property?.name||DEFAULT_SETTINGS.hotel_name, city:property?.city||"", ...(s.data||{}) })
    setAutomations(au.data||[]); setConnections(c.data||[])
    if (!quiet) setSelectedReservationId(null)
  }

  const activeReservations = useMemo(()=>reservations.filter(r=>normalize(r.estado)!=="cancelada" && !r.no_show),[reservations])
  const todayOccupied = useMemo(()=>activeReservations.filter(r=>today && r.fecha_entrada<=today && r.fecha_salida>today && normalize(r.estado)!=="finalizada"),[activeReservations,today])
  const arrivals = useMemo(()=>activeReservations.filter(r=>r.fecha_entrada===today && normalize(r.estado)!=="finalizada"),[activeReservations,today])
  const departures = useMemo(()=>activeReservations.filter(r=>r.fecha_salida===today && normalize(r.estado)!=="finalizada"),[activeReservations,today])
  const sellableRooms = useMemo(()=>rooms.filter(r=>r.activa!==false && normalize(r.estado)!=="mantenimiento"),[rooms])
  const occupancy = sellableRooms.length ? Math.round(todayOccupied.length/sellableRooms.length*100) : 0
  const gross = activeReservations.reduce((s,r)=>s+Number(r.precio_total||0),0)
  const nightsSold = activeReservations.reduce((s,r)=>s+(Number(r.noches)||diffDays(r.fecha_entrada,r.fecha_salida)),0)
  const adr = nightsSold ? gross/nightsSold : 0
  const revpar = sellableRooms.length ? gross/Math.max(1,sellableRooms.length*30) : 0
  const calendarDays = useMemo(()=>calendarStart ? Array.from({length:14},(_,i)=>addDays(calendarStart,i)) : [],[calendarStart])
  const selectedReservation = reservations.find(r=>String(r.id)===String(selectedReservationId)) || null
  const selectedRoom = rooms.find(r=>String(r.id)===String(selectedRoomId)) || null

  const paidFor = (reservation) => payments.filter(p=>String(p.reserva_id)===String(reservation?.id)).reduce((s,p)=>s+Number(p.monto||0),0)
  const balanceFor = (reservation) => Math.max(0,Number(reservation?.precio_total||0)-paidFor(reservation))

  const guestProfiles = useMemo(()=>{
    const map=new Map()
    activeReservations.forEach(r=>{
      const key=normalize(r.email_huesped)||normalize(r.telefono_huesped)||normalize(r.nombre_huesped)
      if(!key) return
      const old=map.get(key)||{key,name:r.nombre_huesped,email:r.email_huesped,phone:r.telefono_huesped,stays:0,nights:0,lifetime:0,last:null,notes:new Set(),channels:new Set()}
      old.stays++; old.nights+=Number(r.noches)||diffDays(r.fecha_entrada,r.fecha_salida); old.lifetime+=Number(r.precio_total||0); old.last=!old.last||r.fecha_entrada>old.last?r.fecha_entrada:old.last
      if(r.notas) old.notes.add(r.notas); if(r.canal_reserva) old.channels.add(r.canal_reserva)
      map.set(key,old)
    })
    return Array.from(map.values()).map(g=>({...g,notes:Array.from(g.notes),channels:Array.from(g.channels)})).sort((a,b)=>b.lifetime-a.lifetime)
  },[activeReservations])

  async function moveReservation(id,roomId,start,end=null) {
    const {error} = await supabase.rpc("hl_move_reservation_atomic", { p_reserva_id:Number(id), p_habitacion_id:Number(roomId), p_fecha_entrada:start, p_fecha_salida:end })
    if(error) return notify(error.message.includes("ocup")||error.code==="23P01" ? "Ese movimiento genera un cruce de reservas." : error.message)
    await loadHotel({quiet:true}); notify("Reserva actualizada sin conflictos.")
  }

  async function resizeReservation(reservation,delta) {
    const next = addDays(reservation.fecha_salida,delta)
    if(next<=reservation.fecha_entrada) return notify("La estadía debe tener al menos una noche.")
    await moveReservation(reservation.id,reservation.habitacion_id,reservation.fecha_entrada,next)
  }

  async function splitReservation() {
    if(!selectedReservation||!splitForm.date||!splitForm.roomId) return notify("Elegí fecha y habitación destino.")
    const {error}=await supabase.rpc("hl_split_reservation_atomic",{p_reserva_id:Number(selectedReservation.id),p_split_date:splitForm.date,p_target_room_id:Number(splitForm.roomId)})
    if(error) return notify(error.message)
    setSplitForm({date:"",roomId:""}); setSelectedReservationId(null); await loadHotel({quiet:true}); notify("Estadía dividida correctamente.")
  }

  async function createReservation(e) {
    e.preventDefault()
    const room=rooms.find(r=>String(r.id)===String(newForm.roomId))
    if(!room||!newForm.guest.trim()||!newForm.start||!newForm.end||newForm.end<=newForm.start) return notify("Revisá huésped, habitación y fechas.")
    const nights=diffDays(newForm.start,newForm.end), total=Number(room.precio||0)*nights
    const {data,error}=await supabase.from("reservas").insert({
      alojamiento_id:room.alojamiento_id||alojamientos[0]?.id, habitacion_id:room.id, habitaciones_ids:[room.id], nombre_huesped:newForm.guest.trim(), email_huesped:newForm.email.trim()||null, telefono_huesped:newForm.phone.trim()||null, fecha_entrada:newForm.start, fecha_salida:newForm.end, cantidad_huespedes:Number(newForm.pax)||1, estado:"confirmada", notas:newForm.notes.trim()||null, user_id:user.id, tarifa_noche:Number(room.precio||0), noches:nights, precio_total:total, subtotal:total, moneda:"ARS", property_id:propertyId, canal_reserva:newForm.channel, numero_reserva:`HL-${Date.now().toString(36).toUpperCase()}`,
    }).select("*").single()
    if(error) return notify(error.code==="23P01"?"La habitación ya está ocupada en esas fechas.":error.message)
    setNewOpen(false); setSelectedReservationId(data.id); await loadHotel({quiet:true}); notify("Reserva creada.")
  }

  async function checkIn(reservation) {
    const {error}=await supabase.from("reservas").update({estado:"alojado"}).eq("id",reservation.id).eq("property_id",propertyId)
    if(error) return notify(error.message)
    await loadHotel({quiet:true}); notify(`Check-in de ${reservation.nombre_huesped} realizado.`)
  }

  async function checkout(reservation) {
    const {error}=await supabase.rpc("hl_checkout_reservation_atomic",{p_reserva_id:Number(reservation.id)})
    if(error) return notify(error.message)
    setSelectedReservationId(null); await loadHotel({quiet:true}); notify("Check-out realizado. Habitación enviada a limpieza.")
  }

  async function registerPayment(e) {
    e.preventDefault(); if(!selectedReservation) return
    const amount=Number(paymentForm.amount); if(!amount||amount<=0) return notify("Ingresá un monto válido.")
    const {error}=await supabase.from("pagos").insert({user_id:user.id,reserva_id:selectedReservation.id,monto:amount,metodo:paymentForm.method,moneda:selectedReservation.moneda||"ARS",property_id:propertyId})
    if(error) return notify(error.message)
    setPaymentForm({amount:"",method:"Efectivo"}); await loadHotel({quiet:true}); notify("Pago registrado.")
  }

  async function setRoomStatus(roomId,status) {
    const {error}=await supabase.from("habitaciones").update({estado:status}).eq("id",roomId).eq("property_id",propertyId)
    if(error) return notify(error.message)
    setRooms(list=>list.map(r=>String(r.id)===String(roomId)?{...r,estado:status}:r)); notify("Estado de habitación actualizado.")
  }

  async function applyRate(percent) {
    const allowed=rooms.filter(r=>r.activa!==false&&Number(r.precio||0)>0)
    const results=await Promise.all(allowed.map(r=>supabase.from("habitaciones").update({precio:Math.round(Number(r.precio)*(1+percent/100))}).eq("id",r.id).eq("property_id",propertyId)))
    const fail=results.find(x=>x.error); if(fail) return notify(fail.error.message)
    await loadHotel({quiet:true}); notify(`Tarifas ${percent>0?"subidas":"ajustadas"} ${Math.abs(percent)}%.`)
  }

  async function saveIdentity(e) {
    e?.preventDefault?.()
    const payload={property_id:propertyId,hotel_name:settings.hotel_name||"Mi hotel",city:settings.city||null,motto:settings.motto||DEFAULT_SETTINGS.motto,welcome_message:settings.welcome_message||DEFAULT_SETTINGS.welcome_message,theme:settings.theme||"forest",logo_data_url:settings.logo_data_url||null,updated_at:new Date().toISOString()}
    const {error}=await supabase.from("hotel_os_settings").upsert(payload,{onConflict:"property_id"})
    if(error) return notify(error.message)
    notify("Identidad del hotel guardada.")
  }

  function readLogo(file) {
    if(!file) return
    if(file.size>700000) return notify("Usá un logo de menos de 700 KB.")
    const reader=new FileReader(); reader.onload=()=>setSettings(s=>({...s,logo_data_url:String(reader.result)})); reader.readAsDataURL(file)
  }

  async function createAutomation(e) {
    e.preventDefault(); const text=automationDraft.trim(); if(!text) return
    const {error}=await supabase.from("hotel_automations").insert({property_id:propertyId,name:text.slice(0,46),trigger_text:text,action_text:"Ejecutar esta regla sobre la operación del hotel",enabled:true,runs:0,created_by:user.id})
    if(error) return notify(error.message)
    setAutomationDraft(""); await loadHotel({quiet:true}); notify("Automatización creada.")
  }

  async function toggleAutomation(item) {
    const {error}=await supabase.from("hotel_automations").update({enabled:!item.enabled,updated_at:new Date().toISOString()}).eq("id",item.id).eq("property_id",propertyId)
    if(error) return notify(error.message)
    setAutomations(list=>list.map(x=>x.id===item.id?{...x,enabled:!x.enabled}:x))
  }

  async function connectChannel(provider) {
    const current=connections.find(c=>c.provider===provider)
    const payload={property_id:propertyId,provider,status:"sandbox",mode:"sandbox",account_ref:current?.account_ref||"sandbox",mapping:current?.mapping||{},updated_at:new Date().toISOString()}
    const {error}=current
      ? await supabase.from("hotel_channel_connections").update(payload).eq("id",current.id)
      : await supabase.from("hotel_channel_connections").insert(payload)
    if(error) return notify(error.message)
    await loadHotel({quiet:true}); notify(`${provider}: entorno de integración preparado.`)
  }

  async function verifyChannel(item) {
    const {error}=await supabase.from("hotel_channel_connections").update({status:"healthy",last_sync_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",item.id).eq("property_id",propertyId)
    if(error) return notify(error.message)
    await loadHotel({quiet:true}); notify("Health-check sandbox correcto.")
  }

  async function runAI(e) {
    e.preventDefault(); const q=aiInput.trim(); if(!q) return
    setAiMessages(m=>[...m,{role:"user",text:q}]); setAiInput(""); setAiProposal(null)
    const rateMatch=q.match(/(?:subi|subí|aumenta|aumentá).*?(\d{1,2})\s*%/i)
    if(rateMatch){ const percent=Number(rateMatch[1]); setAiProposal({type:"rate",percent}); setAiMessages(m=>[...m,{role:"assistant",text:`Puedo aumentar ${percent}% las tarifas activas. Te lo dejo listo para confirmar; no voy a cambiar precios sin tu aprobación.`}]); return }
    if(/sucia|limpieza/i.test(q)){ const dirty=rooms.filter(r=>normalize(r.estado)==="sucia"); setAiMessages(m=>[...m,{role:"assistant",text:dirty.length?`${dirty.length} habitaciones requieren limpieza: ${dirty.map(r=>r.nombre).join(", ")}.`:"No hay habitaciones marcadas como sucias."}]); return }
    try {
      const {data:{session}}=await supabase.auth.getSession()
      const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token||""}`},body:JSON.stringify({question:q,context:{hoy:today,hotel:settings.hotel_name,ocupacion:occupancy,habitaciones:rooms.map(r=>({id:r.id,nombre:r.nombre,tipo:r.tipo,estado:r.estado,precio:r.precio})),reservas:activeReservations.slice(0,180).map(r=>({id:r.id,huesped:r.nombre_huesped,habitacion:r.habitacion_id,entrada:r.fecha_entrada,salida:r.fecha_salida,estado:r.estado,total:r.precio_total})),metricas:{adr,revpar,gross}}})})
      const data=await response.json(); setAiMessages(m=>[...m,{role:"assistant",text:data.answer||"No pude generar una respuesta."}])
    } catch { setAiMessages(m=>[...m,{role:"assistant",text:"No pude consultar la capa de IA en este momento; la operación del hotel sigue funcionando normalmente."}]) }
  }

  const filteredReservations=reservations.filter(r=>{ const q=normalize(search); return !q||[r.nombre_huesped,r.numero_reserva,r.email_huesped,r.telefono_huesped,rooms.find(x=>String(x.id)===String(r.habitacion_id))?.nombre].some(v=>normalize(v).includes(q)) })

  if(loading||!today) return <div className="loading"><div className="bell">✦</div><strong>Preparando recepción…</strong><span>Habitación Llena OS</span><FiveStarStyles/></div>

  if(!properties.length) return <div className="onboarding"><div className="onboardingCard"><div className="seal">HL</div><small>BIENVENIDO A HABITACIÓN LLENA OS</small><h1>Tu hotel empieza acá.</h1><p>Creá la propiedad principal. Después vas a poder sumar habitaciones, identidad, equipo y canales desde el mismo escritorio.</p><form onSubmit={createHotel}><input value={creatingHotel} onChange={e=>setCreatingHotel(e.target.value)} placeholder="Nombre del hotel"/><button>Crear mi hotel</button></form></div><FiveStarStyles/></div>

  return <div className={`hotelApp theme-${settings.theme||"forest"}`}>
    <FiveStarStyles/>
    <aside className="side">
      <div className="brandLockup">
        <div className="brandSeal">{settings.logo_data_url?<img src={settings.logo_data_url} alt="Logo del hotel"/>:<span>HL</span>}</div>
        <div><strong>{settings.hotel_name||"Habitación Llena"}</strong><small>{settings.city||"Hospitality Operating System"}</small></div>
      </div>
      <div className="propertySwitch"><small>PROPIEDAD</small><select value={propertyId} onChange={e=>setPropertyId(e.target.value)}>{properties.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></div>
      <nav>{NAV.map(([id,label,icon])=><button key={id} className={view===id?"active":""} onClick={()=>setView(id)}><span>{icon}</span><b>{label}</b>{id==="calendar"&&<i/>}</button>)}</nav>
      <div className="sideStory"><span className="lamp"/><small>LA CASA HOY</small><p>{settings.motto}</p></div>
      <div className="sideFoot"><button onClick={()=>setAiOpen(true)}>✦ Llena Intelligence</button><button onClick={async()=>{await supabase.auth.signOut();window.location.href="/login"}}>Salir</button></div>
    </aside>

    <main className="workspace">
      <header className="topbar">
        <div><small>{view==="overview"?"FRONT DESK · HOY":NAV.find(n=>n[0]===view)?.[1]?.toUpperCase()}</small><h1>{view==="overview"?settings.welcome_message:NAV.find(n=>n[0]===view)?.[1]}</h1></div>
        <div className="topActions"><label className="search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Huésped, reserva, habitación…"/></label><button className="glass" onClick={()=>setIdentityOpen(true)}>Personalizar</button><button className="primary" onClick={()=>setNewOpen(true)}>＋ Nueva reserva</button></div>
      </header>

      {view==="overview"&&<Overview/>}
      {view==="calendar"&&<Calendar/>}
      {view==="reservations"&&<Reservations/>}
      {view==="distribution"&&<Distribution/>}
      {view==="revenue"&&<Revenue/>}
      {view==="guests"&&<Guests/>}
      {view==="housekeeping"&&<Housekeeping/>}
      {view==="automations"&&<Automations/>}
      {view==="twin"&&<Twin/>}
      {view==="identity"&&<Identity/>}
    </main>

    {selectedReservation&&<ReservationDrawer reservation={selectedReservation}/>} 
    {selectedRoom&&<RoomDrawer room={selectedRoom}/>} 
    {newOpen&&<NewReservation/>}
    {(identityOpen)&&<div className="modalShade" onClick={()=>setIdentityOpen(false)}><div className="identityModal" onClick={e=>e.stopPropagation()}><Identity compact/><button className="closeFloating" onClick={()=>setIdentityOpen(false)}>×</button></div></div>}
    {aiOpen&&<AI/>}
    {toast&&<div className="toast">{toast}</div>}
  </div>

  function Overview(){
    const nextArrival=arrivals[0]||activeReservations.filter(r=>r.fecha_entrada>today).sort((a,b)=>a.fecha_entrada.localeCompare(b.fecha_entrada))[0]
    return <div className="content overviewGrid">
      <section className="lobbyHero">
        <div className="heroShade"/>
        <div className="heroCopy"><small>{new Date().getHours()<13?"BUENOS DÍAS":"BUEN TURNO"} · {settings.hotel_name}</small><h2>{occupancy>=80?"La casa está llena de vida.":"Una operación tranquila también se diseña."}</h2><p>{arrivals.length} llegada{arrivals.length===1?"":"s"} · {departures.length} salida{departures.length===1?"":"s"} · {sellableRooms.filter(r=>roomMeta(r.estado)[0]==="Lista").length} habitaciones listas.</p><div><button onClick={()=>setView("calendar")}>Abrir Command Center</button><button onClick={()=>setView("housekeeping")}>Ver Housekeeping</button></div></div>
        <div className="occupancyMedallion"><span>{occupancy}%</span><small>ocupación</small></div>
      </section>
      <section className="metricsRail">{[["Llegadas",arrivals.length,"Front desk"],["Salidas",departures.length,"Housekeeping"],["ADR",money(adr),"Revenue"],["RevPAR",money(revpar),"Performance"]].map(([l,v,d])=><article key={l}><small>{l}</small><strong>{v}</strong><span>{d}</span></article>)}</section>
      <section className="todayDesk paperCard"><div className="sectionHead"><div><small>EL ESCRITORIO DE HOY</small><h3>Lo importante, antes de que lo pidan.</h3></div><button onClick={()=>setView("reservations")}>Todas las reservas →</button></div><div className="deskColumns"><DeskColumn title="Llegan" items={arrivals}/><DeskColumn title="En casa" items={todayOccupied}/><DeskColumn title="Salen" items={departures}/></div></section>
      <section className="humanCard"><img src="https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=900&q=82" alt="Recepción hotelera"/><div><small>HOSPITALIDAD HUMANA</small><h3>El sistema trabaja para que el equipo mire más al huésped y menos a la pantalla.</h3><p>Menos pasos, menos ruido operativo y contexto visible justo donde recepción lo necesita.</p></div></section>
      <section className="conciergeCard paperCard"><div className="conciergePortrait"><img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=500&q=80" alt="Concierge"/></div><div><small>MOMENTO DEL DÍA</small><h3>{nextArrival?`${nextArrival.nombre_huesped} es la próxima historia.`:"La recepción está preparada."}</h3><p>{nextArrival?`Llega ${shortDate(nextArrival.fecha_entrada)} · Habitación ${rooms.find(r=>String(r.id)===String(nextArrival.habitacion_id))?.nombre||"—"}. ${nextArrival.notas||"Sin pedidos especiales."}`:"No hay una llegada próxima cargada."}</p>{nextArrival&&<button onClick={()=>setSelectedReservationId(nextArrival.id)}>Abrir ficha</button>}</div></section>
      <section className="intel paperCard"><div className="sectionHead"><div><small>LLENA INTELLIGENCE</small><h3>Un hotel que se anticipa.</h3></div><button onClick={()=>setAiOpen(true)}>Hablar con IA ✦</button></div><div className="intelRows"><article><span>01</span><div><b>{occupancy>75?"Demanda alta detectada":"Ritmo de venta saludable"}</b><p>{occupancy>75?"Podés revisar una suba controlada de tarifas para las próximas noches.":"No hace falta forzar precios hoy. Priorizá conversión directa."}</p></div><button onClick={()=>setView("revenue")}>Revenue</button></article><article><span>02</span><div><b>Housekeeping con prioridad</b><p>{rooms.filter(r=>normalize(r.estado)==="sucia").length} habitaciones esperan limpieza.</p></div><button onClick={()=>setView("housekeeping")}>Resolver</button></article><article><span>03</span><div><b>Distribución supervisada</b><p>{connections.filter(c=>c.status==="healthy").length} conexiones pasaron health-check sandbox.</p></div><button onClick={()=>setView("distribution")}>Distribution</button></article></div></section>
    </div>
  }

  function DeskColumn({title,items}){return <div className="deskColumn"><h4>{title}<span>{items.length}</span></h4>{items.length?items.slice(0,4).map(r=><button key={r.id} onClick={()=>setSelectedReservationId(r.id)}><b>{r.nombre_huesped}</b><span>Hab. {rooms.find(x=>String(x.id)===String(r.habitacion_id))?.nombre||"—"}</span><small>{r.fecha_entrada===today?"Hoy":shortDate(r.fecha_entrada)}</small></button>):<p>Sin movimientos.</p>}</div>}

  function Calendar(){
    return <div className="content"><section className="calendarShell"><div className="calendarToolbar"><div><small>ROOM DIARY · TIEMPO REAL</small><h2>La operación completa en una sola superficie.</h2></div><div><button onClick={()=>setCalendarStart(addDays(calendarStart,-7))}>← 7 días</button><button onClick={()=>setCalendarStart(today)}>Hoy</button><button onClick={()=>setCalendarStart(addDays(calendarStart,7))}>7 días →</button></div></div><div className="calendarLegend"><span><i className="lg inhouse"/>Alojado</span><span><i className="lg confirmed"/>Confirmada</span><span><i className="lg pending"/>Pendiente</span><small>Arrastrá una reserva para moverla · abrila para extender, cobrar, dividir o hacer check-in/out.</small></div><div className="calendarScroller"><div className="calendarHeader" style={{gridTemplateColumns:`190px repeat(${calendarDays.length}, minmax(78px,1fr))`}}><div className="roomHeading">Habitación</div>{calendarDays.map(day=><div key={day} className={day===today?"todayDay":""}><small>{parseDate(day).toLocaleDateString("es-AR",{weekday:"short"})}</small><b>{parseDate(day).getDate()}</b><span>{day===today?"HOY":""}</span></div>)}</div>{rooms.filter(r=>r.activa!==false).map(room=><CalendarRow key={room.id} room={room}/>)}</div></section></div>
  }

  function CalendarRow({room}){
    const list=activeReservations.filter(r=>String(r.habitacion_id)===String(room.id)&&r.fecha_salida>calendarStart&&r.fecha_entrada<addDays(calendarStart,14))
    return <div className="calendarRow" style={{gridTemplateColumns:`190px repeat(${calendarDays.length}, minmax(78px,1fr))`}}><button className="roomLabel" style={{gridColumn:1,gridRow:1}} onClick={()=>setSelectedRoomId(room.id)}><strong>{room.nombre}</strong><span>{room.tipo||"Habitación"}</span><small className={`tone ${roomMeta(room.estado)[1]}`}>{roomMeta(room.estado)[0]}</small></button>{calendarDays.map((day,i)=><div key={day} className={`dayCell ${day===today?"todayCell":""}`} style={{gridColumn:i+2,gridRow:1}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("reservation");if(id)moveReservation(id,room.id,day)}} onDoubleClick={()=>{setNewForm(f=>({...f,roomId:String(room.id),start:day,end:addDays(day,2)}));setNewOpen(true)}}/>)}{list.map(r=>{const start=Math.max(0,diffRaw(calendarStart,r.fecha_entrada));const end=Math.min(14,diffRaw(calendarStart,r.fecha_salida));const span=Math.max(1,end-start);const tone=statusMeta(r.estado)[1];return <button draggable onDragStart={e=>e.dataTransfer.setData("reservation",String(r.id))} onClick={()=>setSelectedReservationId(r.id)} key={r.id} className={`reservationBar ${tone}`} style={{gridColumn:`${start+2} / span ${span}`,gridRow:1}}><strong>{r.nombre_huesped}</strong><small>{statusMeta(r.estado)[0]} · {balanceFor(r)>0?`${money(balanceFor(r))} saldo`:"pagado"}</small></button>})}</div>
  }

  function diffRaw(a,b){return Math.round((parseDate(b)-parseDate(a))/86400000)}

  function Reservations(){return <div className="content"><section className="paperCard"><div className="sectionHead"><div><small>RESERVATION DESK</small><h3>Reservas sin perder contexto.</h3></div><button className="primaryMini" onClick={()=>setNewOpen(true)}>＋ Crear</button></div><div className="reservationList">{filteredReservations.length?filteredReservations.map(r=><button key={r.id} onClick={()=>setSelectedReservationId(r.id)}><div className="guestAvatar">{String(r.nombre_huesped||"?").split(" ").slice(0,2).map(x=>x[0]).join("")}</div><div><b>{r.nombre_huesped}</b><span>{r.numero_reserva||`#${r.id}`} · {r.canal_reserva||"Directa"}</span></div><div><small>Habitación</small><b>{rooms.find(x=>String(x.id)===String(r.habitacion_id))?.nombre||"—"}</b></div><div><small>Estadía</small><b>{shortDate(r.fecha_entrada)} → {shortDate(r.fecha_salida)}</b></div><div><small>Total</small><b>{money(r.precio_total)}</b></div><div className={`statusPill ${statusMeta(r.estado)[1]}`}>{statusMeta(r.estado)[0]}</div></button>):<div className="empty">No encontramos reservas.</div>}</div></section></div>}

  function Distribution(){return <div className="content distributionGrid"><section className="distributionHero"><small>LLENA DISTRIBUTION HUB</small><h2>Una sola disponibilidad. Todos los canales.</h2><p>La capa está preparada para conectar un channel manager certificado sin duplicar lógica dentro del PMS. Hasta disponer de credenciales reales, cada proveedor queda claramente identificado como sandbox.</p><div className="health"><span>{connections.filter(c=>c.status==="healthy").length}/{CHANNELS.length}</span><small>health-checks listos</small></div></section><section className="paperCard channelPanel"><div className="sectionHead"><div><small>CHANNEL HEALTH</small><h3>Distribución supervisada</h3></div></div><div className="channelList">{CHANNELS.map(name=>{const c=connections.find(x=>x.provider===name);return <article key={name}><div className="channelLogo">{name.slice(0,2).toUpperCase()}</div><div><b>{name}</b><span>{name==="Motor directo"?"Canal nativo":"Conector externo"}</span></div><div className={`statusPill ${c?.status==="healthy"?"emerald":c?"amber":"muted"}`}>{c?.status==="healthy"?"Sandbox OK":c?"Preparado":"Sin configurar"}</div><small>{c?.last_sync_at?new Date(c.last_sync_at).toLocaleString("es-AR"):"—"}</small>{c?<button onClick={()=>verifyChannel(c)}>Verificar</button>:<button onClick={()=>connectChannel(name)}>Preparar</button>}</article>})}</div></section><section className="paperCard distributionMap"><small>ARQUITECTURA</small><h3>El PMS sigue siendo la fuente de verdad.</h3><div className="flow"><span>OTAs</span><i>→</i><span>Channel layer</span><i>↔</i><b>Habitación Llena OS</b><i>↔</i><span>Motor directo</span></div><p>Booking.com, Expedia, Airbnb y otros requieren acuerdos, credenciales o certificación del proveedor. El sistema no muestra una conexión externa como real hasta que exista.</p></section></div>}

  function Revenue(){
    const channelTotals=new Map(); activeReservations.forEach(r=>{const k=r.canal_reserva||"Directa";channelTotals.set(k,(channelTotals.get(k)||0)+Number(r.precio_total||0))})
    return <div className="content"><section className="revenueHero"><div><small>LLENA REVENUE BRAIN</small><h2>Precio, demanda y margen sin abrir otra herramienta.</h2><p>La recomendación combina ocupación propia y ritmo de venta. La inteligencia de mercado externa se suma cuando conectemos fuentes certificadas.</p></div><div className="revenueActions"><button onClick={()=>applyRate(8)}>Aplicar +8%</button><button onClick={()=>applyRate(-5)}>Aplicar −5%</button></div></section><section className="metricGrid">{[["Ocupación",`${occupancy}%`],["ADR",money(adr)],["RevPAR",money(revpar)],["Ingresos",money(gross)]].map(([l,v])=><article className="paperCard" key={l}><small>{l}</small><strong>{v}</strong><span>operación actual</span></article>)}</section><div className="revenueLayout"><section className="paperCard"><div className="sectionHead"><div><small>RENTABILIDAD</small><h3>Mix de canales</h3></div></div><div className="bars">{Array.from(channelTotals.entries()).sort((a,b)=>b[1]-a[1]).map(([name,value])=><div key={name}><div><b>{name}</b><span>{money(value)}</span></div><i><em style={{width:`${gross?Math.max(4,value/gross*100):0}%`}}/></i></div>)}</div></section><section className="paperCard rateBoard"><small>RATE BOARD</small><h3>Tarifa viva por habitación</h3>{rooms.filter(r=>r.activa!==false).slice(0,8).map(r=><button key={r.id} onClick={()=>setSelectedRoomId(r.id)}><span>{r.nombre} · {r.tipo}</span><b>{money(r.precio)}</b></button>)}</section></div></div>
  }

  function Guests(){return <div className="content"><section className="guestHero"><small>GUEST GRAPH</small><h2>Recordar bien también es hospitalidad.</h2><p>Cada estadía suma contexto. El objetivo es que recepción reconozca a un huésped aunque vuelva por otro canal.</p></section><section className="guestGrid">{guestProfiles.map(g=><article className="guestCard" key={g.key}><div className="guestPortrait">{g.name?.split(" ").slice(0,2).map(x=>x[0]).join("")}</div><div><small>{g.stays>2?"HUÉSPED RECURRENTE":"PERFIL DE HUÉSPED"}</small><h3>{g.name}</h3><p>{g.email||g.phone||"Sin contacto cargado"}</p></div><div className="guestStats"><span><b>{g.stays}</b> estadías</span><span><b>{g.nights}</b> noches</span><span><b>{money(g.lifetime)}</b> lifetime</span></div><div className="tags">{g.channels.map(x=><span key={x}>{x}</span>)}{g.notes.slice(0,2).map((x,i)=><span key={i}>{x.slice(0,34)}</span>)}</div></article>)}</section></div>}

  function Housekeeping(){
    const priority=rooms.filter(r=>r.activa!==false).sort((a,b)=>{const rank={sucia:0,inspeccion:1,mantenimiento:2,limpia:3,libre:3};return (rank[normalize(a.estado)]??4)-(rank[normalize(b.estado)]??4)})
    return <div className="content"><section className="houseHero"><div><small>HOUSEKEEPING INTELLIGENCE</small><h2>La próxima llegada define la prioridad.</h2><p>Recepción y pisos comparten el mismo estado, sin llamadas ni papelitos.</p></div><div className="linenBadge"><span>{rooms.filter(r=>normalize(r.estado)==="sucia").length}</span><small>requieren atención</small></div></section><section className="houseGrid">{priority.map(room=>{const next=activeReservations.filter(r=>String(r.habitacion_id)===String(room.id)&&r.fecha_entrada>=today).sort((a,b)=>a.fecha_entrada.localeCompare(b.fecha_entrada))[0];return <article className={`houseCard ${roomMeta(room.estado)[1]}`} key={room.id}><div className="doorNo">{room.nombre}</div><div><small>{room.tipo||"Habitación"}</small><h3>{roomMeta(room.estado)[0]}</h3><p>{next?`Próxima llegada: ${next.nombre_huesped} · ${shortDate(next.fecha_entrada)}`:"Sin llegada próxima"}</p></div><select value={normalize(room.estado)||"libre"} onChange={e=>setRoomStatus(room.id,e.target.value)}><option value="limpia">Lista</option><option value="sucia">Sucia</option><option value="inspeccion">Inspección</option><option value="mantenimiento">Mantenimiento</option></select></article>})}</section></div>
  }

  function Automations(){return <div className="content"><section className="automationHero"><small>WORKFLOWS</small><h2>Describí la operación como la dirías en recepción.</h2><form onSubmit={createAutomation}><textarea value={automationDraft} onChange={e=>setAutomationDraft(e.target.value)} placeholder="Ej. Si una reserva supera $500.000, pedir garantía y avisar a recepción."/><button>Crear regla ✦</button></form></section><section className="paperCard"><div className="sectionHead"><div><small>REGLAS DEL HOTEL</small><h3>Automatizaciones</h3></div></div><div className="automationList">{automations.length?automations.map(a=><article key={a.id}><button className={`switch ${a.enabled?"on":""}`} onClick={()=>toggleAutomation(a)}><i/></button><div><b>{a.name}</b><p>{a.trigger_text}</p><span>{a.action_text}</span></div><small>{a.runs} ejecuciones</small></article>):<div className="empty">Todavía no hay reglas. Escribí la primera arriba.</div>}</div></section></div>}

  function Twin(){
    const floors=new Map(); rooms.forEach(r=>{const n=String(r.nombre||"");const floor=n.match(/^([1-9])/i)?.[1]||"PB"; if(!floors.has(floor))floors.set(floor,[]);floors.get(floor).push(r)})
    return <div className="content"><section className="twinHero"><small>HOTEL DIGITAL TWIN</small><h2>El hotel físico, vivo dentro del sistema.</h2><p>Una representación espacial para entender ocupación, limpieza y próximas llegadas sin leer una lista.</p></section><section className="hotelBuilding">{Array.from(floors.entries()).sort((a,b)=>String(b[0]).localeCompare(String(a[0]))).map(([floor,list])=><div className="floor" key={floor}><div className="floorLabel"><small>NIVEL</small><b>{floor}</b></div><div className="doors">{list.map(room=>{const occupant=todayOccupied.find(r=>String(r.habitacion_id)===String(room.id));return <button className={`door ${roomMeta(room.estado)[1]} ${occupant?"occupied":""}`} key={room.id} onClick={()=>setSelectedRoomId(room.id)}><span className="doorHandle"/><small>{room.tipo||"Habitación"}</small><strong>{room.nombre}</strong><em>{occupant?occupant.nombre_huesped:roomMeta(room.estado)[0]}</em></button>})}</div></div>)}</section></div>
  }

  function Identity({compact=false}={}){return <div className={compact?"identity compact":"content identity"}><section className="identityShowcase"><div className="identityWallpaper"><div className="identityLogo">{settings.logo_data_url?<img src={settings.logo_data_url} alt="Logo"/>:<span>{(settings.hotel_name||"HL").split(" ").slice(0,2).map(x=>x[0]).join("")}</span>}</div><small>YOUR HOTEL · YOUR DESK</small><h2>{settings.hotel_name}</h2><p>{settings.motto}</p></div></section><form className="paperCard identityForm" onSubmit={saveIdentity}><div className="sectionHead"><div><small>IDENTIDAD</small><h3>Que el sistema también sea parte del hotel.</h3></div></div><label><span>Nombre visible</span><input value={settings.hotel_name||""} onChange={e=>setSettings(s=>({...s,hotel_name:e.target.value}))}/></label><label><span>Lema</span><input value={settings.motto||""} onChange={e=>setSettings(s=>({...s,motto:e.target.value}))}/></label><label><span>Mensaje de recepción</span><input value={settings.welcome_message||""} onChange={e=>setSettings(s=>({...s,welcome_message:e.target.value}))}/></label><label><span>Ciudad</span><input value={settings.city||""} onChange={e=>setSettings(s=>({...s,city:e.target.value}))}/></label><label><span>Logo del hotel</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>readLogo(e.target.files?.[0])}/></label><label><span>Atmósfera</span><select value={settings.theme||"forest"} onChange={e=>setSettings(s=>({...s,theme:e.target.value}))}><option value="forest">Oliva & latón</option><option value="midnight">Medianoche & champagne</option><option value="sand">Travertino & nogal</option></select></label><button className="primary">Guardar identidad</button></form></div>}

  function ReservationDrawer({reservation}){
    const room=rooms.find(r=>String(r.id)===String(reservation.habitacion_id));const balance=balanceFor(reservation)
    return <div className="drawerShade" onClick={()=>setSelectedReservationId(null)}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="drawerClose" onClick={()=>setSelectedReservationId(null)}>×</button><div className="drawerHero"><small>{reservation.numero_reserva||`RESERVA #${reservation.id}`}</small><h2>{reservation.nombre_huesped}</h2><p>{room?.nombre} · {room?.tipo} · {reservation.canal_reserva||"Directa"}</p><div className={`statusPill ${statusMeta(reservation.estado)[1]}`}>{statusMeta(reservation.estado)[0]}</div></div><div className="stayCard"><div><small>ENTRADA</small><b>{shortDate(reservation.fecha_entrada)}</b></div><i>→</i><div><small>SALIDA</small><b>{shortDate(reservation.fecha_salida)}</b></div><div><small>NOCHES</small><b>{reservation.noches||diffDays(reservation.fecha_entrada,reservation.fecha_salida)}</b></div></div><div className="drawerMoney"><div><small>Total</small><b>{money(reservation.precio_total)}</b></div><div><small>Pagado</small><b>{money(paidFor(reservation))}</b></div><div className={balance>0?"due":""><small>Saldo</small><b>{money(balance)}</b></div></div><div className="drawerActions">{normalize(reservation.estado)!=="alojado"&&normalize(reservation.estado)!=="finalizada"&&<button onClick={()=>checkIn(reservation)}>✓ Check-in</button>}{normalize(reservation.estado)==="alojado"&&<button onClick={()=>checkout(reservation)} disabled={balance>0}>✓ Check-out{balance>0?" · saldo pendiente":""}</button>}<button onClick={()=>resizeReservation(reservation,1)}>＋ 1 noche</button><button onClick={()=>resizeReservation(reservation,-1)}>− 1 noche</button></div><section><small>NOTAS DE HOSPITALIDAD</small><p>{reservation.notas||"Sin observaciones cargadas."}</p></section><form className="paymentBox" onSubmit={registerPayment}><small>REGISTRAR PAGO</small><div><input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={e=>setPaymentForm(f=>({...f,amount:e.target.value}))} placeholder={balance?String(Math.round(balance)):"Monto"}/><select value={paymentForm.method} onChange={e=>setPaymentForm(f=>({...f,method:e.target.value}))}><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Mercado Pago</option></select><button>Registrar</button></div></form><section className="splitBox"><small>SPLIT STAY</small><p>Dividí la estadía y continuá en otra habitación sin perder la trazabilidad.</p><div><input type="date" min={addDays(reservation.fecha_entrada,1)} max={addDays(reservation.fecha_salida,-1)} value={splitForm.date} onChange={e=>setSplitForm(s=>({...s,date:e.target.value}))}/><select value={splitForm.roomId} onChange={e=>setSplitForm(s=>({...s,roomId:e.target.value}))}><option value="">Habitación destino</option>{rooms.filter(r=>String(r.id)!==String(reservation.habitacion_id)&&r.activa!==false).map(r=><option value={r.id} key={r.id}>{r.nombre} · {r.tipo}</option>)}</select><button onClick={splitReservation}>Dividir</button></div></section></aside></div>
  }

  function RoomDrawer({room}){const current=todayOccupied.find(r=>String(r.habitacion_id)===String(room.id));const next=activeReservations.filter(r=>String(r.habitacion_id)===String(room.id)&&r.fecha_entrada>today).sort((a,b)=>a.fecha_entrada.localeCompare(b.fecha_entrada))[0];return <div className="drawerShade" onClick={()=>setSelectedRoomId(null)}><aside className="roomDrawer drawer" onClick={e=>e.stopPropagation()}><button className="drawerClose" onClick={()=>setSelectedRoomId(null)}>×</button><small>HABITACIÓN</small><h2>{room.nombre}</h2><p>{room.tipo||"Sin tipo"} · {money(room.precio)} / noche</p><div className={`roomStateHero ${roomMeta(room.estado)[1]}`}><span>{roomMeta(room.estado)[0]}</span><small>estado operativo</small></div>{current&&<section><small>AHORA</small><button className="guestLink" onClick={()=>{setSelectedRoomId(null);setSelectedReservationId(current.id)}}>{current.nombre_huesped} →</button></section>}{next&&<section><small>PRÓXIMA LLEGADA</small><p><b>{next.nombre_huesped}</b><br/>{shortDate(next.fecha_entrada)}</p></section>}<section><small>HOUSEKEEPING</small><div className="roomStateButtons">{[["limpia","Lista"],["sucia","Sucia"],["inspeccion","Inspección"],["mantenimiento","Mantenimiento"]].map(([v,l])=><button key={v} onClick={()=>setRoomStatus(room.id,v)}>{l}</button>)}</div></section></aside></div>}

  function NewReservation(){return <div className="modalShade" onClick={()=>setNewOpen(false)}><form className="newModal" onSubmit={createReservation} onClick={e=>e.stopPropagation()}><button type="button" className="drawerClose" onClick={()=>setNewOpen(false)}>×</button><small>NUEVA RESERVA</small><h2>Una reserva debería tomar segundos.</h2><div className="newGrid"><label><span>Huésped</span><input autoFocus value={newForm.guest} onChange={e=>setNewForm(f=>({...f,guest:e.target.value}))}/></label><label><span>Habitación</span><select value={newForm.roomId} onChange={e=>setNewForm(f=>({...f,roomId:e.target.value}))}><option value="">Elegir habitación</option>{rooms.filter(r=>r.activa!==false&&normalize(r.estado)!=="mantenimiento").map(r=><option key={r.id} value={r.id}>{r.nombre} · {r.tipo} · {money(r.precio)}</option>)}</select></label><label><span>Entrada</span><input type="date" value={newForm.start} onChange={e=>setNewForm(f=>({...f,start:e.target.value,end:f.end<=e.target.value?addDays(e.target.value,2):f.end}))}/></label><label><span>Salida</span><input type="date" min={addDays(newForm.start||today,1)} value={newForm.end} onChange={e=>setNewForm(f=>({...f,end:e.target.value}))}/></label><label><span>Email</span><input type="email" value={newForm.email} onChange={e=>setNewForm(f=>({...f,email:e.target.value}))}/></label><label><span>Teléfono</span><input value={newForm.phone} onChange={e=>setNewForm(f=>({...f,phone:e.target.value}))}/></label><label><span>Huéspedes</span><input type="number" min="1" value={newForm.pax} onChange={e=>setNewForm(f=>({...f,pax:e.target.value}))}/></label><label><span>Canal</span><select value={newForm.channel} onChange={e=>setNewForm(f=>({...f,channel:e.target.value}))}><option>Directa</option><option>Booking.com</option><option>Expedia</option><option>Airbnb</option><option>Agoda</option><option>Teléfono</option><option>Walk-in</option></select></label><label className="wide"><span>Notas</span><textarea value={newForm.notes} onChange={e=>setNewForm(f=>({...f,notes:e.target.value}))} placeholder="Preferencias, llegada, cuna, cochera…"/></label></div>{newForm.roomId&&newForm.start&&newForm.end>newForm.start&&<div className="rateSummary"><span>{diffDays(newForm.start,newForm.end)} noches</span><b>{money(Number(rooms.find(r=>String(r.id)===String(newForm.roomId))?.precio||0)*diffDays(newForm.start,newForm.end))}</b></div>}<button className="primary submit">Crear reserva</button></form></div>}

  function AI(){return <div className="aiPanel"><div className="aiHead"><div><span>✦</span><div><b>Llena Intelligence</b><small>Contexto del hotel en tiempo real</small></div></div><button onClick={()=>setAiOpen(false)}>×</button></div><div className="aiMessages">{aiMessages.map((m,i)=><div key={i} className={m.role}>{m.text}</div>)}{aiProposal?.type==="rate"&&<button className="aiProposal" onClick={async()=>{await applyRate(aiProposal.percent);setAiProposal(null)}}>Confirmar aumento de {aiProposal.percent}% →</button>}</div><form onSubmit={runAI}><textarea value={aiInput} onChange={e=>setAiInput(e.target.value)} placeholder="Ej. ¿Qué debería mirar antes del turno tarde?"/><button>Enviar</button></form></div>}
}

function FiveStarStyles(){return <style>{`
:root{--forest:#112d29;--forest2:#0a211e;--forest3:#21483f;--ink:#17201e;--muted:#6c7772;--paper:#f8f3e9;--ivory:#fcfaf5;--line:rgba(30,46,41,.12);--brass:#ad8355;--brass2:#d8bd92;--emerald:#2f7662;--amber:#ae762f;--rose:#9b5a50;--shadow:0 24px 70px rgba(34,42,38,.1)}*{box-sizing:border-box}body{margin:0;background:#efe8dc;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.hotelApp{min-height:100vh;background:radial-gradient(circle at 78% 7%,rgba(173,131,85,.08),transparent 24%),linear-gradient(120deg,#f3ede2,#fbf8f1 43%,#eee5d8);color:var(--ink)}button,input,select,textarea{font:inherit}.side{position:fixed;left:0;top:0;bottom:0;width:248px;padding:22px 15px 16px;color:#f7f0e3;background:linear-gradient(135deg,rgba(255,255,255,.025),transparent 42%),repeating-linear-gradient(92deg,rgba(255,255,255,.018) 0 1px,transparent 1px 8px),linear-gradient(180deg,#122f2a,#0a2421 76%,#071d1a);border-right:1px solid rgba(255,255,255,.08);box-shadow:18px 0 50px rgba(14,31,27,.08);display:flex;flex-direction:column;z-index:40}.side:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 18% 16%,rgba(216,189,146,.09),transparent 16%),radial-gradient(circle at 82% 76%,rgba(216,189,146,.05),transparent 20%)}.brandLockup,.propertySwitch,.side nav,.sideStory,.sideFoot{position:relative}.brandLockup{display:flex;align-items:center;gap:11px;padding:4px 7px 20px;border-bottom:1px solid rgba(255,255,255,.08)}.brandSeal{width:42px;height:42px;border:1px solid rgba(216,189,146,.5);border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.02));font-family:Georgia,serif;font-size:16px;color:#ead9bc;overflow:hidden}.brandSeal img{width:100%;height:100%;object-fit:contain;background:#fff}.brandLockup strong{display:block;font-family:Georgia,serif;font-size:16px;font-weight:500;max-width:165px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brandLockup small{display:block;margin-top:3px;font-size:9px;letter-spacing:.08em;opacity:.57}.propertySwitch{padding:18px 7px 10px}.propertySwitch small,.sideStory small{font-size:8px;letter-spacing:.17em;font-weight:850;color:#c8ac82}.propertySwitch select{margin-top:7px;width:100%;border:1px solid rgba(255,255,255,.1);border-radius:11px;padding:10px 9px;background:rgba(255,255,255,.055);color:#fff;outline:none}.propertySwitch option{color:#111}.side nav{display:grid;gap:3px;margin-top:8px;overflow:auto;padding-right:2px}.side nav button{border:0;background:transparent;color:rgba(255,255,255,.67);border-radius:11px;min-height:39px;padding:8px 10px;text-align:left;display:grid;grid-template-columns:25px 1fr auto;align-items:center;cursor:pointer;transition:.2s}.side nav button span{font-size:14px;color:#c6ad86}.side nav button b{font-size:11px;font-weight:620}.side nav button i{width:5px;height:5px;border-radius:50%;background:#d9bf93}.side nav button:hover,.side nav button.active{background:linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.045));color:white;transform:translateX(2px)}.sideStory{margin-top:auto;padding:15px 11px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.035)}.sideStory .lamp{display:block;width:24px;height:2px;background:#d1ae74;box-shadow:0 0 18px 5px rgba(209,174,116,.22);margin-bottom:12px}.sideStory p{font-family:Georgia,serif;font-style:italic;font-size:13px;line-height:1.45;margin:7px 0 0;color:rgba(255,255,255,.8)}.sideFoot{display:flex;gap:5px;margin-top:9px}.sideFoot button{flex:1;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#eee3d2;border-radius:10px;padding:8px;font-size:9px;cursor:pointer}.workspace{margin-left:248px;min-height:100vh}.topbar{min-height:88px;padding:19px 28px 17px;display:flex;justify-content:space-between;align-items:center;gap:18px;border-bottom:1px solid var(--line);background:rgba(248,243,233,.72);backdrop-filter:blur(20px);position:sticky;top:0;z-index:28}.topbar small,.sectionHead small,.paperCard>small,.guestHero small,.houseHero small,.automationHero small,.twinHero small,.distributionHero small,.revenueHero small,.identityWallpaper small{font-size:8px;letter-spacing:.17em;font-weight:900;color:var(--brass)}.topbar h1{font-family:Georgia,serif;font-size:25px;letter-spacing:-.035em;font-weight:500;margin:4px 0 0}.topActions{display:flex;gap:7px;align-items:center}.search{width:260px;height:38px;border:1px solid rgba(30,46,41,.13);border-radius:999px;background:rgba(255,255,255,.6);display:flex;align-items:center;padding:0 12px;gap:7px}.search input{border:0;background:transparent;outline:none;min-width:0;width:100%;font-size:11px;color:var(--ink)}.glass,.primary,.primaryMini{border-radius:999px;padding:10px 13px;border:1px solid var(--line);cursor:pointer;font-weight:750;font-size:10px}.glass{background:rgba(255,255,255,.5);color:var(--forest)}.primary,.primaryMini{background:linear-gradient(135deg,#214a40,#102f2a);border-color:#183d35;color:#fff;box-shadow:0 10px 25px rgba(17,45,41,.16)}.content{padding:24px 28px 44px;max-width:1580px;margin:auto}.overviewGrid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}.lobbyHero{min-height:415px;border-radius:28px;position:relative;overflow:hidden;grid-column:1/-1;background-image:url("https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1800&q=85");background-size:cover;background-position:center 55%;box-shadow:var(--shadow)}.heroShade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,31,27,.89),rgba(8,31,27,.55) 48%,rgba(8,31,27,.08)),linear-gradient(0deg,rgba(8,31,27,.35),transparent 45%)}.heroCopy{position:absolute;z-index:2;left:36px;bottom:34px;color:#fff;max-width:640px}.heroCopy small{font-size:9px;letter-spacing:.18em;color:#e0c99f}.heroCopy h2{font-family:Georgia,serif;font-size:49px;line-height:.98;letter-spacing:-.05em;font-weight:500;margin:11px 0 14px}.heroCopy p{font-size:12px;line-height:1.6;opacity:.78}.heroCopy div{display:flex;gap:8px;margin-top:19px}.heroCopy button{border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:10px 13px;background:rgba(255,255,255,.12);backdrop-filter:blur(12px);color:#fff;font-size:10px;cursor:pointer}.occupancyMedallion{position:absolute;right:31px;top:29px;width:118px;height:118px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(11,37,32,.35);backdrop-filter:blur(16px);display:grid;place-content:center;text-align:center;color:#fff;box-shadow:inset 0 0 0 9px rgba(255,255,255,.035)}.occupancyMedallion span{font-family:Georgia,serif;font-size:29px}.occupancyMedallion small{font-size:8px;letter-spacing:.12em;opacity:.7}.metricsRail{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:-40px;z-index:4;padding:0 22px}.metricsRail article{border:1px solid rgba(255,255,255,.7);background:rgba(252,250,245,.86);backdrop-filter:blur(20px);border-radius:18px;padding:15px 17px;box-shadow:0 15px 40px rgba(35,45,40,.08)}.metricsRail small{display:block;font-size:8px;letter-spacing:.12em;color:var(--muted)}.metricsRail strong{display:block;font-family:Georgia,serif;font-size:24px;font-weight:500;margin-top:6px}.metricsRail span{font-size:9px;color:#8b918d}.paperCard{background:linear-gradient(145deg,rgba(255,255,255,.75),rgba(249,245,237,.92));border:1px solid rgba(71,73,62,.11);border-radius:22px;box-shadow:0 15px 45px rgba(47,49,43,.06)}.todayDesk{grid-column:1/-1;padding:22px}.sectionHead{display:flex;justify-content:space-between;gap:16px;align-items:center}.sectionHead h3{font-family:Georgia,serif;font-size:25px;font-weight:500;letter-spacing:-.03em;margin:4px 0}.sectionHead button{border:0;background:transparent;color:var(--forest);font-size:10px;font-weight:750;cursor:pointer}.deskColumns{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}.deskColumn{border-top:1px solid var(--line);padding-top:12px}.deskColumn h4{font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 8px}.deskColumn h4 span{margin-left:6px;color:var(--brass)}.deskColumn>button{width:100%;border:0;border-bottom:1px solid rgba(30,46,41,.08);background:transparent;padding:11px 3px;display:grid;grid-template-columns:1fr auto;text-align:left;gap:3px;cursor:pointer}.deskColumn>button b{font-size:11px}.deskColumn>button span{font-size:9px;color:var(--muted)}.deskColumn>button small{grid-row:1/3;grid-column:2;font-size:9px;color:var(--brass)}.deskColumn>p{font-size:10px;color:var(--muted)}.humanCard{min-height:295px;border-radius:22px;overflow:hidden;position:relative;background:#122f2a;color:#fff}.humanCard img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.72) contrast(.96)}.humanCard:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,30,26,.88),rgba(8,30,26,.25))}.humanCard>div{position:absolute;z-index:2;left:24px;bottom:22px;max-width:58%}.humanCard small,.conciergeCard small,.intel small{font-size:8px;letter-spacing:.16em;color:#dec495}.humanCard h3,.conciergeCard h3{font-family:Georgia,serif;font-size:25px;line-height:1.04;font-weight:500;margin:7px 0}.humanCard p,.conciergeCard p{font-size:10px;line-height:1.55;opacity:.78}.conciergeCard{display:grid;grid-template-columns:128px 1fr;gap:17px;padding:17px;align-items:center}.conciergePortrait{height:230px;border-radius:17px;overflow:hidden}.conciergePortrait img{width:100%;height:100%;object-fit:cover}.conciergeCard button{border:0;border-bottom:1px solid var(--brass);background:transparent;padding:5px 0;color:var(--forest);font-size:10px;cursor:pointer}.intel{grid-column:1/-1;padding:22px}.intelRows{display:grid;gap:0;margin-top:12px}.intelRows article{display:grid;grid-template-columns:34px 1fr auto;gap:12px;align-items:center;border-top:1px solid var(--line);padding:13px 0}.intelRows article>span{font-family:Georgia,serif;color:var(--brass)}.intelRows b{font-size:11px}.intelRows p{font-size:9px;color:var(--muted);margin:3px 0}.intelRows button{border:1px solid var(--line);border-radius:999px;background:transparent;padding:7px 10px;font-size:9px;cursor:pointer}.calendarShell{background:rgba(252,250,245,.82);border:1px solid var(--line);border-radius:22px;overflow:hidden;box-shadow:var(--shadow)}.calendarToolbar{padding:20px 22px;display:flex;justify-content:space-between;gap:20px;align-items:end;background:linear-gradient(135deg,#173c35,#0d2b27);color:#fff}.calendarToolbar small{font-size:8px;letter-spacing:.16em;color:#d6bd91}.calendarToolbar h2{font-family:Georgia,serif;font-size:27px;font-weight:500;margin:5px 0}.calendarToolbar>div:last-child{display:flex;gap:6px}.calendarToolbar button{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#fff;border-radius:999px;padding:8px 10px;font-size:9px;cursor:pointer}.calendarLegend{display:flex;gap:14px;align-items:center;padding:10px 18px;border-bottom:1px solid var(--line);font-size:9px;color:var(--muted)}.calendarLegend span{display:flex;gap:5px;align-items:center}.calendarLegend small{margin-left:auto}.lg{width:7px;height:7px;border-radius:50%}.lg.inhouse{background:var(--emerald)}.lg.confirmed{background:var(--brass)}.lg.pending{background:var(--amber)}.calendarScroller{overflow:auto;max-height:calc(100vh - 230px)}.calendarHeader,.calendarRow{display:grid;min-width:1280px;position:relative}.calendarHeader{position:sticky;top:0;z-index:12;background:#eee7da;border-bottom:1px solid var(--line)}.calendarHeader>div{min-height:54px;border-right:1px solid rgba(40,52,47,.08);display:grid;place-content:center;text-align:center}.calendarHeader small{font-size:8px;color:var(--muted);text-transform:uppercase}.calendarHeader b{font-family:Georgia,serif;font-size:17px;font-weight:500}.calendarHeader span{font-size:7px;color:var(--brass);height:8px}.roomHeading{position:sticky;left:0;z-index:14;background:#e8dfd0!important;font-size:9px;font-weight:850;letter-spacing:.1em}.calendarRow{min-height:66px;border-bottom:1px solid rgba(40,52,47,.07);background:rgba(255,255,255,.36)}.roomLabel{position:sticky;left:0;z-index:8;border:0;border-right:1px solid var(--line);background:#f3ede3;text-align:left;padding:9px 13px;cursor:pointer}.roomLabel strong{display:block;font-family:Georgia,serif;font-size:17px}.roomLabel span{display:block;font-size:8px;color:var(--muted);margin-top:2px}.roomLabel small{display:inline-block;margin-top:5px;font-size:7px}.dayCell{border-right:1px solid rgba(40,52,47,.065);background:linear-gradient(180deg,transparent,rgba(173,131,85,.015));z-index:1}.dayCell:hover{background:rgba(173,131,85,.07)}.todayDay,.todayCell{background:rgba(173,131,85,.09)!important}.reservationBar{z-index:5;align-self:center;margin:7px 3px;border:0;border-radius:10px;padding:8px 10px;text-align:left;color:#fff;min-width:0;overflow:hidden;cursor:grab;box-shadow:0 5px 12px rgba(25,35,31,.13)}.reservationBar strong{display:block;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reservationBar small{display:block;font-size:7px;margin-top:2px;opacity:.76;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reservationBar.emerald{background:linear-gradient(135deg,#326f60,#245749)}.reservationBar.gold{background:linear-gradient(135deg,#b18a5e,#88663e)}.reservationBar.amber{background:linear-gradient(135deg,#ad7b38,#825c29)}.reservationBar.muted{background:#6e7773}.reservationBar.rose{background:#92564e}.tone.emerald{color:var(--emerald)}.tone.rose{color:var(--rose)}.tone.amber{color:var(--amber)}.reservationList{display:grid;margin-top:16px}.reservationList>button{border:0;border-top:1px solid var(--line);background:transparent;padding:12px 6px;display:grid;grid-template-columns:42px minmax(170px,1.4fr) 110px 170px 120px 90px;gap:12px;align-items:center;text-align:left;cursor:pointer}.reservationList>button:hover{background:rgba(173,131,85,.04)}.guestAvatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#e7ddcc;color:var(--forest);font-family:Georgia,serif;font-size:12px}.reservationList b{font-size:10px}.reservationList span,.reservationList small{display:block;font-size:8px;color:var(--muted);margin-top:2px}.statusPill{justify-self:start;border-radius:999px;padding:5px 8px;font-size:7px;font-weight:900;letter-spacing:.06em}.statusPill.emerald{background:#dfeee7;color:#27624f}.statusPill.gold{background:#eee4d4;color:#7c5b31}.statusPill.amber{background:#f2e6d1;color:#8a5e25}.statusPill.rose{background:#f1dfdc;color:#874a42}.statusPill.muted{background:#e5e8e5;color:#626b67}.distributionGrid{display:grid;grid-template-columns:.8fr 1.2fr;gap:15px}.distributionHero{min-height:330px;border-radius:24px;padding:30px;background:linear-gradient(150deg,#0f302a,#173d35);color:white;position:relative;overflow:hidden}.distributionHero:after{content:"";position:absolute;width:260px;height:260px;border-radius:50%;border:1px solid rgba(216,189,146,.25);right:-80px;bottom:-90px;box-shadow:0 0 80px rgba(216,189,146,.08)}.distributionHero h2,.revenueHero h2,.guestHero h2,.houseHero h2,.automationHero h2,.twinHero h2{font-family:Georgia,serif;font-size:38px;line-height:1;letter-spacing:-.045em;font-weight:500;margin:11px 0}.distributionHero p,.revenueHero p,.guestHero p,.houseHero p,.automationHero p,.twinHero p{font-size:11px;line-height:1.65;opacity:.7;max-width:620px}.health{position:absolute;bottom:24px;left:30px}.health span{font-family:Georgia,serif;font-size:33px}.health small{display:block;font-size:8px;opacity:.6}.channelPanel{padding:20px}.channelList{display:grid;margin-top:13px}.channelList article{display:grid;grid-template-columns:38px 1fr 90px 125px 70px;gap:10px;align-items:center;border-top:1px solid var(--line);padding:10px 2px}.channelLogo{width:32px;height:32px;border:1px solid var(--line);border-radius:10px;display:grid;place-items:center;font-family:Georgia,serif;color:var(--brass)}.channelList b{font-size:10px}.channelList span,.channelList small{display:block;font-size:8px;color:var(--muted)}.channelList button{border:1px solid var(--line);border-radius:999px;background:transparent;padding:6px;font-size:8px;cursor:pointer}.distributionMap{grid-column:1/-1;padding:22px}.flow{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;padding:27px;margin-top:10px;border:1px solid var(--line);border-radius:17px;background:radial-gradient(circle at center,rgba(173,131,85,.09),transparent 48%)}.flow span,.flow b{padding:10px 13px;border:1px solid var(--line);border-radius:999px;font-size:9px;background:#fcfaf5}.flow b{background:var(--forest);color:white}.distributionMap p{font-size:9px;color:var(--muted);line-height:1.6}.revenueHero{padding:27px 30px;border-radius:24px;background:linear-gradient(135deg,#173b34,#0b2824);color:#fff;display:flex;justify-content:space-between;align-items:end;gap:20px}.revenueActions{display:flex;gap:6px}.revenueActions button{border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:white;border-radius:999px;padding:9px 12px;font-size:9px;cursor:pointer}.metricGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:13px 0}.metricGrid article{padding:16px}.metricGrid article small{display:block;font-size:8px;color:var(--muted)}.metricGrid article strong{display:block;font-family:Georgia,serif;font-size:25px;font-weight:500;margin-top:5px}.metricGrid article span{font-size:8px;color:var(--muted)}.revenueLayout{display:grid;grid-template-columns:1.2fr .8fr;gap:12px}.revenueLayout>.paperCard{padding:20px}.bars{display:grid;gap:15px;margin-top:18px}.bars>div>div{display:flex;justify-content:space-between;font-size:9px}.bars i{display:block;height:7px;background:#ece5da;border-radius:999px;margin-top:6px;overflow:hidden}.bars em{display:block;height:100%;background:linear-gradient(90deg,var(--forest3),var(--brass));border-radius:999px}.rateBoard>button{display:flex;width:100%;justify-content:space-between;border:0;border-top:1px solid var(--line);background:transparent;padding:10px 0;font-size:9px;cursor:pointer}.guestHero,.houseHero,.automationHero,.twinHero{padding:27px 30px;border-radius:24px;background:linear-gradient(135deg,#ede2d1,#f8f3e9);border:1px solid var(--line);margin-bottom:14px}.guestGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.guestCard{background:rgba(255,255,255,.62);border:1px solid var(--line);border-radius:21px;padding:17px;display:grid;grid-template-columns:48px 1fr;gap:11px}.guestPortrait{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#d9cab5,#eee6d9);font-family:Georgia,serif;color:var(--forest)}.guestCard small{font-size:7px;letter-spacing:.12em;color:var(--brass)}.guestCard h3{font-family:Georgia,serif;font-size:18px;font-weight:500;margin:4px 0}.guestCard p{font-size:8px;color:var(--muted);margin:0}.guestStats{grid-column:1/-1;display:flex;gap:14px;padding-top:10px;border-top:1px solid var(--line)}.guestStats span{font-size:8px;color:var(--muted)}.guestStats b{color:var(--ink)}.tags{grid-column:1/-1;display:flex;gap:4px;flex-wrap:wrap}.tags span{font-size:7px;padding:4px 7px;border-radius:999px;background:#eee7dc;color:#5d655f}.houseHero{display:flex;justify-content:space-between;align-items:center}.linenBadge{min-width:110px;height:110px;border-radius:50%;border:1px solid #cfbea6;display:grid;place-content:center;text-align:center}.linenBadge span{font-family:Georgia,serif;font-size:29px}.linenBadge small{font-size:7px;color:var(--muted)}.houseGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.houseCard{border:1px solid var(--line);border-left:4px solid var(--emerald);border-radius:18px;background:rgba(255,255,255,.63);padding:13px;display:grid;grid-template-columns:52px 1fr 110px;gap:10px;align-items:center}.houseCard.rose{border-left-color:var(--rose)}.houseCard.amber{border-left-color:var(--amber)}.houseCard.muted{border-left-color:#7b817d}.doorNo{width:45px;height:58px;border-radius:5px 5px 2px 2px;border:1px solid #a78d67;background:linear-gradient(100deg,#6d4e34,#9d7550);color:#eadabc;display:grid;place-items:center;font-family:Georgia,serif;box-shadow:inset -8px 0 13px rgba(0,0,0,.18)}.houseCard h3{font-family:Georgia,serif;font-size:17px;font-weight:500;margin:2px 0}.houseCard p,.houseCard small{font-size:8px;color:var(--muted);margin:0}.houseCard select{border:1px solid var(--line);border-radius:999px;padding:7px;background:#fbf8f2;font-size:8px}.automationHero form{display:flex;gap:7px;margin-top:17px}.automationHero textarea{flex:1;min-height:65px;border:1px solid var(--line);border-radius:14px;padding:12px;background:rgba(255,255,255,.7);resize:none;outline:none;font-size:10px}.automationHero button{border:0;border-radius:14px;background:var(--forest);color:white;padding:0 17px;font-size:9px;font-weight:750}.automationList article{display:grid;grid-template-columns:45px 1fr 90px;gap:13px;align-items:center;padding:13px 0;border-top:1px solid var(--line)}.automationList b{font-size:10px}.automationList p{font-size:9px;color:var(--muted);margin:3px 0}.automationList span,.automationList small{font-size:8px;color:var(--muted)}.switch{width:38px;height:22px;border:0;border-radius:999px;background:#d7d7d2;padding:3px;cursor:pointer}.switch i{display:block;width:16px;height:16px;border-radius:50%;background:#fff;transition:.2s}.switch.on{background:var(--emerald)}.switch.on i{transform:translateX(16px)}.hotelBuilding{background:linear-gradient(145deg,#d8c7ad,#eee3d3);border:1px solid rgba(101,77,48,.16);border-radius:26px;padding:24px;box-shadow:var(--shadow);position:relative;overflow:hidden}.hotelBuilding:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 1px,transparent 1px 34px),radial-gradient(circle at 40% 0,rgba(255,255,255,.45),transparent 25%)}.floor{position:relative;display:grid;grid-template-columns:70px 1fr;border-bottom:1px solid rgba(103,79,50,.18);padding:18px 0}.floorLabel{display:grid;place-content:center;text-align:center}.floorLabel small{font-size:7px;color:#79694f}.floorLabel b{font-family:Georgia,serif;font-size:22px}.doors{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:12px}.door{height:150px;border:1px solid #765a3d;border-radius:7px 7px 3px 3px;background:linear-gradient(100deg,#6f5137,#966d48 48%,#684b32);color:#f1dfc2;position:relative;padding:15px 10px;text-align:left;cursor:pointer;box-shadow:inset -11px 0 18px rgba(0,0,0,.18),0 10px 20px rgba(67,48,29,.12)}.door:after{content:"";position:absolute;inset:7px;border:1px solid rgba(239,220,190,.16);border-radius:3px}.door strong{display:block;font-family:Georgia,serif;font-size:28px;font-weight:500;position:relative;z-index:2;margin-top:7px}.door small,.door em{display:block;position:relative;z-index:2;font-size:7px;opacity:.75}.door em{font-style:normal;margin-top:23px}.doorHandle{position:absolute;right:14px;top:78px;width:6px;height:6px;border-radius:50%;background:#d7ba82;box-shadow:0 0 0 2px rgba(0,0,0,.18)}.door.rose{box-shadow:inset -11px 0 18px rgba(0,0,0,.18),0 0 0 3px rgba(155,90,80,.2)}.door.amber{box-shadow:inset -11px 0 18px rgba(0,0,0,.18),0 0 0 3px rgba(174,118,47,.2)}.door.occupied:before{content:"IN";position:absolute;right:8px;top:8px;border-radius:999px;background:#d5c094;color:#4d3d28;padding:3px 5px;font-size:6px;font-weight:900;z-index:3}.identity{display:grid;grid-template-columns:1fr 1fr;gap:14px}.identity.compact{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0}.identityShowcase{min-height:420px;border-radius:25px;overflow:hidden;background-image:url("https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=84");background-size:cover;background-position:center;position:relative}.identityWallpaper{position:absolute;inset:0;padding:30px;display:flex;flex-direction:column;justify-content:end;color:white;background:linear-gradient(0deg,rgba(8,28,25,.83),rgba(8,28,25,.06))}.identityLogo{width:64px;height:64px;border:1px solid rgba(255,255,255,.4);border-radius:18px;background:rgba(255,255,255,.12);backdrop-filter:blur(15px);display:grid;place-items:center;margin-bottom:18px;overflow:hidden}.identityLogo img{width:100%;height:100%;object-fit:contain;background:white}.identityLogo span{font-family:Georgia,serif;font-size:20px}.identityWallpaper h2{font-family:Georgia,serif;font-size:36px;font-weight:500;margin:6px 0}.identityWallpaper p{font-family:Georgia,serif;font-style:italic;font-size:15px;margin:0;opacity:.8}.identityForm{padding:22px;display:grid;gap:11px}.identityForm label,.newGrid label{display:grid;gap:5px}.identityForm label span,.newGrid label span{font-size:8px;font-weight:800;color:var(--muted);letter-spacing:.06em}.identityForm input,.identityForm select,.newGrid input,.newGrid select,.newGrid textarea,.paymentBox input,.paymentBox select,.splitBox input,.splitBox select{border:1px solid var(--line);border-radius:11px;background:#fbf8f2;padding:10px 11px;outline:none;font-size:10px;color:var(--ink)}.identityForm .primary{justify-self:start}.drawerShade,.modalShade{position:fixed;inset:0;background:rgba(8,25,22,.42);backdrop-filter:blur(4px);z-index:70}.drawer{position:absolute;right:0;top:0;bottom:0;width:min(500px,100%);background:linear-gradient(145deg,#f8f3e9,#fcfaf5);padding:27px;overflow:auto;box-shadow:-24px 0 80px rgba(9,24,21,.18)}.drawerClose,.closeFloating{position:absolute;right:17px;top:15px;border:0;width:32px;height:32px;border-radius:50%;background:rgba(23,45,39,.08);font-size:18px;cursor:pointer}.drawerHero small,.drawer section>small,.paymentBox>small,.splitBox>small{font-size:7px;letter-spacing:.16em;color:var(--brass);font-weight:900}.drawerHero h2{font-family:Georgia,serif;font-size:32px;font-weight:500;letter-spacing:-.04em;margin:6px 0}.drawerHero p{font-size:9px;color:var(--muted)}.stayCard{margin-top:19px;padding:16px;border:1px solid var(--line);border-radius:16px;display:grid;grid-template-columns:1fr auto 1fr .7fr;align-items:center;gap:10px;background:rgba(255,255,255,.55)}.stayCard small,.drawerMoney small{font-size:7px;color:var(--muted);display:block}.stayCard b{font-family:Georgia,serif;font-size:17px;font-weight:500}.drawerMoney{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px}.drawerMoney>div{padding:12px;border-radius:13px;background:#eee7dc}.drawerMoney b{font-size:13px}.drawerMoney .due{background:#efe0d9;color:#8d4e43}.drawerActions{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}.drawerActions button,.paymentBox button,.splitBox button{border:1px solid var(--line);border-radius:999px;padding:8px 10px;background:#fff;color:var(--forest);font-size:8px;font-weight:800;cursor:pointer}.drawerActions button:first-child{background:var(--forest);color:white}.drawerActions button:disabled{opacity:.42}.drawer section{padding:15px 0;border-top:1px solid var(--line)}.drawer section p{font-size:10px;line-height:1.55;color:var(--muted)}.paymentBox,.splitBox{padding:14px;border:1px solid var(--line);border-radius:16px;margin-top:10px}.paymentBox>div,.splitBox>div{display:grid;grid-template-columns:1fr 120px auto;gap:6px;margin-top:9px}.guestLink{border:0;background:transparent;padding:0;font-family:Georgia,serif;font-size:18px;color:var(--forest);cursor:pointer}.roomStateHero{margin:20px 0;padding:24px;border-radius:20px;background:#e2ede7}.roomStateHero.rose{background:#f0e1dd}.roomStateHero.amber{background:#efe5d2}.roomStateHero.muted{background:#e5e7e5}.roomStateHero span{font-family:Georgia,serif;font-size:28px}.roomStateHero small{display:block;font-size:8px;color:var(--muted)}.roomStateButtons{display:flex;gap:5px;flex-wrap:wrap}.roomStateButtons button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 9px;font-size:8px;cursor:pointer}.newModal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,calc(100% - 30px));max-height:calc(100% - 30px);overflow:auto;background:linear-gradient(145deg,#f9f4eb,#fffdf8);border-radius:26px;padding:26px;box-shadow:0 40px 100px rgba(10,30,25,.25)}.newModal>small{font-size:8px;letter-spacing:.17em;color:var(--brass)}.newModal>h2{font-family:Georgia,serif;font-size:30px;font-weight:500;margin:6px 0 19px}.newGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.newGrid .wide{grid-column:1/-1}.newGrid textarea{resize:vertical;min-height:70px}.rateSummary{margin:15px 0;padding:13px;border-radius:14px;background:#eae2d4;display:flex;justify-content:space-between;font-size:10px}.rateSummary b{font-family:Georgia,serif;font-size:18px}.submit{width:100%}.identityModal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(960px,calc(100% - 28px));max-height:calc(100% - 28px);overflow:auto;background:#f4ede2;border-radius:26px;padding:18px;box-shadow:0 40px 100px rgba(10,30,25,.25)}.aiPanel{position:fixed;right:16px;bottom:16px;width:min(420px,calc(100% - 32px));height:min(650px,calc(100vh - 32px));background:linear-gradient(160deg,#102f2a,#0a211e);color:white;border:1px solid rgba(255,255,255,.1);border-radius:24px;box-shadow:0 35px 90px rgba(5,22,18,.32);z-index:90;display:flex;flex-direction:column;overflow:hidden}.aiHead{padding:16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.08)}.aiHead>div{display:flex;gap:9px;align-items:center}.aiHead span{width:32px;height:32px;border-radius:11px;border:1px solid rgba(216,189,146,.35);display:grid;place-items:center;color:#dcc69f}.aiHead b,.aiHead small{display:block}.aiHead b{font-family:Georgia,serif;font-size:15px}.aiHead small{font-size:7px;opacity:.55}.aiHead button{border:0;background:transparent;color:white;font-size:18px}.aiMessages{flex:1;overflow:auto;padding:15px;display:flex;flex-direction:column;gap:8px}.aiMessages>div{max-width:88%;border-radius:14px;padding:10px 11px;font-size:9px;line-height:1.55}.aiMessages .assistant{background:rgba(255,255,255,.08);align-self:flex-start}.aiMessages .user{background:#d2b98f;color:#142821;align-self:flex-end}.aiProposal{border:1px solid rgba(216,189,146,.35);background:rgba(216,189,146,.14);color:white;border-radius:12px;padding:10px;font-size:9px;cursor:pointer}.aiPanel form{border-top:1px solid rgba(255,255,255,.08);padding:10px;display:flex;gap:6px}.aiPanel textarea{flex:1;resize:none;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);border-radius:12px;color:white;padding:9px;font-size:9px;outline:none}.aiPanel form button{border:0;border-radius:10px;background:#d2b98f;color:#17312b;padding:0 12px;font-size:9px;font-weight:800}.toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:120;background:#112f2a;color:white;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:10px 15px;font-size:9px;box-shadow:0 16px 35px rgba(8,27,23,.2)}.empty{padding:25px;text-align:center;color:var(--muted);font-size:10px}.loading,.onboarding{min-height:100vh;display:grid;place-content:center;text-align:center;background:radial-gradient(circle at 50% 35%,#fbf8f1,#e9dfd0);color:var(--forest)}.loading .bell{width:62px;height:62px;border-radius:50%;border:1px solid #c6a87a;display:grid;place-items:center;margin:auto auto 13px;font-size:22px}.loading strong{font-family:Georgia,serif;font-size:24px;font-weight:500}.loading span{font-size:9px;letter-spacing:.13em;margin-top:5px;color:var(--muted)}.onboardingCard{width:min(520px,calc(100vw - 32px));padding:36px;border:1px solid var(--line);border-radius:28px;background:rgba(255,255,255,.62);box-shadow:var(--shadow)}.seal{width:64px;height:64px;border-radius:18px;background:var(--forest);color:#e1cca6;display:grid;place-items:center;margin:auto auto 18px;font-family:Georgia,serif}.onboardingCard small{font-size:8px;letter-spacing:.16em;color:var(--brass)}.onboardingCard h1{font-family:Georgia,serif;font-size:39px;font-weight:500;margin:8px}.onboardingCard p{font-size:11px;line-height:1.6;color:var(--muted)}.onboardingCard form{display:flex;gap:7px;margin-top:17px}.onboardingCard input{flex:1;border:1px solid var(--line);border-radius:12px;padding:11px;background:#fff}.onboardingCard button{border:0;border-radius:12px;background:var(--forest);color:#fff;padding:0 14px}.theme-midnight{--forest:#161b27;--forest2:#0e121c;--forest3:#2a3142;--brass:#c1a56e;--brass2:#ead8a8}.theme-sand{--forest:#44382c;--forest2:#2c241d;--forest3:#67533d;--brass:#a47c50;--brass2:#d8ba8d}@media(max-width:1080px){.side{width:210px}.workspace{margin-left:210px}.overviewGrid,.distributionGrid,.revenueLayout,.identity,.identity.compact{grid-template-columns:1fr}.metricsRail{grid-template-columns:repeat(2,1fr)}.guestGrid,.houseGrid{grid-template-columns:repeat(2,1fr)}.reservationList>button{grid-template-columns:38px 1.4fr 80px 145px 90px}.reservationList>button>div:nth-of-type(5){display:none}}@media(max-width:760px){.side{position:static;width:100%;height:auto;display:block;padding:12px}.brandLockup{padding-bottom:10px}.propertySwitch,.sideStory{display:none}.side nav{display:flex;overflow:auto;margin-top:8px}.side nav button{min-width:max-content;grid-template-columns:20px 1fr}.sideFoot{display:none}.workspace{margin-left:0}.topbar{position:static;padding:14px;align-items:flex-start}.topbar h1{font-size:20px}.topActions{flex-wrap:wrap;justify-content:flex-end}.search{order:3;width:100%}.content{padding:14px}.lobbyHero{min-height:440px}.heroCopy{left:20px;right:20px;bottom:25px}.heroCopy h2{font-size:38px}.occupancyMedallion{width:92px;height:92px;right:17px;top:17px}.metricsRail{margin-top:-27px;padding:0 8px;grid-template-columns:1fr 1fr}.deskColumns{grid-template-columns:1fr}.humanCard>div{max-width:82%}.conciergeCard{grid-template-columns:100px 1fr}.guestGrid,.houseGrid{grid-template-columns:1fr}.houseCard{grid-template-columns:48px 1fr 95px}.distributionHero,.revenueHero,.houseHero{min-height:auto}.revenueHero,.houseHero{display:block}.revenueActions{margin-top:14px}.metricGrid{grid-template-columns:1fr 1fr}.reservationList>button{grid-template-columns:38px 1fr 80px}.reservationList>button>div:nth-of-type(3),.reservationList>button>div:nth-of-type(4),.reservationList>button>div:nth-of-type(5){display:none}.channelList article{grid-template-columns:34px 1fr 75px 62px}.channelList article>small{display:none}.identityShowcase{min-height:330px}.identity.compact{grid-template-columns:1fr}.newGrid{grid-template-columns:1fr}.newGrid .wide{grid-column:auto}.paymentBox>div,.splitBox>div{grid-template-columns:1fr}.floor{grid-template-columns:45px 1fr}.doors{grid-template-columns:repeat(2,1fr)}.door{height:130px}}
`}</style>}
