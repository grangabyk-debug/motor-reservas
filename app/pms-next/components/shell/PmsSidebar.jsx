import{filterNavForRole,MANAGEMENT_NAV,OPERATIONS_NAV,PRIMARY_NAV}from"../../core/navigation"
import s from"../../pms-next.module.css"
import brand from"./pmsSidebarBrand.module.css"

const ROLE_LABELS={owner:"Propietario",admin:"Administrador",manager:"Gerencia",reception:"Recepción",night_audit:"Auditoría nocturna",housekeeping:"Housekeeping",maintenance:"Mantenimiento",revenue:"Revenue",member:"Equipo"}
const PROPERTY_CARD_STYLE={gridTemplateColumns:"28px minmax(0,1fr)"}
const PROPERTY_SELECT_STYLE={gridColumn:"1 / -1",width:"100%",maxWidth:"100%",minWidth:0,height:32,border:"1px solid var(--line)",borderRadius:9,background:"color-mix(in srgb,var(--panelSolid) 82%,transparent)",color:"var(--text)",padding:"0 8px",outline:"none"}
const PROPERTY_LOCK_STYLE={gridColumn:"2",justifySelf:"end"}
const ACTIVE_DOT_STYLE={border:"1px solid #55d98a",background:"#3ed477",boxShadow:"0 0 5px #48da80,0 0 12px rgba(62,212,119,.75),0 0 22px rgba(62,212,119,.35)",opacity:1}
function NavGroup({title,items,view,onView}){if(!items.length)return null;return <section className={s.navGroup}>{title&&<small className={s.navLabel}>{title}</small>}{items.map(item=>{const active=view===item.id;return <button key={item.id} type="button" className={`${s.navItem} ${active?s.navItemActive:""}`} onClick={()=>onView(item.id)}><span className={s.navDot} style={active?ACTIVE_DOT_STYLE:undefined}/><span>{item.label}</span></button>})}</section>}

export default function PmsSidebar({view,onView,property,properties=[],onProperty,user,featureFlags={},rolePermissions={},buildId="local"}){
  const propertyName=property?.name||"Seleccionar propiedad",role=property?.role||"member",primary=filterNavForRole(PRIMARY_NAV,role,featureFlags,rolePermissions),operations=filterNavForRole(OPERATIONS_NAV,role,featureFlags,rolePermissions),management=filterNavForRole(MANAGEMENT_NAV,role,featureFlags,rolePermissions),version=buildId&&buildId!=="local"?buildId.slice(0,7):"local",roleLabel=ROLE_LABELS[role]||"Equipo"
  return <aside className={s.sidebar}>
    <div className={s.brandBlock}>
      <button className={s.brandButton} type="button" onClick={()=>onView("dashboard")}><span className={brand.brandName}>HabitacionLlena.com</span></button>
      <div className={s.propertyCard} style={PROPERTY_CARD_STYLE}><span className={s.propertyAvatar}>{propertyName.slice(0,1).toUpperCase()}</span><label style={{minWidth:0}}><b>{propertyName}</b><small>{property?.city||"Propiedad activa"} · {roleLabel}</small></label>{properties.length>1?<select style={PROPERTY_SELECT_STYLE} aria-label="Cambiar propiedad" value={property?.id||""} onChange={e=>onProperty?.(e.target.value)}>{properties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>:<span className={s.propertyLock} style={PROPERTY_LOCK_STYLE}>✓</span>}</div>
    </div>
    <nav className={s.navScroll}><NavGroup items={primary} view={view} onView={onView}/><NavGroup title="Operación" items={operations} view={view} onView={onView}/><NavGroup title="Gestión" items={management} view={view} onView={onView}/></nav>
    <div className={s.sidebarFooter}><span><b>{user?.email||"Usuario autenticado"}</b><small>{roleLabel} · v{version}</small></span>{management.some(item=>item.id==="settings")&&<button type="button" title={`Configuración · versión ${version}`} onClick={()=>onView("settings")}>•••</button>}</div>
  </aside>
}
