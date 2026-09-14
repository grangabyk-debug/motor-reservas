"use client"

import{useEffect,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{ROOM_PALETTE,roomMoney}from"./roomAdminShared"
import{RoomField,RoomSection,RoomToggleCard}from"./RoomAdminControls"
import s from"./propertyRooms.module.css"

const median=values=>{const sorted=(values||[]).map(Number).filter(value=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);if(!sorted.length)return 0;const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2}
const todayKey=()=>{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),get=type=>parts.find(part=>part.type===type)?.value||"";return`${get("year")}-${get("month")}-${get("day")}`}

export default function RoomAdminRoomDrawer({form,setForm,types,floors,access,canManage,saving,currency,onClose,onSave,onDelete}){
  const patch=values=>setForm(current=>({...current,...values})),selectedType=types.find(type=>type.id===form.room_type_id)
  const[priceSuggestion,setPriceSuggestion]=useState(null),priceTouched=useRef(false)

  useEffect(()=>{
    if(form.id||!form.room_type_id){setPriceSuggestion(null);return}
    let cancelled=false
    const typeId=form.room_type_id,type=types.find(item=>String(item.id)===String(typeId))
    priceTouched.current=false
    setPriceSuggestion({loading:true,value:0,source:""})
    ;(async()=>{
      const roomRes=await supabase.from("habitaciones").select("id,precio").eq("room_type_id",typeId).eq("activa",true).limit(80)
      if(roomRes.error)throw roomRes.error
      const siblings=roomRes.data||[],ids=siblings.map(room=>Number(room.id)).filter(Number.isFinite)
      let values=[],source=""
      if(ids.length){
        const rateRes=await supabase.from("hotel_rate_calendar").select("price").in("habitacion_id",ids).eq("stay_date",todayKey())
        if(!rateRes.error){values=(rateRes.data||[]).map(row=>Number(row.price)).filter(value=>Number.isFinite(value)&&value>0);if(values.length)source="tarifa vigente de otras habitaciones del mismo tipo"}
      }
      if(!values.length){values=siblings.map(room=>Number(room.precio)).filter(value=>Number.isFinite(value)&&value>0);if(values.length)source="precio base de otras habitaciones del mismo tipo"}
      if(!values.length&&Number(type?.base_price)>0){values=[Number(type.base_price)];source="precio base del tipo de habitación"}
      const value=Math.round(median(values)*100)/100
      if(cancelled)return
      setPriceSuggestion(value>0?{loading:false,value,source}:{loading:false,value:0,source:""})
      if(value>0&&!priceTouched.current)setForm(current=>current&&!current.id&&String(current.room_type_id)===String(typeId)?{...current,precio:value}:current)
    })().catch(()=>{if(!cancelled)setPriceSuggestion({loading:false,value:0,source:""})})
    return()=>{cancelled=true}
  },[form.id,form.room_type_id,setForm,types])

  function chooseType(id){const type=types.find(item=>item.id===id);priceTouched.current=false;patch({room_type_id:id,capacidad:type?.capacity||form.capacidad})}
  return <div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&onClose()}><aside className={s.drawer} onMouseDown={e=>e.stopPropagation()}><header className={s.drawerHead}><div><small>HABITACIÓN</small><h2>{form.id?`Editar ${form.nombre}`:"Nueva habitación"}</h2><p>{form.id?"Los cambios impactan en Planning y disponibilidad al guardar.":"Se crea conectada al inventario real del hotel."}</p></div><button className={s.close} onClick={onClose}>×</button></header><div className={s.drawerBody}>
    <RoomSection title="Identidad" subtitle="Cómo se identifica y agrupa dentro del hotel."><div className={s.formGrid}><RoomField label="Nombre / número"><input value={form.nombre||""} onChange={e=>patch({nombre:e.target.value})} autoFocus/></RoomField><RoomField label="Tipo de habitación"><select value={form.room_type_id||""} onChange={e=>chooseType(e.target.value)}><option value="">Sin tipo</option>{types.map(type=><option key={type.id} value={type.id}>{type.name}{!type.active?" · inactivo":""}</option>)}</select></RoomField><RoomField label="Piso"><select value={form.floor_id||""} onChange={e=>patch({floor_id:e.target.value})}><option value="">Sin piso</option>{floors.filter(f=>f.active!==false).map(floor=><option key={floor.id} value={floor.id}>{floor.name}</option>)}</select></RoomField><RoomField label="Zona housekeeping"><input value={form.housekeeping_zone||""} onChange={e=>patch({housekeeping_zone:e.target.value})} placeholder="Ej. Ala norte"/></RoomField><RoomField label="Orden"><input type="number" value={form.sort_order||0} onChange={e=>patch({sort_order:e.target.value})}/></RoomField><div className={s.colorField}><span>Color de habitación <em>opcional</em></span><div className={s.colors}><button type="button" className={!form.color?s.colorSelected:""} onClick={()=>patch({color:""})}>Auto</button>{ROOM_PALETTE.map(color=><button type="button" key={color} aria-label={color} className={form.color===color?s.colorSelected:""} style={{"--pick":color}} onClick={()=>patch({color})}/>)}</div><small>Sin color propio usa {selectedType?.name?`el color de ${selectedType.name}`:"el color neutro"}.</small></div></div></RoomSection>
    <RoomSection title="Capacidad y venta" subtitle="Operación y disponibilidad comercial."><div className={s.formGrid}><RoomField label="Capacidad"><input type="number" min="1" max="30" value={form.capacidad||1} onChange={e=>patch({capacidad:e.target.value})}/></RoomField><RoomField label={`Precio base sin IVA · ${currency}`}><input type="number" min="0" step="0.01" value={form.precio||0} onChange={e=>{priceTouched.current=true;patch({precio:e.target.value})}}/><small style={{display:"block",marginTop:5,lineHeight:1.35,color:"var(--muted)",fontSize:9.5,fontWeight:600}}>{!form.id&&priceSuggestion?.loading?"Buscando la tarifa vigente de este tipo…":!form.id&&priceSuggestion?.value>0?`Sugerido automáticamente desde la ${priceSuggestion.source}: ${roomMoney(priceSuggestion.value,currency)} base. Planning mostrará el precio final con IVA.`:"Planning mostrará el precio final con IVA cuando corresponda."}</small></RoomField><RoomField label="Configuración camas"><input value={form.bed_configuration||""} onChange={e=>patch({bed_configuration:e.target.value})} placeholder="Ej. 3 twins o 1 matrimonial + 1 individual"/><small style={{display:"block",marginTop:5,lineHeight:1.35,color:"var(--muted)",fontSize:9.5,fontWeight:600}}>Esta configuración se usa como propuesta inicial al crear una reserva.</small></RoomField><RoomToggleCard title="Habitación activa" text="Aparece en Planning y puede usarse operativamente." checked={form.activa!==false} onChange={value=>patch({activa:value,online_bookable:value?form.online_bookable:false})}/><RoomToggleCard title="Venta online" text="Puede ofrecerse en el Motor cuando está disponible." checked={Boolean(form.activa&&form.online_bookable)} disabled={!form.activa} onChange={value=>patch({online_bookable:value})}/></div></RoomSection>
    <RoomSection title="Operación" subtitle="Notas internas para el equipo."><RoomField label="Notas internas"><textarea rows="4" value={form.descripcion||""} onChange={e=>patch({descripcion:e.target.value})} placeholder="Características u observaciones de esta habitación."/></RoomField></RoomSection>
    <RoomSection title="Acceso inteligente" subtitle="Los PIN de huéspedes no se guardan como un código fijo."><div className={s.accessCard}><span data-connected={access?.connection_status==="connected"}>{access?.connection_status==="connected"?"✓":"⌁"}</span><div><b>{access?.connection_status==="connected"?access.name||"Acceso conectado":"Sin cerradura conectada"}</b><small>{access?.connection_status==="connected"?`${access.provider||"Proveedor"} · PIN ${access.pin_enabled?"habilitado":"deshabilitado"} · apertura remota ${access.remote_open_enabled?"sí":"no"}`:"Cuando se conecte una cerradura, Habitación Llena podrá generar un PIN diferente para cada estadía."}</small></div></div></RoomSection>
  </div><footer className={s.drawerFooter}>{onDelete&&canManage?<button className={s.deleteButton} onClick={onDelete}>Eliminar</button>:<span/>}<div><button onClick={onClose}>Cancelar</button><button className={s.primary} disabled={!canManage||saving||!form.nombre?.trim()} onClick={onSave}>{saving?"Guardando…":"Guardar cambios"}</button></div></footer></aside></div>
}
