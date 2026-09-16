"use client"

import{useEffect,useMemo,useState}from"react"
import useGuestsData from"./useGuestsData"
import GuestJourneyPanel from"./GuestJourneyPanel"
import GuestSegmentsPanel from"./GuestSegmentsPanel"
import PmsIcon from"../../components/shell/PmsIcons"
import{CRM_SEGMENTS,birthdayInDays,crmSignals,loyaltySuggestion,marketingState,segmentById,segmentCounts,segmentReason,spendLabel}from"./guestCrm"
import s from"./guests.module.css"

const initials=name=>String(name||"H").trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".",""):"—"
const vipLabel=value=>value==="signature"?"Signature":value==="vip"?"VIP":value==="frequent"?"Habitual":"Estándar"
const statusLabel=value=>value==="alojado"?"En hotel":value==="finalizada"?"Finalizada":value==="cancelada"?"Cancelada":value==="pendiente"?"Pendiente":value==="tentativa"?"Tentativa":"Confirmada"
const todayKey=()=>new Date().toLocaleDateString("en-CA")
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)

function guestState(guest){
  if(guest?.currentStay)return{label:"En casa",tone:"green",detail:`Hasta ${fmtDate(guest.currentStay.checkOut)}`}
  if(guest?.nextStay)return{label:"Próxima llegada",tone:"violet",detail:fmtDate(guest.nextStay)}
  if((guest?.stays||0)>=3)return{label:"Huésped habitual",tone:"gold",detail:`${guest.stays} estadías`}
  if((guest?.stays||0)>0)return{label:"Con historial",tone:"blue",detail:`${guest.stays} estadía${guest.stays===1?"":"s"}`}
  return{label:"Nuevo perfil",tone:"neutral",detail:"Sin estadías"}
}

function safePreferenceRows(preferences={}){
  return Object.entries(preferences||{}).filter(([key,value])=>key!=="marketing"&&value!=null&&["string","number","boolean"].includes(typeof value)).slice(0,8)
}

