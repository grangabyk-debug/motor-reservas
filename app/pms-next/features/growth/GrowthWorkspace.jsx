"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import VouchersPanel from"./VouchersPanel"
import s from"./growth.module.css"

const money=(value,currency)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const UPS_DEFAULT={category:"experience",name:"",description:"",price:0,charge_mode:"per_stay",active:true,available_from:"",available_to:"",inventory_limit:"",audience:{}}
const PACKAGE_DEFAULT={name:"",code:"",description:"",room_type:"",meal_plan:"",min_nights:1,valid_from:"",valid_to:"",pricing_mode:"fixed",price:0,currency:"ARS",included_items:[],active:true,sort_order:0}

export default function GrowthWorkspace({propertyId,property}){
  const[tab,setTab]=useState("upsells"),[upsells,setUpsells]=useState([]),[packages,setPackages]=useState([]),[settings,setSettings]=useState({}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[editing,setEditing]=useState(null),[saving,setSaving]=useState(false)

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[upsRes,packRes,setRes]=await Promise.all([
        supabase.from("hotel_upsell_catalog").select("id,category,name,description,price,charge_mode,active,available_from,available_to,inventory_limit,audience,sort_order,updated_at").eq("property_id",propertyId).order("sort_order").order("name"),
        supabase.from("hotel_packages").select("id,name,code,description,room_type,meal_plan,min_nights,valid_from,valid_to,pricing_mode,price,currency,included_items,active,sort_order,updated_at").eq("property_id",propertyId).order("sort_order").order("name"),
        supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      ])
      for(const result of[upsRes,packRes,setRes])if(result.error)throw result.error
      setUpsells(upsRes.data||[]);setPackages(packRes.data||[]);setSettings(setRes.data?.settings||{})
    }catch(err){setError(err?.message||"No se pudo cargar Ventas y crecimiento.")}
    finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{load()},[load])

  const currency=settings?.preferences?.currency||"ARS"
  const activeUps=useMemo(()=>upsells.filter(x=>x.active).length,[upsells]),activePackages=useMemo(()=>packages.filter(x=>x.active).length,[packages])

  function openNew(kind){setNotice("");setEditing({kind,form:kind==="upsell"?{...UPS_DEFAULT}:{...PACKAGE_DEFAULT,currency}})}
  function openEdit(kind,item){setNotice("");setEditing({kind,form:{...item,available_from:item.available_from||"",available_to:item.available_to||"",valid_from:item.valid_from||"",valid_to:item.valid_to||"",inventory_limit:item.inventory_limit??""}})}

  async function save(){
    if(!editing)return;setSaving(true);setError("");setNotice("")
    try{
      if(editing.kind==="upsell"){
        const f=editing.form;if(!f.name.trim())throw new Error("Ingresá un nombre para el upsell.")
        const payload={property_id:propertyId,category:f.category||"other",name:f.name.trim(),description:f.description?.trim()||null,price:Number(f.price)||0,charge_mode:f.charge_mode||"per_stay",active:Boolean(f.active),available_from:f.available_from||null,available_to:f.available_to||null,inventory_limit:f.inventory_limit===""?null:Number(f.inventory_limit),audience:f.audience&&typeof f.audience==="object"?f.audience:{},sort_order:Number(f.sort_order)||0,updated_at:new Date().toISOString()}
        const result=f.id?await supabase.from("hotel_upsell_catalog").update(payload).eq("id",f.id).eq("property_id",propertyId):await supabase.from("hotel_upsell_catalog").insert(payload);if(result.error)throw result.error
      }else{
        const f=editing.form;if(!f.name.trim())throw new Error("Ingresá un nombre para el paquete.")
        const payload={property_id:propertyId,name:f.name.trim(),code:f.code?.trim()||null,description:f.description?.trim()||null,room_type:f.room_type?.trim()||null,meal_plan:f.meal_plan?.trim()||null,min_nights:Math.max(1,Number(f.min_nights)||1),valid_from:f.valid_from||null,valid_to:f.valid_to||null,pricing_mode:f.pricing_mode||"fixed",price:Number(f.price)||0,currency:f.currency||currency,included_items:Array.isArray(f.included_items)?f.included_items:[],active:Boolean(f.active),sort_order:Number(f.sort_order)||0,updated_at:new Date().toISOString()}
        const result=f.id?await supabase.from("hotel_packages").update(payload).eq("id",f.id).eq("property_id",propertyId):await supabase.from("hotel_packages").insert(payload);if(result.error)throw result.error
      }
      setEditing(null);setNotice("Cambios guardados.");await load()
    }catch(err){setError(err?.message||"No se pudo guardar.")}
    finally{setSaving(false)}
  }

  async function toggle(kind,item){
    const table=kind==="upsell"?"hotel_upsell_catalog":"hotel_packages";setError("")
    const{error:updateError}=await supabase.from(table).update({active:!item.active,updated_at:new Date().toISOString()}).eq("id",item.id).eq("property_id",propertyId)
    if(updateError)return setError(updateError.message);await load()
  }

  return <section className={s.page}>
    <header className={s.header}><div><small>VENTAS Y CRECIMIENTO</small><h1>Vendé más sin complicar la operación</h1><p>{property?.name||"Propiedad activa"} · upsells, paquetes y vouchers conectados a datos reales.</p></div><div className={s.tabs}><button className={tab==="upsells"?s.active:""} onClick={()=>setTab("upsells")}>Upsells</button><button className={tab==="packages"?s.active:""} onClick={()=>setTab("packages")}>Paquetes</button><button className={tab==="vouchers"?s.active:""} onClick={()=>setTab("vouchers")}>Vouchers</button></div></header>
    {tab!=="vouchers"&&<>{error&&<div className={s.error}>{error}</div>}{notice&&<div className={s.notice}>{notice}</div>}<div className={s.stats}><article><span>Upsells activos</span><b>{activeUps}</b><small>{upsells.length} configurados</small></article><article><span>Paquetes activos</span><b>{activePackages}</b><small>{packages.length} configurados</small></article><article><span>Moneda base</span><b>{currency}</b><small>Desde preferencias del hotel</small></article></div></>}
    {tab==="vouchers"?<VouchersPanel propertyId={propertyId} currency={currency}/>:loading?<div className={s.empty}>Cargando configuración comercial…</div>:tab==="upsells"?<>
      <div className={s.toolbar}><div><h2>Upsells</h2><p>Extras ofrecibles antes o durante la estadía.</p></div><button className={s.primary} onClick={()=>openNew("upsell")}>+ Nuevo upsell</button></div>
      <div className={s.grid}>{upsells.map(item=><article className={s.card} key={item.id}><div className={s.cardTop}><span>{item.category}</span><button className={item.active?s.on:s.off} onClick={()=>toggle("upsell",item)}>{item.active?"Activo":"Inactivo"}</button></div><h3>{item.name}</h3><p>{item.description||"Sin descripción"}</p><div className={s.price}>{money(item.price,currency)}</div><dl><div><dt>Cobro</dt><dd>{item.charge_mode}</dd></div><div><dt>Vigencia</dt><dd>{item.available_from||"Siempre"}{item.available_to?` → ${item.available_to}`:""}</dd></div><div><dt>Inventario</dt><dd>{item.inventory_limit??"Sin límite"}</dd></div></dl><footer><button onClick={()=>openEdit("upsell",item)}>Editar</button></footer></article>)}{!upsells.length&&<div className={s.empty}>Todavía no hay upsells configurados.</div>}</div>
    </>:<>
      <div className={s.toolbar}><div><h2>Paquetes y promociones</h2><p>Combinaciones de estadía, plan de comidas e incluidos.</p></div><button className={s.primary} onClick={()=>openNew("package")}>+ Nuevo paquete</button></div>
      <div className={s.grid}>{packages.map(item=><article className={s.card} key={item.id}><div className={s.cardTop}><span>{item.code||"PAQUETE"}</span><button className={item.active?s.on:s.off} onClick={()=>toggle("package",item)}>{item.active?"Activo":"Inactivo"}</button></div><h3>{item.name}</h3><p>{item.description||"Sin descripción"}</p><div className={s.price}>{money(item.price,item.currency||currency)}</div><dl><div><dt>Mínimo</dt><dd>{item.min_nights} noche{item.min_nights===1?"":"s"}</dd></div><div><dt>Habitación</dt><dd>{item.room_type||"Todas"}</dd></div><div><dt>Plan</dt><dd>{item.meal_plan||"Sin plan"}</dd></div><div><dt>Vigencia</dt><dd>{item.valid_from||"Abierta"}{item.valid_to?` → ${item.valid_to}`:""}</dd></div></dl><footer><button onClick={()=>openEdit("package",item)}>Editar</button></footer></article>)}{!packages.length&&<div className={s.empty}>Todavía no hay paquetes configurados.</div>}</div>
    </>}
    {editing&&<Editor editing={editing} setEditing={setEditing} currency={currency} saving={saving} onSave={save}/>} 
  </section>
}

