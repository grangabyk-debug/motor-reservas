"use client"

import{useMemo,useState}from"react"
import{MANAGEMENT_NAV,OPERATIONS_NAV,PRIMARY_NAV,ROLE_VIEWS}from"../../core/navigation"
import s from"./role-permissions.module.css"

const ROLE_LABELS={admin:"Administrador",reception:"Recepción",night_audit:"Auditoría nocturna",housekeeping:"Housekeeping",maintenance:"Mantenimiento",revenue:"Revenue",member:"Equipo"}
const EDITABLE_ROLES=Object.keys(ROLE_LABELS)
const GROUPS=[{label:"Principal",items:PRIMARY_NAV},{label:"Operación",items:OPERATIONS_NAV},{label:"Gestión",items:MANAGEMENT_NAV}]
const LOCKED=new Set(["dashboard"])
const ACTION_GROUPS=[
  {label:"Cobros",items:[{id:"payments.create_request",label:"Crear link de cobro"},{id:"payments.verify_request",label:"Verificar y conciliar"}]},
  {label:"Plataforma",items:[{id:"api.manage_keys",label:"Administrar claves API"}]},
  {label:"Equipo",items:[{id:"staff.invite",label:"Invitar usuarios"}]},
]
const ALL_ACTIONS=ACTION_GROUPS.flatMap(group=>group.items)
const DEFAULT_ACTIONS={
  admin:new Set(ALL_ACTIONS.map(item=>item.id)),
  reception:new Set(["payments.create_request","payments.verify_request"]),
  night_audit:new Set(["payments.create_request","payments.verify_request"]),
  housekeeping:new Set(),maintenance:new Set(),revenue:new Set(),member:new Set(),
}

function initialMatrix(value){return Object.fromEntries(EDITABLE_ROLES.map(role=>[role,[...new Set(Array.isArray(value?.[role])?["dashboard",...value[role]]:(ROLE_VIEWS[role]||["dashboard"]))]]))}
function initialActions(value){return Object.fromEntries(EDITABLE_ROLES.map(role=>[role,Object.fromEntries(ALL_ACTIONS.map(item=>{const explicit=value?.__actions?.[role]?.[item.id];return[item.id,typeof explicit==="boolean"?explicit:DEFAULT_ACTIONS[role]?.has(item.id)||false]}))]))}

export default function RolePermissionsPanel({value,onSave,saving=false,canManage=true}){
  const[matrix,setMatrix]=useState(()=>initialMatrix(value)),[actions,setActions]=useState(()=>initialActions(value)),[activeRole,setActiveRole]=useState("reception"),[mode,setMode]=useState("modules")
  const current=useMemo(()=>new Set(matrix[activeRole]||[]),[matrix,activeRole]),currentActions=actions[activeRole]||{}
  const patch=(view,checked)=>setMatrix(prev=>{const next=new Set(prev[activeRole]||[]);checked?next.add(view):next.delete(view);LOCKED.forEach(id=>next.add(id));return{...prev,[activeRole]:[...next]}})
  const patchAction=(id,checked)=>setActions(prev=>({...prev,[activeRole]:{...(prev[activeRole]||{}),[id]:checked}}))
  const selectGroup=items=>setMatrix(prev=>({...prev,[activeRole]:[...new Set([...(prev[activeRole]||[]),...items.map(item=>item.id),...LOCKED])]}))
  const clearRole=()=>setMatrix(prev=>({...prev,[activeRole]:[...LOCKED,"support"]}))
  const save=()=>onSave?.({...Object.fromEntries(Object.entries(matrix).map(([role,views])=>[role,[...new Set(views)].filter(id=>id!=="dashboard")])),__actions:actions})

  return <div className={s.layout}>
    <aside className={s.roles}><header><small>ROLES</small><h2>Acceso por perfil</h2><p>Elegí un perfil y definí sólo lo necesario.</p></header><div className={s.roleList}>{EDITABLE_ROLES.map(role=><button type="button" key={role} className={activeRole===role?s.active:""} onClick={()=>setActiveRole(role)}><b>{ROLE_LABELS[role]}</b><small>{(matrix[role]||[]).length} módulos</small></button>)}</div><div className={s.locked}><b>Propietario y Gerencia</b><span>Acceso completo.</span></div></aside>
    <section className={s.matrix}><header><div><small>{mode==="modules"?"MÓDULOS":"ACCIONES"}</small><h2>{ROLE_LABELS[activeRole]}</h2><div className={s.modeTabs}><button type="button" className={mode==="modules"?s.selected:""} onClick={()=>setMode("modules")}>Módulos</button><button type="button" className={mode==="actions"?s.selected:""} onClick={()=>setMode("actions")}>Acciones</button></div></div>{canManage&&<div className={s.actions}>{mode==="modules"?<button type="button" onClick={clearRole}>Mínimo</button>:null}<button type="button" className={s.primary} disabled={saving} onClick={save}>{saving?"Guardando…":"Guardar"}</button></div>}</header>
      {!canManage&&<div className={s.notice}>Sólo Propietario o Gerencia pueden modificar permisos.</div>}
      {mode==="modules"?<div className={s.groups}>{GROUPS.map(group=><article key={group.label}><div className={s.groupHead}><div><b>{group.label}</b><small>{group.items.filter(item=>current.has(item.id)).length}/{group.items.length}</small></div>{canManage&&<button type="button" onClick={()=>selectGroup(group.items)}>Activar grupo</button>}</div><div className={s.moduleGrid}>{group.items.map(item=>{const locked=LOCKED.has(item.id);return <label key={item.id} className={`${s.module} ${current.has(item.id)?s.enabled:""}`}><span><b>{item.label}</b><small>{locked?"Siempre visible":current.has(item.id)?"Visible":"Oculto"}</small></span><input type="checkbox" checked={current.has(item.id)} disabled={!canManage||locked} onChange={e=>patch(item.id,e.target.checked)}/><i/></label>})}</div></article>)}</div>:<div className={s.actionGroups}>{ACTION_GROUPS.map(group=><article key={group.label}><div className={s.actionTitle}><b>{group.label}</b></div><div className={s.actionGrid}>{group.items.map(item=>{const enabled=Boolean(currentActions[item.id]);return <label key={item.id} className={`${s.actionCard} ${enabled?s.enabled:""}`}><span><b>{item.label}</b><small>{enabled?"Permitido":"Bloqueado"}</small></span><input type="checkbox" checked={enabled} disabled={!canManage} onChange={e=>patchAction(item.id,e.target.checked)}/><i/></label>})}</div></article>)}</div>}
    </section>
  </div>
}
