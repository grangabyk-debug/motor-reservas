"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{commercialPriceFromNet,finalPriceFromNet,netPriceFromCommercial,normalizeTaxSettings,priceTaxCaption,priceTaxShortLabel}from"../../core/priceTax"
import s from"./services.module.css"

const CATEGORY_LABEL={parking:"Cochera",pet:"Mascotas",extra:"Extra",service:"Servicio",fee:"Cargo"}
const MODE_LABEL={per_stay:"Por estadía",per_night:"Por noche",per_unit:"Por unidad",per_person:"Por persona",per_person_night:"Por persona/noche"}

function Icon({name,size=16}){const p={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.9",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true};if(name==="plus")return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;if(name==="edit")return <svg {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>;return <svg {...p}><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>}

export default function ServicesWorkspace({propertyId}){
  const[items,setItems]=useState([])
  const[settings,setSettings]=useState({})
  const[query,setQuery]=useState("")
  const[form,setForm]=useState(null)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{if(!propertyId)return;setLoading(true);setError("");try{const[itemRes,settingsRes]=await Promise.all([supabase.from("hotel_charge_catalog").select("id,name,category,amount,charge_mode,active,sort_order,created_at,updated_at").eq("property_id",propertyId).order("sort_order").order("name"),supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle()]);if(itemRes.error)throw itemRes.error;if(settingsRes.error)throw settingsRes.error;setItems(itemRes.data||[]);setSettings(settingsRes.data?.settings||{})}catch(err){setError(err?.message||"No se pudo cargar el catálogo.")}finally{setLoading(false)}},[propertyId])
  useEffect(()=>{load()},[load])
  useEffect(()=>{if(typeof window==="undefined")return;const handler=event=>{if(String(event.detail?.propertyId)===String(propertyId)&&event.detail?.settings)setSettings(event.detail.settings)};window.addEventListener("hl:property-settings-updated",handler);return()=>window.removeEventListener("hl:property-settings-updated",handler)},[propertyId])

  const taxes=normalizeTaxSettings(settings.taxes||{}),currency=settings.preferences?.currency||"ARS"
  const visible=useMemo(()=>items.filter(item=>!query||`${item.name} ${CATEGORY_LABEL[item.category]||item.category}`.toLowerCase().includes(query.toLowerCase())),[items,query])
  const active=items.filter(item=>item.active).length
  const format=value=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value)||0)
  const enteredFromNet=value=>commercialPriceFromNet(value,taxes)

  function openNew(){setForm({name:"",category:"service",amount:0,charge_mode:"per_stay",active:true,sort_order:items.length+1})}
  function openEdit(item){setForm({...item,amount:enteredFromNet(item.amount)})}
  async function save(){if(!form.name.trim())return setError("Ingresá un nombre.");setSaving(true);setError("");try{const storedNet=netPriceFromCommercial(form.amount,taxes),payload={property_id:propertyId,name:form.name.trim(),category:form.category,amount:storedNet,charge_mode:form.charge_mode,active:Boolean(form.active),sort_order:Number(form.sort_order)||0};if(form.id){const{data,error:e}=await supabase.from("hotel_charge_catalog").update({...payload,updated_at:new Date().toISOString()}).eq("id",form.id).eq("property_id",propertyId).select().single();if(e)throw e;setItems(list=>list.map(x=>x.id===data.id?data:x))}else{const{data,error:e}=await supabase.from("hotel_charge_catalog").insert(payload).select().single();if(e)throw e;setItems(list=>[...list,data])}setForm(null)}catch(err){setError(err?.message||"No se pudo guardar el ítem.")}finally{setSaving(false)}}
  async function toggle(item){setSaving(true);setError("");try{const{data,error:e}=await supabase.from("hotel_charge_catalog").update({active:!item.active,updated_at:new Date().toISOString()}).eq("id",item.id).eq("property_id",propertyId).select().single();if(e)throw e;setItems(list=>list.map(x=>x.id===data.id?data:x))}catch(err){setError(err?.message||"No se pudo actualizar el ítem.")}finally{setSaving(false)}}

  const taxCopy=taxes.enabled&&taxes.price_tax_mode==="tax_included"?"Ingresá el total; el sistema separa neto e IVA.":taxes.enabled?"Ingresá el neto; el IVA se suma automáticamente.":"Los importes se guardan como finales."
  return <section className={s.page}>
    <header className={s.header}><div><small>SERVICIOS Y EXTRAS</small><h1>Catálogo del hotel</h1><p>Extras y servicios que podés sumar a una estadía.</p></div><button className={s.primary} onClick={openNew}><Icon name="plus"/>Nuevo ítem</button></header>
    <div className={s.taxHint}><div><b>{priceTaxCaption(taxes)}</b><span>{taxCopy}</span></div></div>
    <div className={s.metrics}><article><span>Ítems</span><b>{items.length}</b></article><article><span>Activos</span><b>{active}</b></article><article><span>Inactivos</span><b>{items.length-active}</b></article></div>
    <div className={s.toolbar}><label><Icon name="search" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar servicio o extra"/></label></div>
    {error&&<div className={s.notice}>{error}</div>}
    {loading?<div className={s.notice}>Cargando catálogo…</div>:<div className={s.grid}>{visible.map(item=>{const entered=enteredFromNet(item.amount),final=finalPriceFromNet(item.amount,taxes);return <article key={item.id} className={s.card}><div className={s.cardTop}><span>{CATEGORY_LABEL[item.category]||item.category}</span><button className={item.active?s.on:s.off} disabled={saving} onClick={()=>toggle(item)}>{item.active?"Activo":"Inactivo"}</button></div><h2>{item.name}</h2><b className={s.price}>{format(entered)}</b><p>{MODE_LABEL[item.charge_mode]||item.charge_mode} · {priceTaxShortLabel(taxes)}</p>{taxes.enabled&&taxes.price_tax_mode==="tax_excluded"?<small className={s.finalPrice}>Final con IVA: {format(final)}</small>:null}<footer><button className={s.editButton} onClick={()=>openEdit(item)}><Icon name="edit" size={14}/>Editar</button></footer></article>})}</div>}
    {!loading&&!visible.length&&<div className={s.notice}>Todavía no hay ítems cargados en esta propiedad.</div>}
    {form&&<div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&setForm(null)}><div className={s.modal}><button className={s.close} onClick={()=>setForm(null)}>×</button><small>CATÁLOGO</small><h2>{form.id?"Editar ítem":"Nuevo ítem"}</h2><div className={s.form}><label className={s.wide}>Nombre<input value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} autoFocus/></label><label>Categoría<select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{Object.entries(CATEGORY_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Modo de cobro<select value={form.charge_mode} onChange={e=>setForm(v=>({...v,charge_mode:e.target.value}))}>{Object.entries(MODE_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>{taxes.enabled&&taxes.price_tax_mode==="tax_included"?"Precio final (IVA incluido)":taxes.enabled?`Precio neto (+ IVA ${taxes.vat_rate}%)`:"Precio final"}<input type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm(v=>({...v,amount:e.target.value}))}/></label><label>Orden<input type="number" value={form.sort_order} onChange={e=>setForm(v=>({...v,sort_order:e.target.value}))}/></label><label className={s.toggle}><input type="checkbox" checked={form.active} onChange={e=>setForm(v=>({...v,active:e.target.checked}))}/> Disponible</label></div>{Number(form.amount)>0&&taxes.enabled?<div className={s.taxPreview}>{taxes.price_tax_mode==="tax_included"?<>Neto {format(netPriceFromCommercial(form.amount,taxes))} + IVA · Total <b>{format(form.amount)}</b>.</>:<>Total con IVA <b>{format(finalPriceFromNet(Number(form.amount)||0,taxes))}</b>.</>}</div>:null}<footer><button onClick={()=>setForm(null)}>Cancelar</button><button className={s.primary} disabled={saving} onClick={save}>{saving?"Guardando…":"Guardar"}</button></footer></div></div>}
  </section>
}
