"use client"

import{useCallback,useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import RolePermissionsPanel from"./RolePermissionsPanel"
import CancellationPoliciesSettings from"./CancellationPoliciesSettings"
import PropertyRoomsManager from"./PropertyRoomsManager"
import s from"./settings.module.css"

const DEFAULT_PREFS={currency:"ARS",timezone:"America/Argentina/Buenos_Aires",checkin_time:"15:00",checkout_time:"11:00",language:"es-AR"}
const MAX_PHOTO_BYTES=8*1024*1024
const ALLOWED_PHOTO_TYPES=new Set(["image/jpeg","image/png","image/webp"])

export default function SettingsWorkspace({propertyId,property}){
  const[tab,setTab]=useState("property")
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

  const prefs={...DEFAULT_PREFS,...(settings.preferences||{})}
  const branding=settings.branding||{}
  const canManagePermissions=["owner","manager"].includes(property?.role)

  async function persistSettings(next,successMessage){
    const{data:userRes}=await supabase.auth.getUser()
    const{error:writeError}=await supabase.from("property_settings").upsert({property_id:propertyId,settings:next,updated_at:new Date().toISOString(),updated_by:userRes?.user?.id||null},{onConflict:"property_id"})
    if(writeError)throw writeError
    setSettings(next)
    if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:property-settings-updated",{detail:{propertyId,settings:next}}))
    if(successMessage)setNotice(successMessage)
  }

  async function saveProperty(){
    setSaving("property");setError("");setNotice("")
    try{
      const{error:updateError}=await supabase.from("properties").update({name:profile.name.trim(),city:profile.city.trim()||null,description:profile.description.trim()||null}).eq("id",propertyId)
      if(updateError)throw updateError
      setNotice("Datos de la propiedad guardados.")
    }catch(err){setError(err?.message||"No se pudo guardar la propiedad.")}
    finally{setSaving("")}
  }

  async function savePrefs(nextPrefs){
    setSaving("prefs");setError("");setNotice("")
    try{await persistSettings({...settings,preferences:nextPrefs},"Preferencias guardadas.")}
    catch(err){setError(err?.message||"No se pudieron guardar las preferencias.")}
    finally{setSaving("")}
  }

  async function saveRolePermissions(rolePermissions){
    if(!canManagePermissions)return
    setSaving("roles");setError("");setNotice("")
    try{await persistSettings({...settings,role_permissions:rolePermissions},"Permisos por rol guardados. Los menús se actualizaron al instante.")}
    catch(err){setError(err?.message||"No se pudieron guardar los permisos.")}
    finally{setSaving("")}
  }

  async function uploadHotelPhoto(file){
    if(!file)return
    setError("");setNotice("")
    if(!ALLOWED_PHOTO_TYPES.has(file.type)){setError("La foto debe ser JPG, PNG o WebP.");return}
    if(file.size>MAX_PHOTO_BYTES){setError("La foto no puede superar los 8 MB.");return}
    setSaving("photo")
    try{
      const extension=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg"
      const path=`${propertyId}/branding/hotel-${Date.now()}.${extension}`
      const{data:upload,error:uploadError}=await supabase.storage.from("hotel-media").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type})
      if(uploadError)throw uploadError
      const{data:publicData}=supabase.storage.from("hotel-media").getPublicUrl(upload.path)
      const nextBranding={...branding,hotel_photo_url:publicData.publicUrl,hotel_photo_path:upload.path}
      await persistSettings({...settings,branding:nextBranding},"Foto del hotel actualizada.")
      if(branding.hotel_photo_path&&branding.hotel_photo_path!==upload.path)await supabase.storage.from("hotel-media").remove([branding.hotel_photo_path]).catch(()=>{})
    }catch(err){
      const message=String(err?.message||"")
      setError(message.toLowerCase().includes("bucket")?"El almacenamiento de fotos todavía no está habilitado en esta base.":message||"No se pudo subir la foto del hotel.")
    }finally{setSaving("")}
  }

  async function removeHotelPhoto(){
    setSaving("photo");setError("");setNotice("")
    try{
      await persistSettings({...settings,branding:{...branding,hotel_photo_url:null,hotel_photo_path:null}},"Foto del hotel quitada.")
      if(branding.hotel_photo_path)await supabase.storage.from("hotel-media").remove([branding.hotel_photo_path]).catch(()=>{})
    }catch(err){setError(err?.message||"No se pudo quitar la foto del hotel.")}
    finally{setSaving("")}
  }

  return <section className={s.page}>
    <header className={s.header}>
      <div><small>CONFIGURACIÓN</small><h1>Propiedad y operación</h1><p>Identidad, habitaciones, horarios, políticas y permisos con la misma lógica visual en todo el PMS.</p></div>
      <div className={s.tabs}>{[["property","Propiedad"],["rooms","Habitaciones"],["preferences","Preferencias"],["cancellation","Políticas"],["roles","Roles y permisos"]].map(([id,label])=><button key={id} className={tab===id?s.active:""} onClick={()=>setTab(id)}>{label}</button>)}</div>
    </header>
    {error&&<div className={s.error}>{error}</div>}{notice&&<div className={s.notice}>{notice}</div>}

    {tab==="property"&&<div className={s.propertyLayout}>
      <div className={s.panel}><h2>Datos de la propiedad</h2><p className={s.panelIntro}>Estos datos identifican al hotel dentro del PMS y se reutilizan donde corresponde.</p><div className={s.formGrid}><label>Nombre<input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><label>Ciudad<input value={profile.city} onChange={e=>setProfile({...profile,city:e.target.value})}/></label><label className={s.wide}>Descripción<textarea rows="4" value={profile.description} onChange={e=>setProfile({...profile,description:e.target.value})}/></label></div><footer><button className={s.primary} onClick={saveProperty} disabled={saving==="property"}>{saving==="property"?"Guardando…":"Guardar propiedad"}</button></footer></div>
      <div className={s.photoPanel}><div className={s.photoFrame}>{branding.hotel_photo_url?<img src={branding.hotel_photo_url} alt={`Foto de ${profile.name||"hotel"}`}/>:<div className={s.photoPlaceholder}><span>HL</span><b>Foto principal del hotel</b><small>Se verá en el Dashboard y podrá reutilizarse en la experiencia de reservas.</small></div>}<div className={s.photoGlass}><b>{profile.name||"Tu hotel"}</b><span>{profile.city||"Ubicación sin configurar"}</span></div></div><div className={s.photoActions}><label className={s.uploadButton}>{saving==="photo"?"Subiendo…":"Subir foto"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving==="photo"} onChange={e=>{const file=e.target.files?.[0];if(file)uploadHotelPhoto(file);e.target.value=""}}/></label>{branding.hotel_photo_url&&<button type="button" onClick={removeHotelPhoto} disabled={saving==="photo"}>Quitar</button>}</div><small className={s.photoHelp}>JPG, PNG o WebP · máximo 8 MB · los archivos quedan aislados por propiedad.</small></div>
    </div>}

    {tab==="rooms"&&<PropertyRoomsManager propertyId={propertyId} property={property} currency={prefs.currency||"ARS"}/>} 
    {tab==="preferences"&&<PreferencesForm key={JSON.stringify(prefs)} value={prefs} onSave={savePrefs} saving={saving==="prefs"}/>}
    {tab==="cancellation"&&<CancellationPoliciesSettings propertyId={propertyId} currency={prefs.currency||"ARS"} canEdit={property?.role==="owner"}/>} 
    {tab==="roles"&&<RolePermissionsPanel key={JSON.stringify(settings.role_permissions||{})} value={settings.role_permissions||{}} canManage={canManagePermissions} saving={saving==="roles"} onSave={saveRolePermissions}/>} 
  </section>
}

function PreferencesForm({value,onSave,saving}){
  const[form,setForm]=useState(value)
  return <div className={s.panel}><h2>Preferencias hoteleras</h2><p className={s.panelIntro}>Horarios, moneda e idioma que usa la operación diaria.</p><div className={s.formGrid}><label>Moneda<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option>ARS</option><option>USD</option><option>EUR</option><option>BRL</option><option>CLP</option><option>UYU</option></select></label><label>Idioma<select value={form.language} onChange={e=>setForm({...form,language:e.target.value})}><option value="es-AR">Español (Argentina)</option><option value="es">Español</option><option value="en">English</option><option value="pt-BR">Português</option></select></label><label>Check-in<input type="time" value={form.checkin_time} onChange={e=>setForm({...form,checkin_time:e.target.value})}/></label><label>Check-out<input type="time" value={form.checkout_time} onChange={e=>setForm({...form,checkout_time:e.target.value})}/></label><label className={s.wide}>Zona horaria<input value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})}/></label></div><footer><button className={s.primary} disabled={saving} onClick={()=>onSave(form)}>{saving?"Guardando…":"Guardar preferencias"}</button></footer></div>
}
