"use client"

import{useEffect,useState}from"react"
import{ROLE_LABELS}from"../../core/permissions"
import{useHotelSession}from"../../hooks/useHotelSession"
import{INVITABLE_ROLES,invitePropertyUser,loadPropertyUsers}from"../../services/users"
import ui from"../../v2.module.css"
import s from"./users.module.css"

const ROLE_COPY={manager:"Gestiona operación, habitaciones, comercial y administración.",reception:"Reservas, huéspedes, cobros y recepción diaria.",housekeeping:"Limpieza, estado de habitaciones y prioridades.",admin:"Caja, documentos, pagos y reportes.",revenue:"Tarifas, restricciones, demanda y distribución.",maintenance:"Mantenimiento, recursos y estado técnico.",night_audit:"Recepción nocturna, pagos, IN/OUT y auditoría."}
const emptyDraft={fullName:"",email:"",role:"reception"}

export default function UsersAccessPage(){
  const session=useHotelSession(),[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[showInvite,setShowInvite]=useState(false),[draft,setDraft]=useState(emptyDraft),[saving,setSaving]=useState(false)
  const property=session.properties.find(p=>String(p.id)===String(session.propertyId)),canInvite=session.role==="owner"

  useEffect(()=>{let active=true;if(!session.propertyId)return;setLoading(true);setError("");loadPropertyUsers(session.propertyId).then(data=>active&&setRows(data)).catch(err=>active&&setError(err.message||"No se pudo cargar el equipo.")).finally(()=>active&&setLoading(false));return()=>{active=false}},[session.propertyId])

  async function reload(){if(!session.propertyId)return;setRows(await loadPropertyUsers(session.propertyId))}
  async function submit(e){e.preventDefault();if(!canInvite)return;setSaving(true);setError("");setMessage("");try{await invitePropertyUser({propertyId:session.propertyId,email:draft.email,fullName:draft.fullName,role:draft.role});setMessage(`Invitación enviada a ${draft.email.trim()}.`);setDraft(emptyDraft);setShowInvite(false);await reload()}catch(err){setError(err.message||"No se pudo enviar la invitación.")}finally{setSaving(false)}}

  if(session.loading)return <div className={ui.loading}>Preparando equipo…</div>
  if(!session.properties.length)return <div className={ui.loading}>No hay una propiedad asociada a esta cuenta.</div>

  return <main className={s.page}><section className={s.hero}><div><a href="/dashboard">← Volver al Hotel OS</a><small>EQUIPO & ACCESOS</small><h1>Personas, roles y hoteles sin mezclar permisos.</h1><p>Esta pantalla usa el mismo contexto multihotel del sistema principal. Las invitaciones las confirma el servidor y solo puede enviarlas el propietario.</p></div><div className={s.propertyBox}><span>PROPIEDAD ACTIVA</span><select value={session.propertyId} onChange={e=>session.setPropertyId(e.target.value)}>{session.properties.map(item=><option key={item.id} value={item.id}>{item.name||item.nombre||"Hotel"}</option>)}</select><b>{property?.city||""}</b></div></section>

  <section className={s.toolbar}><div><strong>{property?.name||property?.nombre||"Hotel"}</strong><span>{rows.length} acceso{rows.length===1?"":"s"} registrado{rows.length===1?"":"s"}</span></div>{canInvite?<button onClick={()=>setShowInvite(v=>!v)}>＋ Invitar persona</button>:<span className={s.readonly}>Tu rol puede consultar su acceso, pero no invitar.</span>}</section>

  {message&&<div className={s.success}>{message}</div>}{error&&<div className={s.error}>{error}</div>}

  {showInvite&&canInvite&&<form className={s.invite} onSubmit={submit}><header><div><small>NUEVO ACCESO</small><h2>Invitar al hotel</h2></div><button type="button" onClick={()=>setShowInvite(false)}>×</button></header><div className={s.formGrid}><label><span>Nombre</span><input value={draft.fullName} onChange={e=>setDraft(x=>({...x,fullName:e.target.value}))} placeholder="Ej. María López"/></label><label><span>Email</span><input type="email" required value={draft.email} onChange={e=>setDraft(x=>({...x,email:e.target.value}))} placeholder="persona@email.com"/></label><label><span>Rol</span><select value={draft.role} onChange={e=>setDraft(x=>({...x,role:e.target.value}))}>{INVITABLE_ROLES.map(role=><option key={role} value={role}>{ROLE_LABELS[role]||role}</option>)}</select></label><div className={s.roleHint}><b>{ROLE_LABELS[draft.role]}</b><span>{ROLE_COPY[draft.role]}</span></div></div><footer><button type="button" onClick={()=>setShowInvite(false)}>Cancelar</button><button disabled={saving}>{saving?"Enviando…":"Enviar invitación"}</button></footer></form>}

  <section className={s.card}><header><div><small>PERSONAS CON ACCESO</small><h2>Equipo de esta propiedad</h2></div></header>{loading?<p className={s.empty}>Cargando accesos…</p>:rows.length?<div className={s.people}>{rows.map(row=>{const name=row.profile?.full_name||"Usuario",mine=row.user_id===session.user?.id;return <article key={row.user_id}><span className={s.avatar}>{name.trim().charAt(0).toUpperCase()||"U"}</span><div><h3>{name}{mine&&<em>Vos</em>}</h3><p>{ROLE_LABELS[row.role]||row.role}</p><small>Acceso desde {new Date(row.created_at).toLocaleDateString("es-AR")}</small></div><b>ACTIVO</b></article>})}</div>:<p className={s.empty}>No hay miembros adicionales visibles para este rol.</p>}</section>

  <section className={s.card}><header><div><small>MATRIZ DE TRABAJO</small><h2>Roles disponibles</h2></div></header><div className={s.roles}>{INVITABLE_ROLES.map(role=><article key={role}><b>{ROLE_LABELS[role]}</b><p>{ROLE_COPY[role]}</p></article>)}</div></section></main>
}
