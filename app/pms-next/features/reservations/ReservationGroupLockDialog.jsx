"use client"

import{useEffect,useState}from"react"
import{createPortal}from"react-dom"
import{supabase}from"../../../../lib/supabase"

export default function ReservationGroupLockDialog({open,current,activeRows=[],busy=false,onClose,onSaved,onError}){
  const[saving,setSaving]=useState(false)
  const[reason,setReason]=useState("")
  const[selected,setSelected]=useState(()=>new Set())

  useEffect(()=>{
    if(!open)return
    const locked=activeRows.filter(row=>row.locked).map(row=>row.id)
    setSelected(new Set(locked.length?locked:activeRows.map(row=>row.id)))
    setReason("")
  },[open,current?.id])

  if(!open||typeof document==="undefined")return null
  const target=document.querySelector("[data-theme]")||document.body
  const button={height:34,padding:"0 11px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:850,cursor:"pointer"}
  const overlay={position:"fixed",inset:0,zIndex:520,display:"grid",placeItems:"center",padding:16,background:"rgba(10,18,34,.38)",backdropFilter:"blur(10px) saturate(1.14)",WebkitBackdropFilter:"blur(10px) saturate(1.14)"}

  function toggle(id){setSelected(currentSet=>{const next=new Set(currentSet);next.has(id)?next.delete(id):next.add(id);return next})}

  async function save(){
    if(saving||busy)return
    setSaving(true);onError?.("")
    try{
      let latest=current,changed=0
      for(const row of activeRows){
        const shouldLock=selected.has(row.id)
        if(Boolean(row.locked)===shouldLock)continue
        const{data,error}=await supabase.rpc("hl_set_reservation_room_movement_lock",{p_reserva_id:Number(current.id),p_habitacion_id:Number(row.id),p_locked:shouldLock,p_reason:shouldLock?(reason.trim()||null):null})
        if(error)throw error
        latest=data||latest;changed+=1
      }
      onSaved?.(latest)
      onClose?.()
      if(typeof window!=="undefined"){
        const count=selected.size
        window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:count?"Bloqueo actualizado":"Grupo desbloqueado",message:count?`${count} de ${activeRows.length} habitación${activeRows.length===1?"":"es"} activa${activeRows.length===1?"":"s"} queda${count===1?"":"n"} fija${count===1?"":"s"}. Las demás siguen permitiendo movimientos.`:"Todas las habitaciones activas del grupo vuelven a permitir reasignaciones."}}))
        if(changed)window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(current.id)}}))
      }
    }catch(err){onError?.(err?.message||"No se pudo actualizar el bloqueo de las habitaciones.")}
    finally{setSaving(false)}
  }

  const dialog=<div style={overlay} onMouseDown={event=>event.target===event.currentTarget&&!saving&&onClose?.()}><section role="dialog" aria-modal="true" aria-label="Elegir habitaciones bloqueadas" style={{width:"min(520px,calc(100vw - 28px))",maxHeight:"min(720px,calc(100dvh - 32px))",display:"flex",flexDirection:"column",border:"1px solid color-mix(in srgb,#fff 34%,var(--line))",borderRadius:18,background:"var(--panelSolid)",boxShadow:"0 28px 80px rgba(15,27,50,.3)",overflow:"hidden"}}><header style={{padding:"15px 16px",borderBottom:"1px solid var(--line)"}}><small style={{fontSize:10,fontWeight:900,letterSpacing:".09em",color:"var(--accent)"}}>BLOQUEO DE HABITACIONES</small><h3 style={{margin:"4px 0 0",fontSize:17}}>Elegir habitaciones fijas</h3><p style={{margin:"5px 0 0",fontSize:10.5,color:"var(--muted)",lineHeight:1.45}}>Marcá sólo las habitaciones que no querés que puedan moverse desde la ficha ni desde el Planning. Podés bloquear una, varias o todas.</p></header><div style={{padding:16,overflow:"auto"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10}}><small style={{fontSize:10,color:"var(--muted)"}}>{selected.size} de {activeRows.length} seleccionada{selected.size===1?"":"s"}</small><div style={{display:"flex",gap:6}}><button type="button" disabled={saving} onClick={()=>setSelected(new Set(activeRows.map(row=>row.id)))} style={{...button,height:30}}>Todas</button><button type="button" disabled={saving} onClick={()=>setSelected(new Set())} style={{...button,height:30}}>Ninguna</button></div></div><div style={{display:"grid",gap:7}}>{activeRows.map(row=>{const checked=selected.has(row.id);return <label key={row.id} style={{display:"grid",gridTemplateColumns:"22px minmax(0,1fr) auto",alignItems:"center",gap:9,padding:"9px 10px",border:`1px solid ${checked?"color-mix(in srgb,var(--accent) 34%,var(--line))":"var(--line)"}`,borderRadius:10,background:checked?"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))":"var(--panelSolid)",cursor:saving?"not-allowed":"pointer"}}><input type="checkbox" checked={checked} disabled={saving} onChange={()=>toggle(row.id)} style={{accentColor:"var(--accent)"}}/><span><b style={{display:"block",fontSize:11}}>Hab. {row.room?.nombre||row.detail?.nombre||row.id}</b><small style={{display:"block",marginTop:2,fontSize:10,color:"var(--muted)"}}>{row.room?.tipo||row.detail?.categoria_asignada||"Habitación"}</small></span><small style={{fontSize:10,fontWeight:850,color:checked?"var(--accent)":"var(--muted)"}}>{checked?"Queda fija":"Movible"}</small></label>})}</div>{selected.size?<label style={{display:"grid",gap:6,marginTop:12,fontSize:10,fontWeight:850,color:"var(--muted)"}}>Motivo opcional<textarea value={reason} maxLength={240} onChange={event=>setReason(event.target.value)} placeholder="Ej.: grupo VIP, habitaciones contiguas, pedido expreso…" style={{width:"100%",minHeight:70,boxSizing:"border-box",resize:"vertical",border:"1px solid var(--line)",borderRadius:10,padding:"10px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit"}}/></label>:null}</div><footer style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"12px 16px",borderTop:"1px solid var(--line)",background:"color-mix(in srgb,var(--bg) 32%,var(--panelSolid))"}}><button type="button" disabled={saving} onClick={onClose} style={button}>Cancelar</button><button type="button" disabled={saving} onClick={save} style={{...button,color:"#fff",borderColor:"transparent",background:"linear-gradient(145deg,var(--accent),var(--accent2))",boxShadow:"0 7px 18px color-mix(in srgb,var(--accent) 18%,transparent)"}}>{saving?"Guardando…":selected.size?`Guardar bloqueo (${selected.size})`:"Desbloquear todas"}</button></footer></section></div>
  return createPortal(dialog,target)
}
