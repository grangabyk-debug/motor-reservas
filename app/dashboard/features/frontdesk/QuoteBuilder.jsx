"use client"

import{useEffect,useMemo,useState}from"react"
import{money}from"../../core/formatters"
import q from"./quote-builder.module.css"

const CATEGORY_ORDER={parking:0,pet:1,service:2,crib:3,transfer:4,amenity:5,spa:6,event_space:7,meeting_room:8,equipment:9,sport:10,other:11}
const CATEGORY_LABELS={parking:"Cochera",pet:"Mascota",service:"Servicio",crib:"Cuna",transfer:"Transfer",amenity:"Amenity",spa:"SPA",event_space:"Salón",meeting_room:"Sala",equipment:"Equipamiento",sport:"Deporte",other:"Otro"}
const MODE_LABELS={per_use:"por uso",per_stay:"por estadía",per_hour:"por hora",per_day:"por día",per_night:"por noche",per_person:"por persona"}
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))
const localISO=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
const addDays=(iso,days)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);return localISO(d)}
const nightsBetween=(start,end)=>Math.max(1,Math.round((new Date(`${end}T12:00:00`)-new Date(`${start}T12:00:00`))/86400000)||1)
const prettyDate=iso=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${iso}T12:00:00`))

function multiplier(mode,nights,guests,qty){const amount=Math.max(1,Number(qty)||1);if(mode==="per_night"||mode==="per_day")return Math.max(1,nights)*amount;if(mode==="per_person")return Math.max(1,guests)*amount;return amount}

export default function QuoteBuilder({rooms=[],resources=[],settings={},onBack}){
  const currency=settings?.currency||settings?.moneda||"ARS",today=useMemo(()=>localISO(new Date()),[])
  const roomTypes=useMemo(()=>{const map=new Map();rooms.filter(r=>r.activa!==false).forEach(room=>{const name=String(room.tipo||"Habitación").trim()||"Habitación";if(!map.has(name))map.set(name,{name,prices:[],parking:[],capacity:0,count:0});const item=map.get(name);item.count++;item.capacity=Math.max(item.capacity,Number(room.capacidad||1));if(Number(room.precio||0)>0)item.prices.push(Number(room.precio));if(Number(room.cochera_precio||0)>0)item.parking.push(Number(room.cochera_precio))});return[...map.values()].map(item=>({...item,rate:item.prices.length?Math.round(item.prices.reduce((a,b)=>a+b,0)/item.prices.length):0,parkingRate:item.parking.length?Math.round(item.parking.reduce((a,b)=>a+b,0)/item.parking.length):0})).sort((a,b)=>a.name.localeCompare(b.name,"es"))},[rooms])
  const[type,setType]=useState(roomTypes[0]?.name||""),[checkIn,setCheckIn]=useState(today),[checkOut,setCheckOut]=useState(addDays(today,1)),[guests,setGuests]=useState(2),[guestName,setGuestName]=useState(""),[selectedExtras,setSelectedExtras]=useState({}),[extraSearch,setExtraSearch]=useState(""),[extrasOpen,setExtrasOpen]=useState(false),[notice,setNotice]=useState("")
  const selectedType=roomTypes.find(item=>item.name===type)||roomTypes[0]||null,nights=nightsBetween(checkIn,checkOut),nightlyRate=Math.max(0,Number(selectedType?.rate)||0)
  useEffect(()=>{if(!type&&roomTypes[0])setType(roomTypes[0].name)},[roomTypes,type])

  const quoteExtras=useMemo(()=>{const active=resources.filter(r=>r.active!==false&&Number(r.price||0)>=0).map(r=>({...r,key:String(r.id),price:Number(r.price||0)})).sort((a,b)=>(CATEGORY_ORDER[a.category]??99)-(CATEGORY_ORDER[b.category]??99)||String(a.name||"").localeCompare(String(b.name||""),"es"));if(!active.some(r=>r.category==="parking")&&selectedType?.parkingRate>0)active.unshift({key:"room-parking",id:"room-parking",name:"Cochera",category:"parking",price:selectedType.parkingRate,charge_mode:"per_night",active:true});return active},[resources,selectedType?.parkingRate])
  const filteredExtras=useMemo(()=>{const needle=extraSearch.trim().toLowerCase();if(!needle)return quoteExtras;return quoteExtras.filter(extra=>`${extra.name||""} ${CATEGORY_LABELS[extra.category]||extra.category||""} ${MODE_LABELS[extra.charge_mode]||""}`.toLowerCase().includes(needle))},[quoteExtras,extraSearch])
  const roomSubtotal=nightlyRate*nights
  const selectedLines=quoteExtras.filter(extra=>selectedExtras[extra.key]).map(extra=>{const qty=selectedExtras[extra.key]||1,total=extra.price*multiplier(extra.charge_mode,nights,guests,qty);return{...extra,qty,total}})
  const total=roomSubtotal+selectedLines.reduce((sum,line)=>sum+line.total,0)
  const summaryLines=[`${settings?.hotel_name||"Habitación Llena"} · Presupuesto`,guestName.trim()?`A nombre de: ${guestName.trim()}`:"",`Entrada: ${prettyDate(checkIn)}`,`Salida: ${prettyDate(checkOut)}`,`Estadía: ${nights} noche${nights===1?"":"s"}`,`Habitación: ${selectedType?.name||"Sin seleccionar"}`,`Huéspedes: ${Math.max(1,Number(guests)||1)}`,`Tarifa: ${money(nightlyRate,currency)} por noche`,`Alojamiento: ${money(roomSubtotal,currency)}`,...selectedLines.map(line=>`${line.name}: ${money(line.total,currency)} (${MODE_LABELS[line.charge_mode]||line.charge_mode})`),`TOTAL: ${money(total,currency)}`].filter(Boolean)
  const flash=text=>{setNotice(text);setTimeout(()=>setNotice(""),2600)}
  async function copyQuote(){try{await navigator.clipboard.writeText(summaryLines.join("\n"));flash("Presupuesto copiado. Listo para pegar en WhatsApp o email.")}catch{flash("No se pudo copiar automáticamente.")}}
  function printQuote(){const w=window.open("","_blank","width=820,height=720");if(!w)return flash("El navegador bloqueó la impresión.");w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Presupuesto ${esc(settings?.hotel_name||"Hotel")}</title><style>body{font-family:Arial,sans-serif;color:#162033;padding:42px;max-width:760px;margin:auto}small{color:#6f7d91}h1{font-size:30px;margin:8px 0 28px}.row{display:flex;justify-content:space-between;gap:24px;padding:11px 0;border-bottom:1px solid #e7ebf1}.total{margin-top:22px;padding:18px;border-radius:14px;background:#f3f7ff;font-size:25px;font-weight:800;display:flex;justify-content:space-between}.note{margin-top:26px;color:#7a8798;font-size:12px}</style></head><body><small>${esc(settings?.hotel_name||"Habitación Llena")}</small><h1>Presupuesto de estadía</h1>${guestName.trim()?`<div class="row"><span>A nombre de</span><b>${esc(guestName.trim())}</b></div>`:""}<div class="row"><span>Entrada</span><b>${esc(prettyDate(checkIn))}</b></div><div class="row"><span>Salida</span><b>${esc(prettyDate(checkOut))}</b></div><div class="row"><span>Estadía</span><b>${nights} noche(s) · ${Math.max(1,Number(guests)||1)} huésped(es)</b></div><div class="row"><span>Tipo de habitación</span><b>${esc(selectedType?.name||"")}</b></div><div class="row"><span>Tarifa por noche</span><b>${esc(money(nightlyRate,currency))}</b></div>${selectedLines.map(line=>`<div class="row"><span>${esc(line.name)}</span><b>${esc(money(line.total,currency))}</b></div>`).join("")}<div class="total"><span>Total</span><span>${esc(money(total,currency))}</span></div><p class="note">Presupuesto informativo sujeto a disponibilidad y confirmación del hotel.</p><script>onload=()=>print()</script></body></html>`);w.document.close()}
  function addExtra(key){setSelectedExtras(current=>current[key]?current:{...current,[key]:1});setExtraSearch("")}
  function removeExtra(key){setSelectedExtras(current=>Object.fromEntries(Object.entries(current).filter(([id])=>id!==key)))}
  function setExtraQty(key,value){setSelectedExtras(current=>({...current,[key]:Math.max(1,Number(value)||1)}))}
  function changeCheckIn(value){if(!value)return;const keepNights=nights;setCheckIn(value);if(checkOut<=value)setCheckOut(addDays(value,keepNights));else setCheckOut(addDays(value,keepNights))}
  function changeCheckOut(value){if(!value)return;if(value<=checkIn)setCheckOut(addDays(checkIn,1));else setCheckOut(value)}

  return <div className={q.page}>
    <section className={q.hero}><div><small>PRESUPUESTO RÁPIDO</small><h2>Cotizá una estadía en segundos.</h2></div><button type="button" onClick={onBack}>← Volver al panel</button></section>
    <div className={q.layout}>
      <section className={q.formCard}>
        <div className={q.sectionTitle}><span>1</span><div><small>ESTADÍA</small><h3>Datos básicos</h3></div></div>
        <div className={q.fields}>
          <label><span>Fecha de entrada</span><input type="date" min={today} value={checkIn} onChange={e=>changeCheckIn(e.target.value)}/></label>
          <label><span>Fecha de salida</span><input type="date" min={addDays(checkIn,1)} value={checkOut} onChange={e=>changeCheckOut(e.target.value)}/></label>
          <label className={q.nightsField}><span>Noches</span><strong>{nights}</strong></label>
          <label><span>Tipo de habitación</span><select value={type} onChange={e=>setType(e.target.value)}>{roomTypes.map(item=><option key={item.name} value={item.name}>{item.name} · {item.count} hab.</option>)}</select></label>
          <label><span>Pasajeros</span><input type="number" min="1" max="20" value={guests} onChange={e=>setGuests(Math.max(1,Number(e.target.value)||1))}/></label>
          <label><span>A nombre de · opcional</span><input value={guestName} onChange={e=>setGuestName(e.target.value)} placeholder="Nombre del huésped"/></label>
        </div>
        <div className={q.sectionTitle}><span>2</span><div><small>EXTRAS</small><h3>Sumá servicios</h3></div></div>
        <div className={q.extraPicker}>
          <div className={q.extraSearch}><span>⌕</span><input value={extraSearch} onChange={e=>{setExtraSearch(e.target.value);setExtrasOpen(true)}} onFocus={()=>setExtrasOpen(true)} placeholder="Buscar y agregar extras: cochera, mascota, late check-out…"/><button type="button" onClick={()=>setExtrasOpen(v=>!v)} aria-label="Mostrar extras">{extrasOpen?"⌃":"⌄"}</button></div>
          {extrasOpen&&<div className={q.extraMenu}>{filteredExtras.length?filteredExtras.map(extra=>{const selected=Boolean(selectedExtras[extra.key]);return <button type="button" key={extra.key} className={selected?q.extraMenuSelected:""} onClick={()=>selected?removeExtra(extra.key):addExtra(extra.key)}><i>{selected?"✓":"＋"}</i><span><b>{extra.name}</b><small>{CATEGORY_LABELS[extra.category]||"Extra"} · {extra.price?money(extra.price,currency):"Sin cargo"} · {MODE_LABELS[extra.charge_mode]||extra.charge_mode}</small></span></button>}):<p>No encontramos extras con esa búsqueda.</p>}</div>}
        </div>
        <div className={q.selectedExtras}>{selectedLines.map(line=><article key={line.key}><div><b>{line.name}</b><small>{money(line.price,currency)} · {MODE_LABELS[line.charge_mode]||line.charge_mode}</small></div><label><span>Cant.</span><input type="number" min="1" max="20" value={selectedExtras[line.key]||1} onChange={e=>setExtraQty(line.key,e.target.value)}/></label><strong>{money(line.total,currency)}</strong><button type="button" onClick={()=>removeExtra(line.key)} aria-label={`Quitar ${line.name}`}>×</button></article>)}</div>
        {!quoteExtras.length&&<p className={q.emptyExtras}>Todavía no hay extras configurados. Podés cargarlos desde Operación → Extras & recursos.</p>}
      </section>
      <aside className={q.summaryCard}>
        <div className={q.summaryTop}><small>PRESUPUESTO</small><h3>{selectedType?.name||"Elegí una habitación"}</h3><p>{prettyDate(checkIn)} → {prettyDate(checkOut)} · {nights} noche(s) · {Math.max(1,Number(guests)||1)} huésped(es)</p></div>
        <div className={q.breakdown}><div><span>Tarifa por noche</span><b>{money(nightlyRate,currency)}</b></div><div><span>Alojamiento · {nights} noche(s)</span><b>{money(roomSubtotal,currency)}</b></div>{selectedLines.map(line=><div key={line.key}><span>{line.name}</span><b>{money(line.total,currency)}</b></div>)}</div>
        <div className={q.total}><span>Total estimado</span><b>{money(total,currency)}</b><small>Presupuesto informativo · sujeto a disponibilidad</small></div>
        <div className={q.actions}><button type="button" className={q.primary} onClick={copyQuote}>Copiar presupuesto</button><button type="button" onClick={printQuote}>Imprimir</button></div>{notice&&<p className={q.notice}>{notice}</p>}
      </aside>
    </div>
  </div>
}
