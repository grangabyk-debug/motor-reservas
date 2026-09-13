"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import HousekeepingRoomGridCore from"./HousekeepingRoomGridCore"

const STATUS={sucia:"Sucia",limpia:"Limpia",inspeccionada:"Inspeccionada",libre:"Inspeccionada"}
const shell={display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8,flexWrap:"wrap",padding:"9px 10px",border:"1px solid color-mix(in srgb,#d75555 18%,var(--line))",borderRadius:13,background:"color-mix(in srgb,#d75555 3%,var(--panelSolid))"}
const selectStyle={height:36,minWidth:190,border:"1px solid var(--line)",borderRadius:10,padding:"0 10px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:12}
const buttonStyle={height:36,border:"1px solid color-mix(in srgb,#d75555 36%,var(--line))",borderRadius:10,padding:"0 12px",background:"color-mix(in srgb,#d75555 7%,var(--panelSolid))",color:"#b83d3d",font:"inherit",fontSize:12,fontWeight:850,cursor:"pointer"}

function notify(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}

export default function HousekeepingRoomGrid(props){
  const{visible=[],focusedRoomId}=props,[roomId,setRoomId]=useState(""),[saving,setSaving]=useState(false)
  const candidates=useMemo(()=>visible.filter(room=>!["sucia","mantenimiento","fuera_servicio"].includes(room.estado)),[visible])
  useEffect(()=>{const focused=candidates.find(room=>Number(room.id)===Number(focusedRoomId));if(focused)setRoomId(String(focused.id));else if(roomId&&!candidates.some(room=>String(room.id)===String(roomId)))setRoomId("")},[focusedRoomId,candidates,roomId])

  async function markDirty(){
    const room=candidates.find(item=>String(item.id)===String(roomId));if(!room||saving)return
    setSaving(true)
    try{
      const{data:stored,error:readError}=await supabase.from("habitaciones").select("property_id,estado").eq("id",room.id).single();if(readError)throw readError
      const before=stored?.estado||room.estado,{error:updateError}=await supabase.from("habitaciones").update({estado:"sucia"}).eq("id",room.id).eq("property_id",stored.property_id);if(updateError)throw updateError
      const{data:userData}=await supabase.auth.getUser();const{error:historyError}=await supabase.from("hotel_housekeeping_history").insert({property_id:stored.property_id,room_id:room.id,reservation_id:room.reservation?.id||null,task_id:room.task?.id||null,from_status:before,to_status:"sucia",source:"housekeeping",note:"Cambio manual a Sucia",metadata:{surface:"housekeeping",manual:true},actor_id:userData?.user?.id||null})
      if(historyError)notify({tone:"warning",title:`Habitación ${room.nombre} marcada como sucia`,message:"El estado se actualizó, pero no pudimos registrar el historial del cambio."})
      else notify({tone:"success",title:`Habitación ${room.nombre} marcada como sucia`,message:"El cambio manual quedó registrado en Housekeeping."})
      if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-room-status-updated",{detail:{propertyId:stored.property_id,roomIds:[Number(room.id)],status:"sucia"}}))
      setRoomId("")
    }catch(err){notify({tone:"error",title:"No se pudo cambiar el estado",message:err?.message||"Intentá nuevamente desde Housekeeping."})}
    finally{setSaving(false)}
  }

  return <><div style={shell}><strong style={{fontSize:12,marginRight:2}}>Cambio manual</strong><select aria-label="Habitación para marcar sucia" style={selectStyle} value={roomId} onChange={event=>setRoomId(event.target.value)}><option value="">Elegir habitación…</option>{candidates.map(room=><option key={room.id} value={room.id}>Hab. {room.nombre} · {STATUS[room.estado]||room.estado}</option>)}</select><button type="button" style={{...buttonStyle,opacity:!roomId||saving?.55:1,cursor:!roomId||saving?"not-allowed":"pointer"}} disabled={!roomId||saving} onClick={markDirty}>{saving?"Guardando…":"Marcar sucia"}</button><span style={{fontSize:10,color:"var(--muted)"}}>El check-out sigue marcando sucia automáticamente.</span></div><HousekeepingRoomGridCore {...props}/></>
}
