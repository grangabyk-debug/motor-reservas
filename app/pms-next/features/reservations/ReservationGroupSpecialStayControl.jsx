"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{activeReservationRoomIds,roundMoney}from"./reservationEditUtils"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const truthy=value=>["true","t","1","yes","on"].includes(String(value??"").toLowerCase())
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))
const roomKey=svc=>Number(svc?.habitacion_id??svc?.room_id)
const gross=(net,vat)=>roundMoney((Number(net)||0)+roundMoney((Number(net)||0)*(Number(vat)||0)/100))

function detailFor(item,id){return(Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]).find(row=>Number(row?.habitacion_id)===Number(id))||{}}
function roomStart(item,id){const d=detailFor(item,id);return String(d.fecha_entrada||item?.fecha_entrada||"").slice(0,10)}
function roomEnd(item,id){const d=detailFor(item,id);return String(d.fecha_salida||item?.fecha_salida||"").slice(0,10)}
function enabledFor(item,id,kind){
  const d=detailFor(item,id)
  if(kind==="late"&&validDate(item?.room_checkout_dates?.[`late:${id}`]))return true
  const explicit=`${kind}_${kind==="early"?"checkin":"checkout"}_requested`
  if(Object.prototype.hasOwnProperty.call(d,explicit))return truthy(d[explicit])
  const timeKey=kind==="early"?"early_checkin_time":"late_checkout_time",netKey=kind==="early"?"early_checkin_net":"late_checkout_net"
  if(d?.[timeKey]||Number(d?.[netKey])>0)return true
  return kind==="early"
    ?Boolean(item?.early_checkin)&&roomStart(item,id)===String(item?.fecha_entrada||"").slice(0,10)
    :Boolean(item?.late_checkout)&&roomEnd(item,id)===String(item?.fecha_salida||"").slice(0,10)
}
function rateFor(item,room,id,kind){
  const d=detailFor(item,id),raw=Array.isArray(d?.tarifas_por_noche)?[...d.tarifas_por_noche]:[]
  raw.sort((a,b)=>String(a?.fecha||a?.stay_date||"").localeCompare(String(b?.fecha||b?.stay_date||"")))
  const entry=kind==="late"?raw[raw.length-1]:raw[0]
  const nightly=Number(entry?.tarifa_neta??entry?.price??entry?.tarifa)
  if(Number.isFinite(nightly)&&nightly>0)return nightly
  return Math.max(0,Number(d?.tarifa_noche)||Number(room?.precio)||0)
}
function serviceNet(item,id,kind){
  const rows=Array.isArray(item?.servicios)?item.servicios:[]
  const found=rows.find(svc=>roomKey(svc)===Number(id)&&(
    String(svc?.special_stay||"").toLowerCase()===kind||
    String(svc?.id||"").startsWith(`${kind}-room-`)||
    (kind==="early"&&svc?.early_checkin_time)||
    (kind==="late"&&svc?.late_checkout_time)
  ))
  return Math.max(0,Number(found?.total??found?.precio)||0)
}

