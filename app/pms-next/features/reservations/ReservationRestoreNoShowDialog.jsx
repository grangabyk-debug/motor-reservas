"use client"

import{useEffect,useState}from"react"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)

export default function ReservationRestoreNoShowDialog({item,onClose,onConfirm,saving,error}){
  const[action,setAction]=useState("remove"),[note,setNote]=useState("")
  const penalty=Math.max(0,Number(item?.no_show_penalty_amount)||0)
  const hasPenalty=penalty>0||String(item?.no_show_penalty_status||"").toLowerCase()==="charged"

  useEffect(()=>{if(!item)return;setAction(hasPenalty?"remove":"keep");setNote("")},[item?.id,hasPenalty])
  useEffect(()=>{if(!item||typeof document==="undefined")return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous}},[item?.id])
  if(!item)return null

  const overlay={position:"fixed",inset:0,zIndex:280,display:"grid",placeItems:"center",padding:12,background:"rgba(15,22,36,.45)",backdropFilter:"blur(12px) saturate(1.08)"}
  const panel={width:"min(620px,calc(100vw - 24px))",maxHeight:"calc(100vh - 24px)",display:"flex",flexDirection:"column",border:"1px solid color-mix(in srgb,var(--line) 82%,#fff)",borderRadius:22,background:"color-mix(in srgb,var(--panelSolid) 97%,transparent)",boxShadow:"0 28px 80px rgba(17,28,52,.32)",overflow:"hidden"}
  const button={height:40,padding:"0 14px",border:"1px solid var(--line)",borderRadius:11,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:850,cursor:saving?"wait":"pointer"}
  const choice=selected=>({display:"grid",gridTemplateColumns:"28px 1fr",gap:10,alignItems:"start",width:"100%",padding:13,border:`1px solid ${selected?"var(--accent)":"var(--line)"}`,borderRadius:13,background:selected?"color-mix(in srgb,var(--accent) 7%,var(--panelSolid))":"var(--panelSolid)",color:"var(--text)",textAlign:"left",font:"inherit",cursor:saving?"wait":"pointer"})

  return <div style={overlay} role="dialog" aria-modal="true" aria-label="Reabrir reserva No Show"><section style={panel}>
    <header style={{display:"flex",justifyContent:"space-between",gap:16,padding:"18px 20px 14px",borderBottom:"1px solid var(--line)"}}><div><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".12em",color:"#30343b",marginBottom:5}}>REABRIR NO SHOW</small><h2 style={{margin:0,fontSize:20}}>El huésped finalmente llegó</h2><p style={{margin:"6px 0 0",fontSize:11,color:"var(--muted)"}}>{item.nombre_huesped} · Reserva {item.numero_reserva||item.id}</p></div><button type="button" onClick={onClose} disabled={saving} style={{...button,width:38,padding:0}} aria-label="Cerrar">×</button></header>
    <div style={{padding:"18px 20px",overflowY:"auto"}}>
      <div style={{padding:"12px 13px",border:"1px solid color-mix(in srgb,#28a66a 34%,var(--line))",borderRadius:12,background:"color-mix(in srgb,#28a66a 7%,var(--panelSolid))",fontSize:10.8,lineHeight:1.55}}><b>La reserva volverá a estar activa y a ocupar disponibilidad.</b><span style={{display:"block",marginTop:3,color:"var(--muted)"}}>La tarifa y las noches de la estadía continúan normalmente. Antes de reabrir, definí qué hacer con la penalidad de No Show.</span></div>

      {hasPenalty?<div style={{marginTop:13}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"baseline",marginBottom:8}}><b style={{fontSize:12}}>Penalidad registrada</b><strong style={{fontSize:15}}>{money(penalty,item.moneda||"ARS")}</strong></div><div style={{display:"grid",gap:8}}>
        <button type="button" disabled={saving} onClick={()=>setAction("remove")} style={choice(action==="remove")}><span style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${action==="remove"?"var(--accent)":"var(--line)"}`,display:"grid",placeItems:"center",marginTop:1}}>{action==="remove"?<span style={{width:8,height:8,borderRadius:"50%",background:"var(--accent)"}}/>:null}</span><span><b style={{display:"block",fontSize:11.5}}>Quitar penalidad</b><small style={{display:"block",marginTop:3,color:"var(--muted)",lineHeight:1.45}}>Anula el cargo de No Show del folio y recalcula el total. Si ya se cobraron esos {money(penalty,item.moneda||"ARS")}, el pago no se borra ni se devuelve automáticamente: queda a cuenta de la estadía.</small></span></button>
        <button type="button" disabled={saving} onClick={()=>setAction("keep")} style={choice(action==="keep")}><span style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${action==="keep"?"var(--accent)":"var(--line)"}`,display:"grid",placeItems:"center",marginTop:1}}>{action==="keep"?<span style={{width:8,height:8,borderRadius:"50%",background:"var(--accent)"}}/>:null}</span><span><b style={{display:"block",fontSize:11.5}}>Mantener penalidad</b><small style={{display:"block",marginTop:3,color:"var(--muted)",lineHeight:1.45}}>La reserva se reactiva, pero el cargo de No Show sigue en el folio. Usalo sólo si corresponde por política del hotel o por una decisión comercial.</small></span></button>
      </div></div>:<div style={{marginTop:13,padding:"11px 12px",border:"1px solid var(--line)",borderRadius:12,fontSize:10.5,color:"var(--muted)"}}>Esta reserva no tiene una penalidad de No Show cobrada. Se reabrirá sin agregar ni quitar cargos.</div>}

      <label style={{display:"grid",gap:5,marginTop:13,fontSize:10,color:"var(--muted)"}}>Observación interna<textarea rows="3" value={note} onChange={event=>setNote(event.target.value)} placeholder={action==="remove"?"Ej.: huésped llegó 00:35; se anula penalidad.":"Ej.: se mantiene cargo según política informada al huésped."} style={{resize:"vertical",border:"1px solid var(--line)",borderRadius:10,padding:"9px 10px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11}}/></label>
      {error?<div style={{marginTop:11,padding:"10px 11px",border:"1px solid color-mix(in srgb,#e45c70 40%,var(--line))",borderRadius:10,color:"#d84960",fontSize:10.5}}>{error}</div>:null}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,flexWrap:"wrap",marginTop:18,paddingTop:14,borderTop:"1px solid var(--line)"}}><button type="button" onClick={onClose} disabled={saving} style={button}>Cancelar</button><button type="button" disabled={saving} onClick={()=>onConfirm?.({penaltyAction:hasPenalty?action:"keep",note:note.trim()})} style={{...button,borderColor:"#24272d",background:"#24272d",color:"#fff"}}>{saving?"Reabriendo…":action==="remove"&&hasPenalty?"Reabrir y quitar penalidad":"Reabrir reserva"}</button></div>
    </div>
  </section></div>
}
