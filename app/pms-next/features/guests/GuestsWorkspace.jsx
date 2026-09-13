"use client"

import{useEffect,useMemo,useState}from"react"
import useGuestsData from"./useGuestsData"
import GuestJourneyPanel from"./GuestJourneyPanel"
import GuestSegmentsPanel from"./GuestSegmentsPanel"
import{birthdayInDays,crmSignals,loyaltySuggestion,marketingState,segmentById,segmentCounts,spendLabel}from"./guestCrm"
import s from"./guests.module.css"
import c from"./guestCrmCompact.module.css"

const initials=name=>String(name||"H").trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".",""):"—"
const vipLabel=value=>value==="signature"?"Signature":value==="vip"?"VIP":value==="frequent"?"Habitual":"Estándar"
const birthdayLabel=value=>{const days=birthdayInDays(value);if(days==null)return"Sin fecha";if(days===0)return"Hoy";if(days===1)return"Mañana";return`En ${days} días`}

function Icon({name}){
  const paths={
    users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    spark:<><path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5L12 3Z"/><path d="m5 15-.75 2.25L2 18l2.25.75L5 21l.75-2.25L8 18l-2.25-.75L5 15ZM19 13l-.75 2.25L16 16l2.25.75L19 19l.75-2.25L22 16l-2.25-.75L19 13Z"/></>,
    filter:<><path d="M4 5h16M7 12h10M10 19h4"/></>,
    check:<><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="3"/><path d="m8 16 2.5 2.5L16 13"/></>,
    plus:<><path d="M12 5v14M5 12h14"/></>,
    search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    close:<><path d="M6 6l12 12M18 6 6 18"/></>,
    arrow:<><path d="M5 12h14M13 6l6 6-6 6"/></>,
    heart:<><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  }
  return <svg className={s.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.users}</svg>
}

