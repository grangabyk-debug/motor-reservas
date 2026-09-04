"use client"

import{useMemo,useState}from"react"
import{MANAGEMENT_NAV,OPERATIONS_NAV,PRIMARY_NAV,ROLE_VIEWS}from"../../core/navigation"
import s from"./role-permissions.module.css"

const ROLE_LABELS={admin:"Administrador",reception:"Recepción",night_audit:"Auditoría nocturna",housekeeping:"Housekeeping",maintenance:"Mantenimiento",revenue:"Revenue",member:"Equipo"}
const EDITABLE_ROLES=Object.keys(ROLE_LABELS)
const GROUPS=[{label:"Principal",items:PRIMARY_NAV},{label:"Operación",items:OPERATIONS_NAV},{label:"Gestión",items:MANAGEMENT_NAV}]
const LOCKED=new Set(["dashboard"])

function initialMatrix(value){
  return Object.fromEntries(EDITABLE_ROLES.map(role=>[role,[...new Set(Array.isArray(value?.[role])?["dashboard",...value[role]]:(ROLE_VIEWS[role]||["dashboard"]))]]))
}

export default function RolePermissionsPanel({value,onSave,saving=false,canManage=true}){
  const[matrix,setMatrix]=useState(()=>initialMatrix(value))
  const[activeRole,setActiveRole]=useState("reception")
  const current=useMemo(()=>new Set(matrix[activeRole]||[]),[matrix,activeRole])
  const patch=(view,checked)=>setMatrix(prev=>{const next=new Set(prev[activeRole]||[]);checked?next.add(view):next.delete(view);LOCKED.forEach(id=>next.add(id));return{...prev,[activeRole]:[...next]}})
  const selectGroup=items=>setMatrix(prev=>({...prev,[activeRole]:[...new Set([...(prev[activeRole]||[]),...items.map(item=>item.id),...LOCKED])]}))
  const clearRole=()=>setMatrix(prev=>({...prev,[activeRole]:[...LOCKED,"support"]}))
  const save=()=>onSave?.(Object.fromEntries(Object.entries(matrix).map(([role,views])=>[role,[...new Set(views)].filter(id=>id!=="dashboard")])))

  return <div className={s.layout}>
    <aside className={s.roles}><header><small>ROLES</small><h2>Qué puede ver cada perfil</h2><p>Los módulos desactivados desaparecen del menú y de los accesos del panel para ese rol.</p></header><div className={s.roleList}>{EDITABLE_ROLES.map(role=><button type="button" key={role} className={activeRole===role?s.active:""} onClick={()=>setActiveRole(role)}><b>{ROLE_LABELS[role]}</b><small>{(matrix[role]||[]).length} módulos visibles</small></button>)}</div><div className={s.locked}><b>Propietario y Gerencia</b><span>Siempre tienen acceso completo. No se pueden restringir desde esta matriz.</span></div></aside>
    <section className={s.matrix}><header><div><small>PERMISOS DE MÓDULOS</small><h2>{ROLE_LABELS[activeRole]}</h2><p>Activá sólo las áreas necesarias para trabajar. Dashboard queda siempre disponible.</p></div>{canManage&&<div className={s.actions}><button type="button" onClick={clearRole}>Mínimo</button><button type="button" className={s.primary} disabled={saving} onClick={save}>{saving?"Guardando…":"Guardar permisos"}</button></div>}</header>
      {!canManage&&<div className={s.notice}>Sólo Propietario o Gerencia pueden modificar esta matriz.</div>}
      <div className={s.groups}>{GROUPS.map(group=><article key={group.label}><div className={s.groupHead}><div><b>{group.label}</b><small>{group.items.filter(item=>current.has(item.id)).length}/{group.items.length} visibles</small></div>{canManage&&<button type="button" onClick={()=>selectGroup(group.items)}>Activar grupo</button>}</div><div className={s.moduleGrid}>{group.items.map(item=>{const locked=LOCKED.has(item.id);return <label key={item.id} className={`${s.module} ${current.has(item.id)?s.enabled:""}`}><span className={s.moduleIcon}/><span><b>{item.label}</b><small>{locked?"Siempre visible":current.has(item.id)?"Visible para este rol":"Oculto para este rol"}</small></span><input type="checkbox" checked={current.has(item.id)} disabled={!canManage||locked} onChange={e=>patch(item.id,e.target.checked)}/><i/></label>})}</div></article>)}</div>
    </section>
  </div>
}
