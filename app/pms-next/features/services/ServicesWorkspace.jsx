"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./services.module.css"

const CATEGORY_LABEL={parking:"Cochera",pet:"Mascotas",extra:"Extra",service:"Servicio",fee:"Cargo"}
const MODE_LABEL={per_stay:"Por estadía",per_night:"Por noche",per_unit:"Por unidad",per_person:"Por persona",per_person_night:"Por persona/noche"}

export default function ServicesWorkspace({propertyId}){
  const[items,setItems]=useState([])
  const[query,setQuery]=useState("")
  const[form,setForm]=useState(null)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{if(!propertyId)return;setLoading(true);setError("");try{const{data,error:e}=await supabase.from("hotel_charge_catalog").select("id,name,category,amount,charge_mode,active,sort_order,created_at,updated_at").eq("property_id",propertyId).order("sort_order").order("name");if(e)throw e;setItems(data||[])}catch(err){setError(err?.message||"No se pudo cargar el catálogo.")}finally{setLoading(false)}},[propertyId])
  useEffect(()=>{load()},[load])

  const visible=useMemo(()=>items.filter(item=>!query||`${item.name} ${CATEGORY_LABEL[item.category]||item.category}`.toLowerCase().includes(query.toLowerCase())),[items,query])
  const active=items.filter(item=>item.active).length

  function openNew(){setForm({name:"",category:"service",amount:0,charge_mode:"per_stay",active:true,sort_order:items.length+1})}
  async function save(){if(!form.name.trim())return setError("Ingresá un nombre.");setSaving(true);setError("");try{const payload={property_id:propertyId,name:form.name.trim(),category:form.category,amount:Number(form.amount)||0,charge_mode:form.charge_mode,active:Boolean(form.active),sort_order:Number(form.sort_order)||0};if(form.id){const{data,error:e}=await supabase.from("hotel_charge_catalog").update({...payload,updated_at:new Date().toISOString()}).eq("id",form.id).eq("property_id",propertyId).select().single();if(e)throw e;setItems(list=>list.map(x=>x.id===data.id?data:x))}else{const{data,error:e}=await supabase.from("hotel_charge_catalog").insert(payload).select().single();if(e)throw e;setItems(list=>[...list,data])}setForm(null)}catch(err){setError(err?.message||"No se pudo guardar el ítem.")}finally{setSaving(false)}}
  async function toggle(item){setSaving(true);setError("");try{const{data,error:e}=await supabase.from("hotel_charge_catalog").update({active:!item.active,updated_at:new Date().toISOString()}).eq("id",item.id).eq("property_id",propertyId).select().single();if(e)throw e;setItems(list=>list.map(x=>x.id===data.id?data:x))}catch(err){setError(err?.message||"No se pudo actualizar el ítem.")}finally{setSaving(false)}}

  return <section className={s.page}>
    <header className={s.header}><div><small>SERVICIOS Y EXTRAS</small><h1>Catálogo del hotel</h1><p>Lo que vendés o agregás a una estadía: cochera, desayuno, lavandería, mascotas, late check-out y más.</p></div><button className={s.primary} onClick={openNew}>+ Nuevo ítem</button></header>
    <div className={s.metrics}><article><span>Ítems</span><b>{items.length}</b></article><article><span>Activos</span><b>{active}</b></article><article><span>Inactivos</span><b>{items.length-active}</b></article></div>
    <div className={s.toolbar}><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar servicio o extra"/></label></div>
    {error&&<div className={s.notice}>{error}</div>}
    {loading?<div className={s.notice}>Cargando catálogo…</div>:<div className={s.grid}>{visible.map(item=><article key={item.id} className={s.card}><div className={s.cardTop}><span>{CATEGORY_LABEL[item.category]||item.category}</span><button className={item.active?s.on:s.off} disabled={saving} onClick={()=>toggle(item)}>{item.active?"Activo":"Inactivo"}</button></div><h2>{item.name}</h2><b className={s.price}>{new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(item.amount)||0)}</b><p>{MODE_LABEL[item.charge_mode]||item.charge_mode}</p><footer><button onClick={()=>setForm({...item})}>Editar</button></footer></article>)}</div>}
    {!loading&&!visible.length&&<div className={s.notice}>Todavía no hay ítems cargados en esta propiedad.</div>}
    {form&&<div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&setForm(null)}><div className={s.modal}><button className={s.close} onClick={()=>setForm(null)}>×</button><small>CATÁLOGO</small><h2>{form.id?"Editar ítem":"Nuevo ítem"}</h2><div className={s.form}><label className={s.wide}>Nombre<input value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} autoFocus/></label><label>Categoría<select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{Object.entries(CATEGORY_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Modo de cobro<select value={form.charge_mode} onChange={e=>setForm(v=>({...v,charge_mode:e.target.value}))}>{Object.entries(MODE_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Precio<input type="number" min="0" value={form.amount} onChange={e=>setForm(v=>({...v,amount:e.target.value}))}/></label><label>Orden<input type="number" value={form.sort_order} onChange={e=>setForm(v=>({...v,sort_order:e.target.value}))}/></label><label className={s.toggle}><input type="checkbox" checked={form.active} onChange={e=>setForm(v=>({...v,active:e.target.checked}))}/> Disponible</label></div><footer><button onClick={()=>setForm(null)}>Cancelar</button><button className={s.primary} disabled={saving} onClick={save}>{saving?"Guardando…":"Guardar"}</button></footer></div></div>}
  </section>
}
