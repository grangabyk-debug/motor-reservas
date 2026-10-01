"use client"

import{useState}from"react"
import{defaultRatePlan,ratePlanBasis,ratePlanByCode}from"../../core/ratePlans"
import{finalPriceFromNet}from"../../core/priceTax"
import{editStayDateKeys,effectiveEditRoomRate}from"./reservationRoomPricingEdit"

const money=(value,currency)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const labelDate=value=>{const[,m,d]=String(value).split("-");return`${d}/${m}`}
const nextDay=value=>{const d=new Date(String(value)+"T12:00:00");d.setDate(d.getDate()+1);return d.toISOString().slice(0,10)}

export default function ReservationRoomOccupancyEditor({item,draft,setDraft,rooms=[],ratePlans,taxConfig,defaultRatePlanCode,currency="ARS"}){
  const[selectedRoomId,setSelectedRoomId]=useState(""),[groupOpen,setGroupOpen]=useState(false)
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
  function roomInfo(room){
    const id=String(room.id),detail=details.find(value=>String(value?.habitacion_id)===id)||{},assignment=draft?.roomAssignments?.[id]||{},dates=editStayDateKeys(detail,item)
    const selected=ratePlanByCode(ratePlans,assignment.ratePlanCode||detail.rate_plan_code||defaultRatePlanCode),plan=selected?.active?selected:defaultRatePlan(ratePlans)
    return{id,room,detail,assignment,dates,plan,perPerson:ratePlanBasis(plan)==="per_person",custom:draft?.occupancyByRoom?.[id]||null,baseGuests:Math.max(1,Number(assignment.guests)||1),capacity:Math.max(1,Number(room.capacidad)||1)}
  }
  const eligible=rooms.map(roomInfo).filter(info=>info.dates.length>=2),isGroup=rooms.length>1
  if(!eligible.length)return null

  function clear(id){setDraft(current=>{const next={...(current.occupancyByRoom||{})};delete next[id];return{...current,occupancyByRoom:next}})}
  function setNight(info,date,value){
    const guests=Math.max(1,Number(value)||1)
    setDraft(current=>{
      const existing=current.occupancyByRoom?.[info.id],seed=existing?{...existing}:Object.fromEntries(info.dates.map(day=>[day,info.baseGuests])),nextMap={...seed,[date]:guests},maxGuests=Math.max(...Object.values(nextMap).map(Number))
      const assignments={...(current.roomAssignments||{}),[info.id]:{...(current.roomAssignments?.[info.id]||{}),guests:maxGuests}}
      const ids=current.roomIds?.length?current.roomIds:[current.roomId],total=ids.reduce((sum,key)=>sum+Math.max(1,Number(assignments?.[String(key)]?.guests)||1),0)
      return{...current,guests:total,roomAssignments:assignments,occupancyByRoom:{...(current.occupancyByRoom||{}),[info.id]:nextMap}}
    })
  }
  function editor(info,{showHeading=true}={}){
    return <div style={{marginTop:9,padding:"10px 11px",border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--panelSolid) 92%,var(--bg))"}}>
      {showHeading?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <div><b style={{fontSize:11}}>Hab. {info.room.nombre} · régimen por noche</b><div style={{marginTop:2,fontSize:9.5,color:"var(--muted)"}}>{info.custom?(info.perPerson?"Personalización activa · la tarifa se recalcula noche por noche.":"Personalización activa · este plan cobra por habitación, la tarifa no cambia."):(info.perPerson?"Elegí cuántos huéspedes se alojan cada noche.":"Podés variar huéspedes por noche; este plan mantiene el precio por habitación.")}</div></div>
        {info.custom?<button type="button" onClick={()=>clear(info.id)} style={{height:32,padding:"0 10px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panel)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:800,cursor:"pointer"}}>Quitar personalización</button>:null}
      </div>:null}
      <div style={{display:"grid",gap:6,marginTop:showHeading?9:0}}>{info.dates.map(date=>{
        const guests=Math.max(1,Number(info.custom?.[date])||info.baseGuests),net=effectiveEditRoomRate({assignment:{...info.assignment,guests},room:info.room,ratePlans,taxes:taxConfig,defaultCode:defaultRatePlanCode,detail:info.detail,date}),final=finalPriceFromNet(net,taxConfig)
        return <div key={date} style={{display:"grid",gridTemplateColumns:"minmax(118px,1fr) 100px minmax(110px,1fr)",gap:8,alignItems:"center",padding:"7px 8px",border:"1px solid color-mix(in srgb,var(--line) 75%,transparent)",borderRadius:9}}>
          <span style={{fontSize:10,fontWeight:800}}>{labelDate(date)} → {labelDate(nextDay(date))}</span>
          <select value={guests} onChange={event=>setNight(info,date,event.target.value)} style={{height:34,width:"100%",border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:800,padding:"0 8px"}}>{Array.from({length:info.capacity},(_,index)=>index+1).map(value=><option key={value} value={value}>{value} huésped{value===1?"":"es"}</option>)}</select>
          <b style={{fontSize:10.5,textAlign:"right"}}>{money(final,currency)} <small style={{display:"block",fontSize:8.5,color:"var(--muted)",fontWeight:700}}>esa noche</small></b>
        </div>
      })}</div>
    </div>
  }

  if(!isGroup){
    const info=eligible[0]
    return <div style={{marginTop:9}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 11px",border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--panelSolid) 92%,var(--bg))"}}>
        <div><b style={{fontSize:11}}>Personalizar régimen por noche</b><div style={{marginTop:2,fontSize:9.5,color:"var(--muted)"}}>Definí la cantidad de huéspedes de cada noche de la Hab. {info.room.nombre}.</div></div>
        <button type="button" onClick={()=>setGroupOpen(value=>!value)} style={{height:32,padding:"0 10px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panel)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:800,cursor:"pointer"}}>{groupOpen?"Cerrar":"Personalizar régimen por noche"}</button>
      </div>
      {groupOpen?editor(info):null}
    </div>
  }

  const configured=eligible.filter(info=>info.custom).map(info=>`Hab. ${info.room.nombre}`)
  const selected=eligible.find(info=>info.id===selectedRoomId)||null
  return <div style={{marginTop:9,padding:"10px 11px",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:11,background:"color-mix(in srgb,var(--accent) 3%,var(--panelSolid))"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <div><b style={{fontSize:11}}>Personalizar régimen por noche</b><div style={{marginTop:2,fontSize:9.5,color:"var(--muted)"}}>Elegí qué habitación del grupo querés personalizar.{configured.length?` Personalizadas: ${configured.join(", ")}.`:""}</div></div>
      <button type="button" onClick={()=>{setGroupOpen(value=>!value);if(groupOpen)setSelectedRoomId("")}} style={{height:32,padding:"0 10px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panel)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:800,cursor:"pointer"}}>{groupOpen?"Cerrar":"Personalizar régimen por noche"}</button>
    </div>
    {groupOpen?<div style={{marginTop:9}}>
      <label style={{display:"grid",gap:4,fontSize:9.5,fontWeight:800,color:"var(--muted)"}}>Habitación
        <select value={selectedRoomId} onChange={event=>setSelectedRoomId(event.target.value)} style={{height:36,width:"100%",border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10.5,fontWeight:800,padding:"0 10px"}}>
          <option value="">Elegí una habitación…</option>
          {eligible.map(info=><option key={info.id} value={info.id}>Hab. {info.room.nombre} · {info.plan?.name||"Plan tarifario"} · {info.dates.length} noches{info.custom?" · personalizada":""}</option>)}
        </select>
      </label>
      {selected?editor(selected):<div style={{marginTop:8,padding:"9px 10px",border:"1px dashed var(--line)",borderRadius:9,color:"var(--muted)",fontSize:9.5}}>Seleccioná una habitación para ver y modificar sus noches.</div>}
    </div>:null}
  </div>
}
