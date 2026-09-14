"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const DAY=86400000
const BLOCK_REASONS=["Mantenimiento","Uso interno","Fuera de servicio","Cortesía","Bloqueo de grupo","Otro"]
const pad=value=>String(value).padStart(2,"0")
const fromKey=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12)}
const keyFromDate=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const addDays=(value,amount)=>keyFromDate(new Date(fromKey(value).getTime()+amount*DAY))
const diffDays=(a,b)=>Math.round((fromKey(b)-fromKey(a))/DAY)
const selectionDate=value=>new Intl.DateTimeFormat("es-AR",{weekday:"short",day:"2-digit",month:"short"}).format(fromKey(value)).replaceAll(".","")
const dateTime=value=>value?new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)):"—"
function toast(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}

export function usePlanningBlocks({propertyId,days,availabilityReservations,rangeSelection,onCancelRange}){
  const[blocks,setBlocks]=useState([]),[dialog,setDialog]=useState(null)
  const windowStart=days[0],windowEnd=days.length?addDays(days.at(-1),1):null
  const loadBlocks=useCallback(async()=>{
    if(!propertyId||!windowStart||!windowEnd){setBlocks([]);return}
    const{data,error}=await supabase.from("bloqueos").select("id,block_group,user_id,habitacion_id,fecha_desde,fecha_hasta,motivo,detalle,created_at").eq("property_id",propertyId).lt("fecha_desde",windowEnd).gt("fecha_hasta",windowStart).order("fecha_desde")
    if(error){toast({tone:"error",title:"No pudimos cargar los bloqueos",message:error.message});return}
    const rows=data||[],ids=[...new Set(rows.map(item=>item.user_id).filter(Boolean))]
    let profiles=[]
    if(ids.length){const result=await supabase.from("profiles").select("id,full_name").in("id",ids);profiles=result.data||[]}
    const names=new Map(profiles.map(item=>[item.id,item.full_name]))
    setBlocks(rows.map(item=>({...item,creator_name:names.get(item.user_id)||""})))
  },[propertyId,windowStart,windowEnd])
  useEffect(()=>{loadBlocks()},[loadBlocks])
  useEffect(()=>{if(!propertyId)return;const channel=supabase.channel(`planning-blocks-${propertyId}`).on("postgres_changes",{event:"*",schema:"public",table:"bloqueos",filter:`property_id=eq.${propertyId}`},loadBlocks).subscribe();return()=>{supabase.removeChannel(channel)}},[propertyId,loadBlocks])
  const blockAvailability=useMemo(()=>blocks.map(item=>({habitacion_id:item.habitacion_id,habitaciones_ids:[item.habitacion_id],fecha_entrada:item.fecha_desde,fecha_salida:item.fecha_hasta,is_room_block:true})),[blocks])
  const availabilityItems=useMemo(()=>[...availabilityReservations,...blockAvailability],[availabilityReservations,blockAvailability])
  async function createBlock({reason,detail}){
    if(!rangeSelection||!propertyId)throw new Error("No hay un rango seleccionado.")
    const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)throw userError||new Error("La sesión venció.")
    const roomIds=[...new Set((rangeSelection.roomIds||[]).map(Number).filter(Number.isFinite))];if(!roomIds.length)throw new Error("Elegí al menos una habitación.")
    const group=crypto.randomUUID(),payload=roomIds.map(habitacion_id=>({user_id:user.id,property_id:propertyId,habitacion_id,fecha_desde:rangeSelection.start,fecha_hasta:rangeSelection.end,motivo:reason,detalle:detail?.trim()||null,block_group:group}))
    const{error}=await supabase.from("bloqueos").insert(payload);if(error)throw error
    setDialog(null);onCancelRange?.();await loadBlocks();toast({title:roomIds.length>1?"Bloqueo grupal creado":"Habitación bloqueada",message:`${roomIds.length} habitación${roomIds.length===1?"":"es"} fuera de inventario · ${rangeSelection.start} → ${rangeSelection.end}.`})
  }
  async function releaseBlock(block){
    if(!propertyId)throw new Error("Falta la propiedad.")
    let request=supabase.from("bloqueos").delete().eq("property_id",propertyId);request=block.block_group?request.eq("block_group",block.block_group):request.eq("id",block.id)
    const{error}=await request;if(error)throw error
    setDialog(null);await loadBlocks();toast({title:"Bloqueo liberado",message:"La habitación volvió al inventario y se encoló la actualización para los canales conectados."})
  }
  return{blocks,availabilityItems,dialog,setDialog,createBlock,releaseBlock}
}

