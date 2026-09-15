"use client"

import{useEffect,useMemo,useState}from"react"
import{createPortal}from"react-dom"
import{supabase}from"../../../../lib/supabase"
import s from"./planning.module.css"

const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase()
const isMaintenance=block=>normalize(block?.motivo)==="mantenimiento"
const idsOf=draft=>[...new Set((draft?.roomIds?.length?draft.roomIds:[draft?.roomId]).filter(Boolean).map(String))]
const ackKey=blocks=>blocks.map(block=>`${block.id}:${block.habitacion_id}:${block.fecha_desde}`).sort().join("|")
const dateLabel=value=>value?new Intl.DateTimeFormat("es-AR",{weekday:"long",day:"numeric",month:"long"}).format(new Date(`${value}T12:00:00`)).replace(".",""):"ese día"

export default function useMaintenanceCheckoutGuard({propertyId,draft,setDraft,drawerStep,roomById}){
  const[blocks,setBlocks]=useState([]),[loadedKey,setLoadedKey]=useState(""),[target,setTarget]=useState(null),[prompt,setPrompt]=useState(false)
  const roomIds=useMemo(()=>idsOf(draft),[draft?.roomId,draft?.roomIds]),roomKey=roomIds.join(","),queryKey=propertyId&&draft?.end&&roomKey?`${propertyId}:${draft.end}:${roomKey}`:""
  useEffect(()=>{
    if(drawerStep!==3||typeof document==="undefined"){setTarget(null);return}
    const id=requestAnimationFrame(()=>setTarget(document.querySelector(`[aria-label="Crear reserva"] .${s.drawerBody}`)))
    return()=>cancelAnimationFrame(id)
  },[drawerStep])
  useEffect(()=>{
    if(drawerStep!==3||!queryKey){setBlocks([]);setLoadedKey(queryKey);setPrompt(false);return}
    let cancelled=false
    ;(async()=>{
      try{
        const{data,error}=await supabase.from("bloqueos").select("id,habitacion_id,fecha_desde,fecha_hasta,motivo,detalle").eq("property_id",propertyId).in("habitacion_id",roomIds.map(Number)).eq("fecha_desde",draft.end)
        if(error)throw error
        if(!cancelled){setBlocks((data||[]).filter(isMaintenance));setLoadedKey(queryKey);setPrompt(false)}
      }catch{if(!cancelled){setBlocks([]);setLoadedKey(queryKey);setPrompt(false)}}
    })()
    return()=>{cancelled=true}
  },[drawerStep,queryKey,propertyId,draft?.end,roomKey])
  const key=ackKey(blocks),confirmed=Boolean(key)&&draft?.maintenanceCheckoutAckKey===key,checking=drawerStep===3&&Boolean(queryKey)&&loadedKey!==queryKey
  const roomNames=[...new Set(blocks.map(block=>roomById?.get(Number(block.habitacion_id))?.nombre||String(block.habitacion_id)))]
  function setConfirmed(value){setPrompt(false);setDraft(current=>current?{...current,maintenanceCheckoutAckKey:value?key:""}:current)}
  function run(onSave){if(checking||key&&!confirmed){setPrompt(true);return false}onSave?.();return true}
  const panel=drawerStep===3&&target&&blocks.length?createPortal(<section role="status" aria-live="polite" style={{margin:"0 18px 14px",padding:"11px 12px",border:"1px solid color-mix(in srgb,#d99a24 42%,var(--line))",borderRadius:10,background:"color-mix(in srgb,#d99a24 8%,var(--panelSolid))"}}><small style={{display:"block",fontSize:9.5,fontWeight:900,letterSpacing:".06em",color:"#a96d0d"}}>MANTENIMIENTO EL DÍA DE SALIDA</small><b style={{display:"block",marginTop:3,fontSize:11.5}}>La {roomNames.length===1?`habitación ${roomNames[0]}`:`habitaciones ${roomNames.join(", ")}`} queda bloqueada por mantenimiento el {dateLabel(draft.end)}.</b><p style={{margin:"4px 0 8px",fontSize:10.5,lineHeight:1.45,color:"var(--muted)"}}>La salida del huésped es ese mismo día. Podés alojarlo si el mantenimiento comienza después del check-out.</p><label style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 9px",border:"1px solid color-mix(in srgb,#d99a24 30%,var(--line))",borderRadius:8,background:"color-mix(in srgb,var(--panelSolid) 92%,transparent)",fontSize:10.5,fontWeight:800,cursor:"pointer"}}><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} style={{marginTop:2}}/><span>Confirmo que el mantenimiento se hará después de la salida del huésped.</span></label>{prompt&&!confirmed?<small style={{display:"block",marginTop:7,color:"#a96d0d",fontWeight:900}}>Confirmá este punto para poder crear la reserva.</small>:null}</section>,target):null
  return{run,panel,checking,confirmed,hasMaintenance:Boolean(key)}
}
