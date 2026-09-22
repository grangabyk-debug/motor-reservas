"use client"

import{useEffect,useMemo,useState}from"react"
import useCrmData from"./useCrmData"
import CrmOpportunityForm from"./CrmOpportunityForm"
import useQuoteAvailability from"../quotes/useQuoteAvailability"
import{prepareReservationFromCrm}from"./crmReservationSeed"
import s from"./crm.module.css"

const STAGES={new:"Nueva consulta",quote_sent:"Presupuesto",follow_up:"Seguimiento",waitlist:"Lista de espera",won:"Ganada",lost:"Perdida"}
const CHANNELS={whatsapp:"WhatsApp",email:"Email",phone:"Teléfono",other:"Otro",direct:"Directo",website:"Web",instagram:"Instagram",walkin:"Walk-in"}
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".",""):"—"
const fmtTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)
const localInput=value=>{if(!value)return"";const d=new Date(value),pad=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
const toast=detail=>typeof window!=="undefined"&&window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))

export default function CrmWorkspace({propertyId,onNavigate}){
  const data=useCrmData(propertyId),checkAvailability=useQuoteAvailability(propertyId)
  const[tab,setTab]=useState("open"),[query,setQuery]=useState(""),[selectedId,setSelectedId]=useState(""),[formOpen,setFormOpen]=useState(false),[editTarget,setEditTarget]=useState(null),[saving,setSaving]=useState(false)
  const[activities,setActivities]=useState([]),[activityLoading,setActivityLoading]=useState(false),[followAt,setFollowAt]=useState(""),[followChannel,setFollowChannel]=useState("whatsapp"),[note,setNote]=useState("")
  const[availability,setAvailability]=useState(null),[checking,setChecking]=useState(false)
  const selected=useMemo(()=>data.opportunities.find(row=>row.id===selectedId)||null,[data.opportunities,selectedId])
  const now=Date.now()

  useEffect(()=>{if(!selected){setActivities([]);setFollowAt("");setAvailability(null);return}setFollowAt(localInput(selected.next_follow_up_at));setFollowChannel(selected.follow_up_channel||"whatsapp");setAvailability(null);let cancelled=false;setActivityLoading(true);data.loadActivities(selected.id).then(rows=>{if(!cancelled)setActivities(rows)}).catch(err=>data.setError(err?.message||"No se pudo cargar la actividad.")).finally(()=>{if(!cancelled)setActivityLoading(false)});return()=>{cancelled=true}},[selected?.id])
  useEffect(()=>{if(selectedId&&!selected)setSelectedId("")},[selectedId,selected])

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase()
    return data.opportunities.filter(row=>{
      const tabOk=tab==="open"?!["won","lost"].includes(row.stage):tab==="follow"?(!["won","lost"].includes(row.stage)&&Boolean(row.next_follow_up_at)):tab==="waitlist"?row.stage==="waitlist":tab==="closed"?["won","lost"].includes(row.stage):true
      if(!tabOk)return false
      if(!term)return true
      return`${row.name} ${row.email||""} ${row.phone||""} ${row.preferred_room_type||""}`.toLowerCase().includes(term)
    })
  },[data.opportunities,tab,query])

  async function saveOpportunity(draft){
    setSaving(true);data.setError("")
    try{
      if(editTarget){const updated=await data.updateOpportunity(editTarget.id,draft,"Oportunidad actualizada.");setSelectedId(updated.id)}
      else{const created=await data.createOpportunity(draft);setSelectedId(created.id)}
      setFormOpen(false);setEditTarget(null);toast({title:editTarget?"Oportunidad actualizada":"Oportunidad creada",message:draft.stage==="waitlist"?"Quedó en Lista de espera sin bloquear el Planning.":draft.name})
    }catch(err){data.setError(err?.message||"No se pudo guardar la oportunidad.")}
    finally{setSaving(false)}
  }

  async function changeStage(stage){
    if(!selected||saving)return
    setSaving(true);data.setError("")
    try{await data.updateOpportunity(selected.id,{stage,waitlist_until:stage==="waitlist"?selected.waitlist_until:null},`Estado comercial: ${STAGES[stage]||stage}.`);toast({title:"Estado actualizado",message:STAGES[stage]||stage})}
    catch(err){data.setError(err?.message||"No se pudo cambiar el estado.")}
    finally{setSaving(false)}
  }

  async function contact(channel){
    if(!selected)return
    if(channel==="email"&&!selected.email)return data.setError("Esta oportunidad no tiene email.")
    if(["whatsapp","phone"].includes(channel)&&!selected.phone)return data.setError("Esta oportunidad no tiene teléfono.")
    try{
      await data.logActivity(selected.id,channel,`Contacto por ${CHANNELS[channel]||channel}.`,channel,{})
      const fresh=await data.loadActivities(selected.id);setActivities(fresh)
      if(channel==="email")window.location.href=`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent("Consulta de alojamiento")}`
      else if(channel==="whatsapp"){const phone=String(selected.phone||"").replace(/\D/g,"");window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Hola ${selected.name}, te contactamos por tu consulta de alojamiento.`)}`,"_blank","noopener,noreferrer")}
      else window.location.href=`tel:${String(selected.phone||"").replace(/[^+\d]/g,"")}`
    }catch(err){data.setError(err?.message||"No se pudo registrar el contacto.")}
  }

  async function saveFollowUp(){
    if(!selected||!followAt)return
    try{await data.updateOpportunity(selected.id,{next_follow_up_at:followAt,follow_up_channel:followChannel},"Próximo seguimiento programado.");toast({title:"Seguimiento programado",message:`${fmtTime(followAt)} · ${CHANNELS[followChannel]||followChannel}`})}
    catch(err){data.setError(err?.message||"No se pudo programar el seguimiento.")}
  }

  async function addNote(){
    if(!selected||!note.trim())return
    try{await data.logActivity(selected.id,"note",note.trim(),null,{});setNote("");setActivities(await data.loadActivities(selected.id))}
    catch(err){data.setError(err?.message||"No se pudo guardar la nota.")}
  }

  async function verifyAvailability(){
    if(!selected?.desired_check_in||!selected?.desired_check_out)return data.setError("La oportunidad necesita fechas de entrada y salida.")
    setChecking(true);setAvailability(null);data.setError("")
    try{
      const result=await checkAvailability(selected.desired_check_in,selected.desired_check_out)
      const wanted=[selected.preferred_room_type,...(selected.alternative_room_types||[])].filter(Boolean)
      const matching=wanted.length?result.types.filter(type=>wanted.some(name=>String(name).toLowerCase()===String(type.name).toLowerCase())):result.types
      const free=matching.reduce((sum,type)=>sum+Number(type.available||0),0),needed=Math.max(1,Number(selected.rooms_count)||1)
      setAvailability({ok:free>=needed,free,needed,types:matching.filter(type=>Number(type.available)>0).map(type=>`${type.name}: ${type.available}`)})
    }catch(err){data.setError(err?.message||"No se pudo comprobar la disponibilidad.")}
    finally{setChecking(false)}
  }

  function toQuote(){
    if(!selected)return
    const seed={opportunityId:selected.id,name:selected.name,email:selected.email||"",phone:selected.phone||"",start:selected.desired_check_in||"",end:selected.desired_check_out||"",pax:Math.max(1,Number(selected.adults||0)+Number(selected.children||0)),currency:selected.currency||"ARS",notes:selected.notes||"",preferredRoomType:selected.preferred_room_type||"",roomsCount:selected.rooms_count||1}
    localStorage.setItem(`hl:pms-next:crm-quote-seed:${propertyId}`,JSON.stringify(seed));onNavigate?.("quotes",{restoreScroll:false});setTimeout(()=>window.dispatchEvent(new CustomEvent("hl:pms-open-crm-quote-seed")),0)
  }

  async function toReservation(){
    if(!selected||checking)return
    setChecking(true);data.setError("")
    try{await prepareReservationFromCrm({propertyId,opportunity:selected,checkAvailability,onNavigate})}
    catch(err){data.setError(err?.message||"No se pudo preparar la reserva desde CRM.")}
    finally{setChecking(false)}
  }

  const due=row=>row.next_follow_up_at&&new Date(row.next_follow_up_at).getTime()<now&&!["won","lost"].includes(row.stage)
  return <section className={s.page}>
    <header className={s.header}><div><small>GUEST CRM · OPORTUNIDADES</small><h1>CRM</h1><p>Consultas, seguimientos y lista de espera antes de convertirse en reserva.</p></div><button type="button" className={s.primary} onClick={()=>{setEditTarget(null);setFormOpen(true)}}>＋ Nueva oportunidad</button></header>
    {data.error?<div className={s.error}>{data.error}</div>:null}
    <div className={s.stats}><div className={s.stat}><small>Oportunidades abiertas</small><b>{data.openCount}</b></div><div className={s.stat}><small>Lista de espera</small><b>{data.waitlistCount}</b></div><div className={s.stat}><small>Seguimientos vencidos</small><b>{data.overdueCount}</b></div><div className={s.stat}><small>Ganadas</small><b>{data.opportunities.filter(row=>row.stage==="won").length}</b></div></div>
    <div className={s.tabs}>{[["open","Abiertas"],["follow","Seguimiento"],["waitlist","Lista de espera"],["closed","Cerradas"],["all","Todas"]].map(([id,label])=><button key={id} type="button" data-active={tab===id} onClick={()=>setTab(id)}>{label}{id==="waitlist"&&data.waitlistCount?` · ${data.waitlistCount}`:""}{id==="follow"&&data.overdueCount?` · ${data.overdueCount} venc.`:""}</button>)}</div>
    <div className={s.workspace}>
      <section className={s.list}><div className={s.listHead}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar contacto, teléfono, email o habitación…"/></div><div className={s.rows}>{data.loading?<div className={s.empty}>Cargando CRM…</div>:filtered.length?filtered.map(row=><button type="button" key={row.id} className={s.row} data-active={selectedId===row.id} onClick={()=>setSelectedId(row.id)}><span><b>{row.name}</b><small>{row.desired_check_in?`${fmtDate(row.desired_check_in)} → ${fmtDate(row.desired_check_out)}`:"Sin fechas"} · {row.preferred_room_type||"Categoría abierta"}</small><small>{row.email||row.phone||CHANNELS[row.source_channel]||"Sin contacto"}</small></span><span className={s.rowMeta}><em className={s.pill}>{STAGES[row.stage]||row.stage}</em>{due(row)?<small style={{color:"var(--red)",fontWeight:900}}>Seguimiento vencido</small>:row.next_follow_up_at?<small>{fmtTime(row.next_follow_up_at)}</small>:null}</span></button>):<div className={s.empty}>No hay oportunidades en esta vista.</div>}</div></section>
      <section className={s.detail}>{selected?<><div className={s.detailTop}><div><small className={s.eyebrow}>{STAGES[selected.stage]||selected.stage}</small><h2>{selected.name}</h2><p>{[selected.email,selected.phone,CHANNELS[selected.source_channel]].filter(Boolean).join(" · ")}</p></div><div className={s.actions}><button type="button" className={s.soft} onClick={()=>{setEditTarget(selected);setFormOpen(true)}}>Editar</button>{selected.email?<button type="button" className={s.soft} onClick={()=>contact("email")}>Email</button>:null}{selected.phone?<button type="button" className={s.soft} onClick={()=>contact("whatsapp")}>WhatsApp</button>:null}{selected.phone?<button type="button" className={s.soft} onClick={()=>contact("phone")}>Llamar</button>:null}</div></div>
        <div className={s.metaGrid}><div className={s.meta}><small>Estadía deseada</small><b>{fmtDate(selected.desired_check_in)} → {fmtDate(selected.desired_check_out)}</b></div><div className={s.meta}><small>Necesidad</small><b>{selected.rooms_count} hab. · {Number(selected.adults)+Number(selected.children)} pax</b></div><div className={s.meta}><small>Categoría</small><b>{selected.preferred_room_type||"Cualquiera"}</b></div><div className={s.meta}><small>Presupuesto máximo</small><b>{selected.max_budget!=null?money(selected.max_budget,selected.currency):"Sin tope"}</b></div></div>
        <div className={s.section}><div className={s.sectionHead}><h3>Estado comercial</h3><select value={selected.stage} onChange={e=>changeStage(e.target.value)} style={{height:34,border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10.5,padding:"0 8px"}}>{Object.entries(STAGES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>{selected.stage==="waitlist"?<div className={s.availability} data-ok={availability?.ok===true}><b>Lista de espera · no bloquea el Planning.</b><div style={{marginTop:4}}>Espera hasta {fmtDate(selected.waitlist_until)}{selected.flexible_dates?` · fechas flexibles ±${selected.flexibility_days} días`:""}.</div><div style={{marginTop:7,display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}><button type="button" className={s.soft} disabled={checking} onClick={verifyAvailability}>{checking?"Comprobando…":"Comprobar disponibilidad"}</button>{availability?<span><b>{availability.ok?"Hay disponibilidad compatible":"Todavía no alcanza la disponibilidad"}</b> · {availability.free}/{availability.needed} hab.{availability.types.length?` · ${availability.types.join(" · ")}`:""}</span>:null}</div></div>:null}</div>
        <div className={s.section}><div className={s.sectionHead}><h3>Próximo seguimiento</h3>{selected.last_contacted_at?<small>Último contacto {fmtTime(selected.last_contacted_at)}</small>:null}</div><div className={s.followGrid}><input type="datetime-local" value={followAt} onChange={e=>setFollowAt(e.target.value)}/><select value={followChannel} onChange={e=>setFollowChannel(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Teléfono</option><option value="other">Otro</option></select><button type="button" className={s.soft} disabled={!followAt} onClick={saveFollowUp}>Guardar</button></div></div>
        <div className={s.section}><div className={s.sectionHead}><h3>Convertir oportunidad</h3><span style={{fontSize:9.5,color:"var(--muted)"}}>La disponibilidad se valida antes de confirmar.</span></div><div className={s.actions} style={{justifyContent:"flex-start",marginTop:8}}><button type="button" className={s.soft} onClick={toQuote}>Crear presupuesto</button><button type="button" className={s.primary} onClick={toReservation}>Crear reserva</button>{selected.reservation_id?<button type="button" className={s.soft} onClick={()=>onNavigate?.("reservations",{reservationId:selected.reservation_id,restoreScroll:false})}>Abrir reserva</button>:null}</div></div>
        <div className={s.section}><div className={s.sectionHead}><h3>Actividad</h3></div><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:7,marginTop:8}}><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Agregar nota al historial…"/><button type="button" className={s.soft} disabled={!note.trim()} onClick={addNote}>Agregar</button></div><div className={s.activity}>{activityLoading?<div className={s.empty}>Cargando actividad…</div>:activities.length?activities.map(row=><article key={row.id}><b>{CHANNELS[row.channel]||STAGES[row.metadata?.stage]||row.activity_type}</b><small>{fmtTime(row.occurred_at)}</small><p>{row.summary}</p></article>):<div className={s.empty}>Todavía no hay actividad registrada.</div>}</div></div>
      </>:<div className={s.empty} style={{paddingTop:80}}><b>Elegí una oportunidad</b><div style={{marginTop:5}}>Acá vas a ver seguimiento, disponibilidad y conversiones.</div></div>}</section>
    </div>
    <CrmOpportunityForm open={formOpen} initial={editTarget} guests={data.guests} roomTypes={data.roomTypes} saving={saving} onClose={()=>{if(!saving){setFormOpen(false);setEditTarget(null)}}} onSave={saveOpportunity}/>
  </section>
}
