"use client"

import{useEffect,useMemo,useState}from"react"
import{money}from"../../../core/formatters"
import MercadoPagoGuaranteePanel from"../MercadoPagoGuaranteePanel"
import ReservationVehicleParking from"./ReservationVehicleParking"
import ReservationExtrasServices from"./ReservationExtrasServices"
import modal from"../reservation-modal.module.css"
import ws from"../reservation-workspace.module.css"
import mr from"../reservation-multiroom.module.css"

const CHANNELS=["Directa","Motor directo","Booking.com","Expedia","Airbnb","Teléfono","WhatsApp","Walk-in","Agencia","Otro"]
function Field({label,wide=false,full=false,mobileOptional=false,mobileOpen=false,children}){return <label className={`${wide?modal.wide:""} ${full?modal.full:""}`} data-hl-mobile-optional={mobileOptional?"stay":undefined} data-hl-mobile-open={mobileOptional?(mobileOpen?"true":"false"):undefined}><span>{label}</span>{children}</label>}
function NumberInput({value,onChange,...props}){return <input type="number" value={value??""} onFocus={()=>String(value)==="0"&&onChange("")} onChange={e=>onChange(e.target.value)} {...props}/>}
const roomPriority=room=>/\bdoble\b/i.test(String(room?.tipo||""))?0:/\btriple\b/i.test(String(room?.tipo||""))?1:/cu[aá]druple/i.test(String(room?.tipo||""))?2:/suite/i.test(String(room?.tipo||""))?3:4

