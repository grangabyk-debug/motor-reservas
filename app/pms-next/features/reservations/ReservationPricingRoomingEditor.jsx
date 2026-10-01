"use client"

import RoomingEditor from"../planning/RoomingEditor"
import ReservationRoomOccupancyEditor from"./ReservationRoomOccupancyEditor"
import{editStayTotal,pricedEditDetail}from"./reservationRoomPricingEdit"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)

export default function ReservationPricingRoomingEditor({item,draft,setDraft,rooms=[],currency="ARS",ratePlans,taxConfig,defaultRatePlanCode,...props}){
  const note=Number(item?.paid||0)>0||item?.estado==="alojado",factor=taxConfig?.enabled===false?1:1+(Math.max(0,Number(taxConfig?.vat_rate)||0)/100)
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
  const variableRateLabels=Object.fromEntries(details.filter(detail=>detail?.variable_occupancy&&Array.isArray(detail?.occupancy_nights)&&detail.occupancy_nights.length).map(detail=>{const values=detail.occupancy_nights.map(n=>Number(n?.final_rate)).filter(Number.isFinite),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):0;return[String(detail.habitacion_id),min===max?money(min,currency):`${money(min,currency)} – ${money(max,currency)}`]}))
  const changes=rooms.map(room=>{
    const id=String(room.id),detail=details.find(value=>String(value?.habitacion_id)===id)||{},assignment=draft?.roomAssignments?.[id]||{}
    const preview=pricedEditDetail({previous:detail,room,assignment,ratePlans,taxes:taxConfig,defaultCode:defaultRatePlanCode,item,occupancyByDate:draft?.occupancyByRoom?.[id]||null})
    const current=editStayTotal([detail],item,[id]),next=editStayTotal([preview],item,[id]),total=(next-current)*factor
    return{room:room.nombre||id,total,variable:Boolean(preview.variable_occupancy)}
  }).filter(change=>Math.abs(change.total)>.01)
  function guestsChanged(id){setDraft(current=>{if(!current?.occupancyByRoom?.[id])return current;const next={...(current.occupancyByRoom||{})};delete next[id];return{...current,occupancyByRoom:next}})}
  return <>
    <RoomingEditor {...props} draft={draft} setDraft={setDraft} rooms={rooms} currency={currency} ratePlans={ratePlans} taxConfig={taxConfig} defaultRatePlanCode={defaultRatePlanCode} editableRate={false} allowRatePlanOverride variableRateLabels={variableRateLabels} onGuestsChange={guestsChanged}/>
    <ReservationRoomOccupancyEditor item={item} draft={draft} setDraft={setDraft} rooms={rooms} currency={currency} ratePlans={ratePlans} taxConfig={taxConfig} defaultRatePlanCode={defaultRatePlanCode}/>
    {changes.length?<div style={{marginTop:9,padding:"9px 11px",border:"1px solid color-mix(in srgb,var(--gold) 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--gold) 6%,var(--panelSolid))",fontSize:10.5,lineHeight:1.5}}><b>Cambio de tarifa</b>{changes.map(change=><div key={change.room} style={{marginTop:3,color:"var(--muted)"}}>Hab. {change.room} · {change.total>=0?"+":"−"} {money(Math.abs(change.total),currency)} total{change.variable?" · según ocupación por noche":""}</div>)}</div>:null}
    {note?<div style={{marginTop:9,padding:"9px 11px",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))",fontSize:10.5,lineHeight:1.45,color:"var(--muted)"}}><b style={{color:"var(--text)"}}>Cambios de régimen y ocupación</b><div style={{marginTop:3}}>Podés modificar plan tarifario y huéspedes aunque la reserva ya esté alojada o tenga pagos. En planes por persona también podés personalizar la ocupación de cada noche. El PMS recalcula cargos, folios y saldo; los pagos existentes se conservan.</div></div>:null}
  </>
}