function blockGeometry(days,block){if(!days.length)return null;const left=Math.max(0,diffDays(days[0],block.fecha_desde)+.5),right=Math.min(days.length,diffDays(days[0],block.fecha_hasta)+.5);if(right<=left)return null;return{left,width:right-left}}
export function PlanningRoomBlock({block,days,onSelect}){
  const geometry=blockGeometry(days,block);if(!geometry)return null
  return <button type="button" onClick={event=>{event.preventDefault();event.stopPropagation();onSelect(block)}} title={`${block.motivo||"Bloqueo"}${block.detalle?` · ${block.detalle}`:""}`} style={{position:"absolute",top:8,zIndex:5,height:30,left:`calc(${geometry.left} * var(--day-width) + 2px)`,width:`calc(${geometry.width} * var(--day-width) - 4px)`,border:"1px solid #ad7a27",borderRadius:7,background:"repeating-linear-gradient(135deg,#f8edcf 0 6px,#eed8a8 6px 12px)",color:"#745016",display:"flex",alignItems:"center",gap:5,padding:"0 8px",overflow:"hidden",boxShadow:"0 2px 7px rgba(65,47,19,.12)",cursor:"pointer",font:"inherit",textAlign:"left"}}><span style={{fontSize:10,fontWeight:950}}>▧</span><b style={{fontSize:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{block.motivo||"Bloqueo"}</b></button>
}

export function PlanningBlockDialog({dialog,rooms,blocks,onClose,onCreate,onRelease}){
  const[reason,setReason]=useState(dialog?.block?.motivo||BLOCK_REASONS[0]),[detail,setDetail]=useState(dialog?.block?.detalle||""),[saving,setSaving]=useState(false),[error,setError]=useState("")
  if(!dialog)return null
  const ids=new Set((dialog.range?.roomIds||[]).map(String)),groupBlocks=dialog.mode==="detail"?blocks.filter(item=>String(item.block_group)===String(dialog.block?.block_group||"")):[],selectedRooms=dialog.mode==="create"?rooms.filter(room=>ids.has(String(room.id))):groupBlocks.map(item=>rooms.find(room=>Number(room.id)===Number(item.habitacion_id))).filter(Boolean),start=dialog.mode==="create"?dialog.range.start:dialog.block.fecha_desde,end=dialog.mode==="create"?dialog.range.end:dialog.block.fecha_hasta
  async function submit(){setSaving(true);setError("");try{if(dialog.mode==="create")await onCreate({reason,detail});else await onRelease(dialog.block)}catch(err){setError(err?.message||"No se pudo completar la acción.")}finally{setSaving(false)}}
  const backdrop={position:"fixed",inset:0,zIndex:260,background:"rgba(13,22,39,.42)",backdropFilter:"blur(5px)",display:"grid",placeItems:"center",padding:16},box={width:"min(520px,calc(100vw - 24px))",maxHeight:"calc(100dvh - 32px)",overflow:"auto",border:"1px solid var(--line)",borderRadius:16,background:"var(--panelSolid)",color:"var(--text)",boxShadow:"0 28px 80px rgba(15,27,48,.32)",padding:18},field={width:"100%",boxSizing:"border-box",height:40,border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",padding:"0 10px"}
  return <div style={backdrop} onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section style={box} role="dialog" aria-modal="true"><header style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><div><small style={{fontWeight:900,color:"#a96f16",letterSpacing:1}}>BLOQUEO OPERATIVO</small><h2 style={{margin:"4px 0 0",fontSize:20}}>{dialog.mode==="create"?"Bloquear habitación":"Detalle del bloqueo"}</h2></div><button type="button" onClick={onClose} style={{width:32,height:32,border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--text)",fontSize:20,cursor:"pointer"}}>×</button></header><div style={{marginTop:14,padding:12,borderRadius:11,background:"color-mix(in srgb,#d89a32 8%,var(--bg))",display:"grid",gap:4,fontSize:12}}><b>{selectionDate(start)} → {selectionDate(end)}</b><span style={{color:"var(--muted)"}}>{selectedRooms.length} habitación{selectedRooms.length===1?"":"es"}: {selectedRooms.map(room=>room.nombre).join(", ")||"—"}</span></div>{dialog.mode==="create"?<div style={{display:"grid",gap:12,marginTop:14}}><label style={{display:"grid",gap:6,fontSize:11,fontWeight:850}}>Motivo<select style={field} value={reason} onChange={event=>setReason(event.target.value)}>{BLOCK_REASONS.map(item=><option key={item}>{item}</option>)}</select></label><label style={{display:"grid",gap:6,fontSize:11,fontWeight:850}}>Detalle opcional<textarea value={detail} onChange={event=>setDetail(event.target.value)} placeholder="Ej. Cambio de aire acondicionado, habitación reservada para staff…" style={{...field,height:88,padding:10,resize:"vertical"}}/></label><p style={{margin:0,fontSize:11,lineHeight:1.5,color:"var(--muted)"}}>El bloqueo deja de vender estas unidades en el Motor web y genera una actualización de inventario para los canales conectados.</p></div>:<div style={{display:"grid",gap:9,marginTop:14,fontSize:12}}><div><small style={{display:"block",color:"var(--muted)"}}>Motivo</small><b>{dialog.block.motivo||"Bloqueo"}</b></div>{dialog.block.detalle?<div><small style={{display:"block",color:"var(--muted)"}}>Detalle</small><span>{dialog.block.detalle}</span></div>:null}<div><small style={{display:"block",color:"var(--muted)"}}>Creado</small><span>{dateTime(dialog.block.created_at)}{dialog.block.creator_name?` · ${dialog.block.creator_name}`:""}</span></div>{groupBlocks.length>1?<div><small style={{display:"block",color:"var(--muted)"}}>Bloqueo grupal</small><span>{groupBlocks.length} habitaciones vinculadas. Al liberar, se liberan todas juntas.</span></div>:null}</div>}{error?<div style={{marginTop:12,padding:10,borderRadius:9,background:"color-mix(in srgb,var(--red) 9%,var(--panelSolid))",color:"var(--red)",fontSize:11}}>{error}</div>:null}<footer style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><button type="button" onClick={onClose} style={{height:38,border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",padding:"0 13px",fontWeight:850,cursor:"pointer"}}>Cerrar</button><button type="button" disabled={saving} onClick={submit} style={{height:38,border:0,borderRadius:9,background:dialog.mode==="create"?"#a96f16":"var(--red)",color:"#fff",padding:"0 14px",fontWeight:900,cursor:saving?"wait":"pointer"}}>{saving?"Guardando…":dialog.mode==="create"?"Crear bloqueo":"Liberar bloqueo"}</button></footer></section></div>
}
