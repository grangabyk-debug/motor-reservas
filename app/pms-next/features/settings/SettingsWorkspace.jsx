"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import RolePermissionsPanel from"./RolePermissionsPanel"
import CancellationPoliciesSettings from"./CancellationPoliciesSettings"
import s from"./settings.module.css"

const DEFAULT_PREFS={currency:"ARS",timezone:"America/Argentina/Buenos_Aires",checkin_time:"15:00",checkout_time:"11:00",language:"es-AR"}
const MAX_PHOTO_BYTES=8*1024*1024
const ALLOWED_PHOTO_TYPES=new Set(["image/jpeg","image/png","image/webp"])

export default function SettingsWorkspace({propertyId,property}){
  const[tab,setTab]=useState("property")
  const[rooms,setRooms]=useState([])
  const[floors,setFloors]=useState([])
  const[settings,setSettings]=useState({})
  const[profile,setProfile]=useState({name:property?.name||"",city:property?.city||"",description:property?.description||""})
  const[editingRoom,setEditingRoom]=useState(null)
  const[saving,setSaving]=useState("")
  const[error,setError]=useState("")
  const[notice,setNotice]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setError("")
    const[roomRes,floorRes,settingsRes,propertyRes]=await Promise.all([
      supabase.from("habitaciones").select("id,nombre,tipo,capacidad,precio,activa,estado,floor_id,sort_order,descripcion,housekeeping_zone,cochera_precio,early_checkin_tipo,early_checkin_valor,late_checkout_tipo,late_checkout_valor").eq("property_id",propertyId).order("sort_order").order("nombre"),
      supabase.from("hotel_floors").select("id,name,sort_order,active").eq("property_id",propertyId).order("sort_order"),
      supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      supabase.from("properties").select("id,name,city,description,owner_id").eq("id",propertyId).single(),
    ])
    for(const result of[roomRes,floorRes,settingsRes,propertyRes])if(result.error)throw result.error
    setRooms(roomRes.data||[]);setFloors(floorRes.data||[]);setSettings(settingsRes.data?.settings||{});setProfile({name:propertyRes.data.name||"",city:propertyRes.data.city||"",description:propertyRes.data.description||""})
  },[propertyId])

  useEffect(()=>{load().catch(err=>setError(err?.message||"No se pudo cargar la configuración."))},[load])

  const roomTypes=useMemo(()=>Array.from(new Map(rooms.filter(r=>r.tipo).map(r=>[r.tipo,{name:r.tipo,capacity:r.capacidad||0,rooms:rooms.filter(x=>x.tipo===r.tipo).length,basePrice:r.precio||0}])).values()),[rooms])
  const prefs={...DEFAULT_PREFS,...(settings.preferences||{})}
  const branding=settings.branding||{}
  const canManagePermissions=["owner","manager"].includes(property?.role)

  async function persistSettings(next,successMessage){
    const{error:writeError}=await supabase.from("property_settings").upsert({property_id:propertyId,settings:next,updated_at:new Date().toISOString()},{onConflict:"property_id"})
    if(writeError)throw writeError
    setSettings(next)
    if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:property-settings-updated",{detail:{propertyId,settings:next}}))
    if(successMessage)setNotice(successMessage)
  }

  async function saveProperty(){
    setSaving("property");setError("");setNotice("")
    try{const{error:updateError}=await supabase.from("properties").update({name:profile.name.trim(),city:profile.city.trim()||null,description:profile.description.trim()||null}).eq("id",propertyId);if(updateError)throw updateError;setNotice("Datos de la propiedad guardados.")}
    catch(err){setError(err?.message||"No se pudo guardar la propiedad.")}
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
      setError(message.toLowerCase().includes("bucket")?"El almacenamiento de fotos todavía no está habilitado en esta base. La migración hotel-media ya quedó preparada para staging.":message||"No se pudo subir la foto del hotel.")
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

  async function saveRoom(form){
    setSaving("room");setError("");setNotice("")
    try{
      const payload={property_id:propertyId,nombre:form.nombre.trim(),tipo:form.tipo.trim()||null,capacidad:Number(form.capacidad)||1,precio:Number(form.precio)||0,activa:Boolean(form.activa),floor_id:form.floor_id||null,housekeeping_zone:form.housekeeping_zone.trim()||null,descripcion:form.descripcion.trim()||null,sort_order:Number(form.sort_order)||0}
      if(editingRoom?.id){const{error:updateError}=await supabase.from("habitaciones").update(payload).eq("id",editingRoom.id).eq("property_id",propertyId);if(updateError)throw updateError}
      else{const{error:insertError}=await supabase.from("habitaciones").insert({...payload,estado:"libre"});if(insertError)throw insertError}
      setEditingRoom(null);await load();setNotice("Habitación guardada.")
    }catch(err){setError(err?.message||"No se pudo guardar la habitación.")}
    finally{setSaving("")}
  }

  async function toggleRoom(room){
    setSaving(`room-${room.id}`);setError("")
    try{const{error:updateError}=await supabase.from("habitaciones").update({activa:!room.activa}).eq("id",room.id).eq("property_id",propertyId);if(updateError)throw updateError;await load()}
    catch(err){setError(err?.message||"No se pudo actualizar la habitación.")}
    finally{setSaving("")}
  }

  return <section className={s.page}>
    <header className={s.header}><div><small>CONFIGURACIÓN</small><h1>Propiedad y operación</h1><p>Una sola identidad para el hotel: propiedad, habitaciones, horarios, políticas, permisos y preferencias.</p></div><div className={s.tabs}>{[["property","Propiedad"],["rooms","Habitaciones"],["types","Tipos"],["preferences","Preferencias"],["cancellation","Políticas"],["roles","Roles y permisos"]].map(([id,label])=><button key={id} className={tab===id?s.active:""} onClick={()=>setTab(id)}>{label}</button>)}</div></header>
    {error&&<div className={s.error}>{error}</div>}{notice&&<div className={s.notice}>{notice}</div>}

    {tab==="property"&&<div className={s.propertyLayout}><div className={s.panel}><h2>Datos de la propiedad</h2><p className={s.panelIntro}>Estos datos identifican al hotel dentro del PMS y se reutilizan donde corresponda.</p><div className={s.formGrid}><label>Nombre<input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><label>Ciudad<input value={profile.city} onChange={e=>setProfile({...profile,city:e.target.value})}/></label><label className={s.wide}>Descripción<textarea rows="4" value={profile.description} onChange={e=>setProfile({...profile,description:e.target.value})}/></label></div><footer><button className={s.primary} onClick={saveProperty} disabled={saving==="property"}>{saving==="property"?"Guardando…":"Guardar propiedad"}</button></footer></div><div className={s.photoPanel}><div className={s.photoFrame}>{branding.hotel_photo_url?<img src={branding.hotel_photo_url} alt={`Foto de ${profile.name||"hotel"}`}/>:<div className={s.photoPlaceholder}><span>HL</span><b>Foto principal del hotel</b><small>Se verá en el Dashboard y podrá reutilizarse en la experiencia de reservas.</small></div>}<div className={s.photoGlass}><b>{profile.name||"Tu hotel"}</b><span>{profile.city||"Ubicación sin configurar"}</span></div></div><div className={s.photoActions}><label className={s.uploadButton}>{saving==="photo"?"Subiendo…":"Subir foto"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving==="photo"} onChange={e=>{const file=e.target.files?.[0];if(file)uploadHotelPhoto(file);e.target.value=""}}/></label>{branding.hotel_photo_url&&<button type="button" onClick={removeHotelPhoto} disabled={saving==="photo"}>Quitar</button>}</div><small className={s.photoHelp}>JPG, PNG o WebP · máximo 8 MB · la escritura queda aislada por propiedad.</small></div></div>}

    {tab==="rooms"&&<><div className={s.panelHeader}><div><h2>Habitaciones</h2><p>{rooms.length} registradas · {rooms.filter(r=>r.activa).length} activas</p></div><button className={s.primary} onClick={()=>setEditingRoom({nombre:"",tipo:roomTypes[0]?.name||"",capacidad:2,precio:0,activa:true,floor_id:"",housekeeping_zone:"",descripcion:"",sort_order:rooms.length+1})}>+ Nueva habitación</button></div><div className={s.roomTable}><div className={s.roomHead}><span>Habitación</span><span>Tipo</span><span>Capacidad</span><span>Precio base</span><span>Estado</span><span/></div>{rooms.map(room=><article key={room.id}><div><b>{room.nombre}</b><small>{room.housekeeping_zone||"Sin zona"}</small></div><span>{room.tipo||"Sin tipo"}</span><span>{room.capacidad||1} pers.</span><span>{new Intl.NumberFormat("es-AR",{style:"currency",currency:prefs.currency||"ARS",maximumFractionDigits:0}).format(Number(room.precio)||0)}</span><button className={room.activa?s.on:s.off} onClick={()=>toggleRoom(room)} disabled={saving===`room-${room.id}`}>{room.activa?"Activa":"Inactiva"}</button><button className={s.edit} onClick={()=>setEditingRoom({...room,floor_id:room.floor_id||"",housekeeping_zone:room.housekeeping_zone||"",descripcion:room.descripcion||""})}>Editar</button></article>)}</div></>}

    {tab==="types"&&<div className={s.typeGrid}>{roomTypes.length?roomTypes.map(type=><article key={type.name}><small>TIPO DE HABITACIÓN</small><h2>{type.name}</h2><div><span>{type.rooms} habitaciones</span><span>{type.capacity||"—"} personas</span><span>Desde {new Intl.NumberFormat("es-AR",{style:"currency",currency:prefs.currency||"ARS",maximumFractionDigits:0}).format(Number(type.basePrice)||0)}</span></div><p>Los tipos se forman a partir de las habitaciones reales. Editando el tipo de una habitación se actualiza su agrupación en Planning y Tarifas.</p></article>):<div className={s.notice}>Todavía no hay tipos de habitación configurados.</div>}</div>}

    {tab==="preferences"&&<PreferencesForm key={JSON.stringify(prefs)} value={prefs} onSave={savePrefs} saving={saving==="prefs"}/>}
    {tab==="cancellation"&&<CancellationPoliciesSettings propertyId={propertyId} currency={prefs.currency||"ARS"} canEdit={property?.role==="owner"}/>} 
    {tab==="roles"&&<RolePermissionsPanel key={JSON.stringify(settings.role_permissions||{})} value={settings.role_permissions||{}} canManage={canManagePermissions} saving={saving==="roles"} onSave={saveRolePermissions}/>}

    {editingRoom&&<RoomModal room={editingRoom} floors={floors} roomTypes={roomTypes} saving={saving==="room"} onClose={()=>setEditingRoom(null)} onSave={saveRoom}/>} 
  </section>
}