export default function ReservationStayArticles({tab,draft,set,room,totals,rooms,availableRooms=[],availabilityReady=false,availabilityLoading=false,availabilityError="",partners,groups,parkingItem,parkingResources,propertyId,occupancy,workspaceError,changeStayType,setStart,selectParking,updateParkingField,guaranteeChanged,addPet,petResources,updatePetResource,otherResources,addResource,charges,addCharge,isParkingExtra}){
  const[showAdvanced,setShowAdvanced]=useState(false),compactNew=!draft.id
  useEffect(()=>setShowAdvanced(false),[draft?.id])
  const optional={mobileOptional:compactNew,mobileOpen:showAdvanced},additionalRooms=draft.additionalRooms||[]
  const selectedRoomIds=useMemo(()=>new Set([draft.roomId,...additionalRooms.map(item=>item.roomId)].map(String).filter(Boolean)),[draft.roomId,additionalRooms])
  const selectedCapacity=useMemo(()=>[draft.roomId,...additionalRooms.map(item=>item.roomId)].map(id=>rooms.find(r=>String(r.id)===String(id))).filter(Boolean).reduce((sum,item)=>sum+Math.max(1,Number(item.capacidad||1)),0),[draft.roomId,additionalRooms,rooms])
  const roomChoices=useMemo(()=>{const selected=new Set([draft.roomId,...additionalRooms.map(item=>item.roomId)].map(String).filter(Boolean)),seen=new Set(),source=availabilityReady?availableRooms:rooms.filter(item=>selected.has(String(item.id)));return source.filter(item=>{const id=String(item.id||"");if(!id||seen.has(id)||item.activa===false)return false;seen.add(id);return true}).sort((a,b)=>roomPriority(a)-roomPriority(b)||String(a.tipo||"").localeCompare(String(b.tipo||""),"es")||String(a.nombre||"").localeCompare(String(b.nombre||""),"es",{numeric:true}))},[availabilityReady,availableRooms,rooms,draft.roomId,additionalRooms])
  const availabilityText=availabilityLoading?"Buscando habitaciones disponibles…":availabilityError?`No pudimos actualizar disponibilidad: ${availabilityError}`:!occupancy.valid?"Primero elegí entrada y salida para ver solamente las habitaciones disponibles.":availabilityReady?(roomChoices.length?`${roomChoices.length} habitación${roomChoices.length===1?"":"es"} disponible${roomChoices.length===1?"":"s"} para esta estadía.`:"No hay habitaciones disponibles para estas fechas y horarios."):"Verificando disponibilidad…"
  const requestedRoomCount=Math.max(1,1+additionalRooms.length),maxRoomCount=Math.max(1,Math.min(12,roomChoices.length||1)),isDayUse=draft.stayType==="day_use"
  const guaranteeMissing=!String(draft.guaranteeType||"").trim(),cardGuaranteeMissing=draft.guaranteeType==="Tarjeta"&&!draft.id&&!draft.guaranteeTokenPayload?.token
  function changePrimaryRoom(value){const target=rooms.find(r=>String(r.id)===String(value));set("roomId",value);if(value&&target)set("rate",Number(target.precio||0))}
  function changeRoomCount(value){
    const requested=Math.max(1,Math.min(Number(value||1),maxRoomCount)),extraCount=requested-1
    let primaryId=String(draft.roomId||""),nextAdditional=[...additionalRooms]
    if(!primaryId&&requested>0){const first=roomChoices[0];if(first){primaryId=String(first.id);set("roomId",primaryId);set("rate",Number(first.precio||0))}}
    if(nextAdditional.length>extraCount){set("additionalRooms",nextAdditional.slice(0,extraCount));return}
    if(nextAdditional.length===extraCount)return
    const used=new Set([primaryId,...nextAdditional.map(item=>String(item.roomId||""))].filter(Boolean)),candidates=roomChoices.filter(item=>!used.has(String(item.id)))
    while(nextAdditional.length<extraCount&&candidates.length){const target=candidates.shift();used.add(String(target.id));nextAdditional.push({roomId:String(target.id),rate:Number(target.precio||0),name:target.nombre||"",type:target.tipo||"Habitación"})}
    set("additionalRooms",nextAdditional)
  }
  function updateAdditionalRoom(index,key,value){set("additionalRooms",additionalRooms.map((item,i)=>{if(i!==index)return item;if(key!=="roomId")return{...item,[key]:value};const target=rooms.find(r=>String(r.id)===String(value));return{...item,roomId:value,rate:target?Number(target.precio||0):"",name:target?.nombre||"",type:target?.tipo||"Habitación"}}))}
  function removeAdditionalRoom(index){set("additionalRooms",additionalRooms.filter((_,i)=>i!==index))}
  return <>
    {tab==="stay"&&<section className={modal.panel}>
      <div className={modal.subhead}><div><h3>Estadía</h3></div><button type="button" className={`${mr.dayUseButton} ${isDayUse?mr.dayUseActive:""}`} onClick={()=>changeStayType(isDayUse?"overnight":"day_use")}>Day Use</button></div>
      <div className={modal.grid}>
        <Field label="Entrada"><input type="date" value={draft.start} onChange={e=>setStart(e.target.value)}/></Field>
        <Field label="Salida"><input type="date" disabled={isDayUse} value={draft.end} onChange={e=>set("end",e.target.value)}/></Field>
        <Field label="Cantidad de noches"><div className={mr.nightsDisplay}><b>{isDayUse?0:occupancy.valid?occupancy.nights:"—"}</b><small>{isDayUse?"Day Use":occupancy.valid?(occupancy.nights===1?"noche":"noches"):"automático"}</small></div></Field>
        <Field label="Cantidad de habitaciones"><select disabled={!occupancy.valid||availabilityLoading||!availabilityReady||!roomChoices.length} value={Math.min(requestedRoomCount,maxRoomCount)} onChange={e=>changeRoomCount(e.target.value)}>{Array.from({length:maxRoomCount},(_,i)=>i+1).map(count=><option key={count} value={count}>{count}</option>)}</select></Field>
        <Field label="Habitación principal" wide><select disabled={!occupancy.valid||availabilityLoading||(!availabilityReady&&!draft.roomId)} value={draft.roomId} onChange={e=>changePrimaryRoom(e.target.value)}><option value="">{availabilityLoading?"Buscando disponibilidad…":!occupancy.valid?"Elegí entrada y salida primero":availabilityReady&&roomChoices.length?"Elegir habitación disponible":"Sin habitaciones disponibles"}</option>{roomChoices.map(r=><option key={r.id} value={r.id} disabled={additionalRooms.some(item=>String(item.roomId)===String(r.id))}>{r.nombre} · {r.tipo||"Habitación"} · {money(r.precio||0,draft.currency)}</option>)}</select><small className={`${mr.availability} ${availabilityError||occupancy.valid&&availabilityReady&&!roomChoices.length?mr.availabilityWarn:""}`}>{availabilityText}</small></Field>
        <label className={mr.compactTime}><span>Hora entrada</span><input type="time" value={draft.arrivalTime||""} onChange={e=>set("arrivalTime",e.target.value)}/></label>
        <label className={mr.compactTime}><span>Hora salida</span><input type="time" value={draft.departureTime||""} onChange={e=>set("departureTime",e.target.value)}/></label>
        <Field label="Canal"><select value={draft.channel} onChange={e=>set("channel",e.target.value)}><option value="">Elegir canal</option>{CHANNELS.map(channel=><option key={channel}>{channel}</option>)}</select></Field>
        <Field label="Código canal / OTA" {...optional}><input value={draft.channelCode||""} onChange={e=>set("channelCode",e.target.value)} placeholder="Si corresponde"/></Field>
        <Field label="Empresa / Agencia" {...optional}><select value={draft.partnerId||""} onChange={e=>set("partnerId",e.target.value)}><option value="">Sin empresa/agencia</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Grupo" {...optional}><select value={draft.groupId||""} onChange={e=>set("groupId",e.target.value)}><option value="">Sin grupo</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
      </div>
      <div className={mr.box}><div className={mr.head}><div><b>Asignación de habitaciones</b></div></div>{additionalRooms.length?<div className={mr.rows}>{additionalRooms.map((item,index)=>{const selectedRoom=rooms.find(r=>String(r.id)===String(item.roomId));return <div className={mr.row} key={`${item.roomId||"new"}-${index}`}><label><span>Habitación {index+2}</span><select value={item.roomId||""} onChange={e=>updateAdditionalRoom(index,"roomId",e.target.value)}><option value="">Elegir habitación disponible</option>{roomChoices.map(r=><option key={r.id} value={r.id} disabled={String(r.id)!==String(item.roomId)&&selectedRoomIds.has(String(r.id))}>{r.nombre} · {r.tipo||"Habitación"}</option>)}</select></label><label><span>Tarifa / noche</span><NumberInput min="0" value={item.rate??""} onChange={v=>updateAdditionalRoom(index,"rate",v)}/></label><button type="button" className={mr.remove} onClick={()=>removeAdditionalRoom(index)} aria-label="Quitar habitación">×</button><div className={mr.meta}><span><b>{selectedRoom?.tipo||item.type||"Habitación"}</b></span><span>{selectedRoom?.capacidad?`Capacidad ${selectedRoom.capacidad} pax`:""}</span><span>{occupancy.valid?`${occupancy.billingUnits} unidad(es) × ${money(Number(item.rate||0),draft.currency)}`:"Completá la estadía para calcular"}</span></div></div>})}</div>:null}<div className={mr.summary}><span>{draft.roomId?1+additionalRooms.length:0} habitación{draft.roomId&&additionalRooms.length?"es":""}{selectedCapacity?` · capacidad estimada ${selectedCapacity} pax`:""}</span><b><small style={{display:"block",fontSize:"12px",lineHeight:1.1,fontWeight:850,letterSpacing:".03em",opacity:.72,marginBottom:"4px"}}>Alojamiento</small>{money(totals.stay,draft.currency)}</b></div></div>
      {compactNew&&<button data-hl-mobile-more="stay" className={modal.miniButton} type="button" onClick={()=>setShowAdvanced(value=>!value)}>{showAdvanced?"Menos opciones":"Más opciones · canal, empresa y grupo"}</button>}
      <div className={modal.securityNote}>{occupancy.valid?<><b>{totals.roomCount>1?`Reserva grupal · ${totals.roomCount} habitaciones`:isDayUse?"Day Use":"Noche hotelera"}</b>{!isDayUse&&` · ${occupancy.nights} ${occupancy.nights===1?"noche":"noches"}`} · Ocupa {totals.roomCount>1?"las habitaciones":"la habitación"} de {occupancy.start} {occupancy.arrivalTime} a {occupancy.end} {occupancy.departureTime}.</>:<><b>Revisá la estadía:</b> {occupancy.message}</>}</div>
      <div className={modal.guaranteeBox}><div className={modal.guaranteeTitle}><h4>Garantía de la reserva</h4><small>Elegí cómo queda garantizada la estadía antes de finalizar la carga.</small></div><div className={modal.grid}><Field label="Tipo de garantía" wide><select value={draft.guaranteeType||""} onChange={e=>{set("guaranteeType",e.target.value);if(e.target.value!=="Tarjeta")set("guaranteeTokenPayload",null)}}><option value="">Elegir garantía</option><option>Sin garantía</option><option>Tarjeta</option><option>Transferencia</option><option>Seña</option><option>Voucher</option></select></Field></div>{draft.guaranteeType==="Tarjeta"&&<MercadoPagoGuaranteePanel propertyId={propertyId} reservationId={draft.id} guest={{name:draft.guest,email:draft.email,document:draft.document}} currency={draft.currency||"ARS"} stayTotal={totals.total} stagedToken={draft.guaranteeTokenPayload||null} onStagedToken={payload=>set("guaranteeTokenPayload",payload)} onClearStaged={()=>set("guaranteeTokenPayload",null)} onGuaranteeChanged={guaranteeChanged}/>}</div>
      {(guaranteeMissing||cardGuaranteeMissing)&&<div className={mr.guaranteeReminder}>{guaranteeMissing?"Falta completar la garantía de la reserva.":"Seleccionaste tarjeta: falta guardar la tarjeta de garantía."}</div>}
      {workspaceError&&<div className={modal.message}>{workspaceError}</div>}
    </section>}

    {tab==="articles"&&<section className={modal.panel}>
      <div className={modal.subhead}><div><h3>Artículos y extras</h3><p className={mr.flowHint}>Vehículos, mascotas y servicios del hotel se cargan por separado y se suman automáticamente a la reserva.</p></div></div>
      <div className={ws.articleSummary}><div><small>Alojamiento</small><b>{money(totals.stay,draft.currency)}</b></div><div><small>Extras</small><b>{money(totals.extras,draft.currency)}</b></div><div><small>Cochera</small><b>{money(totals.parking,draft.currency)}</b></div><div><small>Mascotas</small><b>{money(totals.pets,draft.currency)}</b></div></div>
      <ReservationVehicleParking draft={draft} set={set} parkingResources={parkingResources} occupancy={occupancy} currency={draft.currency}/>
      <ReservationExtrasServices draft={draft} set={set} totals={totals} petResources={petResources} addPet={addPet} updatePetResource={updatePetResource} otherResources={otherResources} addResource={addResource} charges={charges} addCharge={addCharge} isParkingExtra={isParkingExtra}/>
      {workspaceError&&<div className={modal.message}>{workspaceError}</div>}
    </section>}
  </>
}