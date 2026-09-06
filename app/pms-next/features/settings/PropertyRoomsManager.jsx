"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./propertyRooms.module.css"

const TYPE_PALETTE=["#5B6CF3","#2EA7A0","#9A6BDF","#D59B48","#4A8FD8","#D56F8A","#5A9B68","#8A6E5A"]
const EMPTY_ROOM={nombre:"",room_type_id:"",color:"",capacidad:2,precio:0,activa:true,online_bookable:true,floor_id:"",housekeeping_zone:"",descripcion:"",sort_order:0}
const EMPTY_TYPE={name:"",code:"",color:TYPE_PALETTE[0],capacity:2,adults:2,children:0,beds:1,base_price:0,description:"",amenities:[],active:true,online_bookable:true,sort_order:0}
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)

export default function PropertyRoomsManager({propertyId,property,currency="ARS"}){
  const[section,setSection]=useState("rooms")
  const[rooms,setRooms]=useState([])
  const[types,setTypes]=useState([])
  const[floors,setFloors]=useState([])
  const[accessPoints,setAccessPoints]=useState([])
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState("")
  const[error,setError]=useState("")
  const[notice,setNotice]=useState("")
  const[query,setQuery]=useState("")
  const[roomEditor,setRoomEditor]=useState(null)
  const[typeEditor,setTypeEditor]=useState(null)
  const[menu,setMenu]=useState(null)
  const canManage=["owner","manager"].includes(property?.role)

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[roomRes,typeRes,floorRes,accessRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,room_type_id,color,capacidad,precio,activa,online_bookable,estado,floor_id,sort_order,descripcion,housekeeping_zone").eq("property_id",propertyId).order("sort_order").order("nombre"),
        supabase.from("hotel_room_types").select("id,name,code,color,capacity,adults,children,beds,base_price,description,amenities,active,online_bookable,sort_order,updated_at").eq("property_id",propertyId).order("sort_order").order("name"),
        supabase.from("hotel_floors").select("id,name,sort_order,active").eq("property_id",propertyId).order("sort_order"),
        supabase.from("hotel_access_points").select("id,room_id,name,kind,provider,connection_status,pin_enabled,remote_open_enabled,active").eq("property_id",propertyId).eq("active",true),
      ])
      for(const result of[roomRes,typeRes,floorRes,accessRes])if(result.error)throw result.error
      setRooms(roomRes.data||[]);setTypes(typeRes.data||[]);setFloors(floorRes.data||[]);setAccessPoints(accessRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar la administración de habitaciones.")}
    finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{load()},[load])
  useEffect(()=>{if(!menu)return;const close=()=>setMenu(null);window.addEventListener("click",close);return()=>window.removeEventListener("click",close)},[menu])

  const typeById=useMemo(()=>new Map(types.map(type=>[type.id,type])),[types])
  const floorById=useMemo(()=>new Map(floors.map(floor=>[floor.id,floor])),[floors])
  const accessByRoom=useMemo(()=>{const map=new Map();for(const point of accessPoints)if(point.room_id&&!map.has(Number(point.room_id)))map.set(Number(point.room_id),point);return map},[accessPoints])
  const filteredRooms=useMemo(()=>rooms.filter(room=>!query||`${room.nombre} ${room.tipo||""} ${floorById.get(room.floor_id)?.name||""} ${room.housekeeping_zone||""}`.toLowerCase().includes(query.toLowerCase())),[rooms,query,floorById])
  const filteredTypes=useMemo(()=>types.filter(type=>!query||`${type.name} ${type.code||""}`.toLowerCase().includes(query.toLowerCase())),[types,query])
  const activeRooms=rooms.filter(room=>room.activa).length,onlineRooms=rooms.filter(room=>room.activa&&room.online_bookable).length
  const activeTypes=types.filter(type=>type.active).length

  function notify(message){setNotice(message);setTimeout(()=>setNotice(""),3200)}
  function openNewRoom(){
    const type=types.find(item=>item.active)||types[0]
    setRoomEditor({...EMPTY_ROOM,room_type_id:type?.id||"",capacidad:type?.capacity||2,precio:type?.base_price||0,sort_order:rooms.length+1})
  }
  function openRoom(room){setMenu(null);setRoomEditor({...EMPTY_ROOM,...room,room_type_id:room.room_type_id||"",color:room.color||"",floor_id:room.floor_id||"",housekeeping_zone:room.housekeeping_zone||"",descripcion:room.descripcion||""})}
  function openNewType(){setTypeEditor({...EMPTY_TYPE,color:TYPE_PALETTE[types.length%TYPE_PALETTE.length],sort_order:types.length+1})}
  function openType(type){setMenu(null);setTypeEditor({...EMPTY_TYPE,...type,amenities:Array.isArray(type.amenities)?type.amenities:[]})}

  async function toggleRoom(room,field){
    if(!canManage)return setError("Sólo Propietario o Gerencia pueden cambiar esta configuración.")
    setSaving(`${field}-${room.id}`);setError("")
    try{
      const next=!room[field]
      const patch={[field]:next,updated_at:new Date().toISOString()}
      if(field==="activa"&&!next)patch.online_bookable=false
      const{error:updateError}=await supabase.from("habitaciones").update(patch).eq("id",room.id).eq("property_id",propertyId)
      if(updateError)throw updateError
      await load()
    }catch(err){setError(err?.message||"No se pudo actualizar la habitación.")}
    finally{setSaving("")}
  }

  async function saveRoom(form){
    if(!canManage)return setError("No tenés permisos para modificar habitaciones.")
    if(!form.nombre?.trim())return setError("Ingresá el nombre o número de la habitación.")
    setSaving("room-editor");setError("")
    try{
      const selectedType=types.find(type=>type.id===form.room_type_id)||null
      const payload={
        property_id:propertyId,
        nombre:form.nombre.trim(),
        tipo:selectedType?.name||null,
        room_type_id:selectedType?.id||null,
        color:form.color||null,
        capacidad:Math.max(1,Number(form.capacidad)||selectedType?.capacity||1),
        precio:Math.max(0,Number(form.precio)||0),
        activa:Boolean(form.activa),
        online_bookable:Boolean(form.activa&&form.online_bookable),
        floor_id:form.floor_id||null,
        housekeeping_zone:form.housekeeping_zone?.trim()||null,
        descripcion:form.descripcion?.trim()||null,
        sort_order:Number(form.sort_order)||0,
      }
      const result=form.id
        ?await supabase.from("habitaciones").update(payload).eq("id",form.id).eq("property_id",propertyId)
        :await supabase.from("habitaciones").insert({...payload,estado:"libre"})
      if(result.error)throw result.error
      setRoomEditor(null);await load();notify(form.id?"Habitación actualizada.":"Habitación creada.")
    }catch(err){setError(err?.message||"No se pudo guardar la habitación.")}
    finally{setSaving("")}
  }

  async function duplicateRoom(room){
    if(!canManage)return
    setMenu(null);setSaving(`duplicate-${room.id}`);setError("")
    try{
      const payload={property_id:propertyId,nombre:`${room.nombre} copia`,tipo:room.tipo||null,room_type_id:room.room_type_id||null,color:room.color||null,capacidad:room.capacidad||1,precio:room.precio||0,activa:false,online_bookable:false,estado:"libre",floor_id:room.floor_id||null,housekeeping_zone:room.housekeeping_zone||null,descripcion:room.descripcion||null,sort_order:(room.sort_order||0)+1}
      const{error:insertError}=await supabase.from("habitaciones").insert(payload)
      if(insertError)throw insertError
      await load();notify("Habitación duplicada como inactiva para que la revises antes de publicarla.")
    }catch(err){setError(err?.message||"No se pudo duplicar la habitación.")}
    finally{setSaving("")}
  }

  async function removeRoom(room){
    if(!canManage)return
    setMenu(null)
    if(!window.confirm(`¿Eliminar la habitación ${room.nombre}? Si tiene historial se archivará en lugar de borrarse.`))return
    setSaving(`delete-${room.id}`);setError("")
    try{
      const{count,error:countError}=await supabase.from("reservas").select("id",{count:"exact",head:true}).eq("property_id",propertyId).eq("habitacion_id",room.id)
      if(countError)throw countError
      if((count||0)>0){
        const{error:updateError}=await supabase.from("habitaciones").update({activa:false,online_bookable:false}).eq("id",room.id).eq("property_id",propertyId)
        if(updateError)throw updateError
        await load();notify("La habitación tiene historial: quedó archivada e invisible para nuevas ventas.");return
      }
      const{error:deleteError}=await supabase.from("habitaciones").delete().eq("id",room.id).eq("property_id",propertyId)
      if(deleteError){
        const{error:updateError}=await supabase.from("habitaciones").update({activa:false,online_bookable:false}).eq("id",room.id).eq("property_id",propertyId)
        if(updateError)throw deleteError
        await load();notify("No se pudo borrar por relaciones operativas; quedó archivada de forma segura.");return
      }
      await load();notify("Habitación eliminada.")
    }catch(err){setError(err?.message||"No se pudo eliminar la habitación.")}
    finally{setSaving("")}
  }

  async function saveType(form){
    if(!canManage)return setError("No tenés permisos para modificar tipos de habitación.")
    if(!form.name?.trim())return setError("Ingresá un nombre para el tipo de habitación.")
    setSaving("type-editor");setError("")
    try{
      const payload={property_id:propertyId,name:form.name.trim(),code:form.code?.trim()?.toUpperCase()||null,color:form.color||TYPE_PALETTE[0],capacity:Math.max(1,Number(form.capacity)||1),adults:Math.max(0,Number(form.adults)||0),children:Math.max(0,Number(form.children)||0),beds:Math.max(0,Number(form.beds)||0),base_price:Math.max(0,Number(form.base_price)||0),description:form.description?.trim()||null,amenities:Array.isArray(form.amenities)?form.amenities.filter(Boolean):[],active:Boolean(form.active),online_bookable:Boolean(form.active&&form.online_bookable),sort_order:Number(form.sort_order)||0,updated_at:new Date().toISOString()}
      let typeId=form.id
      if(form.id){
        const{error:updateError}=await supabase.from("hotel_room_types").update(payload).eq("id",form.id).eq("property_id",propertyId)
        if(updateError)throw updateError
      }else{
        const{data,error:insertError}=await supabase.from("hotel_room_types").insert(payload).select("id").single()
        if(insertError)throw insertError;typeId=data.id
      }
      if(form.id){
        const{error:syncError}=await supabase.from("habitaciones").update({tipo:payload.name}).eq("property_id",propertyId).eq("room_type_id",typeId)
        if(syncError)throw syncError
      }
      setTypeEditor(null);await load();notify(form.id?"Tipo de habitación actualizado.":"Tipo de habitación creado.")
    }catch(err){setError(err?.message||"No se pudo guardar el tipo de habitación.")}
    finally{setSaving("")}
  }

  async function toggleType(type){
    if(!canManage)return
    setSaving(`type-${type.id}`);setError("")
    try{
      const next=!type.active
      const patch={active:next,updated_at:new Date().toISOString()};if(!next)patch.online_bookable=false
      const{error:updateError}=await supabase.from("hotel_room_types").update(patch).eq("id",type.id).eq("property_id",propertyId)
      if(updateError)throw updateError
      await load()
    }catch(err){setError(err?.message||"No se pudo actualizar el tipo.")}
    finally{setSaving("")}
  }

  async function removeType(type){
    if(!canManage)return
    setMenu(null)
    const used=rooms.filter(room=>room.room_type_id===type.id).length
    if(used){setError(`No se puede eliminar ${type.name}: está asignado a ${used} habitación${used===1?"":"es"}. Podés desactivarlo o reasignar esas habitaciones.`);return}
    if(!window.confirm(`¿Eliminar el tipo ${type.name}?`))return
    setSaving(`type-delete-${type.id}`)
    try{const{error:deleteError}=await supabase.from("hotel_room_types").delete().eq("id",type.id).eq("property_id",propertyId);if(deleteError)throw deleteError;await load();notify("Tipo eliminado.")}
    catch(err){setError(err?.message||"No se pudo eliminar el tipo.")}
    finally{setSaving("")}
  }

  function menuButton(kind,id,event){event.stopPropagation();setMenu(current=>current?.kind===kind&&current?.id===id?null:{kind,id})}
  const roomMetric=[{label:"Total",value:rooms.length,tone:"neutral"},{label:"Activas",value:activeRooms,tone:"green"},{label:"Venta online",value:onlineRooms,tone:"blue"}]
  const typeMetric=[{label:"Tipos",value:types.length,tone:"neutral"},{label:"Activos",value:activeTypes,tone:"green"},{label:"Habitaciones vinculadas",value:rooms.filter(room=>room.room_type_id).length,tone:"gold"}]

  return <div className={s.shell}>
    <div className={s.subnav}>
      <button className={section==="rooms"?s.subnavActive:""} onClick={()=>{setSection("rooms");setQuery("")}}><span>⌂</span> Habitaciones</button>
      <button className={section==="types"?s.subnavActive:""} onClick={()=>{setSection("types");setQuery("")}}><span>▣</span> Tipos de habitación</button>
    </div>

    <header className={s.hero}>
      <div><small>PROPIEDAD</small><h2>{section==="rooms"?"Habitaciones":"Tipos de habitación"}</h2><p>{section==="rooms"?"Administrá inventario, venta online, ubicación y acceso sin entrar a formularios innecesarios.":"Una definición única para Planning, Tarifas, Channel Manager, Motor y sitio web."}</p></div>
      {canManage?<button className={s.primary} onClick={section==="rooms"?openNewRoom:openNewType}>＋ {section==="rooms"?"Agregar habitación":"Agregar tipo"}</button>:<span className={s.readOnly}>Sólo lectura</span>}
    </header>

    <div className={s.metrics}>{(section==="rooms"?roomMetric:typeMetric).map(item=><article key={item.label} data-tone={item.tone}><span>{item.label}</span><b>{item.value}</b></article>)}</div>
    <div className={s.toolbar}><label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={section==="rooms"?"Buscar habitación, tipo, piso o zona":"Buscar tipo o código"}/></label><span>{canManage?"Cambios protegidos por permisos de propiedad":"Vista sin permisos de edición"}</span></div>
    {error&&<div className={s.error}><b>Revisar</b><span>{error}</span><button onClick={()=>setError("")}>×</button></div>}
    {notice&&<div className={s.notice}><span>✓</span>{notice}</div>}

    {loading?<div className={s.empty}>Cargando configuración…</div>:section==="rooms"?<div className={s.list}>
      {filteredRooms.map(room=>{
        const type=typeById.get(room.room_type_id),floor=floorById.get(room.floor_id),access=accessByRoom.get(Number(room.id)),color=room.color||type?.color||"#8290A5",menuOpen=menu?.kind==="room"&&menu.id===room.id
        return <article key={room.id} className={s.row} onClick={()=>openRoom(room)}>
          <span className={s.drag}>⋮⋮</span><span className={s.colorDot} style={{"--room-color":color}}/>
          <div className={s.identity}><b>{room.nombre}</b><small>{type?.name||room.tipo||"Sin tipo"} · {room.capacidad||type?.capacity||1} pers.{floor?` · ${floor.name}`:""}</small></div>
          <div className={s.statusStack}><span data-state={room.activa?"ok":"off"}>{room.activa?"Operativa":"Inactiva"}</span><small>{room.estado||"libre"}</small></div>
          <div className={s.access}><span data-state={access?.connection_status==="connected"?"ok":"off"}>{access?.connection_status==="connected"?"Acceso conectado":"Sin acceso smart"}</span><small>{access?.provider&&access.provider!=="manual"?access.provider:"Código por estadía preparado"}</small></div>
          <div className={s.switchBlock} onClick={e=>e.stopPropagation()}><span>Activa</span><Switch checked={room.activa} disabled={!canManage||saving===`activa-${room.id}`} onChange={()=>toggleRoom(room,"activa")}/></div>
          <div className={s.switchBlock} onClick={e=>e.stopPropagation()}><span>Online</span><Switch checked={Boolean(room.activa&&room.online_bookable)} disabled={!canManage||!room.activa||saving===`online_bookable-${room.id}`} onChange={()=>toggleRoom(room,"online_bookable")}/></div>
          <div className={s.moreWrap} onClick={e=>e.stopPropagation()}><button className={s.more} aria-label={`Acciones de ${room.nombre}`} onClick={e=>menuButton("room",room.id,e)}>⋯</button>{menuOpen&&<div className={s.menu} onClick={e=>e.stopPropagation()}><button onClick={()=>openRoom(room)}>Editar</button><button onClick={()=>duplicateRoom(room)}>Duplicar</button><button onClick={()=>toggleRoom(room,"activa")}>{room.activa?"Desactivar":"Activar"}</button><button className={s.danger} onClick={()=>removeRoom(room)}>Eliminar</button></div>}</div>
        </article>
      })}
      {!filteredRooms.length&&<div className={s.empty}>{rooms.length?"No hay resultados para esa búsqueda.":"Todavía no hay habitaciones. Creá la primera para empezar."}</div>}
    </div>:<div className={s.list}>
      {filteredTypes.map(type=>{const count=rooms.filter(room=>room.room_type_id===type.id).length,menuOpen=menu?.kind==="type"&&menu.id===type.id;return <article key={type.id} className={s.rowType} onClick={()=>openType(type)}>
        <span className={s.drag}>⋮⋮</span><span className={s.colorDot} style={{"--room-color":type.color}}/><div className={s.identity}><b>{type.name}</b><small>{type.beds||0} cama{type.beds===1?"":"s"} · {type.capacity||1} pers. · {count} habitación{count===1?"":"es"}</small></div>
        <span className={s.code}>{type.code||"SIN CÓDIGO"}</span><b className={s.price}>{money(type.base_price,currency)}</b><div className={s.switchBlock} onClick={e=>e.stopPropagation()}><span>Activo</span><Switch checked={type.active} disabled={!canManage||saving===`type-${type.id}`} onChange={()=>toggleType(type)}/></div>
        <div className={s.moreWrap} onClick={e=>e.stopPropagation()}><button className={s.more} onClick={e=>menuButton("type",type.id,e)}>⋯</button>{menuOpen&&<div className={s.menu} onClick={e=>e.stopPropagation()}><button onClick={()=>openType(type)}>Editar</button><button onClick={()=>toggleType(type)}>{type.active?"Desactivar":"Activar"}</button><button className={s.danger} onClick={()=>removeType(type)}>Eliminar</button></div>}</div>
      </article>})}
      {!filteredTypes.length&&<div className={s.empty}>{types.length?"No hay resultados para esa búsqueda.":"Todavía no hay tipos de habitación."}</div>}
    </div>}

    {roomEditor&&<RoomDrawer form={roomEditor} setForm={setRoomEditor} types={types} floors={floors} access={roomEditor.id?accessByRoom.get(Number(roomEditor.id)):null} canManage={canManage} saving={saving==="room-editor"} currency={currency} onClose={()=>setRoomEditor(null)} onSave={()=>saveRoom(roomEditor)} onDelete={roomEditor.id?()=>removeRoom(roomEditor):null}/>} 
    {typeEditor&&<TypeDrawer form={typeEditor} setForm={setTypeEditor} canManage={canManage} saving={saving==="type-editor"} currency={currency} onClose={()=>setTypeEditor(null)} onSave={()=>saveType(typeEditor)} onDelete={typeEditor.id?()=>removeType(typeEditor):null}/>} 
  </div>
}

