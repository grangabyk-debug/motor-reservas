"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{normalizeTaxSettings}from"../../core/priceTax"
import{activeRatePlans,defaultRatePlan,normalizeRatePlans,ratePlanAmounts,ratePlanByCode}from"../../core/ratePlans"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const roomCapacity=room=>Math.max(1,Number(room?.capacidad)||1)
const idsOf=rooms=>(rooms||[]).map(room=>String(room.id))
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0))
const clean=value=>String(value||"").trim()
const normalize=value=>clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()

function configuredBeds(room){
  const capacity=roomCapacity(room),text=normalize(room?.bed_configuration)
  if(!text)return null
  const sumMatches=regex=>{let total=0;for(const match of text.matchAll(regex))total+=Math.max(0,Number(match[1])||0);return total}
  let matrimonial=sumMatches(/(\d+)\s*(?:camas?\s*)?(?:matrimoniales?|dobles?|queens?|kings?)/g)
  let individual=sumMatches(/(\d+)\s*(?:camas?\s*)?(?:individual(?:es)?|twins?|singles?)/g)
  const hasMatrimonial=/(?:matrimonial|doble|queen|king)/.test(text),hasIndividual=/(?:individual|twin|single)/.test(text)
  if(!matrimonial&&!individual){
    if(hasIndividual&&!hasMatrimonial)individual=capacity
    else if(hasMatrimonial&&!hasIndividual)matrimonial=Math.min(1,Math.floor(capacity/2))
    else if(hasMatrimonial&&hasIndividual){matrimonial=Math.min(1,Math.floor(capacity/2));individual=Math.max(0,capacity-matrimonial*2)}
  }
  matrimonial=clamp(matrimonial,0,Math.floor(capacity/2));individual=clamp(individual,0,capacity-matrimonial*2)
  return matrimonial||individual?{matrimonial,individual}:null
}
function defaultBeds(room,guests){
  const capacity=roomCapacity(room),g=clamp(guests,0,capacity)
  if(g===0)return{matrimonial:0,individual:0}
  const configured=configuredBeds(room)
  if(configured){
    let{matrimonial,individual}=configured
    const occupied=matrimonial*2+individual
    if(occupied<g)individual=Math.min(capacity-matrimonial*2,individual+(g-occupied))
    return{matrimonial,individual}
  }
  if(capacity<2)return{matrimonial:0,individual:1}
  if(g===1)return{matrimonial:1,individual:0}
  const matrimonial=Math.min(Math.floor(g/2),Math.floor(capacity/2))
  return{matrimonial,individual:Math.max(0,g-matrimonial*2)}
}
function fitBeds(room,guests,matrimonial,individual,changed=""){
  const capacity=roomCapacity(room),g=clamp(guests,0,capacity)
  let m=clamp(matrimonial,0,Math.floor(capacity/2)),i=clamp(individual,0,capacity)
  if(changed==="individual")m=clamp(m,0,Math.floor((capacity-i)/2))
  else if(changed==="matrimonial")i=clamp(i,0,capacity-m*2)
  else i=clamp(i,0,capacity-m*2)
  if(g>0&&m*2+i<g){
    if(changed==="matrimonial")i=Math.min(capacity-m*2,Math.max(i,g-m*2))
    else if(changed==="individual"){
      m=Math.min(Math.floor((capacity-i)/2),Math.max(m,Math.ceil(Math.max(0,g-i)/2)))
      if(m*2+i<g)i=Math.min(capacity-m*2,Math.max(i,g-m*2))
    }else i=Math.min(capacity-m*2,Math.max(i,g-m*2))
  }
  if(g>0&&m*2+i<g)return defaultBeds(room,g)
  return{matrimonial:m,individual:i}
}
function makeAssignment(room,guests){const safeGuests=clamp(guests,1,roomCapacity(room)),beds=defaultBeds(room,safeGuests);return{soldAs:clean(room?.tipo)||"Habitación",guests:safeGuests,matrimonial:beds.matrimonial,individual:beds.individual,rate:Number(room?.pricing_net??room?.precio)||0,manualRate:false}}
function distributedGuests(rooms,total){
  const result=new Map(),capacities=new Map(rooms.map(room=>[String(room.id),roomCapacity(room)])),remaining={value:Math.max(0,Number(total)||0)}
  rooms.forEach(room=>result.set(String(room.id),0))
  for(const room of rooms){if(remaining.value<=0)break;const id=String(room.id);if(capacities.get(id)>0){result.set(id,1);remaining.value--}}
  while(remaining.value>0){let moved=false;for(const room of rooms){if(remaining.value<=0)break;const id=String(room.id),current=result.get(id)||0,space=(capacities.get(id)||0)-current;if(space>0){result.set(id,current+1);remaining.value--;moved=true}}if(!moved)break}
  return result
}

