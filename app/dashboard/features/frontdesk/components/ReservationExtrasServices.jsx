"use client"

import{money}from"../../../core/formatters"
import styles from"../reservation-extras-services.module.css"

const categoryMeta={amenity:["☕","Amenity"],service:["✦","Servicio"],crib:["◇","Cuna"],transfer:["⇄","Traslado"],spa:["✧","Spa"],meeting_room:["▣","Sala"],event_space:["◆","Evento"],equipment:["⌁","Equipo"],sport:["◌","Actividad"],other:["＋","Extra"]}
const modeLabel={per_use:"por uso",per_stay:"por estadía",per_hour:"por hora",per_day:"por día",per_night:"por noche",per_person:"por persona"}
const positive=value=>Math.max(0,Number(value||0))

export default function ReservationExtrasServices({draft,set,totals,petResources=[],addPet,updatePetResource,otherResources=[],addResource,charges=[],addCharge,isParkingExtra}){
  const currency=draft.currency||"ARS",pets=draft.pets||[],extraRows=(draft.extras||[]).map((item,index)=>({item,index})).filter(({item})=>!isParkingExtra(item)),petTotal=pets.reduce((sum,item)=>sum+positive(item.amount),0)
  function updatePet(index,patch){set("pets",pets.map((item,i)=>i===index?{...item,...patch}:item))}
  function removePet(index){set("pets",pets.filter((_,i)=>i!==index))}
  function updateExtra(index,patch){set("extras",(draft.extras||[]).map((item,i)=>i===index?{...item,...patch}:item))}
  function removeExtra(index){set("extras",(draft.extras||[]).filter((_,i)=>i!==index))}
  function changeExtraQuantity(index,item,value){const quantity=positive(value),unit=Number(item.unit_price);updateExtra(index,Number.isFinite(unit)?{quantity,total:quantity*unit}:{quantity})}
  function changeExtraTotal(index,item,value){const total=positive(value),quantity=Math.max(1,positive(item.quantity)||1);updateExtra(index,{total,unit_price:total/quantity})}
  function addManual(){set("extras",[...(draft.extras||[]),{name:"Otro cargo",quantity:1,unit_price:0,total:"",resource_category:"other",charge_mode:"per_use",kind:"manual"}])}
  return <section className={styles.wrap}>
    <div className={styles.header}><div><b>Servicios y adicionales</b><small>Aplicá servicios del catálogo del hotel o sumá cargos puntuales a esta reserva.</small></div><span>Configurables desde Recursos</span></div>

    <div className={styles.petSection}>
      <div className={styles.sectionHead}><div><span className={styles.sectionIcon}>♢</span><div><b>Mascotas</b><small>Podés registrar más de una, cada una con su tarifa.</small></div></div><button type="button" onClick={addPet}>＋ Agregar mascota</button></div>
      {!pets.length?<div className={styles.emptyLine}>Sin mascotas cargadas.</div>:<div className={styles.petList}>{pets.map((pet,index)=>{
        const resource=petResources.find(item=>String(item.id)===String(pet.resource_id||""))
        return <article className={styles.petCard} key={`pet-${index}`}><header><div><small>MASCOTA {index+1}</small><b>{pet.name||"Sin nombre"}</b></div><strong>{money(positive(pet.amount),currency)}</strong><button type="button" onClick={()=>removePet(index)} aria-label={`Quitar mascota ${index+1}`}>×</button></header><div className={styles.petGrid}><label><span>Nombre</span><input value={pet.name||""} onChange={event=>updatePet(index,{name:event.target.value})} placeholder="Nombre de la mascota"/></label><label><span>Tarifa</span><select value={pet.resource_id||""} onChange={event=>updatePetResource(index,event.target.value)}><option value="">Importe manual</option>{petResources.map(option=><option key={option.id} value={option.id}>{option.name} · {money(option.price,currency)} {modeLabel[option.charge_mode]||""}</option>)}</select></label><label><span>Importe</span><input type="number" min="0" value={pet.amount??""} onChange={event=>updatePet(index,{amount:event.target.value})}/></label><div className={styles.mode}><span>Aplicación</span><b>{resource?modeLabel[resource.charge_mode]||"según tarifa":"Cargo manual"}</b></div></div></article>})}</div>}
      {pets.length>0&&<div className={styles.miniTotal}><span>{pets.length} {pets.length===1?"mascota":"mascotas"}</span><b>{money(petTotal,currency)}</b></div>}
    </div>

    <div className={styles.catalogSection}>
      <div className={styles.sectionHead}><div><span className={styles.sectionIcon}>＋</span><div><b>Catálogo del hotel</b><small>Los precios y servicios se administran en Recursos. Acá solamente se aplican a la reserva.</small></div></div><button type="button" className={styles.manualButton} onClick={addManual}>＋ Otro cargo</button></div>
      {otherResources.length||charges.some(item=>item.active!==false)?<div className={styles.catalogGrid}>
        {otherResources.map(resource=>{const[icon,label]=categoryMeta[resource.category]||categoryMeta.other,price=positive(resource.price);return <button type="button" className={styles.catalogCard} key={`resource-${resource.id}`} onClick={()=>addResource(resource)}><span className={styles.catalogIcon}>{icon}</span><span className={styles.catalogCopy}><small>{label}</small><b>{resource.name}</b><em>{price>0?`${money(price,currency)} · ${modeLabel[resource.charge_mode]||"por uso"}`:"Importe a definir"}</em></span><i>Agregar</i></button>})}
        {charges.filter(item=>item.active!==false).map(item=><button type="button" className={styles.catalogCard} key={`charge-${item.id}`} onClick={()=>addCharge(item)}><span className={styles.catalogIcon}>＋</span><span className={styles.catalogCopy}><small>Cargo</small><b>{item.name}</b><em>{positive(item.amount)>0?money(item.amount,currency):"Importe a definir"}</em></span><i>Agregar</i></button>)}
      </div>:<div className={styles.emptyCatalog}>Todavía no hay servicios configurados. Podés usar “Otro cargo” o cargarlos desde Recursos.</div>}
    </div>

    <div className={styles.appliedSection}>
      <div className={styles.appliedHead}><div><b>Extras aplicados</b><small>Estos conceptos se suman al total de la reserva.</small></div><strong>{money(totals.extras,currency)}</strong></div>
      {!extraRows.length?<div className={styles.emptyLine}>Todavía no agregaste extras a esta reserva.</div>:<div className={styles.appliedList}>{extraRows.map(({item,index})=>{
        const quantity=Math.max(1,positive(item.quantity)||1),mode=modeLabel[item.charge_mode]||"cargo",meta=categoryMeta[item.resource_category]||categoryMeta.other
        return <article className={styles.appliedCard} key={`${item.resource_id||item.catalog_id||item.name||"extra"}-${index}`}><span className={styles.appliedIcon}>{meta[0]}</span><label className={styles.nameField}><span>Concepto</span><input value={item.name||""} onChange={event=>updateExtra(index,{name:event.target.value})}/></label><label className={styles.qtyField}><span>Cantidad</span><input type="number" min="0" value={item.quantity??1} onChange={event=>changeExtraQuantity(index,item,event.target.value)}/></label><div className={styles.appliedMode}><span>Modo</span><b>{mode}</b></div><label className={styles.amountField}><span>Total</span><input type="number" min="0" value={item.total??item.amount??""} onChange={event=>changeExtraTotal(index,item,event.target.value)}/></label><button type="button" className={styles.remove} onClick={()=>removeExtra(index)} aria-label={`Quitar ${item.name||"extra"}`}>×</button></article>})}</div>}
      <div className={styles.totalBar}><span><b>{extraRows.length}</b> {extraRows.length===1?"extra aplicado":"extras aplicados"}</span><div><small>Extras + mascotas</small><strong>{money(positive(totals.extras)+petTotal,currency)}</strong></div></div>
    </div>
  </section>
}
