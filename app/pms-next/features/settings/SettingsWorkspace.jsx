"use client"

import{useCallback,useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import RolePermissionsPanel from"./RolePermissionsPanel"
import CancellationPoliciesSettings from"./CancellationPoliciesSettings"
import PropertyRoomsManager from"./PropertyRoomsManager"
import s from"./settings.module.css"

const DEFAULT_PREFS={currency:"ARS",timezone:"America/Argentina/Buenos_Aires",checkin_time:"15:00",checkout_time:"11:00",language:"es-AR",early_checkin_percent:35,late_checkout_percent:35,early_checkin_time:"08:00",late_checkout_time:"18:00"}
const DEFAULT_TAXES={enabled:true,country:"AR",vat_rate:21,show_breakdown:true,default_recipient_condition:"consumidor_final",additional_taxes_enabled:true,price_tax_mode:"tax_included"}
const MAX_PHOTO_BYTES=8*1024*1024
const ALLOWED_PHOTO_TYPES=new Set(["image/jpeg","image/png","image/webp"])
const SETTINGS_TABS=new Set(["property","rooms","preferences","taxes","cancellation","roles"])
function readSettingsTab(){if(typeof window==="undefined")return"property";const value=new URL(window.location.href).searchParams.get("settings_tab");return SETTINGS_TABS.has(value)?value:"property"}

export default function SettingsWorkspace({propertyId,property}){
  const[tab,setTab]=useState(readSettingsTab)
  const[settings,setSettings]=useState({})
  const[profile,setProfile]=useState({name:property?.name||"",city:property?.city||"",description:property?.description||""})
  const[saving,setSaving]=useState("")
  const[error,setError]=useState("")
  const[notice,setNotice]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setError("")
    const[settingsRes,propertyRes]=await Promise.all([
      supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      supabase.from("properties").select("id,name,city,description,owner_id").eq("id",propertyId).single(),
    ])
    for(const result of[settingsRes,propertyRes])if(result.error)throw result.error
    setSettings(settingsRes.data?.settings||{})
    setProfile({name:propertyRes.data.name||"",city:propertyRes.data.city||"",description:propertyRes.data.description||""})
  },[propertyId])

  useEffect(()=>{load().catch(err=>setError(err?.message||"No se pudo cargar la configuración."))},[load])
  useEffect(()=>{if(typeof window==="undefined")return;const sync=()=>setTab(readSettingsTab());window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync)},[])

  const prefs={...DEFAULT_PREFS,...(settings.preferences||{})}
  const taxes={...DEFAULT_TAXES,...(settings.taxes||{}),price_tax_mode:"tax_included"}
  const branding=settings.branding||{}
  const canManagePermissions=["owner","manager"].includes(property?.role)
  const canManageTaxes=property?.role==="owner"
  const canManageStaySurcharges=property?.role==="owner"

  function chooseTab(next){setTab(next);if(typeof window==="undefined")return;const url=new URL(window.location.href);url.searchParams.set("settings_tab",next);window.history.replaceState(window.history.state,"",url)}

  async function persistSettings(next,successMessage){
    const{data:userRes}=await supabase.auth.getUser()
    const{error:writeError}=await supabase.from("property_settings").upsert({property_id:propertyId,settings:next,updated_at:new Date().toISOString(),updated_by:userRes?.user?.id||null},{onConflict:"property_id"})
    if(writeError)throw writeError
    setSettings(next)
    if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:property-settings-updated",{detail:{propertyId,settings:next}}))
    if(successMessage)setNotice(successMessage)
  }

  async function saveProperty(){setSaving("property");setError("");setNotice("");try{const{error:updateError}=await supabase.from("properties").update({name:profile.name.trim(),city:profile.city.trim()||null,description:profile.description.trim()||null}).eq("id",propertyId);if(updateError)throw updateError;setNotice("Datos de la propiedad guardados.")}catch(err){setError(err?.message||"No se pudo guardar la propiedad.")}finally{setSaving("")}}
  async function savePrefs(nextPrefs){setSaving("prefs");setError("");setNotice("");try{const normalized={...nextPrefs,early_checkin_percent:Math.max(0,Math.min(100,Number(nextPrefs.early_checkin_percent)||0)),late_checkout_percent:Math.max(0,Math.min(100,Number(nextPrefs.late_checkout_percent)||0)),early_checkin_time:nextPrefs.early_checkin_time||"08:00",late_checkout_time:nextPrefs.late_checkout_time||"18:00"};await persistSettings({...settings,preferences:normalized},"Preferencias guardadas.")}catch(err){setError(err?.message||"No se pudieron guardar las preferencias.")}finally{setSaving("")}}
  async function saveTaxes(nextTaxes){if(!canManageTaxes)return;setSaving("taxes");setError("");setNotice("");try{await persistSettings({...settings,taxes:{...DEFAULT_TAXES,...nextTaxes,price_tax_mode:"tax_included",vat_rate:Math.max(0,Number(nextTaxes.vat_rate)||0)}},"Impuestos guardados. Tarifas, extras y servicios se cargan como precio final con IVA incluido; el PMS separa neto e IVA internamente.")}catch(err){setError(err?.message||"No se pudo guardar la configuración de impuestos.")}finally{setSaving("")}}
  async function saveRolePermissions(rolePermissions){if(!canManagePermissions)return;setSaving("roles");setError("");setNotice("");try{await persistSettings({...settings,role_permissions:rolePermissions},"Permisos por rol guardados. Los menús se actualizaron al instante.")}catch(err){setError(err?.message||"No se pudieron guardar los permisos.")}finally{setSaving("")}}

  async function uploadHotelPhoto(file){
    if(!file)return;setError("");setNotice("")
    if(!ALLOWED_PHOTO_TYPES.has(file.type)){setError("La foto debe ser JPG, PNG o WebP.");return}
    if(file.size>MAX_PHOTO_BYTES){setError("La foto no puede superar los 8 MB.");return}
    setSaving("photo")
    try{const extension=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg",path=`${propertyId}/branding/hotel-${Date.now()}.${extension}`,{data:upload,error:uploadError}=await supabase.storage.from("hotel-media").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});if(uploadError)throw uploadError;const{data:publicData}=supabase.storage.from("hotel-media").getPublicUrl(upload.path),nextBranding={...branding,hotel_photo_url:publicData.publicUrl,hotel_photo_path:upload.path};await persistSettings({...settings,branding:nextBranding},"Foto del hotel actualizada.");if(branding.hotel_photo_path&&branding.hotel_photo_path!==upload.path)await supabase.storage.from("hotel-media").remove([branding.hotel_photo_path]).catch(()=>{})}catch(err){const message=String(err?.message||"");setError(message.toLowerCase().includes("bucket")?"El almacenamiento de fotos todavía no está habilitado en esta base.":message||"No se pudo subir la foto del hotel.")}finally{setSaving("")}
  }
  async function removeHotelPhoto(){setSaving("photo");setError("");setNotice("");try{await persistSettings({...settings,branding:{...branding,hotel_photo_url:null,hotel_photo_path:null}},"Foto del hotel quitada.");if(branding.hotel_photo_path)await supabase.storage.from("hotel-media").remove([branding.hotel_photo_path]).catch(()=>{})}catch(err){setError(err?.message||"No se pudo quitar la foto del hotel.")}finally{setSaving("")}}

  const tabs=[["property","Propiedad"],["rooms","Habitaciones"],["preferences","Preferencias"],["taxes","Impuestos"],["cancellation","Políticas"],["roles","Roles y permisos"]]
  return <section className={s.page}>
    <header className={s.header}><div><small>CONFIGURACIÓN</small><h1>Propiedad y operación</h1><p>Identidad, habitaciones, horarios, impuestos, políticas y permisos del hotel.</p></div><div className={s.tabs}>{tabs.map(([id,label])=><button key={id} className={tab===id?s.active:""} onClick={()=>chooseTab(id)}>{label}</button>)}</div></header>
    {error&&<div className={s.error}>{error}</div>}{notice&&<div className={s.notice}>{notice}</div>}
    {tab==="property"&&<div className={s.propertyLayout}><div className={s.panel}><h2>Datos de la propiedad</h2><p className={s.panelIntro}>Estos datos identifican al hotel dentro del PMS y se reutilizan donde corresponde.</p><div className={s.formGrid}><label>Nombre<input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><label>Ciudad<input value={profile.city} onChange={e=>setProfile({...profile,city:e.target.value})}/></label><label className={s.wide}>Descripción<textarea rows="4" value={profile.description} onChange={e=>setProfile({...profile,description:e.target.value})}/></label></div><footer><button className={s.primary} onClick={saveProperty} disabled={saving==="property"}>{saving==="property"?"Guardando…":"Guardar propiedad"}</button></footer></div><div className={s.photoPanel}><div className={s.photoFrame}>{branding.hotel_photo_url?<img src={branding.hotel_photo_url} alt={`Foto de ${profile.name||"hotel"}`}/>:<div className={s.photoPlaceholder}><span>HL</span><b>Foto principal del hotel</b><small>Se verá en el Dashboard y podrá reutilizarse en la experiencia de reservas.</small></div>}<div className={s.photoGlass}><b>{profile.name||"Tu hotel"}</b><span>{profile.city||"Ubicación sin configurar"}</span></div></div><div className={s.photoActions}><label className={s.uploadButton}>{saving==="photo"?"Subiendo…":"Subir foto"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving==="photo"} onChange={e=>{const file=e.target.files?.[0];if(file)uploadHotelPhoto(file);e.target.value=""}}/></label>{branding.hotel_photo_url&&<button type="button" onClick={removeHotelPhoto} disabled={saving==="photo"}>Quitar</button>}</div><small className={s.photoHelp}>JPG, PNG o WebP · máximo 8 MB · los archivos quedan aislados por propiedad.</small></div></div>}
    {tab==="rooms"&&<PropertyRoomsManager propertyId={propertyId} property={property} currency={prefs.currency||"ARS"}/>} 
    {tab==="preferences"&&<PreferencesForm key={JSON.stringify(prefs)} value={prefs} onSave={savePrefs} saving={saving==="prefs"} canEditSurcharges={canManageStaySurcharges}/>} 
    {tab==="taxes"&&<TaxSettingsForm key={JSON.stringify(taxes)} value={taxes} onSave={saveTaxes} saving={saving==="taxes"} canEdit={canManageTaxes}/>} 
    {tab==="cancellation"&&<CancellationPoliciesSettings propertyId={propertyId} currency={prefs.currency||"ARS"} canEdit={property?.role==="owner"}/>} 
    {tab==="roles"&&<RolePermissionsPanel key={JSON.stringify(settings.role_permissions||{})} value={settings.role_permissions||{}} canManage={canManagePermissions} saving={saving==="roles"} onSave={saveRolePermissions}/>} 
  </section>
}

