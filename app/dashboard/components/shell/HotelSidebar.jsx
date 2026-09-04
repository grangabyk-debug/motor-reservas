"use client"

import{ROLE_LABELS}from"../../core/permissions"
import HotelIcon from"./HotelIcon"
import ThemeModeButton from"./ThemeModeButton"
import ui from"./shell.module.css"

const MAIN=[
  ["lobby","Dashboard"],["calendar","Planning"],["rates","Tarifas"],["reports","Informes"],["reservations","Reservas"],["guests","Huéspedes"],["messages","Mensajes"]
]
const QUICK=[
  ["new","Crear reserva"],["housekeeping","Rack de limpiezas"],["calendar","Rack de asignaciones"],["rooms","Rack de disponibilidad"],["maintenance","Última actividad"],["keys","Puertas"],["billing","Facturación de servicios"]
]
const MORE=[
  ["cash","Caja & Folios"],["partners","Empresas & Agencias"],["distribution","Distribución"],["team","Equipo & Roles"],["settings","Configuración"],["support","Ayuda"]
]

function initials(name="Hotel"){return String(name).trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"HL"}
function Item({id,label,view,onView,onNewReservation}){
  const active=id!=="new"&&view===id
  const action=()=>id==="new"?onNewReservation?.():onView(id)
  return <button type="button" className={`${ui.navItem} ${active?ui.navActive:""}`} onClick={action} aria-current={active?"page":undefined}>
    <span className={ui.navIcon}><HotelIcon name={id==="new"?"reservations":id}/></span><span>{label}</span>
  </button>
}

export default function HotelSidebar({view,onView,hotelName="Hotel",hotelLogo="",role="reception",properties=[],propertyId,onPropertyChange,onLogout,onNewReservation,mobileOpen=false}){
  return <aside className={`${ui.rail} ${mobileOpen?ui.railOpen:""}`} aria-label="Navegación principal">
    <div className={ui.identity}>
      <button type="button" className={ui.brand} onClick={()=>onView("lobby")}>{hotelLogo?<img src={hotelLogo} alt=""/>:<span>{initials(hotelName)}</span>}<div><b>¡Hola Recepción! 👋</b><small>PROPIEDADES</small></div></button>
      {properties.length>1?<select className={ui.propertySelect} value={propertyId} onChange={e=>onPropertyChange?.(e.target.value)}>{properties.map(p=><option value={p.id} key={p.id}>{p.hotel_name||p.name}</option>)}</select>:<div className={ui.propertyName}>{hotelName}</div>}
    </div>
    <nav className={ui.navScroll}>
      <div className={ui.navGroup}>{MAIN.map(([id,label])=><Item key={id} id={id} label={label} view={view} onView={onView} onNewReservation={onNewReservation}/>)}</div>
      <div className={ui.groupTitle}>Accesos Rápidos</div>
      <div className={ui.navGroup}>{QUICK.map(([id,label],i)=><Item key={`${id}-${i}`} id={id} label={label} view={view} onView={onView} onNewReservation={onNewReservation}/>)}</div>
      <div className={ui.groupTitle}>Administración</div>
      <div className={ui.navGroup}>{MORE.map(([id,label])=><Item key={id} id={id} label={label} view={view} onView={onView} onNewReservation={onNewReservation}/>)}</div>
    </nav>
    <footer className={ui.sideFooter}><div><span className={ui.footerMark}>HL</span><span><b>Habitación Llena</b><small>{ROLE_LABELS[role]||role}</small></span></div><div className={ui.sideFooterActions}><ThemeModeButton compact/><button type="button" className={ui.logoutButton} onClick={onLogout}>Salir</button></div></footer>
  </aside>
}
