"use client"

import{useMemo,useState}from"react"
import{packagePriceLabel}from"../../services/packages"
import ui from"../../v2.module.css"
import p from"./packages.module.css"

const PRICING=[["fixed_total","Precio total del pack"],["nightly_rate","Tarifa por noche"],["discount_percent","Descuento porcentual"],["discount_amount","Descuento fijo"]]
const MEALS=["Solo alojamiento","Desayuno","Media pensión","Pensión completa","Todo incluido","Personalizado"]
const blank=()=>({name:"",code:"",description:"",room_type:"",meal_plan:"Solo alojamiento",min_nights:1,valid_from:"",valid_to:"",pricing_mode:"fixed_total",price:0,currency:"ARS",included_items:[],active:true,sort_order:0})
const toEditor=item=>({...item,included_items:Array.isArray(item.included_items)?item.included_items:[]})
const validity=item=>item.valid_from||item.valid_to?`${item.valid_from||"Ahora"} → ${item.valid_to||"Sin fin"}`:"Siempre disponible"

export default function PackagesView({packages=[],rooms=[],canManage,onSave,onToggle}){
  const[editor,setEditor]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),types=useMemo(()=>[...new Set(rooms.map(r=>String(r.tipo||"Habitación").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[rooms]),active=packages.filter(x=>x.active!==false).length
  async function submit(e){e.preventDefault();if(!editor)return;setBusy(true);setMessage("");try{await onSave({...editor,included_items:Array.isArray(editor.included_items)?editor.included_items:[]});setEditor(null)}catch(error){setMessage(error?.message||"No se pudo guardar el pack.")}finally{setBusy(false)}}
  async function toggle(item){setMessage("");try{await onToggle(item,item.active===false)}catch(error){setMessage(error?.message||"No se pudo cambiar el estado.")}}
  return <div className={ui.content}>
    <div className={ui.editorial}><div><small>PACKAGES & PROMOTIONS</small><h2>Packs vendibles que recepción puede aplicar sin recalcular nada.</h2><p>Definí habitación objetivo, régimen, vigencia, noches mínimas, extras incluidos y lógica de precio. La reserva guarda una foto del pack aplicado para que la operación no cambie aunque después edites la promoción.</p></div>{canManage&&<button onClick={()=>setEditor(blank())}>＋ Crear pack</button>}</div>
    <div className={p.metrics}><article><small>Packs activos</small><b>{active}</b><span>disponibles en reservas</span></article><article><small>Total configurados</small><b>{packages.length}</b><span>incluye pausados</span></article><article><small>Tipos alcanzados</small><b>{new Set(packages.map(x=>x.room_type).filter(Boolean)).size||"Todos"}</b><span>segmentación por habitación</span></article></div>
    {message&&<div className={p.message}>{message}</div>}
    <div className={p.grid}>{packages.map(item=><article className={`${p.card} ${item.active===false?p.paused:""}`} key={item.id}>
      <div className={p.cardTop}><div><small>{item.code||"PACK"}</small><h3>{item.name}</h3><p>{item.description||"Sin descripción comercial."}</p></div><span>{item.active===false?"PAUSADO":"ACTIVO"}</span></div>
      <div className={p.facts}><div><small>Precio</small><b>{packagePriceLabel(item)}</b></div><div><small>Habitación</small><b>{item.room_type||"Todas"}</b></div><div><small>Régimen</small><b>{item.meal_plan||"Sin régimen"}</b></div><div><small>Mínimo</small><b>{item.min_nights||1} noche(s)</b></div></div>
      <div className={p.validity}>{validity(item)}</div>
      <div className={p.items}>{(item.included_items||[]).slice(0,5).map((name,index)=><span key={`${name}-${index}`}>{name}</span>)}{(item.included_items||[]).length>5&&<span>+{item.included_items.length-5}</span>}{!(item.included_items||[]).length&&<em>Sin extras incluidos</em>}</div>
      {canManage&&<footer><button onClick={()=>toggle(item)}>{item.active===false?"Activar":"Pausar"}</button><button className={p.edit} onClick={()=>setEditor(toEditor(item))}>Editar</button></footer>}
    </article>)}{!packages.length&&<div className={p.empty}><b>Todavía no hay packs.</b><p>Podés crear Escapada romántica, Media pensión, Fin de semana largo, Evento deportivo o cualquier combinación propia.</p></div>}</div>
    {editor&&<div className={ui.shade} onMouseDown={e=>e.target===e.currentTarget&&setEditor(null)}><form className={`${ui.modal} ${p.modal}`} onSubmit={submit}><header><div><small>{editor.id?"EDITAR PACK":"NUEVO PACK"}</small><h3>{editor.name||"Oferta comercial"}</h3></div><button type="button" onClick={()=>setEditor(null)}>×</button></header><div className={ui.fieldGrid}>
      <label><span>Nombre</span><input autoFocus value={editor.name||""} onChange={e=>setEditor(x=>({...x,name:e.target.value}))} placeholder="Ej. Escapada romántica"/></label>
      <label><span>Código</span><input value={editor.code||""} onChange={e=>setEditor(x=>({...x,code:e.target.value}))} placeholder="ROMANTICA"/></label>
      <label><span>Tipo de habitación</span><select value={editor.room_type||""} onChange={e=>setEditor(x=>({...x,room_type:e.target.value}))}><option value="">Todas</option>{types.map(type=><option key={type}>{type}</option>)}</select></label>
      <label><span>Régimen</span><select value={editor.meal_plan||"Solo alojamiento"} onChange={e=>setEditor(x=>({...x,meal_plan:e.target.value}))}>{MEALS.map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span>Forma de precio</span><select value={editor.pricing_mode||"fixed_total"} onChange={e=>setEditor(x=>({...x,pricing_mode:e.target.value}))}>{PRICING.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>{editor.pricing_mode==="discount_percent"?"Descuento %":editor.pricing_mode==="discount_amount"?"Descuento $":"Precio"}</span><input type="number" min="0" step=".01" value={editor.price??0} onChange={e=>setEditor(x=>({...x,price:e.target.value}))}/></label>
      <label><span>Noches mínimas</span><input type="number" min="1" value={editor.min_nights||1} onChange={e=>setEditor(x=>({...x,min_nights:e.target.value}))}/></label>
      <label><span>Moneda</span><select value={editor.currency||"ARS"} onChange={e=>setEditor(x=>({...x,currency:e.target.value}))}><option>ARS</option><option>USD</option></select></label>
      <label><span>Vigente desde</span><input type="date" value={editor.valid_from||""} onChange={e=>setEditor(x=>({...x,valid_from:e.target.value}))}/></label>
      <label><span>Vigente hasta</span><input type="date" value={editor.valid_to||""} onChange={e=>setEditor(x=>({...x,valid_to:e.target.value}))}/></label>
      <label className={ui.wide}><span>Incluye · un ítem por línea</span><textarea value={(editor.included_items||[]).join("\n")} onChange={e=>setEditor(x=>({...x,included_items:e.target.value.split("\n").map(v=>v.trim()).filter(Boolean)}))} placeholder={'Desayuno buffet\nBotella de espumante\nLate check-out sujeto a disponibilidad'}/></label>
      <label className={ui.wide}><span>Descripción comercial</span><textarea value={editor.description||""} onChange={e=>setEditor(x=>({...x,description:e.target.value}))} placeholder="Qué incluye y para qué tipo de huésped sirve."/></label>
      <label className={p.check}><input type="checkbox" checked={editor.active!==false} onChange={e=>setEditor(x=>({...x,active:e.target.checked}))}/> Disponible para aplicar en reservas</label>
    </div><footer><button type="button" onClick={()=>setEditor(null)}>Cancelar</button><button disabled={busy}>{busy?"Guardando…":"Guardar pack"}</button></footer></form></div>}
  </div>
}