function PreferencesForm({value,onSave,saving,canEditSurcharges}){
  const[form,setForm]=useState(value)
  return <div className={s.panel}><h2>Preferencias hoteleras</h2><p className={s.panelIntro}>Horarios, moneda e idioma que usa la operación diaria.</p><div className={s.formGrid}><label>Moneda<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option>ARS</option><option>USD</option><option>EUR</option><option>BRL</option><option>CLP</option><option>UYU</option></select></label><label>Idioma<select value={form.language} onChange={e=>setForm({...form,language:e.target.value})}><option value="es-AR">Español (Argentina)</option><option value="es">Español</option><option value="en">English</option><option value="pt-BR">Português</option></select></label><label>Check-in<input type="time" value={form.checkin_time} onChange={e=>setForm({...form,checkin_time:e.target.value})}/></label><label>Check-out<input type="time" value={form.checkout_time} onChange={e=>setForm({...form,checkout_time:e.target.value})}/></label><label className={s.wide}>Zona horaria<input value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})}/></label></div><div style={{marginTop:16,paddingTop:15,borderTop:"1px solid var(--line)"}}><h3 style={{margin:"0 0 5px",fontSize:14}}>Early check-in y late check-out</h3><p className={s.panelIntro} style={{marginBottom:12}}>Define el recargo y el horario operativo. Al habilitar uno de estos servicios, el Planning protege el turno de la habitación para evitar reservas incompatibles y dejar margen a Housekeeping.</p><div className={s.formGrid}><label>Early check-in (%)<input type="number" min="0" max="100" step="1" disabled={!canEditSurcharges||saving} value={form.early_checkin_percent} onChange={e=>setForm({...form,early_checkin_percent:e.target.value})}/></label><label>Hora de early check-in<input type="time" disabled={!canEditSurcharges||saving} value={form.early_checkin_time||"08:00"} onChange={e=>setForm({...form,early_checkin_time:e.target.value})}/></label><label>Late check-out (%)<input type="number" min="0" max="100" step="1" disabled={!canEditSurcharges||saving} value={form.late_checkout_percent} onChange={e=>setForm({...form,late_checkout_percent:e.target.value})}/></label><label>Hora de late check-out<input type="time" disabled={!canEditSurcharges||saving} value={form.late_checkout_time||"18:00"} onChange={e=>setForm({...form,late_checkout_time:e.target.value})}/></label></div>{!canEditSurcharges?<p className={s.panelIntro} style={{marginTop:10}}>Sólo el propietario puede modificar estos porcentajes y horarios.</p>:null}</div><footer><button className={s.primary} disabled={saving} onClick={()=>onSave(form)}>{saving?"Guardando…":"Guardar preferencias"}</button></footer></div>
}

