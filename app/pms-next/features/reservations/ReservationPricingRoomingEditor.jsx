"use client"

import RoomingEditor from"../planning/RoomingEditor"
import{effectiveEditRoomRate}from"./reservationRoomPricingEdit"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const day=value=>String(value||"").slice(0,10)
const nights=(detail,item)=>{const explicit=Number(detail?.noches);if(Number.isFinite(explicit)&&explicit>0)return explicit;const start=day(detail?.fecha_entrada||item?.fecha_entrada),end=day(detail?.fecha_salida||item?.fecha_salida);if(!start||!end)return 1;return Math.max(1,Math.round((new Date(end+"T12:00:00")-new Date(start+"T12:00:00"))/86400000))}

export default function ReservationPricingRoomingEditor({item,draft,rooms=[],currency="ARS",ratePlans,taxConfig,defaultRatePlanCode,...props}){
  const note=Number(item?.paid||0)>0||item?.estado==="alojado"
  const factor=taxConfig?.enabled===false?1:1+(Math.max(0,Number(taxConfig?.vat_rate)||0)/100)
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
  const changes=rooms.map(room=>{
    const id=String(room.id),detail=details.find(value=>String(value?.habitacion_id)===id)||{},assignment=draft?.roomAssignments?.[id]||{}
    const current=Math.max(0,Number(detail?.tarifa_noche)||0),next=effectiveEditRoomRate({assignment,room,ratePlans,taxes:taxConfig,defaultCode:defaultRatePlanCode}),perNight=(next-current)*factor,count=nights(detail,item),total=perNight*count
    return{room:room.nombre||id,perNight,total,count}
  }).filter(change=>Math.abs(change.total)>.01)
  return <>
    <RoomingEditor {...props} draft={draft} rooms={rooms} currency={currency} ratePlans={ratePlans} taxConfig={taxConfig} defaultRatePlanCode={defaultRatePlanCode} editableRate={false} allowRatePlanOverride/>
    {changes.length?<div style={{marginTop:9,padding:"9px 11px",border:"1px solid color-mix(in srgb,var(--gold) 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--gold) 6%,var(--panelSolid))",fontSize:10.5,lineHeight:1.5}}><b>Cambio de tarifa</b>{changes.map(change=><div key={change.room} style={{marginTop:3,color:"var(--muted)"}}>Hab. {change.room} · {change.perNight>=0?"+":"−"} {money(Math.abs(change.perNight),currency)} por noche{change.count>1?` × ${change.count} noches = ${change.total>=0?"+":"−"} ${money(Math.abs(change.total),currency)} total`:""}</div>)}</div>:null}
    {note?<div style={{marginTop:9,padding:"9px 11px",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))",fontSize:10.5,lineHeight:1.45,color:"var(--muted)"}}><b style={{color:"var(--text)"}}>Cambios de régimen y ocupación</b><div style={{marginTop:3}}>Podés modificar plan tarifario y huéspedes aunque la reserva ya esté alojada o tenga pagos. Los suplementos por persona se aplican por cada noche activa de esa habitación. El PMS recalcula cargos, folios y saldo; los pagos existentes se conservan.</div></div>:null}
  </>
}
