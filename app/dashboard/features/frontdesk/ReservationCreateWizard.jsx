"use client"

import{useEffect,useMemo,useState}from"react"
import{addDays,money}from"../../core/formatters"
import{reservationTotal}from"./reservationModel"
import s from"./reservation-create-wizard.module.css"

const STEPS=["Fecha","Habitación","Titular","Detalles"]
const channels=["Directa","Booking.com","Expedia","Airbnb","Agencia","WhatsApp","Teléfono","Walk-in"]

function unique(values){return[...new Set(values.map(String).filter(Boolean))]}

export default function ReservationCreateWizard({initial,rooms=[],busy,onClose,onSave}){
  const[draft,setDraft]=useState(()=>({...initial})),[step,setStep]=useState(0),[error,setError]=useState("")
  useEffect(()=>{setDraft(current=>{if(current.start&&!current.end)return{...current,end:addDays(current.start,1)};return current})},[])
  const room=rooms.find(r=>String(r.id)===String(draft.roomId)),totals=useMemo(()=>reservationTotal(draft,room),[draft,room]),selectedIds=unique([draft.roomId,...(draft.additionalRooms||[]).map(x=>x.roomId)])
  const nights=totals.billingUnits||0
  function change(key,value){setDraft(x=>({...x,[key]:value}));setError("")}
  function toggleRoom(target){const id=String(target.id),exists=selectedIds.includes(id);setDraft(current=>{
    const primary=String(current.roomId||""),additional=[...(current.additionalRooms||[])]
    if(exists){
      if(primary===id){const next=additional[0],rest=additional.slice(1);return{...current,roomId:next?String(next.roomId):"",rate:next?.rate??"",additionalRooms:rest}}
      return{...current,additionalRooms:additional.filter(x=>String(x.roomId)!==id)}
    }
    if(!primary)return{...current,roomId:id,rate:current.rate!==""?current.rate:Number(target.precio||0)}
    return{...current,additionalRooms:[...additional,{roomId:id,rate:Number(target.precio||0),name:target.nombre||"",type:target.tipo||"Habitación"}]}
  })}
  function validate(target=step){
    if(target===0){if(!draft.start||!draft.end)return"Elegí fecha de entrada y salida.";if(draft.end<=draft.start&&draft.stayType!=="day_use")return"La salida tiene que ser posterior a la entrada.";if(draft.stayType==="day_use"&&draft.end!==draft.start)return"Day Use debe comenzar y terminar el mismo día."}
    if(target===1&&!draft.roomId)return"Seleccioná al menos una habitación."
    if(target===2&&!draft.guest?.trim())return"Ingresá el titular de la reserva."
    return""
  }
  function next(){const problem=validate(step);if(problem){setError(problem);return}setStep(x=>Math.min(3,x+1))}
  function back(){setError("");setStep(x=>Math.max(0,x-1))}
  async function submit(e){e.preventDefault();for(let i=0;i<3;i++){const problem=validate(i);if(problem){setStep(i);setError(problem);return}}const saved=await onSave?.(draft);if(!saved)setError("No se pudo crear la reserva. Revisá disponibilidad y datos.")}
  return <div className={s.shade} onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <form className={s.panel} onSubmit={submit}>
      <header className={s.header}><div><small>NUEVA RESERVA</small><h2>Crear reserva</h2></div><button type="button" onClick={onClose}>×</button></header>
      <div className={s.steps}>{STEPS.map((label,i)=><button type="button" key={label} className={`${s.step} ${i===step?s.active:""} ${i<step?s.done:""}`} onClick={()=>i<step&&setStep(i)}><i>{i<step?"✓":i+1}</i><span>{label}</span></button>)}</div>
      <main className={s.body}>
        {step===0&&<section className={s.section}><div className={s.title}><small>PASO 1</small><h3>¿Cuándo se aloja?</h3><p>Definí la estadía antes de buscar habitación.</p></div><div className={s.fields}><label><span>Entrada</span><input type="date" value={draft.start||""} onChange={e=>change("start",e.target.value)}/></label><label><span>Salida</span><input type="date" value={draft.end||""} onChange={e=>change("end",e.target.value)}/></label><label><span>Tipo de estadía</span><select value={draft.stayType||"overnight"} onChange={e=>{const value=e.target.value;setDraft(x=>({...x,stayType:value,end:value==="day_use"?(x.start||x.end):x.end}))}}><option value="overnight">Alojamiento</option><option value="day_use">Day Use</option></select></label><label><span>Huéspedes</span><input type="number" min="1" value={draft.pax||1} onChange={e=>change("pax",e.target.value)}/></label><label><span>Hora de llegada</span><input type="time" value={draft.arrivalTime||"14:00"} onChange={e=>change("arrivalTime",e.target.value)}/></label><label><span>Hora de salida</span><input type="time" value={draft.departureTime||"10:00"} onChange={e=>change("departureTime",e.target.value)}/></label></div>{draft.start&&draft.end&&<div className={s.summaryLine}><b>{nights||1}</b><span>{draft.stayType==="day_use"?"Day Use":nights===1?"noche":"noches"}</span><em>{draft.start} → {draft.end}</em></div>}</section>}
        {step===1&&<section className={s.section}><div className={s.title}><small>PASO 2</small><h3>Elegí habitación</h3><p>Podés seleccionar una o varias habitaciones para la misma reserva.</p></div><div className={s.roomGrid}>{rooms.filter(r=>r.activa!==false).map(item=>{const active=selectedIds.includes(String(item.id)),blocked=["mantenimiento","fuera_servicio"].includes(String(item.estado||"").toLowerCase());return <button key={item.id} type="button" disabled={blocked} className={`${s.roomCard} ${active?s.roomActive:""}`} onClick={()=>toggleRoom(item)}><span><b>{item.nombre}</b><small>{item.tipo||"Habitación"}</small></span><em>{blocked?"No disponible":money(item.precio||0,draft.currency||"ARS")}</em>{active&&<i>✓</i>}</button>})}</div>{selectedIds.length>0&&<div className={s.selectedBar}><span><b>{selectedIds.length}</b> {selectedIds.length===1?"habitación":"habitaciones"}</span><strong>{money(totals.stay||0,draft.currency||"ARS")}</strong></div>}</section>}
        {step===2&&<section className={s.section}><div className={s.title}><small>PASO 3</small><h3>¿A nombre de quién?</h3><p>Los datos mínimos primero. El resto se puede completar después.</p></div><div className={s.fields}><label className={s.wide}><span>Nombre y apellido *</span><input autoFocus value={draft.guest||""} onChange={e=>change("guest",e.target.value)} placeholder="Ej. Juan Pérez"/></label><label><span>Teléfono</span><input value={draft.phone||""} onChange={e=>change("phone",e.target.value)} placeholder="+54 9 ..."/></label><label><span>Email</span><input type="email" value={draft.email||""} onChange={e=>change("email",e.target.value)} placeholder="huesped@email.com"/></label><label><span>Documento</span><input value={draft.document||""} onChange={e=>change("document",e.target.value)} placeholder="DNI / Pasaporte"/></label><label><span>Nacionalidad</span><input value={draft.nationality||""} onChange={e=>change("nationality",e.target.value)}/></label></div></section>}
        {step===3&&<section className={s.section}><div className={s.title}><small>PASO 4</small><h3>Últimos detalles</h3><p>Confirmá origen, tarifa y notas antes de crearla.</p></div><div className={s.fields}><label><span>Canal</span><select value={draft.channel||"Directa"} onChange={e=>change("channel",e.target.value)}>{channels.map(x=><option key={x}>{x}</option>)}</select></label><label><span>Tarifa por noche</span><input type="number" min="0" value={draft.rate===""?(room?.precio||0):draft.rate} onChange={e=>change("rate",e.target.value)}/></label><label><span>Moneda</span><select value={draft.currency||"ARS"} onChange={e=>change("currency",e.target.value)}><option>ARS</option><option>USD</option></select></label><label><span>Pago preferido</span><select value={draft.preferredPayment||""} onChange={e=>change("preferredPayment",e.target.value)}><option value="">Sin definir</option><option>Efectivo</option><option>Transferencia</option><option>Mercado Pago</option><option>Tarjeta</option></select></label><label className={s.wide}><span>Notas</span><textarea rows="4" value={draft.notes||""} onChange={e=>change("notes",e.target.value)} placeholder="Pedido especial, horario, observaciones..."/></label></div><div className={s.totalBox}><div><small>ESTADÍA</small><b>{selectedIds.length} hab. · {nights||1} {draft.stayType==="day_use"?"uso":"noches"}</b></div><div><small>TOTAL ESTIMADO</small><strong>{money(totals.total||0,draft.currency||"ARS")}</strong></div>{draft._tentative&&<span>Reserva tentativa</span>}</div></section>}
        {error&&<div className={s.error}>{error}</div>}
      </main>
      <footer className={s.footer}><button type="button" onClick={step===0?onClose:back}>{step===0?"Cancelar":"Atrás"}</button>{step<3?<button type="button" className={s.primary} onClick={next}>Continuar</button>:<button className={s.primary} disabled={busy}>{busy?"Creando…":draft._tentative?"Crear tentativa":"Crear reserva"}</button>}</footer>
    </form>
  </div>
}
