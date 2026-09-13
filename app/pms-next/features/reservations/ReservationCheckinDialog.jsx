"use client"

const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"—"
const statusLabel=value=>value==="alojado"?"En hotel":value==="finalizada"?"Finalizada":value==="cancelada"?"Cancelada":value==="tentativa"?"Tentativa":value==="pendiente"?"Pendiente":"Confirmada"

export default function ReservationCheckinDialog({item,onClose,onConfirm,onHousekeeping,saving,error}){
  if(!item)return null
  const assigned=item.rooms?.length?item.rooms:[item.room].filter(Boolean)
  const dirty=assigned.filter(room=>String(room.estado||"").toLowerCase()==="sucia")
  const blocked=assigned.filter(room=>room.activa===false||!["libre","limpia","inspeccionada","sucia"].includes(String(room.estado||"").toLowerCase()))
  const canConfirm=assigned.length>0&&!blocked.length
  const overlay={position:"fixed",inset:0,zIndex:270,display:"grid",placeItems:"center",padding:18,background:"rgba(19,28,46,.38)",backdropFilter:"blur(12px) saturate(1.08)"}
  const panel={width:"min(580px,calc(100vw - 28px))",border:"1px solid color-mix(in srgb,var(--line) 82%,#fff)",borderRadius:22,background:"color-mix(in srgb,var(--panelSolid) 97%,transparent)",boxShadow:"0 28px 80px rgba(17,28,52,.3)",overflow:"hidden"}
  const button={height:40,padding:"0 14px",border:"1px solid var(--line)",borderRadius:11,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:850,cursor:saving?"wait":"pointer"}
  const stateCard={flex:"1 1 150px",padding:"12px 13px",border:"1px solid var(--line)",borderRadius:12,background:"var(--panelSolid)"}

  return <div style={overlay} role="dialog" aria-modal="true" aria-label="Confirmar check-in">
    <section style={panel}>
      <header style={{display:"flex",justifyContent:"space-between",gap:16,padding:"18px 20px 14px",borderBottom:"1px solid var(--line)"}}><div><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".12em",color:"var(--accent)",marginBottom:5}}>CHECK-IN · CAMBIO DE ESTADO</small><h2 style={{margin:0,fontSize:20}}>¿Confirmar el check-in?</h2><p style={{margin:"6px 0 0",fontSize:11,color:"var(--muted)"}}>{item.nombre_huesped} · Reserva {item.numero_reserva||item.id}</p></div><button type="button" onClick={onClose} disabled={saving} style={{...button,width:38,padding:0}}>×</button></header>
      <div style={{padding:"18px 20px"}}>
        <p style={{margin:"0 0 14px",fontSize:12,lineHeight:1.55,color:"var(--text)"}}>Al confirmar, la reserva cambia de estado y pasa a figurar como huésped alojado en todo el PMS.</p>
        <div style={{display:"flex",alignItems:"stretch",gap:9,flexWrap:"wrap"}}><article style={stateCard}><small style={{fontSize:10,color:"var(--muted)"}}>ESTADO ACTUAL</small><b style={{display:"block",marginTop:5,fontSize:15}}>{statusLabel(item.estado)}</b></article><div aria-hidden="true" style={{display:"grid",placeItems:"center",fontSize:19,color:"var(--muted)",padding:"0 2px"}}>→</div><article style={{...stateCard,borderColor:"color-mix(in srgb,#28a66a 34%,var(--line))",background:"color-mix(in srgb,#28a66a 6%,var(--panelSolid))"}}><small style={{fontSize:10,color:"var(--muted)"}}>NUEVO ESTADO</small><b style={{display:"block",marginTop:5,fontSize:15,color:"#218b59"}}>En hotel</b></article></div>
        <div style={{marginTop:11,padding:"12px 13px",border:"1px solid var(--line)",borderRadius:12,background:"color-mix(in srgb,var(--bg) 45%,var(--panelSolid))",fontSize:11,lineHeight:1.55}}><b>{assigned.length?`Habitación${assigned.length>1?"es":""}: ${assigned.map(room=>room.nombre).join(", ")}`:"Sin habitación asignada"}</b><span style={{display:"block",marginTop:2,color:"var(--muted)"}}>Estadía: {fmtDate(item.fecha_entrada)} → {fmtDate(item.fecha_salida)}</span></div>
        {dirty.length?<div style={{marginTop:11,padding:"11px 12px",border:"1px solid color-mix(in srgb,#d9a528 40%,var(--line))",borderRadius:12,background:"color-mix(in srgb,#f0bd35 8%,var(--panelSolid))",fontSize:11,lineHeight:1.5,color:"#9a6a00"}}><b>Atención de Housekeeping</b><span style={{display:"block",marginTop:2}}>La{dirty.length>1?"s habitaciones":" habitación"} {dirty.map(room=>room.nombre).join(", ")} figura{dirty.length>1?"n":""} como sucia. El check-in se puede confirmar, pero queda esta advertencia operativa.</span></div>:null}
        {!assigned.length?<div style={{marginTop:11,padding:"11px 12px",border:"1px solid color-mix(in srgb,#e45c70 40%,var(--line))",borderRadius:12,background:"color-mix(in srgb,#ef6579 7%,var(--panelSolid))",fontSize:11,lineHeight:1.5,color:"#d84960"}}>Asigná una habitación antes de realizar el check-in.</div>:blocked.length?<div style={{marginTop:11,padding:"11px 12px",border:"1px solid color-mix(in srgb,#e45c70 40%,var(--line))",borderRadius:12,background:"color-mix(in srgb,#ef6579 7%,var(--panelSolid))",fontSize:11,lineHeight:1.5,color:"#d84960"}}><b>No se puede confirmar todavía.</b><span style={{display:"block",marginTop:2}}>Revisá {blocked.map(room=>`${room.nombre} (${room.estado||"sin estado"})`).join(", ")} antes del check-in.</span></div>:null}
        {error?<div style={{marginTop:11,padding:"11px 12px",border:"1px solid color-mix(in srgb,#e45c70 40%,var(--line))",borderRadius:12,background:"color-mix(in srgb,#ef6579 7%,var(--panelSolid))",fontSize:11,lineHeight:1.5,color:"#d84960"}}>{error}</div>:null}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,flexWrap:"wrap",marginTop:18,paddingTop:14,borderTop:"1px solid var(--line)"}}><button type="button" onClick={onClose} disabled={saving} style={button}>Cancelar</button>{(dirty.length||blocked.length)&&onHousekeeping?<button type="button" onClick={onHousekeeping} disabled={saving} style={button}>Ir a Housekeeping</button>:null}<button type="button" onClick={onConfirm} disabled={saving||!canConfirm} style={{...button,borderColor:"var(--accent)",background:"var(--accent)",color:"#fff",opacity:canConfirm?1:.5}}>{saving?"Haciendo check-in…":dirty.length?"Confirmar check-in igualmente":"Confirmar check-in"}</button></div>
      </div>
    </section>
  </div>
}
