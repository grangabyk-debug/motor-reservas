import{MANAGEMENT_NAV,OPERATIONS_NAV,PRIMARY_NAV}from"../../core/navigation"
import s from"../../pms-next.module.css"

function NavGroup({title,items,view,onView}){
  return <section className={s.navGroup}>
    {title&&<small className={s.navLabel}>{title}</small>}
    {items.map(item=><button key={item.id} type="button" className={`${s.navItem} ${view===item.id?s.navItemActive:""}`} onClick={()=>onView(item.id)}><span className={s.navDot}/><span>{item.label}</span></button>)}
  </section>
}

export default function PmsSidebar({view,onView,hotelName="Hotel Demo"}){
  return <aside className={s.sidebar}>
    <div className={s.brandBlock}>
      <button className={s.brandButton} type="button" onClick={()=>onView("dashboard")}>
        <span className={s.brandMark}>HL</span>
        <span><b>Habitación Llena</b><small>PMS NEXT</small></span>
      </button>
      <div className={s.propertyCard}><span className={s.propertyAvatar}>{hotelName.slice(0,1).toUpperCase()}</span><span><b>{hotelName}</b><small>Propiedad activa</small></span><button type="button" aria-label="Cambiar propiedad">⌄</button></div>
    </div>
    <nav className={s.navScroll}>
      <NavGroup items={PRIMARY_NAV} view={view} onView={onView}/>
      <NavGroup title="Operación" items={OPERATIONS_NAV} view={view} onView={onView}/>
      <NavGroup title="Gestión" items={MANAGEMENT_NAV} view={view} onView={onView}/>
    </nav>
    <div className={s.sidebarFooter}><span><b>Recepción</b><small>Sesión de laboratorio</small></span><button type="button">•••</button></div>
  </aside>
}
