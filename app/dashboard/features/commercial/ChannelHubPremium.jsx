"use client"

import{useEffect,useMemo,useState}from"react"
import{addDays,isoDate,money,shortDate}from"../../core/formatters"
import{dispatchChannelQueue,loadChannelHub,mappingState,prepareConnectivityHub,queueChannelFullSync,saveChannelMapping,saveChannelOverride,saveDistributionCell,testChannelAdapter}from"../../services/channelHub"
import s from"./channel-hub-premium.module.css"

const CHANNELS=[
  ["booking.com","Booking.com","Reservas + ARI"],
  ["expedia","Expedia","Reservas + ARI"],
  ["airbnb","Airbnb","Reservas + disponibilidad"],
  ["agoda","Agoda","Reservas + ARI"],
  ["despegar","Despegar","Preparado para adapter"],
  ["trip.com","Trip.com","Preparado para adapter"]
]
const tabs=[["inventory","Inventario"],["mapping","Mapeo"],["channels","Canales"],["queue","Sincronización"]]
const tri=v=>v===null?"inherit":v?"yes":"no"
const triValue=v=>v==="inherit"?null:v==="yes"

export default function ChannelHubPremium({propertyId,userId,canManage=false}){
  const[start,setStart]=useState(isoDate()),[data,setData]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState(""),[tab,setTab]=useState("inventory"),[editor,setEditor]=useState(null),[mappingEditor,setMappingEditor]=useState(null),[override,setOverride]=useState(null)
  const end=useMemo(()=>addDays(start,13),[start]),days=useMemo(()=>Array.from({length:14},(_,i)=>addDays(start,i)),[start])
  async function reload(){setLoading(true);setError("");try{setData(await loadChannelHub({propertyId,start,end}))}catch(e){setError(e?.message||"No se pudo cargar el Channel Manager.")}finally{setLoading(false)}}
  useEffect(()=>{if(propertyId)reload()},[propertyId,start])
  const types=useMemo(()=>[...new Set((data?.snapshot||[]).map(x=>x.room_type))],[data]),snapMap=useMemo(()=>new Map((data?.snapshot||[]).map(x=>[`${x.room_type}:${x.stay_date}`,x])),[data]),connection=data?.connection,queueCounts=data?.queue?.counts||{},mappingReady=types.filter(t=>mappingState(data?.mappings||[],t).ready).length,totalCapacity=types.reduce((sum,t)=>sum+Number(snapMap.get(`${t}:${days[0]}`)?.capacity||0),0)
  function flash(text){setNotice(text);setTimeout(()=>setNotice(""),3600)}
  async function run(key,fn,success){if(busy)return;setBusy(key);setError("");try{const result=await fn();if(success)flash(typeof success==="function"?success(result):success);await reload();return result}catch(e){setError(e?.message||"No se pudo completar la acción.")}finally{setBusy("")}}
  async function prepare(){await run("prepare",()=>prepareConnectivityHub(propertyId),"Llena Connect preparado en sandbox. Todavía no publica nada fuera del PMS.")}
  async function fullSync(){await run("queue",()=>queueChannelFullSync({propertyId,start,end:addDays(start,365)}),"Sincronización completa encolada.")}
  async function dispatch(){await run("dispatch",()=>dispatchChannelQueue(propertyId),r=>r?.idle?"No hay cambios pendientes.":`Se enviaron ${r?.items||0} cambios al adaptador.`)}
  async function test(){await run("test",()=>testChannelAdapter(propertyId),r=>`Adaptador respondió correctamente · ${r?.properties_seen||0} propiedades visibles.`)}
  async function saveCell(e){e.preventDefault();await run("cell",()=>saveDistributionCell({propertyId,userId,draft:editor}),"Tarifa y restricciones guardadas.");setEditor(null)}
  async function saveMap(e){e.preventDefault();await run("mapping",()=>saveChannelMapping({propertyId,connectionId:connection?.id,roomType:mappingEditor.roomType,externalRoomTypeId:mappingEditor.room,externalRatePlanId:mappingEditor.rate}),"Mapeo guardado.");setMappingEditor(null)}
  async function saveRule(e){e.preventDefault();await run("override",()=>saveChannelOverride({propertyId,connectionId:connection?.id,draft:override}),"Regla por canal guardada en la capa de distribución.");setOverride(null)}
  if(loading&&!data)return <div className={s.loading}>Preparando distribución…</div>
  return <div className={s.page}>
    <section className={s.hero}>
      <div><small>LLENA CONNECT · CHANNEL MANAGER</small><h2>Una sola fuente de inventario. Una capa para todos los canales.</h2><p>El PMS no habla distinto con cada OTA. Habitación Llena normaliza disponibilidad, tarifas, restricciones y reservas; los adaptadores quedan por debajo y se pueden reemplazar sin cambiar la operación del hotel.</p></div>
      <div className={s.heroActions}>{!connection&&canManage&&<button onClick={prepare} disabled={busy==="prepare"}>Preparar Llena Connect</button>}{connection&&<span data-state={connection.status}>{connection.status==="connected"?"Hub conectado":"Hub en sandbox"}</span>}</div>
    </section>

    <section className={s.architecture}><div><b>PMS</b><span>Reservas · Planning · Revenue</span></div><i>→</i><div className={s.hub}><b>Llena Connect</b><span>modelo canónico + cola + mapeo</span></div><i>→</i><div><b>Adaptadores</b><span>mayorista hoy · directos mañana</span></div><i>→</i><div><b>OTAs</b><span>Booking · Expedia · Airbnb · más</span></div></section>

    <section className={s.metrics}>
      <article><small>Inventario físico</small><b>{totalCapacity}</b><span>{types.length} tipologías</span></article>
      <article><small>Mapeo listo</small><b>{mappingReady}/{types.length||0}</b><span>habitación + tarifa</span></article>
      <article><small>Cola pendiente</small><b>{Number(queueCounts.pending||0)+Number(queueCounts.retry||0)}</b><span>cambios agrupados</span></article>
      <article><small>Último envío</small><b>{connection?.last_sync_at?new Date(connection.last_sync_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}):"—"}</b><span>{connection?.last_sync_at?shortDate(connection.last_sync_at):"todavía sin publicar"}</span></article>
    </section>

    <nav className={s.tabs}>{tabs.map(([id,label])=><button key={id} className={tab===id?s.active:""} onClick={()=>setTab(id)}>{label}</button>)}</nav>
    {error&&<div className={s.error}>{error}</div>}{notice&&<div className={s.notice}>{notice}</div>}

    {tab==="inventory"&&<section className={s.panel}>
      <header><div><small>ARI CANÓNICO</small><h3>Disponibilidad, tarifa y restricciones por tipología</h3><p>La disponibilidad descuenta reservas, bloqueos físicos y cupos de grupos. Las tarifas de distribución pueden independizarse del precio de una habitación concreta.</p></div><div className={s.dateNav}><button onClick={()=>setStart(addDays(start,-14))}>←</button><button onClick={()=>setStart(isoDate())}>Hoy</button><button onClick={()=>setStart(addDays(start,14))}>→</button></div></header>
      <div className={s.matrix}><div className={s.corner}>Tipología</div>{days.map(d=><div className={s.day} key={d}><b>{new Date(`${d}T12:00:00`).toLocaleDateString("es-AR",{weekday:"short"})}</b><span>{new Date(`${d}T12:00:00`).getDate()}</span></div>)}{types.map(type=><RoomRow key={type} type={type} days={days} snapMap={snapMap} canManage={canManage} onEdit={setEditor}/>)}</div>
      <footer className={s.legend}><span><i data-tone="ok"/>disponible</span><span><i data-tone="low"/>última unidad</span><span><i data-tone="closed"/>agotado / stop sell</span></footer>
    </section>}

    {tab==="mapping"&&<section className={s.panel}>
      <header><div><small>MAPEO INTERNO ↔ EXTERNO</small><h3>El hotel trabaja con nombres; el hub trabaja con IDs estables.</h3><p>Esta pantalla desacopla Habitación Llena del proveedor mayorista. Si mañana cambiamos de infraestructura, el PMS y la experiencia del hotel no cambian.</p></div></header>
      {!connection?<Empty text="Primero prepará Llena Connect."/>:<div className={s.mappingList}>{types.map(type=>{const m=mappingState(data?.mappings||[],type);return <article key={type}><div><small>TIPOLOGÍA LOCAL</small><h4>{type}</h4><span>{m.ready?"Mapeo completo":"Falta completar IDs externos"}</span></div><div className={s.mappingIds}><code>{m.room||"room_type —"}</code><code>{m.rate||"rate_plan —"}</code></div>{canManage&&<button onClick={()=>setMappingEditor({roomType:type,room:m.room,rate:m.rate})}>{m.ready?"Editar":"Mapear"}</button>}</article>})}</div>}
    </section>}

    {tab==="channels"&&<section className={s.panel}>
      <header><div><small>REGLAS AISLADAS POR CANAL</small><h3>Subí Booking sin tocar venta directa.</h3><p>Las diferencias por canal viven como overrides sobre el inventario canónico. No contaminan la tarifa base ni obligan a duplicar calendarios.</p></div></header>
      <div className={s.channelGrid}>{CHANNELS.map(([code,name,note])=>{const count=(data?.overrides||[]).filter(x=>x.channel_code===code).length;return <article key={code}><div><b>{name}</b><span>{note}</span></div><strong>{count?`${count} reglas`:"Hereda base"}</strong>{canManage&&connection&&<button onClick={()=>setOverride({channel_code:code,room_type:types[0]||"",stay_date:start,price_mode:"inherit",price_value:"",min_stay:"",max_stay:"",stop_sell:null,closed_to_arrival:null,closed_to_departure:null,notes:""})}>＋ Regla</button>}</article>})}</div>
      <div className={s.guardrail}><b>Sin conexiones ficticias.</b><p>Guardar una regla prepara el dato. Solo se publica cuando el adaptador y el canal estén realmente mapeados/certificados.</p></div>
    </section>}

    {tab==="queue"&&<section className={s.panel}>
      <header><div><small>COLA ANTI-OVERBOOKING</small><h3>Cambios agrupados, reintentos y trazabilidad.</h3><p>Las reservas, bloqueos y cambios tarifarios generan eventos automáticamente. La cola los compacta para no bombardear al proveedor ni perder cambios.</p></div>{canManage&&connection&&<div className={s.syncActions}><button onClick={fullSync} disabled={busy==="queue"}>Encolar 1 año</button><button onClick={dispatch} disabled={busy==="dispatch"}>Enviar pendientes</button>{connection?.credential_secret_id&&<button onClick={test} disabled={busy==="test"}>Diagnóstico</button>}</div>}</header>
      <div className={s.queueList}>{(data?.queue?.rows||[]).length?(data.queue.rows.map(row=><article key={row.id}><span data-status={row.status}>{row.status}</span><div><b>{row.event_type} · {row.reason||"cambio"}</b><small>{shortDate(row.date_from)} → {shortDate(row.date_to)} · intento {row.attempts||0}</small>{row.last_error&&<em>{row.last_error}</em>}</div><time>{new Date(row.created_at).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"})}</time></article>)):<Empty text="La cola está limpia."/>}</div>
      <div className={s.inbound}><h4>Reservas entrantes</h4><p>El inbox está listo para deduplicar revisiones externas antes de tocar el PMS. La importación automática se activa recién cuando tengamos el primer feed certificado y podamos validar altas, modificaciones y cancelaciones con datos reales.</p>{(data?.inbox||[]).slice(0,6).map(x=><span key={x.id}>{x.channel_code||x.event_type} · {x.status} · {x.external_reservation_id||x.provider_event_id}</span>)}</div>
    </section>}

    {editor&&<Modal title={`${editor.room_type} · ${shortDate(editor.stay_date)}`} onClose={()=>setEditor(null)} onSubmit={saveCell}><div className={s.formGrid}><Field label="Precio base"><input type="number" min="0" value={editor.base_price??""} onChange={e=>setEditor(x=>({...x,base_price:e.target.value}))}/></Field><Field label="Estadía mínima"><input type="number" min="1" value={editor.min_stay||1} onChange={e=>setEditor(x=>({...x,min_stay:e.target.value}))}/></Field><Field label="Estadía máxima (0 = libre)"><input type="number" min="0" value={editor.max_stay||0} onChange={e=>setEditor(x=>({...x,max_stay:e.target.value}))}/></Field><Field label="Restricciones"><div className={s.checks}><label><input type="checkbox" checked={!!editor.stop_sell} onChange={e=>setEditor(x=>({...x,stop_sell:e.target.checked}))}/> Stop sell</label><label><input type="checkbox" checked={!!editor.closed_to_arrival} onChange={e=>setEditor(x=>({...x,closed_to_arrival:e.target.checked}))}/> CTA</label><label><input type="checkbox" checked={!!editor.closed_to_departure} onChange={e=>setEditor(x=>({...x,closed_to_departure:e.target.checked}))}/> CTD</label></div></Field></div><ModalFooter busy={busy==="cell"}/></Modal>}

    {mappingEditor&&<Modal title={`Mapear ${mappingEditor.roomType}`} onClose={()=>setMappingEditor(null)} onSubmit={saveMap}><div className={s.formGrid}><Field label="ID externo de habitación"><input value={mappingEditor.room} onChange={e=>setMappingEditor(x=>({...x,room:e.target.value}))} placeholder="room_type UUID"/></Field><Field label="ID externo de tarifa estándar"><input value={mappingEditor.rate} onChange={e=>setMappingEditor(x=>({...x,rate:e.target.value}))} placeholder="rate_plan UUID"/></Field></div><p className={s.helper}>Estos IDs pertenecen al adaptador oculto. El hotel no necesita trabajar con ellos en la operación diaria.</p><ModalFooter busy={busy==="mapping"}/></Modal>}

    {override&&<Modal title={`Regla · ${CHANNELS.find(x=>x[0]===override.channel_code)?.[1]||override.channel_code}`} onClose={()=>setOverride(null)} onSubmit={saveRule}><div className={s.formGrid}><Field label="Tipología"><select value={override.room_type} onChange={e=>setOverride(x=>({...x,room_type:e.target.value}))}>{types.map(t=><option key={t}>{t}</option>)}</select></Field><Field label="Fecha"><input type="date" value={override.stay_date} onChange={e=>setOverride(x=>({...x,stay_date:e.target.value}))}/></Field><Field label="Precio"><select value={override.price_mode} onChange={e=>setOverride(x=>({...x,price_mode:e.target.value}))}><option value="inherit">Heredar tarifa base</option><option value="absolute">Precio fijo</option><option value="delta_amount">Diferencia $</option><option value="delta_percent">Diferencia %</option></select></Field><Field label="Valor"><input type="number" value={override.price_value} disabled={override.price_mode==="inherit"} onChange={e=>setOverride(x=>({...x,price_value:e.target.value}))}/></Field><Field label="Mínimo"><input type="number" min="1" value={override.min_stay} placeholder="Heredar" onChange={e=>setOverride(x=>({...x,min_stay:e.target.value}))}/></Field><Field label="Máximo"><input type="number" min="0" value={override.max_stay} placeholder="Heredar" onChange={e=>setOverride(x=>({...x,max_stay:e.target.value}))}/></Field><Tri label="Stop sell" value={override.stop_sell} onChange={v=>setOverride(x=>({...x,stop_sell:v}))}/><Tri label="CTA" value={override.closed_to_arrival} onChange={v=>setOverride(x=>({...x,closed_to_arrival:v}))}/><Tri label="CTD" value={override.closed_to_departure} onChange={v=>setOverride(x=>({...x,closed_to_departure:v}))}/></div><ModalFooter busy={busy==="override"}/></Modal>}
  </div>
}

function RoomRow({type,days,snapMap,canManage,onEdit}){return <><div className={s.roomType}><b>{type}</b><span>{snapMap.get(`${type}:${days[0]}`)?.capacity||0} unidades</span></div>{days.map(day=>{const x=snapMap.get(`${type}:${day}`)||{},tone=x.stop_sell||Number(x.available||0)<=0?"closed":Number(x.available||0)===1?"low":"ok";return <button key={day} className={s.cell} data-tone={tone} disabled={!canManage} onClick={()=>onEdit({room_type:type,stay_date:day,base_price:x.base_price??0,min_stay:x.min_stay||1,max_stay:x.max_stay||0,stop_sell:!!x.stop_sell,closed_to_arrival:!!x.closed_to_arrival,closed_to_departure:!!x.closed_to_departure})}><b>{x.available??0}/{x.capacity??0}</b><span>{money(x.base_price||0)}</span><small>{x.stop_sell?"STOP":x.closed_to_arrival?"CTA":x.closed_to_departure?"CTD":`mín ${x.min_stay||1}`}</small></button>})}</>}
function Modal({title,onClose,onSubmit,children}){return <div className={s.shade} onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className={s.modal} onSubmit={onSubmit}><header><h3>{title}</h3><button type="button" onClick={onClose}>×</button></header>{children}</form></div>}
function Field({label,children}){return <label className={s.field}><span>{label}</span>{children}</label>}
function Tri({label,value,onChange}){return <Field label={label}><select value={tri(value)} onChange={e=>onChange(triValue(e.target.value))}><option value="inherit">Heredar</option><option value="yes">Sí</option><option value="no">No</option></select></Field>}
function ModalFooter({busy}){return <footer className={s.modalFooter}><button disabled={busy}>{busy?"Guardando…":"Guardar"}</button></footer>}
function Empty({text}){return <div className={s.empty}>{text}</div>}
