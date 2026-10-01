"use client"

import{defaultRatePlan,ratePlanBasis,ratePlanByCode}from"../../core/ratePlans"
import{finalPriceFromNet}from"../../core/priceTax"
import{editStayDateKeys,effectiveEditRoomRate}from"./reservationRoomPricingEdit"

const money=(value,currency)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const labelDate=value=>{const[,m,d]=String(value).split("-");return`${d}/${m}`}
const nextDay=value=>{const d=new Date(String(value)+"T12:00:00");d.setDate(d.getDate()+1);return d.toISOString().slice(0,10)}

export default function ReservationRoomOccupancyEditor({item,draft,setDraft,rooms=[],ratePlans,taxConfig,defaultRatePlanCode,currency="ARS"}){
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
  function enable(room,dates,guests){const id=String(room.id);setDraft(current=>({...current,occupancyByRoom:{...(current.occupancyByRoom||{}),[id]:Object.fromEntries(dates.map(date=>[date,guests]))}}))}
  function clear(id){setDraft(current=>{const next={...(current.occupancyByRoom||{})};delete next[id];return{...current,occupancyByRoom:next}})}
  function setNight(room,date,value){
    const id=String(room.id),guests=Math.max(1,Number(value)||1)
    setDraft(current=>{
      const currentMap={...(current.occupancyByRoom?.[id]||{})},nextMap={...currentMap,[date]:guests},maxGuests=Math.max(...Object.values(nextMap).map(Number))
      const assignments={...(current.roomAssignments||{}),[id]:{...(current.roomAssignments?.[id]||{}),guests:maxGuests}}
      const ids=current.roomIds?.length?current.roomIds:[current.roomId],total=ids.reduce((sum,key)=>sum+Math.max(1,Number(assignments?.[String(key)]?.guests)||1),0)
      return{...current,guests:total,roomAssignments:assignments,occupancyByRoom:{...(current.occupancyByRoom||{}),[id]:nextMap}}
    })
  }
  const cards=rooms.map(room=>{
    const id=String(room.id),detail=details.find(value=>String(value?.habitacion_id)===id)||{},assignment=draft?.roomAssignments?.[id]||{},dates=editStayDateKeys(detail,item)
    const selected=ratePlanByCode(ratePlans,assignment.ratePlanCode||detail.rate_plan_code||defaultRatePlanCode),plan=selected?.active?selected:defaultRatePlan(ratePlans)
    if(dates.length<2)return null
    const perPerson=ratePlanBasis(plan)==="per_person",custom=draft?.occupancyByRoom?.[id]||null,baseGuests=Math.max(1,Number(assignment.guests)||1),capacity=Math.max(1,Number(room.capacidad)||1)
    return <div key={id} style={{marginTop:9,padding:"10px 11px",border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--panelSolid) 92%,var(--bg))"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <div><b style={{fontSize:11}}>Hab. {room.nombre} · ocupación por noche</b><div style={{marginTop:2,fontSize:9.5,color:"var(--muted)"}}>{custom?(perPerson?"Ocupación variable activa · recalcula la tarifa por noche.":"Ocupación variable activa · este plan cobra por habitación, la tarifa no cambia."):(perPerson?"Ahora se aplica la misma cantidad de huéspedes a toda la estadía.":"Podés variar huéspedes por noche; este plan mantiene el mismo precio por habitación.")}</div></div>
        <button type="button" onClick={()=>custom?clear(id):enable(room,dates,baseGuests)} style={{height:32,padding:"0 10px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panel)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:800,cursor:"pointer"}}>{custom?`Aplicar ${baseGuests} a todas`:"Personalizar por noche"}</button>
      </div>
      {custom?<div style={{display:"grid",gap:6,marginTop:9}}>{dates.map(date=>{
        const guests=Math.max(1,Number(custom[date])||baseGuests),net=effectiveEditRoomRate({assignment:{...assignment,guests},room,ratePlans,taxes:taxConfig,defaultCode:defaultRatePlanCode}),final=finalPriceFromNet(net,taxConfig)
        return <div key={date} style={{display:"grid",gridTemplateColumns:"minmax(118px,1fr) 86px minmax(110px,1fr)",gap:8,alignItems:"center",padding:"7px 8px",border:"1px solid color-mix(in srgb,var(--line) 75%,transparent)",borderRadius:9}}>
          <span style={{fontSize:10,fontWeight:800}}>{labelDate(date)} → {labelDate(nextDay(date))}</span>
          <select value={guests} onChange={event=>setNight(room,date,event.target.value)} style={{height:34,width:"100%",border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:800,padding:"0 8px"}}>{Array.from({length:capacity},(_,index)=>index+1).map(value=><option key={value} value={value}>{value} huésped{value===1?"":"es"}</option>)}</select>
          <b style={{fontSize:10.5,textAlign:"right"}}>{money(final,currency)} <small style={{display:"block",fontSize:8.5,color:"var(--muted)",fontWeight:700}}>esa noche</small></b>
        </div>
      })}</div>:null}
    </div>
  }).filter(Boolean)
  return cards.length?<div>{cards}</div>:null
}