export function roomingLabel(rooming){
  const m=Math.max(0,Number(rooming?.matrimonial)||0),i=Math.max(0,Number(rooming?.individual)||0),parts=[]
  if(m)parts.push(`${m} matrimonial${m===1?"":"es"}`)
  if(i)parts.push(`${i} individual${i===1?"":"es"}`)
  return parts.join(" + ")||"Sin configurar"
}
export function reservationRoomingRows(item,assignedRooms=[]){
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
  const byId=new Map((assignedRooms||[]).map(room=>[String(room.id),room]))
  const taxEnabled=Boolean(item?.impuestos_desglosados),storedNet=Math.max(0,Number(item?.precio_sin_impuestos_nacionales)||Number(item?.subtotal)||0),storedVat=Math.max(0,Number(item?.iva_importe)||0),vatRate=taxEnabled?Math.max(0,Number(item?.iva_porcentaje)||(storedNet>0?storedVat/storedNet*100:0)):0,rateFactor=1+vatRate/100
  return details.filter(Boolean).map((detail,index)=>{
    const room=byId.get(String(detail.habitacion_id||"")),rooming=detail.rooming&&typeof detail.rooming==="object"?detail.rooming:{},netRate=Number(detail.tarifa_noche)||Number(room?.precio)||0
    return{key:String(detail.habitacion_id||index),roomId:detail.habitacion_id||room?.id||null,name:detail.nombre||room?.nombre||`Habitación ${index+1}`,physicalCategory:detail.categoria_asignada||room?.tipo||"Habitación",soldAs:detail.categoria_vendida||"Habitación",start:String(detail.fecha_entrada||item?.fecha_entrada||"").slice(0,10),end:String(detail.fecha_salida||item?.fecha_salida||"").slice(0,10),guests:Math.max(0,Number(detail.huespedes)||0),matrimonial:Math.max(0,Number(rooming.matrimonial)||0),individual:Math.max(0,Number(rooming.individual)||0),rate:Math.round(netRate*rateFactor*100)/100,configured:rooming.matrimonial!=null||rooming.individual!=null}
  })
}
export function reservationRoomingSummary(item,assignedRooms=[]){
  const rows=reservationRoomingRows(item,assignedRooms),configured=rows.filter(row=>row.configured&&(row.matrimonial>0||row.individual>0))
  if(!configured.length)return"Sin configurar"
  if(configured.length>1)return`${configured.length} habitaciones configuradas`
  return roomingLabel(configured[0])
}

