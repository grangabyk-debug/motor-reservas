"use client"

import{reservationCheckinProgress}from"./reservationEditUtils"

export default function ReservationCheckinProgressBanner({item,rooms=[],saving=false,onComplete}){
  const progress=reservationCheckinProgress(item||{})
  if(!progress.partial)return null
  const pendingNames=(rooms||[]).filter(room=>progress.pendingRoomIds.includes(Number(room.id))).map(room=>room.nombre)
  return <div style={{marginTop:12,padding:"11px 13px",border:"1px solid color-mix(in srgb,#2b9d61 28%,var(--line))",borderRadius:12,background:"color-mix(in srgb,#2b9d61 6%,var(--panelSolid))",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
    <span><b style={{display:"block",fontSize:10.8}}>Check-in parcial · {progress.checked} de {progress.total} habitaciones ingresaron</b><small style={{display:"block",marginTop:3,fontSize:9.5,color:"var(--muted)"}}>Pendiente{pendingNames.length===1?"":"s"}: {pendingNames.map(name=>`Hab. ${name}`).join(", ")||"—"}</small></span>
    <button type="button" onClick={onComplete} disabled={saving} style={{height:34,padding:"0 11px",border:"1px solid color-mix(in srgb,#2b9d61 35%,var(--line))",borderRadius:9,background:"color-mix(in srgb,#2b9d61 9%,var(--panelSolid))",color:"#207a4c",font:"inherit",fontSize:10,fontWeight:900,cursor:saving?"wait":"pointer"}}>Completar check-in</button>
  </div>
}
