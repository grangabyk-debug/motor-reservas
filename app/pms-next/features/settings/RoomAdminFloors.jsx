"use client"

import{useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{RoomField,RoomSection,RoomToggleCard,RoomSwitch}from"./RoomAdminControls"
import s from"./propertyRooms.module.css"

const floorOrder=value=>{const n=Number(value);return Number.isFinite(n)?n:0}

export default function RoomAdminFloors({propertyId,floors,rooms,query,editor,setEditor,canManage,onChanged,onError,onNotice}){
  const[saving,setSaving]=useState(false)
  const ordered=[...(floors||[])].sort((a,b)=>floorOrder(a.sort_order)-floorOrder(b.sort_order)||String(a.name||"").localeCompare(String(b.name||""),"es",{numeric:true}))
  const visible=ordered.filter(floor=>!query||String(floor.name||"").toLowerCase().includes(String(query).toLowerCase()))
  const roomCount=floorId=>(rooms||[]).filter(room=>String(room.floor_id||"")===String(floorId)).length
  const patch=values=>setEditor(current=>({...current,...values}))

  async function save(){
    if(!canManage)return onError?.("Sólo Propietario o Gerencia pueden modificar pisos.")
    if(!editor?.name?.trim())return onError?.("Ingresá un nombre para el piso.")
    setSaving(true);onError?.("")
    try{
      const payload={property_id:propertyId,name:editor.name.trim(),sort_order:floorOrder(editor.sort_order),active:editor.active!==false}
      const result=editor.id?await supabase.from("hotel_floors").update(payload).eq("id",editor.id).eq("property_id",propertyId):await supabase.from("hotel_floors").insert(payload)
      if(result.error)throw result.error
      setEditor(null);await onChanged?.();onNotice?.(editor.id?"Piso actualizado.":"Piso creado.")
    }catch(err){onError?.(err?.message||"No se pudo guardar el piso.")}finally{setSaving(false)}
  }

  async function toggle(floor){
    if(!canManage)return
    const next=!floor.active
    if(!next&&roomCount(floor.id)>0)return onError?.(`No se puede desactivar ${floor.name}: tiene ${roomCount(floor.id)} habitación${roomCount(floor.id)===1?"":"es"} asignada${roomCount(floor.id)===1?"":"s"}. Reasignalas primero.`)
    setSaving(true);onError?.("")
    try{const{error}=await supabase.from("hotel_floors").update({active:next}).eq("id",floor.id).eq("property_id",propertyId);if(error)throw error;await onChanged?.();onNotice?.(next?"Piso activado.":"Piso desactivado.")}catch(err){onError?.(err?.message||"No se pudo actualizar el piso.")}finally{setSaving(false)}
  }

  async function remove(){
    if(!editor?.id||!canManage)return
    const used=roomCount(editor.id)
    if(used)return onError?.(`No se puede eliminar ${editor.name}: tiene ${used} habitación${used===1?"":"es"} asignada${used===1?"":"s"}. Reasignalas primero.`)
    if(!window.confirm(`¿Eliminar el piso ${editor.name}?`))return
    setSaving(true);onError?.("")
    try{const{error}=await supabase.from("hotel_floors").delete().eq("id",editor.id).eq("property_id",propertyId);if(error)throw error;setEditor(null);await onChanged?.();onNotice?.("Piso eliminado.")}catch(err){onError?.(err?.message||"No se pudo eliminar el piso.")}finally{setSaving(false)}
  }

  return <>
    {!visible.length?<div className={s.empty}>{ordered.length?"No hay pisos que coincidan con la búsqueda.":"Todavía no hay pisos configurados. Creá el primero para ordenar las habitaciones."}</div>:<div className={s.list}>{visible.map(floor=>{const count=roomCount(floor.id);return <article key={floor.id} className={s.rowType} style={{gridTemplateColumns:"16px minmax(220px,1fr) 120px 120px 90px 34px"}} onClick={()=>setEditor({...floor})}><span className={s.drag}>⋮⋮</span><div className={s.identity}><b>{floor.name}</b><small>{count} habitación{count===1?"":"es"} asignada{count===1?"":"s"}</small></div><span className={s.code}>Orden {floor.sort_order??0}</span><div className={s.statusStack}><span data-state={floor.active!==false?"ok":"off"}>{floor.active!==false?"Activo":"Inactivo"}</span><small>Planning y habitaciones</small></div><div className={s.switchBlock} onClick={e=>e.stopPropagation()}><span>Activo</span><RoomSwitch checked={floor.active!==false} disabled={!canManage||saving} onChange={()=>toggle(floor)}/></div><button className={s.more} aria-label={`Editar ${floor.name}`} onClick={e=>{e.stopPropagation();setEditor({...floor})}}>⋯</button></article>})}</div>}
    {editor?<div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&setEditor(null)}><aside className={s.drawer} onMouseDown={e=>e.stopPropagation()}><header className={s.drawerHead}><div><small>PISO</small><h2>{editor.id?`Editar ${editor.name}`:"Nuevo piso"}</h2><p>El orden del piso se usa para ordenar las habitaciones dentro de cada categoría en el Planning.</p></div><button className={s.close} onClick={()=>setEditor(null)}>×</button></header><div className={s.drawerBody}><RoomSection title="Identidad y orden" subtitle="Definí cómo se llama y en qué posición aparece."><div className={s.formGrid}><RoomField label="Nombre del piso"><input value={editor.name||""} onChange={e=>patch({name:e.target.value})} placeholder="Ej. Piso 1" autoFocus/></RoomField><RoomField label="Orden"><input type="number" value={editor.sort_order??0} onChange={e=>patch({sort_order:e.target.value})}/></RoomField><RoomToggleCard title="Piso activo" text="Puede asignarse a habitaciones nuevas o existentes." checked={editor.active!==false} disabled={Boolean(editor.id&&roomCount(editor.id)>0&&editor.active!==false)} onChange={value=>patch({active:value})}/></div></RoomSection></div><footer className={s.drawerFooter}>{editor.id&&canManage?<button className={s.deleteButton} disabled={saving||roomCount(editor.id)>0} onClick={remove}>Eliminar</button>:<span/>}<div><button onClick={()=>setEditor(null)}>Cancelar</button><button className={s.primary} disabled={!canManage||saving||!editor.name?.trim()} onClick={save}>{saving?"Guardando…":"Guardar cambios"}</button></div></footer></aside></div>:null}
  </>
}
