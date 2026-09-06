"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./rates.module.css"

const DAY=86400000
function iso(date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function startOfDay(value){const d=new Date(value);d.setHours(0,0,0,0);return d}
function addDays(date,n){return new Date(date.getTime()+n*DAY)}
function money(value){return new Intl.NumberFormat("es-AR",{maximumFractionDigits:0}).format(Number(value||0))}
function dateLabel(value){return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${value}T12:00:00`))}
function percentagePrice(value,percent,roundUp){const calculated=Number(value||0)*(1+Number(percent||0)/100);return Math.max(0,roundUp?Math.ceil(calculated):Math.round(calculated*100)/100)}

export default function RatesWorkspace({propertyId,property}){
  const today=startOfDay(new Date())
  const[rooms,setRooms]=useState([])
  const[rates,setRates]=useState([])
  const[propertySettings,setPropertySettings]=useState({})
  const[anchor,setAnchor]=useState(today)
  const[selected,setSelected]=useState(new Set([iso(today)]))
  const[rangeStart,setRangeStart]=useState(null)
  const[rangeMode,setRangeMode]=useState(true)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState("")
  const[error,setError]=useState("")

  const visibleDates=useMemo(()=>Array.from({length:35},(_,i)=>iso(addDays(anchor,i))),[anchor])
  const rangeEnd=visibleDates.at(-1)
  const roundUp=Boolean(propertySettings?.preferences?.round_final_rate_up)
  const isOwner=property?.role==="owner"

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[roomsRes,ratesRes,settingsRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,precio,estado,activa,sort_order").eq("property_id",propertyId).eq("activa",true).order("sort_order").order("nombre"),
        supabase.from("hotel_rate_calendar").select("id,habitacion_id,stay_date,price,min_stay,stop_sell,closed_to_arrival,closed_to_departure,notes").eq("property_id",propertyId).gte("stay_date",iso(anchor)).lte("stay_date",rangeEnd).order("stay_date"),
        supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      ])
      if(roomsRes.error)throw roomsRes.error;if(ratesRes.error)throw ratesRes.error;if(settingsRes.error)throw settingsRes.error
      setRooms(roomsRes.data||[]);setRates(ratesRes.data||[]);setPropertySettings(settingsRes.data?.settings||{})
    }catch(err){setError(err?.message||"No se pudieron cargar tarifas y disponibilidad.")}
    finally{setLoading(false)}
  },[propertyId,anchor,rangeEnd])

  useEffect(()=>{load()},[load])
  useEffect(()=>{if(typeof window==="undefined")return;const handler=event=>{if(String(event.detail?.propertyId)===String(propertyId)&&event.detail?.settings)setPropertySettings(event.detail.settings)};window.addEventListener("hl:property-settings-updated",handler);return()=>window.removeEventListener("hl:property-settings-updated",handler)},[propertyId])

  const rateMap=useMemo(()=>{const map=new Map();for(const row of rates)map.set(`${row.habitacion_id}:${row.stay_date}`,row);return map},[rates])
  const selectedDates=useMemo(()=>Array.from(selected).sort(),[selected])

  function chooseDate(day){
    if(!rangeMode){setSelected(current=>{const next=new Set(current);next.has(day)?next.delete(day):next.add(day);return next});return}
    if(!rangeStart){setRangeStart(day);setSelected(new Set([day]));return}
    const a=new Date(`${rangeStart}T12:00:00`);const b=new Date(`${day}T12:00:00`);const from=a<=b?a:b;const to=a<=b?b:a;const next=new Set();for(let d=new Date(from);d<=to;d=addDays(d,1))next.add(iso(d));setSelected(next);setRangeStart(null)
  }

  function preset(days){const from=startOfDay(new Date());setAnchor(from);setRangeStart(null);setSelected(new Set(Array.from({length:days},(_,i)=>iso(addDays(from,i)))))}
  function toggleWeekday(index){setSelected(current=>{const next=new Set(current);const matching=visibleDates.filter(day=>new Date(`${day}T12:00:00`).getDay()===index);const all=matching.every(day=>next.has(day));matching.forEach(day=>all?next.delete(day):next.add(day));return next})}

  async function toggleRateRounding(){
    if(!isOwner){setError("Solo el propietario puede modificar esta preferencia.");return}
    setSaving("rounding");setError("")
    try{
      const nextValue=!roundUp
      const nextSettings={...propertySettings,preferences:{...(propertySettings.preferences||{}),round_final_rate_up:nextValue}}
      const{data:userRes}=await supabase.auth.getUser()
      const{error:settingsError}=await supabase.from("property_settings").upsert({property_id:propertyId,settings:nextSettings,updated_at:new Date().toISOString(),updated_by:userRes?.user?.id||null},{onConflict:"property_id"})
      if(settingsError)throw settingsError
      setPropertySettings(nextSettings)
      if(typeof window!=="undefined"){
        window.dispatchEvent(new CustomEvent("hl:property-settings-updated",{detail:{propertyId,settings:nextSettings}}))
        window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:nextValue?"Redondeo activado":"Redondeo desactivado",message:nextValue?"Las tarifas calculadas por porcentaje se redondearán siempre hacia arriba.":"Las tarifas calculadas por porcentaje conservarán los centavos exactos."}}))
      }
    }catch(err){setError(err?.message?.includes("Solo el propietario")?err.message:"No se pudo guardar la preferencia de redondeo.")}
    finally{setSaving("")}
  }

  async function mutateRoom(room,{percent=null,open=null,minStay=null,basePrice=null}={}){
    if(!selectedDates.length&&basePrice==null)return
    setSaving(String(room.id));setError("")
    try{
      if(basePrice!=null){const{error:roomError}=await supabase.from("habitaciones").update({precio:Number(basePrice)}).eq("id",room.id).eq("property_id",propertyId);if(roomError)throw roomError}
      if(selectedDates.length){
        const payload=selectedDates.map(day=>{
          const current=rateMap.get(`${room.id}:${day}`)
          const currentPrice=Number(current?.price??room.precio??0)
          const nextPrice=percent==null?current?.price??null:percentagePrice(currentPrice,percent,roundUp)
          return{property_id:propertyId,habitacion_id:room.id,stay_date:day,price:nextPrice,min_stay:minStay??current?.min_stay??1,stop_sell:open==null?current?.stop_sell??false:!open,closed_to_arrival:current?.closed_to_arrival??false,closed_to_departure:current?.closed_to_departure??false,notes:current?.notes??null,updated_at:new Date().toISOString()}
        })
        const{error:rateError}=await supabase.from("hotel_rate_calendar").upsert(payload,{onConflict:"property_id,habitacion_id,stay_date"});if(rateError)throw rateError
      }
      await load()
    }catch(err){setError(err?.message||"No se pudo actualizar la tarifa.")}
    finally{setSaving("")}
  }

  async function bulk(percent){for(const room of rooms)await mutateRoom(room,{percent})}
  async function bulkOpen(open){for(const room of rooms)await mutateRoom(room,{open})}

  const weekdays=[1,2,3,4,5,6,0]
  const roundingCard={marginTop:12,padding:13,border:"1px solid color-mix(in srgb,var(--accent) 15%,var(--line))",borderRadius:16,background:"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))"}
  const roundingButton={width:"100%",minHeight:38,marginTop:10,border:`1px solid ${roundUp?"color-mix(in srgb,var(--accent) 45%,var(--line))":"var(--line)"}`,borderRadius:11,background:roundUp?"color-mix(in srgb,var(--accent) 12%,var(--panelSolid))":"var(--panelSolid)",color:roundUp?"var(--accent)":"var(--text)",font:"inherit",fontSize:11,fontWeight:850,cursor:isOwner&&saving!=="rounding"?"pointer":"default",opacity:isOwner?1:.72}
  return <section className={s.page}>
    <header className={s.header}><div><small>REVENUE</small><h1>Tarifas y disponibilidad</h1><p>{property?.name||"Propiedad activa"} · precios, restricciones y venta por fecha.</p></div><div className={s.headerActions}><button onClick={()=>bulk(-5)} disabled={!selectedDates.length||!!saving}>−5%</button><button onClick={()=>bulk(5)} disabled={!selectedDates.length||!!saving}>+5%</button><button className={s.open} onClick={()=>bulkOpen(true)} disabled={!selectedDates.length||!!saving}>Abrir venta</button><button className={s.closeSale} onClick={()=>bulkOpen(false)} disabled={!selectedDates.length||!!saving}>Cerrar venta</button></div></header>
    {error&&<div className={s.alert}>{error}</div>}
    <div className={s.layout}>
      <aside className={s.selector}>
        <div className={s.presets}><button onClick={()=>preset(1)}>Hoy</button><button onClick={()=>preset(7)}>7 días</button><button onClick={()=>preset(30)}>30 días</button></div>
        <div className={s.calendarHeader}><button onClick={()=>setAnchor(addDays(anchor,-35))}>‹</button><b>{new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric"}).format(anchor)}</b><button onClick={()=>setAnchor(addDays(anchor,35))}>›</button></div>
        <div className={s.weekdays}>{weekdays.map(index=><button key={index} onClick={()=>toggleWeekday(index)}>{["D","L","M","M","J","V","S"][index]}</button>)}</div>
        <div className={s.calendar}>{visibleDates.map(day=>{const d=new Date(`${day}T12:00:00`);return <button key={day} className={`${selected.has(day)?s.daySelected:""} ${day===iso(today)?s.today:""}`} onClick={()=>chooseDate(day)}><small>{new Intl.DateTimeFormat("es-AR",{weekday:"short"}).format(d).slice(0,2)}</small><b>{d.getDate()}</b></button>})}</div>
        <label className={s.mode}><input type="checkbox" checked={rangeMode} onChange={e=>{setRangeMode(e.target.checked);setRangeStart(null)}}/><span>Selección por rango</span></label>
        <div className={s.selection}><b>{selectedDates.length}</b><span>fecha{selectedDates.length===1?"":"s"} seleccionada{selectedDates.length===1?"":"s"}</span>{selectedDates.length>0&&<small>{dateLabel(selectedDates[0])}{selectedDates.length>1?` → ${dateLabel(selectedDates.at(-1))}`:""}</small>}</div>
        <div style={roundingCard}><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".08em",color:"var(--accent)"}}>CONFIGURACIÓN DE TARIFA</small><b style={{display:"block",marginTop:5,fontSize:12}}>Redondear tarifa final hacia arriba</b><p style={{margin:"5px 0 0",fontSize:10,lineHeight:1.45,color:"var(--muted)"}}>Al aplicar porcentajes, un resultado como $ 184.991,07 pasa a $ 184.992. No modifica tarifas históricas ya guardadas.</p><button type="button" style={roundingButton} disabled={!isOwner||saving==="rounding"} onClick={toggleRateRounding}>{saving==="rounding"?"Guardando…":roundUp?"Activado · redondea hacia arriba":"Desactivado · conserva centavos"}</button><small style={{display:"block",marginTop:7,fontSize:10,color:"var(--muted)"}}>{isOwner?"Sólo el propietario puede cambiar esta preferencia.":"Definido por el propietario de la propiedad."}</small></div>
      </aside>
      <main className={s.roomsPanel}>{loading?<div className={s.empty}>Cargando tarifas…</div>:!rooms.length?<div className={s.empty}>Todavía no hay habitaciones activas en esta propiedad.</div>:rooms.map(room=>{
        const sample=selectedDates.map(day=>rateMap.get(`${room.id}:${day}`)).filter(Boolean)
        const closed=selectedDates.length>0&&selectedDates.every(day=>rateMap.get(`${room.id}:${day}`)?.stop_sell===true)
        const minStay=sample[0]?.min_stay||1
        const shownPrice=sample.find(row=>row.price!=null)?.price??room.precio??0
        return <article className={s.roomCard} key={room.id}><div className={s.roomIdentity}><span className={s.roomIcon}>⌂</span><div><b>{room.nombre}</b><small>{room.tipo||"Habitación"}</small></div></div><div className={s.price}><small>Precio de referencia</small><strong>$ {money(shownPrice)}</strong></div><div className={s.quick}><button onClick={()=>mutateRoom(room,{percent:-5})} disabled={saving===String(room.id)}>−5%</button><button onClick={()=>mutateRoom(room,{percent:-3})} disabled={saving===String(room.id)}>−3%</button><button onClick={()=>mutateRoom(room,{percent:3})} disabled={saving===String(room.id)}>+3%</button><button onClick={()=>mutateRoom(room,{percent:5})} disabled={saving===String(room.id)}>+5%</button></div><label className={s.minStay}><span>Mín. estadía</span><input type="number" min="1" max="365" defaultValue={minStay} onBlur={e=>mutateRoom(room,{minStay:Math.max(1,Number(e.target.value)||1)})}/></label><button className={closed?s.closed:s.opened} onClick={()=>mutateRoom(room,{open:closed})} disabled={saving===String(room.id)}>{saving===String(room.id)?"Guardando…":closed?"Cerrado · abrir":"Abierto · cerrar"}</button></article>
      })}</main>
    </div>
  </section>
}