export default function ReservationGroupSpecialStayControl({item,allRooms=[],stayFees,disabled=false,onSaved}){
  const ids=useMemo(()=>activeReservationRoomIds(item).map(Number).filter(Number.isFinite),[item?.id,JSON.stringify(item?.habitaciones_detalle||[]),JSON.stringify(item?.room_checkout_dates||{})])
  const[current,setCurrent]=useState(item),[selectedId,setSelectedId]=useState(ids[0]||null),[saving,setSaving]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("")
  useEffect(()=>{setCurrent(item);if(!ids.includes(Number(selectedId)))setSelectedId(ids[0]||null)},[item,ids.join("|")])
  const roomsById=useMemo(()=>new Map(allRooms.map(room=>[Number(room.id),room])),[allRooms])
  const room=roomsById.get(Number(selectedId))
  if(ids.length<2||!selectedId)return null

  const vat=Boolean(current?.impuestos_desglosados)?Math.max(0,Number(current?.iva_porcentaje)||0):0
  const earlyPct=Math.max(0,Math.min(100,Number(stayFees?.early_checkin_percent)||35)),latePct=Math.max(0,Math.min(100,Number(stayFees?.late_checkout_percent)||35))
  const earlyTime=stayFees?.early_checkin_time||"08:00",lateTime=stayFees?.late_checkout_time||"18:00"
  const earlyRate=rateFor(current,room,selectedId,"early"),lateRate=rateFor(current,room,selectedId,"late")
  const expectedEarlyNet=roundMoney(earlyRate*earlyPct/100),expectedLateNet=roundMoney(lateRate*latePct/100)
  const expectedEarly=gross(expectedEarlyNet,vat),expectedLate=gross(expectedLateNet,vat)
  const earlyOn=enabledFor(current,selectedId,"early"),lateOn=enabledFor(current,selectedId,"late")
  const actualEarlyNet=serviceNet(current,selectedId,"early"),actualLateNet=serviceNet(current,selectedId,"late")
  const actualEarly=actualEarlyNet?gross(actualEarlyNet,vat):expectedEarly,actualLate=actualLateNet?gross(actualLateNet,vat):expectedLate
  const earlyMismatch=earlyOn&&actualEarlyNet>0&&Math.abs(actualEarly-expectedEarly)>.02,lateMismatch=lateOn&&actualLateNet>0&&Math.abs(actualLate-expectedLate)>.02
  const busy=Boolean(saving)||disabled
  async function apply(kind,enabled){
    if(busy)return
    setSaving(kind);setError("");setNotice("")
    try{
      const{data,error:rpcError}=await supabase.rpc("hl_set_group_room_special_stay_atomic",{p_reserva_id:Number(current.id),p_room_id:Number(selectedId),p_kind:kind,p_enabled:Boolean(enabled)})
      if(rpcError)throw rpcError
      setCurrent(data);setNotice(`${kind==="early"?"Early check-in":"Late check-out"} ${enabled?"aplicado":"quitado"} en Hab. ${room?.nombre||selectedId}.`)
      onSaved?.(data)
      if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:"Horario especial actualizado",message:`Hab. ${room?.nombre||selectedId} · ${kind==="early"?"Early check-in":"Late check-out"} ${enabled?"aplicado":"quitado"}.`}}))
    }catch(err){setError(err?.message||"No se pudo actualizar el horario especial.")}
    finally{setSaving("")}
  }
  const card=(kind,on,expected,actual,mismatch,pct,time)=>(
    <div style={{padding:"11px 12px",border:"1px solid color-mix(in srgb,var(--accent) 17%,var(--line))",borderRadius:12,background:on?"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))":"var(--panelSolid)",display:"grid",gap:8}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><span><b style={{display:"block",fontSize:11.5}}>{kind==="early"?"Early check-in":"Late check-out"}{on?" · activo":""}</b><small style={{display:"block",marginTop:3,color:"var(--muted)",fontSize:10}}>{pct}% de la tarifa · {kind==="early"?"desde":"hasta"} {time}</small></span><strong style={{fontSize:12,color:on?"var(--accent)":"var(--text)",whiteSpace:"nowrap"}}>{money(on?actual:expected,current.moneda)}</strong></div>
      {mismatch?<div style={{padding:"7px 8px",border:"1px solid color-mix(in srgb,#d59a2c 30%,var(--line))",borderRadius:9,background:"color-mix(in srgb,#d59a2c 7%,var(--panelSolid))",fontSize:9.5,color:"#956718"}}>Importe heredado {money(actual,current.moneda)} · regla actual {money(expected,current.moneda)}.</div>:null}
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}>{on&&mismatch?<button type="button" disabled={busy} onClick={()=>apply(kind,true)} style={buttonStyle(false)}>{saving===kind?"Actualizando…":`Actualizar a ${money(expected,current.moneda)}`}</button>:null}<button type="button" disabled={busy} onClick={()=>apply(kind,!on)} style={buttonStyle(!on)}>{saving===kind?"Guardando…":on?"Quitar":"Agregar"}</button></div>
    </div>
  )
  return <div style={{marginTop:10,padding:"11px 12px",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:13,background:"color-mix(in srgb,var(--accent) 3%,var(--panelSolid))"}}>
    <div style={{display:"flex",alignItems:"end",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><b style={{display:"block",fontSize:11.5}}>Early / late por habitación</b><small style={{display:"block",marginTop:3,fontSize:10,color:"var(--muted)"}}>El cargo se calcula con la tarifa real de la habitación y se envía a su folio.</small></div><label style={{display:"grid",gap:4,minWidth:210,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>Habitación<select value={selectedId} onChange={e=>{setSelectedId(Number(e.target.value));setError("");setNotice("")}} style={{height:36,border:"1px solid var(--line)",borderRadius:10,padding:"0 9px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:800}}>{ids.map(id=>{const r=roomsById.get(id);return <option key={id} value={id}>Hab. {r?.nombre||id}{r?.tipo?` · ${r.tipo}`:""}</option>})}</select></label></div>
    <div data-group-special-stays style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:10}}>{card("early",earlyOn,expectedEarly,actualEarly,earlyMismatch,earlyPct,earlyTime)}{card("late",lateOn,expectedLate,actualLate,lateMismatch,latePct,lateTime)}</div>
    {error?<div style={{marginTop:8,padding:"8px 9px",border:"1px solid color-mix(in srgb,var(--red) 30%,var(--line))",borderRadius:9,background:"color-mix(in srgb,var(--red) 7%,var(--panelSolid))",color:"var(--red)",fontSize:10,fontWeight:800}}>{error}</div>:notice?<div style={{marginTop:8,fontSize:10,fontWeight:800,color:"#26794d"}}>✓ {notice}</div>:null}
    <style>{`@media(max-width:620px){[aria-label="Editar reserva"] [data-group-special-stays]{grid-template-columns:1fr!important}}`}</style>
  </div>
}
function buttonStyle(primary){return{height:34,padding:"0 11px",border:primary?0:"1px solid var(--line)",borderRadius:9,background:primary?"linear-gradient(145deg,var(--accent),var(--accent2))":"var(--panelSolid)",color:primary?"#fff":"var(--text)",font:"inherit",fontSize:10,fontWeight:900,cursor:"pointer"}}
