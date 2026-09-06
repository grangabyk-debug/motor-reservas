"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./reservationChargePanel.module.css"

const MODE_LABEL={per_stay:"Por estadía",per_night:"Por noche",per_unit:"Por unidad",per_person:"Por persona",per_person_night:"Por persona/noche"}
const CATEGORY_LABEL={parking:"Cochera",pet:"Mascotas",extra:"Extra",service:"Servicio",fee:"Cargo"}
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const dateKey=value=>String(value||"").slice(0,10)
const diffDays=(from,to)=>Math.max(1,Math.round((new Date(`${to}T12:00:00`)-new Date(`${from}T12:00:00`))/86400000)||1)

export default function ReservationChargePanel({reservation,propertyId,onClose,onSaved}){
  const[catalog,setCatalog]=useState([]),[folios,setFolios]=useState([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("")
  const[selectedId,setSelectedId]=useState(""),[folioId,setFolioId]=useState(""),[quantity,setQuantity]=useState(1),[from,setFrom]=useState(dateKey(reservation.fecha_entrada)),[to,setTo]=useState(dateKey(reservation.fecha_salida)),[wholeStay,setWholeStay]=useState(true),[note,setNote]=useState("")
  const currency=reservation.moneda||"ARS",stayStart=dateKey(reservation.fecha_entrada),stayEnd=dateKey(reservation.fecha_salida),stayNights=Math.max(1,Number(reservation.noches)||diffDays(stayStart,stayEnd))

  useEffect(()=>{let cancelled=false;(async()=>{setLoading(true);setError("");try{
    const ensured=await supabase.rpc("hl_ensure_reservation_folios",{p_reservation_id:Number(reservation.id)});if(ensured.error)throw ensured.error
    const[catalogRes,folioRes]=await Promise.all([
      supabase.from("hotel_charge_catalog").select("id,name,category,amount,charge_mode,active,sort_order").eq("property_id",propertyId).eq("active",true).order("sort_order").order("name"),
      supabase.from("hotel_folios").select("id,room_id,folio_type,label,payer_type,status,sort_order").eq("property_id",propertyId).eq("reservation_id",Number(reservation.id)).eq("status","open").order("sort_order").order("created_at")
    ]);if(catalogRes.error)throw catalogRes.error;if(folioRes.error)throw folioRes.error;if(cancelled)return
    const rows=catalogRes.data||[],folioRows=folioRes.data||[];setCatalog(rows);setFolios(folioRows);if(rows.length)setSelectedId(rows[0].id);const preferred=folioRows.find(row=>row.folio_type==="room")||folioRows.find(row=>row.folio_type==="master")||folioRows[0];setFolioId(preferred?.id||"")
  }catch(err){if(!cancelled)setError(err?.message||"No se pudieron cargar los extras del hotel.")}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[propertyId,reservation.id])

  const selected=useMemo(()=>catalog.find(row=>String(row.id)===String(selectedId))||null,[catalog,selectedId])
  const selectedFolio=useMemo(()=>folios.find(row=>row.id===folioId)||null,[folios,folioId])
  const timed=selected?.charge_mode==="per_night"||selected?.charge_mode==="per_person_night"
  const units=Math.max(1,Number(quantity)||1)
  const chargedNights=timed?diffDays(from,to):1
  const unitPrice=Number(selected?.amount)||0
  const total=selected?unitPrice*units*(timed?chargedNights:1):0
  const unitLabel=selected?.category==="parking"?"Vehículos":selected?.charge_mode?.includes("person")?"Personas":"Cantidad"

  useEffect(()=>{if(!selected)return;const defaultQty=selected.charge_mode==="per_person"||selected.charge_mode==="per_person_night"?Math.max(1,Number(reservation.cantidad_huespedes)||1):1;setQuantity(defaultQty);setWholeStay(true);setFrom(stayStart);setTo(stayEnd);setNote("")},[selectedId])
  function toggleWholeStay(checked){setWholeStay(checked);if(checked){setFrom(stayStart);setTo(stayEnd)}}
  function changeFrom(value){const next=value<stayStart?stayStart:value>=stayEnd?stayStart:value;setFrom(next);if(to<=next)setTo(nextDayWithin(next,stayEnd));setWholeStay(next===stayStart&&to===stayEnd)}
  function changeTo(value){const next=value>stayEnd?stayEnd:value<=from?nextDayWithin(from,stayEnd):value;setTo(next);setWholeStay(from===stayStart&&next===stayEnd)}

  async function addCharge(){
    if(!selected||saving)return
    if(timed&&(!from||!to||from<stayStart||to>stayEnd||to<=from)){setError("Elegí un período válido dentro de la estadía.");return}
    if(folios.length&&!selectedFolio){setError("Elegí el folio donde querés cargar el consumo.");return}
    setSaving(true);setError("")
    try{
      const{data:current,error:readError}=await supabase.from("reservas").select("id,property_id,servicios,precio_total,moneda").eq("id",reservation.id).eq("property_id",propertyId).single();if(readError)throw readError
      const detailParts=[]
      if(selected.category==="parking")detailParts.push(`${units} vehículo${units===1?"":"s"}`);else if(units>1||selected.charge_mode?.includes("person"))detailParts.push(`${units} ${selected.charge_mode?.includes("person")?"persona":"unidad"}${units===1?"":"s"}`)
      if(timed)detailParts.push(`${chargedNights} noche${chargedNights===1?"":"s"} · ${from} → ${to}`)
      if(selectedFolio)detailParts.push(selectedFolio.label)
      if(note.trim())detailParts.push(note.trim())
      const charge={id:`charge-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,catalog_id:selected.id,nombre:selected.name,categoria:selected.category,modo_cobro:selected.charge_mode,precio:unitPrice,cantidad:units,noches:timed?chargedNights:null,desde:timed?from:null,hasta:timed?to:null,toda_estadia:timed?wholeStay:null,folio_id:selectedFolio?.id||null,habitacion_id:selectedFolio?.room_id||null,detalle:detailParts.join(" · "),total,created_at:new Date().toISOString()}
      const nextServices=[...(Array.isArray(current.servicios)?current.servicios:[]),charge],nextTotal=(Number(current.precio_total)||0)+total
      const{data:updated,error:updateError}=await supabase.from("reservas").update({servicios:nextServices,precio_total:nextTotal}).eq("id",reservation.id).eq("property_id",propertyId).select("id,servicios,precio_total,subtotal,moneda").single();if(updateError)throw updateError
      const{data:event}=await supabase.from("hotel_reservation_events").insert({property_id:propertyId,reservation_id:reservation.id,event_type:"charge",title:`Cargo agregado · ${selected.name}`,detail:`${detailParts.length?`${detailParts.join(" · ")} · `:""}${money(total,currency)}`,payload:{catalog_id:selected.id,name:selected.name,category:selected.category,charge_mode:selected.charge_mode,unit_price:unitPrice,quantity:units,nights:timed?chargedNights:null,from:timed?from:null,to:timed?to:null,folio_id:selectedFolio?.id||null,room_id:selectedFolio?.room_id||null,total,currency}}).select("id,event_type,title,detail,payload,actor_name,created_at").maybeSingle()
      Object.assign(reservation,updated)
      if(typeof window!=="undefined"){window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(reservation.id)}}));window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:["reservas","hotel_folio_items"]}}))}
      onSaved?.({reservation:updated,event:event||null,charge})
      onClose?.()
    }catch(err){setError(err?.message||"No se pudo agregar el cargo a la reserva.")}
    finally{setSaving(false)}
  }

  return <div className={s.backdrop} onMouseDown={event=>event.target===event.currentTarget&&onClose?.()}><section className={s.modal} role="dialog" aria-modal="true" aria-label="Agregar cargo a la reserva">
    <button type="button" className={s.close} onClick={onClose}>×</button><small className={s.eyebrow}>ARTÍCULOS · NUEVO CARGO</small><h2>Agregar extra a {reservation.nombre_huesped}</h2><p className={s.intro}>Elegí el extra y el folio donde debe quedar cargado. En grupos podés separar consumos por habitación, empresa o pasajero.</p>
    {error?<div className={s.error}>{error}</div>:null}
    {loading?<div className={s.empty}>Cargando extras disponibles…</div>:!catalog.length?<div className={s.empty}>No hay servicios o extras activos. Primero cargalos desde Servicios y extras.</div>:<>
      <label className={s.picker}><span>Extra</span><div className={s.selectShell}><select value={selectedId} onChange={event=>setSelectedId(event.target.value)}>{catalog.map(row=><option key={row.id} value={row.id}>{row.name} · {money(row.amount,currency)} · {MODE_LABEL[row.charge_mode]||row.charge_mode}</option>)}</select></div>{selected?<small>{CATEGORY_LABEL[selected.category]||selected.category} · {MODE_LABEL[selected.charge_mode]||selected.charge_mode} · {money(selected.amount,currency)}</small>:null}</label>
      {folios.length?<label className={s.picker}><span>Cargar en folio</span><div className={s.selectShell}><select value={folioId} onChange={event=>setFolioId(event.target.value)}>{folios.map(folio=><option key={folio.id} value={folio.id}>{folio.label}{folio.payer_type&&folio.payer_type!=="guest"?` · ${folio.payer_type}`:""}</option>)}</select></div><small>{folios.length>1?"Este consumo quedará sólo en la cuenta elegida.":"Folio de la habitación."}</small></label>:null}
      {selected?<div className={s.form}>
        <label>{unitLabel}<input type="number" min="1" max="99" value={quantity} onChange={event=>setQuantity(Math.max(1,Number(event.target.value)||1))}/></label>
        {timed?<><label className={s.check}><input type="checkbox" checked={wholeStay} onChange={event=>toggleWholeStay(event.target.checked)}/><span>Toda la estadía ({stayNights} noche{stayNights===1?"":"s"})</span></label><label>Desde<input type="date" min={stayStart} max={stayEnd} value={from} disabled={wholeStay} onChange={event=>changeFrom(event.target.value)}/></label><label>Hasta<input type="date" min={stayStart} max={stayEnd} value={to} disabled={wholeStay} onChange={event=>changeTo(event.target.value)}/></label></>:null}
        <label className={s.wide}>Detalle opcional<input value={note} onChange={event=>setNote(event.target.value)} placeholder={selected.category==="parking"?"Ej. patente, cochera 2, vehículo adicional…":"Observación del cargo"}/></label>
      </div>:null}
      <div className={s.summary}><div><small>Cálculo</small><b>{timed?`${units} × ${chargedNights} noche${chargedNights===1?"":"s"} × ${money(unitPrice,currency)}`:`${units} × ${money(unitPrice,currency)}`}</b></div><div><small>{selectedFolio?selectedFolio.label:"Se suma a la reserva"}</small><strong>{money(total,currency)}</strong></div></div>
    </>}
    <footer><button type="button" onClick={onClose}>Cancelar</button><button type="button" className={s.primary} disabled={saving||loading||!selected||total<=0} onClick={addCharge}>{saving?"Agregando…":"Agregar cargo"}</button></footer>
  </section></div>
}

function nextDayWithin(value,max){const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+1);const next=date.toLocaleDateString("en-CA");return next>max?max:next}