export default function GuestsWorkspace({propertyId}){
  const data=useGuestsData(propertyId)
  const[query,setQuery]=useState(""),[activeSegment,setActiveSegment]=useState(""),[selected,setSelected]=useState(null),[profileTab,setProfileTab]=useState("summary"),[overlay,setOverlay]=useState(""),[formOpen,setFormOpen]=useState(false),[saving,setSaving]=useState(false),[draft,setDraft]=useState(null)
  const segment=segmentById(activeSegment)
  const counts=useMemo(()=>segmentCounts(data.guests),[data.guests])
  const signalCount=useMemo(()=>data.guests.filter(item=>crmSignals(item).length>0).length,[data.guests])
  const filtered=useMemo(()=>{const term=query.trim().toLowerCase();return data.guests.filter(item=>(!segment||segment.match(item))&&(!term||`${item.full_name} ${item.email||""} ${item.phone||""} ${item.country||""} ${(item.tags||[]).join(" ")} ${item.dominantChannel||""}`.toLowerCase().includes(term)))},[data.guests,query,segment])

  useEffect(()=>{if(data.loading||!data.guests.length||typeof window==="undefined")return;const id=new URL(window.location.href).searchParams.get("guest_profile");if(id&&selected?.id!==id){const match=data.guests.find(item=>item.id===id);if(match){setSelected(match);setProfileTab("summary")}}},[data.loading,data.guests,selected?.id])
  function setProfileUrl(id){if(typeof window==="undefined")return;const url=new URL(window.location.href);if(id)url.searchParams.set("guest_profile",id);else url.searchParams.delete("guest_profile");window.history.replaceState(window.history.state,"",url)}
  function openProfile(item){setSelected(item);setProfileTab("summary");setProfileUrl(item.id)}
  function closeProfile(){setSelected(null);setProfileUrl("")}
  function chooseSegment(id){setActiveSegment(id);setOverlay("")}
  function openNew(){setDraft({full_name:"",email:"",phone:"",country:"Argentina",nationality:"Argentina",language:"es",vip_level:"standard",notes:""});data.setError("");setFormOpen(true)}
  async function saveNew(){if(!draft.full_name.trim())return data.setError("Ingresá el nombre del huésped.");setSaving(true);data.setError("");try{await data.createGuest(draft);setFormOpen(false)}catch(err){data.setError(err?.message||"No se pudo crear el huésped.")}finally{setSaving(false)}}
  async function saveProfile(patch){if(!selected)return;setSaving(true);data.setError("");try{const updated=await data.updateGuest(selected.id,patch);setSelected(current=>({...current,...updated}))}catch(err){data.setError(err?.message||"No se pudo actualizar el huésped.")}finally{setSaving(false)}}
  async function saveMarketing(channel,value){if(!selected)return;const nextPreferences={...(selected.preferences||{}),marketing:{...(selected.preferences?.marketing||{}),[channel]:value,updated_at:new Date().toISOString(),source:"pms"}};await saveProfile({preferences:nextPreferences})}

  const marketing=selected?marketingState(selected):{email:false,whatsapp:false},suggestion=selected?loyaltySuggestion(selected):null
  const dock=[
    {id:"all",icon:"users",label:"Directorio",value:data.guests.length,detail:"Todos los perfiles",action:()=>setActiveSegment("")},
    {id:"loyal",icon:"heart",label:"Fidelización",value:counts.loyal||0,detail:"Huéspedes frecuentes",action:()=>setActiveSegment("loyal")},
    {id:"signals",icon:"spark",label:"Oportunidades",value:signalCount,detail:"Señales para actuar",action:()=>setOverlay("segments")},
    {id:"upcoming",icon:"calendar",label:"Próximas",value:counts.upcoming||0,detail:"Con reserva futura",action:()=>setActiveSegment("upcoming")},
  ]

  return <section className={s.page}>
    <header className={s.heading}>
      <div><small>CRM DE HUÉSPEDES</small><h1>Huéspedes</h1></div>
      <div className={s.headerActions}>
        <button type="button" className={s.softButton} onClick={()=>setOverlay("segments")}><Icon name="filter"/>Segmentos</button>
        <button type="button" className={s.softButton} onClick={()=>setOverlay("journey")}><Icon name="check"/>Pre check-in</button>
        <button type="button" className={s.primary} onClick={openNew}><Icon name="plus"/>Agregar huésped</button>
      </div>
    </header>

    {data.error&&<div className={s.errorBanner}>{data.error}</div>}

    <nav className={s.dock} aria-label="Accesos del CRM">{dock.map(item=><button type="button" key={item.id} onClick={item.action} className={(item.id===activeSegment||item.id==="all"&&!activeSegment)?s.dockActive:""}><span className={s.dockIcon}><Icon name={item.icon}/></span><span className={s.dockText}><b>{item.label}</b><small>{item.detail}</small></span><strong>{item.value}</strong><Icon name="arrow"/></button>)}</nav>

    <section className={s.directory}>
      <div className={s.directoryHead}>
        <div className={s.directoryTitle}><div><b>{segment?segment.label:"Directorio"}</b><span>{filtered.length} {filtered.length===1?"huésped":"huéspedes"}</span></div>{segment?<button type="button" onClick={()=>setActiveSegment("")}><Icon name="close"/>Quitar filtro</button>:null}</div>
        <label className={s.search}><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nombre, email, teléfono o canal"/><kbd>⌘ K</kbd></label>
      </div>
      <div className={s.guestScroller}>
        {data.loading?<div className={s.empty}>Cargando huéspedes…</div>:filtered.length?<div className={s.guestGrid}>{filtered.map(item=>{const contact=marketingState(item);return <button type="button" className={s.guestCard} key={item.id} onClick={()=>openProfile(item)}>
          <div className={s.guestTop}><span className={s.avatar}>{initials(item.full_name)}</span><div className={s.guestIdentity}><b>{item.full_name}</b><small>{item.country||item.nationality||"Sin país"} · {vipLabel(item.vip_level)}</small></div><span className={`${s.contactDot} ${contact.canEmail||contact.canWhatsapp?s.contactOk:""}`} title={contact.canEmail||contact.canWhatsapp?"Contacto comercial autorizado":"Sin canal comercial autorizado"}/></div>
          <div className={s.guestStats}><span><small>Estadías</small><b>{item.stays||0}</b></span><span><small>{item.nextStay?"Próxima":"Última"}</small><b>{fmtDate(item.nextStay||item.lastStay||item.last_stay_at)}</b></span><span><small>Canal</small><b>{item.dominantChannel||"—"}</b></span></div>
          <div className={s.guestBottom}><span>{spendLabel(item.spentByCurrency)}</span><span>Ver perfil <Icon name="arrow"/></span></div>
        </button>})}</div>:<div className={s.empty}>No encontramos huéspedes con este filtro.</div>}
      </div>
    </section>

    {overlay&&<div className={s.floatingShade} onMouseDown={e=>e.target===e.currentTarget&&setOverlay("")}><section className={`${s.floatingPanel} ${overlay==="journey"?s.floatingWide:""}`}>
      <header className={s.floatingHead}><div><small>{overlay==="segments"?"CRM INTELIGENTE":"EXPERIENCIA DEL HUÉSPED"}</small><h2>{overlay==="segments"?"Segmentos y oportunidades":"Pre check-in y excepciones"}</h2><p>{overlay==="segments"?"Elegí una regla y volvés al directorio ya filtrado.":"La operación previa a la llegada, sin ocupar la pantalla principal."}</p></div><button type="button" className={s.close} onClick={()=>setOverlay("")}><Icon name="close"/></button></header>
      <div className={s.floatingBody}>{overlay==="segments"?<GuestSegmentsPanel guests={data.guests} activeSegment={activeSegment} onSegment={chooseSegment} initialExpanded/>:<GuestJourneyPanel propertyId={propertyId}/>}</div>
    </section></div>}

    {selected&&<div className={s.drawerShade} onMouseDown={e=>e.target===e.currentTarget&&closeProfile()}><aside className={s.drawer}>
      <header className={s.profileHead}><div className={s.profileIdentity}><span className={s.avatar}>{initials(selected.full_name)}</span><div><small>PERFIL 360°</small><h2>{selected.full_name}</h2><p>{selected.country||selected.nationality||"Sin país"} · {vipLabel(selected.vip_level)}</p></div></div><button className={s.close} onClick={closeProfile}><Icon name="close"/></button></header>
      <div className={s.profileMetrics}><div><small>Estadías</small><b>{selected.stays||0}</b></div><div><small>Noches</small><b>{selected.nights||0}</b></div><div><small>Próxima</small><b>{fmtDate(selected.nextStay)}</b></div><div><small>Valor</small><b>{spendLabel(selected.spentByCurrency)}</b></div></div>
      <nav className={s.profileTabs}>{[["summary","Resumen"],["contact","Contacto"],["loyalty","Fidelización"]].map(([id,label])=><button type="button" key={id} className={profileTab===id?s.profileTabActive:""} onClick={()=>setProfileTab(id)}>{label}</button>)}</nav>
      <div className={s.profileBody}>
        {profileTab==="summary"&&<><section className={s.section}><small>RELACIÓN</small><h3>Contexto del huésped</h3><div className={s.meta}><div><span>Canal habitual</span><b>{selected.dominantChannel||"Sin historial"}</b></div><div><span>Última estadía</span><b>{fmtDate(selected.lastStay||selected.last_stay_at)}</b></div><div><span>Cumpleaños</span><b>{selected.birth_date?`${fmtDate(selected.birth_date)} · ${birthdayLabel(selected.birth_date)}`:"Sin fecha"}</b></div><div><span>Último canal</span><b>{selected.lastChannel||"—"}</b></div></div></section><section className={s.section}><small>PREFERENCIAS</small><h3>Notas para reconocerlo</h3><div className={s.notes}>{selected.notes||"Todavía no hay notas operativas."}</div>{(selected.tags||[]).length>0&&<div className={s.tagRow}>{selected.tags.map(tag=><span key={tag}>{tag}</span>)}</div>}</section></>}
        {profileTab==="contact"&&<section className={s.section}><small>DATOS DEL HUÉSPED</small><h3>Contacto e identidad</h3><div className={s.meta}><div><span>Email</span><b>{selected.email||"—"}</b></div><div><span>Teléfono</span><b>{selected.phone||"—"}</b></div><div><span>Documento</span><b>{selected.document_number?`${selected.document_type||"Doc."} ${selected.document_number}`:"—"}</b></div><div><span>País</span><b>{selected.country||"—"}</b></div><div><span>Nacionalidad</span><b>{selected.nationality||"—"}</b></div><div><span>Idioma</span><b>{selected.language||"—"}</b></div></div></section>}
        {profileTab==="loyalty"&&<><section className={s.section}><small>CONTACTO COMERCIAL</small><h3>Consentimiento por canal</h3><div className={c.loyaltyBox}><div className={c.consentGrid}><label className={`${c.consentCard} ${marketing.email?c.on:""} ${!selected.email?c.disabled:""}`}><span><b>Email</b><small>{!selected.email?"Sin email":marketing.email?"Autorizado":"No autorizado"}</small></span><input type="checkbox" checked={marketing.email} disabled={saving||!selected.email} onChange={e=>saveMarketing("email",e.target.checked)}/><i className={c.switch}/></label><label className={`${c.consentCard} ${marketing.whatsapp?c.on:""} ${!selected.phone?c.disabled:""}`}><span><b>WhatsApp</b><small>{!selected.phone?"Sin teléfono":marketing.whatsapp?"Autorizado":"No autorizado"}</small></span><input type="checkbox" checked={marketing.whatsapp} disabled={saving||!selected.phone} onChange={e=>saveMarketing("whatsapp",e.target.checked)}/><i className={c.switch}/></label></div>{suggestion?<div className={c.suggestion}><span><b>{suggestion.label}</b><small>{suggestion.detail}</small></span></div>:null}<div className={c.consentFoot}>Activá un canal sólo cuando exista autorización del huésped.</div></div></section><section className={s.section}><small>NIVEL</small><h3>Fidelización</h3><label className={s.selectLabel}>Nivel<select value={selected.vip_level} disabled={saving} onChange={e=>saveProfile({vip_level:e.target.value})}><option value="standard">Estándar</option><option value="frequent">Habitual</option><option value="vip">VIP</option><option value="signature">Signature</option></select></label></section></>}
      </div>
    </aside></div>}

    {formOpen&&draft&&<div className={s.modalShade} onMouseDown={e=>e.target===e.currentTarget&&setFormOpen(false)}><div className={s.modal}><header><h2>Agregar huésped</h2><button className={s.close} onClick={()=>setFormOpen(false)}><Icon name="close"/></button></header><div className={s.form}><label className={s.wide}>Nombre<input value={draft.full_name} onChange={e=>setDraft(v=>({...v,full_name:e.target.value}))} autoFocus/></label><label>Email<input type="email" value={draft.email} onChange={e=>setDraft(v=>({...v,email:e.target.value}))}/></label><label>Teléfono<input value={draft.phone} onChange={e=>setDraft(v=>({...v,phone:e.target.value}))}/></label><label>País<input value={draft.country} onChange={e=>setDraft(v=>({...v,country:e.target.value}))}/></label><label>Nacionalidad<input value={draft.nationality} onChange={e=>setDraft(v=>({...v,nationality:e.target.value}))}/></label><label>Idioma<select value={draft.language} onChange={e=>setDraft(v=>({...v,language:e.target.value}))}><option value="es">Español</option><option value="en">English</option><option value="pt">Português</option></select></label><label>Nivel<select value={draft.vip_level} onChange={e=>setDraft(v=>({...v,vip_level:e.target.value}))}><option value="standard">Estándar</option><option value="frequent">Habitual</option><option value="vip">VIP</option><option value="signature">Signature</option></select></label><label className={s.wide}>Notas<textarea value={draft.notes} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))}/></label></div>{data.error&&<div className={s.error}>{data.error}</div>}<footer><button onClick={()=>setFormOpen(false)}>Cancelar</button><button disabled={saving} onClick={saveNew}>{saving?"Guardando…":"Guardar huésped"}</button></footer></div></div>}
  </section>
}
