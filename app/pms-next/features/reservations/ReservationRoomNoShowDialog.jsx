"use client"

import{useEffect,useMemo,useState}from"react"
import{createPortal}from"react-dom"
import{reservationCheckinProgress}from"./reservationEditUtils"

const DAY=86400000
const dateKey=date=>date.toLocaleDateString("en-CA")
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`)).replace(".",""):"—"
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const diffDays=(start,end)=>Math.max(0,Math.round((new Date(`${end}T12:00:00`)-new Date(`${start}T12:00:00`))/DAY))
const detailFor=(item,id)=>(Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]).find(detail=>Number(detail?.habitacion_id)===Number(id))||{}
function penaltyValue(rule,{total=0,rate=0}={}){const value=Math.max(0,Number(rule?.value)||0),type=rule?.charge_type||"none";if(type==="fixed")return value;if(type==="percent")return Math.max(0,Number(total)||0)*value/100;if(type==="nights")return Math.max(0,Number(rate)||0)*value;return 0}
function ruleText(rule,currency="ARS"){const value=Math.max(0,Number(rule?.value)||0);if(rule?.charge_type==="fixed")return money(value,currency);if(rule?.charge_type==="percent")return`${value}% del total`;if(rule?.charge_type==="nights")return`${value} noche${value===1?"":"s"}`;return"Sin cargo"}

export default function ReservationRoomNoShowDialog({item,onClose,onConfirm,onPay,saving=false,error=""}){
  const progress=useMemo(()=>reservationCheckinProgress(item||{}),[item])
  const candidateIds=useMemo(()=>[...new Set([...progress.eligiblePendingRoomIds,...progress.expiredPendingRoomIds].map(Number))],[progress.eligiblePendingRoomIds.join("|"),progress.expiredPendingRoomIds.join("|")])
  const candidates=useMemo(()=>candidateIds.map(id=>{const detail=detailFor(item,id),room=(item?.rooms||[]).find(value=>Number(value.id)===id);return{id,name:room?.nombre||detail?.nombre||id,detail,start:String(detail?.fecha_entrada||item?.fecha_entrada||"").slice(0,10),end:String(detail?.fecha_salida||item?.fecha_salida||"").slice(0,10)}}),[candidateIds.join("|"),item])
  const[selectedId,setSelectedId]=useState("")
  const[penalty,setPenalty]=useState(false)
  const[amount,setAmount]=useState(0)
  const[note,setNote]=useState("")
  const selected=candidates.find(row=>String(row.id)===String(selectedId))||candidates[0]||null
  const detail=selected?.detail||{}
  const currency=item?.moneda||"ARS",vatRate=Boolean(item?.impuestos_desglosados)?Math.max(0,Number(item?.iva_porcentaje)||0):0,factor=1+vatRate/100
  const rateNet=Math.max(0,Number(detail?.tarifa_noche)||0),rateGross=Math.round(rateNet*factor*100)/100,nights=selected?diffDays(selected.start,selected.end):0,totalGross=Math.round(rateGross*nights*100)/100
  const policy=detail?.cancellation_policy_snapshot&&typeof detail.cancellation_policy_snapshot==="object"?detail.cancellation_policy_snapshot:item?.cancellation_policy_snapshot&&typeof item.cancellation_policy_snapshot==="object"?item.cancellation_policy_snapshot:{}
  const rule=policy?.no_show_rule||{charge_type:"none",value:0},suggested=penaltyValue(rule,{total:totalGross,rate:rateGross})
  const today=dateKey(new Date()),late=Boolean(selected?.end)&&today>selected.end,releaseDate=late?selected.end:today,arrived=Boolean(selected?.start)&&today>=selected.start
  const paid=Math.max(0,Number(item?.paid)||0),penaltyAmount=Math.max(0,Number(amount)||0),covered=!penalty||penaltyAmount<=0||paid+0.01>=penaltyAmount,canConfirm=Boolean(selected)&&arrived&&covered

  useEffect(()=>{setSelectedId(String(candidates[0]?.id||""));setNote("")},[item?.id,candidates.map(row=>row.id).join("|")])
  useEffect(()=>{setPenalty(suggested>0);setAmount(suggested)},[selected?.id,suggested])
  useEffect(()=>{if(typeof document==="undefined")return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous}},[])

  if(typeof document==="undefined")return null
  const overlay={position:"fixed",inset:0,zIndex:2147483000,display:"grid",placeItems:"center",padding:14,background:"rgba(15,22,36,.52)",backdropFilter:"blur(12px) saturate(1.08)",WebkitBackdropFilter:"blur(12px) saturate(1.08)",overflow:"hidden"}
  const panel={width:"min(640px,calc(100vw - 28px))",maxHeight:"calc(100vh - 28px)",display:"flex",flexDirection:"column",minHeight:0,border:"1px solid var(--lineStrong)",borderRadius:22,background:"var(--panelSolid)",color:"var(--text)",boxShadow:"0 30px 90px rgba(17,28,52,.34)",overflow:"hidden",isolation:"isolate"}
  const button={height:40,padding:"0 14px",border:"1px solid var(--line)",borderRadius:11,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:850}
  const field={height:40,width:"100%",border:"1px solid var(--line)",borderRadius:10,padding:"0 10px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit"}

  return createPortal(<div style={overlay} onMouseDown={event=>event.target===event.currentTarget&&!saving&&onClose?.()}>
    <section style={panel} role="dialog" aria-modal="true" aria-label="No Show de habitación">
      <header style={{padding:"17px 18px 14px",display:"flex",justifyContent:"space-between",gap:14,borderBottom:"1px solid var(--line)"}}><div><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".11em",color:"var(--accent)"}}>NO SHOW · HABITACIÓN DEL GRUPO</small><h2 style={{margin:"4px 0 0",fontSize:20}}>Habitación que no se presentó</h2><p style={{margin:"5px 0 0",fontSize:11,color:"var(--muted)"}}>{item?.nombre_huesped} · Reserva {item?.numero_reserva||item?.id}</p></div><button type="button" onClick={onClose} disabled={saving} style={{...button,width:38,padding:0,fontSize:18}}>×</button></header>
      <div style={{padding:18,overflowY:"auto",minHeight:0}}>
        {candidates.length?<><label style={{display:"grid",gap:6,fontSize:10,fontWeight:850,color:"var(--muted)"}}>Habitación pendiente<select value={String(selected?.id||"")} onChange={event=>setSelectedId(event.target.value)} style={field}>{candidates.map(row=><option key={row.id} value={row.id}>Hab. {row.name} · {fmtDate(row.start)} → {fmtDate(row.end)}</option>)}</select></label>
        <div style={{marginTop:11,padding:"11px 12px",border:"1px solid color-mix(in srgb,#28a66a 34%,var(--line))",borderRadius:12,background:"color-mix(in srgb,#28a66a 7%,var(--panelSolid))",fontSize:10.5,lineHeight:1.5}}><b>Se libera solamente la Hab. {selected?.name}</b><span style={{display:"block",marginTop:3,color:"var(--muted)"}}>Las habitaciones que ya hicieron check-in siguen alojadas. Los pasajeros de esta habitación quedan inactivos y Planning deja de contarla como ocupación.</span></div>
        <div style={{marginTop:11,padding:"11px 12px",border:"1px solid var(--line)",borderRadius:12,background:"var(--panelSolid)",fontSize:10.5,lineHeight:1.5}}><b>{fmtDate(selected?.start)} → {fmtDate(selected?.end)} · {nights} noche{nights===1?"":"s"}</b><span style={{display:"block",marginTop:3,color:"var(--muted)"}}>Tarifa final {money(rateGross,currency)} / noche · total original de esta habitación {money(totalGross,currency)}.</span></div>
        {!arrived?<div style={{marginTop:11,padding:"10px 11px",border:"1px solid color-mix(in srgb,var(--red) 35%,var(--line))",borderRadius:10,color:"var(--red)"}}>Todavía no llegó la fecha de entrada de esta habitación.</div>:null}
        <div style={{marginTop:11,padding:"11px 12px",border:"1px solid color-mix(in srgb,var(--accent) 26%,var(--line))",borderRadius:12,background:"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))",fontSize:10.5,lineHeight:1.5}}><b>Política: {policy?.name||"Sin política histórica"}</b><span style={{display:"block",marginTop:3,color:"var(--muted)"}}>{policy?.description||"No hay una descripción guardada para esta habitación."}</span><span style={{display:"block",marginTop:4,fontWeight:850}}>No Show previsto: {ruleText(rule,policy?.currency||currency)}{suggested>0?` · sugerido ${money(suggested,currency)}`:""}</span></div>
        <div style={{marginTop:12,padding:12,border:"1px solid var(--line)",borderRadius:12}}><b style={{fontSize:11}}>Penalidad</b><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}><button type="button" onClick={()=>setPenalty(false)} style={{...button,borderColor:!penalty?"var(--accent)":"var(--line)",color:!penalty?"var(--accent)":"var(--text)"}}>Eximir / no cobrar</button><button type="button" onClick={()=>{setPenalty(true);if(!Number(amount))setAmount(suggested)}} style={{...button,borderColor:penalty?"var(--accent)":"var(--line)",color:penalty?"var(--accent)":"var(--text)"}}>Aplicar penalidad</button></div>{penalty?<div style={{marginTop:9,display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"end"}}><label style={{display:"grid",gap:5,fontSize:10,color:"var(--muted)"}}>Importe final<input type="number" min="0" step="1" value={amount} onChange={event=>setAmount(event.target.value)} style={field}/></label>{covered?<span style={{height:40,display:"grid",placeItems:"center",padding:"0 12px",borderRadius:10,background:"color-mix(in srgb,#28a66a 8%,var(--panelSolid))",color:"#218b59",fontSize:10,fontWeight:850}}>Cobro cubierto ✓</span>:<button type="button" onClick={()=>onPay?.(penaltyAmount)} style={{...button,background:"var(--accent)",borderColor:"var(--accent)",color:"#fff"}}>Cobrar penalidad</button>}</div>:null}{penalty&&!covered?<small style={{display:"block",marginTop:6,color:"#956718"}}>Primero registrá el cobro de la penalidad.</small>:null}</div>
        <label style={{display:"grid",gap:5,marginTop:12,fontSize:10,color:"var(--muted)"}}>Observación<textarea value={note} onChange={event=>setNote(event.target.value)} rows="3" placeholder={`Ej.: se llamó por la Hab. ${selected?.name} y confirmaron que no llegan…`} style={{minHeight:76,resize:"vertical",border:"1px solid var(--line)",borderRadius:10,padding:"9px 10px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit"}}/></label>
        <div style={{marginTop:12,padding:"11px 12px",border:"1px solid var(--line)",borderRadius:12,background:"var(--panelSolid)",fontSize:10.5,lineHeight:1.5}}><b>Resultado</b><span style={{display:"block",marginTop:3,color:"var(--muted)"}}>Se quitan las noches de alojamiento de la Hab. {selected?.name}. {penalty?"La penalidad queda como su único cargo activo.":"No se genera penalidad."} El resto del grupo, los pagos y las asignaciones manuales de folio permanecen intactos.</span></div>
        {error?<div style={{marginTop:11,padding:"10px 11px",border:"1px solid color-mix(in srgb,var(--red) 35%,var(--line))",borderRadius:10,color:"var(--red)",fontSize:10.5}}>{error}</div>:null}
        <footer style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16,paddingTop:13,borderTop:"1px solid var(--line)"}}><button type="button" onClick={onClose} disabled={saving} style={button}>Cancelar</button><button type="button" disabled={saving||!canConfirm} onClick={()=>onConfirm?.({roomId:Number(selected?.id),releaseDate,penaltyAmount:penalty?penaltyAmount:0,penaltyStatus:penalty?"charged":suggested>0?"waived":"none",note:!penalty&&suggested>0?`${note?`${note} · `:""}Penalidad prevista por política eximida manualmente.`:note})} style={{...button,background:"#24272d",borderColor:"#24272d",color:"#fff",opacity:canConfirm?1:.5}}>{saving?"Registrando…":`Confirmar No Show · Hab. ${selected?.name}`}</button></footer></>:<div style={{padding:18,border:"1px solid var(--line)",borderRadius:12,color:"var(--muted)"}}>No hay habitaciones pendientes habilitadas para No Show. Las habitaciones futuras se habilitan recién el día de su llegada.</div>}
      </div>
    </section>
  </div>,document.body)
}
