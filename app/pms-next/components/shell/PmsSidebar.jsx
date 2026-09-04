import{MANAGEMENT_NAV,OPERATIONS_NAV,PRIMARY_NAV}from"../../core/navigation"
import s from"../../pms-next.module.css"

function NavGroup({title,items,view,onView}){
  return <section className={s.navGroup}>
    {title&&<small className={s.navLabel}>{title}</small>}
    {items.map(item=><button key={item.id} type="button" className={`${s.navItem} ${view===item.id?s.navItemActive:""}`} onClick={()=>onView(item.id)}><span className={s.navDot}/><span>{item.label}</span></button>)}
  </section>
}

export default function PmsSidebar({view,onView,property,properties=[],onProperty,user}){
  const propertyName=property?.name||"Seleccionar propiedad"
  return <aside className={s.sidebar}>
    <div className={s.brandBlock}>
      <button className={s.brandButton} type="button" onClick={()=>onView("dashboard")}>
        <span className={s.brandMark}>HL</span>
        <span><b>Habitación Llena</b><small>PMS HOTELERO</small></span>
      </button>
      <div className={s.propertyCard}>
        <span className={s.propertyAvatar}>{propertyName.slice(0,1).toUpperCase()}</span>
        <label><b>{propertyName}</b><small>{property?.city||"Propiedad activa"}</small></label>
        {properties.length>1?<select aria-label="Cambiar propiedad" value={property?.id||""} onChange={e=>onProperty?.(e.target.value)}>{properties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>:<span className={s.propertyLock}>✓</span>}
      </div>
    </div>
    <nav className={s.navScroll}>
      <NavGroup items={PRIMARY_NAV} view={view} onView={onView}/>
      <NavGroup title="Operación" items={OPERATIONS_NAV} view={view} onView={onView}/>
      <NavGroup title="Gestión" items={MANAGEMENT_NAV} view={view} onView={onView}/>
    </nav>
    <div className={s.sidebarFooter}><span><b>{user?.email||"Usuario autenticado"}</b><small>Acceso protegido por propiedad</small></span><button type="button">•••</button></div>
  </aside>
}
