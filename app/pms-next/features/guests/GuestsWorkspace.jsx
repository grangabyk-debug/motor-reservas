"use client"

import{useMemo,useState}from"react"
import useGuestsData from"./useGuestsData"
import GuestJourneyPanel from"./GuestJourneyPanel"
import GuestSegmentsPanel from"./GuestSegmentsPanel"
import{birthdayInDays,segmentById,spendLabel}from"./guestCrm"
import s from"./guests.module.css"

const initials=name=>String(name||"H").trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".",""):"—"
const vipLabel=value=>value==="signature"?"Signature":value==="vip"?"VIP":value==="frequent"?"Habitual":"Estándar"
const birthdayLabel=value=>{const days=birthdayInDays(value);if(days==null)return"Sin fecha";if(days===0)return"Hoy";if(days===1)return"Mañana";return`En ${days} días`}

export default function GuestsWorkspace({propertyId}){
  const data=useGuestsData(propertyId)
  const[query,setQuery]=useState("")
  const[activeSegment,setActiveSegment]=useState("")
  const[selected,setSelected]=useState(null)
  const[formOpen,setFormOpen]=useState(false)
  const[saving,setSaving]=useState(false)
  const[draft,setDraft]=useState(null)

  const segment=segmentById(activeSegment)
  const filtered=useMemo(()=>{const term=query.trim().toLowerCase();return data.guests.filter(item=>(!segment||segment.match(item))&&(!term||`${item.full_name} ${item.email||""} ${item.phone||""} ${item.country||""} ${(item.tags||[]).join(" ")} ${item.dominantChannel||""}`.toLowerCase().includes(term)))},[data.guests,query,segment])
  const vip=data.guests.filter(item=>["vip","signature"].includes(item.vip_level)).length
  const regular=data.guests.filter(item=>item.vip_level==="frequent").length
  const fresh=data.guests.filter(item=>(item.stays||0)<=1).length

  function openNew(){setDraft({full_name:"",email:"",phone:"",country:"Argentina",nationality:"Argentina",language:"es",vip_level:"standard",notes:""});data.setError("");setFormOpen(true)}
  async function saveNew(){if(!draft.full_name.trim())return data.setError("Ingresá el nombre del huésped.");setSaving(true);data.setError("");try{await data.createGuest(draft);setFormOpen(false)}catch(err){data.setError(err?.message||"No se pudo crear el huésped.")}finally{setSaving(false)}}
  async function saveProfile(patch){if(!selected)return;setSaving(true);data.setError("");try{const updated=await data.updateGuest(selected.id,patch);setSelected(current=>({...current,...updated}))}catch(err){data.setError(err?.message||"No se pudo actualizar el huésped.")}finally{setSaving(false)}}

  return <section className={s.page}>
    <header className={s.heading}><div><small>CRM DE HUÉSPEDES</small><h1>Huéspedes</h1><p>{data.guests.length} perfiles reales · segmentación basada en estadías e historial.</p></div><button type="button" className={s.primary} onClick={openNew}>＋ Agregar huésped</button></header>
    {data.error&&<div className={s.empty}>{data.error}</div>}
    <div className={s.metrics}><article className={s.metric} data-kind="vip"><small>VIP / Signature</small><b>{vip}</b></article><article className={s.metric}><small>Huéspedes habituales</small><b>{regular}</b></article><article className={s.metric} data-kind="new"><small>Con 0–1 estadía</small><b>{fresh}</b></article></div>
    <GuestSegmentsPanel guests={data.guests} activeSegment={activeSegment} onSegment={setActiveSegment}/>
    <GuestJourneyPanel propertyId={propertyId}/>
    <div className={s.toolbar}><div className={s.filterContext}>{segment?<><span>Segmento</span><b>{segment.label}</b><button type="button" onClick={()=>setActiveSegment("")}>×</button></>:<span>Todos los huéspedes</span>}</div><label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar huésped, email, teléfono, país o canal"/></label></div>
    <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Huésped</th><th>Contacto</th><th>País</th><th>Estadías</th><th>Última estadía</th><th>Gasto total</th><th>Nivel</th><th>Acciones</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><div className={s.guestCell}><span className={s.avatar}>{initials(item.full_name)}</span><span><b>{item.full_name}</b><small>{item.dominantChannel?`${item.dominantChannel} · `:""}{item.document_number?`${item.document_type||"Doc."} ${item.document_number}`:`ID ${item.id.slice(0,8)}…`}</small></span></div></td><td className={s.contact}><b>{item.email||"—"}</b><small>{item.phone||"Sin teléfono"}</small></td><td>{item.country||item.nationality||"—"}</td><td>{item.stays||0}</td><td>{fmtDate(item.lastStay||item.last_stay_at)}</td><td>{spendLabel(item.spentByCurrency)}</td><td><span className={`${s.status} ${item.vip_level==="frequent"?s.statusRegular:item.vip_level==="standard"?s.statusNew:""}`}>{vipLabel(item.vip_level)}</span></td><td><button type="button" className={s.view} onClick={()=>setSelected(item)}>Ver</button></td></tr>)}</tbody></table>{data.loading?<div className={s.empty}>Cargando huéspedes…</div>:!filtered.length&&<div className={s.empty}>No encontramos huéspedes en este segmento o búsqueda.</div>}</div>

    {selected&&<div className={s.drawerShade} onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}><aside className={s.drawer}><header className={s.profileHead}><div className={s.profileIdentity}><span className={s.avatar}>{initials(selected.full_name)}</span><div><small>PERFIL 360° DE HUÉSPED</small><h2>{selected.full_name}</h2><p>{selected.country||selected.nationality||"Sin país"} · {vipLabel(selected.vip_level)}</p></div></div><button className={s.close} onClick={()=>setSelected(null)}>×</button></header><div className={s.profileMetrics}><div><small>Estadías</small><b>{selected.stays||0}</b></div><div><small>Noches</small><b>{selected.nights||0}</b></div><div><small>Última</small><b>{fmtDate(selected.lastStay||selected.last_stay_at)}</b></div><div><small>Valor histórico</small><b>{spendLabel(selected.spentByCurrency)}</b></div></div><section className={s.section}><small>CONTACTO</small><h3>Datos del huésped</h3><div className={s.meta}><div><span>Email</span><b>{selected.email||"—"}</b></div><div><span>Teléfono</span><b>{selected.phone||"—"}</b></div><div><span>País</span><b>{selected.country||"—"}</b></div><div><span>Idioma</span><b>{selected.language||"—"}</b></div></div></section><section className={s.section}><small>RELACIÓN COMERCIAL</small><h3>Contexto para reconocerlo</h3><div className={s.meta}><div><span>Canal habitual</span><b>{selected.dominantChannel||"Sin historial"}</b></div><div><span>Próxima estadía</span><b>{fmtDate(selected.nextStay)}</b></div><div><span>Cumpleaños</span><b>{selected.birth_date?`${fmtDate(selected.birth_date)} · ${birthdayLabel(selected.birth_date)}`:"Sin fecha"}</b></div><div><span>Último canal</span><b>{selected.lastChannel||"—"}</b></div></div></section><section className={s.section}><small>RELACIÓN</small><h3>Preferencias y nivel</h3><label>Nivel<select value={selected.vip_level} disabled={saving} onChange={e=>saveProfile({vip_level:e.target.value})}><option value="standard">Estándar</option><option value="frequent">Habitual</option><option value="vip">VIP</option><option value="signature">Signature</option></select></label><div className={s.notes}>{selected.notes||"Todavía no hay notas operativas."}</div>{(selected.tags||[]).length>0&&<div className={s.notes}>{selected.tags.join(" · ")}</div>}</section></aside></div>}

    {formOpen&&draft&&<div className={s.modalShade} onMouseDown={e=>e.target===e.currentTarget&&setFormOpen(false)}><div className={s.modal}><header><h2>Agregar huésped</h2><button className={s.close} onClick={()=>setFormOpen(false)}>×</button></header><div className={s.form}><label className={s.wide}>Nombre<input value={draft.full_name} onChange={e=>setDraft(v=>({...v,full_name:e.target.value}))} autoFocus/></label><label>Email<input type="email" value={draft.email} onChange={e=>setDraft(v=>({...v,email:e.target.value}))}/></label><label>Teléfono<input value={draft.phone} onChange={e=>setDraft(v=>({...v,phone:e.target.value}))}/></label><label>País<input value={draft.country} onChange={e=>setDraft(v=>({...v,country:e.target.value}))}/></label><label>Nacionalidad<input value={draft.nationality} onChange={e=>setDraft(v=>({...v,nationality:e.target.value}))}/></label><label>Idioma<select value={draft.language} onChange={e=>setDraft(v=>({...v,language:e.target.value}))}><option value="es">Español</option><option value="en">English</option><option value="pt">Português</option></select></label><label>Nivel<select value={draft.vip_level} onChange={e=>setDraft(v=>({...v,vip_level:e.target.value}))}><option value="standard">Estándar</option><option value="frequent">Habitual</option><option value="vip">VIP</option><option value="signature">Signature</option></select></label><label className={s.wide}>Notas<textarea value={draft.notes} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))}/></label></div>{data.error&&<div className={s.error}>{data.error}</div>}<footer><button onClick={()=>setFormOpen(false)}>Cancelar</button><button disabled={saving} onClick={saveNew}>{saving?"Guardando…":"Guardar huésped"}</button></footer></div></div>}
  </section>
}
