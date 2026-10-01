"use client"

import{useState}from"react"
import{activeRatePlans,defaultRatePlan,ratePlanBasis,ratePlanByCode}from"../../core/ratePlans"
import{finalPriceFromNet}from"../../core/priceTax"
import{editStayDateKeys,effectiveEditRoomRate}from"./reservationRoomPricingEdit"

const money=(value,currency)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const labelDate=value=>{const[,m,d]=String(value).split("-");return d+"/"+m}
const nextDay=value=>{const d=new Date(String(value)+"T12:00:00");d.setDate(d.getDate()+1);return d.toISOString().slice(0,10)}
const nightlyConfig=(value,guests,planCode)=>value&&typeof value==="object"?{guests:Math.max(1,Number(value.guests)||guests),ratePlanCode:String(value.ratePlanCode||value.rate_plan_code||planCode||"")}:{guests:Math.max(1,Number(value)||guests),ratePlanCode:String(planCode||"")}

export default function ReservationRoomOccupancyEditor({item,draft,setDraft,rooms=[],ratePlans,taxConfig,defaultRatePlanCode,currency="ARS"}){
  const[selectedRoomId,setSelectedRoomId]=useState(""),[groupOpen,setGroupOpen]=useState(false)
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[],plans=activeRatePlans(ratePlans)
  function roomInfo(room){
    const id=String(room.id),detail=details.find(value=>String(value?.habitacion_id)===id)||{},assignment=draft?.roomAssignments?.[id]||{},dates=editStayDateKeys(detail,item)
    const selected=ratePlanByCode(ratePlans,assignment.ratePlanCode||detail.rate_plan_code||defaultRatePlanCode),plan=selected?.active?selected:defaultRatePlan(ratePlans)
    return{id,room,detail,assignment,dates,plan,custom:draft?.occupancyByRoom?.[id]||null,baseGuests:Math.max(1,Number(assignment.guests)||1),capacity:Math.max(1,Number(room.capacidad)||1)}
  }
  const eligible=rooms.map(roomInfo).filter(info=>info.dates.length>=2),isGroup=rooms.length>1
  if(!eligible.length)return null

  function seed(info,current){
    const existing=current.occupancyByRoom?.[info.id]
    if(existing)return{...existing}
    const stored=new Map((Array.isArray(info.detail?.occupancy_nights)?info.detail.occupancy_nights:[]).map(n=>[String(n?.date||"").slice(0,10),n]))
    return Object.fromEntries(info.dates.map(date=>{const n=stored.get(date);return[date,{guests:Math.max(1,Number(n?.guests)||info.baseGuests),ratePlanCode:String(n?.rate_plan_code||info.assignment.ratePlanCode||info.detail.rate_plan_code||info.plan.code)}]}))
  }
  function applyNight(info,date,patch){
    setDraft(current=>{
      const nextMap=seed(info,current),base=nightlyConfig(nextMap[date],info.baseGuests,info.plan.code);nextMap[date]={...base,...patch}
      const maxGuests=Math.max(...Object.values(nextMap).map(value=>nightlyConfig(value,info.baseGuests,info.plan.code).guests))
      const assignments={...(current.roomAssignments||{}),[info.id]:{...(current.roomAssignments?.[info.id]||{}),guests:maxGuests}}
      const ids=current.roomIds?.length?current.roomIds:[current.roomId],total=ids.reduce((sum,key)=>sum+Math.max(1,Number(assignments?.[String(key)]?.guests)||1),0)
      return{...current,guests:total,roomAssignments:assignments,occupancyByRoom:{...(current.occupancyByRoom||{}),[info.id]:nextMap}}
    })
  }
  function clear(id){setDraft(current=>{const next={...(current.occupancyByRoom||{})};delete next[id];return{...current,occupancyByRoom:next}})}

  function editor(info,{showHeading=true}={}){
    return <div style={{marginTop:9,padding:"10px 11px",border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--panelSolid) 92%,var(--bg))"}}>
      {showHeading?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <div><b style={{fontSize:11}}>Hab. {info.room.nombre} · régimen por noche</b><div style={{marginTop:2,fontSize:9.5,color:"var(--muted)"}}>{info.custom?"Personalización activa · cada noche conserva su propio plan y ocupación.":"Elegí plan tarifario y huéspedes para cada noche."}</div></div>
        {info.custom?<button type="button" onClick={()=>clear(info.id)} style={{height:32,padding:"0 10px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panel)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:800,cursor:"pointer"}}>Quitar personalización</button>:null}
      </div>:null}
      <div style={{display:"grid",gap:6,marginTop:showHeading?9:0}}>{info.dates.map(date=>{
        const config=nightlyConfig(info.custom?.[date],info.baseGuests,info.assignment.ratePlanCode||info.plan.code),selected=ratePlanByCode(ratePlans,config.ratePlanCode),nightPlan=selected?.active?selected:info.plan
        const net=effectiveEditRoomRate({assignment:{...info.assignment,guests:config.guests,ratePlanCode:nightPlan.code},room:info.room,ratePlans,taxes:taxConfig,defaultCode:defaultRatePlanCode,detail:info.detail,date}),final=finalPriceFromNet(net,taxConfig),perPerson=ratePlanBasis(nightPlan)==="per_person"
        return <div key={date} style={{display:"grid",gridTemplateColumns:"112px minmax(180px,1fr) 108px 118px",gap:8,alignItems:"center",padding:"7px 8px",border:"1px solid color-mix(in srgb,var(--line) 75%,transparent)",borderRadius:9}}>
          <span style={{fontSize:10,fontWeight:800}}>{labelDate(date)} → {labelDate(nextDay(date))}</span>
          <label style={{display:"grid",gap:3}}><small style={{fontSize:8.3,color:"var(--muted)",fontWeight:800}}>Plan de régimen</small><select value={nightPlan.code} onChange={event=>applyNight(info,date,{ratePlanCode:event.target.value})} style={{height:34,width:"100%",border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:800,padding:"0 8px"}}>{plans.map(plan=><option key={plan.code} value={plan.code}>{plan.name}</option>)}</select></label>
          <label style={{display:"grid",gap:3}}><small style={{fontSize:8.3,color:"var(--muted)",fontWeight:800}}>Huéspedes</small><select value={config.guests} onChange={event=>applyNight(info,date,{guests:Math.max(1,Number(event.target.value)||1)})} style={{height:34,width:"100%",border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:800,padding:"0 8px"}}>{Array.from({length:info.capacity},(_,index)=>index+1).map(value=><option key={value} value={value}>{value} huésped{value===1?"":"es"}</option>)}</select></label>
          <b style={{fontSize:10.5,textAlign:"right"}}>{money(final,currency)}<small style={{display:"block",fontSize:8.3,color:"var(--muted)",fontWeight:700}}>{perPerson?"según huéspedes":"por habitación"} · esa noche</small></b>
        </div>
      })}</div>
    </div>
  }

  if(!isGroup){
    const info=eligible[0]
    return <div style={{marginTop:9}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 11px",border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--panelSolid) 92%,var(--bg))"}}>
        <div><b style={{fontSize:11}}>Personalizar régimen por noche</b><div style={{marginTop:2,fontSize:9.5,color:"var(--muted)"}}>Definí plan tarifario y huéspedes de cada noche de la Hab. {info.room.nombre}.</div></div>
        <button type="button" onClick={()=>setGroupOpen(value=>!value)} style={{height:32,padding:"0 10px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panel)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:800,cursor:"pointer"}}>{groupOpen?"Cerrar":"Personalizar régimen por noche"}</button>
      </div>
      {groupOpen?editor(info):null}
    </div>
  }

  const configured=eligible.filter(info=>info.custom).map(info=>"Hab. "+info.room.nombre),selected=eligible.find(info=>info.id===selectedRoomId)||null
  return <div style={{marginTop:9,padding:"10px 11px",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:11,background:"color-mix(in srgb,var(--accent) 3%,var(--panelSolid))"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <div><b style={{fontSize:11}}>Personalizar régimen por noche</b><div style={{marginTop:2,fontSize:9.5,color:"var(--muted)"}}>Elegí la habitación y después definí plan + huéspedes en cada noche.{configured.length?" Personalizadas: "+configured.join(", ")+".":""}</div></div>
      <button type="button" onClick={()=>{setGroupOpen(value=>!value);if(groupOpen)setSelectedRoomId("")}} style={{height:32,padding:"0 10px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panel)",color:"var(--text)",font:"inherit",fontSize:10,fontWeight:800,cursor:"pointer"}}>{groupOpen?"Cerrar":"Personalizar régimen por noche"}</button>
    </div>
    {groupOpen?<div style={{marginTop:9}}>
      <label style={{display:"grid",gap:4,fontSize:9.5,fontWeight:800,color:"var(--muted)"}}>Habitación
        <select value={selectedRoomId} onChange={event=>setSelectedRoomId(event.target.value)} style={{height:36,width:"100%",border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10.5,fontWeight:800,padding:"0 10px"}}>
          <option value="">Elegí una habitación…</option>
          {eligible.map(info=><option key={info.id} value={info.id}>Hab. {info.room.nombre} · {info.plan?.name||"Plan tarifario"} · {info.dates.length} noches{info.custom?" · personalizada":""}</option>)}
        </select>
      </label>
      {selected?editor(selected):<div style={{marginTop:8,padding:"9px 10px",border:"1px dashed var(--line)",borderRadius:9,color:"var(--muted)",fontSize:9.5}}>Seleccioná una habitación para modificar plan y huéspedes de sus noches.</div>}
    </div>:null}
  </div>
}
