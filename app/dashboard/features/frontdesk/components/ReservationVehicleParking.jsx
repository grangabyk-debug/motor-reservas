"use client"

import{useEffect,useMemo}from"react"
import{money}from"../../../core/formatters"
import styles from"../reservation-vehicles.module.css"

const parkingLine=item=>item?.resource_category==="parking"||item?.kind==="parking"
const inferType=name=>String(name||"").replace(/^cochera\s*/i,"").trim()
const positive=value=>Math.max(0,Number(value||0))
const makeKey=index=>`vehicle-${Date.now()}-${index}-${Math.random().toString(36).slice(2,7)}`

export default function ReservationVehicleParking({draft,set,parkingResources=[],occupancy,currency="ARS"}){
  const defaultDays=Math.max(1,Number(occupancy?.billingUnits||1))
  const details=useMemo(()=>{
    if(Array.isArray(draft.vehicleDetails)&&draft.vehicleDetails.length)return draft.vehicleDetails
    const lines=(draft.extras||[]).filter(parkingLine),legacyCount=Math.max(0,Number(draft.vehicles||0)),count=Math.max(lines.length,legacyCount)
    if(!count)return[]
    return Array.from({length:count},(_,index)=>{
      const line=lines[index]||{},resource=parkingResources.find(item=>String(item.id)===String(line.resource_id||"")),quantity=positive(line.quantity||defaultDays)||defaultDays,unit=Number(line.unit_price??(quantity?Number(line.total||0)/quantity:0)??resource?.price??0)
      return{key:line.vehicle_key||`legacy-${draft.id||"draft"}-${index+1}`,resourceId:String(line.resource_id||""),parkingName:line.name||resource?.name||"",type:line.vehicle_type||(index===0?draft.vehicleType:"")||inferType(resource?.name),plate:line.vehicle_plate||(index===0?draft.vehiclePlate:"")||"",days:quantity,unitPrice:positive(unit),manualDays:Boolean(line.vehicle_manual_days)}
    })
  },[draft.vehicleDetails,draft.extras,draft.vehicles,draft.vehicleType,draft.vehiclePlate,draft.id,parkingResources,defaultDays])

  function persist(next){
    const normalized=next.map((item,index)=>{
      const resource=parkingResources.find(entry=>String(entry.id)===String(item.resourceId||"")),days=positive(item.days),unitPrice=resource?positive(resource.price):positive(item.unitPrice),type=String(item.type||inferType(resource?.name)||"").trim(),plate=String(item.plate||"").trim().toUpperCase()
      return{...item,key:item.key||makeKey(index),resourceId:String(resource?.id||item.resourceId||""),parkingName:resource?.name||item.parkingName||"",type,plate,days,unitPrice,total:days*unitPrice}
    })
    const nonParking=(draft.extras||[]).filter(item=>!parkingLine(item)),parking=normalized.filter(item=>item.resourceId).map((item,index)=>({name:item.parkingName||`Cochera vehículo ${index+1}`,resource_id:item.resourceId,resource_category:"parking",kind:"parking",charge_mode:"per_night",quantity:item.days,unit_price:item.unitPrice,total:item.total,vehicle_index:index+1,vehicle_key:item.key,vehicle_type:item.type||null,vehicle_plate:item.plate||null,vehicle_manual_days:Boolean(item.manualDays)})),total=parking.reduce((sum,item)=>sum+Number(item.total||0),0)
    set("vehicleDetails",normalized)
    set("vehicles",normalized.length)
    set("vehicleType",normalized.map(item=>item.type).filter(Boolean).join(" + "))
    set("vehiclePlate",normalized.map(item=>item.plate).filter(Boolean).join(" + "))
    set("parking",total)
    set("extras",[...nonParking,...parking])
  }

  function changeCount(value){
    const count=Math.max(0,Math.min(10,Number(value||0))),next=details.slice(0,count)
    while(next.length<count)next.push({key:makeKey(next.length),resourceId:"",parkingName:"",type:"",plate:"",days:defaultDays,unitPrice:0,total:0,manualDays:false})
    persist(next)
  }
  function update(index,patch){persist(details.map((item,i)=>i===index?{...item,...patch}:item))}
  function selectParking(index,value){
    const resource=parkingResources.find(item=>String(item.id)===String(value)),current=details[index]
    update(index,{resourceId:value,parkingName:resource?.name||"",unitPrice:positive(resource?.price),type:resource?inferType(resource.name):current.type,total:resource?positive(current.days)*positive(resource.price):0})
  }
  function remove(index){persist(details.filter((_,i)=>i!==index))}

  useEffect(()=>{
    if(!details.length)return
    const needsUpdate=details.some(item=>!item.manualDays&&Number(item.days||0)!==defaultDays)
    if(needsUpdate)persist(details.map(item=>item.manualDays?item:{...item,days:defaultDays}))
  },[defaultDays])

  const parkingTotal=details.reduce((sum,item)=>sum+positive(item.days)*positive(item.unitPrice),0)
  return <section className={styles.wrap}>
    <div className={styles.topline}><div><b>Vehículos y cochera</b><small>Cada vehículo puede tener un tipo de cochera, tarifa y dominio diferentes.</small></div><label><span>Cantidad de vehículos</span><input type="number" min="0" max="10" value={details.length} onChange={event=>changeCount(event.target.value)}/></label></div>
    {!details.length?<div className={styles.empty}>Sin vehículos cargados.</div>:<div className={styles.list}>{details.map((item,index)=>{
      const resource=parkingResources.find(entry=>String(entry.id)===String(item.resourceId)),subtotal=positive(item.days)*positive(item.unitPrice)
      return <article className={styles.card} key={item.key||index}>
        <header><div><span>VEHÍCULO {index+1}</span><b>{item.type||"Sin tipo definido"}</b></div><div className={styles.subtotal}><small>Subtotal cochera</small><strong>{money(subtotal,currency)}</strong></div><button type="button" onClick={()=>remove(index)} aria-label={`Quitar vehículo ${index+1}`}>×</button></header>
        <div className={styles.grid}>
          <label className={styles.parking}><span>Cochera</span><select value={item.resourceId||""} onChange={event=>selectParking(index,event.target.value)}><option value="">Sin cochera</option>{parkingResources.map(option=><option value={option.id} key={option.id}>{option.name} · {money(option.price,currency)} / día</option>)}</select></label>
          <label><span>Tipo de vehículo</span><input value={item.type||""} onChange={event=>update(index,{type:event.target.value})} placeholder="Auto, camioneta…"/></label>
          <label><span>Dominio</span><input value={item.plate||""} onChange={event=>update(index,{plate:event.target.value.toUpperCase()})} placeholder="AA123BB"/></label>
          <label><span>Días cochera</span><input type="number" min="0" value={item.days??""} onChange={event=>update(index,{days:positive(event.target.value),manualDays:true})}/></label>
          <div className={styles.rate}><span>Tarifa aplicada</span><b>{resource?`${money(resource.price,currency)} / día`:"Sin cargo de cochera"}</b></div>
        </div>
      </article>})}</div>}
    <div className={styles.total}><span><b>{details.length}</b> {details.length===1?"vehículo":"vehículos"} cargado{details.length===1?"":"s"}</span><div><small>Total cochera</small><strong>{money(parkingTotal,currency)}</strong></div></div>
  </section>
}