function TaxSettingsForm({value,onSave,saving,canEdit}){
  const[form,setForm]=useState({...value,price_tax_mode:"tax_included"})
  const toggle={display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,padding:"14px 15px",border:"1px solid var(--line)",borderRadius:12,background:"color-mix(in srgb,var(--panelSolid) 92%,transparent)",marginBottom:12}
  const rate=Math.max(0,Number(form.vat_rate)||0)
  return <div className={s.panel}><h2>Impuestos</h2><p className={s.panelIntro}>Habitación Llena trabaja comercialmente con precios finales. El propietario escribe el importe que paga el huésped y el PMS separa base imponible e IVA por debajo.</p>
    <div style={toggle}><div><b style={{display:"block",fontSize:13}}>Activar impuestos en la propiedad</b><small style={{display:"block",marginTop:4,color:"var(--muted)",lineHeight:1.45}}>Con impuestos activos, tarifas, extras y servicios se cargan siempre con IVA incluido.</small></div><input type="checkbox" checked={Boolean(form.enabled)} disabled={!canEdit||saving} onChange={e=>setForm({...form,enabled:e.target.checked,show_breakdown:e.target.checked})}/></div>
    <div style={{marginBottom:14,padding:"13px 14px",border:"1px solid color-mix(in srgb,var(--accent) 36%,var(--line))",borderRadius:12,background:"color-mix(in srgb,var(--accent) 8%,var(--panelSolid))"}}><b style={{display:"block",fontSize:13}}>Precio final · IVA incluido</b><small style={{display:"block",marginTop:5,color:"var(--muted)",lineHeight:1.5}}>Ejemplo: si cargás $ 110.000, el huésped paga $ 110.000. Con IVA {rate}%, el sistema calcula y guarda internamente el neto y el impuesto sin mostrarle esa complejidad al operador.</small></div>
    <div className={s.formGrid}><label>País fiscal<select disabled={!canEdit||saving} value={form.country||"AR"} onChange={e=>setForm({...form,country:e.target.value})}><option value="AR">Argentina</option><option value="OTHER">Otro país</option></select></label><label>IVA predeterminado (%)<input type="number" min="0" max="100" step="0.01" disabled={!canEdit||saving||!form.enabled} value={form.vat_rate} onChange={e=>setForm({...form,vat_rate:e.target.value})}/></label><label>Condición IVA predeterminada<select disabled={!canEdit||saving||!form.enabled} value={form.default_recipient_condition||"consumidor_final"} onChange={e=>setForm({...form,default_recipient_condition:e.target.value})}><option value="consumidor_final">Consumidor final</option><option value="responsable_inscripto">Responsable inscripto</option><option value="monotributo">Monotributo</option><option value="exento">Exento</option><option value="cliente_exterior">Cliente del exterior</option><option value="no_categorizado">No categorizado</option></select></label><label>Percepciones / impuestos adicionales<select disabled={!canEdit||saving||!form.enabled} value={form.additional_taxes_enabled?"enabled":"disabled"} onChange={e=>setForm({...form,additional_taxes_enabled:e.target.value==="enabled"})}><option value="enabled">Habilitados en facturación</option><option value="disabled">Deshabilitados</option></select></label></div>
    <div style={{marginTop:14,padding:"11px 12px",border:"1px solid color-mix(in srgb,#2f9b61 24%,var(--line))",borderRadius:11,background:"color-mix(in srgb,#37a96a 6%,var(--panelSolid))",fontSize:11,lineHeight:1.5}}><b>Regla comercial simple</b><div style={{marginTop:4,color:"var(--muted)"}}>El precio visible en Tarifas y disponibilidad, Extras y servicios, reservas y venta directa es el precio final. Neto e IVA quedan para folios, reportes y facturación.</div></div>
    {!canEdit?<p className={s.panelIntro} style={{marginTop:12}}>Sólo el propietario puede modificar la configuración fiscal.</p>:null}<footer><button className={s.primary} disabled={saving||!canEdit} onClick={()=>onSave({...form,price_tax_mode:"tax_included",vat_rate:rate,show_breakdown:Boolean(form.enabled)})}>{saving?"Guardando…":"Guardar impuestos"}</button></footer></div>
}
