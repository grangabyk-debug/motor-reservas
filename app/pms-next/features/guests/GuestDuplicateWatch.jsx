"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./guestDuplicateWatch.module.css"

const text=value=>String(value||"").trim()
const norm=value=>text(value).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ")
const digits=value=>text(value).replace(/\D/g,"")
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".",""):"—"
function Icon({name="users"}){const paths={users:<><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 20a5.5 5.5 0 0 1 11 0M10.5 20a5.5 5.5 0 0 1 11 0"/><path d="m10 13 2 2 2-2"/></>,eye:<><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,check:<><path d="m5 12 4 4L19 6"/></>,close:<><path d="M6 6l12 12M18 6 6 18"/></>,arrow:<><path d="M5 12h14M13 6l6 6-6 6"/></>,merge:<><path d="M5 4v4c0 2.2 1.8 4 4 4h6"/><path d="M5 20v-4c0-2.2 1.8-4 4-4h6"/><path d="m15 8 4 4-4 4"/></>};return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.users}</svg>}

function reasonFor(a,b){
  const ae=norm(a.email),be=norm(b.email),ad=norm(a.document_number),bd=norm(b.document_number),ap=digits(a.phone),bp=digits(b.phone),an=norm(a.full_name),bn=norm(b.full_name)
  if(ae&&be&&ae===be)return"Mismo email"
  if(ad&&bd&&ad===bd)return"Mismo documento"
  if(ap.length>=7&&bp.length>=7&&ap===bp)return"Mismo teléfono"
  if(an&&an===bn&&a.birth_date&&b.birth_date&&a.birth_date===b.birth_date)return"Mismo nombre y fecha de nacimiento"
  return""
}
function completeness(p){return["full_name","email","phone","document_number","birth_date","nationality","address","city","country"].reduce((n,key)=>n+(text(p?.[key])?1:0),0)+(Array.isArray(p?.tags)?p.tags.length:0)}
function label(value){return text(value)||"—"}

export default function GuestDuplicateWatch({propertyId}){
  const[profiles,setProfiles]=useState([]),[working,setWorking]=useState(""),[message,setMessage]=useState(null),[review,setReview]=useState(null),[keepId,setKeepId]=useState(""),[linked,setLinked]=useState([]),[reviewLoading,setReviewLoading]=useState(false)
  const load=useCallback(async()=>{if(!propertyId)return;const{data,error}=await supabase.from("hotel_guest_profiles").select("id,full_name,email,phone,document_type,document_number,birth_date,nationality,address,city,province,country,tags,vip_level,notes,preferences,created_at").eq("property_id",propertyId).eq("status","active").order("created_at").limit(800);if(error){setMessage({kind:"error",text:error.message||"No se pudieron revisar perfiles duplicados."});return}setProfiles(data||[])},[propertyId])
  useEffect(()=>{load()},[load])
  const candidates=useMemo(()=>{
    const out=[]
    for(let i=0;i<profiles.length;i++)for(let j=i+1;j<profiles.length;j++){const reason=reasonFor(profiles[i],profiles[j]);if(!reason)continue;out.push({a:profiles[i],b:profiles[j],reason,key:`${profiles[i].id}:${profiles[j].id}`});if(out.length>=8)return out}
    return out
  },[profiles])
  const reservationsByProfile=useMemo(()=>{const map=new Map();for(const row of linked){const key=String(row.guest_profile_id);const list=map.get(key)||[];list.push(row);map.set(key,list)}return map},[linked])

  async function openReview(pair){
    if(working)return
    const suggested=completeness(pair.a)>=completeness(pair.b)?pair.a:pair.b
    setReview(pair);setKeepId(suggested.id);setLinked([]);setReviewLoading(true)
    try{const{data,error}=await supabase.from("reservas").select("id,numero_reserva,guest_profile_id,fecha_entrada,fecha_salida,estado,canal_reserva").eq("property_id",propertyId).in("guest_profile_id",[pair.a.id,pair.b.id]).order("fecha_entrada",{ascending:false}).limit(60);if(error)throw error;setLinked(data||[])}catch(err){setMessage({kind:"error",text:err?.message||"No pudimos cargar las reservas vinculadas."})}finally{setReviewLoading(false)}
  }
  function closeReview(){if(working)return;setReview(null);setKeepId("");setLinked([])}
  async function mergeReviewed(){
    if(!review||working||!keepId)return
    const primary=keepId===review.a.id?review.a:review.b,duplicate=primary.id===review.a.id?review.b:review.a,key=review.key
    setWorking(key);setMessage(null)
    try{const{error}=await supabase.rpc("hl_merge_guest_profiles_atomic",{p_primary_id:primary.id,p_duplicate_id:duplicate.id});if(error)throw error;setMessage({kind:"success",text:"Perfiles fusionados. Las reservas y el historial quedaron vinculados a una sola ficha.",profileId:primary.id,profileName:primary.full_name||"Huésped"});setReview(null);setKeepId("");setLinked([]);await load();if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated"))}
    catch(err){setMessage({kind:"error",text:err?.message||"No se pudieron fusionar los perfiles."})}finally{setWorking("")}
  }
  function openMergedProfile(){if(!message?.profileId||typeof window==="undefined")return;const url=new URL(window.location.href);url.searchParams.set("view","guests");url.searchParams.set("guest_profile",message.profileId);window.location.assign(url.toString())}

  if(!candidates.length&&!message&&!review)return null
  return <>
    <section className={s.shell} aria-label="Posibles perfiles de huésped duplicados">
      <header className={s.header}><span className={s.headerIcon}><Icon/></span><div><small>PERFILES PARA REVISAR</small><b>{candidates.length?`${candidates.length} posible${candidates.length===1?"":"s"} duplicado${candidates.length===1?"":"s"}`:"Revisión de perfiles"}</b></div></header>
      {message?<div className={`${s.notice} ${message.kind==="error"?s.noticeError:s.noticeSuccess}`}><span>{message.text}</span>{message.kind==="success"&&message.profileId?<button type="button" onClick={openMergedProfile}>Ver ficha fusionada <Icon name="arrow"/></button>:null}</div>:null}
      {candidates.length?<div className={s.list}>{candidates.slice(0,4).map(pair=>{const preferred=completeness(pair.a)>=completeness(pair.b)?pair.a:pair.b;return <article key={pair.key} className={s.row}><div><b>{pair.a.full_name||"Sin nombre"} / {pair.b.full_name||"Sin nombre"}</b><small>{pair.reason} · sugerido conservar: {preferred.full_name||"perfil más completo"}</small></div><button type="button" disabled={Boolean(working)} onClick={()=>openReview(pair)}><Icon name="eye"/>Revisar perfiles</button></article>})}</div>:null}
    </section>

    {review?<div className={s.modalShade} onMouseDown={e=>e.target===e.currentTarget&&closeReview()}><section className={s.modal} role="dialog" aria-modal="true" aria-label="Revisar perfiles antes de fusionar">
      <header className={s.modalHead}><div><small>COMPROBAR ANTES DE FUSIONAR</small><h2>Revisá las dos fichas</h2><p>{review.reason}. Elegí cuál perfil debe quedar como principal.</p></div><button type="button" className={s.close} onClick={closeReview} disabled={Boolean(working)}><Icon name="close"/></button></header>
      <div className={s.compare}>{[review.a,review.b].map(profile=>{const reservations=reservationsByProfile.get(String(profile.id))||[],selected=keepId===profile.id,suggested=completeness(profile)>=completeness(profile.id===review.a.id?review.b:review.a);return <article key={profile.id} className={`${s.profileCard} ${selected?s.profileSelected:""}`}>
        <button type="button" className={s.profileChoice} onClick={()=>setKeepId(profile.id)} disabled={Boolean(working)}><span className={s.choiceMark}>{selected?<Icon name="check"/>:null}</span><span><b>{selected?"Conservar este perfil":"Elegir como principal"}</b><small>{suggested?"Sugerido por ficha más completa":"Podés elegirlo igualmente"}</small></span></button>
        <div className={s.identity}><span className={s.avatar}>{text(profile.full_name).split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"H"}</span><div><h3>{profile.full_name||"Sin nombre"}</h3><p>{profile.vip_level||"standard"} · creado {fmtDate(profile.created_at)}</p></div></div>
        <div className={s.dataGrid}><div><span>Documento</span><b>{profile.document_number?`${profile.document_type||"Doc."} ${profile.document_number}`:"—"}</b></div><div><span>Email</span><b>{label(profile.email)}</b></div><div><span>Teléfono</span><b>{label(profile.phone)}</b></div><div><span>Nacimiento</span><b>{fmtDate(profile.birth_date)}</b></div><div><span>Nacionalidad</span><b>{label(profile.nationality)}</b></div><div><span>Ubicación</span><b>{[profile.city,profile.province,profile.country].filter(Boolean).join(", ")||"—"}</b></div></div>
        {profile.notes?<div className={s.notes}><span>Notas</span><p>{profile.notes}</p></div>:null}
        {(profile.tags||[]).length?<div className={s.tags}>{profile.tags.slice(0,6).map(tag=><span key={tag}>{tag}</span>)}</div>:null}
        <div className={s.reservations}><div className={s.resHead}><b>{reviewLoading?"Cargando reservas…":`${reservations.length} reserva${reservations.length===1?"":"s"} vinculada${reservations.length===1?"":"s"}`}</b><small>Se conservarán al fusionar</small></div>{!reviewLoading&&reservations.slice(0,3).map(row=><div className={s.resRow} key={row.id}><span>{row.numero_reserva||`Reserva ${row.id}`}</span><span>{fmtDate(row.fecha_entrada)} → {fmtDate(row.fecha_salida)}</span><small>{row.canal_reserva||"Directa"} · {row.estado||"—"}</small></div>)}{!reviewLoading&&reservations.length>3?<small className={s.more}>+ {reservations.length-3} más</small>:null}</div>
      </article>})}</div>
      <footer className={s.modalFoot}><div><Icon name="merge"/><span>El perfil que no conserves se integrará al principal junto con historial, reservas, documentos, etiquetas y preferencias.</span></div><div className={s.actions}><button type="button" className={s.cancel} onClick={closeReview} disabled={Boolean(working)}>Cancelar</button><button type="button" className={s.confirm} onClick={mergeReviewed} disabled={Boolean(working)||!keepId}>{working?"Fusionando…":`Fusionar y conservar ${keepId===review.a.id?review.a.full_name||"perfil A":review.b.full_name||"perfil B"}`}</button></div></footer>
    </section></div>:null}
  </>
}
