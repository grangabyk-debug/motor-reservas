"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import useQuoteAvailability from"./useQuoteAvailability"
import s from"./quotes.module.css"

const DAY=86400000
const pad=v=>String(v).padStart(2,"0")
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const addDays=(value,n)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+n);return dateKey(d)}
const nights=(a,b)=>Math.max(1,Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/DAY))
const STATUS={draft:"Borrador",sent:"Enviado",accepted:"Aceptado",rejected:"Rechazado",expired:"Vencido"}
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[char])
function emit(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}

function freshForm(currency="ARS"){
  const start=dateKey(new Date())
  return{name:"",email:"",phone:"",start,end:addDays(start,1),pax:2,currency,validUntil:addDays(dateKey(new Date()),7),terms:"Tarifas sujetas a disponibilidad al momento de confirmar.",notes:"",selection:{}}
}

export default function QuotesWorkspace({propertyId,property,onNavigate}){
  const[quotes,setQuotes]=useState([]),[groups,setGroups]=useState({}),[lines,setLines]=useState({}),[currency,setCurrency]=useState("ARS")
  const[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[form,setForm]=useState(()=>freshForm()),[formOpen,setFormOpen]=useState(false),[selected,setSelected]=useState(null),[saving,setSaving]=useState(false)
  const[availability,setAvailability]=useState({types:[],rooms:[],occupiedCount:0}),[checking,setChecking]=useState(false)
  const checkAvailability=useQuoteAvailability(propertyId)

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[qRes,gRes,setRes]=await Promise.all([
        supabase.from("hotel_group_quotes").select("id,group_id,version,quote_number,status,valid_until,currency,accommodation_total,food_total,extras_total,taxes_total,discount_total,total,deposit_percent,deposit_due_date,terms,internal_notes,sent_at,accepted_at,created_at,updated_at").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(100),
        supabase.from("hotel_groups").select("id,name,status,arrival_date,departure_date,contact_name,contact_email,contact_phone,room_block,estimated_pax,sales_stage,budget_currency,budget_total,notes").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(150),
        supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      ])
      for(const result of[qRes,gRes,setRes])if(result.error)throw result.error
      const qs=qRes.data||[],ids=qs.map(q=>q.id)
      let quoteLines=[]
      if(ids.length){const{data,error:lineError}=await supabase.from("hotel_group_quote_lines").select("id,quote_id,category,description,quantity,unit_price,total,sort_order,metadata").eq("property_id",propertyId).in("quote_id",ids).order("sort_order");if(lineError)throw lineError;quoteLines=data||[]}
      setQuotes(qs);setGroups(Object.fromEntries((gRes.data||[]).map(g=>[g.id,g])));setLines(quoteLines.reduce((acc,line)=>{(acc[line.quote_id]??=[]).push(line);return acc},{}));setCurrency(setRes.data?.settings?.preferences?.currency||"ARS")
    }catch(err){setError(err?.message||"No se pudieron cargar los presupuestos.")}
    finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{load()},[load])

  async function refreshAvailability(nextForm=form,options={}){
    if(!nextForm.start||!nextForm.end||nextForm.end<=nextForm.start){setAvailability({types:[],rooms:[],occupiedCount:0});return}
    setChecking(true);setError("")
    try{setAvailability(await checkAvailability(nextForm.start,nextForm.end,options))}catch(err){setError(err?.message||"No se pudo comprobar la disponibilidad.")}finally{setChecking(false)}
  }
  function openNew(){const next=freshForm(currency);setForm(next);setNotice("");setError("");setFormOpen(true);refreshAvailability(next)}
  function patch(values){setForm(current=>({...current,...values}))}
  function changeDates(values){setForm(current=>{const next={...current,...values,selection:{}};window.setTimeout(()=>refreshAvailability(next),0);return next})}
  function setQty(type,qty){const max=availability.types.find(x=>x.name===type)?.available||0;const safe=Math.max(0,Math.min(max,Number(qty)||0));setForm(current=>({...current,selection:{...current.selection,[type]:safe}}))}
  const selectedRooms=useMemo(()=>Object.values(form.selection||{}).reduce((sum,value)=>sum+(Number(value)||0),0),[form.selection])
  const selectedCapacity=useMemo(()=>availability.types.reduce((sum,type)=>sum+(Number(form.selection?.[type.name])||0)*type.capacity,0),[availability.types,form.selection])
  const estimate=useMemo(()=>availability.types.reduce((sum,type)=>sum+(Number(form.selection?.[type.name])||0)*type.basePrice*nights(form.start,form.end),0),[availability.types,form.selection,form.start,form.end])

  async function createQuote(){
    if(!form.name.trim())return setError("Ingresá el nombre del huésped, familia o grupo.")
    if(form.end<=form.start)return setError("La salida debe ser posterior a la entrada.")
    if(selectedRooms<1)return setError("Seleccioná al menos una habitación disponible.")
    setSaving(true);setError("");setNotice("")
    let groupId=null
    try{
      const latest=await checkAvailability(form.start,form.end)
      for(const[type,qty]of Object.entries(form.selection)){if(Number(qty)>0&&(latest.types.find(x=>x.name===type)?.available||0)<Number(qty))throw new Error(`Cambió la disponibilidad de ${type}. Volvé a seleccionar las habitaciones.`)}
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
      const groupPayload={property_id:propertyId,name:form.name.trim(),kind:selectedRooms>1?"group":"inquiry",status:"prospect",arrival_date:form.start,departure_date:form.end,contact_name:form.name.trim(),contact_email:form.email.trim()||null,contact_phone:form.phone.trim()||null,room_block:selectedRooms,estimated_pax:Math.max(1,Number(form.pax)||1),sales_stage:"inquiry",budget_currency:form.currency||currency,budget_total:estimate,notes:form.notes.trim()||null}
      const{data:group,error:groupError}=await supabase.from("hotel_groups").insert(groupPayload).select("id").single();if(groupError)throw groupError;groupId=group.id
      const quoteLines=latest.types.flatMap(type=>{const qty=Number(form.selection[type.name])||0;if(!qty)return[];return[{category:"room",description:type.name,quantity:qty,unit_price:type.basePrice*nights(form.start,form.end),sort_order:0,metadata:{room_type:type.name,nights:nights(form.start,form.end),nightly_rate:type.basePrice,quoted_available:type.available}}]})
      const quoteNumber=`PRE-${dateKey(new Date()).replaceAll("-","")}-${String(Date.now()).slice(-5)}`
      const{data:quote,error:quoteError}=await supabase.rpc("hl_group_create_quote_atomic",{p_property_id:propertyId,p_group_id:groupId,p_version:1,p_quote_number:quoteNumber,p_status:"draft",p_currency:form.currency||currency,p_valid_until:form.validUntil||null,p_deposit_percent:0,p_deposit_due_date:null,p_terms:form.terms.trim()||null,p_internal_notes:form.notes.trim()||null,p_lines:quoteLines});if(quoteError)throw quoteError
      emit({title:"Presupuesto creado",message:`${quote.quote_number} · ${selectedRooms} habitación${selectedRooms===1?"":"es"} · ${money(quote.total,quote.currency)}.`});setFormOpen(false);await load();setSelected(quote)
    }catch(err){if(groupId)await supabase.from("hotel_groups").delete().eq("id",groupId).eq("property_id",propertyId).catch(()=>{});setError(err?.message||"No se pudo crear el presupuesto.")}
    finally{setSaving(false)}
  }

  async function markQuote(quote,status){
    setSaving(true);setError("")
    try{const{error:rpcError}=await supabase.rpc("hl_group_mark_quote_atomic",{p_property_id:propertyId,p_quote_id:quote.id,p_status:status});if(rpcError)throw rpcError;emit({title:"Presupuesto actualizado",message:`${quote.quote_number} · ${STATUS[status]||status}.`});await load();setSelected(null)}catch(err){setError(err?.message||"No se pudo actualizar el presupuesto.")}finally{setSaving(false)}
  }

  async function convertToReservation(quote){
    const group=groups[quote.group_id],quoteLines=(lines[quote.id]||[]).filter(line=>line.category==="room")
    if(!group?.arrival_date||!group?.departure_date||!quoteLines.length)return setError("Este presupuesto no tiene estadía o habitaciones convertibles.")
    setSaving(true);setError("")
    try{
      const{data:existing,error:existingError}=await supabase.from("reservas").select("id,numero_reserva,estado").eq("property_id",propertyId).eq("group_id",group.id).neq("estado","cancelada").limit(1);if(existingError)throw existingError;if(existing?.length)throw new Error(`Este presupuesto ya fue convertido en la reserva ${existing[0].numero_reserva||existing[0].id}.`)
      const current=await checkAvailability(group.arrival_date,group.departure_date,{excludeGroupId:group.id})
      const roomIds=[]
      for(const line of quoteLines){const type=line.metadata?.room_type||line.description,qty=Math.max(1,Math.round(Number(line.quantity)||1)),bucket=current.types.find(x=>x.name===type);if(!bucket||bucket.available<qty)throw new Error(`Ya no hay ${qty} ${type} disponibles para esas fechas.`);const candidates=bucket.freeRooms.slice(bucket.reserved,bucket.reserved+qty);if(candidates.length<qty)throw new Error(`No pudimos asignar las habitaciones de ${type}.`);roomIds.push(...candidates.map(room=>Number(room.id)))}
      if(!roomIds.length)throw new Error("No hay habitaciones para convertir.")
      if(quote.status!=="accepted"){const{error:acceptError}=await supabase.rpc("hl_group_mark_quote_atomic",{p_property_id:propertyId,p_quote_id:quote.id,p_status:"accepted"});if(acceptError)throw acceptError}
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
      const stayNights=nights(group.arrival_date,group.departure_date),rate=roomIds.length?Number(quote.accommodation_total||0)/(stayNights*roomIds.length):0
      const payload={property_id:propertyId,user_id:userData?.user?.id||null,habitacion_id:roomIds[0],habitaciones_ids:roomIds,habitaciones_detalle:roomIds.map(id=>({habitacion_id:id})),fecha_entrada:group.arrival_date,fecha_salida:group.departure_date,tipo_estadia:"overnight",nombre_huesped:group.contact_name||group.name,email_huesped:group.contact_email||null,telefono_huesped:group.contact_phone||null,cantidad_huespedes:Math.max(1,Number(group.estimated_pax)||1),canal_reserva:"Directa · Presupuesto",tarifa_noche:rate,noches:stayNights,precio_total:Number(quote.total)||0,moneda:quote.currency||currency,notas:`Convertida desde ${quote.quote_number}${group.notes?` · ${group.notes}`:""}`,group_id:group.id,mascotas:[],mascotas_total:0,servicios:[],pasajeros:[],vehiculos:0,cochera_total:0,estado:"confirmada",no_show:false}
      const{data:reservation,error:reservationError}=await supabase.rpc("hl_create_reservation_atomic",{p_reservation:payload,p_payments:[]});if(reservationError)throw reservationError
      await supabase.from("hotel_group_inventory_blocks").update({status:"released",updated_at:new Date().toISOString(),notes:`Materializado en reserva ${reservation.numero_reserva||reservation.id}`}).eq("property_id",propertyId).eq("group_id",group.id).neq("status","released")
      emit({title:"Presupuesto convertido",message:`Reserva ${reservation.numero_reserva||reservation.id} creada con ${roomIds.length} habitación${roomIds.length===1?"":"es"}.`});await load();setSelected(null);onNavigate?.("reservations",{reservationId:reservation.id})
    }catch(err){await load();setError(err?.message||"No se pudo convertir el presupuesto en reserva.")}
    finally{setSaving(false)}
  }

  function printQuote(quote){
    const group=groups[quote.group_id],quoteLines=lines[quote.id]||[],win=window.open("","_blank","width=900,height=760");if(!win)return setError("El navegador bloqueó la ventana de impresión.")
    const rows=quoteLines.map(line=>`<tr><td>${esc(line.description)}</td><td>${esc(line.quantity)}</td><td>${esc(money(line.unit_price,quote.currency))}</td><td>${esc(money(line.total,quote.currency))}</td></tr>`).join("")
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(quote.quote_number)}</title><style>body{font-family:Arial,sans-serif;color:#17233b;padding:44px;line-height:1.4}header{display:flex;justify-content:space-between;gap:30px;border-bottom:3px solid #4967db;padding-bottom:20px}h1{margin:0;color:#3154c8}small{color:#6b7890}table{width:100%;border-collapse:collapse;margin:30px 0}th,td{text-align:left;padding:11px;border-bottom:1px solid #dfe5f0}th{color:#3154c8}.total{text-align:right;font-size:24px;font-weight:700}.terms{margin-top:28px;padding:18px;background:#f4f7ff;border-radius:14px}@media print{body{padding:10mm}}</style></head><body><header><div><small>HABITACIÓN LLENA</small><h1>${esc(property?.name||"Hotel")}</h1></div><div><b>${esc(quote.quote_number)}</b><br><small>Válido hasta ${esc(quote.valid_until||"—")}</small></div></header><h2>Presupuesto para ${esc(group?.contact_name||group?.name||"Huésped")}</h2><p>${esc(group?.arrival_date)} → ${esc(group?.departure_date)} · ${esc(group?.estimated_pax||0)} huéspedes</p><table><thead><tr><th>Concepto</th><th>Cantidad</th><th>Unitario</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total: ${esc(money(quote.total,quote.currency))}</div>${quote.terms?`<div class="terms"><b>Condiciones</b><p>${esc(quote.terms)}</p></div>`:""}<script>window.onload=()=>window.print()<\/script></body></html>`);win.document.close()
  }

  const selectedGroup=selected?groups[selected.group_id]:null
  return <section className={s.page}>
    <header className={s.header}><div><small>RESERVAS · PRESUPUESTOS</small><h1>Cotizar sin bloquear el Planning</h1><p>{property?.name||"Propiedad activa"} · disponibilidad real, varias habitaciones y conversión a reserva.</p></div><button className={s.primary} onClick={openNew}>＋ Nuevo presupuesto</button></header>
    {error&&<div className={s.error}>{error}</div>}{notice&&<div className={s.notice}>{notice}</div>}
    <div className={s.infoStrip}><span>◇ El presupuesto no ocupa habitaciones</span><span>✓ La disponibilidad se vuelve a validar al confirmar</span><span>↗ Un clic lo convierte en reserva real</span></div>
    {loading?<div className={s.notice}>Cargando presupuestos…</div>:<div className={s.list}>{quotes.length?quotes.map(quote=>{const group=groups[quote.group_id];return <button type="button" key={quote.id} className={s.quoteRow} onClick={()=>setSelected(quote)}><div><small>{quote.quote_number||"SIN NÚMERO"}</small><b>{group?.contact_name||group?.name||"Sin contacto"}</b></div><span>{group?.arrival_date||"—"} → {group?.departure_date||"—"}</span><span>{group?.room_block||0} hab. · {group?.estimated_pax||0} pax</span><strong>{money(quote.total,quote.currency)}</strong><em data-status={quote.status}>{STATUS[quote.status]||quote.status}</em><i>›</i></button>}):<div className={s.empty}><b>Todavía no hay presupuestos</b><span>Creá uno desde una llamada o consulta sin alterar la disponibilidad del Planning.</span></div>}</div>}

    {formOpen&&<div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&setFormOpen(false)}><div className={s.modal}><button className={s.close} onClick={()=>setFormOpen(false)} aria-label="Cerrar">×</button><small>NUEVO PRESUPUESTO</small><h2>Buscar disponibilidad y cotizar</h2><div className={s.formGrid}><label>Nombre / grupo<input autoFocus value={form.name} onChange={e=>patch({name:e.target.value})} placeholder="Familia Fernández / Empresa"/></label><label>Huéspedes<input type="number" min="1" value={form.pax} onChange={e=>patch({pax:e.target.value})}/></label><label>Email<input type="email" value={form.email} onChange={e=>patch({email:e.target.value})}/></label><label>Teléfono<input value={form.phone} onChange={e=>patch({phone:e.target.value})}/></label><label>Entrada<input type="date" value={form.start} onChange={e=>changeDates({start:e.target.value})}/></label><label>Salida<input type="date" min={addDays(form.start,1)} value={form.end} onChange={e=>changeDates({end:e.target.value})}/></label><label>Moneda<select value={form.currency} onChange={e=>patch({currency:e.target.value})}><option>ARS</option><option>USD</option><option>EUR</option></select></label><label>Válido hasta<input type="date" value={form.validUntil} onChange={e=>patch({validUntil:e.target.value})}/></label></div><div className={s.availabilityHead}><div><h3>Habitaciones disponibles</h3><p>{checking?"Comprobando Planning…":`${availability.types.reduce((sum,t)=>sum+t.available,0)} disponibles para ${nights(form.start,form.end)} noche${nights(form.start,form.end)===1?"":"s"}`}</p></div><button type="button" onClick={()=>refreshAvailability()}>Actualizar</button></div><div className={s.typeList}>{availability.types.map(type=><article key={type.name}><div><b>{type.name}</b><small>{type.available} disponibles · hasta {type.capacity} pax · desde {money(type.basePrice,form.currency)}/noche</small></div><div className={s.stepper}><button type="button" onClick={()=>setQty(type.name,(form.selection[type.name]||0)-1)}>−</button><input type="number" min="0" max={type.available} value={form.selection[type.name]||0} onChange={e=>setQty(type.name,e.target.value)}/><button type="button" onClick={()=>setQty(type.name,(form.selection[type.name]||0)+1)}>＋</button></div></article>)}{!checking&&!availability.types.length&&<div className={s.noAvailability}>No hay inventario disponible para esas fechas.</div>}</div><div className={s.quoteSummary}><div><span>Habitaciones</span><b>{selectedRooms}</b></div><div><span>Capacidad seleccionada</span><b>{selectedCapacity} pax</b></div><div><span>Estimado</span><b>{money(estimate,form.currency)}</b></div></div><label className={s.fullLabel}>Condiciones<textarea rows="3" value={form.terms} onChange={e=>patch({terms:e.target.value})}/></label><label className={s.fullLabel}>Notas internas<textarea rows="2" value={form.notes} onChange={e=>patch({notes:e.target.value})}/></label>{selectedCapacity>0&&Number(form.pax)>selectedCapacity&&<div className={s.warning}>La capacidad seleccionada es menor que la cantidad de huéspedes.</div>}<footer><button onClick={()=>setFormOpen(false)}>Cancelar</button><button className={s.primary} disabled={saving||checking||selectedRooms<1} onClick={createQuote}>{saving?"Creando…":"Guardar presupuesto"}</button></footer></div></div>}

    {selected&&<div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}><div className={`${s.modal} ${s.detailModal}`}><button className={s.close} onClick={()=>setSelected(null)}>×</button><small>{selected.quote_number}</small><h2>{selectedGroup?.contact_name||selectedGroup?.name}</h2><div className={s.detailMeta}><span><small>Estadía</small><b>{selectedGroup?.arrival_date} → {selectedGroup?.departure_date}</b></span><span><small>Huéspedes</small><b>{selectedGroup?.estimated_pax||0}</b></span><span><small>Estado</small><b>{STATUS[selected.status]||selected.status}</b></span><span><small>Total</small><b>{money(selected.total,selected.currency)}</b></span></div><div className={s.detailLines}>{(lines[selected.id]||[]).map(line=><div key={line.id}><span><b>{line.description}</b><small>{line.quantity} × {money(line.unit_price,selected.currency)}</small></span><strong>{money(line.total,selected.currency)}</strong></div>)}</div>{selected.terms&&<div className={s.terms}><b>Condiciones</b><p>{selected.terms}</p></div>}<footer className={s.detailActions}><button onClick={()=>printQuote(selected)}>Imprimir / PDF</button>{selected.status==="draft"&&<button disabled={saving} onClick={()=>markQuote(selected,"sent")}>Marcar enviado</button>}{!["rejected"].includes(selected.status)&&<button className={s.primary} disabled={saving} onClick={()=>convertToReservation(selected)}>{saving?"Procesando…":"Convertir en reserva"}</button>}{!["accepted","rejected"].includes(selected.status)&&<button className={s.reject} disabled={saving} onClick={()=>markQuote(selected,"rejected")}>Rechazar</button>}</footer></div></div>}
  </section>
}
