"use client"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)

export default function PlanningRateChangeDialog({change,onKeep,onReprice,onCancel,saving=false}){
  if(!change)return null
  const{sourceRoom,targetRoom,currentRate,targetRate,currency="ARS"}=change
  const diff=targetRate-currentRate
  const direction=diff>0?"upgrade":diff<0?"downgrade":"cambio"
  const title=direction==="upgrade"?"Upgrade de categoría":direction==="downgrade"?"Downgrade de categoría":"Cambio de categoría"
  const detail=direction==="upgrade"?`La habitación destino tiene una tarifa ${money(Math.abs(diff),currency)} mayor por noche.`:direction==="downgrade"?`La habitación destino tiene una tarifa ${money(Math.abs(diff),currency)} menor por noche.`:"La habitación destino tiene la misma tarifa configurada."
  const overlay={position:"fixed",inset:0,zIndex:260,display:"grid",placeItems:"center",padding:18,background:"rgba(10,18,34,.28)",backdropFilter:"blur(5px)"}
  const shell={width:"min(460px,calc(100vw - 28px))",padding:18,border:"1px solid var(--line)",borderRadius:16,background:"color-mix(in srgb,var(--panelSolid) 98%,transparent)",color:"var(--text)",boxShadow:"0 28px 80px rgba(14,26,48,.34)"}
  const eyebrow={fontSize:10,fontWeight:900,letterSpacing:".09em",textTransform:"uppercase",color:direction==="upgrade"?"#3a9b62":direction==="downgrade"?"#c3832e":"var(--accent)"}
  const route={display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:10,alignItems:"center",marginTop:14,padding:12,borderRadius:12,background:"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))",border:"1px solid color-mix(in srgb,var(--accent) 12%,var(--line))"}
  const roomBox={minWidth:0}
  const roomName={display:"block",fontSize:13,fontWeight:900,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}
  const roomType={display:"block",marginTop:2,fontSize:10,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}
  const rates={display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}
  const rateCard={padding:"10px 11px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)"}
  const buttonBase={width:"100%",minHeight:44,borderRadius:10,font:"inherit",fontSize:12,fontWeight:850,cursor:saving?"wait":"pointer"}
  return <div style={overlay} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)onCancel?.()}}>
    <section style={shell} role="dialog" aria-modal="true" aria-labelledby="planning-rate-title">
      <div style={eyebrow}>{direction==="upgrade"?"↑ Upgrade":direction==="downgrade"?"↓ Downgrade":"Cambio de habitación"}</div>
      <h3 id="planning-rate-title" style={{margin:"4px 0 0",fontSize:18,lineHeight:1.2}}>{title}</h3>
      <p style={{margin:"7px 0 0",fontSize:12,lineHeight:1.5,color:"var(--muted)"}}>{detail} Elegí qué querés hacer con la tarifa antes de mover la reserva.</p>
      <div style={route}>
        <div style={roomBox}><span style={roomName}>Hab. {sourceRoom?.nombre||"—"}</span><span style={roomType}>{sourceRoom?.tipo||"Sin categoría"}</span></div>
        <b style={{fontSize:18,color:"var(--muted)"}}>→</b>
        <div style={{...roomBox,textAlign:"right"}}><span style={roomName}>Hab. {targetRoom?.nombre||"—"}</span><span style={roomType}>{targetRoom?.tipo||"Sin categoría"}</span></div>
      </div>
      <div style={rates}>
        <div style={rateCard}><small style={{display:"block",fontSize:10,color:"var(--muted)"}}>Tarifa actual</small><b style={{display:"block",marginTop:3,fontSize:15}}>{money(currentRate,currency)}</b><small style={{fontSize:10,color:"var(--muted)"}}>por noche</small></div>
        <div style={rateCard}><small style={{display:"block",fontSize:10,color:"var(--muted)"}}>Tarifa habitación destino</small><b style={{display:"block",marginTop:3,fontSize:15,color:"var(--accent)"}}>{money(targetRate,currency)}</b><small style={{fontSize:10,color:"var(--muted)"}}>por noche</small></div>
      </div>
      <div style={{display:"grid",gap:8,marginTop:14}}>
        <button type="button" disabled={saving} onClick={onReprice} style={{...buttonBase,border:"0",background:"linear-gradient(145deg,var(--accent),var(--accent2))",color:"#fff",boxShadow:"0 9px 22px color-mix(in srgb,var(--accent) 24%,transparent)"}}>{saving?"Guardando…":`Mover y actualizar a ${money(targetRate,currency)}`}</button>
        <button type="button" disabled={saving} onClick={onKeep} style={{...buttonBase,border:"1px solid var(--line)",background:"var(--panelSolid)",color:"var(--text)"}}>Mover y mantener {money(currentRate,currency)}</button>
        <button type="button" disabled={saving} onClick={onCancel} style={{...buttonBase,minHeight:36,border:"0",background:"transparent",color:"var(--muted)"}}>Cancelar movimiento</button>
      </div>
    </section>
  </div>
}