export default function GuestsWorkspace({propertyId,onNavigate,allowedViews=[]}){
  const data=useGuestsData(propertyId)
  const[query,setQuery]=useState("")
  const[activeSegment,setActiveSegment]=useState("")
  const[selectedId,setSelectedId]=useState("")
  const[profileTab,setProfileTab]=useState("summary")
  const[overlay,setOverlay]=useState("")
  const[formOpen,setFormOpen]=useState(false)
  const[saving,setSaving]=useState(false)
  const[draft,setDraft]=useState(null)

  const segment=segmentById(activeSegment)
  const counts=useMemo(()=>segmentCounts(data.guests),[data.guests])
  const signalCount=useMemo(()=>data.guests.filter(item=>crmSignals(item).length>0).length,[data.guests])
  const selected=useMemo(()=>data.guests.find(item=>item.id===selectedId)||null,[data.guests,selectedId])
  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase()
    return data.guests.filter(item=>(!segment||segment.match(item))&&(!term||`${item.full_name} ${item.email||""} ${item.phone||""} ${item.country||""} ${(item.tags||[]).join(" ")} ${item.dominantChannel||""}`.toLowerCase().includes(term)))
  },[data.guests,query,segment])
  const selectedReservations=useMemo(()=>selected?data.reservations.filter(item=>item.guest_profile_id===selected.id).sort((a,b)=>String(b.fecha_entrada||"").localeCompare(String(a.fecha_entrada||""))):[],[data.reservations,selected])
  const primaryReservation=useMemo(()=>{
    if(!selectedReservations.length)return null
    const current=selectedReservations.find(item=>item.estado==="alojado")
    if(current)return current
    const today=todayKey()
    return [...selectedReservations].filter(item=>item.estado!=="cancelada"&&String(item.fecha_entrada||"")>=today).sort((a,b)=>String(a.fecha_entrada).localeCompare(String(b.fecha_entrada)))[0]||selectedReservations[0]
  },[selectedReservations])
  const marketing=selected?marketingState(selected):{email:false,whatsapp:false}
  const signals=selected?crmSignals(selected):[]
  const suggestion=selected?loyaltySuggestion(selected):null
  const state=selected?guestState(selected):null
  const preferenceRows=selected?safePreferenceRows(selected.preferences):[]
  const canReservations=allowedViews.includes("reservations")
  const canPlanning=allowedViews.includes("planning")

  useEffect(()=>{
    if(data.loading||typeof window==="undefined")return
    const id=new URL(window.location.href).searchParams.get("guest_profile")
    if(id&&data.guests.some(item=>item.id===id)){setSelectedId(id);setProfileTab("summary")}
  },[data.loading,data.guests])

  function setProfileUrl(id){if(typeof window==="undefined")return;const url=new URL(window.location.href);if(id)url.searchParams.set("guest_profile",id);else url.searchParams.delete("guest_profile");window.history.replaceState(window.history.state,"",url)}
  function openProfile(item){setSelectedId(item.id);setProfileTab("summary");setProfileUrl(item.id)}
  function closeProfile(){setSelectedId("");setProfileUrl("")}
  function chooseSegment(id){setActiveSegment(id);setOverlay("")}
  function openNew(){setDraft({full_name:"",email:"",phone:"",birth_date:"",document_type:"DNI",document_number:"",country:"Argentina",nationality:"Argentina",language:"es",vip_level:"standard",notes:""});data.setError("");setFormOpen(true)}
  function openEdit(){if(!selected)return;setDraft({id:selected.id,full_name:selected.full_name||"",email:selected.email||"",phone:selected.phone||"",birth_date:selected.birth_date||"",document_type:selected.document_type||"DNI",document_number:selected.document_number||"",country:selected.country||"",nationality:selected.nationality||"",language:selected.language||"es",vip_level:selected.vip_level||"standard",notes:selected.notes||""});data.setError("");setFormOpen(true)}
  async function saveDraft(){
    if(!draft?.full_name?.trim())return data.setError("Ingresá el nombre del huésped.")
    setSaving(true);data.setError("")
    try{
      const payload={full_name:draft.full_name.trim(),email:draft.email?.trim()||null,phone:draft.phone?.trim()||null,birth_date:draft.birth_date||null,document_type:draft.document_type||null,document_number:draft.document_number?.trim()||null,country:draft.country?.trim()||null,nationality:draft.nationality?.trim()||null,language:draft.language||"es",vip_level:draft.vip_level||"standard",notes:draft.notes?.trim()||null}
      if(draft.id){const updated=await data.updateGuest(draft.id,payload);setSelectedId(updated.id)}else await data.createGuest(payload)
      setFormOpen(false);setDraft(null)
    }catch(err){data.setError(err?.message||"No se pudo guardar el huésped.")}finally{setSaving(false)}
  }
  async function saveProfile(patch){if(!selected)return;setSaving(true);data.setError("");try{await data.updateGuest(selected.id,patch)}catch(err){data.setError(err?.message||"No se pudo actualizar el huésped.")}finally{setSaving(false)}}
  async function saveMarketing(channel,value){if(!selected)return;const nextPreferences={...(selected.preferences||{}),marketing:{...(selected.preferences?.marketing||{}),[channel]:value,updated_at:new Date().toISOString(),source:"pms"}};await saveProfile({preferences:nextPreferences})}
  function openReservation(){if(primaryReservation&&canReservations)onNavigate?.("reservations",{reservationId:Number(primaryReservation.id),restoreScroll:false})}
  function openWhatsapp(){const digits=String(selected?.phone||"").replace(/\D/g,"");if(digits&&typeof window!=="undefined")window.open(`https://wa.me/${digits}`,"_blank","noopener,noreferrer")}
  function openEmail(){if(selected?.email&&typeof window!=="undefined")window.location.href=`mailto:${selected.email}`}

  const quickSegments=["upcoming","repeat","vip","birthday","dormant"].map(segmentById).filter(Boolean)
  const tabs=[
    ["summary","Resumen","info","bronze"],
    ["stays","Estadías","calendar","blue"],
    ["contact","Contacto","message","teal"],
    ["preferences","Preferencias","services","violet"],
    ["loyalty","Fidelidad","growth","gold"],
  ]

  return <section className={s.page}>
    <header className={s.heading}>
      <div><small>GUESTBOOK · CRM HOTELERO</small><h1>Huéspedes</h1><p>Una ficha viva por huésped: estadías, preferencias y oportunidades en un solo lugar.</p></div>
      <div className={s.headerActions}>
        <button type="button" className={s.softButton} onClick={()=>setOverlay("segments")}><PmsIcon name="filter"/>Segmentos</button>
        <button type="button" className={s.softButton} onClick={()=>setOverlay("journey")}><PmsIcon name="calendar"/>Pre check-in</button>
        <button type="button" className={s.primary} onClick={openNew}><PmsIcon name="plus"/>Agregar huésped</button>
      </div>
    </header>

    {data.error&&<div className={s.errorBanner}>{data.error}</div>}

    <div className={s.workspace}>
      <aside className={s.indexPanel}>
        <div className={s.indexHead}>
          <div><small>ÍNDICE DEL GUESTBOOK</small><b>{data.guests.length} perfiles</b></div>
          <span className={s.signalPill}>{signalCount} señales</span>
        </div>
        <label className={s.search}><PmsIcon name="search"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar huésped, teléfono o canal"/></label>
        <div className={s.segmentStrip}>
          <button type="button" className={!activeSegment?s.segmentActive:""} onClick={()=>setActiveSegment("")}>Todos <b>{data.guests.length}</b></button>
          {quickSegments.map(item=><button type="button" key={item.id} className={activeSegment===item.id?s.segmentActive:""} onClick={()=>setActiveSegment(activeSegment===item.id?"":item.id)}>{item.label}<b>{counts[item.id]||0}</b></button>)}
        </div>
        {segment?<div className={s.segmentContext}><span>{segment.label}</span><button type="button" onClick={()=>setActiveSegment("")} aria-label="Quitar filtro"><PmsIcon name="close" size={14}/></button></div>:null}
        <div className={s.guestList}>
          {data.loading?<div className={s.empty}>Cargando guestbook…</div>:filtered.map(item=>{const itemState=guestState(item),contact=marketingState(item);return <button type="button" key={item.id} className={`${s.guestRow} ${selectedId===item.id?s.guestRowActive:""}`} onClick={()=>openProfile(item)}>
            <span className={s.avatar}>{initials(item.full_name)}</span>
            <span className={s.guestIdentity}><b>{item.full_name}</b><small>{item.nextStay?`Llega ${fmtDate(item.nextStay)}`:item.lastStay?`Última ${fmtDate(item.lastStay)}`:"Sin estadías"}</small></span>
            <span className={s.guestMeta}><i data-tone={itemState.tone}/><small>{itemState.label}</small>{contact.canEmail||contact.canWhatsapp?<em title="Contacto autorizado">●</em>:null}</span>
          </button>})}
          {!data.loading&&!filtered.length?<div className={s.empty}>No hay huéspedes que coincidan con este filtro.</div>:null}
        </div>
      </aside>

      <section className={s.stage}>
        {selected?<article className={s.dossier}>
          <div className={s.dossierTexture}/>
          <header className={s.dossierHead}>
            <div className={s.profileLead}><span className={s.profileAvatar}>{initials(selected.full_name)}</span><div><small>FICHA DE HUÉSPED</small><h2>{selected.full_name}</h2><div className={s.profileSub}><span className={s.stateBadge} data-tone={state.tone}>{state.label}</span><span>{state.detail}</span><span>{selected.country||selected.nationality||"País sin registrar"}</span></div></div></div>
            <div className={s.profileActions}>
              {primaryReservation&&canReservations?<button type="button" className={s.actionGreen} onClick={openReservation}><PmsIcon name="booking"/>Abrir reserva</button>:canPlanning?<button type="button" className={s.actionGreen} onClick={()=>onNavigate?.("planning")}><PmsIcon name="plus"/>Nueva reserva</button>:null}
              <button type="button" className={s.actionNeutral} onClick={openEdit}><PmsIcon name="edit"/>Editar</button>
              <button type="button" className={s.actionRed} onClick={closeProfile} aria-label="Cerrar ficha"><PmsIcon name="close"/></button>
            </div>
          </header>

          <div className={s.metricBand}>
            <div><span>Estadías</span><b>{selected.stays||0}</b></div>
            <div><span>Noches</span><b>{selected.nights||0}</b></div>
            <div><span>{selected.nextStay?"Próxima":"Última"}</span><b>{fmtDate(selected.nextStay||selected.lastStay||selected.last_stay_at)}</b></div>
            <div><span>Valor de estadías</span><b>{spendLabel(selected.spentByCurrency)}</b></div>
          </div>

          <div className={s.dossierBody}>
            <nav className={s.tabRail} aria-label="Secciones de la ficha">{tabs.map(([id,label,icon,tone])=><button type="button" key={id} data-tone={tone} className={profileTab===id?s.tabActive:""} onClick={()=>setProfileTab(id)}><span><PmsIcon name={icon} size={16}/></span><b>{label}</b></button>)}</nav>
            <div className={s.profileContent}>
              {profileTab==="summary"?<div className={s.summaryGrid}>
                <section className={`${s.panel} ${s.heroPanel}`}><header><div><small>AHORA</small><h3>Contexto del huésped</h3></div><span className={s.stateDot} data-tone={state.tone}/></header><div className={s.contextRows}><div><span>Canal habitual</span><b>{selected.dominantChannel||"Sin historial"}</b></div><div><span>Cumpleaños</span><b>{selected.birth_date?`${fmtDate(selected.birth_date)} · ${birthdayInDays(selected.birth_date)===0?"Hoy":`en ${birthdayInDays(selected.birth_date)} días`}`:"Sin fecha"}</b></div><div><span>Último canal</span><b>{selected.lastChannel||"—"}</b></div><div><span>Nivel</span><b>{vipLabel(selected.vip_level)}</b></div></div></section>
                <section className={s.panel}><header><div><small>SEÑALES</small><h3>Qué conviene mirar</h3></div><PmsIcon name="growth"/></header>{signals.length?<div className={s.signalList}>{signals.slice(0,4).map(item=><div key={item.id}><b>{item.label}</b><span>{segmentReason(item,selected)}</span></div>)}</div>:<div className={s.softEmpty}>Sin alertas ni oportunidades pendientes.</div>}</section>
                <section className={s.panel}><header><div><small>RECONOCIMIENTO</small><h3>Notas de recepción</h3></div><PmsIcon name="guest"/></header><p className={s.noteCopy}>{selected.notes||"Todavía no hay notas para reconocer a este huésped."}</p>{(selected.tags||[]).length?<div className={s.tagRow}>{selected.tags.map(tag=><span key={tag}>{tag}</span>)}</div>:null}</section>
                <section className={s.panel}><header><div><small>CONTACTO RÁPIDO</small><h3>Canales disponibles</h3></div><PmsIcon name="message"/></header><div className={s.quickContact}><button type="button" disabled={!selected.phone} onClick={openWhatsapp}>WhatsApp<span>{selected.phone||"Sin teléfono"}</span></button><button type="button" disabled={!selected.email} onClick={openEmail}>Email<span>{selected.email||"Sin email"}</span></button></div></section>
              </div>:null}

              {profileTab==="stays"?<section className={s.timelinePanel}><header><div><small>HISTORIAL REAL</small><h3>Estadías y reservas</h3></div><span>{selectedReservations.length} registros</span></header><div className={s.timeline}>{selectedReservations.length?selectedReservations.map(item=><article key={item.id}><span className={s.timelineMark}/><div><b>{fmtDate(item.fecha_entrada)} → {fmtDate(item.fecha_salida)}</b><small>{item.canal_reserva||"Directa"} · {statusLabel(item.estado)}</small></div><strong>{money(item.precio_total,item.moneda)}</strong>{canReservations?<button type="button" onClick={()=>onNavigate?.("reservations",{reservationId:Number(item.id),restoreScroll:false})}>Ver reserva <PmsIcon name="chevronRight" size={14}/></button>:null}</article>):<div className={s.softEmpty}>Todavía no hay estadías vinculadas a este perfil.</div>}</div></section>:null}

              {profileTab==="contact"?<div className={s.twoColumns}><section className={s.panel}><header><div><small>IDENTIDAD</small><h3>Datos personales</h3></div><PmsIcon name="guest"/></header><div className={s.detailList}><div><span>Email</span><b>{selected.email||"—"}</b></div><div><span>Teléfono</span><b>{selected.phone||"—"}</b></div><div><span>Documento</span><b>{selected.document_number?`${selected.document_type||"Doc."} ${selected.document_number}`:"—"}</b></div><div><span>Idioma</span><b>{selected.language||"—"}</b></div><div><span>Nacionalidad</span><b>{selected.nationality||"—"}</b></div></div></section><section className={s.panel}><header><div><small>UBICACIÓN</small><h3>Procedencia</h3></div><PmsIcon name="info"/></header><div className={s.detailList}><div><span>País</span><b>{selected.country||"—"}</b></div><div><span>Ciudad</span><b>{selected.city||"—"}</b></div><div><span>Provincia</span><b>{selected.province||"—"}</b></div><div><span>Dirección</span><b>{selected.address||"—"}</b></div><div><span>Fecha de alta</span><b>{fmtDate(selected.created_at)}</b></div></div></section></div>:null}

              {profileTab==="preferences"?<div className={s.twoColumns}><section className={s.panel}><header><div><small>PREFERENCIAS</small><h3>Cómo recibirlo mejor</h3></div><PmsIcon name="services"/></header>{preferenceRows.length?<div className={s.detailList}>{preferenceRows.map(([key,value])=><div key={key}><span>{key.replaceAll("_"," ")}</span><b>{typeof value==="boolean"?(value?"Sí":"No"):String(value)}</b></div>)}</div>:<div className={s.softEmpty}>No hay preferencias estructuradas todavía. Podés registrarlas desde las notas o el flujo de reserva.</div>}</section><section className={s.panel}><header><div><small>NOTAS Y ETIQUETAS</small><h3>Memoria del hotel</h3></div><PmsIcon name="info"/></header><p className={s.noteCopy}>{selected.notes||"Sin notas internas."}</p>{(selected.tags||[]).length?<div className={s.tagRow}>{selected.tags.map(tag=><span key={tag}>{tag}</span>)}</div>:<div className={s.softEmpty}>Sin etiquetas.</div>}</section></div>:null}

              {profileTab==="loyalty"?<div className={s.twoColumns}><section className={s.panel}><header><div><small>FIDELIZACIÓN</small><h3>Nivel del huésped</h3></div><PmsIcon name="growth"/></header><label className={s.levelField}>Nivel<select value={selected.vip_level||"standard"} disabled={saving} onChange={event=>saveProfile({vip_level:event.target.value})}><option value="standard">Estándar</option><option value="frequent">Habitual</option><option value="vip">VIP</option><option value="signature">Signature</option></select></label>{suggestion?<div className={s.suggestion}><b>{suggestion.label}</b><span>{suggestion.detail}</span></div>:<div className={s.softEmpty}>Sin sugerencias automáticas por ahora.</div>}</section><section className={s.panel}><header><div><small>CONSENTIMIENTO</small><h3>Contacto comercial</h3></div><PmsIcon name="message"/></header><div className={s.consentList}><label className={marketing.email?s.consentOn:""}><span><b>Email</b><small>{selected.email||"Sin email"}</small></span><input type="checkbox" checked={marketing.email} disabled={saving||!selected.email} onChange={event=>saveMarketing("email",event.target.checked)}/><i/></label><label className={marketing.whatsapp?s.consentOn:""}><span><b>WhatsApp</b><small>{selected.phone||"Sin teléfono"}</small></span><input type="checkbox" checked={marketing.whatsapp} disabled={saving||!selected.phone} onChange={event=>saveMarketing("whatsapp",event.target.checked)}/><i/></label></div><p className={s.consentHelp}>Activá un canal sólo cuando exista autorización del huésped.</p></section></div>:null}
            </div>
          </div>
        </article>:<div className={s.welcome}>
          <div className={s.welcomeMark}><PmsIcon name="guest" size={30}/></div><small>GUESTBOOK</small><h2>Elegí un huésped del índice</h2><p>La ficha reúne contexto, historial, preferencias y oportunidades sin salir del CRM.</p><div className={s.welcomeStats}><span><b>{data.guests.length}</b> perfiles</span><span><b>{counts.upcoming||0}</b> próximas llegadas</span><span><b>{counts.vip||0}</b> VIP / Signature</span><span><b>{signalCount}</b> señales para actuar</span></div>
        </div>}
      </section>
    </div>

    {overlay?<div className={s.overlay} onMouseDown={event=>event.target===event.currentTarget&&setOverlay("")}><section className={s.overlayPanel}><header><div><small>{overlay==="segments"?"CRM INTELIGENTE":"EXPERIENCIA DEL HUÉSPED"}</small><h2>{overlay==="segments"?"Segmentos y oportunidades":"Pre check-in y excepciones"}</h2></div><button type="button" className={s.actionRed} onClick={()=>setOverlay("")} aria-label="Cerrar"><PmsIcon name="close"/></button></header><div className={s.overlayBody}>{overlay==="segments"?<GuestSegmentsPanel guests={data.guests} activeSegment={activeSegment} onSegment={chooseSegment} initialExpanded/>:<GuestJourneyPanel propertyId={propertyId}/>}</div></section></div>:null}

    {formOpen&&draft?<div className={s.overlay} onMouseDown={event=>event.target===event.currentTarget&&setFormOpen(false)}><section className={s.formModal}><header><div><small>{draft.id?"EDITAR FICHA":"NUEVO HUÉSPED"}</small><h2>{draft.id?draft.full_name:"Agregar huésped"}</h2></div><button type="button" className={s.actionRed} onClick={()=>setFormOpen(false)} aria-label="Cerrar"><PmsIcon name="close"/></button></header><div className={s.formGrid}><label className={s.wide}>Nombre completo<input value={draft.full_name} onChange={event=>setDraft(value=>({...value,full_name:event.target.value}))} autoFocus/></label><label>Email<input type="email" value={draft.email||""} onChange={event=>setDraft(value=>({...value,email:event.target.value}))}/></label><label>Teléfono<input value={draft.phone||""} onChange={event=>setDraft(value=>({...value,phone:event.target.value}))}/></label><label>Fecha de nacimiento<input type="date" value={draft.birth_date||""} onChange={event=>setDraft(value=>({...value,birth_date:event.target.value}))}/></label><label>Idioma<select value={draft.language||"es"} onChange={event=>setDraft(value=>({...value,language:event.target.value}))}><option value="es">Español</option><option value="en">English</option><option value="pt">Português</option></select></label><label>Tipo de documento<select value={draft.document_type||"DNI"} onChange={event=>setDraft(value=>({...value,document_type:event.target.value}))}><option value="DNI">DNI</option><option value="Pasaporte">Pasaporte</option><option value="CI">CI</option><option value="Otro">Otro</option></select></label><label>Número de documento<input value={draft.document_number||""} onChange={event=>setDraft(value=>({...value,document_number:event.target.value}))}/></label><label>País<input value={draft.country||""} onChange={event=>setDraft(value=>({...value,country:event.target.value}))}/></label><label>Nacionalidad<input value={draft.nationality||""} onChange={event=>setDraft(value=>({...value,nationality:event.target.value}))}/></label><label>Nivel<select value={draft.vip_level||"standard"} onChange={event=>setDraft(value=>({...value,vip_level:event.target.value}))}><option value="standard">Estándar</option><option value="frequent">Habitual</option><option value="vip">VIP</option><option value="signature">Signature</option></select></label><label className={s.wide}>Notas internas<textarea value={draft.notes||""} onChange={event=>setDraft(value=>({...value,notes:event.target.value}))}/></label></div>{data.error?<div className={s.formError}>{data.error}</div>:null}<footer><button type="button" className={s.cancelButton} onClick={()=>setFormOpen(false)}>Cancelar</button><button type="button" className={s.saveButton} disabled={saving} onClick={saveDraft}><PmsIcon name="check"/>{saving?"Guardando…":"Guardar ficha"}</button></footer></section></div>:null}
  </section>
}
