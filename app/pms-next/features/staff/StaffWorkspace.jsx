"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./staff.module.css"

const ROLE_LABELS={owner:"Propietario",manager:"Gerencia",reception:"Recepción",housekeeping:"Housekeeping",maintenance:"Mantenimiento",night_audit:"Auditoría nocturna",admin:"Administrador"}
const EDITABLE_ROLES=["manager","reception","housekeeping","maintenance","night_audit","admin"]

export default function StaffWorkspace({propertyId,property}){
  const[members,setMembers]=useState([])
  const[currentUser,setCurrentUser]=useState(null)
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")
  const[saving,setSaving]=useState("")
  const[query,setQuery]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
      setCurrentUser(userData?.user||null)
      const{data:membership,error:memberError}=await supabase.from("property_members").select("property_id,user_id,role,created_at").eq("property_id",propertyId).order("created_at")
      if(memberError)throw memberError
      const ids=(membership||[]).map(item=>item.user_id)
      let profiles=[]
      if(ids.length){const{data,error:profileError}=await supabase.from("profiles").select("id,full_name,role,created_at").in("id",ids);if(profileError)throw profileError;profiles=data||[]}
      const profileMap=new Map(profiles.map(item=>[item.id,item]))
      const rows=(membership||[]).map(item=>({...item,profile:profileMap.get(item.user_id)||null}))
      if(property?.owner_id&&!rows.some(item=>item.user_id===property.owner_id)){
        const{data:ownerProfile}=await supabase.from("profiles").select("id,full_name,role,created_at").eq("id",property.owner_id).maybeSingle()
        rows.unshift({property_id:propertyId,user_id:property.owner_id,role:"owner",created_at:property.created_at,profile:ownerProfile||null,implicitOwner:true})
      }
      setMembers(rows)
    }catch(err){setError(err?.message||"No se pudo cargar el equipo.")}
    finally{setLoading(false)}
  },[propertyId,property?.owner_id,property?.created_at])

  useEffect(()=>{load()},[load])

  const canManage=property?.owner_id===currentUser?.id
  const filtered=useMemo(()=>members.filter(item=>{
    const name=item.profile?.full_name||"Usuario"
    return !query||`${name} ${item.role} ${item.user_id}`.toLowerCase().includes(query.toLowerCase())
  }),[members,query])

  async function changeRole(member,role){
    if(!canManage||member.role==="owner"||member.implicitOwner)return
    setSaving(member.user_id);setError("")
    try{const{error:updateError}=await supabase.from("property_members").update({role}).eq("property_id",propertyId).eq("user_id",member.user_id);if(updateError)throw updateError;await load()}
    catch(err){setError(err?.message||"No se pudo actualizar el rol.")}
    finally{setSaving("")}
  }

  async function removeMember(member){
    if(!canManage||member.role==="owner"||member.implicitOwner)return
    if(!window.confirm(`Quitar a ${member.profile?.full_name||"este usuario"} de la propiedad?`))return
    setSaving(member.user_id);setError("")
    try{const{error:deleteError}=await supabase.from("property_members").delete().eq("property_id",propertyId).eq("user_id",member.user_id);if(deleteError)throw deleteError;await load()}
    catch(err){setError(err?.message||"No se pudo quitar al usuario.")}
    finally{setSaving("")}
  }

  const roleCounts=useMemo(()=>members.reduce((acc,item)=>{acc[item.role]=(acc[item.role]||0)+1;return acc},{}),[members])

  return <section className={s.page}>
    <header className={s.header}><div><small>EQUIPO</small><h1>Personas y permisos</h1><p>Accesos reales de la propiedad activa, protegidos por roles y RLS.</p></div><span className={s.accessBadge}>{canManage?"Administración de accesos":"Sólo lectura"}</span></header>
    {error&&<div className={s.notice}>{error}</div>}
    <div className={s.metrics}><article><span>Miembros</span><b>{members.length}</b></article><article><span>Recepción</span><b>{roleCounts.reception||0}</b></article><article><span>Housekeeping</span><b>{roleCounts.housekeeping||0}</b></article><article><span>Gestión</span><b>{(roleCounts.owner||0)+(roleCounts.manager||0)+(roleCounts.admin||0)}</b></article></div>
    <div className={s.toolbar}><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar persona o rol"/></label><div className={s.inviteInfo}><b>Invitaciones</b><span>Se habilitarán con el servicio de invitación por email; no se muestran altas ficticias.</span></div></div>
    {loading?<div className={s.notice}>Cargando equipo…</div>:<div className={s.table}><div className={s.head}><span>Persona</span><span>Rol</span><span>Alta</span><span>Acceso</span><span/></div>{filtered.map(member=><article key={member.user_id}><div className={s.person}><span className={s.avatar}>{(member.profile?.full_name||"U").slice(0,1).toUpperCase()}</span><div><b>{member.profile?.full_name||"Usuario sin nombre"}</b><small>{member.user_id===currentUser?.id?"Vos":`${member.user_id.slice(0,8)}…`}</small></div></div><div>{canManage&&member.role!=="owner"&&!member.implicitOwner?<select value={member.role} disabled={saving===member.user_id} onChange={e=>changeRole(member,e.target.value)}>{EDITABLE_ROLES.map(role=><option key={role} value={role}>{ROLE_LABELS[role]||role}</option>)}</select>:<span className={s.role}>{ROLE_LABELS[member.role]||member.role}</span>}</div><span>{new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(member.created_at))}</span><span className={s.active}>Activo</span><div>{canManage&&member.role!=="owner"&&!member.implicitOwner&&<button className={s.remove} disabled={saving===member.user_id} onClick={()=>removeMember(member)}>Quitar</button>}</div></article>)}</div>}
  </section>
}
