"use client"

import{useEffect,useRef,useState}from"react"
import{reservationCheckinProgress}from"./reservationEditUtils"
import useOperationalDate from"../../core/useOperationalDate"

const fmtShort=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit"}).format(new Date(`${value}T12:00:00`)):""

export default function ReservationStayActions({item,saving=false,onPrimary,onNoShow,onCancel}){
  const[open,setOpen]=useState(false)
  const operationalDay=useOperationalDate(item?.property_id)
  const rootRef=useRef(null),progress=reservationCheckinProgress(item||{},operationalDay)
  const hasChecked=progress.checkedRoomIds.length>0,hasEligiblePending=progress.eligiblePendingRoomIds.length>0,hasFuturePending=progress.futurePendingRoomIds.length>0
  const waitingFuture=item?.estado==="alojado"&&hasChecked&&!hasEligiblePending&&hasFuturePending
  const needsCheckin=item?.estado!=="alojado"||!hasChecked||hasEligiblePending||hasFuturePending
  const isCheckout=item?.estado==="alojado"&&hasChecked&&!hasEligiblePending&&!hasFuturePending
  const isClosed=item?.estado==="finalizada"||item?.estado==="cancelada"
  const menuDisabled=saving||isClosed
  const primaryDisabled=saving||Boolean(item?.no_show)||isClosed||waitingFuture
  const roomNoShowAvailable=item?.estado==="alojado"&&hasChecked&&(progress.eligiblePendingRoomIds.length>0||progress.expiredPendingRoomIds.length>0)
  const noShowDisabled=saving||item?.estado==="finalizada"||item?.estado==="cancelada"||(item?.estado==="alojado"&&!roomNoShowAvailable)
  const canCancel=item?.estado!=="cancelada"&&!item?.no_show&&item?.estado!=="finalizada"
  const mainLabel=item?.no_show?"No Show":waitingFuture?`Próximo check-in · ${fmtShort(progress.nextPendingDate)}`:hasEligiblePending?`Completar check-in · ${progress.eligiblePending}`:isCheckout?"Check-out":"Check-in"
  const noShowLabel=item?.no_show?"Reabrir No Show":item?.estado==="alojado"&&roomNoShowAvailable?"No Show de habitación":"Marcar No Show"

  useEffect(()=>{setOpen(false)},[item?.id])
  useEffect(()=>{if(!open)return;const onPointer=event=>{if(!rootRef.current?.contains(event.target))setOpen(false)},onKey=event=>{if(event.key==="Escape")setOpen(false)};document.addEventListener("mousedown",onPointer);document.addEventListener("keydown",onKey);return()=>{document.removeEventListener("mousedown",onPointer);document.removeEventListener("keydown",onKey)}},[open])

  const mainStyle={height:36,minWidth:108,padding:"0 12px",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,border:"1px solid color-mix(in srgb,var(--accent) 34%,var(--line))",borderRadius:10,background:item?.no_show?"linear-gradient(145deg,#4d5665,#303640)":waitingFuture?"linear-gradient(145deg,#8c96a6,#687488)":isCheckout?"linear-gradient(145deg,#ec6370,#bd3947)":"linear-gradient(145deg,#31bc6b,#159447)",color:"#fff",font:"inherit",fontSize:11,fontWeight:900,cursor:menuDisabled?"not-allowed":"pointer",boxShadow:item?.no_show?"0 7px 18px rgba(48,54,64,.18)":isCheckout?"0 7px 18px rgba(189,57,71,.20)":"0 7px 18px rgba(21,148,71,.18)",opacity:menuDisabled?.5:1}
  const menuButton={width:"100%",minHeight:36,padding:"8px 10px",border:0,borderRadius:8,background:"transparent",color:"var(--text)",font:"inherit",fontSize:10.5,fontWeight:800,textAlign:"left",cursor:"pointer"}
  function run(callback){setOpen(false);callback?.()}

  return <div ref={rootRef} style={{position:"relative",display:"inline-flex"}}>
    <button type="button" aria-haspopup="menu" aria-expanded={open} disabled={menuDisabled} onClick={()=>setOpen(value=>!value)} style={mainStyle}><span>{mainLabel}</span><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button>
    {open?<div role="menu" style={{position:"absolute",right:0,top:"calc(100% + 7px)",zIndex:260,width:205,padding:6,border:"1px solid var(--line)",borderRadius:12,background:"color-mix(in srgb,var(--panelSolid) 97%,transparent)",boxShadow:"0 18px 46px rgba(18,30,52,.18)",backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)"}}>
      <button type="button" role="menuitem" disabled={primaryDisabled} onClick={()=>run(onPrimary)} style={{...menuButton,opacity:primaryDisabled?.45:1,cursor:primaryDisabled?"not-allowed":"pointer"}}>{waitingFuture?`Check-in habilitado el ${fmtShort(progress.nextPendingDate)}`:hasEligiblePending?`Completar check-in · ${progress.eligiblePending} pendiente${progress.eligiblePending===1?"":"s"}`:isCheckout?"Hacer check-out":"Hacer check-in"}</button>
      <button type="button" role="menuitem" disabled={noShowDisabled&&!item?.no_show} onClick={()=>run(onNoShow)} style={{...menuButton,color:item?.no_show?"var(--text)":"#9a5b18",opacity:noShowDisabled&&!item?.no_show?0.45:1,cursor:noShowDisabled&&!item?.no_show?"not-allowed":"pointer"}}>{noShowLabel}</button>
      {canCancel?<><div style={{height:1,margin:"4px 3px",background:"var(--line)"}}/><button type="button" role="menuitem" disabled={saving} onClick={()=>run(onCancel)} style={{...menuButton,color:"#c24850",cursor:saving?"not-allowed":"pointer",opacity:saving?.5:1}}>Cancelar reserva</button></>:null}
    </div>:null}
  </div>
}