function Switch({checked,disabled,onChange}){return <button type="button" role="switch" aria-checked={checked} className={`${s.switch} ${checked?s.switchOn:""}`} disabled={disabled} onClick={onChange}><i/></button>}

function RoomDrawer({form,setForm,types,floors,access,canManage,saving,currency,onClose,onSave,onDelete}){
  const patch=values=>setForm(current=>({...current,...values})),selectedType=types.find(type=>type.id===form.room_type_id)
  function chooseType(id){const type=types.find(item=>item.id===id);patch({room_type_id:id,capacidad:type?.capacity||form.capacidad,precio:form.id?form.precio:type?.base_price||form.precio})}
  return <div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&onClose()}><aside className={s.drawer} onMouseDown={e=>e.stopPropagation()}>
    <header className={s.drawerHead}><div><small>HABITACIÓN</small><h2>{form.id?`Editar ${form.nombre}`:"Nueva habitación"}</h2><p>{form.id?"Los cambios impactan en Planning y disponibilidad en cuanto guardás.":"La habitación se crea conectada al inventario real del hotel."}</p></div><button className={s.close} onClick={onClose}>×</button></header>
    <div className={s.drawerBody}>
      <Section title="Identidad" subtitle="Cómo se identifica y agrupa dentro del hotel."><div className={s.formGrid}>
        <Field label="Nombre / número"><input value={form.nombre||""} onChange={e=>patch({nombre:e.target.value})} autoFocus/></Field>
        <Field label="Tipo de habitación"><select value={form.room_type_id||""} onChange={e=>chooseType(e.target.value)}><option value="">Sin tipo</option>{types.map(type=><option key={type.id} value={type.id}>{type.name}{!type.active?" · inactivo":""}</option>)}</select></Field>
        <Field label="Piso"><select value={form.floor_id||""} onChange={e=>patch({floor_id:e.target.value})}><option value="">Sin piso</option>{floors.filter(f=>f.active!==false).map(floor=><option key={floor.id} value={floor.id}>{floor.name}</option>)}</select></Field>
        <Field label="Zona housekeeping"><input value={form.housekeeping_zone||""} onChange={e=>patch({housekeeping_zone:e.target.value})} placeholder="Ej. Ala norte"/></Field>
        <Field label="Orden"><input type="number" value={form.sort_order||0} onChange={e=>patch({sort_order:e.target.value})}/></Field>
        <div className={s.colorField}><span>Color de habitación <em>opcional</em></span><div className={s.colors}><button type="button" className={!form.color?s.colorSelected:""} onClick={()=>patch({color:""})}>Auto</button>{TYPE_PALETTE.map(color=><button type="button" key={color} aria-label={color} className={form.color===color?s.colorSelected:""} style={{"--pick":color}} onClick={()=>patch({color})}/>)}</div><small>Si no elegís uno, usa {selectedType?.name?`el color de ${selectedType.name}`:"el color neutro"}.</small></div>
      </div></Section>
      <Section title="Capacidad y venta" subtitle="Lo que ve operación y lo que puede venderse online."><div className={s.formGrid}>
        <Field label="Capacidad"><input type="number" min="1" max="30" value={form.capacidad||1} onChange={e=>patch({capacidad:e.target.value})}/></Field>
        <Field label={`Precio base · ${currency}`}><input type="number" min="0" value={form.precio||0} onChange={e=>patch({precio:e.target.value})}/></Field>
        <ToggleCard title="Habitación activa" text="Aparece en Planning y puede usarse operativamente." checked={form.activa!==false} onChange={value=>patch({activa:value,online_bookable:value?form.online_bookable:false})}/>
        <ToggleCard title="Venta online" text="Permite ofrecerla en el Motor cuando está disponible." checked={Boolean(form.activa&&form.online_bookable)} disabled={!form.activa} onChange={value=>patch({online_bookable:value})}/>
      </div></Section>
      <Section title="Operación" subtitle="Datos internos para recepción, housekeeping y mantenimiento."><Field label="Notas internas"><textarea rows="4" value={form.descripcion||""} onChange={e=>patch({descripcion:e.target.value})} placeholder="Características, observaciones o información útil para el equipo."/></Field></Section>
      <Section title="Acceso inteligente" subtitle="Los PIN de huéspedes no se guardan como un código fijo en esta ficha."><div className={s.accessCard}><span data-connected={access?.connection_status==="connected"}>{access?.connection_status==="connected"?"✓":"⌁"}</span><div><b>{access?.connection_status==="connected"?access.name||"Acceso conectado":"Sin cerradura conectada"}</b><small>{access?.connection_status==="connected"?`${access.provider||"Proveedor"} · PIN ${access.pin_enabled?"habilitado":"deshabilitado"} · apertura remota ${access.remote_open_enabled?"sí":"no"}`:"Cuando conectemos una cerradura, Habitación Llena podrá generar un PIN distinto para cada estadía."}</small></div></div></Section>
    </div>
    <footer className={s.drawerFooter}>{onDelete&&canManage?<button className={s.deleteButton} onClick={onDelete}>Eliminar</button>:<span/>}<div><button onClick={onClose}>Cancelar</button><button className={s.primary} disabled={!canManage||saving||!form.nombre?.trim()} onClick={onSave}>{saving?"Guardando…":"Guardar cambios"}</button></div></footer>
  </aside></div>
}

