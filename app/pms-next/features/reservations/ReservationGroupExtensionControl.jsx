"use client"

import{useEffect,useMemo,useState}from"react"
import{createPortal}from"react-dom"
import{supabase}from"../../../../lib/supabase"
import{activeReservationRoomIds,addDays,money}from"./reservationEditUtils"
import{reservationRoomDetail,roomSpecialStayEnabled}from"./reservationSpecialStayState"

const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))
const pretty=value=>validDate(value)?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(value+"T12:00:00Z")):"—"
const round=value=>Math.round((Number(value)||0)*100)/100

function serviceLateBooked(item,roomId){
  const svc=(Array.isArray(item?.servicios)?item.servicios:[]).find(row=>Number(row?.room_id||row?.habitacion_id)===Number(roomId)&&(String(row?.special_stay||"").toLowerCase()==="late"||String(row?.id||"")==="late-room-"+roomId||row?.late_checkout_time))
  return Math.max(0,Number(svc?.precio??svc?.total)||0)
}

export default function ReservationGroupExtensionControl({item,allRooms=[],disabled=false,onPreviewMove,onSaved}){
  const ids=useMemo(()=>activeReservationRoomIds(item).map(Number).filter(Number.isFinite),[item?.habitacion_id,item?.habitaciones_ids,item?.habitaciones_detalle,item?.room_checkout_dates])
  const roomMap=useMemo(()=>new Map(allRooms.map(room=>[Number(room.id),room])),[allRooms])
  const rows=useMemo(()=>ids.map(id=>{const detail=reservationRoomDetail(item,id),room=roomMap.get(id);return{id,room,detail,end:String(detail?.fecha_salida||item?.fecha_salida||"").slice(0,10),start:String(detail?.fecha_entrada||item?.fecha_entrada||"").slice(0,10),late:roomSpecialStayEnabled(item,id,"late")}}),[ids.join("|"),item?.habitaciones_detalle,item?.fecha_entrada,item?.fecha_salida,item?.room_checkout_dates,roomMap])
  const maxEnd=useMemo(()=>rows.reduce((max,row)=>row.end>max?row.end:max,String(item?.fecha_salida||"").slice(0,10)),[rows,item?.fecha_salida])
  const minEnd=useMemo(()=>rows.reduce((min,row)=>!min||row.end<min?row.end:min,""),[rows])
  const[open,setOpen]=useState(false),[newEnd,setNewEnd]=useState(()=>addDays(minEnd||maxEnd,1)),[states,setStates]=useState({}),[selected,setSelected]=useState(new Set()),[checking,setChecking]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState("")
  const factor=item?.impuestos_desglosados?1+Math.max(0,Number(item?.iva_porcentaje)||0)/100:1
  const validationKey=rows.map(row=>[row.id,row.end,row.late,row.detail?.late_checkout_net||0].join(":")).join("|")

  useEffect(()=>{if(open){setNewEnd(addDays(minEnd||maxEnd,1));setSelected(new Set());setStates({});setError("")}},[open,minEnd,maxEnd])

  useEffect(()=>{
    if(!open||!validDate(newEnd)||!rows.length)return
    let cancelled=false
    setChecking(true);setError("")
    ;(async()=>{
      const next={}
      await Promise.all(rows.map(async row=>{
        if(newEnd<=row.end){next[row.id]={ok:false,message:"Ya está reservada hasta "+pretty(row.end)};return}
        try{
          const preview=await onPreviewMove?.({reservationId:item.id,roomId:row.id,start:row.end,end:newEnd})
          if(!preview?.ok){next[row.id]={ok:false,message:String(preview?.message||"No disponible").replace(/^No se puede aplicar el cambio:\s*/,"")};return}
          const quoteRes=await supabase.rpc("hl_quote_room_addition_atomic",{p_reservation_id:Number(item.id),p_room_id:row.id,p_start:row.end,p_end:newEnd})
          if(quoteRes.error)throw quoteRes.error
          const quote=quoteRes.data||{},extensionFinal=round(Number(quote.reservation_final_total)||0),detailLate=Math.max(0,Number(row.detail?.late_checkout_net)||0),lateBooked=row.late?Math.max(detailLate,serviceLateBooked(item,row.id)):0,lateFinal=round(lateBooked*factor),additionalFinal=round(extensionFinal-lateFinal)
          next[row.id]={ok:true,quote,extensionFinal,lateFinal,additionalFinal,message:"Disponible"}
        }catch(err){next[row.id]={ok:false,message:err?.message||"No se pudieron validar las noches."}}
      }))
      if(cancelled)return
      setStates(next)
      setSelected(current=>new Set([...current].filter(id=>next[id]?.ok)))
    })().catch(err=>!cancelled&&setError(err?.message||"No se pudieron validar las noches.")).finally(()=>!cancelled&&setChecking(false))
    return()=>{cancelled=true}
  },[open,newEnd,validationKey,item?.id,factor])

  const picked=rows.filter(row=>selected.has(row.id))
  const summary=picked.reduce((acc,row)=>{const state=states[row.id]||{};acc.extension+=Number(state.extensionFinal)||0;acc.credit+=Number(state.lateFinal)||0;acc.delta+=Number(state.additionalFinal)||0;return acc},{extension:0,credit:0,delta:0})

  function toggle(id){if(!states[id]?.ok)return;setSelected(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next})}

  async function confirm(){
    if(!selected.size)return setError("Elegí al menos una habitación disponible.")
    setSaving(true);setError("")
    try{
      const result=await supabase.rpc("hl_extend_group_rooms_atomic",{p_reserva_id:Number(item.id),p_room_ids:[...selected],p_new_end:newEnd})
      if(result.error)throw result.error
      if(typeof window!=="undefined"){
        window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(item.id)}}))
        window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId:item.property_id,tables:["reservas","hotel_reservation_guests","hotel_folios","hotel_folio_items","pagos"]}}))
        window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:"Noches extendidas",message:"Se extendieron las noches de "+String(selected.size)+" habitación"+(selected.size===1?"":"es")+" hasta "+pretty(newEnd)+"."}}))
      }
      onSaved?.(result.data);setOpen(false)
    }catch(err){setError(err?.message||"No se pudieron extender las noches seleccionadas.")}finally{setSaving(false)}
  }

  const field=<div style={{display:"grid",gap:5}}><span style={{fontSize:10,fontWeight:850,color:"var(--muted)"}}>Noches</span><button type="button" disabled={disabled||!rows.length} onClick={()=>setOpen(true)} style={{height:39,width:"100%",border:"1px solid color-mix(in srgb,var(--accent) 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--accent) 7%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:10.5,fontWeight:850,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.55:1}}>↔ Extender noches</button></div>
  if(!open||typeof document==="undefined")return field

  const overlay={position:"fixed",inset:0,zIndex:2147483000,display:"grid",placeItems:"center",padding:"clamp(12px,3vh,24px)",background:"rgba(10,18,34,.38)",color:"var(--text)"}
  const shell={width:"min(720px,calc(100vw - 24px))",maxHeight:"calc(100dvh - 32px)",overflow:"auto",border:"1px solid var(--line)",borderRadius:18,background:"var(--panelSolid)",boxShadow:"0 28px 80px rgba(15,27,50,.3)",fontFamily:"Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}

  return <>{field}{createPortal(<div style={overlay} onMouseDown={event=>event.target===event.currentTarget&&!saving&&setOpen(false)}><section style={shell} role="dialog" aria-modal="true" aria-label="Extender noches"><header style={{display:"flex",justifyContent:"space-between",gap:14,padding:"16px 18px 13px",borderBottom:"1px solid var(--line)"}}><div><small style={{fontSize:9.5,fontWeight:900,letterSpacing:".09em",color:"var(--accent)"}}>RESERVA GRUPAL · NOCHES</small><h2 style={{margin:"4px 0 0",fontSize:19}}>Extender noches</h2><p style={{margin:"5px 0 0",fontSize:10.5,color:"var(--muted)"}}>Elegí qué habitaciones suman noches. Se valida Planning, Early/Late y bloqueos antes de guardar.</p></div><button type="button" disabled={saving} onClick={()=>setOpen(false)} style={{width:38,height:38,border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:18}}>×</button></header><div style={{padding:16,display:"grid",gap:12}}><label style={{display:"grid",gap:5,fontSize:10,fontWeight:850,color:"var(--muted)"}}>Nueva salida<input type="date" min={addDays(minEnd||maxEnd,1)} value={newEnd} onChange={event=>setNewEnd(event.target.value)} style={{height:40,border:"1px solid var(--line)",borderRadius:10,padding:"0 11px",background:"var(--panelSolid)",color:"var(--text)",fontFamily:"Arial, Helvetica, sans-serif",fontSize:13,fontWeight:700,fontVariantNumeric:"tabular-nums",fontFeatureSettings:"'tnum' 1",letterSpacing:".015em"}}/></label><div style={{display:"grid",gap:7}}>{rows.map(row=>{const state=states[row.id],checked=selected.has(row.id),name=row.room?.nombre||row.detail?.nombre||row.id,type=row.room?.tipo||row.detail?.categoria_asignada||"Habitación";return <button type="button" key={row.id} disabled={!state?.ok||saving} onClick={()=>toggle(row.id)} style={{display:"grid",gridTemplateColumns:"auto 1fr auto",alignItems:"center",gap:10,padding:"10px 11px",border:"1px solid "+(checked?"color-mix(in srgb,var(--accent) 55%,var(--line))":"var(--line)"),borderRadius:11,background:checked?"color-mix(in srgb,var(--accent) 7%,var(--panelSolid))":"var(--panelSolid)",color:"var(--text)",font:"inherit",textAlign:"left",opacity:state&&!state.ok?.62:1,cursor:state?.ok?"pointer":"default"}}><span style={{width:20,height:20,borderRadius:6,border:"1px solid "+(checked?"var(--accent)":"var(--line)"),display:"grid",placeItems:"center",background:checked?"var(--accent)":"transparent",color:"#fff",fontWeight:900}}>{checked?"✓":""}</span><span><b style={{display:"block",fontSize:11.5}}>Hab. {name} · {type}</b><small style={{display:"block",marginTop:3,fontSize:9.7,color:"var(--muted)"}}>Salida actual {pretty(row.end)} → nueva {pretty(newEnd)}{row.late?" · Late activo":""}</small></span><span style={{textAlign:"right"}}>{checking&&!state?<small style={{fontSize:9.5,color:"var(--muted)"}}>Validando…</small>:state?.ok?<><b style={{display:"block",fontSize:10.5,color:"#26794d"}}>Disponible</b><small style={{display:"block",marginTop:2,fontSize:9.2,color:"var(--muted)"}}>+ {money(state.extensionFinal,item.moneda)}{state.lateFinal?" · Late −"+money(state.lateFinal,item.moneda):""}</small></>:<small style={{display:"block",maxWidth:240,fontSize:9.2,lineHeight:1.35,color:"#b6434d"}}>{state?.message||"Validando…"}</small>}</span></button>})}</div>{picked.length?<div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7,padding:10,border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--accent) 3%,var(--panelSolid))"}}><div><small style={{display:"block",fontSize:9,color:"var(--muted)"}}>EXTENSIÓN</small><b style={{fontSize:12}}>{money(summary.extension,item.moneda)}</b></div><div><small style={{display:"block",fontSize:9,color:"var(--muted)"}}>CRÉDITO LATE</small><b style={{fontSize:12,color:"#9a6c20"}}>{summary.credit?"− "+money(summary.credit,item.moneda):money(0,item.moneda)}</b></div><div><small style={{display:"block",fontSize:9,color:"var(--muted)"}}>ADICIONAL REAL</small><b style={{fontSize:13,color:"var(--accent)"}}>{money(summary.delta,item.moneda)}</b></div></div>:null}{error?<div style={{padding:"8px 10px",border:"1px solid color-mix(in srgb,#c24850 28%,var(--line))",borderRadius:9,background:"color-mix(in srgb,#c24850 5%,var(--panelSolid))",color:"#b6434d",fontSize:10}}>{error}</div>:null}</div><footer style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"12px 16px",borderTop:"1px solid var(--line)"}}><button type="button" disabled={saving} onClick={()=>setOpen(false)} style={{height:38,padding:"0 13px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontWeight:800}}>Cancelar</button><button type="button" disabled={saving||checking||!selected.size} onClick={confirm} style={{height:38,padding:"0 15px",border:0,borderRadius:9,background:"linear-gradient(145deg,var(--accent),var(--accent2))",color:"#fff",font:"inherit",fontWeight:850,opacity:saving||checking||!selected.size?.55:1}}>{saving?"Extendiendo…":"Extender noches · "+(selected.size||"")+" hab."}</button></footer></section></div>,document.body)}</>
}