export default function RoomingEditor({draft,setDraft,rooms=[],categories=[],currency="ARS",editableRate=true,ratePlans=null,defaultRatePlanCode="",allowRatePlanOverride=false,taxConfig=null,variableRateLabels={},onGuestsChange=null}){
  const selectedKey=idsOf(rooms).join("|"),planConfig=normalizeRatePlans(ratePlans||{}),plans=activeRatePlans(planConfig),defaultPlanCode=defaultRatePlanCode||defaultRatePlan(planConfig).code,showPlan=Boolean(allowRatePlanOverride&&plans.length>1)
  const[bedConfigById,setBedConfigById]=useState({}),[bedConfigReady,setBedConfigReady]=useState(false)
  useEffect(()=>{
    const ids=idsOf(rooms).map(Number).filter(Number.isFinite)
    if(!ids.length){setBedConfigById({});setBedConfigReady(true);return}
    const allInline=rooms.every(room=>Object.prototype.hasOwnProperty.call(room,"bed_configuration"))
    if(allInline){setBedConfigById(Object.fromEntries(rooms.map(room=>[String(room.id),room.bed_configuration||""])));setBedConfigReady(true);return}
    let cancelled=false;setBedConfigReady(false)
    ;(async()=>{const{data,error}=await supabase.from("habitaciones").select("id,bed_configuration").in("id",ids);if(error)throw error;if(!cancelled){setBedConfigById(Object.fromEntries((data||[]).map(row=>[String(row.id),row.bed_configuration||""])));setBedConfigReady(true)}})().catch(()=>{if(!cancelled){setBedConfigById({});setBedConfigReady(true)}})
    return()=>{cancelled=true}
  },[selectedKey])
  const effectiveRooms=useMemo(()=>rooms.map(room=>({...room,bed_configuration:Object.prototype.hasOwnProperty.call(room,"bed_configuration")?room.bed_configuration:bedConfigById[String(room.id)]||""})),[rooms,bedConfigById])
  const bedConfigKey=effectiveRooms.map(room=>`${room.id}:${room.bed_configuration||""}`).join("|")
  const categoryOptions=[...new Set([...(categories||[]).map(clean),...effectiveRooms.map(room=>clean(room.tipo))].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"))
  const taxes=normalizeTaxSettings(taxConfig||{enabled:draft?.impuestosDesglosados!==false,vat_rate:Math.max(0,Number(draft?.ivaPorcentaje)||0),price_tax_mode:draft?.priceTaxMode||"tax_included"}),vatRate=taxes.enabled?Math.max(0,Number(taxes.vat_rate)||0):0,rateFactor=taxes.enabled?1+vatRate/100:1,displayRate=value=>Math.round((Number(value)||0)*rateFactor*100)/100,netRate=value=>Math.round(((Number(value)||0)/rateFactor)*100)/100
  useEffect(()=>{
    if(!effectiveRooms.length||!bedConfigReady)return
    setDraft(current=>{
      if(!current)return current
      const ids=idsOf(effectiveRooms),existing=current.roomAssignments||{},requested=Math.max(effectiveRooms.length,Number(current.guests)||1)
      const hasValidDistribution=ids.every(id=>{const room=effectiveRooms.find(item=>String(item.id)===id),guests=Number(existing[id]?.guests);return Boolean(existing[id])&&guests>=1&&guests<=roomCapacity(room)})&&ids.reduce((sum,id)=>sum+Math.max(0,Number(existing[id]?.guests)||0),0)===requested
      const distribution=hasValidDistribution?new Map(ids.map(id=>[id,Math.max(1,Number(existing[id]?.guests)||1)])):distributedGuests(effectiveRooms,requested),next={}
      effectiveRooms.forEach(room=>{
        const id=String(room.id),desired=Math.max(1,distribution.get(id)||1),previous=existing[id]
        if(previous){
          const guestChanged=Number(previous.guests||0)!==desired,beds=guestChanged?defaultBeds(room,desired):fitBeds(room,desired,previous.matrimonial,previous.individual)
          next[id]={soldAs:clean(previous.soldAs)||clean(room.tipo)||"Habitación",guests:desired,matrimonial:beds.matrimonial,individual:beds.individual,rate:Number(previous.rate??room.pricing_net??room.precio)||0,manualRate:Boolean(previous.manualRate),ratePlanCode:previous.ratePlanCode||current.ratePlanCode||defaultPlanCode}
        }else next[id]={...makeAssignment(room,desired),ratePlanCode:current.ratePlanCode||defaultPlanCode}
      })
      const totalRate=ids.reduce((sum,id)=>sum+(Number(next[id].rate)||0),0)
      const sameKeys=Object.keys(existing).length===ids.length&&ids.every(id=>existing[id])
      const sameAssignments=sameKeys&&ids.every(id=>{const a=existing[id],b=next[id];return clean(a.soldAs)===clean(b.soldAs)&&Number(a.guests||0)===Number(b.guests||0)&&Number(a.matrimonial||0)===Number(b.matrimonial||0)&&Number(a.individual||0)===Number(b.individual||0)&&Number(a.rate||0)===Number(b.rate||0)&&Boolean(a.manualRate)===Boolean(b.manualRate)&&String(a.ratePlanCode||"")===String(b.ratePlanCode||"")})
      if(sameAssignments&&Number(current.rate||0)===totalRate&&Number(current.guests||0)===requested)return current
      return{...current,guests:requested,roomAssignments:next,rate:totalRate}
    })
  },[selectedKey,bedConfigReady,bedConfigKey,setDraft])

  function update(room,patch){if(Object.prototype.hasOwnProperty.call(patch,"guests"))onGuestsChange?.(String(room.id),Number(patch.guests)||1);
    const id=String(room.id)
    setDraft(current=>{
      const assignments={...(current.roomAssignments||{})},base=assignments[id]||makeAssignment(room,0),next={...base,...patch},capacity=roomCapacity(room)
      next.soldAs=clean(next.soldAs)||clean(room.tipo)||"Habitación";next.guests=clamp(next.guests,1,capacity);next.rate=Math.max(0,Number(next.rate)||0);next.ratePlanCode=next.ratePlanCode||current.ratePlanCode||defaultPlanCode;if(Object.prototype.hasOwnProperty.call(patch,"rate"))next.manualRate=true
      if(Object.prototype.hasOwnProperty.call(patch,"guests")){const beds=defaultBeds(room,next.guests);next.matrimonial=beds.matrimonial;next.individual=beds.individual}
      else{const changed=Object.prototype.hasOwnProperty.call(patch,"matrimonial")?"matrimonial":Object.prototype.hasOwnProperty.call(patch,"individual")?"individual":"",beds=fitBeds(room,next.guests,next.matrimonial,next.individual,changed);next.matrimonial=beds.matrimonial;next.individual=beds.individual}
      assignments[id]=next
      const selected=idsOf(effectiveRooms),totalRate=selected.reduce((sum,key)=>sum+(Number(assignments[key]?.rate)||0),0),totalGuests=selected.reduce((sum,key)=>sum+Math.max(1,Number(assignments[key]?.guests)||1),0)
      const ratePlanCode=selected.length===1&&Object.prototype.hasOwnProperty.call(patch,"ratePlanCode")?next.ratePlanCode:current.ratePlanCode
      return{...current,guests:totalGuests,roomAssignments:assignments,rate:totalRate,ratePlanCode,roomSelectionManual:true}
    })
  }

  if(!effectiveRooms.length)return null
  if(!bedConfigReady)return <div style={{marginTop:12,padding:"11px 12px",border:"1px solid var(--line)",borderRadius:12,color:"var(--muted)",fontSize:10.5,fontWeight:700}}>Cargando configuración física de camas…</div>
  const assignments=draft.roomAssignments||{},selectedIds=idsOf(effectiveRooms),hasVariableRates=selectedIds.some(id=>Boolean(variableRateLabels?.[id])),effectiveRateFor=(room,assignment)=>{const plan=ratePlanByCode(planConfig,assignment?.ratePlanCode||draft.ratePlanCode||defaultPlanCode),baseRate=Number(assignment?.rate??room?.pricing_net??room?.precio)||0,guestCount=Math.max(1,Number(assignment?.guests)||1),planNet=ratePlanAmounts(plan?.active?plan:defaultRatePlan(planConfig),guestCount,taxes,1).netPerNight;return Math.max(0,baseRate+planNet)},totalRate=selectedIds.reduce((sum,id)=>{const room=effectiveRooms.find(item=>String(item.id)===id),assignment=assignments[id]||makeAssignment(room,0);return sum+effectiveRateFor(room,assignment)},0),assignedGuests=selectedIds.reduce((sum,id)=>sum+Math.max(0,Number(assignments[id]?.guests)||0),0),requestedGuests=Math.max(effectiveRooms.length,Number(draft.guests)||1)
  const shell={marginTop:12,border:"1px solid color-mix(in srgb,var(--line) 78%,transparent)",borderRadius:14,overflow:"hidden",background:"color-mix(in srgb,var(--panelSolid) 86%,transparent)",boxShadow:"inset 0 1px color-mix(in srgb,#fff 48%,transparent),0 10px 26px rgba(28,42,68,.05)"}
  const top={display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"11px 12px",borderBottom:"1px solid var(--line)",background:"color-mix(in srgb,var(--bg) 38%,var(--panelSolid))"}
  const row={padding:"10px 12px",borderBottom:"1px solid color-mix(in srgb,var(--line) 82%,transparent)"}
  const controlsTable={width:"100%",tableLayout:"fixed",borderCollapse:"collapse"}
  const cell={width:"33.333%",verticalAlign:"bottom",padding:0}
  const cellGap={paddingRight:10}
  const secondRow={paddingTop:10}
  const field={display:"grid",gridTemplateRows:"14px 40px",gap:5,minWidth:0,width:"100%"}
  const control={display:"block",height:40,width:"100%",minWidth:0,maxWidth:"100%",boxSizing:"border-box",border:"1px solid var(--line)",borderRadius:10,background:"color-mix(in srgb,var(--panelSolid) 88%,transparent)",color:"var(--text)",padding:"0 10px",font:"inherit",fontSize:12,fontWeight:760,outline:"none"}
  const tinyLabel={display:"block",height:14,fontSize:9,fontWeight:850,letterSpacing:".03em",color:"var(--muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}
  return <section style={shell} aria-label="Rooming por habitación">
    <header style={top}><div><small style={{display:"block",fontSize:9,fontWeight:900,letterSpacing:".1em",color:"var(--accent)"}}>HABITACIONES SELECCIONADAS</small><b style={{display:"block",marginTop:2,fontSize:12}}>Rooming y categoría vendida por habitación</b></div><span style={{fontSize:10,color:assignedGuests===requestedGuests?"var(--muted)":"var(--red)",fontWeight:assignedGuests===requestedGuests?600:850}}>{effectiveRooms.length} habitación{effectiveRooms.length===1?"":"es"} · {assignedGuests}/{requestedGuests} huéspedes</span></header>
    {effectiveRooms.map(room=>{const id=String(room.id),assignment=assignments[id]||makeAssignment(room,0),capacity=roomCapacity(room),options=Array.from({length:capacity},(_,index)=>index+1),matOptions=Array.from({length:Math.floor(capacity/2)+1},(_,index)=>index),indOptions=Array.from({length:capacity+1},(_,index)=>index),physical=clean(room.tipo)||"Habitación",sold=clean(assignment.soldAs)||physical,different=sold!==physical,effectiveNetRate=effectiveRateFor(room,assignment),selectedPlan=ratePlanByCode(planConfig,assignment.ratePlanCode||draft.ratePlanCode||defaultPlanCode),planNet=ratePlanAmounts(selectedPlan?.active?selectedPlan:defaultRatePlan(planConfig),assignment.guests,taxes,1).netPerNight;return <article key={id} style={row}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9,flexWrap:"wrap"}}><span style={{width:20,height:20,display:"grid",placeItems:"center",borderRadius:6,border:"1px solid color-mix(in srgb,#2f8e58 38%,var(--line))",background:"color-mix(in srgb,#36a269 12%,transparent)",color:"#268357",fontSize:11,fontWeight:950}}>✓</span><b style={{fontSize:12}}>Hab. {room.nombre}</b>{room.bed_configuration?<span style={{fontSize:9.5,color:"var(--muted)",fontWeight:700}}>· Configuración: {room.bed_configuration}</span>:null}{different?<span style={{marginLeft:"auto",padding:"4px 7px",borderRadius:999,background:"color-mix(in srgb,var(--accent) 11%,transparent)",color:"var(--accent)",fontSize:9,fontWeight:850}}>Vendida como {sold}</span>:null}</div>
      <table role="presentation" style={controlsTable}><tbody>
        <tr>
          <td style={{...cell,...cellGap}}><label style={field}><span style={tinyLabel}>Vendida como</span><select value={sold} title={sold} onChange={event=>update(room,{soldAs:event.target.value})} style={control}>{categoryOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label></td>
          <td style={{...cell,...cellGap}}>{showPlan?<label style={field}><span style={tinyLabel}>Plan tarifario</span><select value={assignment.ratePlanCode||draft.ratePlanCode||defaultPlanCode} title={selectedPlan?.name||""} onChange={event=>update(room,{ratePlanCode:event.target.value})} style={control}>{plans.map(plan=><option key={plan.code} value={plan.code}>{plan.name}</option>)}</select></label>:<label style={{...field,visibility:"hidden"}} aria-hidden="true"><span style={tinyLabel}>Plan tarifario</span><span style={control}/></label>}</td>
          <td style={cell}><label style={field}><span style={{...tinyLabel,color:"var(--accent)"}}>Huéspedes</span><select value={assignment.guests} onChange={event=>update(room,{guests:Number(event.target.value)})} style={control}>{options.map(value=><option key={value} value={value}>{value}</option>)}</select></label></td>
        </tr>
        <tr>
          <td style={{...cell,...cellGap,...secondRow}}><label style={field}><span style={tinyLabel}>Matrimonial</span><select aria-label={`Camas matrimoniales en habitación ${room.nombre}`} title={`Cama matrimonial · ocupa 2 plazas · capacidad máxima ${capacity}`} value={assignment.matrimonial} onChange={event=>update(room,{matrimonial:Number(event.target.value)})} style={control}>{matOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label></td>
          <td style={{...cell,...cellGap,...secondRow}}><label style={field}><span style={tinyLabel}>Individual / twin</span><select aria-label={`Camas individuales en habitación ${room.nombre}`} title={`Cama individual / twin · ocupa 1 plaza · capacidad máxima ${capacity}`} value={assignment.individual} onChange={event=>update(room,{individual:Number(event.target.value)})} style={control}>{indOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label></td>
          <td style={{...cell,...secondRow}}><label style={field}><span style={tinyLabel}>{variableRateLabels?.[id]?"Tarifa variable":"Tarifa final"}</span>{variableRateLabels?.[id]?<div title="La tarifa cambia según fecha y ocupación. Ver Personalizar régimen por noche." style={{...control,display:"flex",alignItems:"center",fontSize:10.5,color:"var(--accent)",fontWeight:850}}>{variableRateLabels[id]}</div>:<input type="number" min="0" value={displayRate(effectiveNetRate)} disabled={!editableRate} readOnly={!editableRate} onChange={editableRate?event=>update(room,{rate:Math.max(0,netRate(event.target.value)-planNet)}):undefined} title={editableRate?"Precio final por noche, incluyendo el plan tarifario":"La tarifa se modifica con la lógica de cambio de habitación / estadía"} style={{...control,opacity:editableRate?1:.68,cursor:editableRate?"text":"not-allowed"}}/>}</label></td>
        </tr>
      </tbody></table>
    </article>})}
    <footer style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:14,padding:"11px 12px",background:"color-mix(in srgb,var(--bg) 34%,var(--panelSolid))"}}><span style={{fontSize:10,fontWeight:850,color:"var(--muted)"}}>{hasVariableRates?"Hay tarifas variables por fecha · ver detalle por habitación":`Precio final por noche · ${currency}${taxes.enabled&&vatRate?` · IVA ${vatRate}% ${taxes.price_tax_mode==="tax_included"?"incluido":"agregado"}`:""}`}</span>{!hasVariableRates?<b style={{minWidth:110,padding:"8px 11px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",fontSize:12,textAlign:"right"}}>{money(displayRate(totalRate),currency)}</b>:null}</footer>

  </section>
}