function Editor({editing,setEditing,currency,saving,onSave}){
  const f=editing.form,patch=values=>setEditing(current=>({...current,form:{...current.form,...values}})),ups=editing.kind==="upsell"
  return <div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&setEditing(null)}><div className={s.modal}><button className={s.close} onClick={()=>setEditing(null)}>×</button><small>{ups?"UPSELL":"PAQUETE"}</small><h2>{f.id?"Editar":"Crear"} {ups?"upsell":"paquete"}</h2><div className={s.form}><label>Nombre<input value={f.name||""} onChange={e=>patch({name:e.target.value})}/></label>{ups?<><label>Categoría<input value={f.category||""} onChange={e=>patch({category:e.target.value})}/></label><label>Precio<input type="number" min="0" value={f.price||0} onChange={e=>patch({price:e.target.value})}/></label><label>Modo de cobro<select value={f.charge_mode||"per_stay"} onChange={e=>patch({charge_mode:e.target.value})}><option value="per_stay">Por estadía</option><option value="per_night">Por noche</option><option value="per_person">Por persona</option><option value="per_unit">Por unidad</option></select></label><label>Disponible desde<input type="date" value={f.available_from||""} onChange={e=>patch({available_from:e.target.value})}/></label><label>Disponible hasta<input type="date" value={f.available_to||""} onChange={e=>patch({available_to:e.target.value})}/></label><label>Inventario límite<input type="number" min="0" value={f.inventory_limit??""} onChange={e=>patch({inventory_limit:e.target.value})}/></label></>:<><label>Código<input value={f.code||""} onChange={e=>patch({code:e.target.value})}/></label><label>Precio<input type="number" min="0" value={f.price||0} onChange={e=>patch({price:e.target.value})}/></label><label>Moneda<input value={f.currency||currency} onChange={e=>patch({currency:e.target.value.toUpperCase()})}/></label><label>Noches mínimas<input type="number" min="1" value={f.min_nights||1} onChange={e=>patch({min_nights:e.target.value})}/></label><label>Tipo de habitación<input value={f.room_type||""} onChange={e=>patch({room_type:e.target.value})}/></label><label>Plan de comidas<input value={f.meal_plan||""} onChange={e=>patch({meal_plan:e.target.value})}/></label><label>Válido desde<input type="date" value={f.valid_from||""} onChange={e=>patch({valid_from:e.target.value})}/></label><label>Válido hasta<input type="date" value={f.valid_to||""} onChange={e=>patch({valid_to:e.target.value})}/></label></>}<label className={s.wide}>Descripción<textarea rows="4" value={f.description||""} onChange={e=>patch({description:e.target.value})}/></label><label className={s.toggle}><input type="checkbox" checked={f.active!==false} onChange={e=>patch({active:e.target.checked})}/> Activo</label></div><footer><button onClick={()=>setEditing(null)}>Cancelar</button><button className={s.primary} disabled={saving||!f.name?.trim()} onClick={onSave}>{saving?"Guardando…":"Guardar"}</button></footer></div></div>
}
