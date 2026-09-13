"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{sortRoomsByHotelCategory,sortRoomTypesByHotelCategory}from"../../core/roomOrder"
import{EMPTY_ROOM,EMPTY_TYPE,ROOM_PALETTE}from"./roomAdminShared"
import{RoomAdminRoomList,RoomAdminTypeList}from"./RoomAdminLists"
import RoomAdminRoomDrawer from"./RoomAdminRoomDrawer"
import RoomAdminTypeDrawer from"./RoomAdminTypeDrawer"
import RoomAdminFloors from"./RoomAdminFloors"
import s from"./propertyRooms.module.css"

export default function PropertyRoomsManager({propertyId,property,currency="ARS"}){
  const[section,setSection]=useState("rooms"),[rooms,setRooms]=useState([]),[types,setTypes]=useState([]),[floors,setFloors]=useState([]),[accessPoints,setAccessPoints]=useState([])
  const[loading,setLoading]=useState(true),[saving,setSaving]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState(""),[query,setQuery]=useState("")
  const[roomEditor,setRoomEditor]=useState(null),[typeEditor,setTypeEditor]=useState(null),[floorEditor,setFloorEditor]=useState(null),[menu,setMenu]=useState(null)
  const canManage=["owner","manager"].includes(property?.role)

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[roomRes,typeRes,floorRes,accessRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,room_type_id,color,capacidad,precio,activa,online_bookable,estado,floor_id,sort_order,descripcion,housekeeping_zone").eq("property_id",propertyId).order("sort_order").order("nombre"),
        supabase.from("hotel_room_types").select("id,name,code,color,capacity,adults,children,beds,base_price,description,amenities,active,online_bookable,sort_order,updated_at").eq("property_id",propertyId).order("sort_order").order("name"),
        supabase.from("hotel_floors").select("id,name,sort_order,active").eq("property_id",propertyId).order("sort_order").order("name"),
        supabase.from("hotel_access_points").select("id,room_id,name,provider,connection_status,pin_enabled,remote_open_enabled,active").eq("property_id",propertyId).eq("active",true),
      ])
      for(const result of[roomRes,typeRes,floorRes,accessRes])if(result.error)throw result.error
      setRooms(roomRes.data||[]);setTypes(typeRes.data||[]);setFloors(floorRes.data||[]);setAccessPoints(accessRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar la administración de habitaciones.")}
    finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{load()},[load])
  useEffect(()=>{if(!menu)return;const close=()=>setMenu(null);window.addEventListener("click",close);return()=>window.removeEventListener("click",close)},[menu])

  const orderedTypes=useMemo(()=>sortRoomTypesByHotelCategory(types),[types])
  const orderedFloors=useMemo(()=>[...floors].sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.name||"").localeCompare(String(b.name||""),"es",{numeric:true})),[floors])
  const typeById=useMemo(()=>new Map(orderedTypes.map(type=>[type.id,type])),[orderedTypes]),floorById=useMemo(()=>new Map(orderedFloors.map(floor=>[floor.id,floor])),[orderedFloors])
  const orderedRooms=useMemo(()=>sortRoomsByHotelCategory(rooms,typeById,floorById),[rooms,typeById,floorById])
  const accessByRoom=useMemo(()=>{const map=new Map();for(const point of accessPoints)if(point.room_id&&!map.has(Number(point.room_id)))map.set(Number(point.room_id),point);return map},[accessPoints])
  const filteredRooms=useMemo(()=>orderedRooms.filter(room=>!query||`${room.nombre} ${room.tipo||""} ${floorById.get(room.floor_id)?.name||""} ${room.housekeeping_zone||""}`.toLowerCase().includes(query.toLowerCase())),[orderedRooms,query,floorById])
  const filteredTypes=useMemo(()=>orderedTypes.filter(type=>!query||`${type.name} ${type.code||""}`.toLowerCase().includes(query.toLowerCase())),[orderedTypes,query])

  function flash(message){setNotice(message);window.setTimeout(()=>setNotice(""),3000)}
  function menuButton(kind,id,event){event.stopPropagation();setMenu(current=>current?.kind===kind&&current?.id===id?null:{kind,id})}
  function openRoom(room){setMenu(null);setRoomEditor({...EMPTY_ROOM,...room,room_type_id:room.room_type_id||"",color:room.color||"",floor_id:room.floor_id||"",housekeeping_zone:room.housekeeping_zone||"",descripcion:room.descripcion||""})}
  function openType(type){setMenu(null);setTypeEditor({...EMPTY_TYPE,...type,amenities:Array.isArray(type.amenities)?type.amenities:[]})}
  function newRoom(){const type=orderedTypes.find(item=>item.active)||orderedTypes[0];setRoomEditor({...EMPTY_ROOM,room_type_id:type?.id||"",capacidad:type?.capacity||2,precio:type?.base_price||0,sort_order:rooms.length+1})}
  function newType(){setTypeEditor({...EMPTY_TYPE,color:ROOM_PALETTE[types.length%ROOM_PALETTE.length],sort_order:types.length+1})}
  function newFloor(){const max=orderedFloors.reduce((value,floor)=>Math.max(value,Number(floor.sort_order)||0),0);setFloorEditor({name:"",sort_order:max?max+10:10,active:true})}

  async function toggleRoom(room,field){if(!canManage)return setError("Sólo Propietario o Gerencia pueden cambiar esta configuración.");setSaving(`${field}-${room.id}`);setError("");try{const next=!room[field],patch={[field]:next};if(field==="activa"&&!next)patch.online_bookable=false;const{error:e}=await supabase.from("habitaciones").update(patch).eq("id",room.id).eq("property_id",propertyId);if(e)throw e;await load()}catch(err){setError(err?.message||"No se pudo actualizar la habitación.")}finally{setSaving("")}}

  async function saveRoom(form){
    if(!canManage)return setError("No tenés permisos para modificar habitaciones.");if(!form.nombre?.trim())return setError("Ingresá el nombre o número de la habitación.")
    setSaving("room-editor");setError("")
    try{const selectedType=types.find(type=>type.id===form.room_type_id)||null,payload={property_id:propertyId,nombre:form.nombre.trim(),tipo:selectedType?.name||null,room_type_id:selectedType?.id||null,color:form.color||null,capacidad:Math.max(1,Number(form.capacidad)||selectedType?.capacity||1),precio:Math.max(0,Number(form.precio)||0),activa:Boolean(form.activa),online_bookable:Boolean(form.activa&&form.online_bookable),floor_id:form.floor_id||null,housekeeping_zone:form.housekeeping_zone?.trim()||null,descripcion:form.descripcion?.trim()||null,sort_order:Number(form.sort_order)||0};const result=form.id?await supabase.from("habitaciones").update(payload).eq("id",form.id).eq("property_id",propertyId):await supabase.from("habitaciones").insert({...payload,estado:"libre"});if(result.error)throw result.error;setRoomEditor(null);await load();flash(form.id?"Habitación actualizada.":"Habitación creada.")}catch(err){setError(err?.message||"No se pudo guardar la habitación.")}finally{setSaving("")}
  }

  async function duplicateRoom(room){if(!canManage)return;setMenu(null);setSaving(`duplicate-${room.id}`);setError("");try{const payload={property_id:propertyId,nombre:`${room.nombre} copia`,tipo:room.tipo||null,room_type_id:room.room_type_id||null,color:room.color||null,capacidad:room.capacidad||1,precio:room.precio||0,activa:false,online_bookable:false,estado:"libre",floor_id:room.floor_id||null,housekeeping_zone:room.housekeeping_zone||null,descripcion:room.descripcion||null,sort_order:(room.sort_order||0)+1};const{error:e}=await supabase.from("habitaciones").insert(payload);if(e)throw e;await load();flash("Habitación duplicada como inactiva para revisarla antes de publicarla.")}catch(err){setError(err?.message||"No se pudo duplicar la habitación.")}finally{setSaving("")}}

  async function removeRoom(room){
    if(!canManage)return;setMenu(null);if(!window.confirm(`¿Eliminar la habitación ${room.nombre}? Si tiene historial se archivará en lugar de borrarse.`))return;setSaving(`delete-${room.id}`);setError("")
    try{const{count,error:countError}=await supabase.from("reservas").select("id",{count:"exact",head:true}).eq("property_id",propertyId).eq("habitacion_id",room.id);if(countError)throw countError;if((count||0)>0){const{error:e}=await supabase.from("habitaciones").update({activa:false,online_bookable:false}).eq("id",room.id).eq("property_id",propertyId);if(e)throw e;setRoomEditor(null);await load();flash("La habitación tiene historial: quedó archivada e invisible para nuevas ventas.");return}const{error:deleteError}=await supabase.from("habitaciones").delete().eq("id",room.id).eq("property_id",propertyId);if(deleteError){const{error:e}=await supabase.from("habitaciones").update({activa:false,online_bookable:false}).eq("id",room.id).eq("property_id",propertyId);if(e)throw deleteError;setRoomEditor(null);await load();flash("No se pudo borrar por relaciones operativas; quedó archivada de forma segura.");return}setRoomEditor(null);await load();flash("Habitación eliminada.")}catch(err){setError(err?.message||"No se pudo eliminar la habitación.")}finally{setSaving("")}
  }

  async function saveType(form){
    if(!canManage)return setError("No tenés permisos para modificar tipos de habitación.");if(!form.name?.trim())return setError("Ingresá un nombre para el tipo de habitación.");setSaving("type-editor");setError("")
    try{const payload={property_id:propertyId,name:form.name.trim(),code:form.code?.trim()?.toUpperCase()||null,color:form.color||ROOM_PALETTE[0],capacity:Math.max(1,Number(form.capacity)||1),adults:Math.max(0,Number(form.adults)||0),children:Math.max(0,Number(form.children)||0),beds:Math.max(0,Number(form.beds)||0),base_price:Math.max(0,Number(form.base_price)||0),description:form.description?.trim()||null,amenities:Array.isArray(form.amenities)?form.amenities.filter(Boolean):[],active:Boolean(form.active),online_bookable:Boolean(form.active&&form.online_bookable),sort_order:Number(form.sort_order)||0,updated_at:new Date().toISOString()};let typeId=form.id;if(form.id){const{error:e}=await supabase.from("hotel_room_types").update(payload).eq("id",form.id).eq("property_id",propertyId);if(e)throw e}else{const{data,error:e}=await supabase.from("hotel_room_types").insert(payload).select("id").single();if(e)throw e;typeId=data.id}if(form.id){const{error:e}=await supabase.from("habitaciones").update({tipo:payload.name}).eq("property_id",propertyId).eq("room_type_id",typeId);if(e)throw e}setTypeEditor(null);await load();flash(form.id?"Tipo de habitación actualizado.":"Tipo de habitación creado.")}catch(err){setError(err?.message||"No se pudo guardar el tipo de habitación.")}finally{setSaving("")}
  }

  async function toggleType(type){if(!canManage)return;setSaving(`type-${type.id}`);setError("");try{const next=!type.active,patch={active:next,updated_at:new Date().toISOString()};if(!next)patch.online_bookable=false;const{error:e}=await supabase.from("hotel_room_types").update(patch).eq("id",type.id).eq("property_id",propertyId);if(e)throw e;await load()}catch(err){setError(err?.message||"No se pudo actualizar el tipo.")}finally{setSaving("")}}
  async function removeType(type){if(!canManage)return;setMenu(null);const used=rooms.filter(room=>room.room_type_id===type.id).length;if(used)return setError(`No se puede eliminar ${type.name}: está asignado a ${used} habitación${used===1?"":"es"}. Desactivalo o reasigná esas habitaciones.`);if(!window.confirm(`¿Eliminar el tipo ${type.name}?`))return;setSaving(`type-delete-${type.id}`);try{const{error:e}=await supabase.from("hotel_room_types").delete().eq("id",type.id).eq("property_id",propertyId);if(e)throw e;setTypeEditor(null);await load();flash("Tipo eliminado.")}catch(err){setError(err?.message||"No se pudo eliminar el tipo.")}finally{setSaving("")}}

  const activeRooms=rooms.filter(room=>room.activa).length,onlineRooms=rooms.filter(room=>room.activa&&room.online_bookable).length,activeTypes=types.filter(type=>type.active).length,activeFloors=floors.filter(floor=>floor.active!==false).length,assignedRooms=rooms.filter(room=>room.floor_id).length
  const metrics=section==="rooms"?[{label:"Total",value:rooms.length,tone:"neutral"},{label:"Activas",value:activeRooms,tone:"green"},{label:"Venta online",value:onlineRooms,tone:"blue"}]:section==="types"?[{label:"Tipos",value:types.length,tone:"neutral"},{label:"Activos",value:activeTypes,tone:"green"},{label:"Habitaciones vinculadas",value:rooms.filter(room=>room.room_type_id).length,tone:"gold"}]:[{label:"Pisos",value:floors.length,tone:"neutral"},{label:"Activos",value:activeFloors,tone:"green"},{label:"Habitaciones asignadas",value:assignedRooms,tone:"blue"}]
  const title=section==="rooms"?"Habitaciones":section==="types"?"Tipos de habitación":"Pisos"
  const description=section==="rooms"?"Administrá inventario, venta online, ubicación y acceso sin formularios eternos.":section==="types"?"Una definición única para Planning, Tarifas, Channel Manager, Motor y sitio web.":"Creá y ordená los pisos del hotel. Ese orden también organiza las habitaciones dentro de cada categoría en el Planning."
  const action=section==="rooms"?newRoom:section==="types"?newType:newFloor
  const actionLabel=section==="rooms"?"Agregar habitación":section==="types"?"Agregar tipo":"Agregar piso"
  const searchPlaceholder=section==="rooms"?"Buscar habitación, tipo, piso o zona":section==="types"?"Buscar tipo o código":"Buscar piso"
  const orderHint=section==="floors"?"El orden de pisos se respeta dentro de cada categoría en Planning":canManage?"Orden hotelero automático por categoría":"Vista sin permisos de edición"

  return <div className={s.shell}><div className={s.subnav}><button className={section==="rooms"?s.subnavActive:""} onClick={()=>{setSection("rooms");setQuery("")}}><span>⌂</span> Habitaciones</button><button className={section==="types"?s.subnavActive:""} onClick={()=>{setSection("types");setQuery("")}}><span>▣</span> Tipos de habitación</button><button className={section==="floors"?s.subnavActive:""} onClick={()=>{setSection("floors");setQuery("")}}><span>▤</span> Pisos</button></div><header className={s.hero}><div><small>PROPIEDAD</small><h2>{title}</h2><p>{description}</p></div>{canManage?<button className={s.primary} onClick={action}>＋ {actionLabel}</button>:<span className={s.readOnly}>Sólo lectura</span>}</header><div className={s.metrics}>{metrics.map(item=><article key={item.label} data-tone={item.tone}><span>{item.label}</span><b>{item.value}</b></article>)}</div><div className={s.toolbar}><label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={searchPlaceholder}/></label><span>{orderHint}</span></div>{error&&<div className={s.error}><b>Revisar</b><span>{error}</span><button onClick={()=>setError("")}>×</button></div>}{notice&&<div className={s.notice}><span>✓</span>{notice}</div>}{loading?<div className={s.empty}>Cargando configuración…</div>:section==="rooms"?<RoomAdminRoomList rooms={filteredRooms} allRooms={orderedRooms} typeById={typeById} floorById={floorById} accessByRoom={accessByRoom} canManage={canManage} saving={saving} menu={menu} openRoom={openRoom} toggleRoom={toggleRoom} duplicateRoom={duplicateRoom} removeRoom={removeRoom} menuButton={menuButton}/>:section==="types"?<RoomAdminTypeList types={filteredTypes} rooms={orderedRooms} currency={currency} canManage={canManage} saving={saving} menu={menu} openType={openType} toggleType={toggleType} removeType={removeType} menuButton={menuButton}/>:<RoomAdminFloors propertyId={propertyId} floors={orderedFloors} rooms={rooms} query={query} editor={floorEditor} setEditor={setFloorEditor} canManage={canManage} onChanged={load} onError={setError} onNotice={flash}/>} {roomEditor&&<RoomAdminRoomDrawer form={roomEditor} setForm={setRoomEditor} types={orderedTypes} floors={orderedFloors} access={roomEditor.id?accessByRoom.get(Number(roomEditor.id)):null} canManage={canManage} saving={saving==="room-editor"} currency={currency} onClose={()=>setRoomEditor(null)} onSave={()=>saveRoom(roomEditor)} onDelete={roomEditor.id?()=>removeRoom(roomEditor):null}/>} {typeEditor&&<RoomAdminTypeDrawer form={typeEditor} setForm={setTypeEditor} canManage={canManage} saving={saving==="type-editor"} currency={currency} onClose={()=>setTypeEditor(null)} onSave={()=>saveType(typeEditor)} onDelete={typeEditor.id?()=>removeType(typeEditor):null}/>}</div>
}