function TypeDrawer({form,setForm,canManage,saving,currency,onClose,onSave,onDelete}){
  const patch=values=>setForm(current=>({...current,...values})),amenities=(form.amenities||[]).join(", ")
  return <div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&onClose()}><aside className={s.drawer} onMouseDown={e=>e.stopPropagation()}>
    <header className={s.drawerHead}><div><small>TIPO DE HABITACIÓN</small><h2>{form.id?`Editar ${form.name}`:"Nuevo tipo"}</h2><p>Esta ficha se reutiliza en Planning, tarifas, integraciones y venta directa.</p></div><button className={s.close} onClick={onClose}>×</button></header>
    <div className={s.drawerBody}>
      <Section title="Identidad comercial" subtitle="Nombre, código y color consistentes en todo el PMS."><div className={s.formGrid}>
        <Field label="Nombre"><input value={form.name||""} onChange={e=>patch({name:e.target.value})} autoFocus/></Field><Field label="Código interno"><input value={form.code||""} maxLength="16" onChange={e=>patch({code:e.target.value.toUpperCase()})} placeholder="DBL-SUP"/></Field>
        <Field label="Orden"><input type="number" value={form.sort_order||0} onChange={e=>patch({sort_order:e.target.value})}/></Field>
        <div className={s.colorField}><span>Color</span><div className={s.colors}>{TYPE_PALETTE.map(color=><button type="button" key={color} aria-label={color} className={form.color===color?s.colorSelected:""} style={{"--pick":color}} onClick={()=>patch({color})}/>)}</div></div>
      </div></Section>
      <Section title="Capacidad" subtitle="Valores predeterminados para las habitaciones de este tipo."><div className={s.formGrid four}><Field label="Máximo"><input type="number" min="1" max="30" value={form.capacity||1} onChange={e=>patch({capacity:e.target.value})}/></Field><Field label="Adultos"><input type="number" min="0" max="30" value={form.adults||0} onChange={e=>patch({adults:e.target.value})}/></Field><Field label="Niños"><input type="number" min="0" max="30" value={form.children||0} onChange={e=>patch({children:e.target.value})}/></Field><Field label="Camas"><input type="number" min="0" max="20" value={form.beds||0} onChange={e=>patch({beds:e.target.value})}/></Field></div></Section>
      <Section title="Venta" subtitle="Base comercial que después puede variar por fecha en Tarifas y disponibilidad."><div className={s.formGrid}><Field label={`Tarifa base · ${currency}`}><input type="number" min="0" value={form.base_price||0} onChange={e=>patch({base_price:e.target.value})}/></Field><Field label="Amenities separados por coma"><input value={amenities} onChange={e=>patch({amenities:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})} placeholder="Wi‑Fi, TV, Aire acondicionado"/></Field><ToggleCard title="Tipo activo" text="Disponible para nuevas habitaciones y configuración comercial." checked={form.active!==false} onChange={value=>patch({active:value,online_bookable:value?form.online_bookable:false})}/><ToggleCard title="Visible en venta directa" text="Puede mostrarse en el Motor y sitio web." checked={Boolean(form.active&&form.online_bookable)} disabled={!form.active} onChange={value=>patch({online_bookable:value})}/></div></Section>
      <Section title="Descripción pública" subtitle="Texto reutilizable en el Motor y la web del hotel."><Field label="Descripción"><textarea rows="5" value={form.description||""} onChange={e=>patch({description:e.target.value})} placeholder="Contá qué hace especial a este tipo de habitación."/></Field></Section>
    </div>
    <footer className={s.drawerFooter}>{onDelete&&canManage?<button className={s.deleteButton} onClick={onDelete}>Eliminar tipo</button>:<span/>}<div><button onClick={onClose}>Cancelar</button><button className={s.primary} disabled={!canManage||saving||!form.name?.trim()} onClick={onSave}>{saving?"Guardando…":"Guardar cambios"}</button></div></footer>
  </aside></div>
}

function Section({title,subtitle,children}){return <section className={s.section}><header><h3>{title}</h3><p>{subtitle}</p></header>{children}</section>}
function Field({label,children}){return <label className={s.field}><span>{label}</span>{children}</label>}
function ToggleCard({title,text,checked,disabled,onChange}){return <div className={`${s.toggleCard} ${checked?s.toggleCardOn:""}`}><div><b>{title}</b><small>{text}</small></div><Switch checked={checked} disabled={disabled} onChange={()=>onChange(!checked)}/></div>}
