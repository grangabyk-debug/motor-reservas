"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{commercialPriceFromNet,netPriceFromCommercial,normalizeTaxSettings,priceTaxCaption}from"../../core/priceTax"
import{convertCurrency,formatCurrency,oppositeCurrency,pricingFromSettings}from"../../core/currency"
import s from"./rates.module.css"

const DAY=86400000
function iso(date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function startOfDay(value){const d=new Date(value);d.setHours(0,0,0,0);return d}
function addDays(date,n){return new Date(date.getTime()+n*DAY)}
function firstOfMonth(value,offset=0){const d=new Date(value);return new Date(d.getFullYear(),d.getMonth()+offset,1)}
function lastOfMonth(value){return new Date(value.getFullYear(),value.getMonth()+1,0)}
function dateLabel(value){return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${value}T12:00:00`))}
function percentagePrice(value,percent,roundUp){const calculated=Number(value||0)*(1+Number(percent||0)/100);return Math.max(0,roundUp?Math.ceil(calculated):Math.round(calculated*100)/100)}
const roomType=room=>String(room?.tipo||"Sin categoría").trim()||"Sin categoría"

export default function RatesWorkspace({propertyId,property}){
  const today=startOfDay(new Date())
  const[rooms,setRooms]=useState([]),[rates,setRates]=useState([]),[propertySettings,setPropertySettings]=useState({})
  const[anchor,setAnchor]=useState(()=>firstOfMonth(today)),[selected,setSelected]=useState(new Set([iso(today)])),[rangeStart,setRangeStart]=useState(null),[rangeMode,setRangeMode]=useState(false)
  const[loading,setLoading]=useState(true),[saving,setSaving]=useState(""),[error,setError]=useState("")
  const[fx,setFx]=useState(null),[fxLoading,setFxLoading]=useState(false),[manualRate,setManualRate]=useState("")
  const[typeFilter,setTypeFilter]=useState("all"),[selectedRooms,setSelectedRooms]=useState(new Set()),[bulkMode,setBulkMode]=useState("price"),[bulkValue,setBulkValue]=useState("")

  const visibleDates=useMemo(()=>Array.from({length:lastOfMonth(anchor).getDate()},(_,i)=>iso(new Date(anchor.getFullYear(),anchor.getMonth(),i+1))),[anchor])
  const leadingSlots=useMemo(()=>(anchor.getDay()+6)%7,[anchor]),dataStart=useMemo(()=>iso(firstOfMonth(anchor,-1)),[anchor]),dataEnd=useMemo(()=>iso(lastOfMonth(firstOfMonth(anchor,1))),[anchor])
  const roundUp=Boolean(propertySettings?.preferences?.round_final_rate_up),taxes=normalizeTaxSettings(propertySettings?.taxes||{}),pricing=pricingFromSettings(propertySettings),isOwner=property?.role==="owner"
  const effectiveFx=pricing.fxMode==="manual"?pricing.manualUsdArs:Number(fx?.rate||0),otherCurrency=oppositeCurrency(pricing.rateCurrency)

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[roomsRes,ratesRes,settingsRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,precio,estado,activa,sort_order").eq("property_id",propertyId).eq("activa",true).order("sort_order").order("nombre"),
        supabase.from("hotel_rate_calendar").select("id,habitacion_id,stay_date,price,min_stay,stop_sell,closed_to_arrival,closed_to_departure,notes").eq("property_id",propertyId).gte("stay_date",dataStart).lte("stay_date",dataEnd).order("stay_date"),
        supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle()
      ])
      if(roomsRes.error)throw roomsRes.error;if(ratesRes.error)throw ratesRes.error;if(settingsRes.error)throw settingsRes.error
      setRooms(roomsRes.data||[]);setRates(ratesRes.data||[])
      const next=settingsRes.data?.settings||{};setPropertySettings(next);setManualRate(String(pricingFromSettings(next).manualUsdArs||""))
      setSelectedRooms(current=>new Set([...current].filter(id=>(roomsRes.data||[]).some(room=>String(room.id)===String(id)))))
    }catch(err){setError(err?.message||"No se pudieron cargar tarifas y disponibilidad.")}finally{setLoading(false)}
  },[propertyId,dataStart,dataEnd])

  const loadFx=useCallback(async()=>{
    setFxLoading(true)
    try{
      const response=await fetch("/api/hotel/exchange-rate",{cache:"no-store"}),json=await response.json()
      if(!response.ok)throw new Error(json?.error||"Cotización no disponible")
      setFx(json)
    }catch(err){setFx(null);if(pricing.fxMode==="automatic")setError(err?.message||"No se pudo obtener la cotización oficial.")}finally{setFxLoading(false)}
  },[pricing.fxMode])

  useEffect(()=>{load()},[load])
  useEffect(()=>{
    loadFx()
    if(typeof window==="undefined")return
    const timer=window.setInterval(loadFx,300000),focus=()=>loadFx()
    window.addEventListener("focus",focus)
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",focus)}
  },[loadFx])
  useEffect(()=>{if(typeof window==="undefined")return;const handler=event=>{if(String(event.detail?.propertyId)===String(propertyId)&&event.detail?.settings){setPropertySettings(event.detail.settings);setManualRate(String(pricingFromSettings(event.detail.settings).manualUsdArs||""))}};window.addEventListener("hl:property-settings-updated",handler);return()=>window.removeEventListener("hl:property-settings-updated",handler)},[propertyId])

  const rateMap=useMemo(()=>{const map=new Map();for(const row of rates)map.set(`${row.habitacion_id}:${row.stay_date}`,row);return map},[rates]),selectedDates=useMemo(()=>Array.from(selected).sort(),[selected])
  const roomTypes=useMemo(()=>[...new Set(rooms.map(roomType))].sort((a,b)=>a.localeCompare(b,"es",{numeric:true})),[rooms])
  const visibleRooms=useMemo(()=>typeFilter==="all"?rooms:rooms.filter(room=>roomType(room)===typeFilter),[rooms,typeFilter])
  const explicitlySelected=useMemo(()=>rooms.filter(room=>selectedRooms.has(String(room.id))),[rooms,selectedRooms])
  const bulkTargets=explicitlySelected.length?explicitlySelected:typeFilter!=="all"?visibleRooms:[]
  const selectionLabel=explicitlySelected.length?`${explicitlySelected.length} seleccionada${explicitlySelected.length===1?"":"s"}`:typeFilter!=="all"?`${visibleRooms.length} ${typeFilter}`:"Elegí habitaciones o categoría"

  function clearDates(){setRangeStart(null);setSelected(new Set())}
  function changeMonth(offset){setAnchor(current=>firstOfMonth(current,offset));clearDates()}
  function selectMonth(){setRangeStart(null);setSelected(new Set(visibleDates))}
  function chooseDate(day){
    if(!rangeMode){setSelected(current=>{const next=new Set(current);next.has(day)?next.delete(day):next.add(day);return next});return}
    if(!rangeStart){if(selected.has(day)){setSelected(current=>{const next=new Set(current);next.delete(day);return next});return}setRangeStart(day);setSelected(new Set([day]));return}
    if(day===rangeStart){setRangeStart(null);setSelected(new Set());return}
    const a=new Date(`${rangeStart}T12:00:00`),b=new Date(`${day}T12:00:00`),from=a<=b?a:b,to=a<=b?b:a,next=new Set();for(let d=new Date(from);d<=to;d=addDays(d,1))next.add(iso(d));setSelected(next);setRangeStart(null)
  }
  function preset(days){const from=startOfDay(new Date());setAnchor(firstOfMonth(from));setRangeStart(null);setSelected(new Set(Array.from({length:days},(_,i)=>iso(addDays(from,i)))))}
  function toggleWeekday(index){setRangeStart(null);setSelected(current=>{const next=new Set(current),matching=visibleDates.filter(day=>new Date(`${day}T12:00:00`).getDay()===index),all=matching.length>0&&matching.every(day=>next.has(day));matching.forEach(day=>all?next.delete(day):next.add(day));return next})}
  function changeTypeFilter(value){setTypeFilter(value);setSelectedRooms(new Set())}
  function toggleRoom(id){setSelectedRooms(current=>{const next=new Set(current),key=String(id);next.has(key)?next.delete(key):next.add(key);return next})}
  function selectVisible(){setSelectedRooms(new Set(visibleRooms.map(room=>String(room.id))))}

  async function toggleRateRounding(){if(!isOwner)return setError("Solo el propietario puede modificar esta preferencia.");setSaving("rounding");setError("");try{const nextValue=!roundUp,nextSettings={...propertySettings,preferences:{...(propertySettings.preferences||{}),round_final_rate_up:nextValue}},{data:userRes}=await supabase.auth.getUser(),{error:settingsError}=await supabase.from("property_settings").upsert({property_id:propertyId,settings:nextSettings,updated_at:new Date().toISOString(),updated_by:userRes?.user?.id||null},{onConflict:"property_id"});if(settingsError)throw settingsError;setPropertySettings(nextSettings);window.dispatchEvent(new CustomEvent("hl:property-settings-updated",{detail:{propertyId,settings:nextSettings}}))}catch(err){setError(err?.message||"No se pudo guardar la preferencia de redondeo.")}finally{setSaving("")}}
  async function saveFxMode(mode){if(!isOwner)return;const manual=Number(manualRate);setSaving("fx");setError("");try{const{data,error:rpcError}=await supabase.rpc("hl_update_rate_fx_settings",{p_property_id:propertyId,p_fx_mode:mode,p_manual_usd_ars:mode==="manual"?manual:null});if(rpcError)throw rpcError;const next={...propertySettings,pricing:{...(propertySettings.pricing||{}),...(data||{})}};setPropertySettings(next);if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:property-settings-updated",{detail:{propertyId,settings:next}}))}catch(err){setError(err?.message||"No se pudo guardar la cotización.")}finally{setSaving("")}}
  async function switchCurrency(target){if(!isOwner||target===pricing.rateCurrency)return;if(!effectiveFx)return setError("Falta una cotización USD/ARS válida.");const message=`Convertir tarifas y calendario de ${pricing.rateCurrency} a ${target} con 1 USD = ${formatCurrency(effectiveFx,"ARS")}. Las reservas existentes no cambian. ¿Continuar?`;if(typeof window!=="undefined"&&!window.confirm(message))return;setSaving("currency");setError("");try{const{data,error:rpcError}=await supabase.rpc("hl_change_rate_currency",{p_property_id:propertyId,p_target_currency:target,p_usd_ars_rate:effectiveFx,p_fx_source:pricing.fxMode==="manual"?"Manual":fx?.source||"Banco Nación · dólar billete venta",p_fx_as_of:pricing.fxMode==="manual"?iso(new Date()):fx?.asOf||iso(new Date())});if(rpcError)throw rpcError;const next={...propertySettings,pricing:{...(propertySettings.pricing||{}),...(data||{})}};setPropertySettings(next);await load();if(typeof window!=="undefined"){window.dispatchEvent(new CustomEvent("hl:property-settings-updated",{detail:{propertyId,settings:next}}));window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:`Tarifas en ${target}`,message:`Cambio guardado con 1 USD = ${formatCurrency(effectiveFx,"ARS")}.`}}))}}catch(err){setError(err?.message||"No se pudo cambiar la moneda base.")}finally{setSaving("")}}

  async function mutateRooms(targetRooms,{percent=null,open=null,minStay=null,commercialPrice=null}={},key="bulk"){
    if(!selectedDates.length||!targetRooms.length)return
    setSaving(key);setError("")
    try{
      const now=new Date().toISOString(),payload=[]
      for(const room of targetRooms)for(const day of selectedDates){const current=rateMap.get(`${room.id}:${day}`),currentNet=Number(current?.price??room.precio??0);let nextPrice=current?.price??null;if(commercialPrice!=null)nextPrice=netPriceFromCommercial(commercialPrice,taxes);else if(percent!=null){const currentFinal=commercialPriceFromNet(currentNet,taxes),nextFinal=percentagePrice(currentFinal,percent,roundUp);nextPrice=netPriceFromCommercial(nextFinal,taxes)}payload.push({property_id:propertyId,habitacion_id:room.id,stay_date:day,price:nextPrice,min_stay:minStay??current?.min_stay??1,stop_sell:open==null?current?.stop_sell??false:!open,closed_to_arrival:current?.closed_to_arrival??false,closed_to_departure:current?.closed_to_departure??false,notes:current?.notes??null,updated_at:now})}
      const{error:rateError}=await supabase.from("hotel_rate_calendar").upsert(payload,{onConflict:"property_id,habitacion_id,stay_date"});if(rateError)throw rateError
      await load()
      if(typeof window!=="undefined"&&targetRooms.length>1)window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:"Tarifas actualizadas",message:`Cambio aplicado a ${targetRooms.length} habitaciones y ${selectedDates.length} fecha${selectedDates.length===1?"":"s"}.`}}))
    }catch(err){setError(err?.message||"No se pudieron actualizar las tarifas.")}finally{setSaving("")}
  }
  const mutateRoom=(room,options={})=>mutateRooms([room],options,String(room.id))
  const bulkOpen=open=>mutateRooms(rooms,{open},"global")
  function applyBulkChange(){
    const value=Number(String(bulkValue).replace(",","."))
    if(!bulkTargets.length)return setError("Elegí habitaciones o categoría.")
    if(bulkMode==="percent"){
      if(!Number.isFinite(value)||value===0||value<=-100)return setError("Ingresá un porcentaje mayor a -100 y distinto de 0.")
      mutateRooms(bulkTargets,{percent:value},"bulk-percent").then(()=>setBulkValue(""));return
    }
    if(!Number.isFinite(value)||value<0)return setError("Ingresá un precio final válido.")
    mutateRooms(bulkTargets,{commercialPrice:value},"bulk-price").then(()=>setBulkValue(""))
  }

  const weekdays=[1,2,3,4,5,6,0],card={marginTop:12,padding:13,border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:16,background:"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))"},taxCard={...card,border:"1px solid color-mix(in srgb,#2f9b61 22%,var(--line))",background:"color-mix(in srgb,#37a96a 6%,var(--panelSolid))"},inputStyle={width:130,minWidth:0,border:"1px solid color-mix(in srgb,var(--accent) 22%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--panelSolid) 94%,transparent)",color:"var(--text)",font:"inherit",fontSize:20,fontWeight:900,padding:"5px 8px",outline:"none"},tinyButton={border:"1px solid var(--line)",borderRadius:9,padding:"7px 9px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:850,cursor:"pointer"},bulkBar={display:"grid",gridTemplateColumns:"minmax(150px,220px) auto auto 1fr auto",gap:8,alignItems:"center",padding:"11px 12px",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:15,background:"color-mix(in srgb,var(--panelSolid) 92%,transparent)",marginBottom:10,position:"sticky",top:70,zIndex:4,backdropFilter:"blur(22px)"}
  const bulkBusy=saving==="bulk-price"||saving==="bulk-percent",monthLabel=new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric"}).format(anchor)

  return <section className={s.page}>
    <header className={s.header}><div><small>REVENUE</small><h1>Tarifas y disponibilidad</h1><p>{property?.name||"Propiedad activa"} · tarifas y venta por fecha.</p></div><div className={s.headerActions}><button className={s.open} onClick={()=>bulkOpen(true)} disabled={!selectedDates.length||!!saving}>Abrir venta</button><button className={s.closeSale} onClick={()=>bulkOpen(false)} disabled={!selectedDates.length||!!saving}>Cerrar venta</button></div></header>
    {error&&<div className={s.alert}>{error}</div>}
    <div className={s.layout}><aside className={s.selector}>
      <div className={s.presets}><button onClick={()=>preset(1)}>Hoy</button><button onClick={()=>preset(7)}>7 días</button><button onClick={()=>preset(30)}>30 días</button></div>
      <div className={s.calendarHeader}><button onClick={()=>changeMonth(-1)} aria-label="Mes anterior">‹</button><b>{monthLabel}</b><button onClick={()=>changeMonth(1)} aria-label="Mes siguiente">›</button></div>
      <div className={s.weekdays}>{weekdays.map(index=><button key={index} onClick={()=>toggleWeekday(index)}>{["D","L","M","M","J","V","S"][index]}</button>)}</div>
      <div className={s.calendar}>{Array.from({length:leadingSlots},(_,i)=><span key={`blank-${i}`} aria-hidden="true" style={{minHeight:50}}/>)}{visibleDates.map(day=>{const d=new Date(`${day}T12:00:00`);return <button key={day} className={`${selected.has(day)?s.daySelected:""} ${day===iso(today)?s.today:""}`} onClick={()=>chooseDate(day)} aria-pressed={selected.has(day)}><small>{new Intl.DateTimeFormat("es-AR",{weekday:"short"}).format(d).slice(0,2)}</small><b>{d.getDate()}</b></button>})}</div>
      <label className={s.mode}><input type="checkbox" checked={rangeMode} onChange={e=>{setRangeMode(e.target.checked);setRangeStart(null)}}/><span>Selección por rango</span></label>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginTop:8}}><button type="button" style={tinyButton} onClick={selectMonth}>Seleccionar mes</button><button type="button" style={tinyButton} onClick={clearDates} disabled={!selectedDates.length}>Limpiar fechas</button></div>
      <div className={s.selection}><b>{selectedDates.length}</b><span>fecha{selectedDates.length===1?"":"s"} seleccionada{selectedDates.length===1?"":"s"}</span>{selectedDates.length>0&&<small>{dateLabel(selectedDates[0])}{selectedDates.length>1?` → ${dateLabel(selectedDates.at(-1))}`:""}</small>}<small style={{marginTop:3,lineHeight:1.35}}>Sin tarifa específica se usa la tarifa base.</small></div>
      <div style={card}><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".08em",color:"var(--accent)"}}>MONEDA DE TARIFAS</small><b style={{display:"block",marginTop:5,fontSize:13}}>Base {pricing.rateCurrency}</b><p style={{margin:"5px 0 9px",fontSize:10,lineHeight:1.45,color:"var(--muted)"}}>La otra moneda se muestra sólo como equivalencia.</p><div style={{display:"flex",gap:6}}>{["ARS","USD"].map(code=><button key={code} type="button" style={{...tinyButton,flex:1,borderColor:pricing.rateCurrency===code?"color-mix(in srgb,var(--accent) 55%,var(--line))":"var(--line)",background:pricing.rateCurrency===code?"color-mix(in srgb,var(--accent) 10%,var(--panelSolid))":"var(--panelSolid)",color:pricing.rateCurrency===code?"var(--accent)":"var(--text)"}} disabled={!isOwner||saving==="currency"} onClick={()=>switchCurrency(code)}>{code}</button>)}</div></div>
      <div style={card}><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".08em",color:"var(--accent)"}}>COTIZACIÓN USD / ARS</small><b style={{display:"block",marginTop:5,fontSize:13}}>{effectiveFx?`1 USD = ${formatCurrency(effectiveFx,"ARS")}`:"Sin cotización"}</b><p style={{margin:"5px 0 9px",fontSize:10,lineHeight:1.45,color:"var(--muted)"}}>{pricing.fxMode==="automatic"?`Automática · ${fx?.source||"Banco Nación · dólar billete venta"}${fx?.asOf?` · ${fx.asOf}`:""}${fx?.updatedAtLocal?` · ${fx.updatedAtLocal}`:""}`:"Manual · definida por el hotel"}</p><div style={{display:"flex",gap:6}}><button type="button" style={tinyButton} disabled={!isOwner||saving==="fx"} onClick={()=>saveFxMode("automatic")}>Automática</button><button type="button" style={tinyButton} disabled={!isOwner||saving==="fx"} onClick={()=>saveFxMode("manual")}>Manual</button><button type="button" style={tinyButton} disabled={fxLoading} onClick={loadFx}>{fxLoading?"…":"↻"}</button></div>{pricing.fxMode==="manual"?<div style={{display:"flex",gap:6,marginTop:8}}><input type="number" min="1" step="0.01" value={manualRate} onChange={e=>setManualRate(e.target.value)} placeholder="ARS por USD" style={{...inputStyle,width:"100%",fontSize:13}}/><button type="button" style={tinyButton} disabled={!isOwner||saving==="fx"} onClick={()=>saveFxMode("manual")}>Guardar</button></div>:null}</div>
      <div style={taxCard}><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".08em",color:"#278452"}}>PRECIOS E IVA</small><b style={{display:"block",marginTop:5,fontSize:12}}>{priceTaxCaption(taxes)}</b><p style={{margin:"5px 0 0",fontSize:10,lineHeight:1.45,color:"var(--muted)"}}>Precio final en {pricing.rateCurrency}; IVA interno.</p></div>
      <div style={card}><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".08em",color:"var(--accent)"}}>REDONDEO</small><b style={{display:"block",marginTop:5,fontSize:12}}>Cambios porcentuales hacia arriba</b><button type="button" style={{...tinyButton,width:"100%",marginTop:8}} disabled={!isOwner||saving==="rounding"} onClick={toggleRateRounding}>{roundUp?"Activado":"Desactivado"}</button></div>
    </aside>
    <main className={s.roomsPanel}>
      <div style={bulkBar}>
        <label style={{display:"grid",gap:4,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>TIPO DE HABITACIÓN<select value={typeFilter} onChange={e=>changeTypeFilter(e.target.value)} style={{height:38,border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",padding:"0 9px"}}><option value="all">Todas las categorías</option>{roomTypes.map(type=><option key={type} value={type}>{type}</option>)}</select></label>
        <button type="button" style={tinyButton} onClick={selectVisible} disabled={!visibleRooms.length}>Seleccionar visibles</button><button type="button" style={tinyButton} onClick={()=>setSelectedRooms(new Set())} disabled={!selectedRooms.size}>Limpiar</button>
        <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:7,minWidth:0,flexWrap:"wrap"}}><span style={{fontSize:10.5,color:"var(--muted)",whiteSpace:"nowrap"}}>{selectionLabel}</span><div style={{display:"flex",alignItems:"center",gap:6,gridColumn:"1/-1",minWidth:0}}><select value={bulkMode} onChange={e=>{setBulkMode(e.target.value);setBulkValue("");setError("")}} aria-label="Tipo de ajuste" style={{height:38,border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10.5,fontWeight:800,padding:"0 8px"}}><option value="price">Nuevo precio</option><option value="percent">Ajuste %</option></select><strong style={{fontSize:13,whiteSpace:"nowrap"}}>{bulkMode==="percent"?"%":pricing.rateCurrency}</strong><input type="number" min={bulkMode==="percent"?"-99.99":"0"} step={bulkMode==="percent"?"0.1":pricing.rateCurrency==="USD"?"0.01":"1"} value={bulkValue} onChange={e=>setBulkValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")applyBulkChange()}} placeholder={bulkMode==="percent"?"Ej. 10 o -7":"Nuevo precio"} style={{...inputStyle,width:125,fontSize:13}}/></div></div>
        <button type="button" style={{...tinyButton,height:38,padding:"0 12px",borderColor:"color-mix(in srgb,var(--accent) 35%,var(--line))",background:"color-mix(in srgb,var(--accent) 8%,var(--panelSolid))",color:"var(--accent)"}} onClick={applyBulkChange} disabled={!bulkTargets.length||!selectedDates.length||bulkBusy}>{bulkBusy?"Aplicando…":bulkMode==="percent"?`Aplicar ${bulkValue||"—"}% · ${bulkTargets.length||0} hab.`:`Aplicar precio · ${bulkTargets.length||0} hab.`}</button>
      </div>
      {loading?<div className={s.empty}>Cargando tarifas…</div>:!rooms.length?<div className={s.empty}>Todavía no hay habitaciones activas en esta propiedad.</div>:!visibleRooms.length?<div className={s.empty}>No hay habitaciones activas dentro de la categoría elegida.</div>:visibleRooms.map(room=>{const sample=selectedDates.map(day=>rateMap.get(`${room.id}:${day}`)).filter(Boolean),closed=selectedDates.length>0&&selectedDates.every(day=>rateMap.get(`${room.id}:${day}`)?.stop_sell===true),minStay=sample[0]?.min_stay||1,priceSamples=selectedDates.map(day=>commercialPriceFromNet(Number(rateMap.get(`${room.id}:${day}`)?.price??room.precio??0),taxes)),shownPrice=priceSamples[0]??commercialPriceFromNet(room.precio??0,taxes),mixed=new Set(priceSamples.map(value=>Number(value).toFixed(2))).size>1,equivalent=effectiveFx?convertCurrency(shownPrice,pricing.rateCurrency,otherCurrency,effectiveFx):null,checked=selectedRooms.has(String(room.id));return <article className={s.roomCard} key={room.id} style={checked?{outline:"2px solid color-mix(in srgb,var(--accent) 35%,transparent)",outlineOffset:-2}:undefined}><div className={s.roomIdentity}><input type="checkbox" checked={checked} onChange={()=>toggleRoom(room.id)} aria-label={`Seleccionar habitación ${room.nombre}`} style={{width:16,height:16,accentColor:"var(--accent)"}}/><span className={s.roomIcon}>⌂</span><div><b>{room.nombre}</b><small>{roomType(room)}</small></div></div><div className={s.price}><small>{priceTaxCaption(taxes)} · {pricing.rateCurrency}</small><div style={{display:"flex",alignItems:"center",gap:6}}><strong>{pricing.rateCurrency}</strong><input key={`${room.id}:${selectedDates[0]||"none"}:${selectedDates.at(-1)||"none"}:${shownPrice}:${mixed}:${pricing.rateCurrency}`} type="number" min="0" step={pricing.rateCurrency==="USD"?"0.01":"1"} defaultValue={Math.round(Number(shownPrice||0)*100)/100} disabled={!selectedDates.length||saving===String(room.id)} style={inputStyle} aria-label={`Precio final de ${room.nombre} en ${pricing.rateCurrency}`} onKeyDown={event=>{if(event.key==="Enter")event.currentTarget.blur()}} onBlur={event=>{const next=Number(event.currentTarget.value);if(Number.isFinite(next)&&next>=0&&Math.abs(next-Number(shownPrice||0))>.009)mutateRoom(room,{commercialPrice:next})}}/></div><small>{equivalent!=null?`≈ ${formatCurrency(equivalent,otherCurrency)} · 1 USD = ${formatCurrency(effectiveFx,"ARS")}`:"Cotización no disponible"}</small><small>{mixed?`Hay precios distintos en las ${selectedDates.length} fechas. Escribir uno los unifica.`:`${selectedDates.length||0} fecha${selectedDates.length===1?"":"s"} seleccionada${selectedDates.length===1?"":"s"}`}</small></div><label className={s.minStay}><span>Mín. estadía</span><input type="number" min="1" max="365" defaultValue={minStay} disabled={!selectedDates.length} onBlur={e=>mutateRoom(room,{minStay:Math.max(1,Number(e.target.value)||1)})}/></label><button className={closed?s.closed:s.opened} onClick={()=>mutateRoom(room,{open:closed})} disabled={!selectedDates.length||saving===String(room.id)}>{saving===String(room.id)?"Guardando…":closed?"Cerrado · abrir":"Abierto · cerrar"}</button></article>})}
    </main></div>
  </section>
}
