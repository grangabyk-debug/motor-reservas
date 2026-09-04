import{filterNavForRole,MANAGEMENT_NAV,OPERATIONS_NAV,PRIMARY_NAV}from"../../core/navigation"
import s from"../../pms-next.module.css"

const ROLE_LABELS={owner:"Propietario",admin:"Administrador",manager:"Gerencia",reception:"Recepción",night_audit:"Auditoría nocturna",housekeeping:"Housekeeping",maintenance:"Mantenimiento",revenue:"Revenue",member:"Equipo"}
function NavGroup({title,items,view,onView}){if(!items.length)return null;return <section className={s.navGroup}>{title&&<small className={s.navLabel}>{title}</small>}{items.map(item=><button key={item.id} type="button" className={`${s.navItem} ${view===item.id?s.navItemActive:""}`} onClick={()=>onView(item.id)}><span className={s.navDot}/><span>{item.label}</span></button>)}</section>}

export default function PmsSidebar({view,onView,property,properties=[],onProperty,user,featureFlags={},buildId="local"}){
  const propertyName=property?.name||"Seleccionar propiedad",role=property?.role||"member",primary=filterNavForRole(PRIMARY_NAV,role,featureFlags),operations=filterNavForRole(OPERATIONS_NAV,role,featureFlags),management=filterNavForRole(MANAGEMENT_NAV,role,featureFlags),version=buildId&&buildId!=="local"?buildId.slice(0,7):"local",roleLabel=ROLE_LABELS[role]||"Equipo"
  return <aside className={s.sidebar}>
    <div className={s.brandBlock}>
      <button className={s.brandButton} type="button" onClick={()=>onView("dashboard")}><span className={s.brandMark}>HL</span><span><b>Habitación Llena</b><small>PMS HOTELERO</small></span></button>
      <div className={s.propertyCard}><span className={s.propertyAvatar}>{propertyName.slice(0,1).toUpperCase()}</span><label><b>{propertyName}</b><small>{property?.city||"Propiedad activa"} · {roleLabel}</small></label>{properties.length>1?<select aria-label="Cambiar propiedad" value={property?.id||""} onChange={e=>onProperty?.(e.target.value)}>{properties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>:<span className={s.propertyLock}>✓</span>}</div>
    </div>
    <nav className={s.navScroll}><NavGroup items={primary} view={view} onView={onView}/><NavGroup title="Operación" items={operations} view={view} onView={onView}/><NavGroup title="Gestión" items={management} view={view} onView={onView}/></nav>
    <div className={s.sidebarFooter}><span><b>{user?.email||"Usuario autenticado"}</b><small>{roleLabel} · v{version}</small></span>{management.some(item=>item.id==="settings")&&<button type="button" title={`Configuración · versión ${version}`} onClick={()=>onView("settings")}>•••</button>}</div>
  </aside>
}
