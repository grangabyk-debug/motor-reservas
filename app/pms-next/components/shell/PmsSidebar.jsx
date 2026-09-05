import{filterNavForRole,MANAGEMENT_NAV,OPERATIONS_NAV,PRIMARY_NAV}from"../../core/navigation"
import s from"../../pms-next.module.css"
import brand from"./pmsSidebarBrand.module.css"
import glass from"./pmsGlassShell.module.css"
import PmsIcon from"./PmsIcons"

const ROLE_LABELS={owner:"Propietario",admin:"Administrador",manager:"Gerencia",reception:"Recepción",night_audit:"Auditoría nocturna",housekeeping:"Housekeeping",maintenance:"Mantenimiento",revenue:"Revenue",member:"Equipo"}
const PROPERTY_CARD_STYLE={gridTemplateColumns:"28px minmax(0,1fr)"}
const PROPERTY_SELECT_STYLE={gridColumn:"1 / -1",width:"100%",maxWidth:"100%",minWidth:0,height:32,border:"1px solid var(--line)",borderRadius:9,background:"color-mix(in srgb,var(--panelSolid) 62%,transparent)",backdropFilter:"blur(16px) saturate(1.35)",color:"var(--text)",padding:"0 8px",outline:"none"}
const PROPERTY_LOCK_STYLE={gridColumn:"2",justifySelf:"end"}
const NAV_COLORS={dashboard:"#5b6cf3",planning:"#2797ff",reservations:"#8a63e8",quotes:"#d79a31",guests:"#ed6b8f",messages:"#20ad7a",tasks:"#ea7a37",requests:"#e65d68",housekeeping:"#21a8a0",maintenance:"#e09533",inventory:"#597fda",services:"#b268dc",rates:"#4b9c72",finance:"#2a9b64",onboarding:"#6181dc",website:"#5d8ee7",growth:"#45a16f",reports:"#7c68d8",audit:"#596f9d",staff:"#dd718f",integrations:"#557ed1",settings:"#7a8497",support:"#20a18f"}
function NavGroup({title,items,view,onView}){if(!items.length)return null;return <section className={s.navGroup}>{title&&<small className={s.navLabel}>{title}</small>}{items.map(item=>{const active=view===item.id;return <button key={item.id} type="button" style={{"--nav-icon":NAV_COLORS[item.id]||"var(--accent)"}} className={`${s.navItem} ${glass.navItemGlass} ${active?`${s.navItemActive} ${glass.navItemGlassActive}`:""}`} onClick={()=>onView(item.id)}><span className={glass.navIcon}><PmsIcon name={item.icon} size={15}/></span><span>{item.label}</span></button>})}</section>}

export default function PmsSidebar({view,onView,property,properties=[],onProperty,user,featureFlags={},rolePermissions={},buildId="local"}){
  const propertyName=property?.name||"Seleccionar propiedad",role=property?.role||"member",primary=filterNavForRole(PRIMARY_NAV,role,featureFlags,rolePermissions),operations=filterNavForRole(OPERATIONS_NAV,role,featureFlags,rolePermissions),management=filterNavForRole(MANAGEMENT_NAV,role,featureFlags,rolePermissions),version=buildId&&buildId!=="local"?buildId.slice(0,7):"local",roleLabel=ROLE_LABELS[role]||"Equipo"
  return <aside className={`${s.sidebar} ${glass.sidebarGlass}`}>
    <div className={s.brandBlock}>
      <button className={s.brandButton} type="button" onClick={()=>onView("dashboard")}><span className={brand.brandName}>HabitacionLlena.com</span></button>
      <div className={s.propertyCard} style={PROPERTY_CARD_STYLE}><span className={s.propertyAvatar}>{propertyName.slice(0,1).toUpperCase()}</span><label style={{minWidth:0}}><b>{propertyName}</b><small>{property?.city||"Propiedad activa"} · {roleLabel}</small></label>{properties.length>1?<select style={PROPERTY_SELECT_STYLE} aria-label="Cambiar propiedad" value={property?.id||""} onChange={e=>onProperty?.(e.target.value)}>{properties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>:<span className={s.propertyLock} style={PROPERTY_LOCK_STYLE}>✓</span>}</div>
    </div>
    <nav className={s.navScroll}><NavGroup items={primary} view={view} onView={onView}/><NavGroup title="Operación" items={operations} view={view} onView={onView}/><NavGroup title="Gestión" items={management} view={view} onView={onView}/></nav>
    <div className={s.sidebarFooter}><span><b>{user?.email||"Usuario autenticado"}</b><small>{roleLabel} · v{version}</small></span>{management.some(item=>item.id==="settings")&&<button type="button" title={`Configuración · versión ${version}`} onClick={()=>onView("settings")}>•••</button>}</div>
  </aside>
}