"use client"

import{useEffect}from"react"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const roomCapacity=room=>Math.max(1,Number(room?.capacidad)||1)
const idsOf=rooms=>(rooms||[]).map(room=>String(room.id))
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0))

function defaultBeds(room,guests){
  const type=String(room?.tipo||"").toLowerCase(),capacity=roomCapacity(room),g=clamp(guests,1,capacity)
  if(type.includes("twin")||type.includes("individual")||type.includes("single"))return{matrimonial:0,individual:g}
  if(g===1)return{matrimonial:0,individual:1}
  return{matrimonial:1,individual:Math.max(0,g-2)}
}
function makeAssignment(room,guests){const beds=defaultBeds(room,guests);return{soldAs:room?.tipo||"Sin tipo",guests:clamp(guests,1,roomCapacity(room)),matrimonial:beds.matrimonial,individual:beds.individual,rate:Number(room?.precio)||0}}

export function legacyBedTypeFromRooming(rooming){
  const m=Math.max(0,Number(rooming?.matrimonial)||0),i=Math.max(0,Number(rooming?.individual)||0)
  if(m===1&&i===0)return"matrimonial"
  if(m===0&&i===1)return"individual"
  if(m===0&&i===2)return"twin"
  if(m===1&&i===1)return"matrimonial_twin"
  if(m===0&&i===3)return"triple_twin"
  return null
}
export function bedLabel(value){const labels={matrimonial:"1 cama matrimonial",individual:"1 cama individual",twin:"2 camas individuales / twin",matrimonial_twin:"1 matrimonial + 1 individual",triple_twin:"3 camas individuales / twin"};return labels[String(value||"")]||"Sin preferencia"}
export function reservationRoomingRows(item,assignedRooms=[]){
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
  const byId=new Map((assignedRooms||[]).map(room=>[String(room.id),room]))
  const rows=details.filter(Boolean).map((detail,index)=>{const room=byId.get(String(detail.habitacion_id||""));const rooming=detail.rooming&&typeof detail.rooming==="object"?detail.rooming:{};return{key:String(detail.habitacion_id||index),roomId:detail.habitacion_id||room?.id||null,name:detail.nombre||room?.nombre||`Habitación ${index+1}`,soldAs:detail.vendida_como||detail.tipo||room?.tipo||"Habitación",guests:Math.max(1,Number(detail.huespedes)||1),matrimonial:Math.max(0,Number(rooming.matrimonial)||0),individual:Math.max(0,Number(rooming.individual)||0),rate:Number(detail.tarifa_noche)||Number(room?.precio)||0,configured:rooming.matrimonial!=null||rooming.individual!=null}})
  if(rows.some(row=>row.configured))return rows
  const legacy=item?.tipo_cama
  if(!legacy)return rows
  const mapped={matrimonial:{matrimonial:1,individual:0},individual:{matrimonial:0,individual:1},twin:{matrimonial:0,individual:2},matrimonial_twin:{matrimonial:1,individual:1},triple_twin:{matrimonial:0,individual:3}}[String(legacy)]||{matrimonial:0,individual:0}
  const room=assignedRooms?.[0]
  return[{key:String(item?.habitacion_id||"legacy"),roomId:item?.habitacion_id||room?.id||null,name:room?.nombre||"Habitación",soldAs:room?.tipo||"Habitación",guests:Math.max(1,Number(item?.cantidad_huespedes)||1),matrimonial:mapped.matrimonial,individual:mapped.individual,rate:Number(item?.tarifa_noche)||Number(room?.precio)||0,configured:true}]
}
export function reservationRoomingSummary(item,assignedRooms=[]){
  const rows=reservationRoomingRows(item,assignedRooms)
  const configured=rows.filter(row=>row.configured&&(row.matrimonial>0||row.individual>0))
  if(!configured.length)return bedLabel(item?.tipo_cama)
  if(configured.length>1)return`${configured.length} habitaciones configuradas`
  const row=configured[0],parts=[]
  if(row.matrimonial)parts.push(`${row.matrimonial} matrimonial${row.matrimonial===1?"":"es"}`)
  if(row.individual)parts.push(`${row.individual} individual${row.individual===1?"":"es"}`)
  return parts.join(" + ")||"Sin preferencia"
}

