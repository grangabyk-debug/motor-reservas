"use client"

import{useEffect,useMemo,useState}from"react"
import{HOTEL_NAVIGATION,groupForView}from"../../core/navigation"
import{ROLE_LABELS}from"../../core/permissions"
import ui from"./shell.module.css"

function initials(name="Hotel"){return String(name).trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()||"HL"}

export default function HotelSidebar({view,onView,hotelName="Hotel",hotelLogo="",role="reception",properties=[],propertyId,onPropertyChange,onLogout,mobileOpen=false}){
  const activeGroup=useMemo(()=>view==="support"?"":groupForView(view).id,[view])
  const[expanded,setExpanded]=useState("")
  useEffect(()=>setExpanded(""),[view])
  function openView(id){setExpanded("");onView(id)}

  return <aside className={`${ui.rail} ${mobileOpen?ui.railOpen:""}`} data-hl-rail="true" aria-label="Navegación de Habitación Llena">
    <div className={ui.railTop}>
      <button type="button" className={ui.railHome} onClick={()=>openView("lobby")} data-tip={hotelName} aria-label={`Ir al inicio de ${hotelName}`}>
        {hotelLogo?<span className={ui.hotelMark}><img src={hotelLogo} alt=""/></span>:<span className={ui.hotelMark}>{initials(hotelName)}</span>}
        <span className={ui.mobileHotelText}><b>{hotelName}</b><small>Habitación Llena</small></span>
      </button>
      {properties.length>1&&<label className={ui.hotelSwitch} data-tip="Cambiar propiedad">
        <span aria-hidden="true">⌂</span>
        <select aria-label="Cambiar propiedad" value={propertyId} onChange={e=>onPropertyChange?.(e.target.value)}>{properties.map(item=><option key={item.id} value={item.id}>{item.hotel_name||item.name}</option>)}</select>
      </label>}
    </div>

    <nav className={ui.moduleList} aria-label="Módulos del hotel">
      {HOTEL_NAVIGATION.map(group=><div key={group.id} className={ui.moduleItem}>
        <button type="button" className={`${ui.moduleButton} ${activeGroup===group.id?ui.moduleButtonActive:""}`} data-tip={group.label} aria-label={group.label} aria-expanded={expanded===group.id} onClick={()=>setExpanded(current=>current===group.id?"":group.id)}>
          <i aria-hidden="true">{group.icon}</i>
          <span className={ui.mobileModuleText}><b>{group.label}</b><small>{group.description}</small></span>
          <span className={ui.mobileChevron} aria-hidden="true">›</span>
        </button>
        {expanded===group.id&&<div className={ui.moduleFlyout} role="menu" aria-label={group.label}>
          <header><small>MÓDULO</small><b>{group.label}</b><span>{group.description}</span></header>
          <div>{group.items.map(([id,label,icon])=><button type="button" role="menuitem" key={id} className={view===id?ui.flyoutActive:""} onClick={()=>openView(id)}><i aria-hidden="true">{icon}</i><span>{label}</span>{view===id&&<em aria-hidden="true">●</em>}</button>)}</div>
        </div>}
      </div>)}
    </nav>

    <footer className={ui.railBottom}>
      <button type="button" className={`${ui.railUtility} ${view==="support"?ui.railUtilityActive:""}`} data-tip="Ayuda & soporte" aria-label="Ayuda y soporte" onClick={()=>openView("support")}><span aria-hidden="true">?</span><b>Ayuda & soporte</b></button>
      <div className={ui.sessionMark} data-tip={ROLE_LABELS[role]||role} aria-label={`Sesión: ${ROLE_LABELS[role]||role}`}><span>{initials(ROLE_LABELS[role]||role)}</span><b>{ROLE_LABELS[role]||role}</b></div>
      <button type="button" className={ui.railUtility} data-tip="Salir" aria-label="Salir" onClick={onLogout}><span aria-hidden="true">↪</span><b>Salir</b></button>
      <div className={ui.countryMark} data-tip="Hecho en Argentina" aria-label="Hecho en Argentina"><i aria-hidden="true"/><b>Hecho en Argentina</b></div>
    </footer>
  </aside>
}