function PreferencesForm({value,onSave,saving}){
  const[form,setForm]=useState(value)
  return <div className={s.panel}><h2>Preferencias hoteleras</h2><p className={s.panelIntro}>Horarios, moneda e idioma que usa la operación diaria.</p><div className={s.formGrid}><label>Moneda<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option>ARS</option><option>USD</option><option>EUR</option><option>BRL</option><option>CLP</option><option>UYU</option></select></label><label>Idioma<select value={form.language} onChange={e=>setForm({...form,language:e.target.value})}><option value="es-AR">Español (Argentina)</option><option value="es">Español</option><option value="en">English</option><option value="pt-BR">Português</option></select></label><label>Check-in<input type="time" value={form.checkin_time} onChange={e=>setForm({...form,checkin_time:e.target.value})}/></label><label>Check-out<input type="time" value={form.checkout_time} onChange={e=>setForm({...form,checkout_time:e.target.value})}/></label><label className={s.wide}>Zona horaria<input value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})}/></label></div><footer><button className={s.primary} disabled={saving} onClick={()=>onSave(form)}>{saving?"Guardando…":"Guardar preferencias"}</button></footer></div>
}

function RoomModal({room,floors,roomTypes,saving,onClose,onSave}){
  const[form,setForm]=useState(room)
  return <div className={s.backdrop} onClick={onClose}><div className={s.modal} onClick={e=>e.stopPropagation()}><button className={s.close} onClick={onClose} aria-label="Cerrar">×</button><small>HABITACIÓN</small><h2>{room.id?`Editar ${room.nombre}`:"Nueva habitación"}</h2><div className={s.formGrid}><label>Nombre / número<input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></label><label>Tipo<input list="room-types" value={form.tipo||""} onChange={e=>setForm({...form,tipo:e.target.value})}/><datalist id="room-types">{roomTypes.map(type=><option key={type.name} value={type.name}/>)}</datalist></label><label>Capacidad<input type="number" min="1" value={form.capacidad||1} onChange={e=>setForm({...form,capacidad:e.target.value})}/></label><label>Precio base<input type="number" min="0" value={form.precio||0} onChange={e=>setForm({...form,precio:e.target.value})}/></label><label>Piso<select value={form.floor_id||""} onChange={e=>setForm({...form,floor_id:e.target.value})}><option value="">Sin piso</option>{floors.map(floor=><option key={floor.id} value={floor.id}>{floor.name}</option>)}</select></label><label>Zona housekeeping<input value={form.housekeeping_zone||""} onChange={e=>setForm({...form,housekeeping_zone:e.target.value})}/></label><label>Orden<input type="number" value={form.sort_order||0} onChange={e=>setForm({...form,sort_order:e.target.value})}/></label><label className={s.toggle}><input type="checkbox" checked={form.activa!==false} onChange={e=>setForm({...form,activa:e.target.checked})}/> Habitación activa</label><label className={s.wide}>Descripción<textarea rows="3" value={form.descripcion||""} onChange={e=>setForm({...form,descripcion:e.target.value})}/></label></div><footer><button onClick={onClose}>Cancelar</button><button className={s.primary} disabled={saving||!form.nombre.trim()} onClick={()=>onSave(form)}>{saving?"Guardando…":"Guardar habitación"}</button></footer></div></div>
}
