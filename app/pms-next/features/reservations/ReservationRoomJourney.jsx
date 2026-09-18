"use client"

import{useMemo}from"react"

function roomJourney(item){
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
  const previous=details.filter(detail=>detail?.segment_role==="previous_room").sort((a,b)=>String(a?.fecha_entrada||"").localeCompare(String(b?.fecha_entrada||"")))
  const active=details.filter(detail=>detail?.segment_role==="active_room")
  const movement=active.flatMap(detail=>Array.isArray(detail?.movement_history)?detail.movement_history:[]).sort((a,b)=>String(a?.moved_at||a?.fecha_entrada||"").localeCompare(String(b?.moved_at||b?.fecha_entrada||"")))
  if((!previous.length&&!movement.length)||active.length!==1)return[]
  const steps=[...previous,...movement,...active]
  return steps.map((detail,index)=>({
    key:`journey-${detail?.habitacion_id||index}-${detail?.moved_at||detail?.fecha_entrada||index}`,
    name:detail?.nombre||detail?.habitacion_id||"—",
    category:detail?.categoria_asignada||detail?.categoria_vendida||"Habitación",
    transient:detail?.segment_role==="transient_room",
    current:index===steps.length-1
  }))
}

export default function ReservationRoomJourney({item}){
  const steps=useMemo(()=>roomJourney(item),[item?.id,JSON.stringify(item?.habitaciones_detalle||[])])
  if(steps.length<2)return null
  return <div style={{margin:"0 12px 10px",padding:"10px 11px",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:11,background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))"}}>
    <small style={{display:"block",marginBottom:7,fontSize:9.5,fontWeight:900,letterSpacing:".08em",color:"var(--accent)"}}>RECORRIDO DE HABITACIÓN</small>
    <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>{steps.map((step,index)=><span key={step.key} style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:10.5}}>{index?<b style={{color:"var(--muted)"}}>→</b>:null}<strong>{step.category} · Hab. {step.name}{step.current?" · actual":step.transient?" · paso intermedio":""}</strong></span>)}</div>
  </div>
}