function DoubleBedIcon(){return <svg viewBox="0 0 24 18" width="21" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 15.5v-10M21.5 15.5v-8.4a2.1 2.1 0 0 0-2.1-2.1H4.6a2.1 2.1 0 0 0-2.1 2.1"/><path d="M2.5 9.2h19M5 6.8h5M14 6.8h5M2.5 15.5h19"/></svg>}
function SingleBedIcon(){return <svg viewBox="0 0 18 18" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 15.5v-10M15.5 15.5V8a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2"/><path d="M2.5 9.5h13M5 7.2h4M2.5 15.5h13"/></svg>}

export default function RoomingEditor({draft,setDraft,rooms=[],currency="ARS"}){
  const selectedKey=idsOf(rooms).join("|")
  useEffect(()=>{
    if(!rooms.length)return
    setDraft(current=>{
      if(!current)return current
      const ids=idsOf(rooms),existing=current.roomAssignments||{},next={}
      let remaining=Math.max(ids.length,Number(current.guests)||ids.length),changed=Object.keys(existing).some(id=>!ids.includes(id))
      rooms.forEach((room,index)=>{
        const id=String(room.id),previous=existing[id]
        if(previous){next[id]={soldAs:previous.soldAs||room.tipo||"Sin tipo",guests:clamp(previous.guests,1,roomCapacity(room)),matrimonial:Math.max(0,Number(previous.matrimonial)||0),individual:Math.max(0,Number(previous.individual)||0),rate:Number(previous.rate??room.precio)||0};remaining-=next[id].guests}
        else{const roomsLeft=rooms.length-index,guests=clamp(Math.max(1,remaining-(roomsLeft-1)),1,roomCapacity(room));next[id]=makeAssignment(room,guests);remaining-=guests;changed=true}
      })
      const totalGuests=Object.values(next).reduce((sum,item)=>sum+Math.max(1,Number(item.guests)||1),0),totalRate=Object.values(next).reduce((sum,item)=>sum+(Number(item.rate)||0),0)
      if(!changed&&Number(current.guests)===totalGuests&&Number(current.rate)===totalRate&&ids.every(id=>existing[id]))return current
      return{...current,roomAssignments:next,guests:totalGuests,rate:totalRate}
    })
  },[selectedKey,setDraft])

  function update(room,patch){
    const id=String(room.id)
    setDraft(current=>{
      const assignments={...(current.roomAssignments||{})},base=assignments[id]||makeAssignment(room,1),next={...base,...patch}
      next.guests=clamp(next.guests,1,roomCapacity(room));next.matrimonial=clamp(next.matrimonial,0,roomCapacity(room));next.individual=clamp(next.individual,0,roomCapacity(room));next.rate=Math.max(0,Number(next.rate)||0);assignments[id]=next
      const selected=idsOf(rooms),totalGuests=selected.reduce((sum,key)=>sum+Math.max(1,Number(assignments[key]?.guests)||1),0),totalRate=selected.reduce((sum,key)=>sum+(Number(assignments[key]?.rate)||0),0)
      return{...current,roomAssignments:assignments,guests:totalGuests,rate:totalRate,roomSelectionManual:true}
    })
  }

  if(!rooms.length)return null
  const assignments=draft.roomAssignments||{},totalRate=idsOf(rooms).reduce((sum,id)=>sum+(Number(assignments[id]?.rate)||Number(rooms.find(room=>String(room.id)===id)?.precio)||0),0)
  const shell={marginTop:12,border:"1px solid color-mix(in srgb,var(--line) 78%,transparent)",borderRadius:14,overflow:"hidden",background:"color-mix(in srgb,var(--panelSolid) 86%,transparent)",boxShadow:"inset 0 1px color-mix(in srgb,#fff 48%,transparent),0 10px 26px rgba(28,42,68,.05)"}
  const top={display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"11px 12px",borderBottom:"1px solid var(--line)",background:"color-mix(in srgb,var(--bg) 38%,var(--panelSolid))"}
  const row={padding:"10px 12px",borderBottom:"1px solid color-mix(in srgb,var(--line) 82%,transparent)"}
  const grid={display:"grid",gridTemplateColumns:"minmax(120px,1.05fr) minmax(78px,.6fr) minmax(175px,1.2fr) minmax(96px,.7fr) minmax(110px,.75fr)",gap:9,alignItems:"end"}
  const control={height:36,width:"100%",border:"1px solid var(--line)",borderRadius:10,background:"color-mix(in srgb,var(--panelSolid) 88%,transparent)",color:"var(--text)",padding:"0 10px",font:"inherit",fontSize:11,fontWeight:760,outline:"none"}
  const tinyLabel={display:"block",marginBottom:5,fontSize:9,fontWeight:850,letterSpacing:".03em",color:"var(--muted)"}
  return <section style={shell} aria-label="Rooming por habitación">
    <header style={top}><div><small style={{display:"block",fontSize:9,fontWeight:900,letterSpacing:".1em",color:"var(--accent)"}}>HABITACIONES SELECCIONADAS</small><b style={{display:"block",marginTop:2,fontSize:12}}>Rooming y detalles por habitación</b></div><span style={{fontSize:10,color:"var(--muted)"}}>{rooms.length} habitación{rooms.length===1?"":"es"}</span></header>
    {rooms.map(room=>{const id=String(room.id),assignment=assignments[id]||makeAssignment(room,Math.min(Number(draft.guests)||1,roomCapacity(room))),options=Array.from({length:roomCapacity(room)},(_,index)=>index+1),bedOptions=Array.from({length:roomCapacity(room)+1},(_,index)=>index);return <article key={id} style={row}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}><span style={{width:20,height:20,display:"grid",placeItems:"center",borderRadius:6,border:"1px solid color-mix(in srgb,#2f8e58 38%,var(--line))",background:"color-mix(in srgb,#36a269 12%,transparent)",color:"#268357",fontSize:11,fontWeight:950}}>✓</span><b style={{fontSize:12}}>Hab. {room.nombre}</b><small style={{color:"var(--muted)",fontSize:9.5}}>{room.tipo||"Sin tipo"}</small></div>
      <div style={grid}>
        <label><span style={tinyLabel}>Vendida como</span><select value={assignment.soldAs||room.tipo||"Sin tipo"} onChange={event=>update(room,{soldAs:event.target.value})} style={control}><option value={room.tipo||"Sin tipo"}>{room.tipo||"Sin tipo"}</option></select></label>
        <label><span style={tinyLabel}>Huéspedes</span><select value={assignment.guests} onChange={event=>update(room,{guests:Number(event.target.value)})} style={control}>{options.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <div><span style={tinyLabel}>Rooming</span><div style={{height:36,display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><label title="Cama matrimonial" style={{display:"flex",alignItems:"center",gap:5,padding:"0 6px",border:"1px solid var(--line)",borderRadius:10,background:"color-mix(in srgb,var(--panelSolid) 88%,transparent)",color:"var(--accent)"}}><DoubleBedIcon/><select aria-label={`Camas matrimoniales en habitación ${room.nombre}`} value={assignment.matrimonial} onChange={event=>update(room,{matrimonial:Number(event.target.value)})} style={{flex:1,minWidth:0,border:0,background:"transparent",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:850,outline:"none"}}>{bedOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label><label title="Cama individual / twin" style={{display:"flex",alignItems:"center",gap:5,padding:"0 6px",border:"1px solid var(--line)",borderRadius:10,background:"color-mix(in srgb,var(--panelSolid) 88%,transparent)",color:"#7b65d8"}}><SingleBedIcon/><select aria-label={`Camas individuales en habitación ${room.nombre}`} value={assignment.individual} onChange={event=>update(room,{individual:Number(event.target.value)})} style={{flex:1,minWidth:0,border:0,background:"transparent",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:850,outline:"none"}}>{bedOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label></div></div>
        <div><span style={tinyLabel}>Estado</span><div style={{...control,height:36,display:"grid",alignContent:"center",gap:1,padding:"3px 9px"}}><span style={{display:"flex",alignItems:"center",gap:5,fontSize:10,fontWeight:850}}><i style={{width:8,height:8,borderRadius:"50%",background:"#3cac6b",boxShadow:"0 0 0 3px color-mix(in srgb,#3cac6b 12%,transparent)"}}/>Disponible</span><small style={{fontSize:8.5,color:"var(--muted)"}}>Instancia: libre</small></div></div>
        <label><span style={tinyLabel}>Tarifa</span><input type="number" min="0" value={assignment.rate} onChange={event=>update(room,{rate:Number(event.target.value)||0})} style={control}/></label>
      </div>
    </article>})}
    <footer style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:14,padding:"11px 12px",background:"color-mix(in srgb,var(--bg) 34%,var(--panelSolid))"}}><span style={{fontSize:10,fontWeight:850,color:"var(--muted)"}}>Ingresos totales por noche · {currency}</span><b style={{minWidth:110,padding:"8px 11px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",fontSize:12,textAlign:"right"}}>{money(totalRate,currency)}</b></footer>
    <style>{`@media(max-width:760px){[aria-label="Rooming por habitación"] article>div:last-child{grid-template-columns:1fr 1fr!important}[aria-label="Rooming por habitación"] article>div:last-child>div:nth-child(3){grid-column:1/-1}}`}</style>
  </section>
}
